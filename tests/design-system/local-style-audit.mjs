import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';

const proc=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{stdio:'ignore'});
let browser;
try {
  for(let i=0;i<50;i++){try{const r=await fetch('http://127.0.0.1:8765/ui-kit/');if(r.ok)break;}catch{}await sleep(150);}
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/ui-kit/',{waitUntil:'domcontentloaded'});
  const frames=page.locator('article.cmp figure.v:not(.d) iframe');
  for(let i=0;i<await frames.count();i++){
    try{await frames.nth(i).scrollIntoViewIfNeeded({timeout:1800});}catch(e){}
  }
  await page.waitForFunction(()=> {
    const s=document.querySelector('#ds-type-catalog-status')?.textContent||'';
    return s.includes('42 из 42 образцов загружены.');
  },null,{timeout:65000}).catch(()=>{});
  const report=await page.evaluate(()=>{
    const sections=[...document.querySelectorAll('#ds-type-catalog tbody tr')];
    let current='';
    const groups={};
    for(const row of sections){
      if(row.classList.contains('ds-type-catalog-group')){
        current=row.textContent.trim();groups[current]=[];continue;
      }
      if(!row.classList.contains('ds-type-catalog-row'))continue;
      groups[current].push({
        label:row.cells[0]?.textContent.trim(),
        token:row.querySelector('.ds-type-catalog-foundation')?.textContent||null,
        aliases:row.querySelector('.ds-type-catalog-aliases')?.textContent||'',
        selectors:row.querySelector('.ds-type-catalog-selectors')?.textContent||'',
        binding:row.querySelector('.ds-type-catalog-binding')?.textContent||'',
        metrics:[...row.cells].slice(2,5).map(x=>x.textContent.trim()).join(' / '),
        components:[...row.cells[5]?.querySelectorAll('a')||[]].map(x=>({id:x.hash,name:x.textContent}))
      });
    }
    const cards=[...document.querySelectorAll('article.cmp')].map(c=>{
      const rows=[...c.querySelectorAll('.ds-typo-item')].map(item=>({
        metrics:item.querySelector('.ds-typo-value')?.textContent.trim(),
        text:item.querySelector('.ds-typo-usage > span:first-child')?.textContent.trim(),
        selector:item.querySelector('.ds-typo-selector')?.textContent.trim(),
        status:item.querySelector('.ds-typo-status')?.textContent.trim(),
        token:item.querySelector('.ds-typo-token')?.textContent.trim(),
        matchToken:item.querySelector('.ds-typo-match-token')?.textContent.trim()
      })).filter(x=>x.status==='Локальный стиль'||x.status==='Совпадение, без привязки');
      return {id:c.id,name:c.querySelector('.meta h3')?.textContent.trim(),rows};
    }).filter(x=>x.rows.length);
    return {status:document.querySelector('#ds-type-catalog-status')?.textContent,groups,cards};
  });
  console.log('LOCAL_AUDIT_BEGIN');
  console.log(JSON.stringify(report,null,2));
  console.log('LOCAL_AUDIT_END');
  console.log('BROWSER_ERRORS',JSON.stringify(errors));
  await page.close();
}finally{if(browser)await browser.close();proc.kill();}
