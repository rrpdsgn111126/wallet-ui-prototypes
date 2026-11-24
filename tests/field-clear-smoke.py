#!/usr/bin/env python3
"""Verify one shared clearable field in UI Kit and working amount flows."""
from __future__ import annotations
import contextlib
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"artifacts"/"withdraw-route"
OUT.mkdir(parents=True,exist_ok=True)
PORT=8766
BASE=f"http://127.0.0.1:{PORT}/"

def ready():
    for _ in range(70):
        try:
            with urllib.request.urlopen(BASE,timeout=1):return
        except Exception:time.sleep(.2)
    raise RuntimeError("Field-clear test server did not start")

def run():
    assert (ROOT/"design-system"/"transfi-remittance"/"field-clear.js").exists()
    # Catch a malformed selector block swallowing later rules: all layout
    # geometry checks below must run with the actual canonical stylesheet.
    assert "ds-clear-amount>.ds-field-clear" in (
        ROOT/"design-system"/"css"/"alt-vu-wallet.css"
    ).read_text()
    source=(ROOT/"design-system"/"transfi-remittance"/"route-card.js").read_text()
    assert "tf-route-clear" not in source and "syncClear" not in source
    gallery=(ROOT/"design-system"/"ui-kit"/"index.html").read_text()
    assert 'id="amount-conversion"' in gallery
    experiment=gallery.split('id="g-experiments"',1)[1].split("</section>",1)[0]
    assert "filled=1" not in experiment and "tf-route-clear" not in experiment

    server=subprocess.Popen([sys.executable,"-m","http.server",str(PORT),"--bind","127.0.0.1"],
                            cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
    errors=[]
    try:
        ready()
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,channel="chrome",args=["--no-sandbox"])
            for width in (390,430,1440):
                context=browser.new_context(viewport={"width":width,"height":900},reduced_motion="reduce")
                page=context.new_page()
                page.on("pageerror",lambda error:errors.append(str(error)))
                # Ordinary text input: empty, filled and disabled use one controller.
                page.goto(BASE+"design-system/components/fld.html",wait_until="domcontentloaded")
                fields=page.locator(".fld.w")
                empty=fields.nth(0)
                full=fields.nth(1)
                expect(empty.locator(".ds-field-clear")).to_be_hidden()
                expect(full.locator(".ds-field-clear")).to_be_visible()
                expect(page.locator(".fld.w.off .ds-field-clear")).to_have_count(0)
                text_geo=full.evaluate("""el => {
                    const input=el.querySelector('input').getBoundingClientRect();
                    const clear=el.querySelector('.ds-field-clear').getBoundingClientRect();
                    const field=el.getBoundingClientRect();
                    return {right:field.right-clear.right, after:clear.left-input.right,
                            aligned:Math.abs((clear.top+clear.bottom)/2-(field.top+field.bottom)/2)};
                }""")
                assert 8<=text_geo["right"]<=20 and text_geo["after"]>=-1 and text_geo["aligned"]<=4, text_geo
                empty.locator("input").fill("Алексей")
                expect(empty.locator(".ds-field-clear")).to_be_visible()
                empty.locator(".ds-field-clear").click()
                expect(empty.locator("input")).to_have_value("")
                expect(empty.locator("input")).to_be_focused()
                expect(empty.locator(".ds-field-clear")).to_be_hidden()

                # Original amount specimen: MAX is kept, cross resets digits.
                page.goto(BASE+"design-system/components/amount.html",wait_until="domcontentloaded")
                amount=page.locator(".fld.w").nth(1)
                expect(amount.locator(".ds-field-clear")).to_be_visible()
                expect(amount.locator(".addon .mx")).to_have_text("MAX")
                icon_geo=amount.evaluate("""el => {
                    const icon=el.querySelector('.fi').getBoundingClientRect();
                    const button=el.querySelector('.ds-field-clear').getBoundingClientRect();
                    const currency=el.querySelector('.addon .cur').getBoundingClientRect();
                    const max=el.querySelector('.addon .mx').getBoundingClientRect();
                    const addon=el.querySelector('.addon').getBoundingClientRect();
                    const field=el.getBoundingClientRect();
                    return {
                        iconGap:button.left-icon.right,
                        currencyGap:currency.left-button.right,
                        rightSide:button.left>field.left+field.width/2,
                        sameRow:Math.abs((button.top+button.bottom)/2-(currency.top+currency.bottom)/2),
                        beforeMAX:currency.right<max.left,
                        insideAddon:button.left>=addon.left-1 && button.right<=addon.right+1,
                        order:[...el.querySelector('.addon').children].map(n=>n.className)
                    };
                }""")
                assert icon_geo["rightSide"] and icon_geo["insideAddon"], icon_geo
                assert 0<=icon_geo["currencyGap"]<=12 and icon_geo["sameRow"]<=4, icon_geo
                assert icon_geo["beforeMAX"] and icon_geo["iconGap"]>30, icon_geo
                assert icon_geo["order"][:3]==["ds-field-clear","cur","mx wd-max"], icon_geo
                amount.locator(".ds-field-clear").click()
                expect(amount.locator("input")).to_have_value("")
                expect(amount.locator(".ds-field-clear")).to_be_hidden()
                expect(amount.locator(".addon .mx")).to_have_text("MAX")

                # Address field: right side of the upper row, not the tools bar.
                page.goto(BASE+"design-system/components/unit.html",wait_until="domcontentloaded")
                address=page.locator(".unit").nth(1)
                addr_input=address.locator("textarea")
                addr_clear=address.locator(".ds-field-clear")
                expect(addr_clear).to_be_visible()
                addr_geo=address.evaluate("""el => {
                    const row=el.querySelector('.urow').getBoundingClientRect();
                    const button=el.querySelector('.ds-field-clear').getBoundingClientRect();
                    const tools=el.querySelector('.uzones').getBoundingClientRect();
                    return {right:row.right-button.right,
                            inside:button.top>=row.top&&button.bottom<=row.bottom,
                            beforeTools:button.bottom<=tools.top};
                }""")
                assert 7<=addr_geo["right"]<=18 and addr_geo["inside"] and addr_geo["beforeTools"], addr_geo
                expect(address.locator(".uzones .uzone")).to_have_count(3)
                addr_clear.click()
                expect(addr_input).to_have_value("")
                expect(addr_input).to_be_focused()
                expect(addr_clear).to_be_hidden()
                addr_input.fill("TDemoAddr22222222222222222")
                expect(addr_clear).to_be_visible()

                # Real USDT amount field reuses the clear controller.
                page.goto(BASE+"transfi-remittance/?experiment=withdraw&mode=usdt",
                          wait_until="domcontentloaded")
                expect(page.locator("#v-exp-route")).to_have_class("view on",timeout=30000)
                expect(page.locator(".tf-bank-route-card .ds-field-clear")).to_have_count(0)
                expect(page.locator(".tf-bank-route-card [data-route-clear]")).to_have_count(0)
                amt=page.locator("#exp-amount")
                clear=page.locator(".exp-amount-field .ds-field-clear")
                expect(clear).to_be_hidden()
                amt.fill("235")
                expect(clear).to_be_visible()
                clear.click()
                expect(amt).to_have_value("")
                expect(amt).to_be_focused()
                expect(clear).to_be_hidden()
                page.locator("#exp-use-all").click()
                expect(clear).to_be_visible()
                clear.click()
                expect(amt).to_have_value("")
                page.screenshot(path=str(OUT/f"field-amount-{width}.png"))

                # The real conversion card, with existing quote/FX handlers.
                page.goto(BASE+"transfi-remittance/legacy.html?component=amount-conversion&filled=1",
                          wait_until="domcontentloaded")
                conversion=page.locator(".tf-bank-sbp")
                expect(conversion).to_be_visible()
                converted=page.locator("#tf-bank-receive")
                cvinput=page.locator("#tf-out-amount")
                expect(cvinput).to_have_value("250.00")
                cvclear=conversion.locator(".ds-field-clear")
                expect(cvclear).to_be_visible()
                cv_geo=conversion.evaluate("""el => {
                    const input=el.querySelector('#tf-out-amount').getBoundingClientRect();
                    const mirror=el.querySelector('.ds-conversion-mirror').getBoundingClientRect();
                    const button=el.querySelector('.ds-field-clear').getBoundingClientRect();
                    return {gap:button.left-input.right,
                            mirrorGap:button.left-mirror.right,
                            aligned:Math.abs((button.top+button.bottom)/2-(input.top+input.bottom)/2),
                            notBelow:button.top<input.bottom};
                }""")
                assert 0<=cv_geo["gap"]<=12 and 0<=cv_geo["mirrorGap"]<=12 and cv_geo["aligned"]<=4 and cv_geo["notBelow"], cv_geo
                cvclear.click()
                expect(cvinput).to_have_value("")
                expect(cvclear).to_be_hidden()
                expect(cvinput).to_be_focused()
                expect(converted).to_have_text("0.00")
                cvinput.fill("75")
                expect(cvclear).to_be_visible()
                cvclear.click()
                expect(cvinput).to_have_value("")
                page.screenshot(path=str(OUT/f"field-conversion-{width}.png"))

                # Reusable recipient-field renderer on the live bank form.
                page.goto(BASE+"transfi-remittance/legacy.html?flow=out&screen=out-recipient&rail=SWIFT",
                          wait_until="domcontentloaded")
                recipient=page.locator(".tf-recipient-field input").first
                expect(recipient).to_be_visible()
                recipient.fill("Тестовый получатель")
                recipient_field=recipient.locator("xpath=ancestor::*[contains(@class,'fld')][1]")
                expect(recipient_field.locator(".ds-field-clear")).to_be_visible()
                recipient_field.locator(".ds-field-clear").click()
                expect(recipient).to_have_value("")
                context.close()
            browser.close()
        assert not errors,f"Browser errors: {errors}"
        print("PASS: text-right, address-right, amount-icon, FX-after-digits, clear/focus/MAX/FX (390/430/1440)")
    finally:
        server.terminate()
        with contextlib.suppress(Exception):server.wait(timeout=5)

if __name__=="__main__":run()
