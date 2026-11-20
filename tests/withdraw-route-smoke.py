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


def run():
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
                expect(page.locator("#exp-dest-label")).to_have_text("Куда → USDT")
                expect(page.locator("#v-exp-route .exp-leg").first.locator(".fl i")).to_have_text("Откуда → ALT.VU")
                expect(page.locator("#exp-balance")).to_have_text(re.compile(r"[\d\s\u00a0.,]+\s*\$"))
                expect(page.locator("#v-exp-route .exp-leg").nth(1).locator(".fl i")).to_have_text("Куда → USDT")
                expect(page.locator("#v-exp-route .exp-amount-caption")).to_have_count(0)
                expect(page.locator("#v-exp-route .exp-amount-field .fl i")).to_have_text("Сумма перевода")
                expect(page.locator("#v-exp-route .exp-amount-field .fi svg ellipse")).to_have_count(1)
                expect(page.locator("#v-exp-route .exp-amount-field img")).to_have_count(0)
                expect(page.locator("#v-exp-route .exp-amount-field .addon .cur")).to_have_text("$")
                expect(page.locator("#v-exp-route .exp-amount-field .addon .mx")).to_have_text("MAX")
                expect(page.locator("#exp-recipient")).to_have_attribute("placeholder", "Адрес кошелька")
                expect(page.locator("#v-exp-route .exp-leg").nth(1).locator(".fl b")).to_have_count(0)
                expect(page.locator("#exp-amount")).to_be_visible()
                expect(page.locator("#v-exp-route .exp-actions .uzone")).to_have_count(2)
                expect(page.locator("#exp-paste")).to_contain_text("Вставить")
                expect(page.locator("#exp-scan")).to_contain_text("Сканировать")
                expect(page.locator("#exp-net-toggle")).to_have_class(re.compile("fld w net-pick"))
                expect(page.locator("#exp-net-toggle .fl i")).to_have_text("Сеть")
                expect(page.locator("#exp-net-value")).to_have_text("TRC20")
                expect(page.locator("#exp-net-icon")).to_have_class(re.compile("nlg tron"))
                expect(page.locator("#exp-net-toggle")).to_have_attribute("aria-expanded", "false")
                page.screenshot(path=str(OUT / f"usdt-{width}.png"))
                page.locator("#exp-net-toggle").click()
                expect(page.locator("#exp-network-sheet")).to_be_visible()
                expect(page.locator("#exp-net-toggle")).to_have_attribute("aria-expanded", "true")
                page.keyboard.press("Escape")
                expect(page.locator("#exp-network-sheet")).to_be_hidden()
                expect(page.locator("#exp-net-toggle")).to_have_attribute("aria-expanded", "false")
                # Clipboard is stubbed, but the real Paste button handler is exercised.
                page.evaluate("""Object.defineProperty(navigator, 'clipboard', {
                    configurable: true, value: {readText: async () => '0x' + 'a'.repeat(40)}
                })""")
                page.locator("#exp-paste").click()
                expect(page.locator("#exp-recipient")).to_have_value("0x" + "a" * 40)
                # Real scanner entry point receives a deterministic decoded QR result.
                page.evaluate("window.scanQR = async opts => {opts.take({kind:'addr', value:'0x' + 'b'.repeat(40)})}")
                page.locator("#exp-scan").click()
                expect(page.locator("#exp-recipient")).to_have_value("0x" + "b" * 40)
                page.locator("#exp-recipient").fill("")
                page.locator("#exp-max").click()
                assert float(page.locator("#exp-amount").input_value()) > 0
                page.locator("#exp-amount").fill("10.00")
                page.locator("#exp-next").click()
                expect(page.locator("#exp-error")).to_contain_text("адрес")
                # An in-app network change must clear the previous address.
                page.locator("#exp-recipient").fill("T" + "1" * 33)
                page.locator("#exp-net-toggle").click()
                options = page.locator("[data-exp-net]")
                if options.count() > 1:
                    chosen = options.nth(1).get_attribute("data-exp-net")
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
                expect(page.locator("#v-exp-route .exp-amount-field .fi svg ellipse")).to_have_count(1)
                expect(page.locator("#exp-paste")).to_contain_text("Вставить")
                expect(page.locator("#exp-scan")).to_contain_text("Сканировать")
                expect(page.locator("#v-exp-route .exp-actions .uzone")).to_have_count(2)
                if mode == "altvu":
                    expect(page.locator("#exp-recipient")).to_have_attribute("placeholder", "Почта или телефон")
                    expect(page.locator("#exp-net-toggle")).to_be_hidden()
                    page.evaluate("""Object.defineProperty(navigator, 'clipboard', {
                        configurable:true, value:{readText:async () => 'demo.receiver@example.invalid'}
                    })""")
                    page.locator("#exp-paste").click()
                    expect(page.locator("#exp-recipient")).to_have_value("demo.receiver@example.invalid")
                    page.evaluate("window.scanQR = async opts => {opts.take({kind:'code', value:'ABCD-EFGH'})}")
                    page.locator("#exp-scan").click()
                    expect(page.locator("#exp-recipient")).to_have_value("ABCD-EFGH")
                    # The original recipient lookup is verified via email on Continue.
                    page.locator("#exp-recipient").fill("demo.receiver@example.invalid")
                else:
                    expect(page.locator("#exp-net-toggle .fi .nlg")).to_have_count(1)
                    page.locator("#exp-recipient").fill("0x" + "1" * 40)
                page.locator("#exp-amount").fill("10.00")
                page.screenshot(path=str(OUT / f"{mode}-390.png"))
                page.locator("#exp-next").click()
                expect(page.locator(destination)).to_have_class(
                    re.compile(r"\bon\b"), timeout=30000
                )
                context.close()
            browser.close()
        assert not errors, f"Uncaught JS errors: {errors}"
        print("PASS: USDT/USDC/ALT.VU, native reviews, network sheet, MAX, validation, back, 390/430/1440")
    finally:
        server.terminate()
        with contextlib.suppress(Exception):
            server.wait(timeout=5)


if __name__ == "__main__":
    run()
