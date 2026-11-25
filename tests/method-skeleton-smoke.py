#!/usr/bin/env python3
"""Playwright: skeleton in the existing Top up/Withdraw method bottom sheets.

No real payments or provider calls. Runs with the staged canonical DS and
the experiment's local preview only.
"""
from __future__ import annotations

import contextlib
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "withdraw-route"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8772
BASE = f"http://127.0.0.1:{PORT}/transfi-remittance/"

def ready():
    for _ in range(80):
        try:
            with urllib.request.urlopen(BASE, timeout=1):
                return
        except Exception:
            time.sleep(.2)
    raise RuntimeError("Experimental preview server unavailable")

def wait_init(page):
    page.wait_for_function(
        "window.altMethodSkeleton && window.altWithdrawRouteExperiment "
        "&& typeof show==='function' && document.querySelector('#v-home.on')",
        timeout=30000,
    )

def check_skeleton(page, direction, dark, moving):
    page.evaluate("(v) => show(v,false)", direction)
    root = page.locator(f"#v-{direction}")
    sheet = root.locator(".sheet")
    expect(root).to_have_class(re.compile(r"method-skeleton-loading"), timeout=3000)
    expect(sheet).to_have_attribute("aria-busy", "true")
    expect(root.locator(".method-list")).to_have_count(2)
    assert root.locator(".method-list > button.method-option").count() == (
        6 if direction == "topup" else 5
    )
    for box in root.locator(".method-list").all():
        assert box.evaluate("(el) => el.inert"), "Option list must be inert during loading"
    first = root.locator(".method-list .method-option:visible").first
    geom = first.evaluate("""el => {
        const r=el.getBoundingClientRect(),
              icon=el.querySelector('.ic'),
              circle=getComputedStyle(icon,'::after'),
              b=getComputedStyle(el.querySelector('.mt b'),'::after'),
              i=getComputedStyle(el.querySelector('.mt i'),'::after');
        return {height:parseFloat(getComputedStyle(el).height), iconWidth:parseFloat(getComputedStyle(icon).width),
                circle:circle.content, radius:circle.borderRadius,
                iconBackground:circle.backgroundImage, shimmer:circle.animationName,
                titleHeight:parseFloat(b.height), subtitleHeight:parseFloat(i.height),
                titleBackground:b.backgroundImage, subtitleBackground:i.backgroundImage};
    }""")
    assert geom["height"] >= 60, geom
    assert geom["iconWidth"] >= 30, geom
    assert geom["circle"] not in ("none", "normal"), geom
    assert geom["radius"] == "50%", geom
    assert "gradient" in geom["iconBackground"], geom
    assert geom["titleHeight"] >= 10 and geom["subtitleHeight"] >= 10, geom
    assert "gradient" in geom["titleBackground"] and "gradient" in geom["subtitleBackground"], geom
    if moving:
        assert geom["shimmer"] == "method-skeleton-wave", geom
    else:
        assert geom["shimmer"] == "none", geom
    expect(root.locator(".sh2")).to_be_visible()
    expect(root.locator(".tf-bank-title")).to_be_visible()
    start_height = first.evaluate("(el) => el.getBoundingClientRect().height")
    page.screenshot(path=str(OUT / f"methods-skeleton-{direction}-{'dark' if dark else 'light'}-{page.viewport_size['width']}.png"))
    page.wait_for_function("(kind) => !window.altMethodSkeleton.isLoading(kind)", arg=direction, timeout=6000)
    expect(sheet).not_to_have_attribute("aria-busy", "true")
    assert not root.locator(".method-list").first.evaluate("(el) => el.inert")
    assert first.evaluate("(el) => el.getBoundingClientRect().height") == start_height, (
        "Skeleton changed the row height"
    )
    expect(first.locator(".mt b")).not_to_be_empty()
    assert first.evaluate("""el => {
        return getComputedStyle(el.querySelector('.mt b')).color !== 'rgba(0, 0, 0, 0)';
    }"""), "Method title remains transparent after loading"
    page.screenshot(path=str(OUT / f"methods-ready-{direction}-{'dark' if dark else 'light'}-{page.viewport_size['width']}.png"))
    return geom

def run():
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT
    )
    try:
        ready()
        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel="chrome", headless=True, args=["--no-sandbox"])
            for width in (390, 430, 1440):
                for dark in (False, True):
                    ctx = browser.new_context(
                        viewport={"width": width, "height": 900}, reduced_motion="no-preference"
                    )
                    page = ctx.new_page()
                    errors = []
                    page.on("pageerror", lambda err: errors.append(str(err)))
                    page.goto(BASE + "?skeleton=demo", wait_until="domcontentloaded")
                    wait_init(page)
                    if dark:
                        page.evaluate("document.documentElement.classList.add('dark')")
                    for direction in ("topup", "withdraw"):
                        check_skeleton(page, direction, dark, moving=True)
                    # A stale async completion must never revive a dismissed overlay.
                    page.evaluate("show('topup',false)")
                    expect(page.locator("#v-topup")).to_have_class(re.compile("method-skeleton-loading"))
                    page.evaluate("show('withdraw',false)")
                    assert not page.evaluate("altMethodSkeleton.isLoading('topup')")
                    assert page.evaluate("altMethodSkeleton.isLoading('withdraw')")
                    page.evaluate("show('home',false)")
                    assert not page.evaluate("altMethodSkeleton.isLoading('withdraw')")
                    page.wait_for_timeout(1650)
                    assert not page.evaluate("altMethodSkeleton.isLoading('topup') || altMethodSkeleton.isLoading('withdraw')")
                    assert errors == [], (width, dark, errors)
                    ctx.close()
                    print(f"PASS method skeleton: topup/withdraw, {'dark' if dark else 'light'}, {width}px")
            # Normal mode: only the first opening loads, re-entry is instant.
            ctx = browser.new_context(viewport={"width": 390, "height": 900})
            page = ctx.new_page()
            page.goto(BASE, wait_until="domcontentloaded")
            wait_init(page)
            check_skeleton(page, "topup", False, moving=True)
            page.evaluate("show('home',false);show('topup',false)")
            assert not page.evaluate("altMethodSkeleton.isLoading('topup')"), "Cached methods show no skeleton"
            ctx.close()
            # Reduced-motion preference retains placeholders but stops shimmer.
            ctx = browser.new_context(
                viewport={"width": 390, "height": 900}, reduced_motion="reduce"
            )
            page = ctx.new_page()
            page.goto(BASE + "?skeleton=demo", wait_until="domcontentloaded")
            wait_init(page)
            check_skeleton(page, "topup", False, moving=False)
            ctx.close()
            browser.close()
        print("PASS: canonical method DOM, skeleton surfaces and shimmer, cache, cancel, reduced motion")
    finally:
        server.terminate()
        with contextlib.suppress(Exception):
            server.wait(timeout=5)

if __name__ == "__main__":
    run()
