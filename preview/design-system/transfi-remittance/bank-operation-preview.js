/* Static UX fixture: four SEPA/SWIFT operations on the real alt.vu history.
   Uses native #v-details and #v-receipt; no real TransFi/API calls or transfers. */
(function(){
  'use strict';
  if(!window.altPreview || !window.PV || !PV.data || !PV.data['/operations'])return;
  const now=Date.now(),at=min=>new Date(now-min*60000).toISOString();
  const fixtures=[
    {id:'pv-sepa-in-001',kind:'deposit',status:'credited',title:'Пополнение SEPA',
      bank_rail:'SEPA',amount_minor:27500,bank_source_minor:25000,bank_source_currency:'EUR',
      bank_dest_minor:27500,bank_dest_currency:'USD',bank_rate:'1 EUR = 1,1000 USD',
      bank_party:'Тестовый отправитель',bank_name:'Demo SEPA Bank',bank_country:'Германия',
      bank_iban:'DE00 0000 0000 0000 0000 00',bank_bic:'DEMOXXXX',fee_minor:0,created_at:at(14)},
    {id:'pv-sepa-out-002',kind:'withdrawal',status:'confirmed',title:'Вывод SEPA',
      bank_rail:'SEPA',amount_minor:-30000,bank_source_minor:30000,bank_source_currency:'USD',
      bank_dest_minor:27519,bank_dest_currency:'EUR',bank_rate:'1 USD = 0,9250 EUR',
      bank_party:'Тестовый получатель',bank_name:'Demo SEPA Bank',bank_country:'Германия',
      bank_iban:'DE00 0000 0000 0000 0000 00',bank_bic:'DEMOXXXX',fee_minor:250,created_at:at(36)},
    {id:'pv-swift-in-003',kind:'deposit',status:'credited',title:'Пополнение SWIFT',
      bank_rail:'SWIFT',amount_minor:50000,bank_source_minor:40000,bank_source_currency:'GBP',
      bank_dest_minor:50000,bank_dest_currency:'USD',bank_rate:'1 GBP = 1,2500 USD',
      bank_party:'Тестовый отправитель',bank_name:'Demo International Bank',
      bank_country:'Великобритания',bank_account:'DEMO-GBP-001',bank_bic:'DEMOGB22',
      fee_minor:0,created_at:at(72)},
    {id:'pv-swift-out-004',kind:'withdrawal',status:'confirmed',title:'Вывод SWIFT',
      bank_rail:'SWIFT',amount_minor:-65000,bank_source_minor:65000,bank_source_currency:'USD',
      bank_dest_minor:49170,bank_dest_currency:'GBP',bank_rate:'1 USD = 0,7780 GBP',
      bank_party:'Тестовый получатель',bank_name:'Demo International Bank',
      bank_country:'Великобритания',bank_account:'DEMO-GBP-002',bank_bic:'DEMOGB22',
      fee_minor:1800,created_at:at(130)}
  ];
  const operations=PV.data['/operations'].operations;
  // Idempotent even if the preview adapter is re-initialized during QA.
  operations.unshift(...fixtures.filter(op=>!operations.some(old=>old.id===op.id)));
  const css=document.createElement('style');
  css.id='pv-bank-operation-visuals';
  css.textContent='.pv-bank-plate{display:flex;align-items:center;justify-content:center;'+
    'width:40px;height:40px;flex:0 0 40px;border-radius:999px;'+
    'background:var(--coin-plate,var(--n100));}'+
    '.pv-bank-mark{display:grid;place-items:center;width:24px;height:24px;'+
    'border-radius:999px;background:#6f4bf2;color:#fff;}'+
    '.pv-bank-mark svg{display:block;width:16px;height:16px}'+
    '#v-details #d-cat .pv-bank-plate{width:56px;height:56px;flex-basis:56px}'+
    '#v-details #d-cat .pv-bank-mark{width:34px;height:34px}'+
    '#v-details #d-cat .pv-bank-mark svg{width:22px;height:22px}';
  document.head.appendChild(css);

  // Currency codes remain in the fixture/API model; the interface uses "$".
  const bankCurrency=currency=>currency==='USD'?'$':currency;
  const formatBank=(minor,currency)=>money(minor)+' '+bankCurrency(currency);
  const displayBankRate=rate=>String(rate||'').replace(/\bUSD\b/g,'$');
  const isIn=o=>o.kind==='deposit';
  const rateRows=(o,detailsOnly=false)=>isIn(o)?[
    ['Отправлено',formatBank(o.bank_source_minor,o.bank_source_currency)],
    ['Курс',displayBankRate(o.bank_rate)],
    ['Комиссия',formatBank(o.fee_minor||0,'USD')],
    ['Итого зачислено',formatBank(o.bank_dest_minor,'USD'),true]
  ]:[
    // bank_source_minor already includes the fee: do not add it again.
    [detailsOnly?'Отправлено':'Получено',formatBank(o.bank_dest_minor,o.bank_dest_currency)],
    ['Курс',displayBankRate(o.bank_rate)],
    ['Комиссия',formatBank(o.fee_minor||0,'USD')],
    ['Итого списано',formatBank(o.bank_source_minor,'USD'),true]
  ];
  const detailsRows=o=>[
    ['Способ перевода',o.bank_rail],
    [isIn(o)?'Отправитель':'Получатель',o.bank_party],
    ['Банк',o.bank_name],
    ['Страна банка',o.bank_country],
    o.bank_iban?isIn(o)?['IBAN',o.bank_iban]:['IBAN',o.bank_iban,false,o.bank_iban]:null,
    o.bank_account?['Номер счёта',o.bank_account]:null,
    ['SWIFT / BIC',o.bank_bic],
    ['Дата и время',fullTime(o.created_at)],
    ['Номер операции',o.id,false,o.id]
  ].filter(Boolean);

  // Follow the original alt.vu address-book row pattern (.bk-act, icons and
  // saved state). Bank IBAN/BIC must not enter the crypto address book API.
  const bankBookKey='alt.preview.bankRecipients.v1';
  let bankSaved=[];
  try{
    const stored=JSON.parse(sessionStorage.getItem(bankBookKey)||'[]');
    if(Array.isArray(stored))bankSaved=stored.filter(x=>x&&typeof x.key==='string'&&typeof x.label==='string');
  }catch(_){}
  const bankAddressKey=o=>[o.bank_rail,o.bank_iban||o.bank_account||'',o.bank_bic||'',o.bank_party||''].join('|');
  const bankBookRecord=o=>bankSaved.find(x=>x.key===bankAddressKey(o));
  function bankBookRow(o){
    if(!o || !o.bank_rail || isIn(o))return '';
    const saved=bankBookRecord(o);
    if(saved){
      return '<button class="bk-act saved" type="button" data-act="bk-op-open">'+
        '<span class="ic">'+BK_IC_OK+'</span><span>В книжке</span>'+
        '<i>'+esc(saved.label)+'</i><span class="chev">'+BK_IC_CHEV+'</span></button>';
    }
    return '<button class="bk-act" type="button" data-act="bk-op-add">'+
      '<span class="ic">'+BK_IC_ADD+'</span><span>Добавить в адресную книгу</span></button>';
  }
  const nativeBkRowHtml=bkRowHtml;
  bkRowHtml=function(o){
    return o&&o.bank_rail ? bankBookRow(o) : nativeBkRowHtml(o);
  };
  function bankBookView(){
    let page=document.getElementById('v-bank-book-add');
    if(page)return page;
    const root=document.querySelector('.phone');
    page=document.createElement('section');
    page.className='view';
    page.id='v-bank-book-add';
    page.innerHTML='<div class="tint"></div>'+
      '<div class="head hic"><div class="back" data-back="1">'+
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" '+
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+
      '<path d="m15 5-7 7 7 7"/></svg></div><div class="h1">Новый адрес</div></div>'+
      '<div class="wrap tight"><div class="fld w"><div class="fi">'+
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--n850)" '+
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+
      '<path d="M4.5 16.4 15.9 5a2.3 2.3 0 0 1 3.2 3.2L7.6 19.5l-4 .8z"/></svg>'+
      '</div><div class="fl"><i>Название</i>'+
      '<input id="pv-bank-book-label" maxlength="64" placeholder="Банк — основной"></div></div>'+
      '<div class="hint">Название видите только вы. Банковские реквизиты сохраняются '+
      'только в тестовом прототипе.</div><div class="box" id="pv-bank-book-data"></div>'+
      '<div class="msg" id="pv-bank-book-error"></div></div>'+
      '<div class="foot"><button class="btn" type="button" id="pv-bank-book-save">Сохранить</button></div>';
    root.appendChild(page);
    return page;
  }
  let bankBookPending=null;
  function bankBookOpen(o){
    if(!o || !o.bank_rail || isIn(o))return;
    bankBookPending=o;
    const page=bankBookView(),found=bankBookRecord(o);
    page.querySelector('.h1').textContent=found?'Адрес в книжке':'Новый адрес';
    const label=page.querySelector('#pv-bank-book-label');
    label.value=found?found.label:'';
    page.querySelector('#pv-bank-book-error').textContent='';
    page.querySelector('#pv-bank-book-data').innerHTML=rowsWithSub([
      ['Способ перевода',o.bank_rail],['Получатель',o.bank_party],
      ['Банк',o.bank_name],['Страна банка',o.bank_country],
      o.bank_iban?['IBAN',o.bank_iban]:null,
      o.bank_account?['Номер счёта',o.bank_account]:null,
      ['SWIFT / BIC',o.bank_bic]
    ]);
    show('bank-book-add');
    setTimeout(()=>label.focus(),60);
  }
  const nativeBookAddFromOp=bookAddFromOp;
  bookAddFromOp=function(o){
    if(o&&o.bank_rail)return bankBookOpen(o);
    return nativeBookAddFromOp(o);
  };
  const nativeBookOpenFromOp=bookOpenFromOp;
  bookOpenFromOp=async function(o){
    if(o&&o.bank_rail)return bankBookOpen(o);
    return nativeBookOpenFromOp(o);
  };
  document.addEventListener('click',e=>{
    if(!e.target.closest('#pv-bank-book-save'))return;
    const o=bankBookPending;
    if(!o || !o.bank_rail)return;
    const label=document.getElementById('pv-bank-book-label').value.trim();
    const error=document.getElementById('pv-bank-book-error');
    if(!label){error.textContent='Введите название';return;}
    const key=bankAddressKey(o);
    bankSaved=bankSaved.filter(x=>x.key!==key);
    bankSaved.push({key,label});
    try{sessionStorage.setItem(bankBookKey,JSON.stringify(bankSaved));}catch(_){}
    bankBookPending=null;
    back(); // Native back() returns to details and invokes bkRowPaint().
  });

  function bankIcon(rail,hero){
    const original=document.querySelector('#v-topup [data-tf-bank="'+rail+'"] svg.tf-bank-glyph');
    const paths=original?original.innerHTML:'';
    return '<div class="pv-bank-plate'+(hero?' pv-bank-detail-icon':'')+'">'+
      '<span class="pv-bank-mark"><svg viewBox="0 0 24 24" fill="none" '+
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '+
      'stroke-linejoin="round" aria-hidden="true">'+paths+'</svg></span></div>';
  }

  const originalOpIcon=opIcon;
  opIcon=function(o){
    if(!o||!o.bank_rail)return originalOpIcon(o);
    return bankIcon(o.bank_rail,false)+(OP_OK[o.status]?CHK_OK:'');
  };
  const originalOpSecond=opSecond;
  opSecond=function(o){
    if(!o||!o.bank_rail)return originalOpSecond(o);
    return o.bank_rail+' · '+bankCurrency(o.bank_source_currency)+' → '+bankCurrency(o.bank_dest_currency);
  };
  const originalOpenOp=openOp;
  openOp=function(o){
    originalOpenOp(o);
    if(!o||!o.bank_rail)return;
    const cat=document.getElementById('d-cat');
    if(cat){cat.hidden=false;cat.innerHTML=bankIcon(o.bank_rail,true);}
    const amounts=document.getElementById('d-money');
    if(amounts){amounts.innerHTML=rowsWithSub(rateRows(o,true));amounts.hidden=false;}
    const fields=document.getElementById('d-box');
    if(fields){
      const recordRows=detailsRows(o);
      const reference=recordRows.pop(); // Operation number must always remain last.
      fields.innerHTML=rowsWithSub(recordRows)+bankBookRow(o)+rowsWithSub([reference]);
      fields.hidden=false;
    }
    const warn=document.getElementById('d-warn');if(warn)warn.hidden=true;
    const scan=document.getElementById('d-scan');if(scan)scan.hidden=true;
    const receipt=document.getElementById('d-receipt');
    if(receipt){receipt.hidden=false;receipt.classList.remove('off');}
    const noReceipt=document.getElementById('d-norcpt');if(noReceipt)noReceipt.hidden=true;
    const problem=document.getElementById('d-problem');if(problem)problem.hidden=true;
  };

  const originalOpenReceipt=openReceipt;
  openReceipt=function(){
    const o=curOp;
    if(!o||!o.bank_rail)return originalOpenReceipt();
    const heading=document.querySelector('#v-receipt .h1');
    if(heading)heading.textContent='Квитанция';
    const body=document.getElementById('r-body');
    if(!body)return;
    const head=body.querySelector('.rhead');
    const line=(name,value,total)=>value
      ?'<div class="rl'+(total?' tot':'')+'"><span>'+tEsc(name)+'</span><b>'+tEsc(value)+'</b></div>'
      :'';
    body.innerHTML=(head?head.outerHTML:'')+
      '<div class="rttl" id="r-ttl">Квитанция по операции от '+
       tEsc(fullTime(o.created_at).split(',')[0])+'</div>'+
      line('Операция',o.title)+
      detailsRows(o).map(x=>line(x[0],x[1],false)).join('')+
      '<div class="rsep"></div>'+
      rateRows(o).map(x=>line(x[0],x[1],Boolean(x[2]))).join('')+
      '<div class="rsep"></div>'+line('Статус',opStatus(o))+rqFoot();
    show('receipt');
  };

  const originalSReceipt=sReceipt;
  sReceipt=function(){
    const o=curOp;
    if(!o||!o.bank_rail)return originalSReceipt();
    const row=(name,value,last)=>value
      ?'<div'+(last?' class="s-last"':'')+'><span>'+sEsc(name)+'</span><b>'+sEsc(value)+'</b></div>'
      :'';
    return sHead('Квитанция по операции')+
      '<div class="s-mr s-name"><b>'+sEsc(sWho())+'</b></div>'+
      '<div class="s-kv">'+
      row('Операция',o.title)+
      detailsRows(o).map(x=>row(x[0],x[1],false)).join('')+
      rateRows(o).map(x=>row(x[0],x[1],Boolean(x[2]))).join('')+
      row('Статус',opStatus(o))+'</div>'+sFoot();
  };

  // Preserve the existing preview history component and click routing.
  if(typeof loadOps==='function')loadOps();
})();