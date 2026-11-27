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
    assert.equal(await states.count(),3,'Normal, disabled, and navigation loading specimens');
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
    const loading=states.nth(2).locator('.method-option.nav-loading-slot');
    assert.equal(await loading.count(),1,'Method loading row must be a real method-option');
    assert.equal(await loading.getAttribute('aria-busy'),'true');
    assert.equal(await loading.locator(':scope > .spin.nav-spinner').count(),1);
    assert.equal(await loading.locator(':scope > svg.method-chevron').count(),1);
    const center=await loading.evaluate(el=>{
      const s=el.querySelector('.nav-spinner').getBoundingClientRect();
      const c=el.querySelector('.method-chevron').getBoundingClientRect();
      const css=getComputedStyle(el.querySelector('.method-chevron'));
      return {deltaX:Math.abs((s.left+s.right)/2-(c.left+c.right)/2),
        deltaY:Math.abs((s.top+s.bottom)/2-(c.top+c.bottom)/2),
        hidden:css.visibility==='hidden',size:getComputedStyle(el.querySelector('.nav-spinner')).width};
    });
    assert.ok(center.deltaX<=2&&center.deltaY<=2&&center.hidden&&center.size==='22px',
      'Loading spinner must replace the chevron without shifting its slot');
    await page.screenshot({path:path.join(output,`sheet-${theme}-${width}.png`),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS sheet sample '+theme+' '+width+'px');
   }finally{await page.close();}
  }
 }
 // Canonical coin/network frames must be identical in the UI Kit, including
 // rail artwork, history, compact lists and dark/light semantic plate colors.
 for (const width of [390,430,1440]) {
  for (const theme of ['light','dark']) {
   const page=await browser.newPage({viewport:{width,height:932},reducedMotion:'reduce'});
   try {
    await page.goto(root+'/components/coins.html#'+theme,{waitUntil:'load'});
    const values=await page.evaluate(()=>{
      const root=document.querySelector('.phone');
      const unit=selector=>{
        const el=document.querySelector(selector);const css=getComputedStyle(el);
        return {width:css.width,height:css.height,bg:css.backgroundColor};
      };
      const coins=[...document.querySelectorAll('.ds-cn > .ds-icon-frame')];
      const regular=coins.map(el=>{
        const css=getComputedStyle(el),child=el.querySelector('img,.tf-rail-mark,.nlg');
        return {width:css.width,height:css.height,bg:css.backgroundColor,
          childWidth:getComputedStyle(child).width,childHeight:getComputedStyle(child).height};
      });
      return {token:getComputedStyle(root).getPropertyValue('--coin-plate').trim(),
        regular,railMark:unit('.tf-rail-icon .tf-rail-mark'),
        railGlyph:unit('.tf-rail-icon .tf-rail-glyph'),
        history:unit('.ds-cn .cic.usdt.oicoin')};
    });
    const expectedBg=theme==='dark'?'rgb(35, 34, 33)':'rgb(233, 236, 240)';
    assert.equal(values.regular.length,10,'Expected six currencies/rails and four networks');
    for(const item of values.regular){
      assert.deepEqual([item.width,item.height,item.bg,item.childWidth,item.childHeight],
        ['32px','32px',expectedBg,'20px','20px'],
        'Coin/network icon frame must use 32/20 and one plate color');
    }
    assert.equal(values.history.bg,expectedBg);
    assert.deepEqual([values.railMark.width,values.railMark.height],['20px','20px']);
    assert.deepEqual([values.railGlyph.width,values.railGlyph.height],['14px','14px']);
    assert.equal(await page.locator('.ds-icon-frame--hero, .ds-icon-frame--compact').count(),0);
    assert.deepEqual([values.history.width,values.history.height],['32px','32px']);
    await page.screenshot({path:path.join(output,`coins-${theme}-${width}.png`)});
    await page.goto(root+'/components/sheet.html#'+theme,{waitUntil:'load'});
    for(const icon of await page.locator('.method-list .cn.ds-icon-frame').all()){
      const metrics=await icon.evaluate(node=>{
        const a=getComputedStyle(node),img=getComputedStyle(node.querySelector('img'));
        return [a.width,a.height,a.backgroundColor,img.width,img.height];
      });
      assert.deepEqual(metrics,['32px','32px',expectedBg,'20px','20px'],
        'Compact method icon must use 32/20 canonical plate');
    }
    await page.goto(root+'/components/netpick.html#'+theme,{waitUntil:'load'});
    for(const icon of await page.locator('.fi.ds-icon-frame').all()){
      const metrics=await icon.evaluate(node=>{
        const a=getComputedStyle(node),nlg=getComputedStyle(node.querySelector('.nlg'));
        return {size:a.width,height:a.height,plate:a.backgroundColor,art:nlg.backgroundSize};
      });
      assert.equal(metrics.size,'32px');
      assert.equal(metrics.height,'32px');
      assert.equal(metrics.plate,expectedBg);
      assert.ok(metrics.art.startsWith('100%'),'Nested network image must fill 20px artwork slot');
    }
    console.log('PASS framed icons '+theme+' '+width+'px');
   } finally{await page.close();}
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
    // The live compiled bank list contains its own .tf-bank-icon markup.
    // Assert its computed geometry equals USDT/USDC in BOTH sheets.
    const bankIcons=await section.locator('.method-list > .tf-bank-method').evaluateAll(nodes=>
      nodes.map(row=>{
        const icon=row.querySelector('.tf-bank-icon');
        const mark=icon.querySelector('.tf-bank-mark');
        const glyph=mark.querySelector('.tf-bank-glyph');
        const css=e=>getComputedStyle(e);
        return {rail:row.dataset.tfBank,
          frame:[css(icon).width,css(icon).height,css(icon).backgroundColor],
          mark:[css(mark).width,css(mark).height],
          glyph:[css(glyph).width,css(glyph).height]};
      }));
    assert.equal(bankIcons.length,2);
    for(const rail of bankIcons){
      assert.deepEqual(rail.frame.slice(0,2),['32px','32px'],
        'Bank icon outer frame must be 32px in '+view);
      assert.deepEqual(rail.mark,['20px','20px'],
        'SEPA/SWIFT mark must match 20px coin logo in '+view);
      assert.deepEqual(rail.glyph,['14px','14px'],
        'SEPA/SWIFT glyph must scale inside 20px mark in '+view);
    }
    const coinImages=await section.locator('.method-list > button[data-go] .cn img').evaluateAll(nodes=>
      nodes.map(el=>[getComputedStyle(el).width,getComputedStyle(el).height]));
    assert.ok(coinImages.every(size=>size[0]==='20px'&&size[1]==='20px'));

   }
   await page.evaluate(()=>show('topup',false));
   await page.locator('#v-topup .method-list [data-go="dep-usdt-tron"]').click();
   await page.locator('#v-dep-usdt-tron.on').waitFor({state:'visible',timeout:12000});
   // Unverified users must reach the existing email-verification flow.
   await page.evaluate(()=>show('topup',false));
   await page.locator('#v-topup .method-list [data-tf-bank="SEPA"]').click();
   await page.locator('#tfv-page').waitFor({state:'visible',timeout:12000});
   assert.ok(await page.evaluate(() =>
     window.tfVerificationQA?.getState().context.rail === 'SEPA'),
     'SEPA selection must retain its verification context');

   // With a verified mock state, the very same method row opens the bank flow.
   await page.evaluate(()=>{
     window.tfVerificationQA.setScenarioStatus('approved');
     show('topup',false);
   });
   await page.locator('#v-topup .method-list [data-tf-bank="SEPA"]').click();
   await page.locator('#tf-bank-overlay').waitFor({state:'visible',timeout:12000});
   assert.ok((await page.locator('#tf-bank-overlay iframe').getAttribute('src'))?.includes('rail=SEPA'),
     'Approved SEPA must open the native bank UI');
   assert.deepEqual(errors,[]);
   console.log('PASS live methods and bank handler '+width+'px');
  }finally{await page.close();}
 }
}catch(e){failed=true;console.error('Method sheet regression FAILED',e.stack||e);}
finally{await browser.close();}
if(failed)process.exit(1);
