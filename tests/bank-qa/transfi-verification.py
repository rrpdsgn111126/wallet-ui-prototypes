#!/usr/bin/env python3
"""Playwright regression for the shared TransFi contact-verification mock.

Run from the repository root:
    python3 tests/bank-qa/transfi-verification.py

Serves the actual wallet shell via localhost. Does not send real email or money.
"""
import asyncio
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlencode
from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[2]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


async def fresh_page(browser, origin, flow="in", rail="SEPA"):
    context = await browser.new_context(viewport={"width": 430, "height": 932},
                                        reduced_motion="reduce")
    page = await context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    q = urlencode({"qa": "1", "flow": flow, "rail": rail})
    await page.goto(origin + "/transfi-remittance/?" + q)
    await expect(page.locator("#tfv-page")).to_be_visible(timeout=30000)
    await expect(page.locator("#tfv-page .tfv-title")).to_have_text("Подтвердите email")
    return context, page, errors


async def test_all_rails(browser, origin):
    for rail, flow in (("SEPA", "in"), ("SWIFT", "in"),
                       ("SEPA", "out"), ("SWIFT", "out")):
        context, page, errors = await fresh_page(browser, origin, flow, rail)
        await page.locator('#tfv-page [data-tfv="send"]').click()
        await expect(page.locator("#tfv-page .tfv-title")).to_have_text("Проверьте почту")
        await page.evaluate("tfVerificationQA.setStatus('verified')")
        await expect(page.locator("#tfv-page .tfv-title")).to_have_text("Проверяем данные")
        await page.evaluate("tfVerificationQA.setStatus('approved')")
        await expect(page.locator("#tfv-page .tfv-title")).to_have_text("Проверка завершена")
        await page.locator('#tfv-page [data-tfv="continue"]').click()
        await expect(page.locator("#tf-bank-overlay")).to_be_visible()
        bank = page.frame_locator("#tf-bank-overlay iframe")
        await expect(bank.locator(".phone.tf-phone > .head .h1")).to_contain_text(rail)
        assert not errors, (rail, flow, errors)
        await context.close()


async def test_close_notification_sheet_and_reopen(browser, origin):
    context, page, errors = await fresh_page(browser, origin)
    await page.locator('#tfv-page [data-tfv="send"]').click()
    await page.locator('#tfv-page [data-tfv="close"]').click()
    await expect(page.locator("#tfv-page")).to_be_hidden()
    await page.evaluate("tfVerificationQA.setStatus('approved')")
    await expect(page.locator("#tfv-sheet")).to_be_visible()
    await page.locator('#tfv-sheet [data-tfv="dismiss"]').last.click()
    await expect(page.locator("#tfv-sheet")).to_be_hidden()
    await page.evaluate("show('notes')")
    await expect(page.locator("#v-notes.on")).to_be_visible()
    await expect(page.locator(".tfv-note")).to_contain_text("Проверка завершена")
    await page.locator(".tfv-note").click()
    await expect(page.locator("#tf-bank-overlay")).to_be_visible()
    await page.reload()
    await page.evaluate("tfOpenBank('SWIFT','out')")
    await expect(page.locator("#tf-bank-overlay")).to_be_visible()
    await expect(page.locator("#tfv-page")).to_be_hidden()
    assert not errors, errors
    await context.close()


async def test_manual_review_and_rejection(browser, origin):
    context, page, errors = await fresh_page(browser, origin)
    await page.evaluate("tfVerificationQA.setStatus('manual_review')")
    await expect(page.locator("#tfv-page .tfv-title")).to_have_text("Проверка занимает больше времени")
    await page.evaluate("tfVerificationQA.setStatus('rejected')")
    await expect(page.locator("#tfv-page .tfv-title")).to_have_text("Проверка не пройдена")
    await page.locator('#tfv-page [data-tfv="support"]').click()
    await expect(page.locator("#tfv-page")).to_be_hidden()
    assert not errors, errors
    await context.close()


async def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = "http://127.0.0.1:" + str(server.server_port)
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            try:
                await test_all_rails(browser, origin)
                await test_close_notification_sheet_and_reopen(browser, origin)
                await test_manual_review_and_rejection(browser, origin)
            finally:
                await browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    asyncio.run(main())
