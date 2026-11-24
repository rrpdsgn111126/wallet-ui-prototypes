#!/usr/bin/env node
// Regression: SBP reuse of bank selection/conversion components, no real payments.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const root=(process.argv[2]||'http://127.0.0.1:8765').replace(/\/$/,'');
const out=path.join(process.env.RUNNER_TEMP||'/tmp','sbp-deposit');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  for(const width of [390,430,1440]){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(root+'/transfi-remittance/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof show==='function'&&typeof sbpOpen==='function');
    await page.evaluate(async()=>{show('dep-sbp',false);await sbpOpen();});
    const v=page.locator('#v-dep-sbp.on');
    await v.waitFor({timeout:15000});
    const bank=v.locator('#sbp-bank');
    assert.equal(await bank.locator('.fl i').innerText(),'Откуда');
    assert.equal(await v.locator('#sbp-cv.sbp-cv.tf-bank-sbp').count(),1);
    assert.equal(await v.locator('#sbp-cv .h').count(),2);
    assert.equal(await v.locator('#sbp-cv .h').first().locator('label').innerText(),'Заплатите');
    assert.equal(await v.locator('#sbp-cv .h').last().locator('label').innerText(),'Зачислим');
    const currencyStyle=await v.locator('#sbp-rub').evaluate(e=>getComputedStyle(e).fontSize);
    assert.equal(currencyStyle,'32px','SBP amount must reuse SWIFT/SEPA amount token');
    await bank.click();
    const sheet=v.locator('#sbp-bank-sheet');
    await sheet.waitFor({state:'visible'});
    assert.equal(await sheet.getAttribute('role'),'dialog');
    assert.equal(await sheet.locator('#sbp-q').getAttribute('placeholder'),'Поиск банка');
    assert.equal(await sheet.locator('.tf-picker-box[role="radiogroup"]').count(),1);
    await sheet.locator('#sbp-q').fill('Т-Банк');
    await page.waitForTimeout(100);
    const list=sheet.locator('.tf-picker-row');
    assert.equal(await list.count(),1,'Search filters bank rows');
    assert.equal(await list.first().locator('.ri.ds-icon-frame').count(),1);
    assert.equal(await list.first().locator('.rd').count(),1);
    await page.screenshot({path:path.join(out,'picker-'+width+'.png')});
    await page.keyboard.press('Escape');
    await sheet.waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>view),'dep-sbp','Escape must not navigate');
    await bank.click();
    await sheet.locator('#sbp-q').fill('Т-Банк');
    await sheet.locator('.tf-picker-row').first().click();
    await sheet.waitFor({state:'hidden'});
    assert.match(await bank.innerText(),/Т-Банк/);
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'sbp-bank');
    await v.locator('#sbp-rub').fill('1500');
    await page.waitForFunction(()=>sbp.rate==='ok'&&Number(document.querySelector('#sbp-usd')?.value.replace(/[^0-9.]/g,''))>0,{timeout:15000});
    assert.equal(await v.locator('#sbp-go').isEnabled(),true,'Payment CTA activates on valid bank quote');
    const layout=await v.locator('#sbp-cv').evaluate(e=>({
      width:e.clientWidth,scroll:e.scrollWidth,
      before:getComputedStyle(e.querySelector('.mid'),'::before').content
    }));
    assert.ok(layout.scroll<=layout.width+1,'Conversion must not overflow horizontally');
    assert.notEqual(layout.before,'none','Shared quote divider must remain present');
    await page.screenshot({path:path.join(out,'form-'+width+'.png')});
    assert.deepEqual(errors,[], 'Uncaught browser errors');
    await context.close();
    console.log('PASS: SBP bank picker, search, quote, payment validation at '+width+'px');
  }
}finally{await browser.close();}
