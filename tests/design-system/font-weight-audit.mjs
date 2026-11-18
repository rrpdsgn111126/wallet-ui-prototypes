#!/usr/bin/env node
// DS-04: Playwright audit of unique computed type styles in UI Kit specimens.
// Count is "distinct styles in component cards", NOT number of DOM elements.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const url=process.argv[2] || 'http://127.0.0.1:8765/ui-kit/';
const out=process.argv[3] || path.join(process.env.RUNNER_TEMP||'/tmp','font-weight-audit.json');
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
}finally{await browser.close();}
