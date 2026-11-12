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
}finally{
 fs.writeFileSync(path.join(output,'audit.json'),JSON.stringify(report,null,2));
 await browser.close();
}
console.log('TOTAL',report.cases.length,'ISSUES',report.issues.length);
if(report.issues.length)process.exitCode=1;
