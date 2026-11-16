#!/usr/bin/env python3
"""Export actual TransFi UI states with Playwright, no mockup reconstruction."""
import asyncio, json, re
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from urllib.parse import urlencode
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[2]
DEST=ROOT/"exports"/"transfi-flows-2026-11-16"
FLOWS=[
 ("01_SEPA_Deposit","in","SEPA"),
 ("02_SEPA_Withdrawal","out","SEPA"),
 ("03_SWIFT_Deposit","in","SWIFT"),
 ("04_SWIFT_Withdrawal","out","SWIFT"),
]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass

async def main():
 server=ThreadingHTTPServer(("127.0.0.1",0),partial(Quiet,directory=str(ROOT)))
 Thread(target=server.serve_forever,daemon=True).start()
 origin="http://127.0.0.1:"+str(server.server_port)
 manifest=[]
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(headless=True,args=["--no-sandbox"])
   try:
    for folder,flow,rail in FLOWS:
     out=DEST/folder;out.mkdir(parents=True,exist_ok=True)
     params=urlencode({"capture":"1","embedded":"1","flow":flow,"rail":rail,"screen":"in-details" if flow=="in" else "out-config"})
     page=await browser.new_page(viewport={"width":430,"height":932},device_scale_factor=1,reduced_motion="reduce")
     await page.goto(origin+"/transfi-remittance/legacy.html?"+params,wait_until="load")
     await page.evaluate("document.fonts.ready")
     await page.wait_for_timeout(450)
     phone=page.locator(".phone.tf-phone")
     async def snap(name):
      await page.wait_for_timeout(125)
      await phone.screenshot(path=str(out/name),animations="disabled")
      manifest.append({"flow":folder,"file":name,"screen":await page.evaluate("S.screen"),"rail":rail})
      print("CAPTURE",folder,name,flush=True)
     if flow=="in":
      await snap("01_Bank_requisites.png")
      if rail=="SWIFT":
       await page.locator('[data-picker="inCurrency"]').click()
       await page.wait_for_timeout(750)
       await snap("02_Currency_picker.png")
       await page.locator('[data-picker-value="GBP"]').click()
       await snap("03_Bank_requisites_GBP.png")
      await page.evaluate("go('in-pending')")
      await snap("04_Waiting_for_deposit.png")
      await page.evaluate("go('in-success')")
      await snap("05_Deposit_success.png")
      await page.evaluate("go('in-held')")
      await snap("06_Deposit_under_review.png")
     else:
      await snap("01_Amount_configuration_empty.png")
      await page.locator("#tf-out-amount").fill("100")
      await snap("02_Amount_configuration_filled.png")
      await page.locator('[data-picker="country"]').click()
      await page.wait_for_timeout(750)
      await snap("03_Country_picker.png")
      await page.locator('[data-picker-value="DE"]').click()
      if rail=="SWIFT":
       await page.locator('[data-picker="outCurrency"]').click()
       await page.wait_for_timeout(750)
       await snap("04_Currency_picker.png")
       await page.locator('[data-picker-value="GBP"]').click()
       await snap("05_Amount_GBP.png")
      await page.evaluate("go('out-recipient')")
      await snap("06_Recipient_empty.png")
      await page.locator("#f-recipientName").fill("Иван Иванов")
      if rail=="SEPA":
       await page.locator("#f-iban").fill("DE00 0000 0000 0000 0000 00")
      else:
       await page.locator("#f-account").fill("000000000000")
       await page.locator("#f-bic").fill("DEMOXXXX")
       await page.locator("#f-bank").fill("Банк-партнёр")
      await snap("07_Recipient_completed.png")
      details=page.locator("details.tf-recipient-extra")
      if await details.count():
       await details.locator("summary").click()
       await snap("08_Additional_optional_fields.png")
       await details.locator("summary").click()
      await page.evaluate("go('out-review')")
      await snap("09_Review_transfer.png")
      await page.evaluate("go('out-progress')")
      await snap("10_Transfer_processing.png")
      await page.evaluate("go('out-success')")
      await snap("11_Transfer_success.png")
      await page.evaluate("go('out-failed')")
      await snap("12_Transfer_failed.png")
      await page.evaluate("go('out-held')")
      await snap("13_Transfer_held.png")
      await page.evaluate("go('out-unavailable')")
      await snap("14_Transfer_unavailable.png")
     await page.close()
   finally: await browser.close()
 finally:
  server.shutdown();server.server_close()
 DEST.mkdir(parents=True,exist_ok=True)
 (DEST/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 print("SCREENSHOTS_TOTAL",len(manifest),flush=True)

if __name__=="__main__":
 asyncio.run(main())
