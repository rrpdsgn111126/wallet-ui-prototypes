#!/usr/bin/env node
// DS-02 Playwright: deliberate typography diffs against frozen work/design-system baseline, no new JS errors.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import playwright from 'playwright';
import pngjs from 'pngjs';
import pixelmatch from 'pixelmatch';
const {chromium}=playwright, {PNG}=pngjs;
const [baseline,current]=process.argv.slice(2);
const outDir=path.join(process.env.RUNNER_TEMP||current,'ds-02-visual-diff');
fs.mkdirSync(outDir,{recursive:true});
assert.ok(baseline&&current,'Usage: qa.mjs <baseline-dir> <current-dir>');
const css=fs.readFileSync(path.join(current,'tokens/tokens.css'),'utf8');
const data=JSON.parse(fs.readFileSync(path.join(current,'tokens/tokens.json'),'utf8'));
function colors(s){return Object.fromEntries([...s.matchAll(/--ds-color-([a-z0-9-]+):\s*(#[a-f0-9]+);/gi)].map(m=>['--'+m[1],m[2].toLowerCase()]));}
const light=colors(css.split(':root {')[1].split('\n}')[0]);
const dark=colors(css.split('html.dark {')[1].split('\n}')[0]);
for(const [name,c] of Object.entries(data.color)){
 assert.equal(light[name],c.light.toLowerCase(),'Light token '+name);
 assert.equal(dark[name]||light[name],c.dark.toLowerCase(),'Dark token '+name);
}
for(const t of data.type)assert.ok(css.includes('--ds-type-'+t.key+':'),'Missing type '+t.key);
assert.ok(!css.includes('--ds-type-lead: None'));
assert.ok(fs.readFileSync(path.join(current,'transfi-remittance/index.html'),'utf8').includes('../css/design-system.css'));
const cases=[
['components/type.html',390,'light'],
['components/type.html',430,'dark'],
['transfi-remittance/legacy.html',390,'light'],
['transfi-remittance/legacy.html',430,'dark'],
['transfi-remittance/index.html',390,'light'],
['transfi-remittance/index.html',430,'dark'],
['transfi-remittance/index.html',1440,'light']];
async function capture(browser,dir,file,width,theme){
 const page=await browser.newPage({viewport:{width,height:932},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const url=pathToFileURL(path.join(dir,file)).href+(file.includes('components/type')?'#'+theme:'');
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 if(theme==='dark')await page.evaluate(()=>document.documentElement.classList.add('dark'));
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
 await page.evaluate(async()=>document.fonts.ready);
 await page.locator('.phone').first().waitFor({state:'visible'});
 const styles=await page.evaluate(()=>{
  const out={};for(const s of ['.phone','.phone .h1','.phone .lead','.phone .note','.phone .fl b','.phone .fl i']){
   const el=document.querySelector(s);if(!el)continue;const c=getComputedStyle(el);
   out[s]=[c.fontSize,c.fontWeight,c.lineHeight,c.color,c.backgroundColor,c.getPropertyValue('--brand').trim()];
  }return out;
 });
 return {page,errors,styles,png:PNG.sync.read(await page.screenshot({animations:'disabled'}))};
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 let failures=0;
 try{
  for(const [file,width,theme] of cases){
   const id=file+' '+width+' '+theme;
   const a=await capture(browser,baseline,file,width,theme);
   const b=await capture(browser,current,file,width,theme);
   try{
    assert.equal(a.png.width,b.png.width);
    assert.equal(a.png.height,b.png.height);
    const pixelDelta = new PNG({width:a.png.width,height:a.png.height});
    const count=pixelmatch(a.png.data,b.png.data,pixelDelta.data,a.png.width,a.png.height,{threshold:.05,includeAA:false});
    const shotName=id.replace(/[^a-zA-Z0-9-]/g,'_');
    fs.writeFileSync(path.join(outDir,shotName+'_before.png'),PNG.sync.write(a.png));
    fs.writeFileSync(path.join(outDir,shotName+'_after.png'),PNG.sync.write(b.png));
    fs.writeFileSync(path.join(outDir,shotName+'_diff.png'),PNG.sync.write(pixelDelta));
    const ratio=count/(a.png.width*a.png.height);
    console.log(id+' diff='+(ratio*100).toFixed(3)+'% ('+count+' pixels)');
    if(JSON.stringify(b.styles)!==JSON.stringify(a.styles))console.log('Style delta baseline -> branch: '+JSON.stringify({baseline:a.styles,branch:b.styles}).slice(0,3200));
    // Typography is intentionally changed in DS-02: log pixel diffs for review.
    // A large diff indicates collateral geometry or color changes and blocks the PR.
    assert.ok(ratio<=.18,'Unexpectedly large visual diff (>18%)');
    for(const [selector,style] of Object.entries(b.styles)) {
      if(a.styles[selector])assert.equal(style[3],a.styles[selector][3],'Text color changed: '+selector);
      const size=parseFloat(style[0]);
      if(size<20&&size%2!==0)assert.fail('Non-grid computed font-size: '+selector+' = '+style[0]);
    }
    const expected = {'.phone .lead':'16px','.phone .note':'14px','.phone .fl b':'16px','.phone .fl i':'12px'};
    for(const [selector,size] of Object.entries(expected))if(b.styles[selector])assert.equal(b.styles[selector][0],size,'Unexpected typography role: '+selector);
    assert.deepEqual(b.errors.filter(e=>!a.errors.includes(e)),[],'New JS errors');
    if(file==='components/type.html'&&theme==='light'){
     const x=await b.page.evaluate(()=>{
      const r=document.documentElement;r.style.setProperty('--ds-font-size-20','23px');
      r.style.setProperty('--ds-color-brand','#112233');
      const size=getComputedStyle(document.querySelector('.phone .h1')).fontSize;
      const brand=getComputedStyle(document.querySelector('.phone')).getPropertyValue('--brand').trim();
      return {size,brand};
     });
     assert.deepEqual(x,{size:'23px',brand:'#112233'},'Token update does not propagate');
     console.log('Runtime font/color propagation OK');
    }
   }catch(e){failures++;console.error('FAILED '+id+': '+e.message);}
   finally{await a.page.close();await b.page.close();}
  }
 }finally{await browser.close();}
 if(failures)process.exitCode=1;else console.log('DS-02 Playwright: typography, colors, runtime tokens, JS and visual diff checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
