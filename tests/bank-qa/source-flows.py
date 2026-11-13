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

    # Original ALT.VU receive method renders its own QR and incoming
    # peer-transfer callback opens the standard transaction details.
    await open_source(page,"my-qr")
    await expect(page.locator("#v-my-qr .qr-box svg")).to_be_visible()
    await page.locator("#pv-internal-ok").click()
    await expect(page.locator("#v-details.on")).to_be_visible()

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

    # SBP rejected callback reuses the original unsuccessful payment screen.
    await open_source(page,"dep-sbp")
    await page.locator("#sbp-rub").fill("8888")
    await page.evaluate("() => sbpInput('rub')")
    await page.wait_for_function("() => Boolean(sbp.quote && sbp.bank)",timeout=15000)
    await page.locator("#sbp-go").click()
    await expect(page.locator("#v-dep-sbp-qr.on, #v-dep-sbp-wait.on")).to_be_visible()
    await page.locator("#pv-sbp-fail").click()
    await expect(page.locator("#v-dep-sbp-out.on")).to_be_visible(timeout=15000)
    assert "не прошла" in (await page.locator("#sbp-o-h").inner_text()).lower()

    # Assert no runtime JS exceptions.
    assert not errors,"Browser JS errors: "+" | ".join(errors)
    await page.close()

async def test_bank_lifecycle(browser, origin):
    """Full bank withdrawal with the original home/history and offline callback."""
    page=await browser.new_page(viewport={"width":430,"height":932})
    errors=[]
    page.on("pageerror",lambda err:errors.append(str(err)))
    await page.goto(origin+"/transfi-remittance/?qa=1")
    await expect(page.locator("#v-home.on")).to_be_visible()
    # QA controls are deliberately external to the phone; keep them hidden
    # while performing the actual navigation and form interactions.
    await page.locator("#pv-qa").evaluate("(el) => el.style.display='none'")
    await page.locator(".bnv [data-mb='withdraw']").click()
    await page.locator("#v-withdraw [data-tf-bank='SWIFT']").click()
    child=page.frame_locator("#tf-bank-overlay iframe")
    await expect(child.locator("#tf-out-amount")).to_be_visible()
    await expect(child.locator(".tf-quote.tbl .rl")).to_have_count(5)
    assert await child.locator(".wd-amt").count()==1
    assert await child.locator('[data-picker="country"] .tf-flag-circle').count()==1
    await child.locator("#tf-out-amount").fill("100")
    await child.locator(".tf-foot .btn").click()
    await expect(child.locator("#f-firstName")).to_be_visible()
    await child.locator("#f-firstName").fill("Иван")
    await child.locator("#f-lastName").fill("Иванов")
    await child.locator("#f-account").fill("000000000000")
    await child.locator("#f-bic").fill("DEMOXXXX")
    await child.locator("#f-bank").fill("Тестовый банк")
    await child.locator(".tf-foot .btn").click()
    await expect(child.locator(".tf-review-amount")).to_be_visible()
    await expect(child.locator(".tf-quote.tbl .rl")).to_have_count(5)
    await child.locator(".tf-foot .btn").click()
    await expect(child.get_by_text("Перевод обрабатывается")).to_be_visible()
    await page.locator("#pv-qa").evaluate("(el) => el.style.display='block'")
    await page.locator("#pv-qa details").first.locator("summary").click()
    await page.locator("#pv-bank-ok").click()
    await expect(child.get_by_text("Перевод завершён")).to_be_visible()
    pending=await page.evaluate("""() => PV.data['/operations'].operations
        .filter(o=>String(o.id).startsWith('tf-bank-'))
        .map(o=>({id:o.id,status:o.status}))""")
    assert len(pending)==1 and pending[0]["status"]=="confirmed", pending
    # Back from terminal state goes to config, next back closes the iframe.
    await child.locator(".phone.tf-phone > .head .back").click()
    await child.locator(".phone.tf-phone > .head .back").click()
    await expect(page.locator("#tf-bank-overlay")).to_be_hidden()
    await page.evaluate("() => {show('home',false);loadOps()}")
    row=page.locator("#v-home .feed .op[data-id^='tf-bank-']")
    await expect(row).to_have_count(1)
    await row.click()
    await expect(page.locator("#v-details.on")).to_be_visible()
    assert not errors,"Bank lifecycle JS errors: "+" | ".join(errors)
    await page.close()


async def main():
    server=ThreadingHTTPServer(("127.0.0.1",0),partial(Quiet,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=True,args=["--no-sandbox"])
            try:
                await test_source(browser,"http://127.0.0.1:"+str(server.server_port))
                await test_bank_lifecycle(browser,"http://127.0.0.1:"+str(server.server_port))
            finally:
                await browser.close()
        print("PASS: original home details, crypto/peer/SBP callbacks, bank quote/review/confirm/callback, native operation details")
    finally:
        server.shutdown()
        server.server_close()

if __name__=="__main__":
    asyncio.run(main())
