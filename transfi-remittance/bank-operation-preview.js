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

  const formatBank=(minor,currency)=>money(minor)+' '+currency;
  const isIn=o=>o.kind==='deposit';
  const rateRows=o=>[
    isIn(o)?['Отправлено',formatBank(o.bank_source_minor,o.bank_source_currency)]
           :['Списано со счёта',formatBank(o.bank_source_minor,'USD')],
    ['Курс',o.bank_rate],
    ['Комиссия',formatBank(o.fee_minor||0,'USD')],
    isIn(o)?['Зачислено',formatBank(o.bank_dest_minor,'USD'),true]
           :['Получит',formatBank(o.bank_dest_minor,o.bank_dest_currency),true]
  ];
  const detailsRows=o=>[
    ['Способ перевода',o.bank_rail],
    [isIn(o)?'Отправитель':'Получатель',o.bank_party],
    ['Банк',o.bank_name],
    ['Страна банка',o.bank_country],
    o.bank_iban?['IBAN',o.bank_iban,false,o.bank_iban]:null,
    o.bank_account?['Номер счёта',o.bank_account,false,o.bank_account]:null,
    ['SWIFT / BIC',o.bank_bic],
    ['Дата и время',fullTime(o.created_at)],
    ['Номер операции',o.id,false,o.id]
  ].filter(Boolean);
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
    return o.bank_rail+' · '+o.bank_source_currency+' → '+o.bank_dest_currency;
  };
  const originalOpenOp=openOp;
  openOp=function(o){
    originalOpenOp(o);
    if(!o||!o.bank_rail)return;
    const cat=document.getElementById('d-cat');
    if(cat){cat.hidden=false;cat.innerHTML=bankIcon(o.bank_rail,true);}
    const amounts=document.getElementById('d-money');
    if(amounts){amounts.innerHTML=rowsWithSub(rateRows(o));amounts.hidden=false;}
    const fields=document.getElementById('d-box');
    if(fields){fields.innerHTML=rowsWithSub(detailsRows(o));fields.hidden=false;}
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