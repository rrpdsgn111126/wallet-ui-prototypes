#!/usr/bin/env python3
"""Playwright smoke/regression for the canonical TransFi bank flows.

Usage:
    python3 -m pip install playwright
    python3 -m playwright install chromium
    python3 tests/bank-qa/smoke.py

Serves the actual repository over localhost to exercise iframe postMessage.
Does not call provider APIs or mutate the mock balances.
"""
import asyncio
import contextlib
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlencode

from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[2]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


async def bank_page(browser, origin, flow, rail, screen):
    page = await browser.new_page(viewport={"width": 430, "height": 932}, device_scale_factor=1, reduced_motion="reduce")
    query = urlencode({"capture": "1", "embedded": "1", "flow": flow,
                       "screen": screen, "rail": rail})
    await page.goto(origin + "/transfi-remittance/legacy.html?" + query)
    await expect(page.locator(".phone.tf-phone > .head .h1")).to_have_text(
        ("Пополнение " if flow == "in" else "Вывод ") + rail
    )
    assert await page.locator(".phone.tf-phone .tf-head-action").count() == 2, "Missing right header icons"
    assert await page.locator(".tf-scroll select:visible").count() == 0, "Native select leaked into bank UI"
    return page


async def assert_native_picker(page, country=False):
    """Verify the bank sheet matches the native USDT network picker markup/stack."""
    sheet=page.locator(".tf-picker-sheet")
    await expect(sheet).to_be_visible()
    geometry=await page.evaluate("""() => {
      const root=document.querySelector('#pickerLayer');
      const dim=root.querySelector('.tf-picker-dim');
      const sheet=root.querySelector('.tf-picker-sheet');
      const box=sheet.querySelector('.tf-picker-box');
      const row=box.querySelector('.tf-picker-row');
      const radio=row.querySelector('.rd');
      const sr=sheet.getBoundingClientRect(), br=box.getBoundingClientRect();
      const hit=document.elementFromPoint(sr.left+sr.width/2,sr.top+Math.min(64,sr.height/2));
      return {
        overlay:root.classList.contains('view')&&root.classList.contains('ovl'),
        dimZ:Number(getComputedStyle(dim).zIndex),
        sheetZ:Number(getComputedStyle(sheet).zIndex),
        dimOpacity:parseFloat(getComputedStyle(dim).opacity),
        sheetOnTop:sheet===hit||sheet.contains(hit),
        boxCount:sheet.querySelectorAll('.box').length,
        rowCount:box.querySelectorAll('.row').length,
        boxBackground:getComputedStyle(box).backgroundColor,
        rowBackground:getComputedStyle(row).backgroundColor,
        radioWidth:parseFloat(getComputedStyle(radio).width),
        radioHeight:parseFloat(getComputedStyle(radio).height),
        selected:box.querySelectorAll('.rd.on').length,
        oldCards:box.querySelectorAll('.tf-picker-row[style*="border-radius"]').length,
        flags:box.querySelectorAll('.tf-country-flag').length,
        matchingFlags:box.querySelectorAll('.tf-picker-row .ri .tf-country-flag').length,
        textFlags:box.querySelectorAll('.tf-flag-emoji').length,
        rowWidth:row.getBoundingClientRect().width,
        boxWidth:br.width,
        sheetWidth:sr.width,
        checked:box.querySelectorAll('[aria-checked="true"]').length,
        checkGlyphs:[...box.querySelectorAll('.rd')].some(el=>el.textContent.trim().length>0)
      };
    }""")
    assert geometry["overlay"], geometry
    assert geometry["dimZ"] == 4 and geometry["sheetZ"] == 5, geometry
    assert 0.38 <= geometry["dimOpacity"] <= 0.42 and geometry["sheetOnTop"], geometry
    assert geometry["boxCount"] == 1 and geometry["rowCount"] >= 3, geometry
    assert geometry["boxBackground"] != geometry["rowBackground"], geometry
    assert geometry["radioWidth"] == 24 and geometry["radioHeight"] == 24, geometry
    assert geometry["selected"] == 1 and geometry["checked"] == 1, geometry
    assert geometry["oldCards"] == 0 and not geometry["checkGlyphs"], geometry
    assert abs(geometry["rowWidth"] - geometry["boxWidth"]) < 1, geometry
    assert not geometry["textFlags"], geometry
    if country:
        assert geometry["flags"] == geometry["rowCount"], geometry
        assert geometry["matchingFlags"] == geometry["rowCount"], geometry
        assert await page.locator('[data-picker="country"] .tf-country-flag').count() == 1
    else:
        assert geometry["flags"] == 0, geometry


