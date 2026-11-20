#!/usr/bin/env node
// Verify the shared selector-style method sheet without replacing payment mocks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root=(process.argv[2]||'http://127.0.0.1:8765').replace(/\/$/,'');
const output=path.join(process.env.RUNNER_TEMP||'/tmp','method-sheet');
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
let failed=false;
try{
 for(const width of [390,430,1440]){
  for(const theme of ['light','dark']){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   try{
    await page.goto(root+'/components/sheet.html#'+theme,{waitUntil:'load'});
    const states=page.locator('section.ds-st');
    assert.equal(await states.count(),2);
    for(let i=0;i<2;i++){
     const section=states.nth(i),list=section.locator('.sheet > .method-list');
     assert.equal(await list.count(),1,'Method list must be one common plate');
     const rows=list.locator(':scope > button.row.method-option');
     assert.equal(await rows.count(),4,'All methods retained, including hidden SBP');
     assert.equal(await list.locator('.rd').count(),0,'No selector radio control');
     assert.equal(await list.locator('.method-chevron').count(),4,'Every method shows chevron');
     assert.equal(await rows.filter({hasText:'USDT'}).count(),1);
     assert.equal(await rows.filter({hasText:'USDC'}).count(),1);
     assert.equal(await rows.filter({hasText:'ALT.VU'}).count(),1);
     assert.equal(await rows.first().getAttribute('data-go'),'dep-sbp');
     const metrics=await list.evaluate(element=>{
      const style=getComputedStyle(element);
      const rows=[...element.querySelectorAll(':scope > .row')];
      const visible=rows.filter(r=>getComputedStyle(r).display!=='none');
      const first=visible[0],icon=first.querySelector('.ri'),logo=icon.querySelector('.cn');
      return {radius:style.borderRadius,bg:style.backgroundColor,
       visible:visible.length,iconWidth:getComputedStyle(icon).width,
       logoWidth:getComputedStyle(logo).width,
       rowMargin:getComputedStyle(first).marginBottom,
       firstDivider:getComputedStyle(first).boxShadow,
       textSize:getComputedStyle(first.querySelector('.rt')).fontSize,
       subtitleLine:getComputedStyle(first.querySelector('.rt i')).lineHeight,
       chevron:!!first.querySelector('.method-chevron'),
       noteInside:!!element.querySelector('.note')
      };
     });
     assert.equal(metrics.radius,'20px');
     assert.notEqual(metrics.bg,'rgba(0, 0, 0, 0)','Plate must be filled');
     assert.equal(metrics.visible,3);
     assert.equal(metrics.iconWidth,'32px');
     assert.equal(metrics.logoWidth,'32px');
     assert.equal(metrics.rowMargin,'0px');
     assert.equal(metrics.firstDivider,'none','First visible method has no divider');
     assert.equal(metrics.textSize,'16px');
     assert.equal(metrics.subtitleLine,'16px');
     assert.ok(metrics.chevron && !metrics.noteInside);
    }
    const disabled=states.nth(1).locator('.method-option.off');
    assert.equal(await disabled.count(),1,'Disabled method retained');
    assert.equal(await disabled.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    await page.screenshot({path:path.join(output,`sheet-${theme}-${width}.png`),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS sheet sample '+theme+' '+width+'px');
   }finally{await page.close();}
  }
 }
 // Real prototype uses the same grouped rows. Preserve existing data-go / bank handlers.
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto(root+'/transfi-remittance/?qa=1',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof show==='function',{timeout:25000});
   for(const [view,count] of [['topup',6],['withdraw',5]]){
    await page.evaluate(view=>show(view,false),view);
    // Bottom-navigation mode mounts these sheets as .ovl above the active page,
    // rather than switching the view to .on.
    await page.locator('#v-'+view+' .sheet .method-list').first().waitFor({state:'visible',timeout:12000});
    const section=page.locator('#v-'+view+' .sheet');
    assert.equal(await section.locator('.method-list').count(),2,'Separate crypto/ALT.VU and bank plates');
    assert.equal(await section.locator('.method-list > button.row.method-option').count(),count);
    assert.equal(await section.locator('.method-list > button.tf-bank-method').count(),2);
    assert.equal(await section.locator('.method-list .rd').count(),0);
    assert.equal(await section.locator('.method-list .method-chevron').count(),count);
    assert.equal(await section.locator('.tf-bank-title').count(),1);
    const states=await section.locator('.method-list > button').evaluateAll(nodes=>nodes.map(n=>({
     go:n.dataset.go||'',bank:n.dataset.tfBank||'',
     tag:n.tagName.toLowerCase(),icon:getComputedStyle(n.querySelector('.ri')).width
    })));
    assert.ok(states.every(x=>x.tag==='button'&&x.icon==='32px'));
    assert.deepEqual(states.filter(x=>x.bank).map(x=>x.bank),['SEPA','SWIFT']);
   }
   await page.evaluate(()=>show('topup',false));
   await page.locator('#v-topup .method-list [data-go="dep-usdt-tron"]').click();
   await page.locator('#v-dep-usdt-tron.on').waitFor({state:'visible',timeout:12000});
   await page.evaluate(()=>show('topup',false));
   await page.locator('#v-topup .method-list [data-tf-bank="SEPA"]').click();
   await page.locator('#tf-bank-overlay').waitFor({state:'visible',timeout:12000});
   assert.deepEqual(errors,[]);
   console.log('PASS live methods and bank handler '+width+'px');
  }finally{await page.close();}
 }
}catch(e){failed=true;console.error('Method sheet regression FAILED',e.stack||e);}
finally{await browser.close();}
if(failed)process.exit(1);
