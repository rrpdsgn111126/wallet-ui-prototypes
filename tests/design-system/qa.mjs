#!/usr/bin/env node
// DS-01 Playwright: main-vs-branch screenshot parity and runtime token tests.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright'),{PNG}=require('pngjs'),pixelmatch=require('pixelmatch');
const [baseline,current]=process.argv.slice(2);
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
    const count=pixelmatch(a.png.data,b.png.data,null,a.png.width,a.png.height,{threshold:.05,includeAA:false});
    const ratio=count/(a.png.width*a.png.height);
    console.log(id+' diff='+(ratio*100).toFixed(3)+'% ('+count+' pixels)');
    assert.ok(ratio<=(file.includes('index.html')?.008:.004),'Unexpected screenshot change');
    assert.deepEqual(b.styles,a.styles,'Computed styles changed');
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
 if(failures)process.exitCode=1;else console.log('DS-01 Playwright passed');
})().catch(e=>{console.error(e);process.exitCode=1});
