#!/usr/bin/env python3
"""Playwright smoke for isolated route selector; no payment or external API."""
from __future__ import annotations
import contextlib
import pathlib
import re
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "withdraw-route"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8765
HOST = f"http://127.0.0.1:{PORT}/transfi-remittance/?experiment=withdraw&mode="


def ready():
    for _ in range(50):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/", timeout=1):
                return
        except Exception:
            time.sleep(0.2)
    raise RuntimeError("Static preview server was not ready")


def verify_shared_bank_components():
    """Fail CI if a shared UI component is copied back into either host."""
    experiment = (ROOT / "transfi-remittance" / "legacy.html").read_text(encoding="utf-8")
    canonical_root = ROOT / "design-system" / "transfi-remittance"
    canonical = (canonical_root / "legacy.html").read_text(encoding="utf-8")
    shared_components = (canonical_root / "bank-ui-components.js").read_text(encoding="utf-8")
    shared_css = (canonical_root / "bank-prototype-base.css").read_text(encoding="utf-8")
    assert len(shared_components) > 10000 and len(shared_css) > 40000
    for name in ("uxRenderMethods", "uxMethodRow", "uxPickerField",
                 "uxRenderPicker", "uxChoosePicker", "uxCurrencySymbol",
                 "tfBankResult", "tfBankWait", "tfStatusMark", "uxAmountField"):
        assert f"function {name}(" in shared_components, name
        assert f"function {name}(" not in experiment, f"Duplicated experiment UI function: {name}"
        assert f"function {name}(" not in canonical, f"Duplicated canonical UI function: {name}"
    assert '<style>' not in experiment and '<style>' not in canonical
    assert 'src="../../design-system/transfi-remittance/bank-ui-components.js"' in experiment
    assert 'href="../../design-system/transfi-remittance/bank-prototype-base.css"' in experiment
    assert 'src="./bank-ui-components.js"' in canonical
    assert 'href="./bank-prototype-base.css"' in canonical


