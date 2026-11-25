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
    assert.equal(await v.locator('#sbp-cv .h').first().locator('label').innerText(),'Заплатить');
    assert.equal(await v.locator('#sbp-cv .h').last().locator('label').innerText(),'Зачислим');
    const currencyStyle=await v.locator('#sbp-rub').evaluate(e=>getComputedStyle(e).fontSize);
    assert.equal(currencyStyle,'32px','SBP amount must reuse SWIFT/SEPA amount token');
    // Regression: a missing --surface in wallet LIGHT theme must NOT remove
    // the conversion card, search surface, or the option-list container.
    const cardBG=await v.locator('#sbp-cv').evaluate(e=>getComputedStyle(e).backgroundColor);
    assert.equal(cardBG,'rgb(255, 255, 255)','SBP conversion retains white card surface');
    const cardShadow=await v.locator('#sbp-cv').evaluate(e=>getComputedStyle(e).boxShadow);
    assert.notEqual(cardShadow,'none','SBP conversion retains surface shadow');
    await bank.click();
    const sheet=v.locator('#sbp-bank-sheet');
    await sheet.waitFor({state:'visible'});
    assert.equal(await sheet.getAttribute('role'),'dialog');
    assert.equal(await sheet.locator('#sbp-q').getAttribute('placeholder'),'Поиск банка');
    assert.equal(await sheet.locator('.tf-picker-box[role="radiogroup"]').count(),1);
    for(const selector of ['.sbp-bank-search','.sbp-picker-box']){
      const bg=await sheet.locator(selector).evaluate(e=>getComputedStyle(e).backgroundColor);
      assert.equal(bg,'rgb(255, 255, 255)',selector+' uses canonical white surface');
    }
    const clear=sheet.locator('.sbp-bank-search > .ds-clear-slot > button.ds-field-clear');
    assert.equal(await clear.count(),1,'Use only canonical field-clear icon');
    await sheet.locator('#sbp-q').fill('Т-Банк');
    await page.waitForTimeout(100);
    const list=sheet.locator('.tf-picker-row');
    assert.equal(await list.count(),1,'Search filters bank rows');
    assert.equal(await clear.isVisible(),true,'Canonical search clear appears with text');
    await clear.click();
    assert.equal(await sheet.locator('#sbp-q').inputValue(),'','Canonical clear empties search');
    assert.equal(await list.count(),3,'Clearing search restores full bank list');
    assert.equal(await clear.isVisible(),false,'One clear hides when search is empty');
    await sheet.locator('#sbp-q').fill('Т-Банк');

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
    const layout=await v.locator('#sbp-cv').evaluate(e=>{
      const box=e.getBoundingClientRect(), sy=box.height/e.offsetHeight;
      const label=e.querySelector('.h:first-child label').getBoundingClientRect();
      const amount=e.querySelector('#sbp-usd').getBoundingClientRect();
      return {width:e.clientWidth,scroll:e.scrollWidth,
        before:getComputedStyle(e.querySelector('.mid'),'::before').content,
        top:(label.top-box.top)/sy,bottom:(box.bottom-amount.bottom)/sy};
    });
    assert.ok(Math.abs(layout.top-16)<=1 && Math.abs(layout.bottom-16)<=1,
      'SBP label and receive amount must have matching 16px outer insets: '+JSON.stringify(layout));
    assert.ok(layout.scroll<=layout.width+1,'Conversion must not overflow horizontally');
    assert.notEqual(layout.before,'none','Shared quote divider must remain present');
    await page.screenshot({path:path.join(out,'form-'+width+'.png')});
    await page.evaluate(()=>show('vpick',false));
    const geo=page.locator('#v-vpick');
    const geoInput=geo.locator('#ve-q');
    await geoInput.fill('Германия');
    const geoClear=geo.locator('.ve-search > .ds-clear-slot > button.ds-field-clear');
    assert.equal(await geoClear.count(),1,'Region search reuses canonical clear');
    assert.equal(await geoClear.isVisible(),true);
    await geoClear.click();
    assert.equal(await geoInput.inputValue(),'');
    assert.equal(await geoClear.isVisible(),false);

    // Cross-component spacing measurement at the same real viewport width:
    // conversion divider vs canonical From/To divider. No copied components.
    const sbpSpec=await context.newPage();
    await sbpSpec.goto(root+'/transfi-remittance/index.html?component=sbp-conversion&filled=1',
      {waitUntil:'domcontentloaded'});
    await sbpSpec.waitForFunction(()=>document.documentElement.dataset.sbpSpecimenReady==='1');
    const sbpCard=sbpSpec.locator('#v-dep-sbp.on #sbp-cv');
    await sbpCard.waitFor({state:'visible'});
    assert.equal(await sbpSpec.locator('#v-dep-sbp.on .head:visible').count(),0,
      'SBP specimen has no app navigation');
    assert.equal(await sbpSpec.locator('#sbp-bank:visible').count(),0,
      'SBP specimen renders card only');
    assert.equal(await sbpSpec.locator('#sbp-cv.tf-bank-sbp').count(),1);
    assert.match((await sbpSpec.locator('#sbp-rub').inputValue()).replace(/\s/g,''),/^5000(?:[.]00)?$/,'SBP specimen uses actual populated amount');
    const fxSpec=await context.newPage();
    await fxSpec.goto(root+'/transfi-remittance/legacy.html?component=amount-conversion&filled=1',
      {waitUntil:'domcontentloaded'});
    await fxSpec.locator('#tf-bank-sbp').waitFor({state:'visible'});
    assert.equal(await fxSpec.locator('#tf-bank-use-all').count(),1,'Withdrawal has use-all action');
    const routeSpec=await context.newPage();
    await routeSpec.goto(root+'/transfi-remittance/legacy.html?component=route-card&rail=SWIFT&kind=country',
      {waitUntil:'domcontentloaded'});
    await routeSpec.locator('.tf-bank-route-card .tf-bank-arrow').waitFor({state:'visible'});
    const conversionMeasure=async(p,card,upper,lower,pill,divider)=>p.evaluate(({card,upper,lower,pill,divider})=>{
      const host=document.querySelector(card);
      const up=host.querySelector(upper).getBoundingClientRect();
      const down=host.querySelector(lower).getBoundingClientRect();
      const cap=host.querySelector(pill).getBoundingClientRect();
      const mid=host.querySelector(divider).getBoundingClientRect();
      const lineY=mid.top+mid.height/2;
      return {
        upperToPill:Math.round(cap.top-up.bottom),
        pillToLower:Math.round(down.top-cap.bottom),
        upperToDivider:Math.round(lineY-up.bottom),
        dividerToLower:Math.round(down.top-lineY)
      };
    },{card,upper,lower,pill,divider});
    const sbpGaps=await conversionMeasure(sbpSpec,'#sbp-cv','.h:first-child .t input',
      '.h:last-child .t label','.sbp-rate','.mid');
    const fxGaps=await conversionMeasure(fxSpec,'#tf-bank-sbp','.h:first-child .t input',
      '.h + .mid + .h .tf-bank-receive-label','.sbp-rate','.mid');
    const routeGaps=await conversionMeasure(routeSpec,'.tf-bank-route-card',
      '.tf-bank-leg:first-child .fl b','.tf-bank-leg:last-child .fl i',
      '.tf-bank-arrow','.tf-bank-arrow-line');
    console.log('AMOUNT/ROUTE SPACING '+width+'px '+JSON.stringify({sbpGaps,fxGaps,routeGaps}));
    for(const [name,gap] of Object.entries({sbpGaps,fxGaps})){
      assert.ok(Math.abs(gap.upperToPill-8)<=2,name+' top number to capsule: 8px');
      assert.ok(Math.abs(gap.pillToLower-8)<=2,name+' capsule to lower label: 8px');
      assert.ok(Math.abs(gap.upperToDivider-24)<=2,name+' top number to divider: 24px');
      assert.ok(Math.abs(gap.dividerToLower-24)<=2,name+' divider to lower label: 24px');
    }
    assert.ok(Math.abs(routeGaps.upperToPill-8)<=2,'From/To top value to capsule: 8px');
    assert.ok(Math.abs(routeGaps.pillToLower-8)<=2,'From/To capsule to lower label: 8px');
    assert.ok(Math.abs(routeGaps.upperToDivider-24)<=2,'From/To top value to divider: 24px');
    assert.ok(Math.abs(routeGaps.dividerToLower-24)<=2,'From/To divider to lower label: 24px');
    assert.deepEqual(routeGaps,fxGaps,'From/To and FX match both capsule and divider gaps');
    await sbpSpec.screenshot({path:path.join(out,'sbp-component-'+width+'.png')});
    await fxSpec.screenshot({path:path.join(out,'bank-component-'+width+'.png')});
    await routeSpec.screenshot({path:path.join(out,'route-component-'+width+'.png')});
    await sbpSpec.close();await fxSpec.close();await routeSpec.close();
    assert.deepEqual(errors,[], 'Uncaught browser errors');
    await context.close();
    console.log('PASS: SBP bank picker, search, quote, payment validation at '+width+'px');
  }
}finally{await browser.close();}
