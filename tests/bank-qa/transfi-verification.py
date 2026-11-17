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
    await expect(page.locator("#tfv-head .h1")).to_have_text("Подтверждение почты")
    return context, page, errors


async def test_all_rails(browser, origin):
    for rail, flow in (("SEPA", "in"), ("SWIFT", "in"),
                       ("SEPA", "out"), ("SWIFT", "out")):
        context, page, errors = await fresh_page(browser, origin, flow, rail)
        await page.locator('#tfv-page [data-tfv="send"]').click()
        await expect(page.locator("#tfv-body .sbp-wait .h2")).to_have_text("Подтвердите почту")
        await page.evaluate("tfVerificationQA.setStatus('verified')")
        await expect(page.locator("#tfv-body .sbp-wait .h2")).to_have_text("Проверяем почту")
        await expect(page.locator("#tfv-body .sbp-wait .p")).to_have_text(
            "После проверки станут доступны международные переводы"
        )

        await page.evaluate("tfVerificationQA.setStatus('approved')")
        await expect(page.locator("#tfv-body .hero .h2")).to_have_text("Проверка завершена")
        await page.locator('#tfv-page [data-tfv="continue"]').click()
        await expect(page.locator("#tf-bank-overlay")).to_be_visible()
        bank = page.frame_locator("#tf-bank-overlay iframe")
        await expect(bank.locator(".phone.tf-phone > .head .h1")).to_contain_text(rail)
        assert not errors, (rail, flow, errors)
        await context.close()


async def test_close_notification_sheet_and_reopen(browser, origin):
    context, page, errors = await fresh_page(browser, origin)
    await page.locator('#tfv-page [data-tfv="send"]').click()
    await page.locator('#tfv-foot [data-tfv="close"]').click()
    await expect(page.locator("#tfv-page")).to_be_hidden()
    await page.evaluate("tfVerificationQA.setStatus('approved')")
    await expect(page.locator("#tfv-sheet")).to_be_visible()
    await page.locator('#tfv-sheet [data-tfv="dismiss"]').last.click()
    await expect(page.locator("#tfv-sheet")).to_be_hidden()
    await page.evaluate("show('notes')")
    await expect(page.locator("#v-notes.on")).to_be_visible()
    await expect(page.locator(".tfv-note")).to_contain_text("Проверка завершена")
    await expect(page.locator(".tfv-note")).to_contain_text("Международные переводы доступны")
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
    await page.evaluate("tfVerificationQA.setStatus('verified')")
    baseline = await page.locator("#tfv-body").inner_html()
    await page.evaluate("tfVerificationQA.setStatus('manual_review')")
    await expect(page.locator("#tfv-body .sbp-wait .h2")).to_have_text("Проверяем почту")
    assert await page.locator("#tfv-body").inner_html() == baseline
    assert await page.evaluate("tfVerificationQA.getState().notice") == ""
    await page.evaluate("tfVerificationQA.setStatus('rejected')")
    await expect(page.locator("#tfv-body .hero .h2")).to_have_text("Проверка не пройдена")
    await expect(page.locator("#tfv-body .hero .p")).to_have_text(
        "Международные переводы недоступны. Обратитесь в поддержку"
    )
    await page.locator('#tfv-page [data-tfv="support"]').click()
    await expect(page.locator("#tfv-page")).to_be_hidden()
    assert not errors, errors
    await context.close()