def run():
    verify_shared_bank_components()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
    )
    try:
        ready()
        errors = []
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
            for width, height in [(390, 844), (430, 932), (1440, 900)]:
                context = browser.new_context(
                    viewport={"width": width, "height": height},
                    reduced_motion="reduce",
                )
                page = context.new_page()
                page.on("pageerror", lambda exc: errors.append(str(exc)))
                page.goto(HOST + "usdt", wait_until="domcontentloaded")
                expect(page.locator("#v-exp-route")).to_have_class(
                    re.compile(r"\bon\b"), timeout=30000
                )
                # Design system is NOT copied into the experiment. The real
                # external CSS and its imported tokens must actually load.
                expect(page.locator("#exp-canonical-design-system")).to_have_attribute(
                    "href", "../../design-system/css/alt-vu-wallet.css"
                )
                page.wait_for_function("""() => {
                    const sheet=[...document.styleSheets].find(s => s.href &&
                        s.href.endsWith('/design-system/css/alt-vu-wallet.css'));
                    const token=getComputedStyle(document.documentElement)
                        .getPropertyValue('--ds-type-field-value').trim();
                    return Boolean(sheet && token);
                }""", timeout=20000)
                # Prove dependency: changing the semantic type token must
                # change the *rendered* experiment field, not only the URL.
                token_link = page.evaluate("""() => {
                    const root=document.documentElement;
                    const node=document.querySelector('#exp-balance');
                    const before=getComputedStyle(node).fontSize;
                    const backup=root.style.getPropertyValue('--ds-type-field-value');
                    root.style.setProperty('--ds-type-field-value','28px/32px Inter');
                    const after=getComputedStyle(node).fontSize;
                    if(backup)root.style.setProperty('--ds-type-field-value',backup);
                    else root.style.removeProperty('--ds-type-field-value');
                    return {before, after};
                }""")
                assert token_link["after"] == "28px", f"Design token not bound: {token_link}"
                expect(page.locator("#exp-dest-label")).to_have_text("Куда → USDT")
                expect(page.locator("#v-exp-route .exp-leg").first.locator(".fl i")).to_have_text("Откуда → ALT.VU")
                expect(page.locator("#exp-balance")).to_have_text(re.compile(r"[\d\s\u00a0.,]+\s*\$"))
                expect(page.locator("#v-exp-route .exp-leg").nth(1).locator(".fl i")).to_have_text("Куда → USDT")
                # UI Kit previews the same live component; its separator
                # must span the actual card width and depend on the semantic role.
                route_geometry = page.evaluate("""() => {
                    const box=document.querySelector('#v-exp-route .exp-route-card');
                    const line=box.querySelector('.exp-arrow-line');
                    const a=box.getBoundingClientRect(),b=line.getBoundingClientRect();
                    const pseudo=getComputedStyle(line,'::after');
                    const token=getComputedStyle(line).getPropertyValue('--ds-sem-divider').trim();
                    return {left:Math.abs(a.left-b.left),right:Math.abs(a.right-b.right),
                        thickness:pseudo.height, pseudoLeft:pseudo.left, pseudoRight:pseudo.right,
                        color:pseudo.backgroundColor,token};
                }""")
                assert route_geometry["left"]<=1 and route_geometry["right"]<=1, (
                    f"Crypto route line is not edge to edge {width}px: {route_geometry}"
                )
                assert route_geometry["thickness"]=="1px"
                assert route_geometry["pseudoLeft"]=="0px" and route_geometry["pseudoRight"]=="0px"
                assert route_geometry["color"]=="rgb(233, 236, 240)",route_geometry
                expect(page.locator("#v-exp-route .exp-amount-caption")).to_have_count(0)
                expect(page.locator("#v-exp-route .exp-amount-field .fl i")).to_have_text("Сумма перевода")
                expect(page.locator("#v-exp-route .exp-amount-field .fi")).to_have_count(0)
                expect(page.locator("#v-exp-route .exp-amount-field img")).to_have_count(0)
                expect(page.locator("#v-exp-route .exp-amount-field .addon .cur")).to_have_text("$")
                expect(page.locator("#v-exp-route .exp-amount-field .addon .mx")).to_have_count(0)
                expect(page.locator("#v-exp-route .exp-amount-field")).to_have_css("height", "104px")
                expect(page.locator("#exp-use-all")).to_be_visible()
                expect(page.locator("#exp-use-all")).to_contain_text("Использовать всё:")
                expect(page.locator("#exp-max")).to_have_count(0)
                expect(page.locator("#exp-recipient")).to_have_attribute("placeholder", "Адрес кошелька")
                expect(page.locator("#v-exp-route .exp-leg").nth(1).locator(".fl b")).to_have_count(0)
                expect(page.locator("#exp-amount")).to_be_visible()
                # Amount digits share the existing 32/38/600 monetary role.
                # The regular field caption, currency and MAX must not inherit it.
                amount_input = page.locator("#exp-amount")
                expect(amount_input).to_have_css("font-size", "32px")
                expect(amount_input).to_have_css("line-height", "38px")
                expect(amount_input).to_have_css("font-weight", "600")
                expect(amount_input).to_have_css("letter-spacing", "-0.5px")
                expect(page.locator("#v-exp-route .exp-amount-field .fl i")).to_have_css("font-size", "12px")
                expect(page.locator("#v-exp-route .exp-amount-field .addon .cur")).to_have_css("font-size", "16px")
                # Grouping, decimals, paste normalization and seven-digit limit.
                for typed, displayed in [
                    ("23333", "23 333"),
                    ("262.52", "262.52"),
                    ("9999999.01", "9 999 999.01"),
                    ("99999999.999", "9 999 999.99"),
                    ("1234567,89", "1 234 567.89"),
                    ("1000.5", "1 000.5"),
                    ("0.123", "0.12"),
                ]:
                    amount_input.fill(typed)
                    expect(amount_input).to_have_value(displayed)
                    bounds = amount_input.evaluate("""el => {
                        const input=el.getBoundingClientRect();
                        const addon=el.closest('.fld').querySelector('.addon').getBoundingClientRect();
                        return {fits:el.scrollWidth<=el.clientWidth+1,
                                separated:input.right<=addon.left+1};
                    }""")
                    assert bounds["fits"] and bounds["separated"], (
                        f"Amount overflow at {width}px with {typed}: {bounds}"
                    )
                # Middle insertion preserves caret; deleting a grouping space
                # removes a digit instead of repeatedly reinserting the space.
                amount_input.fill("12345")
                amount_input.evaluate("(el) => el.setSelectionRange(2,2)")
                amount_input.press("9")
                expect(amount_input).to_have_value("129 345")
                assert amount_input.evaluate("el => el.selectionStart") == 3
                amount_input.fill("12345")
                amount_input.evaluate("(el) => el.setSelectionRange(3,3)")
                amount_input.press("Backspace")
                expect(amount_input).to_have_value("1 345")
                amount_input.fill("")
                expect(page.locator("#v-exp-route .exp-actions .uzone")).to_have_count(2)
                expect(page.locator("#exp-paste")).to_contain_text("Вставить")
                expect(page.locator("#exp-scan")).to_contain_text("Сканировать")
                expect(page.locator("#exp-net-toggle")).to_have_class("fld w net-pick")
                expect(page.locator("#exp-net-toggle")).to_have_attribute("role", "button")
                expect(page.locator("#exp-net-toggle")).not_to_have_attribute("data-act", "netpick")
                # Exact deposit selector DOM/CSS, apart from experimental IDs.
                parity = page.evaluate("""() => {
                    const source=document.querySelector('#v-dep-usdt-tron .fld.w.net-pick');
                    const target=document.querySelector('#exp-net-toggle');
                    const clone=target.cloneNode(true);
                    clone.querySelector('#exp-net-icon').removeAttribute('id');
                    clone.querySelector('#exp-net-value').removeAttribute('id');
                    return {sameMarkup: source.innerHTML===clone.innerHTML,
                            sourceHeight:getComputedStyle(source).height,
                            targetHeight:getComputedStyle(target).height,
                            sourceRadius:getComputedStyle(source).borderRadius,
                            targetRadius:getComputedStyle(target).borderRadius};
                }""")
                assert parity["sameMarkup"], f"Network field differs from deposit: {parity}"
                assert parity["sourceHeight"] == parity["targetHeight"]
                assert parity["sourceRadius"] == parity["targetRadius"]
                expect(page.locator("#exp-net-toggle .fl i")).to_have_text("Сеть")
                expect(page.locator("#exp-net-value")).to_have_text("TRC20")
                expect(page.locator("#exp-net-icon")).to_have_class(re.compile("nlg tron"))
                expect(page.locator("#exp-net-toggle")).to_have_attribute("aria-expanded", "false")
                page.screenshot(path=str(OUT / f"usdt-{width}.png"))
                page.locator("#exp-net-toggle").click()
                expect(page.locator(".phone > .ns-sheet")).to_be_visible()
                expect(page.locator("#v-exp-route > .sheet")).to_have_count(0)
                expect(page.locator(".phone > .ns-sheet .sh2")).to_have_text("Сеть")
                expect(page.locator(".phone > .ns-sheet .ns-note")).to_be_visible()
                expect(page.locator(".phone > .ns-sheet .ns-box .row .ri .nlg")).not_to_have_count(0)
                expect(page.locator(".phone > .ns-sheet .ns-box .row .rt i")).not_to_have_count(0)
                expect(page.locator(".phone > .ns-sheet .ns-box .row .rd")).not_to_have_count(0)
                page.screenshot(path=str(OUT / f"network-sheet-{width}.png"))
                expect(page.locator("#exp-net-toggle")).to_have_attribute("aria-expanded", "true")
                page.keyboard.press("Escape")
                expect(page.locator(".phone > .ns-sheet")).to_be_hidden()
                expect(page.locator("#exp-net-toggle")).to_have_attribute("aria-expanded", "false")
                # Clicking the native dim closes without navigating away.
                page.locator("#exp-net-toggle").click()
                expect(page.locator(".phone > .ns-sheet")).to_be_visible()
                page.locator(".phone > .ns-dim").click(position={"x": 12, "y": 110})
                expect(page.locator(".phone > .ns-sheet")).to_be_hidden()
                expect(page.locator("#v-exp-route")).to_have_class(re.compile(r"\bon\b"))
                # Clipboard is stubbed, but the real Paste button handler is exercised.
                page.evaluate("""Object.defineProperty(navigator, 'clipboard', {
                    configurable: true, value: {readText: async () => '0x' + 'a'.repeat(40)}
                })""")
                page.locator("#exp-paste").click()
                expect(page.locator("#exp-recipient")).to_have_value("0x" + "a" * 40)
                # Real scanner entry point receives a deterministic decoded QR result.
                page.evaluate("() => {window.scanQR = async opts => {opts.take({kind:'addr', value:'0x' + 'b'.repeat(40)})}}")
                page.locator("#exp-scan").click()
                expect(page.locator("#exp-recipient")).to_have_value("0x" + "b" * 40)
                page.locator("#exp-recipient").fill("")
                max_label = page.locator("#exp-max-value").inner_text()
                page.locator("#exp-use-all").click()
                assert float(page.locator("#exp-amount").input_value().replace(" ", "")) > 0
                expect(page.locator("#exp-amount")).to_have_value(max_label.removesuffix(" $"))
                page.locator("#exp-amount").fill("10.00")
                page.locator("#exp-next").click()
                expect(page.locator("#exp-error")).to_contain_text("адрес")
                # An in-app network change must clear the previous address.
                page.locator("#exp-recipient").fill("T" + "1" * 33)
                page.locator("#exp-net-toggle").click()
                options = page.locator(".phone > .ns-sheet .ns-box [data-ns]")
                if options.count() > 1:
                    chosen = options.nth(1).get_attribute("data-ns")
                    options.nth(1).click()
                    expect(page.locator("#exp-recipient")).to_have_value("")
                    expect(page.locator("#exp-net-icon")).to_have_class(re.compile("nlg " + chosen))
                    expect(page.locator("#exp-net-toggle")).to_have_attribute("aria-expanded", "false")
                else:
                    page.keyboard.press("Escape")
                page.locator("#exp-recipient").fill("0x" + "1" * 40)
                page.locator("#exp-amount").fill("10.00")
                page.locator("#exp-next").click()
                expect(page.locator("#v-withdraw-check")).to_have_class(
                    re.compile(r"\bon\b"), timeout=30000
                )
                page.locator("#v-withdraw-check .back").click()
                expect(page.locator("#v-exp-route")).to_have_class(re.compile(r"\bon\b"))
                context.close()

            for mode, target, destination in [
                ("usdc", "USDC", "#v-withdraw-check"),
                ("altvu", "ALT.VU", "#v-transfer-check"),
            ]:
                context = browser.new_context(viewport={"width": 390, "height": 844})
                page = context.new_page()
                page.on("pageerror", lambda exc: errors.append(str(exc)))
                page.goto(HOST + mode, wait_until="domcontentloaded")
                expect(page.locator("#v-exp-route")).to_have_class(
                    re.compile(r"\bon\b"), timeout=30000
                )
                expect(page.locator("#exp-dest-label")).to_have_text("Куда → " + target)
                expect(page.locator("#exp-balance")).to_have_text(re.compile(r"[\d\s\u00a0.,]+\s*\$"))
                expect(page.locator("#v-exp-route .exp-amount-caption")).to_have_count(0)
                expect(page.locator("#v-exp-route .exp-amount-field .fl i")).to_have_text("Сумма перевода")
                expect(page.locator("#v-exp-route .exp-amount-field .fi")).to_have_count(0)
                expect(page.locator("#exp-paste")).to_contain_text("Вставить")
                expect(page.locator("#exp-scan")).to_contain_text("Сканировать")
                expect(page.locator("#v-exp-route .exp-actions .uzone")).to_have_count(2)
                if mode == "altvu":
                    expect(page.locator("#exp-recipient")).to_have_attribute("placeholder", "Почта или телефон")
                    expect(page.locator("#exp-net-toggle")).to_be_hidden()
                    expect(page.locator(".phone > .ns-sheet")).to_be_hidden()
                    page.evaluate("""Object.defineProperty(navigator, 'clipboard', {
                        configurable:true, value:{readText:async () => 'demo.receiver@example.invalid'}
                    })""")
                    page.locator("#exp-paste").click()
                    expect(page.locator("#exp-recipient")).to_have_value("demo.receiver@example.invalid")
                    page.evaluate("() => {window.scanQR = async opts => {opts.take({kind:'code', value:'ABCD-EFGH'})}}")
                    page.locator("#exp-scan").click()
                    expect(page.locator("#exp-recipient")).to_have_value("ABCD-EFGH")
                    # The original recipient lookup is verified via email on Continue.
                    page.locator("#exp-recipient").fill("demo.receiver@example.invalid")
                else:
                    expect(page.locator("#exp-net-toggle .fi .nlg")).to_have_count(1)
                    expect(page.locator("#exp-net-toggle .fl i")).to_have_text("Сеть")
                    page.locator("#exp-net-toggle").click()
                    expect(page.locator(".phone > .ns-sheet")).to_be_visible()
                    expect(page.locator(".phone > .ns-sheet .ns-box [data-ns]")).not_to_have_count(0)
                    page.keyboard.press("Escape")
                    expect(page.locator(".phone > .ns-sheet")).to_be_hidden()
                    page.locator("#exp-recipient").fill("0x" + "1" * 40)
                amount_input = page.locator("#exp-amount")
                expect(amount_input).to_have_css("font-size", "32px")
                expect(amount_input).to_have_css("line-height", "38px")
                expect(amount_input).to_have_css("font-weight", "600")
                expect(page.locator("#v-exp-route .exp-amount-field .fi")).to_have_count(0)
                expect(page.locator("#exp-use-all")).to_contain_text("Использовать всё:")
                amount_input.fill("10.00")
                page.screenshot(path=str(OUT / f"{mode}-390.png"))
                page.locator("#exp-next").click()
                expect(page.locator(destination)).to_have_class(
                    re.compile(r"\bon\b"), timeout=30000
                )
                context.close()
            # Catalog specimen is the REAL source/recipient card only, not a
            # cropped full-screen screenshot or a second hand-built component.
            for specimen_width in (390, 423):
                context = browser.new_context(
                    viewport={"width": specimen_width, "height": 302},
                    reduced_motion="reduce",
                )
                page = context.new_page()
                page.on("pageerror", lambda exc: errors.append(str(exc)))
                page.goto(HOST + "usdt&component=route-card", wait_until="domcontentloaded")
                expect(page.locator("#v-exp-route")).to_have_class(
                    re.compile(r"\bon\b"), timeout=30000
                )
                expect(page.locator("html")).to_have_class(
                    re.compile("exp-route-specimen")
                )
                expect(page.locator("#v-exp-route .exp-route-card")).to_be_visible()
                expect(page.locator("#v-exp-route > .head")).to_be_hidden()
                expect(page.locator("#v-exp-route > .foot")).to_be_hidden()
                expect(page.locator("#exp-network-slot")).to_be_hidden()
                expect(page.locator("#v-exp-route .exp-amount-field")).to_be_hidden()
                expect(page.locator("#exp-balance")).to_contain_text("$")
                expect(page.locator("#exp-dest-label")).to_have_text("Куда → USDT")
                expect(page.locator("#exp-paste")).to_be_visible()
                expect(page.locator("#exp-scan")).to_be_visible()
                card = page.locator("#v-exp-route .exp-route-card").bounding_box()
                assert card and card["y"] >= 0 and card["y"] + card["height"] <= 304, (
                    f"Component not fully visible in catalog at {specimen_width}px: {card}"
                )
                page.screenshot(path=str(OUT / f"component-route-{specimen_width}.png"))
                context.close()
            # Bank withdrawal experiment: the same live SEPA/SWIFT forms, with
            # route-card country selector and SBP-like dual amount+FX card.
            for width, height in [(390, 844), (430, 932), (1440, 900)]:
                for rail, expected_currency, fx in [
                    ("SEPA", "EUR", 0.9259), ("SWIFT", "EUR", 0.9259)
                ]:
                    context = browser.new_context(
                        viewport={"width": width, "height": height},
                        reduced_motion="reduce",
                    )
                    page = context.new_page()
                    page.on("pageerror", lambda exc: errors.append(str(exc)))
                    page.goto(
                        f"http://127.0.0.1:{PORT}/transfi-remittance/legacy.html"
                        f"?embedded=1&flow=out&screen=out-config&rail={rail}",
                        wait_until="domcontentloaded",
                    )
                    # The displayed bank UI must load the shared canonical
                    # renderers and base CSS, not rely on branch-local copies.
                    expect(page.locator(
                        'script[src="../../design-system/transfi-remittance/bank-ui-components.js"]'
                    )).to_have_count(1)
                    expect(page.locator(
                        'link[href="../../design-system/transfi-remittance/bank-prototype-base.css"]'
                    )).to_have_count(1)
                    page.wait_for_function("""() => {
                        const hrefs=[...document.styleSheets].map(s => s.href||'');
                        return hrefs.some(h => h.includes('/design-system/transfi-remittance/bank-prototype-base.css'))
                            && typeof uxRenderPicker==='function'
                            && typeof uxRenderMethods==='function';
                    }""", timeout=20000)
                    route = page.locator(".tf-bank-route-card")
                    expect(route).to_be_visible()
                    expect(route.locator(".tf-bank-leg")).to_have_count(2)
                    expect(route.locator(".tf-bank-leg").first).to_contain_text("Откуда → ALT.VU")
                    expect(route.locator(".tf-bank-destination")).to_contain_text("Куда → Страна")
                    expect(route.locator(".tf-bank-destination .fl i")).to_have_text("Куда → Страна")
                    expect(route.locator(".tf-bank-leg").first.locator(".fl b")).to_have_text("4 812.60 $")
                    expect(route.locator(".tf-bank-destination .fl b")).to_have_text("Выберите страну")
                    expect(route.locator(".tf-bank-destination svg.tf-country-flag")).to_have_count(0)
                    expect(route.locator(".tf-bank-destination .fi svg")).to_have_count(1)
                    expect(route.locator(".tf-bank-destination .tf-picker-chevron")).to_have_count(0)
                    expect(page.locator("#footer .tf-button")).to_have_attribute("aria-disabled", "true")
                    # All three dividers must share a computed semantic color,
                    # exactly 1px thick and stretch from card edge to card edge.
                    dividers = page.evaluate("""() => {
                        const bank=document.querySelector('.tf-bank-route-card');
                        const fx=document.querySelector('.tf-bank-sbp');
                        const tbl=document.querySelector('#quoteBlock');
                        const route=bank.querySelector('.tf-bank-arrow-line');
                        const mid=fx.querySelector('.mid');
                        const total=tbl.querySelector('.tf-bank-total-row');
                        const rect=e=>e.getBoundingClientRect();
                        const bankRect=rect(bank),fxRect=rect(fx),tableRect=rect(tbl);
                        const routeRect=rect(route),midRect=rect(mid),rowRect=rect(total);
                        const rs=getComputedStyle(route,'::after');
                        const ms=getComputedStyle(mid,'::before');
                        const totalCss=getComputedStyle(total);
                        const rateElement=fx.querySelector('.sbp-rate');
                        const arrowElement=route.querySelector('.tf-bank-arrow');
                        const capsule=getComputedStyle(rateElement);
                        const arrowCss=getComputedStyle(arrowElement);
                        const arrowRect=rect(arrowElement),rateRect=rect(rateElement);
                        return {
                            route:[Math.abs(bankRect.left-routeRect.left),Math.abs(bankRect.right-routeRect.right)],
                            mid:[Math.abs(fxRect.left-midRect.left),Math.abs(fxRect.right-midRect.right)],
                            table:[Math.abs(tableRect.left-rowRect.left),Math.abs(tableRect.right-rowRect.right)],
                            colors:[rs.backgroundColor,ms.backgroundColor],
                            lineSizes:[rs.height,ms.height],
                            inset:[rs.left,rs.right,ms.left,ms.right],
                            totTop:totalCss.borderTopWidth,
                            totBottom:totalCss.borderBottomWidth,
                            semantic:getComputedStyle(bank).getPropertyValue('--ds-sem-divider').trim(),
                            borderToken:getComputedStyle(bank).getPropertyValue('--ds-sem-border').trim(),
                            capsuleOutline:capsule.boxShadow,
                            capsulesMatch:['height','borderRadius','backgroundColor','boxShadow']
                                .every(key=>capsule[key]===arrowCss[key]),
                            arrowCentered:Math.abs((arrowRect.left+arrowRect.right)/2-(bankRect.left+bankRect.right)/2)<1,
                            fxCentered:Math.abs((rateRect.left+rateRect.right)/2-(fxRect.left+fxRect.right)/2)<1,
                            capsuleHeight:capsule.height
                        };
                    }""")
                    for key in ("route","mid","table"):
                        assert max(dividers[key])<=1, f"{rail} divider not full-width {width}px: {dividers}"
                    assert dividers["colors"]==["rgb(233, 236, 240)"]*2, dividers
                    assert dividers["lineSizes"]==["1px"]*2, dividers
                    assert dividers["inset"]==["0px"]*4, dividers
                    assert dividers["totTop"]=="0px" and dividers["totBottom"]=="0px", dividers
                    assert dividers["semantic"]=="#e9ecf0", dividers
                    assert "230, 228, 225" in dividers["capsuleOutline"], dividers
                    assert dividers["capsulesMatch"] and dividers["capsuleHeight"]=="32px", dividers
                    assert dividers["arrowCentered"] and dividers["fxCentered"], dividers

                    expect(page.locator(".tf-bank-sbp")).to_be_visible()
                    expect(page.locator(".tf-bank-sbp .h")).to_have_count(2)
                    expect(page.locator(".tf-bank-sbp .h").first).to_contain_text("Заплатить")
                    expect(page.locator(".tf-bank-sbp .h").last).to_contain_text("Зачислим")
                    # The two amount captions must use exactly the same computed
                    # typography as the source/destination labels.
                    styles = page.evaluate("""() => {
                        const props=['fontFamily','fontSize','fontWeight','lineHeight',
                            'fontStyle','letterSpacing','color','marginBottom'];
                        const read=selector => {
                            const el=document.querySelector(selector);
                            const css=getComputedStyle(el);
                            return Object.fromEntries(props.map(prop => [prop,css[prop]]));
                        };
                        return {
                            from:read('.tf-bank-route-card .tf-bank-leg:first-child .fl i'),
                            to:read('.tf-bank-destination .fl i'),
                            pay:read('.tf-bank-sbp .t label'),
                            receive:read('.tf-bank-sbp .tf-bank-receive-label')
                        };
                    }""")
                    assert styles["pay"] == styles["from"] == styles["to"] == styles["receive"], (
                        f"Bank amount captions must match route label, {rail}, {width}px: {styles}"
                    )
                    expect(page.locator("#tf-bank-rate")).to_contain_text("1 $")
                    expect(page.locator("#tf-bank-rate")).to_contain_text(expected_currency)
                    expect(page.locator(".tf-bank-sbp .tf-bank-currency-switch")).to_have_count(
                        0 if rail == "SEPA" else 1
                    )
                    expect(page.locator(".tf-bank-sbp .h").first.locator(".u")).to_have_text("$")
                    expect(page.locator(".tf-bank-sbp #tf-bank-use-all")).to_be_visible()
                    expect(page.locator("#tf-bank-use-all")).to_contain_text("Использовать всё:")
                    expect(page.locator("#footer #quoteBlock")).to_be_visible()
                    rows = page.locator("#quoteBlock .row")
                    expect(rows).to_have_count(1)
                    expect(rows.first).to_contain_text("К списанию")
                    expect(rows.first).to_contain_text("комиссия")
                    fee="2.50" if rail=="SEPA" else "18.00"
                    expect(page.locator("#quoteBlock .tf-bank-fee")).to_have_text(
                        f"(комиссия {fee} $)"
                    )
                    expect(page.locator("#quoteBlock .rv")).to_have_css("font-weight","600")
                    expect(page.locator("#footer .tf-button")).to_have_text("Реквизиты получателя")
                    expect(page.locator("#quoteBlock")).not_to_contain_text("Курс")
                    # Compact total must stay one line, not overlap and sit next to the CTA.
                    total_layout = page.evaluate("""() => {
                        const box=document.querySelector('#quoteBlock');
                        const label=box.querySelector('.rt').getBoundingClientRect();
                        const value=box.querySelector('.rv').getBoundingClientRect();
                        const row=box.querySelector('.row').getBoundingClientRect();
                        const button=document.querySelector('#footer .tf-button').getBoundingClientRect();
                        const rect=box.getBoundingClientRect();
                        return {
                            oneLine:Math.abs(label.top-value.top)<4,
                            notOverlapping:label.right<=value.left+1,
                            contained:label.left>=rect.left&&value.right<=rect.right,
                            nearButton:button.top-row.bottom>=0&&button.top-row.bottom<=24
                        };
                    }""")
                    assert all(total_layout.values()), f"Compact bank total {rail} {width}px: {total_layout}"
                    expect(page.locator(".tf-source")).to_have_count(0)
                    amount = page.locator("#tf-out-amount")
                    expect(amount).to_be_visible()
                    expect(amount).to_have_css("font-size", "32px")
                    expect(amount).to_have_css("line-height", "38px")
                    amount.fill("1234567.89")
                    expect(amount).to_have_value("1 234 567.89")
                    bounds = amount.evaluate("""el => {
                        const box=el.getBoundingClientRect();
                        const suffix=el.closest('.h').querySelector('.u').getBoundingClientRect();
                        return {notClipped:el.scrollWidth<=el.clientWidth+1,
                                notOverlapping:box.right<=suffix.left+1};
                    }""")
                    assert all(bounds.values()), f"Bank amount clipping {rail}, {width}px: {bounds}"
                    amount.fill("99999999.999")
                    expect(amount).to_have_value("9 999 999.99")
                    amount.fill("1234.56")
                    expect(amount).to_have_value("1 234.56")
                    expect(page.locator("#quoteBlock .rv")).to_have_text(
                        "1 237.06 $" if rail=="SEPA" else "1 252.56 $"
                    )
                    expect(page.locator("#footer .tf-button")).to_have_attribute("aria-disabled","true")
                    received = page.locator("#tf-bank-receive").inner_text().replace(" ", "")
                    assert abs(float(received)-round(1234.56*fx,2))<0.011, (
                        f"Bank FX mismatch {rail}, {width}px: {received}"
                    )
                    page.locator(".tf-bank-destination").click()
                    expect(page.locator("#pickerLayer")).to_be_visible()
                    expect(page.locator('#pickerLayer [data-picker-value="FR"]')).to_be_visible()
                    page.locator('#pickerLayer [data-picker-value="FR"]').click()
                    expect(page.locator(".tf-bank-destination")).to_contain_text("Франция")
                    expect(page.locator(".tf-bank-destination svg.tf-country-flag")).to_have_count(1)
                    expect(page.locator("#footer .tf-button")).to_have_attribute("aria-disabled","false")
                    expect(page.locator("#tf-out-amount")).to_have_value("1 234.56")
                    if rail == "SWIFT":
                        page.locator(".tf-bank-currency-switch").click()
                        expect(page.locator("#pickerLayer")).to_be_visible()
                        page.locator('#pickerLayer [data-picker-value="GBP"]').click()
                        expect(page.locator(".tf-bank-currency-switch")).to_have_text("GBP")
                        expect(page.locator("#tf-bank-rate")).to_contain_text("GBP")
                        expect(page.locator("#tf-out-amount")).to_have_value("1 234.56")
                    all_amount=page.locator("#tf-bank-max-value").inner_text()
                    page.locator("#tf-bank-use-all").click()
                    expect(page.locator("#tf-out-amount")).to_have_value(
                        all_amount.removesuffix(" $")
                    )
                    assert float(page.locator("#tf-out-amount").input_value().replace(" ", ""))>0
                    page.screenshot(path=str(OUT / f"bank-{rail.lower()}-{width}.png"))
                    if width == 390:
                        page.locator("#footer .tf-button").click()
                        expect(page.locator("#content")).to_contain_text("Имя и фамилия получателя")
                        page.locator(".phone.tf-phone .back").click()
                        expect(page.locator(".tf-bank-route-card")).to_be_visible()
                    context.close()
            # Currency selector must use the SAME published design-system JS
            # asset as the canonical UI Kit, not a local copy of SVG flag paths.
            for width, height in [(390, 844), (430, 932), (1440, 900)]:
                context = browser.new_context(
                    viewport={"width": width, "height": height},
                    reduced_motion="reduce",
                )
                page = context.new_page()
                page.on("pageerror", lambda exc: errors.append(str(exc)))
                page.goto(
                    f"http://127.0.0.1:{PORT}/transfi-remittance/legacy.html"
                    "?component=picker&kind=currency&embedded=1",
                    wait_until="domcontentloaded",
                )
                expect(page.locator(
                    'script[src="../../design-system/transfi-remittance/bank-selector-flags.js"]'
                )).to_have_count(1)
                assert page.evaluate(
                    "() => !!window.AltvuSelectorFlags && "
                    "typeof window.AltvuSelectorFlags.currencyPlate === 'function'"
                ), "Canonical flag library failed to load"
                expect(page.locator('#pickerLayer')).to_be_visible()
                expect(page.locator('#pickerLayer .tf-picker-row')).to_have_count(3)
                expect(page.locator('#pickerLayer .tf-picker-row svg.tf-country-flag')).to_have_count(3)
                expect(page.locator('#pickerLayer svg.tf-currency-icon')).to_have_count(0)
                expect(page.locator('[data-picker="outCurrency"] svg.tf-country-flag')).to_have_count(1)
                # EUR is the EU flag (12 vector stars), not a random national flag.
                expect(page.locator(
                    '#pickerLayer [data-picker-value="EUR"] svg.tf-country-flag polygon'
                )).to_have_count(12)
                flags = page.evaluate("""() => [...document.querySelectorAll(
                    '#pickerLayer .tf-picker-row .tf-country-flag'
                )].map(el => [getComputedStyle(el).width,getComputedStyle(el).height])""")
                assert flags == [["24px", "24px"]] * 3, flags
                page.screenshot(path=str(OUT / f"currency-flags-{width}.png"))
                page.locator('#pickerLayer [data-picker-value="USD"]').click()
                expect(page.locator('#pickerLayer')).to_be_hidden()
                expect(page.locator('[data-picker="outCurrency"]')).to_contain_text("USD")
                expect(page.locator('[data-picker="outCurrency"] svg.tf-country-flag')).to_have_count(1)
                page.locator('[data-picker="outCurrency"]').click()
                expect(page.locator('#pickerLayer')).to_be_visible()
                page.locator('#pickerLayer [data-picker-value="GBP"]').click()
                expect(page.locator('[data-picker="outCurrency"]')).to_contain_text("GBP")
                expect(page.locator('[data-picker="outCurrency"] svg.tf-country-flag')).to_have_count(1)
                page.locator('[data-picker="outCurrency"]').click()
                page.keyboard.press("Escape")
                expect(page.locator('#pickerLayer')).to_be_hidden()
                context.close()
            browser.close()
        assert not errors, f"Uncaught JS errors: {errors}"
        print("PASS: USDT/USDC/ALT.VU + SEPA/SWIFT route/FX, pickers, fee-aware use-all, navigation, 390/430/1440")
    finally:
        server.terminate()
        with contextlib.suppress(Exception):
            server.wait(timeout=5)


if __name__ == "__main__":
    run()
