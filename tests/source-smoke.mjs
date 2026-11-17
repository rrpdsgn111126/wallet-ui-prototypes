import {chromium} from 'playwright';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const out=path.resolve('tests/source-output');fs.mkdirSync(out,{recursive:true});
const report={screens:[],errors:[]};
const base=pathToFileURL(path.resolve('transfi-remittance/index.html'));
// Check the ACTUAL top-up/withdraw method sheets in index.html, not legacy.html.
async function verifyVisibleBankIcons(page,screen){
 const metrics=await page.evaluate(screen=>{
  const root=document.querySelector('#v-'+screen);
  const native=root.querySelector('.m[data-go] .cn:has(img[width="24"])');
  const oldLogo=native?.querySelector('img');
  const nativeCSS=native&&getComputedStyle(native);
  const iconCSS=oldLogo&&getComputedStyle(oldLogo);
  const rows=[...root.querySelectorAll('[data-tf-bank]')].map(row=>{
   const rail=row.dataset.tfBank,plate=row.querySelector('.cn.tf-bank-icon');
   const badge=plate?.querySelector('.tf-bank-mark'),svg=badge?.querySelector('svg.tf-bank-glyph');
   if(!svg)return {rail,missing:true,text:plate?.textContent};
   const p=plate.getBoundingClientRect(),b=badge.getBoundingClientRect(),s=svg.getBoundingClientRect();
   const cs=getComputedStyle(plate),bs=getComputedStyle(badge),gs=getComputedStyle(svg);
   return {rail,plate:[cs.width,cs.height],badge:[bs.width,bs.height],
     glyph:[gs.width,gs.height],gray:cs.backgroundColor,purple:bs.backgroundColor,
     white:bs.color,
     placement:Math.max(Math.abs(p.x+p.width/2-b.x-b.width/2),Math.abs(p.y+p.height/2-b.y-b.height/2),
       Math.abs(b.x+b.width/2-s.x-s.width/2),Math.abs(b.y+b.height/2-s.y-s.height/2)),
     svg:svg.innerHTML};
  });
  return {nativePlate:nativeCSS&&[nativeCSS.width,nativeCSS.height],
    nativeColor:nativeCSS?.backgroundColor,nativeLogo:iconCSS&&[iconCSS.width,iconCSS.height],rows};
 },screen);
 if(metrics.rows.length!==2)throw new Error(screen+': expected two bank method rows');
 if(!metrics.nativeColor||metrics.nativeLogo?.join('x')!=='24pxx24px')
   throw new Error(screen+': original 24px USDT/USDC reference absent '+JSON.stringify(metrics));
 for(const rail of ['SEPA','SWIFT']){
  const r=metrics.rows.find(x=>x.rail===rail);
  if(!r||r.missing||r.plate.join('x')!==metrics.nativePlate.join('x')||
     r.badge.join('x')!==metrics.nativeLogo.join('x')||r.glyph.join('x')!=='16pxx16px'||
     r.gray!==metrics.nativeColor||r.purple!=='rgb(111, 75, 242)'||
     r.white!=='rgb(255, 255, 255)'||r.placement>0.6)
    throw new Error(screen+': '+rail+' nesting/layout mismatch '+JSON.stringify({native:metrics,r}));
 }
 if(metrics.rows[0].svg===metrics.rows[1].svg)
   throw new Error(screen+': SEPA and SWIFT marks must have distinct artwork');
 console.log('VISIBLE_BANK_ICONS_NATIVE_PARITY_OK',screen,page.viewportSize().width);
}

