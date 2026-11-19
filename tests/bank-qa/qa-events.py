#!/usr/bin/env python3
"""End-to-end checks for standalone QA event buttons (no real API or payments)."""
import asyncio
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[2]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


async def run(browser, origin):
    page = await browser.new_page(viewport={"width": 1440, "height": 900},
                                  reduced_motion="reduce")
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    await page.goto(origin + "/transfi-remittance/?qa=1")
    panel = page.locator("#tf-qa-panel")
    toggle = page.locator("#tf-qa-toggle")
    await expect(toggle).to_be_visible(timeout=30000)
    await expect(panel).to_be_hidden()
    assert await toggle.get_attribute("aria-expanded") == "false"
    toggle_box = await toggle.bounding_box()
    assert toggle_box and toggle_box["x"] + toggle_box["width"] >= 1420, toggle_box
    assert toggle_box["y"] <= 20, toggle_box
    await toggle.click()
    await expect(panel).to_be_visible()
    assert await toggle.get_attribute("aria-expanded") == "true"
    await page.evaluate("show('topup', false)")
    sbp = page.locator('#v-topup .m[data-go="dep-sbp"]')
    assert await sbp.evaluate("el => !el.hidden"), "SBP missing from top-up"
    await page.evaluate("paintWays()")
    assert await sbp.evaluate("el => !el.hidden"), "paintWays hides SBP"

    await page.locator("#tfqa-tab-events").click()
    for group in ("sepa", "swift", "sbp", "crypto", "other"):
        summary = page.locator(f"#pv-group-{group} > summary")
        await expect(summary).to_be_visible()
        assert not await page.locator(f"#pv-group-{group}").evaluate("el => el.open")

    for rail in ("SEPA", "SWIFT"):
        key = rail.lower()
        await page.locator(f"#pv-group-{key} > summary").click()
        for status, expected in (
            ("details", "Валюта пополнения"),
            ("pending", "Ожидаем поступление"),
            ("success", "Деньги зачислены"),
            ("held", "Поступление на проверке"),
        ):
            await page.locator(f"#pv-{key}-in-{status}").click()
            await expect(page.locator("#tf-bank-overlay")).to_be_visible()
            frame = page.frame_locator("#tf-bank-overlay iframe")
            await expect(frame.locator("#content")).to_contain_text(expected, timeout=15000)

        for status, expected, op_status in (
            ("pending", "Перевод обрабатывается", "queued"),
            ("success", "Перевели", "confirmed"),
            ("failed", "Перевод не выполнен", "rejected"),
            ("held", "Перевод на проверке", "confirming"),
        ):
            count_before = await page.evaluate(
                "(rail) => PV.data['/operations'].operations.filter(x => x.title==='Вывод '+rail).length", rail
            )
            await page.locator(f"#pv-{key}-out-{status}").click()
            await expect(page.locator("#tf-bank-overlay")).to_be_visible()
            frame = page.frame_locator("#tf-bank-overlay iframe")
            await expect(frame.locator("#content")).to_contain_text(expected, timeout=15000)
            await page.wait_for_function("""arg => PV.data['/operations'].operations.filter(
                x => x.title==='Вывод '+arg[0] && x.status===arg[1]
            ).length >= 1""", arg=[rail, op_status], timeout=10000)
            count_after = await page.evaluate(
                "(rail) => PV.data['/operations'].operations.filter(x => x.title==='Вывод '+rail).length", rail
            )
            assert count_after == count_before + 1, (rail, status, count_before, count_after)
            if status == "success":
                await frame.locator(".tf-foot .btno").click()
                await expect(page.locator("#tf-bank-overlay")).to_be_hidden()
                await expect(page.locator("#v-details.on")).to_be_visible()
                await expect(page.locator("#d-sub")).to_contain_text(rail)

    await page.locator("#pv-group-sbp > summary").click()
    await page.locator("#pv-sbp-ok").click()
    await expect(page.locator("#v-dep-sbp-out.on")).to_be_visible(timeout=10000)
    await expect(page.locator("#sbp-o-h")).to_contain_text("Зачислили")
    await expect(page.locator("#tf-bank-overlay")).to_be_hidden()
    await page.locator("#pv-sbp-fail").click()
    await expect(page.locator("#v-dep-sbp-out.on")).to_be_visible(timeout=10000)
    await expect(page.locator("#sbp-o-fail")).to_be_visible()

    await page.locator("#pv-group-crypto > summary").click()
    for button, label in (
        ("pv-deposit-ok", "Пополнение USDT"),
        ("pv-deposit-review", "Пополнение USDT"),
        ("pv-usdc-ok", "Пополнение USDC"),
        ("pv-usdc-review", "Пополнение USDC"),
    ):
        await page.locator("#" + button).click()
        await expect(page.locator("#v-details.on")).to_be_visible()
        await expect(page.locator("#d-sub")).to_contain_text(label)

    await page.locator("#pv-group-other > summary").click()
    await page.locator("#pv-internal-ok").click()
    await expect(page.locator("#v-details.on")).to_be_visible()
    await page.locator("#pv-open-last").click()
    await expect(page.locator("#v-details.on")).to_be_visible()
    assert not errors, errors
    await page.close()


async def check_mobile(browser, origin, width):
    page = await browser.new_page(viewport={"width": width, "height": 844},
                                  reduced_motion="reduce")
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    await page.goto(origin + "/transfi-remittance/?qa=1")
    toggle = page.locator("#tf-qa-toggle")
    panel = page.locator("#tf-qa-panel")
    backdrop = page.locator("#tf-qa-backdrop")
    await expect(toggle).to_be_visible(timeout=30000)
    await expect(panel).to_be_hidden()
    assert await backdrop.is_hidden()
    phone_box = await page.locator(".phone").bounding_box()
    toggle_box = await toggle.bounding_box()
    assert phone_box and toggle_box, (phone_box, toggle_box)
    assert toggle_box["y"] >= phone_box["y"] + phone_box["height"] - 2, (phone_box, toggle_box)
    assert await page.evaluate("document.documentElement.scrollHeight > innerHeight"), "QA trigger cannot be reached below the wallet"
    await toggle.scroll_into_view_if_needed()
    await toggle.click()
    await expect(panel).to_be_visible()
    await expect(backdrop).to_be_visible()
    assert await panel.get_attribute("aria-modal") == "true"
    assert await page.locator("#tfqa-close").evaluate("el => document.activeElement === el")
    await page.locator("#tfqa-tab-events").click()
    await expect(page.locator("#pv-group-sepa > summary")).to_be_visible()
    await page.keyboard.press("Escape")
    await expect(panel).to_be_hidden()
    await expect(backdrop).to_be_hidden()
    assert await toggle.get_attribute("aria-expanded") == "false"
    await toggle.click()
    await expect(panel).to_be_visible()
    await backdrop.click(position={"x": 4, "y": 4})
    await expect(panel).to_be_hidden()
    assert not errors, (width, errors)
    await page.close()


async def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch()
            try:
                origin = "http://127.0.0.1:" + str(server.server_port)
                await run(browser, origin)
                for width in (390, 430):
                    await check_mobile(browser, origin, width)
            finally:
                await browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print("PASS: desktop QA events and modal mobile QA at 390/430, SEPA, SWIFT, SBP, USDT, USDC and ALT.VU")


if __name__ == "__main__":
    asyncio.run(main())