async def test_library_components_and_copy(browser, origin):
    """Compare live verification states with components/fld.html and done.html."""
    shots = ROOT / "tests" / "bank-qa" / "output" / "verification"
    shots.mkdir(parents=True, exist_ok=True)
    for width in (390, 430):
        context, page, errors = await fresh_page(browser, origin)
        await page.set_viewport_size({"width": width, "height": 932})
        # Input reference uses a gray .fld.g and non-editable text (not an input).
        await expect(page.locator("#tfv-body .fld.g.tfv-email")).to_be_visible()
        assert await page.locator("#tfv-body .tfv-email input").count() == 0
        await expect(page.locator("#tfv-body .tfv-email .fl i")).to_have_text("Адрес почты")
        await expect(page.locator("#tfv-body .tfv-email .fl b")).to_contain_text("@")
        await expect(page.locator("#tfv-body .tfv-email .fi svg")).to_be_visible()
        await expect(page.locator("#tfv-body .hero .p")).to_have_text(
            "Подтвердите адрес почты, чтобы воспользоваться международными переводами"
        )
        assert await page.get_by_text(
            "После подтверждения мы проверим доступность переводов"
        ).count() == 0
        await page.screenshot(path=str(shots / f"wallet-email-readonly-{width}.png"),
                              animations="disabled")

        # Compare actual computed tokens against the native component specimen.
        specimen = await context.new_page()
        await specimen.goto(origin + "/components/fld.html")
        await specimen.screenshot(path=str(shots / f"reference-readonly-{width}.png"),
                                  animations="disabled")
        expected = await specimen.locator(".fld.g").evaluate("""el => ({
            bg:getComputedStyle(el).backgroundColor,
            height:getComputedStyle(el).minHeight,
            radius:getComputedStyle(el).borderRadius
        })""")
        actual = await page.locator("#tfv-body .fld.g.tfv-email").evaluate("""el => ({
            bg:getComputedStyle(el).backgroundColor,
            height:getComputedStyle(el).minHeight,
            radius:getComputedStyle(el).borderRadius
        })""")
        assert actual["bg"] == expected["bg"], (actual, expected)
        assert actual["radius"] == expected["radius"], (actual, expected)
        assert await page.locator("#tfv-page .tint").count() == 1
        await specimen.close()

        await page.locator('#tfv-page [data-tfv="send"]').click()
        await expect(page.locator("#tfv-body .sbp-wait .h2")).to_have_text("Подтвердите почту")
        await expect(page.locator("#tfv-body .sbp-wait .p")).to_have_text(
            "Перейдите по ссылке в письме, отправленном на ваш адрес. Ссылка действует 10 минут"
        )
        assert await page.locator("#tfv-body .sbp-wait .ring .in .cn svg").count() == 1
        assert await page.locator("#tfv-body .sbp-wait .ring").evaluate(
            "el => Math.round(el.getBoundingClientRect().width)"
        ) == 108
        await expect(page.locator("#tfv-body .fld.g.tfv-email")).to_be_visible()
        await page.screenshot(path=str(shots / f"wallet-email-waiting-{width}.png"),
                              animations="disabled")
        await page.evaluate("tfVerificationQA.setStatus('verified')")
        await expect(page.locator("#tfv-body .sbp-wait .h2")).to_have_text("Проверяем почту")
        await expect(page.locator("#tfv-body .sbp-wait .p")).to_have_text(
            "После проверки станут доступны международные переводы"
        )
        await page.screenshot(path=str(shots / f"wallet-screening-waiting-{width}.png"),
                              animations="disabled")
        await page.evaluate("tfVerificationQA.setStatus('approved')")
        await expect(page.locator("#tfv-body .hero.sbp-out .okc svg")).to_be_visible()
        assert await page.locator("#tfv-body .okc svg path").get_attribute("d") == "m5 12.5 5 5 9-10"
        await page.screenshot(path=str(shots / f"wallet-approved-{width}.png"),
                              animations="disabled")
        await page.evaluate("tfVerificationQA.setStatus('rejected')")
        await expect(page.locator("#tfv-body .hero.sbp-out .sbp-ic svg")).to_be_visible()
        assert await page.locator("#tfv-body .sbp-ic svg path").first.get_attribute("d") == "M7 7l10 10M17 7 7 17"
        await page.screenshot(path=str(shots / f"wallet-rejected-{width}.png"),
                              animations="disabled")
        assert not errors, errors
        await context.close()


