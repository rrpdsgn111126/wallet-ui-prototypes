import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const output = path.resolve('tests/visual/output');
fs.mkdirSync(output,{recursive:true});
const html = pathToFileURL(path.resolve('transfi-remittance/index.html'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const cases=[
 ['home','in','home',null,null],
 ['history','in','history',null,null],
 ['wallet-card','in','wallet-card',null,null],
 ['wallet-profile','in','wallet-profile',null,null],
 ['wallet-earn','in','wallet-earn',null,null],
 ['wallet-notes','in','wallet-notes',null,null],
 ['topup-sheet','in','home',null,'in'],
 ['withdraw-sheet','out','home',null,'out'],
 ['in-sepa','in','in-details','SEPA',null],
 ['in-swift','in','in-details','SWIFT',null],
 ['in-pending','in','in-pending','SEPA',null],
 ['in-success','in','in-success','SEPA',null],
 ['in-held','in','in-held','SEPA',null],
 ['out-sepa','out','out-config','SEPA',null],
 ['out-swift','out','out-config','SWIFT',null],
 ['out-recipient','out','out-recipient','SWIFT',null],
 ['out-review','out','out-review','SWIFT',null],
 ['out-progress','out','out-progress','SWIFT',null],
 ['out-success','out','out-success','SWIFT',null],
 ['out-failed','out','out-failed','SWIFT',null],
 ['out-held','out','out-held','SWIFT',null],
 ['out-unavailable','out','out-unavailable','SWIFT',null]
];
const report={run:new Date().toISOString(),cases:[],issues:[]};
const collect=()=>({
 viewport:{width:innerWidth,height:innerHeight},
 rootWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,
 phone:(()=>{const e=document.querySelector('.phone.tf-phone');return {width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight}})(),
 content:(()=>{const e=document.querySelector('.tf-scroll');return {width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight}})(),
 footer:(()=>{const e=document.querySelector('.tf-foot');return {height:e.getBoundingClientRect().height,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}})(),
 fields:[...document.querySelectorAll('.phone.tf-phone .fld,.phone.tf-phone .tf-method-row,.phone.tf-phone .tf-currency-pick,.phone.tf-phone .tbl,.phone.tf-phone .box')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0}).map(e=>{const r=e.getBoundingClientRect();return {name:e.className,left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}}),
 badElements:[...document.querySelectorAll('.phone.tf-phone input,.phone.tf-phone button,.phone.tf-phone select')].filter(e=>{const r=e.getBoundingClientRect();const p=document.querySelector('.phone.tf-phone').getBoundingClientRect();return r.width>0&&r.height>0&&(r.left<p.left-3||r.right>p.right+3)}).map(e=>({tag:e.tagName,name:e.className,left:Math.round(e.getBoundingClientRect().left),right:Math.round(e.getBoundingClientRect().right)})).slice(0,15)
});
async function snap(name,flow,screen,rail,modal,viewport,capture,scale){
 const page=await browser.newPage({viewport,deviceScaleFactor:scale});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const url=new URL(html.href);
 if(capture)url.searchParams.set('capture','1');
 url.searchParams.set('flow',flow);url.searchParams.set('screen',screen);
 if(rail)url.searchParams.set('rail',rail);
 if(modal)url.searchParams.set('modal',modal);
 await page.goto(url.href,{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForTimeout(100);
 const metrics=await page.evaluate(collect);
 const label=capture?name:name+'-'+viewport.width;
 const imagePath=path.join(output,label+'.png');
 await page.locator('.phone.tf-phone').screenshot({path:imagePath,animations:'disabled'});
 const test={label,name,flow,screen,rail,modal,capture,metrics,errors};
 report.cases.push(test);
 const excess=Math.max(0,metrics.rootWidth-metrics.viewport.width,
   metrics.phone.scrollWidth-metrics.phone.width,metrics.content.scrollWidth-metrics.content.width,
   metrics.footer.scrollWidth-metrics.footer.clientWidth);
 if(excess>1||errors.length||metrics.badElements.length)report.issues.push({label,excess,errors,badElements:metrics.badElements});
 console.log('AUDIT',label,JSON.stringify({root:metrics.rootWidth,phone:metrics.phone,content:metrics.content,overflow:excess,errors,badElements:metrics.badElements}));
 await page.close();
}
try{
 for(const [name,flow,screen,rail,modal] of cases){
   await snap(name,flow,screen,rail,modal,{width:430,height:932},true,3);
 }
 for(const size of [{width:390,height:844},{width:430,height:932},{width:1440,height:900}]){
   for(const [name,flow,screen,rail,modal] of cases){
     await snap(name,flow,screen,rail,modal,size,false,1);
   }
 }

 // Whole-page audit, not just the isolated phone: catches page-level scroll locks
 // from the native alt.vu stylesheet as well as clipping and responsive misalignment.
 report.pageCases=[];
 for(const viewport of [
   {width:375,height:667},{width:390,height:844},{width:430,height:932},
   {width:768,height:800},{width:1280,height:800},{width:1440,height:900}
 ]) {
   for(const mode of ['home','topup-sheet','in-sepa']){
     const page=await browser.newPage({viewport,deviceScaleFactor:1});
     const errors=[];page.on('pageerror',e=>errors.push(String(e)));
     const url=new URL(html.href);
     url.searchParams.set('flow','in');
     url.searchParams.set('screen',mode==='in-sepa'?'in-details':'home');
     if(mode==='topup-sheet')url.searchParams.set('modal','in');
     await page.goto(url.href,{waitUntil:'domcontentloaded'});
     await page.evaluate(()=>document.fonts.ready);
     const metrics=await page.evaluate(()=>{
       const html=document.documentElement,body=document.body;
       const top=document.querySelector('.top'),phone=document.querySelector('.phone.tf-phone'),content=document.querySelector('.tf-scroll');
       const rect=(node)=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
       const out={
         viewport:{width:innerWidth,height:innerHeight},
         htmlPosition:getComputedStyle(html).position,
         bodyPosition:getComputedStyle(body).position,
         htmlOverflowY:getComputedStyle(html).overflowY,
         bodyOverflowY:getComputedStyle(body).overflowY,
         documentWidth:html.scrollWidth,
         documentHeight:html.scrollHeight,
         top:rect(top),phone:rect(phone),
         phoneOffsetWidth:phone.offsetWidth,
         phoneTransform:getComputedStyle(phone).transform,
         bodyBeforeContent:getComputedStyle(body,'::before').content,
         content:{height:content.clientHeight,scrollHeight:content.scrollHeight},
         sidebarDisplay:getComputedStyle(document.querySelector('.sidebar')).display,
         mobileNavDisplay:getComputedStyle(document.querySelector('.mobilemenu')).display,
       };
       const oldScroll=scrollY;
       window.scrollTo(0,Math.max(0,html.scrollHeight-innerHeight));
       out.scrollYAfter=scrollY;
       window.scrollTo(0,oldScroll);
       if(content.scrollHeight>content.clientHeight+1){
         content.scrollTop=100;
         out.innerScrollTop=content.scrollTop;
         content.scrollTop=0;
       } else {out.innerScrollTop=null}
       return out;
     });
     const label='full-'+mode+'-'+viewport.width;
     await page.screenshot({path:path.join(output,label+'.png'),fullPage:true,animations:'disabled'});
     const violations=[];
     if(metrics.bodyPosition==='fixed'||metrics.htmlOverflowY==='hidden')
       violations.push('body locked as fullscreen wallet rather than scrollable prototype');
     if(metrics.documentWidth>viewport.width+1)
       violations.push('horizontal document overflow '+(metrics.documentWidth-viewport.width));
     if(Math.abs(metrics.phone.width-metrics.phoneOffsetWidth)>1)
       violations.push('phone scaled: bounding '+metrics.phone.width+' vs layout '+metrics.phoneOffsetWidth);
     if(metrics.phoneTransform!=='none')
       violations.push('phone transformed by native stylesheet');
     if(!['none','normal'].includes(metrics.bodyBeforeContent))
       violations.push('native body pseudo-overlay visible');
     if(metrics.phone.left< -1||metrics.phone.right>viewport.width+1)
       violations.push('phone outside viewport');
     if(metrics.top.top < -1||metrics.top.bottom > viewport.height+1)
       violations.push('top page controls clipped');
     if(metrics.documentHeight>viewport.height+2&&metrics.scrollYAfter<=0)
       violations.push('cannot scroll to lower page content');
     if(metrics.content.scrollHeight>metrics.content.height+2&&metrics.innerScrollTop<=0)
       violations.push('phone content cannot scroll');
     if(viewport.width>=1131&&metrics.sidebarDisplay==='none')
       violations.push('desktop sidebar unexpectedly hidden');
     if(viewport.width<=740&&metrics.mobileNavDisplay==='none')
       violations.push('mobile controls unexpectedly hidden');
     if(errors.length)violations.push(...errors);
     report.pageCases.push({label,metrics,violations});
     if(violations.length)report.issues.push({label,violations});
     console.log('FULLPAGE',label,JSON.stringify({metrics,violations}));
     await page.close();
   }
 }
}finally{
 fs.writeFileSync(path.join(output,'audit.json'),JSON.stringify(report,null,2));
 await browser.close();
}
console.log('TOTAL',report.cases.length,'ISSUES',report.issues.length);
if(report.issues.length)process.exitCode=1;
