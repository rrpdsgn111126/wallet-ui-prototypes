#!/usr/bin/env python3
"""Capture the original-wallet entry and receipt for each SEPA/SWIFT bank flow."""
import asyncio,json
from pathlib import Path
from functools import partial
from threading import Thread
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"exports"/"transfi-flows-2026-11-16"
CASES=[
 ("01_SEPA_Deposit","in","SEPA","pv-sepa-in-001"),
 ("02_SEPA_Withdrawal","out","SEPA","pv-sepa-out-002"),
 ("03_SWIFT_Deposit","in","SWIFT","pv-swift-in-003"),
 ("04_SWIFT_Withdrawal","out","SWIFT","pv-swift-out-004")
]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
async def main():
 server=ThreadingHTTPServer(("127.0.0.1",0),partial(Quiet,directory=str(ROOT)))
 Thread(target=server.serve_forever,daemon=True).start()
 origin="http://127.0.0.1:"+str(server.server_port)
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(headless=True,args=["--no-sandbox"])
   try:
    for folder,flow,rail,opid in CASES:
     out=OUT/folder;out.mkdir(parents=True,exist_ok=True)
     page=await browser.new_page(viewport={"width":430,"height":932},device_scale_factor=1,reduced_motion="reduce")
     await page.goto(origin+"/transfi-remittance/?qa=1",wait_until="domcontentloaded")
     await expect(page.locator("#v-home.on")).to_be_visible(timeout=30000)
     await page.evaluate("document.fonts.ready")
     await page.wait_for_timeout(500)
     await page.locator('.bnv [data-mb="'+("topup" if flow=="in" else "withdraw")+'"]').click()
     await page.wait_for_timeout(550)
     await page.screenshot(path=str(out/"00_Method_selection.png"),animations="disabled")
     print("ENTRY",folder,flush=True)
     # Close the native wallet method sheet, open its own transaction-history example.
     await page.evaluate("() => {if(typeof bnvSheetClose==='function') bnvSheetClose(); show('home',false)}")
     entry=page.locator('#v-home .op[data-id="'+opid+'"]')
     await expect(entry).to_be_visible()
     await entry.click()
     await expect(page.locator("#v-details.on")).to_be_visible()
     await page.screenshot(path=str(out/"15_Operation_details.png"),animations="disabled")
     await page.locator("#d-receipt").click()
     await expect(page.locator("#v-receipt.on")).to_be_visible()
     await page.screenshot(path=str(out/"16_Operation_receipt.png"),animations="disabled")
     print("DETAILS_RECEIPT",folder,flush=True)
     await page.close()
   finally:await browser.close()
 finally:server.shutdown();server.server_close()

if __name__=="__main__":
 asyncio.run(main())