async def smoke(browser, origin):
    for rail in ("SEPA", "SWIFT"):
        page = await bank_page(browser, origin, "in", rail, "in-details")
        if rail == "SEPA":
            assert await page.locator('[data-picker="inCurrency"]').count() == 0, "SEPA EUR must be fixed"
            assert "EUR" in await page.locator(".tf-deposit-currency").inner_text()
        else:
            await page.locator('[data-picker="inCurrency"]').click()
            sheet = page.locator(".tf-picker-sheet")
            await expect(sheet).to_be_visible()
            await assert_native_picker(page)
            await page.locator('[data-picker-value="USD"]').click()
            await expect(sheet).to_have_count(0)
            assert "USD" in await page.locator('[data-picker="inCurrency"]').inner_text()
            assert "DEMOUS00" in await page.locator(".tf-requisites").inner_text()
            await page.locator('[data-picker="inCurrency"]').click()
            await page.keyboard.press("Escape")
            await expect(page.locator(".tf-picker-sheet")).to_have_count(0)
        await page.close()

        page = await bank_page(browser, origin, "out", rail, "out-config")
        if rail == "SEPA":
            assert await page.locator('[data-picker="outCurrency"]').count() == 0, "SEPA EUR must be fixed"
        else:
            await page.locator('[data-picker="outCurrency"]').click()
            await expect(page.locator(".tf-picker-sheet")).to_be_visible()
            await assert_native_picker(page)
            await page.locator('[data-picker-value="GBP"]').click()
            assert "GBP" in await page.locator('[data-picker="outCurrency"]').inner_text()
        await page.locator('[data-picker="country"]').click()
        await assert_native_picker(page, country=True)
        # Row must be clickable without force, with the dim BEHIND the sheet.
        await page.locator('[data-picker-value="FR"]').click()
        assert "Франция" in await page.locator('[data-picker="country"]').inner_text()
        await page.locator('[data-picker="country"]').click()
        await assert_native_picker(page, country=True)
        await page.locator('[data-picker-value="DE"]').click()
        assert "Германия" in await page.locator('[data-picker="country"]').inner_text()
        await page.close()

        page = await bank_page(browser, origin, "out", rail, "out-recipient")
        await page.locator('[data-picker="purpose"]').click()
        await expect(page.locator(".tf-picker-sheet")).to_be_visible()
        await assert_native_picker(page)
        await page.locator('[data-picker-value="other"]').click()
        await expect(page.locator("#wrap-purposeOther")).to_be_visible()
        await page.close()

    # The design-system catalog must render the ACTUAL bank picker, not a
    # static redrawing. Both examples use nested same-origin iframes.
    catalog = await browser.new_page(viewport={"width": 1440, "height": 900})
    await catalog.goto(origin + "/ui-kit/")
    entry = catalog.locator("#bankpicker")
    await expect(entry).to_have_count(1)
    await entry.scroll_into_view_if_needed()
    for mode, field, new_value, expected in (
        ("country", "country", "FR", "Франция"),
        ("currency", "outCurrency", "GBP", "GBP"),
    ):
        outer=catalog.frame_locator(
            '#bankpicker iframe[src*="mode=' + mode + '"]'
        )
        inner=outer.frame_locator("iframe.canonical-embed")
        await expect(inner.locator(".tf-picker-sheet")).to_be_visible(timeout=15000)
        assert await inner.locator(".tf-picker-box").count() == 1
        assert await inner.locator(".tf-picker-row .rd.on").count() == 1
        if mode=="country":
            assert await inner.locator(".tf-picker-row .tf-country-flag").count() == 4
        await inner.locator('[data-picker-value="' + new_value + '"]').click()
        await expect(inner.locator(".tf-picker-sheet")).to_have_count(0)
        selected=inner.locator('[data-picker="' + field + '"]')
        assert expected in await selected.inner_text()
        await selected.click()
        await expect(inner.locator(".tf-picker-sheet")).to_be_visible()
    await catalog.close()

    # Test actual embedded exit, not just a standalone legacy.html page.
    page = await browser.new_page(viewport={"width": 430, "height": 932})
    await page.goto(origin + "/transfi-remittance/?flow=in&rail=SWIFT")
    iframe = page.locator("#tf-bank-overlay iframe")
    await expect(iframe).to_be_visible(timeout=30000)
    child = page.frame_locator("#tf-bank-overlay iframe")
    await expect(child.locator(".tf-picker-trigger[data-picker='inCurrency']")).to_be_visible()
    await child.locator(".phone.tf-phone > .head .back").click()
    await expect(page.locator("#tf-bank-overlay")).to_be_hidden()
    assert await page.locator(".view.on .sheet:not([hidden])").count() == 0, "Old sheet left behind"
    await page.close()


async def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = "http://127.0.0.1:" + str(server.server_port)
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
            try:
                await smoke(browser, origin)
            finally:
                await browser.close()
        print("PASS: SEPA/SWIFT deposit and withdrawal selectors, header, purpose and embedded back")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    asyncio.run(main())