async def test_external_qa_panel(browser, origin):
    page = await browser.new_page(viewport={"width": 1440, "height": 900},
                                  reduced_motion="reduce")
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    await page.goto(origin + "/transfi-remittance/?qa=1")
    panel = page.locator("#tf-qa-panel")
    await expect(panel).to_be_visible(timeout=30000)
    assert await page.locator("#tfv-qa").count() == 0, "Old QA selector inside wallet must be removed"
    phone_box = await page.locator("body > .phone").bounding_box()
    panel_box = await panel.bounding_box()
    assert phone_box and panel_box and panel_box["x"] > phone_box["x"] + phone_box["width"], (
        "QA controls must be outside the phone preview", phone_box, panel_box
    )

    # The wallet test actions must be inside the second tab, not floating over QA.
    assert await page.locator("#tf-qa-panel #pv-qa").count() == 1
    await expect(page.locator("#pv-qa")).to_be_hidden()
    await page.locator("#tfqa-tab-events").click()
    await expect(page.locator("#pv-qa")).to_be_visible()
    await expect(page.locator("#pv-deposit-ok")).to_be_visible()
    await page.locator("#tfqa-tab-scenarios").click()
    await expect(page.locator("#pv-qa")).to_be_hidden()

    # The approved state is a fixture setup: no notification and no extra verification screen.
    assert await page.locator("#tfqa-flow, #tfqa-rail").count() == 0
    assert await page.locator('#tfqa-status option[value="manual_review"]').count() == 0
    await expect(page.locator('#tfqa-status option[value="verified"]')).to_have_text("Проверяем почту")
    await expect(page.locator("#tfqa-help")).to_be_hidden()
    assert await panel.get_by_text("появится запрос подтверждения", exact=False).count() == 0
    # QA keeps the latest bank context instead of supplying redundant controls.
    await page.evaluate("tfVerificationQA.setContext('SWIFT','out')")
    await page.locator("#tfqa-status").select_option("approved")
    assert await page.evaluate("tfVerificationQA.getState().notice") == ""
    await page.locator("#tfqa-open").click()
    await expect(page.locator("#tf-bank-overlay")).to_be_visible()
    await expect(page.locator("#tfv-page")).to_be_hidden()
    await expect(page.frame_locator("#tf-bank-overlay iframe")
                 .locator(".phone.tf-phone > .head .h1")).to_contain_text("SWIFT")

    # Return to the unverified state and check the normal email-gate UI.
    await page.locator("#tfqa-status").select_option("idle")
    await page.locator("#tfqa-open").click()
    await expect(page.locator("#tfv-page")).to_be_visible()
    await expect(page.locator("#tfv-head .h1")).to_have_text("Подтверждение почты")
    await page.locator("#tfqa-status").select_option("verified")
    await page.locator("#tfqa-open").click()
    await expect(page.locator("#tfv-body .sbp-wait .h2")).to_have_text("Проверяем почту")
    await expect(page.locator("#tfv-body .sbp-wait .p")).to_have_text(
        "После проверки станут доступны международные переводы"
    )

    # A separate action simulates an incoming approval, not just setting the starting fixture.
    await page.evaluate("show('home', false)")
    await page.locator("#tfqa-notify").click()
    await expect(page.locator("#tfv-page")).to_be_hidden()
    await expect(page.locator("#tfv-sheet")).to_be_visible()
    await expect(page.locator("#tfv-sheet .tfv-notice-copy .h2")).to_have_text("Проверка завершена")
    await expect(page.locator("#tfv-sheet .tfv-notice-copy .p")).to_have_text(
        "Международные переводы доступны"
    )
    # Reference: UI Kit > Статусы и сообщения > Перевод выполнен.
    reference = await browser.new_page()
    await reference.goto(origin + "/components/bankstatus.html?screen=out-success")
    reference_title = reference.frame_locator("#bank-screen").locator(".hero.sbp-out .h2")
    reference_subtitle = reference.frame_locator("#bank-screen").locator(".hero.sbp-out .p")
    await expect(reference_title).to_be_visible()
    await expect(reference_subtitle).to_be_visible()
    styles = """el => {const s=getComputedStyle(el);return {
        size:s.fontSize,weight:s.fontWeight,height:s.lineHeight,color:s.color,align:s.textAlign
    }}"""
    for selector, specimen in (
        ("#tfv-sheet .tfv-notice-copy .h2", reference_title),
        ("#tfv-sheet .tfv-notice-copy .p", reference_subtitle),
    ):
        actual_style = await page.locator(selector).evaluate(styles)
        expected_style = await specimen.evaluate(styles)
        assert actual_style == expected_style, (selector, actual_style, expected_style)
    await reference.close()
    # The native .dim must be behind the .sheet; buttons must be hit-testable.
    stacking = await page.evaluate("""() => {
        const layer=document.getElementById('tfv-sheet');
        const dim=layer.querySelector('.tfv-dim'),sheet=layer.querySelector('.tfv-panel');
        const rect=sheet.getBoundingClientRect();
        const mid=document.elementFromPoint(rect.left+rect.width/2,rect.bottom-44);
        return {dim:Number(getComputedStyle(dim).zIndex),
                sheet:Number(getComputedStyle(sheet).zIndex),
                clickOnSheet:sheet.contains(mid)};
    }""")
    assert stacking["sheet"] > stacking["dim"] and stacking["clickOnSheet"], stacking
    await page.locator('#tfv-sheet [data-tfv="dismiss"]').last.click()
    await expect(page.locator("#tfv-sheet")).to_be_hidden()

    await page.evaluate("show('notes')")
    await expect(page.locator(".tfv-note")).to_contain_text("Проверка завершена")
    await page.locator("#tfqa-tab-events").click()
    await page.locator("#pv-internal-ok").click()
    await expect(page.locator("#v-details.on")).to_be_visible()
    await page.locator("#tfqa-tab-scenarios").click()
    await page.locator("#tfqa-reset").click()
    assert await page.evaluate("tfVerificationQA.getState().status") == "idle"
    assert not errors, errors
    await page.close()


async def test_qa_panel_mobile_hidden(browser, origin):
    for width in (390, 430):
        page = await browser.new_page(viewport={"width": width, "height": 932})
        await page.goto(origin + "/transfi-remittance/?qa=1")
        await expect(page.locator("#tf-qa-panel")).to_be_hidden()
        await page.close()


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
                await test_library_components_and_copy(browser, origin)
                await test_external_qa_panel(browser, origin)
                await test_qa_panel_mobile_hidden(browser, origin)
            finally:
                await browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    asyncio.run(main())
