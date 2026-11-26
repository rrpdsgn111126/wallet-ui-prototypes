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
                 "tfBankResult", "tfBankWait", "tfStatusMark", "uxAmountField",
                 "uxBottomNav", "uxHomeNav", "uxHomeNavKey", "uxProfileTab",
                 "uxUpdateFlowCTA", "uxFormError", "uxRender",
                 "notify", "segment", "qSummary", "purposeName"):
        assert f"function {name}(" in shared_components, name
        assert f"function {name}(" not in experiment, f"Duplicated experiment UI function: {name}"
        assert f"function {name}(" not in canonical, f"Duplicated canonical UI function: {name}"
    assert '<style>' not in experiment and '<style>' not in canonical
    assert 'src="../../design-system/transfi-remittance/bank-ui-components.js"' in experiment
    assert 'href="../../design-system/transfi-remittance/bank-prototype-base.css"' in experiment
    assert 'src="./bank-ui-components.js"' in canonical
    assert 'href="./bank-prototype-base.css"' in canonical
    # Shared native preview runtime and QA panel must not fork on this branch.
    for name in ("preview-interactions.js", "transfi-qa-panel.js"):
        local = (ROOT / "transfi-remittance" / name).read_text(encoding="utf-8")
        canonical_file = (canonical_root / name).read_text(encoding="utf-8")
        assert len(local) < 1500, f"Duplicated runtime/UI returned: {name}"
        assert len(canonical_file) > 10000, f"Missing canonical source: {name}"
        assert "../../design-system/transfi-remittance/" + name in local
    assert "./withdraw-route-experiment.js" in (
        ROOT / "transfi-remittance" / "preview-interactions.js"
    ).read_text(encoding="utf-8")
    # The same structural renderer is used by the bank and crypto flows.
    route_js = (canonical_root / "route-card.js").read_text(encoding="utf-8")
    route_css = (canonical_root / "route-card.css").read_text(encoding="utf-8")
    crypto = (ROOT / "transfi-remittance" / "withdraw-route-experiment.js").read_text(encoding="utf-8")
    gallery = (ROOT / "design-system" / "ui-kit" / "index.html").read_text(encoding="utf-8")
    assert "root.AltvuRouteCard=Object.freeze" in route_js
    assert "--ds-sem-divider" in route_css and "--ds-sem-border" in route_css
    assert "window.AltvuRouteCard.render({" in crypto
    assert "labelId:\'exp-dest-label\'" in crypto, "Reactive recipient label ID was lost"
    assert "window.AltvuRouteCard.render({" in experiment
    assert "route-card.js" in (
        ROOT / "transfi-remittance" / "preview-interactions.js"
    ).read_text(encoding="utf-8")
    assert 'src="../../design-system/transfi-remittance/route-card.js"' in experiment
    assert 'href="../../design-system/transfi-remittance/route-card.css"' in experiment
    catalog = gallery.split('id="g-experiments"', 1)[1].split("</section>", 1)[0]
    assert catalog.count('<article class="cmp exp-route-component"') == 1
    assert catalog.count('class="v exp-route-preview"') == 4
    for state in ("mode=usdt", "kind=country", "country=GB", "kind=bank"):
        assert state in catalog, "Missing catalog route variant: " + state



