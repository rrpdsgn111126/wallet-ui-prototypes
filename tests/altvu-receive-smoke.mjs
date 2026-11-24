#!/usr/bin/env node
// ALT.VU top-up UX regression on the *actual* transfi-remittance/index.html.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const root=(process.argv[2]||'http://127.0.0.1:8765').replace(/\/$/,'');
const out=path.join(process.env.RUNNER_TEMP||'/tmp','altvu-receive');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const width of [390,430,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  await context.addInitScript(()=>{
    Object.defineProperty(navigator,'clipboard',{
      configurable:true,value:{writeText:async value=>{window.__testCopied=String(value);}}
    });
    Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
  });
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  await page.goto(root+'/transfi-remittance/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof show==='function'&&!!document.getElementById('v-my-qr'));
  // Navigate with the actual wallet router (not a copied specimen).
  await page.evaluate(()=>show('my-qr',false));
  await page.locator('#v-my-qr.on').waitFor({timeout:15000});
  // The route is rendered synchronously; loadMyQR is an async screen hook.
  // Invoke it explicitly so this isolated UX test does not depend on
  // application bootstrap timing or a prior authenticated navigation.
  const loaded=await page.evaluate(async()=>loadMyQR(false));
  if(!loaded){
    const detail=await page.evaluate(()=>({
      screen:view,preview:altPreview,
      api:typeof pvApi,pay:myPay,message:document.querySelector('#toast .tt')?.textContent
    }));
    throw new Error('ALT.VU QR fixture did not load: '+JSON.stringify(detail));
  }
  await page.waitForFunction(()=>typeof myPay!=='undefined'&&!!myPay?.url);
  const v=page.locator('#v-my-qr');
  assert.equal(await v.locator('.h1').innerText(),'Пополнение ALT.VU');
  assert.match(await v.locator('.qr-intro').innerText(),/другому пользователю ALT\.VU/);
  assert.equal(await v.locator('.qr-cap').count(),0,'Redundant QR caption is removed');
  assert.equal(await v.locator('.qrw + .qr-intro').count(),1,'Instruction follows QR');
  assert.equal(await v.locator('.qrbox + .qr-renew .qr-rotate').count(),1,'Renew action follows instruction');
  assert.equal(await v.locator('.qr-intro').evaluate(e=>getComputedStyle(e).fontSize),'16px');
  assert.equal(await v.locator('.qr-email-copy svg').count(),1,'Bank copy icon is present');
  assert.equal(await v.locator('.qr-email-copy').innerText(),'','Copy action has no visible text');
  assert.equal(await v.locator('.qr-email-copy').evaluate(e=>getComputedStyle(e).width),'36px');
  assert.equal(await v.locator('.qr-copy').count(),0,'Obsolete bottom copy link was removed');
  assert.equal(await v.locator('.qr-share').count(),1,'One bottom primary action');
  assert.equal(await v.locator('.qr-email-field.fld.w').count(),1,
    'Email must reuse the canonical .fld.w input component');
  const email=v.locator('#qr-email');
  assert.equal(await email.getAttribute('readonly'),'','Email is readonly');
  assert.equal(await email.getAttribute('type'),'email');
  assert.equal(await email.evaluate(e=>getComputedStyle(e.closest('.fld')).height),'68px');
  assert.equal(await email.evaluate(e=>getComputedStyle(e).fontSize),'16px');
  assert.equal(await v.locator('.qr-email-copy').count(),1);
  const initial=await page.evaluate(()=>myPay.url);
  await v.locator('.qr-rotate').click();
  await v.locator('.qr-rotate-sheet').waitFor({state:'visible'});
  assert.match(await v.locator('#qr-rotate-desc').innerText(),/Старая ссылка перестанет работать/);
  assert.equal(await v.locator('.qr-rotate-yes').innerText(),'Да, обновить');
  assert.equal(await v.locator('.qr-rotate-no').innerText(),'Нет, оставить');
  await page.screenshot({path:path.join(out,'confirm-'+width+'.png')});
  await v.locator('.qr-rotate-no').click();
  assert.equal(await page.evaluate(()=>myPay.url),initial,'Cancel must not rotate URL');
  await v.locator('.qr-rotate').click();
  await page.keyboard.press('Escape');
  assert.equal(await v.locator('.qr-rotate-sheet').isVisible(),false,'Escape closes confirmation');
  assert.equal(await page.evaluate(()=>myPay.url),initial,'Escape must not rotate URL');
  await v.locator('.qr-rotate').click();
  const dimProbe=await v.locator('.qr-rotate-dim').evaluate(el=>{
    const b=el.getBoundingClientRect();
    const x=b.left+b.width/2,y=b.top+Math.min(32,b.height*0.1);
    const target=document.elementFromPoint(x,y);
    return {x,y,rect:[b.left,b.top,b.width,b.height],
      hit:target?.className||target?.tagName,
      dimDisplay:getComputedStyle(el).display,
      pointer:getComputedStyle(el).pointerEvents};
  });
  console.log('ALT.VU modal backdrop hit test',JSON.stringify(dimProbe));
  await page.mouse.click(dimProbe.x,dimProbe.y);
  assert.equal(await v.locator('.qr-rotate-sheet').isVisible(),false,'Backdrop closes confirmation');
  await v.locator('.qr-rotate').click();
  await v.locator('.qr-rotate-yes').click();
  await page.waitForFunction(previous=>myPay.url!==previous,initial);
  const rotated=await page.evaluate(()=>myPay.url);
  assert.notEqual(rotated,initial,'Confirmed rotation changes demo link');
  assert.equal(await v.locator('.qr-rotate-sheet').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('qr-rotate')),true,
    'Focus returns to the link after confirmed rotation');
  assert.equal(await v.locator('.qr-share').isDisabled(),false);
  // Existing readonly email field has an independent copy action.
  await page.evaluate(()=>{
    const input=document.getElementById('qr-email');
    if(!input.value) input.value='demo@alt.vu';
    qrUpdateControls();
  });
  const expectedMail=await email.inputValue();
  await v.locator('.qr-email-copy').click();
  assert.equal(await page.evaluate(()=>window.__testCopied),expectedMail,
    'Copy in readonly field copies email, not payment link');
  await v.locator('.qr-share').click();
  assert.equal(await page.evaluate(()=>window.__testCopied),rotated,
    'Share fallback sends new payment URL');
  const size=await v.locator('.qr-email-field').evaluate(el=>({
    scroll:el.scrollWidth,client:el.clientWidth}));
  assert.ok(size.scroll<=size.client+1,'No horizontal clipping in email component');
  await page.screenshot({path:path.join(out,'receive-'+width+'.png')});
  assert.deepEqual(errors,[],'No unhandled JavaScript errors');
  await context.close();
  console.log('PASS ALT.VU QR top-up, readonly email, cancellation/rotation/share '+width+'px');
 }
}finally{
 await browser.close();
}
