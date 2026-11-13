/* ALT.VU source preview — deterministic UX-only callbacks.
   This file loads only in the static prototype, never in the production app.
   Preserve the native screens and original form/confirmation handlers. */
(function(){
  'use strict';
  if(!window.altPreview || !window.PV || !PV.data)return;
  const data=PV.data;
  const today=Date.now(),at=n=>new Date(today-n*60000).toISOString();
  const seed=[
    {id:'pv-card-001',kind:'card',status:'credited',amount_minor:-1961,
      orig_minor:7200,orig_currency:'AED',rate:3.6712,fee_minor:0,
      merchant:'CAREEM RIDE DUBAI',title:'CAREEM RIDE DUBAI',mcc:'4121',last4:'9716',
      settled_at:at(9),created_at:at(180)},
    {id:'pv-deposit-002',kind:'deposit',status:'credited',amount_minor:150000,
      amount_crypto:'1500.00',coin:'USDT',network:'tron',title:'Пополнение USDT',
      address:'TDemoSenderAccountNeverUseWithRealFunds',tx_hash:'previewdeposit002',
      created_at:at(240)},
    {id:'pv-withdraw-003',kind:'withdrawal',status:'confirmed',amount_minor:-25500,
      amount_crypto:'250.00',coin:'USDT',network:'tron',fee_minor:100,
      address:'TPreviewRecipientNotARealAddress000000',title:'Вывод USDT',
      created_at:at(1530)},
    {id:'pv-sbp-004',kind:'deposit',status:'credited',network:'sbp',
      title:'Пополнение СБП',amount_minor:10000,fee_minor:0,
      amount_crypto:'8888.00',rate:88.88,address:'Сбербанк',created_at:at(1640)},
    {id:'pv-transfer-005',kind:'transfer',status:'confirmed',amount_minor:-5000,
      fee_minor:0,title:'Перевод в ALT.VU',recipient_name:'Николай К.',
      recipient:'demo.receiver@example.invalid',created_at:at(1900)}
  ];
  const bankNames=[
    {id:'bank100000000111',name:'Сбербанк'},
    {id:'bank100000000004',name:'Т-Банк'},
    {id:'bank100000000005',name:'ВТБ'}
  ];
  const baseNet=data['/networks']&&data['/networks'].networks||[];
  const combos=[
    ['USDT','tron',20],['USDT','bnb',15],['USDT','polygon',15],['USDT','ton',1],
    ['USDC','bnb',15],['USDC','polygon',15]
  ];
  const networks=combos.map(([coin,network,confirmations])=>Object.assign(
    {},baseNet.find(n=>n.coin===coin&&n.network===network)||{},
    {coin,network,key:network,enabled:true,can_deposit:true,can_withdraw:true,
     withdrawal_fee:1,min_withdrawal:5,min_deposit:1,confirmations}
  ));
  data['/networks']={networks,transfer:{deposit:true,withdraw:true},
    sbp:{enabled:true,min_rub:1000,max_rub:250000,quote_minutes:15,link_minutes:10}};
  data['/operations']={operations:seed,next:''};
  // Invalidate network caches created by boot before this late preview adapter runs.
  try{netRules=null;netCache=null;}catch(e){}

  data['/verification']=Object.assign({},data['/verification'],{
    status:'verified',kyc:{status:'approved'},phone:{status:'verified'},card_ready:true,
    move_fees:{transfer_bps:0,transfer_platform_bps:0,
      transfer_brand_bps:0,withdraw_bps:0,withdraw_platform_bps:0,
      withdraw_brand_bps:0}
  });

  let seq=10;
  let nextOutcome='success';
  const sbpOrders=new Map();
  const eventId=kind=>'pv-'+kind+'-'+String(++seq);
  function record(o){
    data['/operations'].operations.unshift(o);
    if(data['/operations'].operations.length>40)data['/operations'].operations.length=40;
    if(typeof loadOps==='function')loadOps();
    return o;
  }
  function amount(value){
    const n=Number(String(value||'0').replace(',','.'));
    return Number.isFinite(n)?n:0;
  }
  function refreshBalance(change){
    const b=data['/balance']||{};
    b.available_minor=Math.max(0,(b.available_minor|0)+change);
    b.balance_minor=b.available_minor;
  }
  // Static visual QR matrix with finder corners. Deliberately non-payment,
  // not intended to encode a real wallet or checkout address.
  function previewQr(label){
    const n=29, cells=Array.from({length:n},()=>Array(n).fill('0'));
    let seed=0;for(const char of label)seed=((seed*33)^char.charCodeAt(0))>>>0;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      seed=(seed*1664525+1013904223)>>>0;
      cells[y][x]=(seed&0x2000)?'1':'0';
    }
    function finder(x0,y0){
      for(let dy=-1;dy<8;dy++)for(let dx=-1;dx<8;dx++){
        const x=x0+dx,y=y0+dy;
        if(x<0||y<0||x>=n||y>=n)continue;
        const a=Math.min(dx,dy,6-dx,6-dy);
        cells[y][x]=(dx>=0&&dy>=0&&dx<7&&dy<7&&(a===0||a>=2))?'1':'0';
      }
    }
    finder(0,0);finder(n-7,0);finder(0,n-7);
    return {size:n,rows:cells.map(row=>row.join(''))};
  }

  const oldPvApi=pvApi;
  pvApi=function(path,body){
    const full=String(path||''),p=full.split('?')[0];
    if(p==='/deposit/address'){
      const params=new URLSearchParams(full.split('?')[1]||'');
      const coin=String(params.get('coin')||'USDT').replace(/[^A-Z]/g,'');
      const network=String(params.get('network')||'tron').replace(/[^a-z]/g,'');
      const address='DEMO_ONLY_'+coin+'_'+network+'_DO_NOT_SEND_REAL_FUNDS';
      return Promise.resolve({address,qr:previewQr(address)});
    }
    if(p==='/profile/qr'||p==='/profile/qr/rotate'){
      const value='ALT.VU OFFLINE PREVIEW - NO REAL TRANSFERS';
      return Promise.resolve({url:'https://example.invalid/altvu-preview',
        qr:previewQr(value+(p.endsWith('rotate')?String(++seq):''))});
    }
    if(p==='/transfer/lookup'){
      if(!body||(!body.value&&!body.contact_id))
        return Promise.reject({slug:'transfer_not_found'});
      return Promise.resolve({name:'Николай К.',can_receive:true});
    }
    if(p==='/transfer'&&body){
      const cents=Math.round(amount(body.amount)*100);
      if(cents<=0||cents>(data['/balance'].available_minor|0))
        return Promise.reject({slug:'insufficient_funds'});
      const id=eventId('transfer');
      record({id,kind:'transfer',title:'Перевод в ALT.VU',status:'confirmed',
        amount_minor:-cents,fee_minor:0,created_at:new Date().toISOString(),
        recipient_name:'Николай К.',recipient:body.value||body.contact_id});
      refreshBalance(-cents);
      return Promise.resolve({id,amount:(cents/100).toFixed(2),name:'Николай К.'});
    }
    if(p==='/withdraw'&&body){
      const cents=Math.round(amount(body.receive_minor));
      if(cents<=0||cents>(data['/balance'].available_minor|0))
        return Promise.reject({slug:'insufficient_funds'});
      const id=eventId('withdraw'),fee=100;
      record({id,kind:'withdrawal',title:'Вывод '+body.coin,
        status:nextOutcome==='pending'?'queued':'broadcast',amount_minor:-cents-fee,
        amount_crypto:(cents/100).toFixed(2),coin:body.coin,network:body.network,
        address:body.address,fee_minor:fee,created_at:new Date().toISOString()});
      refreshBalance(-cents-fee);
      return Promise.resolve({id,amount_crypto:(cents/100).toFixed(2),coin:body.coin});
    }
    if(p==='/sbp/banks')
      return Promise.resolve({banks:bankNames,last:bankNames[0].id,used:[bankNames[0].id]});
    if(p==='/sbp/quote'){
      const rate=88.88;
      const rub=body&&body.rub?Math.round(amount(body.rub)*100):0;
      const usd=body&&body.usd?Math.round(amount(body.usd)*100):0;
      const rubMinor=rub||Math.round(usd*rate);
      const usdMinor=usd||Math.round(rubMinor/rate);
      return Promise.resolve({quote_id:eventId('quote'),rate:String(rate),
        rub_minor:rubMinor,usd_minor:usdMinor,fee_minor:0,
        expires_at:new Date(Date.now()+15*60000).toISOString()});
    }
    if(p==='/sbp/pay'&&body){
      const q=typeof sbp!=='undefined'&&sbp.quote||{};
      if(!body.bank_id||!q.quote_id)return Promise.reject({slug:'sbp_not_ready'});
      const id=eventId('sbp');
      const order={id,status:'wait',bank_id:body.bank_id,
        bank_name:(bankNames.find(b=>b.id===body.bank_id)||{}).name||'Банк',
        usd_minor:q.usd_minor||0,rub_minor:q.rub_minor||0,
        rate:q.rate||'88.88',fee_minor:0,
        qr_url:'https://example.invalid/altvu-demo-only',
        qr:previewQr(id),
        expires_at:new Date(Date.now()+10*60000).toISOString()};
      sbpOrders.set(id,order);
      return Promise.resolve(Object.assign({},order));
    }
    if(p.startsWith('/sbp/')&&sbpOrders.has(p.slice(5)))
      return Promise.resolve(Object.assign({},sbpOrders.get(p.slice(5))));
    return oldPvApi(path,body);
  };

  // In the original screenshot-only preview paintWays was disabled. Restore
  // available method rows without enabling any real backend or network calls.
  const originalPaintWays=paintWays;
  paintWays=function(){
    if(!altPreview)return originalPaintWays();
    const incoming=document.querySelector('#v-topup .m[data-go="dep-sbp"]');
    if(incoming)incoming.hidden=false;
    const seen={dep:[],out:[]};
    networks.forEach(n=>{
      const direction=n.can_deposit?'dep':'out';
      const label=(typeof NETW!=='undefined'&&NETW[n.network]&&NETW[n.network].name)||n.network;
      seen[direction].push(label);
      if(n.can_withdraw)seen.out.push(label);
    });
    for(const dir of ['dep','out']){
      const root=document.getElementById('v-'+(dir==='dep'?'topup':'withdraw'));
      if(!root)continue;
      root.querySelectorAll('.m[data-go^="'+dir+'-"]').forEach(row=>{
        const coin=row.dataset.go.split('-')[1].toUpperCase();
        const active=networks.filter(n=>n.coin===coin&&n['can_'+(dir==='dep'?'deposit':'withdraw')]);
        row.hidden=!active.length;
      });
    }
  };
  paintWays();
  const originalSbpOpenBank=sbpOpenBank;
  sbpOpenBank=function(order){
    if(!altPreview)return originalSbpOpenBank(order);
    msg('','Тестовая сборка: откройте «Тестовые события» и выберите результат пополнения.');
  };
  const originalLoadOps=loadOps;
  loadOps=async function(){
    if(!altPreview)return originalLoadOps();
    const ops=data['/operations'].operations||[];
    allOps=ops;
    const home=document.querySelector('#v-home > .wrap');
    if(home){
      let feed=home.querySelector('.feed');
      if(!feed){
        home.querySelectorAll(':scope > .d, :scope > .grp').forEach(el=>el.remove());
        feed=document.createElement('div');feed.className='feed';home.appendChild(feed);
      }
      feed.innerHTML=groupOps(ops.slice(0,5))+
        '<button type="button" class="btno allops" data-act="all-ops">Все операции</button>';
      feed.querySelectorAll('.op[data-id]').forEach(row=>{row.tabIndex=0;row.setAttribute('role','button');});
    }
    const topup=document.querySelector('#v-topup .bgfeed');
    const withdraw=document.querySelector('#v-withdraw .bgfeed');
    [topup,withdraw].filter(Boolean).forEach(el=>el.innerHTML=groupOps(ops.slice(0,3)));
  };
  // The generated rows in the home feed have to open the native transaction
  // details view. Use one delegated listener because loadOps rebuilds the feed.
  function openPreviewOperation(event){
    const row=event.target.closest&&event.target.closest('.op[data-id]');
    if(!row||!row.closest('.view'))return;
    const op=(data['/operations'].operations||[])
      .find(item=>String(item.id)===String(row.dataset.id));
    if(!op)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openOp(op);
  }
  document.addEventListener('click',openPreviewOperation,true);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    if(!event.target.matches('.op[data-id]'))return;
    openPreviewOperation(event);
  },true);
  // Load the history after the standard preview boot has finished.
  Promise.resolve().then(()=>loadOps());

  function failScreen(title,description,returnView){
    let section=document.getElementById('v-preview-failed');
    if(!section){
      section=document.createElement('section');
      section.id='v-preview-failed';section.className='view';
      section.innerHTML='<div class="tint"></div><div class="wrap" style="padding-top:130px">'+
        '<div class="hero"><div class="okc" style="background:var(--n100)">'+
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--n850)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+
        '<path d="M7 7l10 10M17 7 7 17"/></svg></div>'+
        '<div class="h2" id="pv-fail-title"></div><div class="p" id="pv-fail-desc"></div></div></div>'+
        '<div class="foot"><button class="btn" type="button" id="pv-fail-retry">Изменить данные</button>'+
        '<button class="btno" type="button" id="pv-fail-home" style="margin-top:12px">На главную</button></div>';
      document.querySelector('.phone').appendChild(section);
      section.querySelector('#pv-fail-home').addEventListener('click',()=>{stack.length=0;show('home',false);});
    }
    section.querySelector('#pv-fail-title').textContent=title;
    section.querySelector('#pv-fail-desc').textContent=description;
    section.querySelector('#pv-fail-retry').onclick=function(){
      show(returnView,false);
      if(returnView==='withdraw-check'||returnView==='transfer-check')return;
      afterShow(returnView);
    };
    show('preview-failed',false);
  }
  const realTrSubmit=trSubmit;
  trSubmit=async function(pin,confirm){
    if(nextOutcome==='pending'){
      const cents=Math.round(amount((document.getElementById('trc-go')||{}).dataset&&
        document.getElementById('trc-go').dataset.minor||0));
      const op=record({id:eventId('tr-pending'),kind:'transfer',status:'queued',
        title:'Перевод в ALT.VU',amount_minor:-cents,fee_minor:0,
        created_at:new Date().toISOString(),preview_unsettled:true,
        recipient_name:'Николай К.',recipient:'demo.receiver@example.invalid'});
      openOp(op);return;
    }
    if(nextOutcome!=='failed')return realTrSubmit(pin,confirm);
    const cents=Math.round(amount((document.getElementById('trc-go')||{}).dataset&&
      document.getElementById('trc-go').dataset.minor||0));
    record({id:eventId('tr-failed'),kind:'transfer',status:'failed',
      title:'Перевод в ALT.VU',amount_minor:-cents,fee_minor:0,created_at:new Date().toISOString()});
    failScreen('Перевод не выполнен','Демонстрационный отказ. Деньги не списаны.','transfer-check');
  };
  const realWdSubmit=wdSubmit;
  wdSubmit=async function(pin,confirm){
    if(nextOutcome!=='failed')return realWdSubmit(pin,confirm);
    const root=document.getElementById('v-'+wdFormVid);
    const val=root&&root.querySelector('.wd-amt');
    const cents=Math.round(amount(val&&val.value)*100);
    const parts=wdFormVid.split('-');
    record({id:eventId('wd-failed'),kind:'withdrawal',status:'failed',
      coin:(parts[1]||'USDT').toUpperCase(),network:parts[2]||'tron',
      amount_minor:-cents,fee_minor:0,created_at:new Date().toISOString()});
    failScreen('Вывод не выполнен','Демонстрационный отказ. Проверьте реквизиты и повторите.','withdraw-check');
  };

  function activeDeposit(){
    const v=String(view||'');
    return /^dep-(usdt|usdc)-/.test(v)?v.split('-'):null;
  }
  function depositCallback(status){
    const p=activeDeposit();
    if(!p){if(typeof msg==='function')msg('','Откройте пополнение USDT или USDC');return;}
    const success=status==='credited';
    const op=record({id:eventId('deposit'),kind:'deposit',
      title:'Пополнение '+p[1].toUpperCase(),coin:p[1].toUpperCase(),
      network:p[2],status:success?'credited':status==='review'?'confirming':'rejected',
      state:status==='review'?'review':'',amount_minor:success?10000:0,
      amount_crypto:'100.00',fee_minor:0,created_at:new Date().toISOString(),
      address:'DemoSourceNotRealWalletAddress',tx_hash:'preview-only'});
    if(success)refreshBalance(10000);
    openOp(op);
  }
  function internalDepositCallback(){
    const op=record({id:eventId('internal'),kind:'transfer',status:'confirmed',
      amount_minor:10000,fee_minor:0,recipient_name:'Тестовый отправитель',
      title:'Перевод от тестового пользователя ALT.VU',
      created_at:new Date().toISOString()});
    refreshBalance(10000);
    openOp(op);
  }
  function sbpCallback(status){
    if(typeof sbp==='undefined'||!sbp.dep){
      if(typeof msg==='function')msg('','Откройте СБП и создайте оплату');return;
    }
    const rec=sbpOrders.get(sbp.dep.id);
    if(!rec)return;
    rec.status=status;
    if(status==='ok'||status==='fail'){
      const cents=rec.usd_minor||0;
      record({id:rec.id,kind:'deposit',network:'sbp',title:'Пополнение СБП',
        amount_minor:status==='ok'?cents:0,status:status==='ok'?'credited':'rejected',
        amount_crypto:(rec.rub_minor/100).toFixed(2),rate:rec.rate,
        address:rec.bank_name,created_at:new Date().toISOString()});
      if(status==='ok')refreshBalance(cents);
    }
    sbpCheck();
  }

  function bankCallback(status){
    const overlay=document.querySelector('#tf-bank-overlay');
    const frame=overlay&&overlay.querySelector('iframe');
    if(!frame||overlay.hidden||getComputedStyle(overlay).display==='none'){
      msg('','Откройте SEPA или SWIFT для проверки результата');return;
    }
    try{
      const bridge=frame.contentWindow&&frame.contentWindow.uxBankCallback;
      if(typeof bridge!=='function'||!bridge(status))
        msg('','Сначала откройте подтверждение / ожидание банковской операции');
    }catch(_){msg('','Не удалось связаться с экраном SEPA/SWIFT');}
  }
  function settlePending(status){
    const ops=data['/operations'].operations||[];
    const op=ops.find(item=>item.preview_unsettled||['queued','broadcast','confirming'].includes(item.status));
    if(!op){msg('','Нет операции, ожидающей callback');return;}
    const isSuccess=status==='success';
    if(op.preview_unsettled&&isSuccess&&op.kind==='transfer'){
      refreshBalance(op.amount_minor);
    }
    if(!op.preview_unsettled&&!isSuccess&&op.kind==='withdrawal'&&op.status!=='rejected'){
      refreshBalance(-op.amount_minor);
    }
    op.status=isSuccess?(op.kind==='deposit'?'credited':'confirmed'):
      status==='held'?'confirming':'rejected';
    op.preview_unsettled=status==='held';
    loadOps();
    openOp(op);
  }
  function qa(){
    if(new URLSearchParams(location.search).get('qa')!=='1')return;
    const css=document.createElement('style');
    css.textContent='#pv-qa{position:fixed;right:12px;bottom:12px;width:210px;max-width:48vw;'+
      'background:white;border:1px solid #dfe3df;box-shadow:0 4px 25px #0002;border-radius:14px;'+
      'z-index:200;box-sizing:border-box;padding:12px;color:#1e241e;font:12px/1.4 Inter,sans-serif;max-height:76vh;overflow-y:auto}'+
      '#pv-qa h3{font-size:13px;margin:0 0 8px}#pv-qa select,#pv-qa button{box-sizing:border-box;'+
      'width:100%;min-height:34px;margin:0 0 7px;border:1px solid #d6dcd6;border-radius:8px;'+
      'background:#f5f7f5;color:#1e241e;font:inherit;padding:6px}#pv-qa button{cursor:pointer}'+
      '@media(max-width:600px){#pv-qa{max-width:none;width:175px;padding:8px;right:6px;bottom:5px}}';
    document.head.appendChild(css);
    const bar=document.createElement('aside');bar.id='pv-qa';
    bar.innerHTML='<h3>Тестовые события</h3><label>Следующий результат<select id="pv-outcome">'+
      '<option value="success">Успех</option><option value="failed">Ошибка</option>'+
      '<option value="pending">В обработке</option></select></label>'+
      '<button id="pv-deposit-ok">Пополнение: успех</button>'+
      '<button id="pv-deposit-review">Пополнение: проверка</button>'+
      '<button id="pv-internal-ok">ALT.VU: входящий перевод</button>'+
      '<button id="pv-sbp-ok">СБП callback: успех</button>'+
      '<button id="pv-sbp-fail">СБП callback: ошибка</button>'+
      '<button id="pv-deposit-fail">Пополнение: ошибка</button>'+
      '<details><summary>Callback SEPA / SWIFT</summary>'+
      '<button id="pv-bank-ok">Банк: успех</button>'+
      '<button id="pv-bank-fail">Банк: ошибка</button>'+
      '<button id="pv-bank-held">Банк: проверка</button>'+
      '<button id="pv-bank-pending">Банк: ожидание</button></details>'+
      '<details><summary>Callback исходящей операции</summary>'+
      '<button id="pv-settle-ok">Операция: успех</button>'+
      '<button id="pv-settle-fail">Операция: ошибка</button>'+
      '<button id="pv-settle-held">Операция: проверка</button></details>'+
      '<button id="pv-open-last">Детали последней операции</button>'+
      '<small>Только локальный UX-макет. Платежи не отправляются.</small>';
    document.body.appendChild(bar);
    bar.querySelector('#pv-outcome').onchange=e=>{nextOutcome=e.target.value;};
    bar.querySelector('#pv-deposit-ok').onclick=()=>depositCallback('credited');
    bar.querySelector('#pv-deposit-review').onclick=()=>depositCallback('review');
    bar.querySelector('#pv-deposit-fail').onclick=()=>depositCallback('rejected');
    bar.querySelector('#pv-bank-ok').onclick=()=>bankCallback('success');
    bar.querySelector('#pv-bank-fail').onclick=()=>bankCallback('failed');
    bar.querySelector('#pv-bank-held').onclick=()=>bankCallback('held');
    bar.querySelector('#pv-bank-pending').onclick=()=>bankCallback('pending');
    bar.querySelector('#pv-settle-ok').onclick=()=>settlePending('success');
    bar.querySelector('#pv-settle-fail').onclick=()=>settlePending('failed');
    bar.querySelector('#pv-settle-held').onclick=()=>settlePending('held');
    bar.querySelector('#pv-internal-ok').onclick=()=>internalDepositCallback();
    bar.querySelector('#pv-sbp-ok').onclick=()=>sbpCallback('ok');
    bar.querySelector('#pv-sbp-fail').onclick=()=>sbpCallback('fail');
    bar.querySelector('#pv-open-last').onclick=()=>openOp(data['/operations'].operations[0]);
  }
  qa();
})();
