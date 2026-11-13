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
    page = await browser.new_page(viewport={"width": 430, "height": 932}, device_scale_factor=1)
    query = urlencode({"capture": "1", "embedded": "1", "flow": flow,
                       "screen": screen, "rail": rail})
    await page.goto(origin + "/transfi-remittance/legacy.html?" + query)
    await expect(page.locator(".phone.tf-phone > .head .h1")).to_have_text(
        ("Пополнение " if flow == "in" else "Вывод ") + rail
    )
    assert await page.locator(".phone.tf-phone .tf-head-action").count() == 2, "Missing right header icons"
    assert await page.locator(".tf-scroll select:visible").count() == 0, "Native select leaked into bank UI"
    return page


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
            await page.locator('[data-picker-value="GBP"]').click()
            assert "GBP" in await page.locator('[data-picker="outCurrency"]').inner_text()
        await page.locator('[data-picker="country"]').click()
        await expect(page.locator(".tf-picker-sheet")).to_be_visible()
        await page.locator('[data-picker-value="DE"]').click()
        assert "Германия" in await page.locator('[data-picker="country"]').inner_text()
        await page.close()

        page = await bank_page(browser, origin, "out", rail, "out-recipient")
        await page.locator('[data-picker="purpose"]').click()
        await expect(page.locator(".tf-picker-sheet")).to_be_visible()
        await page.locator('[data-picker-value="other"]').click()
        await expect(page.locator("#wrap-purposeOther")).to_be_visible()
        await page.close()

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
