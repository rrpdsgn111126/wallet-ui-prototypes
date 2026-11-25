#!/usr/bin/env python3
"""Guard experimental method sheets against drift from work/design-system.

Runs after the experiment workflow stages work/design-system in ./design-system.
Includes Playwright screenshots and functional smoke for the real public-preview DOM.
"""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from subprocess import DEVNULL, Popen
import json
import re
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
EXPERIMENT = ROOT / "transfi-remittance" / "index.html"
CANONICAL = ROOT / "design-system" / "transfi-remittance" / "index.html"
OUT = ROOT / "artifacts" / "withdraw-route"
PORT = 8766
BASE = f"http://127.0.0.1:{PORT}"

class Tags(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items = []
    def handle_starttag(self, tag, attrs):
        self.items.append(("open", tag, tuple(sorted(attrs))))
    def handle_startendtag(self, tag, attrs):
        self.items.append(("empty", tag, tuple(sorted(attrs))))
    def handle_endtag(self, tag):
        self.items.append(("end", tag))
    def handle_data(self, text):
        normalized = re.sub(r"\s+", " ", text).strip()
        if normalized:
            self.items.append(("text", normalized))

def method_fragment(source, view):
    start = source.find(f'id="{view}"')
    assert start >= 0, f"View missing: {view}"
    sheet = source.find('<div class="sheet">', start)
    next_view = source.find("</section>", start)
    note = source.find('<div class="note"', sheet)
    assert start < sheet < note < next_view, f"Method sheet boundaries invalid: {view}"
    return source[sheet:note]

def validate_source():
    assert CANONICAL.is_file(), "Missing staged work/design-system worktree"
    sample = CANONICAL.read_text(encoding="utf-8")
    experiment = EXPERIMENT.read_text(encoding="utf-8")
    assert 'id="exp-canonical-design-system"' in experiment, "Experiment must import shared DS CSS"
    for view, rows in [("v-topup", 6), ("v-withdraw", 5)]:
        src, dst = method_fragment(sample, view), method_fragment(experiment, view)
        p1, p2 = Tags(), Tags()
        p1.feed(src)
        p2.feed(dst)
        assert p1.items == p2.items, (
            f"{view} method sheet DOM diverged from work/design-system. "
            "Update only this method-sheet fragment, never replace the experimental screens."
        )
        assert src.count('class="box method-list"') == 2
        assert src.count('class="m row method-option') == rows
        assert src.count('class="method-chevron"') == rows
        assert '<div class="m" data-go=' not in dst
        assert 'class="rd' not in dst
        print(f"PASS canonical method sheet parity: {view}, {rows} methods, two grouped plates")

def wait_for_http():
    for _ in range(80):
        try:
            with urllib.request.urlopen(BASE + "/transfi-remittance/", timeout=1) as resp:
                if resp.status == 200:
                    return
        except Exception:
            time.sleep(0.2)
    raise RuntimeError("Local experiment HTTP preview did not start")

def validate_browser():
    OUT.mkdir(parents=True, exist_ok=True)
    server = Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
                   cwd=ROOT, stdout=DEVNULL, stderr=DEVNULL)
    try:
        wait_for_http()
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, channel="chrome", args=["--no-sandbox"])
            try:
                for width in (390, 430, 1440):
                    page = browser.new_page(viewport={"width": width, "height": 932},
                                            reduced_motion="reduce")
                    errors = []
                    page.on("pageerror", lambda err: errors.append(str(err)))
                    try:
                        page.goto(BASE + "/transfi-remittance/?qa=1",
                                  wait_until="domcontentloaded")
                        page.wait_for_function("typeof show === 'function'", timeout=30000)
                        page.wait_for_function("""() => {
                            return [...document.styleSheets].some(sheet =>
                              sheet.href && sheet.href.includes('/design-system/css/alt-vu-wallet.css'));
                        }""", timeout=30000)
                        for view, count in (("topup", 6), ("withdraw", 5)):
                            page.evaluate("(view) => show(view,false)", view)
                            sheet = page.locator(f"#v-{view} .sheet")
                            first = sheet.locator(".method-list").first
                            expect(first).to_be_visible(timeout=12000)
                            expect(sheet.locator(".method-list")).to_have_count(2)
                            expect(sheet.locator(".method-list > button.m.row.method-option")).to_have_count(count)
                            expect(sheet.locator(".method-list .method-chevron")).to_have_count(count)
                            expect(sheet.locator(".method-list .rd")).to_have_count(0)
                            expect(sheet.locator(".method-list > button.tf-bank-method")).to_have_count(2)
                            for dark in (False, True):
                                page.evaluate("(dark) => document.documentElement.classList.toggle('dark',dark)", dark)
                                computed = first.evaluate("""el => {
                                    const plate=getComputedStyle(el);
                                    const row=el.querySelector('.method-option:not([hidden])');
                                    const icon=row.querySelector('.ri');
                                    const text=row.querySelector('.rt');
                                    const chevron=row.querySelector('.method-chevron');
                                    return {radius:plate.borderRadius,
                                      background:plate.backgroundColor,
                                      rowHeight:parseFloat(getComputedStyle(row).height),
                                      iconWidth:getComputedStyle(icon).width,
                                      titleSize:getComputedStyle(text.querySelector('b')).fontSize,
                                      chevron:getComputedStyle(chevron).width};
                                }""")
                                assert computed["radius"] == "20px", (view, computed)
                                assert computed["background"] != "rgba(0, 0, 0, 0)", (view, computed)
                                assert computed["rowHeight"] >= 60, (view, computed)
                                assert computed["iconWidth"] == "32px", (view, computed)
                                assert computed["titleSize"] == "16px", (view, computed)
                                assert computed["chevron"] == "36px", (view, computed)
                                action_row=first.locator(".method-option:not([hidden])").first
                                arrow=action_row.locator(".method-chevron")
                                page.mouse.move(0,0)
                                expect(arrow).to_have_css("background-color","rgba(0, 0, 0, 0)")
                                action_row.locator(".rt").hover()
                                assert arrow.evaluate("e=>getComputedStyle(e).backgroundColor") != "rgba(0, 0, 0, 0)"
                                expect(arrow).to_have_css("stroke-width","1.8px")
                                page.screenshot(path=str(OUT / f"method-{view}-{'dark' if dark else 'light'}-{width}.png"))
                                print(f"PASS real method UI {view} {'dark' if dark else 'light'} {width}px")
                        page.evaluate("document.documentElement.classList.remove('dark')")
                        page.evaluate("show('topup',false)")
                        page.locator("#v-topup .method-list [data-go='dep-usdt-tron']").click()
                        expect(page.locator("#v-dep-usdt-tron.on")).to_be_visible(timeout=15000)
                        page.evaluate("""() => {
                            window.tfVerificationQA.setScenarioStatus('approved');
                            show('topup',false);
                        }""")
                        page.locator("#v-topup .method-list [data-tf-bank='SEPA']").click()
                        expect(page.locator("#tf-bank-overlay")).to_be_visible(timeout=15000)
                        assert not errors, (width, errors)
                        print(f"PASS method actions USDT and SEPA {width}px")
                    finally:
                        page.close()
            finally:
                browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=3)
        except Exception:
            server.kill()

if __name__ == "__main__":
    validate_source()
    validate_browser()