def confirm_network(page, coin, screenshot=None):
    sheet = page.locator(".exp-network-confirm")
    expect(sheet).to_be_visible()
    expect(sheet.locator("[data-confirm-coin]")).to_have_text(coin)
    expect(sheet.locator(".tbl > .rl > span")).to_have_text(["Сеть", "Монета"])
    expect(sheet.locator(".tbl > .rl > b > .ds-icon-frame:last-child")).to_have_count(2)
    # Match the actual title/value table's canonical styles, rather than
    # copying generic list geometry or the standalone sheet summary border.
    layout = sheet.evaluate("""el => {
        const specimen=document.createElement('div');
        specimen.className='tbl';
        specimen.innerHTML='<div class="rl"><span>Сеть</span><b>TRC20</b></div><div class="rl"><span>Монета</span><b>USDT</b></div>';
        const phone=el.closest('.phone');phone.appendChild(specimen);
        const style=(node,keys)=>keys.map(key=>getComputedStyle(node)[key]);
        const rows=Array.from(el.querySelectorAll('.tbl > .rl'));
        const refs=Array.from(specimen.querySelectorAll('.rl'));
        const keys=['paddingTop','paddingBottom','marginBottom','borderTopWidth','borderBottomWidth','borderTopColor','gap','alignItems'];
        const fonts=['fontFamily','fontSize','lineHeight','fontWeight','color'];
        const result=rows.every((r,i)=>JSON.stringify(style(r,keys))===JSON.stringify(style(refs[i],keys)) &&
          JSON.stringify(style(r.firstElementChild,fonts))===JSON.stringify(style(refs[i].firstElementChild,fonts)) &&
          JSON.stringify(style(r.querySelector('b'),fonts))===JSON.stringify(style(refs[i].querySelector('b'),fonts)) &&
          JSON.stringify(style(r.querySelector('b > span:not(.ds-icon-frame)'),fonts))===JSON.stringify(style(refs[i].querySelector('b'),fonts)));
        specimen.remove();return result;
    }""")
    assert layout, "Confirmation table must match canonical title/value table"
    for row in sheet.locator(".tbl > .rl").all():
        assert row.evaluate("""el=>{const b=el.querySelector('b');return b.firstElementChild.getBoundingClientRect().right<=b.lastElementChild.getBoundingClientRect().left}""")
    slider = sheet.locator(".exp-confirm-slide")
    expect(slider).to_have_text("Подтвердить")
    expect(slider).to_have_css("background-color", "rgba(0, 0, 0, 0)")
    expect(slider).to_have_css("border-top-width", "1px")
    fill=slider.locator(".exp-slide-fill")
    expect(fill).to_have_css("width", "44px")
    assert slider.evaluate("""el=>{const s=getComputedStyle(el),f=getComputedStyle(el.querySelector(\'.exp-slide-fill\'));return f.backgroundColor===\'rgb(203, 241, 74)\'&&s.boxShadow===\'none\'}""")
    expect(page.locator("#exp-note")).to_be_hidden()
    page.wait_for_timeout(750)
    if screenshot:
        page.screenshot(path=str(screenshot))
    for fraction in (0.4, 1):
        slider.scroll_into_view_if_needed()
        page.wait_for_timeout(250)
        track = slider.bounding_box()
        thumb = slider.locator(".exp-slide-thumb").bounding_box()
        x = thumb["x"] + thumb["width"]/2
        y = thumb["y"] + thumb["height"]/2
        scale = slider.evaluate("el=>el.getBoundingClientRect().width/el.offsetWidth")
        page.mouse.move(x,y)
        page.mouse.down()
        page.mouse.move(x+(track["width"]-thumb["width"]-8*scale)*fraction,y,steps=12)
        assert fill.bounding_box()["width"] > thumb["width"] * 1.5
        if screenshot and fraction < 1:
            page.screenshot(path=str(screenshot.with_name(screenshot.stem+"-drag"+screenshot.suffix)))
        page.mouse.up()
        if fraction < 1:
            expect(sheet).to_be_visible()
            expect(fill).to_have_css("width", "44px")
    expect(sheet).to_have_count(0)


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
            browser = playwright.chromium.launch(headless=True, channel="chrome", args=["--no-sandbox"])
            # Home history: all preview data, native row/detail routing, no CTA.
            for width, height in [(390, 844), (430, 932), (1440, 900)]:
                context = browser.new_context(viewport={"width": width, "height": height},
                                              reduced_motion="reduce")
                page = context.new_page()
                page.on("pageerror", lambda exc: errors.append(str(exc)))
                page.goto(HOST.split("?")[0], wait_until="domcontentloaded")
                page.wait_for_function("window.altWithdrawRouteExperiment && allOps.length >= 25", timeout=30000)
                home = page.locator("#v-home")
                expect(home).to_have_class(re.compile(r"\bon\b"), timeout=30000)
                rows = home.locator(".feed .op")
                operations = page.evaluate("PV.data['/operations'].operations")
                expect(rows).to_have_count(len(operations))
                expect(home.locator(".feed .allops, .feed [data-act='all-ops']")).to_have_count(0)
                assert len({op["id"] for op in operations}) == len(operations)
                for coin, nets in (("USDT", ("tron","bnb","polygon","ton")),
                                   ("USDC", ("bnb","polygon"))):
                    for net in nets:
                        for kind in ("deposit", "withdrawal"):
                            assert any(o.get("coin")==coin and o.get("network")==net and
                                       o["kind"]==kind and o["status"] in ("credited","confirmed")
                                       for o in operations), (coin,net,kind)
                for rail in ("SEPA","SWIFT"):
                    for kind in ("deposit","withdrawal"):
                        assert any(o.get("bank_rail")==rail and o["kind"]==kind for o in operations)
                assert any(o["kind"]=="transfer" and o["amount_minor"]>0 for o in operations)
                assert any(o["kind"]=="transfer" and o["amount_minor"]<0 for o in operations)
                assert any(o.get("network")=="sbp" for o in operations)
                assert any(o["kind"]=="card" for o in operations)
                # On mobile inspect every native detail, including the last
                # transaction. On other widths check the scrollable list tail.
                checked = operations if width == 390 else [operations[0], operations[-1]]
                for op in checked:
                    row = home.locator('.feed .op[data-id="'+op["id"]+'"]')
                    row.scroll_into_view_if_needed()
                    row.click()
                    detail = page.locator("#v-details")
                    expect(detail).to_have_class(re.compile(r"\bon\b"), timeout=10000)
                    assert page.evaluate("curOp.id")==op["id"], op
                    expect(detail.locator("#d-amt")).not_to_be_empty()
                    expect(detail.locator("#d-badge")).not_to_be_empty()
                    expect(detail.locator("#d-box")).not_to_be_empty()
                    if op.get("bank_rail"):
                        expect(detail.locator("#d-box")).to_contain_text(op["bank_rail"])
                    elif op.get("coin") in ("USDT","USDC"):
                        expect(detail.locator("#d-box")).to_contain_text("Сеть")
                    detail.locator(".back").click()
                    expect(home).to_have_class(re.compile(r"\bon\b"), timeout=10000)
                expect(rows).to_have_count(len(operations))
                page.screenshot(path=str(OUT / f"home-history-{width}.png"))
                context.close()
                print(f"PASS home history {width}px: {len(operations)} rows, {len(checked)} native details", flush=True)

            for width, height in [(390, 844), (430, 932), (1440, 900)]:
                context = browser.new_context(
                    viewport={"width": width, "height": height},
                    reduced_motion="reduce",
                )
                page = context.new_page()
                page.on("pageerror", lambda exc: errors.append(str(exc)))
                page.goto(HOST + "usdt", wait_until="domcontentloaded")
                # A shared native runtime must load before the isolated route
                # experiment mounts its own two-leg composition.
                page.wait_for_function("""() =>
                    [...document.scripts].some(script =>
                        script.src.includes('/design-system/transfi-remittance/preview-interactions.js'))
                """, timeout=20000)
                expect(page.locator("#v-exp-route")).to_have_class(
                    re.compile(r"\bon\b"), timeout=30000
                )
                confirm_network(page, "USDT", OUT / f"network-confirm-usdt-{width}.png")
                # Design system is NOT copied into the experiment. The real
                # external CSS and its imported tokens must actually load.
                expect(page.locator("#exp-canonical-design-system")).to_have_attribute(
                    "href", re.compile(r"^\.\./\.\./design-system/css/alt-vu-wallet\.css\?v=.+$")
                )
                page.wait_for_function("""() => {
                    const sheet=[...document.styleSheets].find(s => s.href &&
                        new URL(s.href).pathname.endsWith('/design-system/css/alt-vu-wallet.css'));
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
                # Shared route renderer must mount the single canonical 32/20 coin icon.
                icons=page.locator("#v-exp-route .exp-leg .cn.ds-icon-frame")
                expect(icons).to_have_count(2)
                for icon in icons.all():
                    expect(icon).to_have_css("width", "32px")
                    expect(icon).to_have_css("height", "32px")
                    expect(icon).to_have_css("background-color", "rgb(233, 236, 240)")
                    expect(icon.locator("img")).to_have_css("width", "20px")
                # UI Kit previews the same live component; its separator
                # must span the actual card width and depend on the semantic role.
                route_geometry = page.evaluate("""() => {
                    const box=document.querySelector('#v-exp-route .exp-route-card');
                    const line=box.querySelector('.exp-arrow-line');
                    const a=box.getBoundingClientRect(),b=line.getBoundingClientRect();
                    const pseudo=getComputedStyle(line,'::after'),before=getComputedStyle(line,'::before');
                    const arrow=getComputedStyle(line.querySelector('.tf-bank-arrow'));
                    const token=getComputedStyle(line).getPropertyValue('--ds-sem-divider').trim();
                    return {left:Math.abs(a.left-b.left),right:Math.abs(a.right-b.right),
                        thickness:pseudo.height, beforeThickness:before.height,
                        split:Math.abs(parseFloat(before.width)+parseFloat(pseudo.width)+parseFloat(arrow.width)-parseFloat(getComputedStyle(line).width))<1 && before.position==='static' && pseudo.position==='static' && Math.abs(parseFloat(before.width)-parseFloat(pseudo.width))<1,
                        outline:arrow.boxShadow, beforeColor:before.backgroundColor,
                        color:pseudo.backgroundColor,token};
                }""")
                assert route_geometry["left"]<=1 and route_geometry["right"]<=1, (
                    f"Crypto route line is not edge to edge {width}px: {route_geometry}"
                )
                assert route_geometry["thickness"]=="1px"
                assert route_geometry["split"] and route_geometry["beforeThickness"]=="1px", route_geometry
                assert "233, 236, 240" in route_geometry["outline"] and route_geometry["beforeColor"]==route_geometry["color"], route_geometry
                assert route_geometry["color"]=="rgb(233, 236, 240)",route_geometry
                expect(page.locator("#v-exp-route .exp-amount-caption")).to_have_count(0)
                expect(page.locator("#v-exp-route .exp-amount-field .fl i")).to_have_text("Сумма перевода")
                expect(page.locator("#v-exp-route .exp-amount-field .fi")).to_have_count(0)
                expect(page.locator("#v-exp-route .exp-amount-field img")).to_have_count(0)
                expect(page.locator("#v-exp-route .exp-amount-field .addon .cur")).to_have_text("$")
                expect(page.locator("#v-exp-route .exp-amount-field .addon .mx")).to_have_count(0)
                amount_card = page.locator("#v-exp-route .exp-amount-field")
                expect(amount_card.locator("#exp-use-all")).to_be_visible()
                expect(amount_card).to_have_css("padding-left", "16px")
                expect(amount_card).to_have_css("padding-right", "16px")
                expect(amount_card).to_have_css("padding-top", "16px")
                expect(amount_card).to_have_css("padding-bottom", "16px")
                geometry = amount_card.evaluate("""card => {
                    const box = card.getBoundingClientRect();
                    const input = card.querySelector('#exp-amount').getBoundingClientRect();
                    const action = card.querySelector('#exp-use-all').getBoundingClientRect();
                    const route = document.querySelector('#v-exp-route .exp-route-card');
                    // Desktop scales the whole phone. Convert viewport coordinates
                    // back to local CSS pixels before checking the actual inset.
                    const sx = box.width / card.offsetWidth;
                    const sy = box.height / card.offsetHeight;
                    const left = (action.left - box.left) / sx;
                    const right = (box.right - action.right) / sx;
                    const bottom = (box.bottom - action.bottom) / sy;
                    const label = card.querySelector('.fl i').getBoundingClientRect();
                    const top = (label.top - box.top) / sy;
                    const button = card.querySelector('#exp-use-all');
                    const placeholder = getComputedStyle(card.querySelector('#exp-amount'),'::placeholder');
                    const token = document.createElement('span');
                    token.style.color='var(--n300)'; card.appendChild(token);
                    const expected = getComputedStyle(token).color; token.remove();
                    const currency = card.querySelector('.addon .cur').getBoundingClientRect();
                    const clear = card.querySelector('.addon .ds-field-clear').getBoundingClientRect();
                    const center = r => (r.top+r.bottom)/2;
                    return {currencyCentered:Math.abs(center(currency)-center(input))/sy<=1,
                        clearCentered:Math.abs(center(clear)-center(input))/sy<=1,
                        below: action.top >= input.bottom - 0.5,
                        left: Math.abs(left - 16) <= 1,
                        inside: right >= 15,
                        symmetric: Math.abs(top - 16) <= 1 && Math.abs(bottom - top) <= 1,
                        unpaddedAction: getComputedStyle(button).paddingBottom === '0px',
                        placeholder: placeholder.color === expected && placeholder.opacity === '1',
                        sameInset: getComputedStyle(card).paddingLeft === getComputedStyle(route).paddingLeft};
                }""")
                assert all(geometry.values()), (width, geometry)
                expect(page.locator("#exp-use-all")).to_be_visible()
                expect(page.locator("#exp-use-all")).to_contain_text("Использовать всё:")
                expect(page.locator("#exp-max")).to_have_count(0)
                expect(page.locator("#exp-recipient")).to_have_attribute("placeholder", "Адрес кошелька")
                expect(page.locator("#v-exp-route .exp-leg").nth(1).locator(".fl b")).to_have_count(0)
                expect(page.locator("#exp-amount")).to_be_visible()
                # Amount digits share the existing 32/38/600 monetary role.
                # The regular field caption, currency and MAX must not inherit it.
                amount_input = page.locator("#exp-amount")
                amount_input.fill("250.00")
                expect(amount_card.locator(".addon .ds-field-clear")).to_be_visible()
                assert amount_card.evaluate("""el => {
                    const r=el.querySelector('input.wd-amt').getBoundingClientRect();
                    const c=el.querySelector('.addon .cur').getBoundingClientRect();
                    const x=el.querySelector('.addon .ds-field-clear').getBoundingClientRect();
                    return Math.abs((r.top+r.bottom-c.top-c.bottom)/2)<=1 &&
                           Math.abs((r.top+r.bottom-x.top-x.bottom)/2)<=1;
                }"""), width
                amount_card.locator(".addon .ds-field-clear").click()
                expect(amount_input).to_have_value("")
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
                expect(page.locator("#v-exp-route .exp-actions .uzone")).to_have_count(3)
                expect(page.locator("#exp-book")).to_have_text("Из книжки")
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
                expect(page.locator("#v-exp-route > .sheet:not(.wd-sheet)")).to_have_count(0)
                expect(page.locator("#v-exp-route > .wd-sheet")).to_be_hidden()
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
                expect(page.locator(".exp-route-card .ds-field-clear")).to_be_visible()
                # Real scanner entry point receives a deterministic decoded QR result.
                page.evaluate("() => {window.scanQR = async opts => {opts.take({kind:'addr', value:'0x' + 'b'.repeat(40)})}}")
                page.locator("#exp-scan").click()
                expect(page.locator("#exp-recipient")).to_have_value("0x" + "b" * 40)
                expect(page.locator(".exp-route-card .ds-field-clear")).to_be_visible()
                # Exercise native book filtering, empty state, dismissal and selection.
                page.evaluate("""() => {
                    const s=window.altWithdrawRouteExperiment.state;
                    const coin=s.method.toUpperCase(),net=s.network;
                    window.__originalBookLoad=bookLoad;
                    bookLoad=async()=>{bookAll=[
                        {coin,network:net,label:'Тестовый адрес',address:'0x'+'c'.repeat(40)},
                        {coin,network:'other',label:'Другая сеть',address:'wrong-net'},
                        {coin:coin==='USDT'?'USDC':'USDT',network:net,label:'Другая монета',address:'wrong-coin'}
                    ];return true;};
                }""")
                page.locator("#exp-book").click()
                expect(page.locator("#v-exp-route .wd-sheet")).to_be_visible()
                expect(page.locator("#v-exp-route .wd-sheet [data-wd-pick]")).to_have_count(1)
                page.keyboard.press("Escape")
                expect(page.locator("#v-exp-route .wd-sheet")).to_be_hidden()
                page.locator("#exp-book").click()
                page.locator("#v-exp-route .wd-sheet [data-wd-pick]").click()
                expect(page.locator("#exp-recipient")).to_have_value("0x"+"c"*40)
                expect(page.locator(".exp-route-card .ds-field-clear")).to_be_visible()
                expect(page.locator("#v-exp-route .wd-sheet")).to_be_hidden()
                page.evaluate("() => {bookLoad=async()=>{bookAll=[];return true;}}")
                page.locator("#exp-book").click()
                expect(page.locator("#v-exp-route .wd-sheet-box")).to_contain_text("Нет сохранённых адресов")
                page.locator('#v-exp-route .wd-sheet [data-act="wd-manual"]').click()
                expect(page.locator("#v-exp-route .wd-sheet")).to_be_hidden()
                page.evaluate("() => {bookLoad=window.__originalBookLoad}")
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
                    expect(page.locator(".exp-network-confirm")).to_be_visible()
                    expect(page.locator("#exp-recipient")).to_have_value("T" + "1" * 33)
                    page.keyboard.press("Escape")
                    expect(page.locator(".exp-network-confirm")).to_have_count(0)
                    expect(page.locator("#exp-net-value")).to_have_text("TRC20")
                    page.locator("#exp-net-toggle").click()
                    page.locator('.phone > .ns-sheet .ns-box [data-ns="'+chosen+'"]').click()
                    confirm_network(page, "USDT")
                    expect(page.locator("#exp-recipient")).to_have_value("")
                    expect(page.locator(".exp-route-card .ds-field-clear")).to_be_hidden()
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
                if mode == "usdc":
                    confirm_network(page, "USDC")
                else:
                    expect(page.locator(".exp-network-confirm")).to_have_count(0)
                expect(page.locator("#exp-dest-label")).to_have_text("Куда → " + target)
                expect(page.locator("#exp-balance")).to_have_text(re.compile(r"[\d\s\u00a0.,]+\s*\$"))
                expect(page.locator("#v-exp-route .exp-amount-caption")).to_have_count(0)
                expect(page.locator("#v-exp-route .exp-amount-field .fl i")).to_have_text("Сумма перевода")
                expect(page.locator("#v-exp-route .exp-amount-field .fi")).to_have_count(0)
                expect(page.locator("#exp-paste")).to_contain_text("Вставить")
                expect(page.locator("#exp-scan")).to_contain_text("Сканировать")
                expect(page.locator("#v-exp-route .exp-actions .uzone")).to_have_count(2 if mode == "altvu" else 3)
                if mode == "altvu":
                    expect(page.locator("#exp-recipient")).to_have_attribute("placeholder", "Почта или телефон")
                    expect(page.locator("#exp-net-toggle")).to_be_hidden()
                    expect(page.locator(".phone > .ns-sheet")).to_be_hidden()
                    page.evaluate("""Object.defineProperty(navigator, 'clipboard', {
                        configurable:true, value:{readText:async () => 'demo.receiver@example.invalid'}
                    })""")
                    page.locator("#exp-paste").click()
                    expect(page.locator("#exp-recipient")).to_have_value("demo.receiver@example.invalid")
                    expect(page.locator(".exp-route-card .ds-field-clear")).to_be_visible()
                    page.evaluate("() => {window.scanQR = async opts => {opts.take({kind:'code', value:'ABCD-EFGH'})}}")
                    page.locator("#exp-scan").click()
                    expect(page.locator("#exp-recipient")).to_have_value("ABCD-EFGH")
                    page.locator(".exp-route-card .ds-field-clear").click()
                    expect(page.locator("#exp-recipient")).to_have_value("")
                    assert page.evaluate("window.altWithdrawRouteExperiment.state.scannedCode")==""
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
                    expect(page.locator("#exp-book")).to_have_text("Из книжки")
                    page.evaluate("""() => {
                        const s=window.altWithdrawRouteExperiment.state;
                        window.__originalBookLoad=bookLoad;
                        bookLoad=async()=>{bookAll=[
                          {coin:'USDC',network:s.network,label:'USDC test',address:'0x'+'d'.repeat(40)},
                          {coin:'USDT',network:s.network,label:'USDT test',address:'wrong-coin'}
                        ];return true;};
                    }""")
                    page.locator("#exp-book").click()
                    expect(page.locator("#v-exp-route .wd-sheet [data-wd-pick]")).to_have_count(1)
                    page.locator("#v-exp-route .wd-sheet [data-wd-pick]").click()
                    expect(page.locator("#exp-recipient")).to_have_value("0x"+"d"*40)
                    expect(page.locator(".exp-route-card .ds-field-clear")).to_be_visible()
                    page.evaluate("() => {bookLoad=window.__originalBookLoad}")
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
            # Explicit regression for both cryptocurrency methods at every viewport.
            for width, height in [(390, 844), (430, 932), (1440, 900)]:
                for mode in ("usdt", "usdc"):
                    context = browser.new_context(viewport={"width": width, "height": height},
                                                  reduced_motion="reduce")
                    page = context.new_page()
                    page.on("pageerror", lambda exc: errors.append(str(exc)))
                    page.goto(HOST + mode, wait_until="domcontentloaded")
                    expect(page.locator("#v-exp-route")).to_have_class(re.compile(r"\bon\b"), timeout=30000)
                    confirm_network(page, mode.upper(), OUT / f"network-confirm-{mode}-{width}.png")
                    expect(page.locator("#exp-dest-label")).to_have_text("Куда → " + mode.upper())
                    card = page.locator("#v-exp-route .exp-amount-field")
                    amount = card.locator("input.wd-amt")
                    clear = card.locator(".addon .ds-field-clear")
                    expect(clear).to_be_hidden()
                    for value in ("", "250.00"):
                        amount.fill(value)
                        if value:
                            expect(clear).to_be_visible()
                        else:
                            expect(clear).to_be_hidden()
                        geo = card.evaluate("""el => {
                            const r=el.querySelector('input.wd-amt').getBoundingClientRect();
                            const c=el.querySelector('.addon .cur').getBoundingClientRect();
                            const x=el.querySelector('.addon .ds-field-clear').getBoundingClientRect();
                            const sy=el.getBoundingClientRect().height/el.offsetHeight;
                            return {currency:Math.abs((r.top+r.bottom-c.top-c.bottom)/2)/sy,
                                clear:Math.abs((r.top+r.bottom-x.top-x.bottom)/2)/sy};
                        }""")
                        assert max(geo.values())<=1, (mode,width,value,geo)
                    page.screenshot(path=str(OUT / f"amount-axis-{mode}-{width}.png"))
                    print(f"PASS amount axis {mode} {width}px", flush=True)
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
                page.goto(HOST + "usdt&component=route-card&filled=1", wait_until="domcontentloaded")
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
                expect(page.locator(".exp-route-card .ds-field-clear")).to_be_visible()
                page.locator(".exp-route-card .ds-field-clear").click()
                expect(page.locator("#exp-recipient")).to_have_value("")
                expect(page.locator(".exp-route-card .ds-field-clear")).to_be_hidden()
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
                    # ALT.VU source is framed; flags and generic bank SVGs are not.
                    source_icon=route.locator(".tf-bank-leg").first.locator(".cn.ds-icon-frame")
                    expect(source_icon).to_have_count(1)
                    expect(source_icon).to_have_css("width", "32px")
                    expect(source_icon).to_have_css("height", "32px")
                    expect(source_icon).to_have_css("background-color", "rgb(233, 236, 240)")
                    expect(source_icon.locator("img")).to_have_css("width", "20px")
                    expect(route.locator(".tf-bank-destination .cn.ds-icon-frame")).to_have_count(0)
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
                        const rs=getComputedStyle(route,'::after'),ls=getComputedStyle(route,'::before');
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
                            inset:[ms.left,ms.right],
                            split:ls.position==='static'&&rs.position==='static'&&ls.backgroundColor===rs.backgroundColor&&ls.height===rs.height&&Math.abs(parseFloat(ls.width)+parseFloat(rs.width)+parseFloat(arrowCss.width)-parseFloat(getComputedStyle(route).width))<1,
                            arrowOutline:arrowCss.boxShadow,
                            totTop:totalCss.borderTopWidth,
                            totBottom:totalCss.borderBottomWidth,
                            semantic:getComputedStyle(bank).getPropertyValue('--ds-sem-divider').trim(),
                            borderToken:getComputedStyle(bank).getPropertyValue('--ds-sem-border').trim(),
                            capsuleOutline:capsule.boxShadow,
                            capsulesMatch:['height','borderRadius','backgroundColor']
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
                    assert dividers["inset"]==["0px"]*2 and dividers["split"], dividers
                    assert "233, 236, 240" in dividers["arrowOutline"], dividers
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
                    amount_spacing = page.locator('#tf-bank-sbp').evaluate("""card => {
                        const box=card.getBoundingClientRect(), sy=box.height/card.offsetHeight;
                        const label=card.querySelector('.h:first-child label').getBoundingClientRect();
                        const action=card.querySelector('#tf-bank-use-all').getBoundingClientRect();
                        const top=(label.top-box.top)/sy, bottom=(box.bottom-action.bottom)/sy;
                        const input=card.querySelector('#tf-out-amount');
                        const ph=getComputedStyle(input,'::placeholder');
                        const receive=getComputedStyle(card.querySelector('#tf-bank-receive'));
                        return {top,bottom,placeholder:ph.color===receive.color && ph.opacity==='1'};
                    }""")
                    assert abs(amount_spacing['top']-16)<=1 and abs(amount_spacing['bottom']-16)<=1 and amount_spacing['placeholder'], (rail,width,amount_spacing)
                    expect(page.locator("#footer #quoteBlock")).to_be_visible()
                    rows = page.locator("#quoteBlock .row")
                    expect(rows).to_have_count(1)
                    expect(rows.first).to_contain_text("К списанию")
                    expect(rows.first).to_contain_text("комиссия")
                    fee="2.50" if rail=="SEPA" else "18.00"
                    expect(page.locator("#quoteBlock .tf-bank-fee")).to_have_text(
                        f"(комиссия {fee} $)"
                    )
                    expect(page.locator("#quoteBlock .rt")).to_have_css("font-size","16px")
                    expect(page.locator("#quoteBlock .rt")).to_have_css("line-height","22px")
                    expect(page.locator("#quoteBlock .rt")).to_have_css("font-weight","400")
                    expect(page.locator("#quoteBlock .tf-bank-fee")).to_have_css("font-size","12px")
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
                assert flags == [["20px", "20px"]] * 3, flags
                # The bank selector uses the current Coins & Networks
                # 32px semantic frame with 20px flag artwork, using live design tokens.
                def frame_geometry(key):
                    return page.evaluate("""key => {
                        const phone=document.querySelector('.phone.tf-phone');
                        const sample=document.createElement('span');
                        sample.className='ds-icon-frame';
                        phone.appendChild(sample);
                        const expected=getComputedStyle(sample).backgroundColor;
                        sample.remove();
                        const nodes=[
                          document.querySelector('[data-picker="'+key+'"] .fi'),
                          ...document.querySelectorAll('#pickerLayer .tf-picker-row .ri')
                        ];
                        return {expected, frames:nodes.map(el=>{
                          const style=getComputedStyle(el);
                          const art=el.querySelector('svg.tf-country-flag');
                          return {
                            frame:el.classList.contains('ds-icon-frame'),
                            size:[style.width,style.height],
                            color:style.backgroundColor,
                            art:art?[getComputedStyle(art).width,getComputedStyle(art).height]:null
                          };
                        })};
                    }""", key)
                light=frame_geometry("outCurrency")
                assert len(light["frames"]) == 4, light
                assert all(f["frame"] and f["size"] == ["32px","32px"]
                           and f["color"] == light["expected"]
                           and f["art"] == ["20px","20px"]
                           for f in light["frames"]), light
                page.evaluate("document.documentElement.classList.add('dark')")
                dark=frame_geometry("outCurrency")
                assert all(f["color"] == dark["expected"] for f in dark["frames"]), dark
                assert dark["expected"] != light["expected"], (light,dark)
                page.evaluate("document.documentElement.classList.remove('dark')")
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
                # The same canonical plate is required in the country picker.
                page.goto(
                    f"http://127.0.0.1:{PORT}/transfi-remittance/legacy.html"
                    "?component=picker&kind=country&embedded=1",
                    wait_until="domcontentloaded"
                )
                expect(page.locator('#pickerLayer')).to_be_visible()
                country=page.evaluate("""() => {
                    const field=document.querySelector('[data-picker="country"] .fi');
                    const rows=[...document.querySelectorAll('#pickerLayer .tf-picker-row .ri')];
                    const sample=document.createElement('span');
                    sample.className='ds-icon-frame';
                    document.querySelector('.phone.tf-phone').appendChild(sample);
                    const expected=getComputedStyle(sample).backgroundColor;
                    sample.remove();
                    return [field,...rows].map(el => ({
                      cls:el.classList.contains('ds-icon-frame'),
                      w:getComputedStyle(el).width,
                      h:getComputedStyle(el).height,
                      bg:getComputedStyle(el).backgroundColor,
                      flag:!!el.querySelector('svg.tf-country-flag'),
                      expected
                    }));
                }""")
                assert len(country) >= 5, country
                assert all(item["cls"] and item["w"] == item["h"] == "32px"
                           and item["bg"] == item["expected"] and item["flag"]
                           for item in country), country
                page.locator('#pickerLayer [data-picker-value="FR"]').click()
                expect(page.locator('#pickerLayer')).to_be_hidden()
                expect(page.locator('[data-picker="country"]')).to_contain_text("Франция")
                context.close()
            # Four states of the SAME interactive route card, rendered by
            # the live crypto/bank screens rather than a static catalog copy.
            for width, height in [(390, 844), (430, 932), (1440, 900)]:
                for kind, rail, country in [
                    ("country", "SEPA", ""),
                    ("country", "SWIFT", "GB"),
                    ("bank", "SWIFT", ""),
                ]:
                    context = browser.new_context(
                        viewport={"width": width, "height": height},
                        reduced_motion="reduce",
                    )
                    page = context.new_page()
                    page.on("pageerror", lambda exc: errors.append(str(exc)))
                    url = (
                        f"http://127.0.0.1:{PORT}/transfi-remittance/legacy.html"
                        f"?component=route-card&kind={kind}&rail={rail}&country={country}"
                    )
                    page.goto(url, wait_until="domcontentloaded")
                    route = page.locator(".tf-bank-route-card")
                    expect(route).to_be_visible()
                    expect(route.locator(".tf-bank-leg")).to_have_count(2)
                    expect(route.locator(".tf-bank-leg").first).to_contain_text("Откуда → ALT.VU")
                    expect(page.locator(".tf-scroll > .tf-bank-route-card")).to_have_count(1)
                    expect(page.locator(".tf-scroll > .tf-bank-sbp")).to_have_count(0)
                    assert page.evaluate("!!window.AltvuRouteCard")
                    geom = route.evaluate("""el => {
                        const arrow=el.querySelector('.tf-bank-arrow');
                        const line=el.querySelector('.tf-bank-arrow-line');
                        const c=el.getBoundingClientRect(),b=line.getBoundingClientRect();
                        const a=getComputedStyle(arrow),d=getComputedStyle(line,'::after');
                        return {width:a.width,height:a.height,outline:a.boxShadow,
                            left:Math.abs(c.left-b.left),right:Math.abs(c.right-b.right),
                            thickness:d.height,color:d.backgroundColor};
                    }""")
                    assert geom["width"] == geom["height"] == "32px", geom
                    assert "233, 236, 240" in geom["outline"], geom
                    assert geom["left"] <= 1 and geom["right"] <= 1, geom
                    assert geom["thickness"] == "1px", geom
                    assert geom["color"] == "rgb(233, 236, 240)", geom
                    if kind == "bank":
                        expect(route).to_have_attribute("data-route-variant", "bank")
                        expect(route.locator(".tf-bank-leg").last).to_contain_text("Банк-партнёр")
                        expect(route.locator('[data-picker="country"]')).to_have_count(0)
                    else:
                        expect(route).to_have_attribute("data-route-variant", "country")
                        country_field = route.locator('[data-picker="country"]')
                        expect(country_field).to_be_visible()
                        if country:
                            expect(country_field).to_contain_text("Великобритания")
                            expect(country_field.locator("svg.tf-country-flag")).to_have_count(1)
                        else:
                            expect(country_field).to_contain_text("Выберите страну")
                        country_field.click()
                        expect(page.locator("#pickerLayer")).to_be_visible()
                        page.keyboard.press("Escape")
                        expect(page.locator("#pickerLayer")).to_be_hidden()
                    page.screenshot(path=str(OUT / f"route-{kind}-{rail.lower()}-{width}.png"))
                    context.close()
            # Bank deposit buttons and the readonly SEPA EUR field must
            # match the canonical, shared bank renderer.
            for width,height in [(390,844),(430,932)]:
                for rail in ("SEPA","SWIFT"):
                    context=browser.new_context(viewport={"width":width,"height":height})
                    page=context.new_page()
                    page.on("pageerror", lambda exc: errors.append(str(exc)))
                    page.goto(
                        f"http://127.0.0.1:{PORT}/transfi-remittance/legacy.html"
                        f"?capture=1&embedded=1&flow=in&screen=in-details&rail={rail}",
                        wait_until="domcontentloaded"
                    )
                    button=page.locator("#footer .btn")
                    expect(button).to_have_text("Скопировать реквизиты")
                    expect(button).to_have_attribute("onclick","copyAll()")
                    if rail=="SEPA":
                        expect(page.locator(".tf-deposit-currency")).to_contain_text("EUR")
                        expect(page.locator(".tf-deposit-currency svg.tf-country-flag")).to_have_count(1)
                        expect(page.locator(
                            ".tf-deposit-currency svg.tf-country-flag polygon"
                        )).to_have_count(12)
                        expect(page.locator(
                            ".tf-deposit-currency svg.tf-currency-icon"
                        )).to_have_count(0)
                        expect(page.locator('[data-picker="inCurrency"]')).to_have_count(0)
                    else:
                        expect(page.locator('[data-picker="inCurrency"] svg.tf-country-flag')).to_have_count(1)
                    page.evaluate("""() => {
                       window.__copiedDeposit=null;
                       window.copyText = text => {window.__copiedDeposit=text};
                    }""")
                    button.click()
                    copied=page.evaluate("window.__copiedDeposit")
                    assert copied and "DEMO-REF-000123" in copied, (rail,copied)
                    assert copied==page.evaluate(
                        "() => getRequisites().map(([k,v])=>k+': '+v).join('\\n')"
                    ), (rail,copied)
                    page.screenshot(path=str(OUT / f"deposit-{rail.lower()}-{width}.png"))
                    context.close()
            # Experimental SEPA/SWIFT recipient: placeholder and purpose picker
            # must be correct at both mobile widths, without changing shared UI.
            for width,height in [(390,844),(430,932)]:
                for rail in ("SEPA","SWIFT"):
                    context=browser.new_context(viewport={"width":width,"height":height}, reduced_motion="reduce")
                    page=context.new_page()
                    page.on("pageerror", lambda exc: errors.append(str(exc)))
                    page.goto(
                        f"http://127.0.0.1:{PORT}/transfi-remittance/legacy.html"
                        f"?capture=1&embedded=1&flow=out&screen=out-recipient&rail={rail}",
                        wait_until="domcontentloaded"
                    )
                    expect(page.locator("#f-recipientName")).to_have_attribute(
                        "placeholder", "Например, Alexander Müller"
                    )
                    trigger=page.locator('[data-picker="purpose"]')
                    trigger.click()
                    expect(page.locator("#pickerLayer .tf-picker-row")).to_have_count(4)
                    expect(page.locator("#pickerLayer .tf-picker-row .ri")).to_have_count(0)
                    expect(page.locator("#pickerLayer .tf-picker-row .rd")).to_have_count(4)
                    expect(page.locator('#pickerLayer [aria-checked="true"]')).to_have_count(1)
                    page.locator('[data-picker-value="education"]').click()
                    expect(trigger).to_contain_text("Обучение")
                    expect(page.locator("#pickerLayer")).to_be_hidden()
                    trigger.click()
                    page.keyboard.press("Escape")
                    expect(page.locator("#pickerLayer")).to_be_hidden()
                    expect(trigger).to_contain_text("Обучение")
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
