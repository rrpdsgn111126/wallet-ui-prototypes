#!/usr/bin/env python3
"""Regression of the shared USDT/USDC network confirmation in local preview."""
import asyncio
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.async_api import async_playwright, expect

ROOT=Path(__file__).resolve().parents[2]

async def swipe(page, fraction):
    slider=page.locator(".wd-confirm-slide")
    await expect(slider).to_be_visible()
    thumb=slider.locator(".wd-slide-thumb")
    await slider.scroll_into_view_if_needed()
    await page.wait_for_timeout(250)
    a=await slider.bounding_box()
    b=await thumb.bounding_box()
    x=b["x"]+b["width"]/2
    y=b["y"]+b["height"]/2
    await page.mouse.move(x,y)
    await page.mouse.down()
    scale=await slider.evaluate("(el)=>el.getBoundingClientRect().width/el.offsetWidth")
    await page.mouse.move(x+(a["width"]-b["width"]-8*scale)*fraction,y,steps=12)
    await page.mouse.up()

async def test(browser, origin, width):
    page=await browser.new_page(viewport={"width":width,"height":932})
    print(f"Testing network confirmation at {width}px", flush=True)
    errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    await page.goto(origin+"/transfi-remittance/")
    await expect(page.locator("#v-home.on")).to_be_visible(timeout=30000)
    sheet=page.locator(".wd-network-confirm")
    for coin,network,other in [("usdt","tron","bnb"),("usdc","polygon","bnb")]:
        vid="out-"+coin+"-"+network
        other_vid="out-"+coin+"-"+other
        await page.evaluate("async v=>{show(v);await afterShow(v)}",vid)
        root=page.locator("#v-"+vid)
        await expect(sheet).to_be_visible()
        await expect(sheet.locator("[data-confirm-coin]")).to_have_text(coin.upper())
        assert await root.locator(".hint").count()==0
        assert await root.locator(".wd-note").count()==1
        await page.wait_for_timeout(750)
        await swipe(page,.4)
        await expect(sheet).to_be_visible()
        await swipe(page,1)
        await expect(sheet).to_have_count(0)
        addr=root.locator(".wd-addr")
        await addr.fill("DEMO_ADDRESS_NEVER_SEND_FUNDS")
        await page.evaluate("async k=>{await netPick(k)}",other)
        await expect(sheet).to_be_visible()
        await expect(sheet.locator("[data-confirm-network]")).to_have_text("BEP-20")
        await page.keyboard.press("Escape")
        await expect(sheet).to_have_count(0)
        await expect(root).to_have_class(__import__("re").compile(r"\bon\b"))
        await expect(addr).to_have_value("DEMO_ADDRESS_NEVER_SEND_FUNDS")
        await page.evaluate("async k=>{await netPick(k)}",other)
        await expect(sheet).to_be_visible()
        await page.locator(".wd-confirm-slide").focus()
        await page.keyboard.press("Enter")
        newroot=page.locator("#v-"+other_vid+".on")
        await expect(newroot).to_be_visible()
        await expect(newroot.locator(".wd-addr")).to_have_value("")
        await expect(sheet).to_have_count(0)
        await page.evaluate("async k=>{await netPick(k)}",other)
        await expect(sheet).to_have_count(0)
        await page.evaluate("()=>show('home',false)")
        await page.evaluate("v=>show(v)",vid)
        await expect(sheet).to_be_visible()
        await page.keyboard.press("Escape")
        await expect(sheet).to_have_count(0)
        await expect(page.locator("#v-withdraw.on, #v-withdraw.ovl")).to_be_visible()
        await page.evaluate("()=>show('home',false)")
    assert not errors, errors
    await page.close()

async def main():
    server=ThreadingHTTPServer(("127.0.0.1",0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch()
            for width in (390,430,1440):
                await test(browser,"http://127.0.0.1:"+str(server.server_port),width)
            await browser.close()
    finally:
        server.shutdown()
    print("PASS: USDT/USDC network confirmation, cancel, reentry and swipe at 390/430/1440 px")

if __name__=="__main__":
    asyncio.run(main())
