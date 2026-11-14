import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const output=path.resolve('tests/bank-qa/output');
fs.mkdirSync(output,{recursive:true});
const original=pathToFileURL(path.resolve('transfi-remittance/index.html'));
const bank=pathToFileURL(path.resolve('transfi-remittance/legacy.html'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={source:{},cases:[],issues:[],functional:{}};
const styleOf=(el)=>el?(()=>{
 const s=getComputedStyle(el);
 return {height:s.height,br:s.borderRadius,fontSize:s.fontSize,
  fontWeight:s.fontWeight,lineHeight:s.lineHeight,paddingLeft:s.paddingLeft,
  background:s.backgroundColor};
})():null;
const selectors={
 header:'#v-transfer .head .h1',
 field:'#v-transfer .fld.w',
 button:'#v-transfer .foot .btn',
 box:'#v-transfer-check .box',
 table:'#v-card-tariffs .tbl',
 segment:'#v-card-tariffs .seg'
};
function valuePx(x){return parseFloat(x||'0')}
const screens=[
 ['in-sepa','in','in-details','SEPA'],
 ['in-swift','in','in-details','SWIFT'],
 ['in-pending','in','in-pending','SEPA'],
 ['in-success','in','in-success','SEPA'],
 ['in-held','in','in-held','SEPA'],
 ['out-sepa','out','out-config','SEPA'],
 ['out-swift','out','out-config','SWIFT'],
 ['out-recipient-sepa','out','out-recipient','SEPA'],
 ['out-recipient-swift','out','out-recipient','SWIFT'],
 ['out-review-sepa','out','out-review','SEPA'],
 ['out-review-swift','out','out-review','SWIFT'],
 ['out-progress','out','out-progress','SWIFT'],
 ['out-success','out','out-success','SWIFT'],
 ['out-failed','out','out-failed','SWIFT'],
 ['out-held','out','out-held','SWIFT'],
 ['out-unavailable','out','out-unavailable','SWIFT']
];
try{
 const reference=await browser.newPage({viewport:{width:390,height:844}});
 await reference.goto(original.href,{waitUntil:'domcontentloaded'});
 await reference.evaluate(()=>document.fonts.ready);
 report.source=await reference.evaluate(selectors=>{
   const o={};
   for(const [key,sel] of Object.entries(selectors)){
     const el=document.querySelector(sel);const s=el?getComputedStyle(el):null;
     o[key]=s?{height:s.height,borderRadius:s.borderRadius,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,paddingLeft:s.paddingLeft}:null;
   }
   return o;
 },selectors);
 // The archived wallet contains this exact original USDT field DOM.
 report.sourceNativeAmount=await reference.evaluate(()=>{
   const inp=document.querySelector('#v-out-usdt-tron .wd-amt');
   const fld=inp?.closest('.fld.w'),addon=fld?.querySelector(':scope > .addon');
   const cur=addon?.querySelector(':scope > .cur'),max=addon?.querySelector(':scope > .mx.wd-max');
   return {fieldTag:fld?.tagName,hasIcon:!!fld?.querySelector(':scope > .fi svg'),
    inputTag:inp?.tagName,inputClass:inp?.className,inputMode:inp?.getAttribute('inputmode'),
    placeholder:inp?.getAttribute('placeholder'),flTag:fld?.querySelector(':scope > .fl')?.tagName,
    addonTag:addon?.tagName,addonChildren:addon?[...addon.children].map(el=>el.tagName+'.'+el.className):[],
    curTag:cur?.tagName,curText:cur?.textContent,maxTag:max?.tagName,maxText:max?.textContent};
 });
 const amountReference=await browser.newPage({viewport:{width:390,height:844}});
 await amountReference.goto(pathToFileURL(path.resolve('components/amount.html')).href,{waitUntil:'domcontentloaded'});
 await amountReference.evaluate(()=>document.fonts.ready);
 report.sourceAmount=await amountReference.evaluate(()=>{
   const max=document.querySelector('.ds-st .mx'),inp=document.querySelector('.ds-st .wd-amt');
   const addon=max?.closest('.addon'),cur=addon?.querySelector('.cur');
   if(!max||!inp||!cur)return null;
   const s=getComputedStyle(max),p=getComputedStyle(inp),a=getComputedStyle(addon),c=getComputedStyle(cur);
   const mr=max.getBoundingClientRect(),cr=cur.getBoundingClientRect();
   return {
     max:Object.fromEntries(['fontSize','fontWeight','fontFamily','lineHeight','backgroundColor','color','borderRadius','paddingTop','paddingRight','paddingBottom','paddingLeft','letterSpacing','display'].map(k=>[k,s[k]])),
     input:{fontSize:p.fontSize,fontWeight:p.fontWeight},
     currency:Object.fromEntries(['fontSize','fontWeight','color','fontFamily'].map(k=>[k,c[k]])),
     addon:{gap:a.gap,alignItems:a.alignItems,flexDirection:a.flexDirection},
     geometry:{maxWidth:mr.width,maxHeight:mr.height,currencyGap:mr.left-cr.right}
   };
 });
 await amountReference.close();
 await reference.close();
 console.log('SOURCE_COMPONENTS',JSON.stringify(report.source));
 for(const viewport of [{width:390,height:844},{width:430,height:932}]){
  for(const [name,flow,screen,rail] of screens){
   const page=await browser.newPage({viewport,deviceScaleFactor:1});
   page.setDefaultTimeout(6000);
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const url=new URL(bank.href);
   for(const [k,v] of Object.entries({capture:'1',embedded:'1',flow,screen,rail}))
     url.searchParams.set(k,v);
   await page.goto(url.href,{waitUntil:'domcontentloaded'});
   await page.evaluate(()=>document.fonts.ready);
   const metrics=await page.evaluate(()=>{
     const phone=document.querySelector('.phone.tf-phone');
     const main=document.querySelector('.tf-scroll');
     const head=document.querySelector('.head .h1');
     const css=el=>{if(!el)return null;const s=getComputedStyle(el);
       return {height:s.height,borderRadius:s.borderRadius,fontSize:s.fontSize,
         fontWeight:s.fontWeight,lineHeight:s.lineHeight,paddingLeft:s.paddingLeft};};
     return {
      viewportWidth:innerWidth,rootWidth:document.documentElement.scrollWidth,
      phoneWidth:phone.clientWidth,phoneScrollWidth:phone.scrollWidth,
      contentWidth:main.clientWidth,contentScrollWidth:main.scrollWidth,
      contentScrollHeight:main.scrollHeight,contentHeight:main.clientHeight,
      header:css(head),field:css(document.querySelector('.tf-scroll .fld.tf-field')),
      button:css(document.querySelector('.tf-foot .btn')),
      box:css(document.querySelector('.tf-scroll .box')),
      table:css(document.querySelector('.tf-scroll .tbl')),
      segment:css(document.querySelector('.tf-scroll .seg')),
      statusIcon:!!document.querySelector('.tf-hero .tf-mark svg,.tf-hero .okc svg'),
      timelineDot:document.querySelector('.timeline .dot')?getComputedStyle(document.querySelector('.timeline .dot')).position:null,
      fontReady:document.fonts.check('16px Inter'),
      screenTitle:head?.textContent,
     }
   });
   const label=name+'-'+viewport.width;
   await page.screenshot({path:path.join(output,label+'.png'),animations:'disabled'});
   const problems=[...errors];
   if(metrics.rootWidth>viewport.width+2)problems.push('document horizontal overflow');
   if(metrics.phoneScrollWidth>metrics.phoneWidth+2)problems.push('phone horizontal overflow');
   if(metrics.contentScrollWidth>metrics.contentWidth+2)problems.push('content horizontal overflow');
   if(!metrics.fontReady)problems.push('Inter font missing');
   if(Math.abs(valuePx(metrics.header?.fontSize)-valuePx(report.source.header?.fontSize))>0.2)
     problems.push('header typography not matching source');
   if(metrics.field&&Math.abs(valuePx(metrics.field.height)-valuePx(report.source.field?.height))>1)
     problems.push('field height not matching source');
   if(metrics.button&&Math.abs(valuePx(metrics.button.height)-valuePx(report.source.button?.height))>1)
     problems.push('button height not matching source');
   if(metrics.box&&Math.abs(valuePx(metrics.box.borderRadius)-valuePx(report.source.box?.borderRadius))>1)
     problems.push('box radius not matching source');
   if(metrics.table&&Math.abs(valuePx(metrics.table.borderRadius)-valuePx(report.source.table?.borderRadius))>1)
     problems.push('table radius not matching source');
   if(/pending|held|failed|success|progress/.test(screen)&&!metrics.statusIcon)
     problems.push('status SVG missing');
   if(metrics.timelineDot&&metrics.timelineDot!=='static')
     problems.push('timeline dot uses incompatible source badge positioning');
   if(screen==='out-config'){
     const amount=await page.evaluate(()=>{
       const inp=document.querySelector('#tf-out-amount'),fld=inp?.closest('.fld.w');
       const addon=fld?.querySelector(':scope > .addon');
       const max=addon?.querySelector('.mx.wd-max'),cur=addon?.querySelector('.cur');
       const cs=max&&getComputedStyle(max),is=inp&&getComputedStyle(inp);
       const c=cur&&getComputedStyle(cur),a=addon&&getComputedStyle(addon);
       const mr=max?.getBoundingClientRect(),cr=cur?.getBoundingClientRect();
       return {
         state:S.amount,value:inp?.value,total:quote().amt,source:S.sourceCurrency,
         fieldTag:fld?.tagName,hasIcon:!!fld?.querySelector(':scope > .fi svg'),
         inputTag:inp?.tagName,inputClass:inp?.className,inputMode:inp?.getAttribute('inputmode'),
         placeholder:inp?.getAttribute('placeholder'),flTag:fld?.querySelector(':scope > .fl')?.tagName,
         addonTag:addon?.tagName,addonChildren:addon?[...addon.children].map(el=>el.tagName+'.'+el.className):[],
         curTag:cur?.tagName,curText:cur?.textContent,
         maxTag:max?.tagName,maxText:max?.textContent,inputWeight:is?.fontWeight,
         max:cs&&Object.fromEntries(['fontSize','fontWeight','fontFamily','lineHeight','backgroundColor','color','borderRadius','paddingTop','paddingRight','paddingBottom','paddingLeft','letterSpacing','display'].map(k=>[k,cs[k]])),
         currency:c&&Object.fromEntries(['fontSize','fontWeight','color','fontFamily'].map(k=>[k,c[k]])),
         addon:a&&{gap:a.gap,alignItems:a.alignItems,flexDirection:a.flexDirection},
         geometry:mr&&cr&&{maxWidth:mr.width,maxHeight:mr.height,currencyGap:mr.left-cr.right,
           verticalOffset:(mr.top+mr.height/2)-(cr.top+cr.height/2)}
       };
     });
     if(amount.state!==''||amount.value!==''||amount.placeholder!=='0.00'||amount.total!==0)
       problems.push('native 0.00 placeholder is not initial bank amount');
     if(amount.source!=='USD'||amount.curText!=='$')
       problems.push('USD symbol must be to left of MAX');
     if(!report.sourceNativeAmount?.maxTag||!report.sourceAmount)
       problems.push('original USDT field source missing');
     else {
       for(const key of ['fieldTag','hasIcon','inputTag','inputClass','inputMode','placeholder','flTag','addonTag','curTag','curText','maxTag','maxText']){
         if(amount[key]!==report.sourceNativeAmount[key])
           problems.push('USDT field DOM differs: '+key);
       }
       if(JSON.stringify(amount.addonChildren)!==JSON.stringify(report.sourceNativeAmount.addonChildren))
         problems.push('USD and MAX sibling structure differs from native');
       for(const [key,val] of Object.entries(report.sourceAmount.max)){
         if(amount.max?.[key]!==val)problems.push('native MAX CSS differs: '+key);
       }
       for(const [key,val] of Object.entries(report.sourceAmount.currency)){
         if(amount.currency?.[key]!==val)problems.push('native currency CSS differs: '+key);
       }
       for(const [key,val] of Object.entries(report.sourceAmount.addon)){
         if(amount.addon?.[key]!==val)problems.push('native addon CSS differs: '+key);
       }
       for(const key of ['maxWidth','maxHeight','currencyGap']){
         if(Math.abs((amount.geometry?.[key]??-100)-report.sourceAmount.geometry[key])>1)
           problems.push('native USD / MAX geometry differs: '+key);
       }
       if(Math.abs(amount.geometry?.verticalOffset??100)>1.5)
         problems.push('dollar and MAX not vertically aligned');
       if(amount.inputWeight!==report.sourceAmount.input.fontWeight)
         problems.push('amount typography differs from native');
     }
     await page.locator('.tf-amount .wd-max').click();
     const read=()=>page.evaluate(()=>({value:document.querySelector('#tf-out-amount')?.value,state:S.amount,valid:validConfig()}));
     const clicked=await read();
     if(!clicked.valid||!clicked.value||clicked.value!==clicked.state)problems.push('MAX click failed');
     await page.evaluate(()=>{S.amount='';render();});
     await page.locator('.tf-amount .wd-max').focus();
     await page.keyboard.press('Enter');
     const entered=await read();
     if(!entered.valid||!entered.value||entered.value!==entered.state)problems.push('MAX Enter failed');
     await page.evaluate(()=>{S.amount='';render();});
     await page.locator('.tf-amount .wd-max').focus();
     await page.keyboard.press('Space');
     const spaced=await read();
     if(!spaced.valid||!spaced.value||spaced.value!==spaced.state)problems.push('MAX Space failed');
   }
   report.cases.push({label,flow,screen,rail,metrics,problems});
   if(problems.length)report.issues.push({label,problems});
   console.log('BANK_QA',label,JSON.stringify({problems,header:metrics.header,field:metrics.field,button:metrics.button,root:metrics.rootWidth}));
   await page.close();
  }
 }
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const url=new URL(bank.href);
 url.searchParams.set('capture','1');url.searchParams.set('embedded','1');
 url.searchParams.set('flow','out');url.searchParams.set('screen','out-config');url.searchParams.set('rail','SWIFT');
 await page.goto(url.href);
 await page.evaluate(()=>{
   S.amount='1000'; S.firstName='Ivan'; S.lastName='Ivanov';
   S.account='000000000000';S.bic='DEMOXXXX';S.bank='Банк-партнёр'; render();
 });
 await page.locator('.tf-foot .btn').click();
 report.functional.recipient=(await page.locator('#phoneTitle').innerText()).includes('Вывод');
 report.functional.recipientScreen=await page.evaluate(()=>S.screen);
 await page.locator('.tf-foot .btn').click();
 report.functional.reviewScreen=await page.evaluate(()=>S.screen);
 await page.locator('.tf-foot .btn').click();
 report.functional.progressScreen=await page.evaluate(()=>S.screen);
 await page.close();
 if(report.functional.recipientScreen!=='out-recipient'||report.functional.reviewScreen!=='out-review'||report.functional.progressScreen!=='out-progress')
   report.issues.push({label:'functional',problems:['SWIFT next/review/progress flow broken']});
}finally{
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 await browser.close();
}
console.log('BANK_QA_TOTAL',report.cases.length,'ISSUES',report.issues.length,'FUNCTIONAL',JSON.stringify(report.functional));
if(report.issues.length)process.exitCode=1;