try{
for(const viewport of [{width:390,height:844},{width:430,height:932},{width:1440,height:900}]){
 const page=await browser.newPage({viewport,deviceScaleFactor:1});
 page.setDefaultTimeout(9000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base.href,{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(500);
 await page.evaluate(()=>document.fonts.ready);
 const check=async(label)=>{
   const state=await page.evaluate(()=>{
     const phone=document.querySelector('.phone'),home=document.querySelector('#v-home'),nav=document.querySelector('.bnv');
     const pr=phone.getBoundingClientRect();
     return {view:typeof view==='string'?view:'',
       htmlWidth:document.documentElement.scrollWidth,
       viewportWidth:innerWidth,phoneWidth:pr.width,
       phoneHeight:pr.height,
       homeActive:home.classList.contains('on'),
       navVisible:!!nav&&!nav.hidden,
       bankRows:document.querySelectorAll('#v-topup [data-tf-bank],#v-withdraw [data-tf-bank]').length,
       card:document.querySelector('#v-home .card')?.className,
       balance:document.querySelector('#v-home .cbal')?.textContent
     };
   });
   const row={viewport:viewport.width,label,...state,errors:[...errors]};report.screens.push(row);
   console.log(JSON.stringify(row));
   if(errors.length)throw new Error('Page error: '+errors.join(' | '));
   if(state.htmlWidth>viewport.width+2)throw new Error('Horizontal overflow on '+label);
   if(state.bankRows!==4)throw new Error('Missing SEPA/SWIFT rows');
   if(!state.homeActive&&!label.includes('method')&&!label.includes('bank'))throw new Error('Home not active');
 };

 // All four-digit PINs are valid in the offline preview, without a second entry.
 for(const scenario of [
   {screen:'pin',code:'0000'},
   {screen:'pin2',code:'9876'},
   {screen:'lock',code:'1234'}
 ]){
   await page.evaluate(screen=>{
     pin='';pin1='';pinNew=false;
     if(screen==='lock') lockOn=true;
     else lockOn=false;
     show(screen,false);
   },scenario.screen);
   if(!await page.locator('#v-'+scenario.screen).isVisible())
     throw new Error('PIN screen not visible: '+scenario.screen);
   for(const digit of scenario.code){
     await page.locator('#v-'+scenario.screen+' .key[data-k="'+digit+'"]').click();
   }
   await page.waitForFunction(()=>view==='home',{timeout:5000});
   if(!await page.locator('#v-home').isVisible())
     throw new Error('Demo PIN should return to home: '+scenario.screen);
   if(await page.locator('#v-pin2').isVisible())
     throw new Error('Preview should skip PIN confirmation');
   console.log('PIN_PREVIEW_OK',viewport.width,scenario.screen,scenario.code);
 }
 await check('home');
 await page.screenshot({path:path.join(out,'original-home-'+viewport.width+'.png'),animations:'disabled'});
 await page.locator('.bnv [data-mb="topup"]').click();
 await page.waitForTimeout(450);
 await page.screenshot({path:path.join(out,'original-topup-'+viewport.width+'.png'),animations:'disabled'});
 await verifyVisibleBankIcons(page,'topup');
 if(!await page.locator('#v-topup [data-tf-bank="SEPA"]').isVisible())throw new Error('SEPA missing in topup sheet');
 if(!await page.locator('#v-topup [data-go="dep-usdt-tron"]').isVisible())throw new Error('Original USDT method missing');
 if(!await page.locator('#v-topup [data-go="dep-usdc-polygon"]').isVisible())throw new Error('Original USDC method missing');
 // Source UI parity checks the existing bank screens after provider onboarding.
 // First-use email gating is covered separately by tests/bank-qa/transfi-verification.py.
 await page.evaluate(()=>tfVerificationQA.setScenarioStatus('approved'));
 await page.locator('#v-topup [data-tf-bank="SEPA"]').click();
 await page.waitForTimeout(300);
 if(!await page.locator('#tf-bank-overlay').isVisible())throw new Error('SEPA overlay missing');
 const frame=page.frameLocator('#tf-bank-overlay iframe');
 if(!await frame.getByText('Валюта пополнения',{exact:true}).isVisible())throw new Error('SEPA legacy screen missing');
 await page.screenshot({path:path.join(out,'source-sepa-'+viewport.width+'.png'),animations:'disabled'});
 // Simulate an expired wallet unlock TTL while the TransFi iframe is open.
 // Returning from the method must never trigger the native wallet lock.
 await page.evaluate(()=>sessionStorage.setItem('alt.unlock',String(Date.now()-10*60000)));
 await page.keyboard.press('Escape'); // adapter-supported way to dismiss the bank iframe
 if(await page.locator('#tf-bank-overlay').isVisible())throw new Error('Close failed');
 await page.evaluate(()=>{
   document.dispatchEvent(new Event('visibilitychange'));
   window.dispatchEvent(new Event('pageshow'));
   lockNow(); // even an explicit idle-lock trigger must be a no-op in preview
 });
 const lockState=await page.evaluate(()=>({
   view,lockOn,locked:document.querySelector('#v-lock').classList.contains('on'),
   active:!!document.querySelector('.view.on')
 }));
 if(lockState.lockOn||lockState.locked||lockState.view==='lock'||!lockState.active)
   throw new Error('PREVIEW_AUTO_LOCK_REGRESSION: '+JSON.stringify(lockState));
 console.log('PREVIEW_AUTO_LOCK_REGRESSION_OK',viewport.width,JSON.stringify(lockState));
 // The original bottom-nav method sheet is modal and intentionally blocks tabs.
 // Close it through the original dim/back area before selecting another tab.
 if(viewport.width<1024)await page.locator('#v-topup .dim').click({position:{x:12,y:12}});
 else await page.evaluate(()=>bnvSheetClose());
 await page.waitForTimeout(250);
 await page.locator('.bnv [data-mb="withdraw"]').click();
 await page.waitForTimeout(450);
 await verifyVisibleBankIcons(page,'withdraw');
 if(!await page.locator('#v-withdraw [data-tf-bank="SWIFT"]').isVisible())throw new Error('SWIFT missing in withdraw sheet');
 await page.locator('#v-withdraw [data-tf-bank="SWIFT"]').click();
 await page.waitForTimeout(300);
 if(!await page.locator('#tf-bank-overlay').isVisible())throw new Error('SWIFT overlay missing');
 await page.screenshot({path:path.join(out,'source-swift-'+viewport.width+'.png'),animations:'disabled'});
 await page.close();
}
}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
