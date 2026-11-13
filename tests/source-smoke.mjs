import {chromium} from 'playwright';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const out=path.resolve('tests/source-output');fs.mkdirSync(out,{recursive:true});
const report={screens:[],errors:[]};
const base=pathToFileURL(path.resolve('transfi-remittance/index.html'));
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
 await check('home');
 await page.screenshot({path:path.join(out,'original-home-'+viewport.width+'.png'),animations:'disabled'});
 await page.locator('.bnv [data-mb="topup"]').click();
 await page.waitForTimeout(450);
 await page.screenshot({path:path.join(out,'original-topup-'+viewport.width+'.png'),animations:'disabled'});
 if(!await page.locator('#v-topup [data-tf-bank="SEPA"]').isVisible())throw new Error('SEPA missing in topup sheet');
 if(!await page.locator('#v-topup [data-go="dep-usdt-tron"]').isVisible())throw new Error('Original USDT method missing');
 if(!await page.locator('#v-topup [data-go="dep-usdc-polygon"]').isVisible())throw new Error('Original USDC method missing');
 await page.locator('#v-topup [data-tf-bank="SEPA"]').click();
 await page.waitForTimeout(300);
 if(!await page.locator('#tf-bank-overlay').isVisible())throw new Error('SEPA overlay missing');
 const frame=page.frameLocator('#tf-bank-overlay iframe');
 if(!await frame.getByText('Валюта пополнения',{exact:true}).isVisible())throw new Error('SEPA legacy screen missing');
 await page.screenshot({path:path.join(out,'source-sepa-'+viewport.width+'.png'),animations:'disabled'});
 await page.locator('#tf-bank-close').click();
 if(await page.locator('#tf-bank-overlay').isVisible())throw new Error('Close failed');
 // The original bottom-nav method sheet is modal and intentionally blocks tabs.
 // Close it through the original dim/back area before selecting another tab.
 if(viewport.width<1024)await page.locator('#v-topup .dim').click({position:{x:12,y:12}});
 else await page.evaluate(()=>bnvSheetClose());
 await page.waitForTimeout(250);
 await page.locator('.bnv [data-mb="withdraw"]').click();
 await page.waitForTimeout(450);
 if(!await page.locator('#v-withdraw [data-tf-bank="SWIFT"]').isVisible())throw new Error('SWIFT missing in withdraw sheet');
 await page.locator('#v-withdraw [data-tf-bank="SWIFT"]').click();
 await page.waitForTimeout(300);
 if(!await page.locator('#tf-bank-overlay').isVisible())throw new Error('SWIFT overlay missing');
 await page.screenshot({path:path.join(out,'source-swift-'+viewport.width+'.png'),animations:'disabled'});
 await page.close();
}
}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
