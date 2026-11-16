#!/usr/bin/env python3
"""Browser regression of the original alt.vu screens in the canonical static preview.
Uses a localhost server; does not make external payment requests.

Run:
  python3 -m playwright install chromium
  python3 tests/bank-qa/source-flows.py
"""
import asyncio
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.async_api import async_playwright, expect

ROOT=Path(__file__).resolve().parents[2]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass

async def open_source(page, view):
    await page.evaluate("""async view => {
      show(view);
      await afterShow(view);
    }""", view)
    await expect(page.locator("#v-"+view+".on")).to_be_visible()

async def enter_pin(page):
    for i in range(4):
        await page.evaluate("() => psKey('1')")
    await page.wait_for_timeout(150)

async def test_source(browser, origin):
    page=await browser.new_page(viewport={"width":430,"height":932})
    errors=[]
    page.on("pageerror",lambda exc:errors.append(str(exc)))
    await page.goto(origin+"/transfi-remittance/?qa=1")
    await expect(page.locator("#v-home.on")).to_be_visible(timeout=30000)
    await expect(page.locator("#pv-qa")).to_be_visible()
    await expect(page.locator("#v-home .op[data-id]")).to_have_count(5)

    # Four fixed bank transaction examples on the original home history:
    # SEPA deposit, SEPA withdrawal, SWIFT deposit, SWIFT withdrawal.
    bank_cases=(
        ("pv-sepa-in-001", "SEPA", "Пополнение SEPA", "EUR", "Зачислено"),
        ("pv-sepa-out-002", "SEPA", "Вывод SEPA", "EUR", "Отправлено"),
        ("pv-swift-in-003", "SWIFT", "Пополнение SWIFT", "GBP", "Зачислено"),
        ("pv-swift-out-004", "SWIFT", "Вывод SWIFT", "GBP", "Отправлено"),
    )
    for operation_id,rail,title,currency,status in bank_cases:
        entry=page.locator('#v-home .op[data-id="'+operation_id+'"]')
        await expect(entry).to_be_visible()
        await expect(entry).to_contain_text(title)
        await entry.click()
        await expect(page.locator("#v-details.on")).to_be_visible()
        await expect(page.locator("#d-sub")).to_contain_text(title)
        await expect(page.locator("#d-box")).to_contain_text("Способ перевода")
        await expect(page.locator("#d-box")).to_contain_text(rail)
        await expect(page.locator("#d-money")).to_contain_text(currency)
        await expect(page.locator("#d-money")).to_contain_text("Комиссия")
        await expect(page.locator("#d-receipt")).to_be_visible()
        await page.locator("#d-receipt").click()
        await expect(page.locator("#v-receipt.on")).to_be_visible()
        receipt=page.locator("#r-body")
        await expect(receipt).to_contain_text(title)
        await expect(receipt).to_contain_text("Способ перевода")
        await expect(receipt).to_contain_text(rail)
        await expect(receipt).to_contain_text(currency)
        await expect(receipt).to_contain_text("Номер операции")
        await expect(receipt).to_contain_text(status)
        printed=await page.evaluate("() => sReceipt()")
        assert title in printed and rail in printed and currency in printed,operation_id
        await page.locator("#v-receipt .back[data-back]").click()
        await expect(page.locator("#v-details.on")).to_be_visible()
        await page.locator("#v-details .back[data-back]").click()
        await expect(page.locator("#v-home.on")).to_be_visible()

    # Original detailed transaction card opened from the home operation row.
    await page.locator("#v-home .op[data-id]").first.click()
    await expect(page.locator("#v-details.on")).to_be_visible()
    await expect(page.locator("#d-money .row")).not_to_have_count(0)
    await page.locator("#v-details .back[data-back]").click()
    await expect(page.locator("#v-home.on")).to_be_visible()

    # Original crypto deposit screen obtains an offline, visibly dummy address.
    await open_source(page,"dep-usdt-tron")
    await expect(page.locator("#v-dep-usdt-tron .dep-addr")).to_contain_text("DEMO_ONLY")
    await page.locator("#pv-deposit-ok").click()
    await expect(page.locator("#v-details.on")).to_be_visible()
    await expect(page.locator("#d-amt")).to_contain_text("+100")

    # Original crypto withdrawal: form -> check -> any demo PIN -> native success.
    await open_source(page,"out-usdt-tron")
    root=page.locator("#v-out-usdt-tron")
    await root.locator(".wd-addr").fill("TDEMOONLYPLACEHOLDERFORCRYPTOOUT00001")
    await root.locator(".wd-amt").fill("20.00")
    await root.locator(".wd-go").click()
    await expect(page.locator("#v-withdraw-check.on")).to_be_visible()
    await page.locator("#wdc-go").click()
    await enter_pin(page)
    await expect(page.locator("#v-transfer-done.on")).to_be_visible()

    # Failure uses the original withdrawal review and an explicit preview-only
    # failure state (real transactions are never submitted).
    await page.locator("#pv-outcome").select_option("failed")
    await open_source(page,"out-usdt-tron")
    await root.locator(".wd-addr").fill("TDEMOONLYPLACEHOLDERFORCRYPTOOUT00002")
    await root.locator(".wd-amt").fill("20.00")
    await root.locator(".wd-go").click()
    await expect(page.locator("#v-withdraw-check.on")).to_be_visible()
    await page.locator("#wdc-go").click()
    await enter_pin(page)
    await expect(page.locator("#v-preview-failed.on")).to_be_visible()
    await page.locator("#pv-outcome").select_option("success")

    # Peer transfer to an existing demo user, with native review and success.
    await open_source(page,"transfer")
    await page.locator("#tr-to").fill("demo.receiver@example.invalid")
    await page.evaluate("() => trLookup()")
    await page.locator("#tr-amt").fill("12.50")
    await page.evaluate("() => trPaint()")
    await page.locator("#tr-next").click()
    await expect(page.locator("#v-transfer-check.on")).to_be_visible()
    await page.locator("#trc-go").click()
    await enter_pin(page)
    await expect(page.locator("#v-transfer-done.on")).to_be_visible()

    # Native SBP amount and bank picker -> payment QR/wait -> simulated callback.
    await open_source(page,"dep-sbp")
    await page.locator("#sbp-rub").fill("8888")
    await page.evaluate("() => sbpInput('rub')")
    await page.wait_for_function("() => Boolean(sbp.quote && sbp.bank)",timeout=15000)
    await page.locator("#sbp-go").click()
    await expect(page.locator("#v-dep-sbp-qr.on, #v-dep-sbp-wait.on")).to_be_visible()
    await page.locator("#pv-sbp-ok").click()
    await expect(page.locator("#v-dep-sbp-out.on")).to_be_visible(timeout=15000)
    assert "Зачислили" in await page.locator("#sbp-o-h").inner_text()

    # Assert no runtime JS exceptions.
    assert not errors,"Browser JS errors: "+" | ".join(errors)
    await page.close()

async def main():
    server=ThreadingHTTPServer(("127.0.0.1",0),partial(Quiet,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=True,args=["--no-sandbox"])
            try:
                await test_source(browser,"http://127.0.0.1:"+str(server.server_port))
            finally:
                await browser.close()
        print("PASS: four bank history/detail/receipt flows and original home details, deposit callback, withdrawal review/success/failure, peer review, SBP callback")
    finally:
        server.shutdown()
        server.server_close()

if __name__=="__main__":
    asyncio.run(main())
