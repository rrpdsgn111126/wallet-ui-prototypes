#!/usr/bin/env node
// DS-07: verify semantic aliases, unchanged near-black colors, and readable form placeholders.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:8765/';
const dest = process.argv[3] || path.join(process.env.RUNNER_TEMP || '/tmp','ds-07-colors.json');
const data = JSON.parse(fs.readFileSync('tokens/tokens.json','utf8'));
const tokens = fs.readFileSync('tokens/tokens.css','utf8');
const core = fs.readFileSync('css/alt-vu-wallet.css','utf8');
assert.equal(data.color['--n850'].light,'#211e1d','--n850 changed without approval');
assert.equal(data.color['--n900'].light,'#161514','--n900 changed without approval');
assert.match(core,/\.scanbox\{[^}]*background:#000\b/,'Scanner blackout changed');
assert.match(core,/html\.dark \.dim\{[^}]*background:#000\b/,'Dark modal dim color changed');
assert.equal(Object.keys(data.semantic_color).length,7,'Unexpected semantic token count');
for(const [key,role] of Object.entries(data.semantic_color)){
 assert.ok(tokens.includes(key+': var('+role.reference+');'),key+' CSS alias not found');
}
function rgb(x) {
 const h=x.match(/rgba?\(([^)]+)\)/);
 if(!h)throw new Error('Cannot parse CSS color: '+x);
 return h[1].split(/[,\s/]+/).filter(Boolean).slice(0,3).map(Number);
}
function luminance(c){const v=c.map(x=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)});return v[0]*.2126+v[1]*.7152+v[2]*.0722;}
function contrast(a,b){let x=luminance(a),y=luminance(b);return (+((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(3));}
const browser=await chromium.launch({headless:true,channel:'chrome'});
const report={semantics:{},placeholders:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:932},deviceScaleFactor:1});
 await page.goto(base+'ui-kit/',{waitUntil:'domcontentloaded'});
 await page.addStyleTag({url:base+'tokens/tokens.css'});
 assert.equal(await page.locator('#tokens .tk code').filter({hasText:'--ds-sem-text-placeholder'}).count(),1,'Semantic color swatches not present');
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),theme);
  const actual=await page.evaluate(names=>{
    const s=getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map(name=>[name,s.getPropertyValue(name).trim().toLowerCase()]));
  },Object.keys(data.semantic_color));
  for(const [key,role] of Object.entries(data.semantic_color)){
   const desired=(theme==='dark'?role.dark:role.light).toLowerCase();
   const same=actual[key].replace(/ /g,'');
   assert.ok(same===desired || (desired==='#fff'&&same==='#ffffff'),
      theme+' semantic '+key+': '+same+' != '+desired);
  }
  report.semantics[theme]=actual;
 }
 const palette=page.locator('#tokens .tg').filter({hasText:'Семантические цвета'}).first();
 await palette.screenshot({path:path.join(path.dirname(dest),'ds-07-semantic-palette.png')});
 await page.close();
 for(const width of [390,430,1440]){
  for(const theme of ['light','dark']){
   for(const file of ['fld','amount']){
    const page=await browser.newPage({viewport:{width,height:932},deviceScaleFactor:1});
    await page.goto(base+'components/'+file+'.html#'+theme,{waitUntil:'domcontentloaded'});
    const values=await page.evaluate(()=>{
      const input=document.querySelector('.phone .fld.w:not(.err):not(.off) .fl input');
      if(!input)throw new Error('No live input');
      const phone=document.querySelector('.phone');
      const ph=getComputedStyle(input,'::placeholder').color;
      const fallback=getComputedStyle(phone).getPropertyValue('--n500').trim();
      const bg=getComputedStyle(document.querySelector('.fld.w')).backgroundColor;
      return {placeholder:ph,background:bg,secondary:fallback};
    });
    const ratio=contrast(rgb(values.placeholder),rgb(values.background));
    assert.ok(ratio>=4.5,'Placeholder contrast '+ratio+' <4.5: '+file+' '+width+' '+theme);
    if(theme==='light')assert.equal(values.placeholder,'rgb(107, 103, 103)',file+' placeholder did not use n500');
    report.placeholders.push({file,width,theme,contrast:ratio,...values});
    await page.close();
   }
  }
 }
}finally{await browser.close();}
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');
console.log('DS-07 semantic color and placeholder contrast check passed: '+JSON.stringify({
 aliases:Object.keys(data.semantic_color).length,specimens:report.placeholders.length,
 minContrast:Math.min(...report.placeholders.map(x=>x.contrast))
}));
