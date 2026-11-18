#!/usr/bin/env node
// DS-04: Playwright audit of unique computed type styles in UI Kit specimens.
// Count is "distinct styles in component cards", NOT number of DOM elements.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const url=process.argv[2] || 'http://127.0.0.1:8765/ui-kit/';
const out=process.argv[3] || path.join(process.env.RUNNER_TEMP||'/tmp','font-weight-audit.json');

function sourceAudit(root){
 const paths=['css/alt-vu-wallet.css','css/transfi-bank-altvu.css','showcase/showcase.css',
  'showcase/specimen.css','transfi-remittance/index.html','transfi-remittance/legacy.html',
  'transfi-remittance/transfi-qa-panel.js',
  ...fs.readdirSync(path.join(root,'components')).filter(f=>f.endsWith('.html')).map(f=>'components/'+f)];
 const counts={};const violations=[], exceptions=[];
 for(const file of paths){
  const raw=fs.readFileSync(path.join(root,file),'utf8');
  const css=file.endsWith('.html')?[...raw.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n'):raw;
  for(const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
   const selector=match[1].trim().replace(/\s+/g,' ').slice(-125),body=match[2];
   if(selector.includes('@font-face'))continue;
   const sizes=[...body.matchAll(/\bfont-size\s*:\s*(?:var\([^,;]*,\s*)?([\d.]+)px/g)]
      .map(x=>Number(x[1]));
   const directWeights=[...body.matchAll(/\bfont-weight\s*:\s*(\d{3})\b/g)].map(x=>Number(x[1]));
   for(const short of body.matchAll(/\bfont\s*:\s*([^;{}\n]+)/g)){
    const m=short[1].match(/(?:^|\s)(\d{3})\s+([\d.]+)px(?:\/|\s)/);
    if(m){sizes.push(Number(m[2]));directWeights.push(Number(m[1]));}
   }
   if(!sizes.length || !directWeights.length)continue;
   if(!sizes.some(x=>x<=20))continue;
   for(const weight of directWeights){
    const item={file,selector,weight,sizes};
    counts[weight]=(counts[weight]||0)+1;
    const isGraphic=/\.mark \.m\b|\.tf-method-icon\b|\.tf-currency-check\b/.test(selector);
    if(isGraphic){exceptions.push(item);continue;}
    if(![400,500,600].includes(weight))violations.push(item);
   }
  }
 }
 return {counts,exceptions,violations};
}
const sourceReport=sourceAudit(process.cwd());
console.log('SOURCE_WEIGHT_AUDIT '+JSON.stringify(sourceReport));
if(sourceReport.violations.length){
 console.error('Nonstandard explicit font-weights in <=20px text sources: '+sourceReport.violations.length);
 process.exitCode=1;
}
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:932}});
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const cards=page.locator('article.cmp');
 assert.equal(await cards.count(),42,'Unexpected UI Kit gallery count');
 for(let i=0;i<42;i++){
  const card=cards.nth(i);
  const frames=card.locator('figure.v iframe');
  const n=await frames.count();
  for(let j=0;j<n;j++)await frames.nth(j).scrollIntoViewIfNeeded();
  await page.waitForFunction(index=>document.querySelectorAll('article.cmp')[index]
    ?.querySelector('.ds-typography')?.dataset.ready==='1',i,{timeout:60000});
 }
 const data=await page.evaluate(()=>{
  const records=[];
  for(const card of document.querySelectorAll('article.cmp')){
   for(const row of card.querySelectorAll('.ds-typo-item')){
    const raw=row.querySelector('.ds-typo-value')?.textContent||'';
    const hit=raw.match(/^([\d.]+)\s*px\s*\/\s*([\d.]+)\s*px\s*·\s*(\d+)/);
    if(!hit)continue;
    const size=Number(hit[1]);if(size>20)continue;
    const weight=Number(hit[3]);
    records.push({component:card.id,size,weight,role:row.querySelector('.ds-typo-role')?.textContent||'',
     selector:row.querySelector('.ds-typo-selector')?.textContent||'',
     sample:row.querySelector('.ds-typo-usage > span:first-child')?.textContent?.slice(0,80)||''});
   }
  }return records;
 });
 const counts={};for(const r of data)counts[r.weight]=(counts[r.weight]||0)+1;
 const exceptions=data.filter(r=>![400,500,600].includes(r.weight));
 const report={source:'UI Kit / computed styles',scope:'type styles 20px or less, distinct per component',
   components:42,rows:data.length,weight_counts:counts,nonstandard:exceptions};
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log('WEIGHT_AUDIT '+JSON.stringify({rows:report.rows,weight_counts:counts,
  exception_count:exceptions.length,exceptions:exceptions.slice(0,120)}));
 if(exceptions.length){console.error('Non-standard small text weights in UI Kit: '+exceptions.length);process.exitCode=1;}
}finally{await browser.close();}
