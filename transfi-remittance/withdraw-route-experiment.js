/* alt.vu experiment: shared from/to route for USDT, USDC, ALT.VU.
   The established native review, PIN and local preview callbacks remain in use. */
(function(){
  'use strict';
  if(!window.altPreview || !window.PV || !document.querySelector('.phone'))return;
  const E=id=>document.getElementById(id);
  const methods={
    usdt:{coin:'USDT',title:'Вывод USDT',logo:'../assets/img-df9900c4.png',network:'tron'},
    usdc:{coin:'USDC',title:'Вывод USDC',logo:'../assets/img-a82008b8.png',network:'polygon'},
    altvu:{coin:'ALT.VU',title:'Перевод в ALT.VU',logo:'../assets/img-27f3d8cf.png',network:''}
  };
  const names={tron:'TRC20',bnb:'BEP-20',polygon:'Polygon',ton:'TON'};
  const state={method:'usdt',network:'tron',address:'',scannedCode:'',amount:'',balanceMinor:0,busy:false};
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const moneyText=cents=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
  const arrow='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--n850)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v15m-6-6 6 6 6-6"/></svg>';
  const chevron='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--n500)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 5 7 7-7 7"/></svg>';
  const link=document.createElement('link');link.rel='stylesheet';link.href='./withdraw-route-experiment.css';document.head.appendChild(link);

  const head=document.querySelector('#v-out-usdt-tron > .head');
  if(!head)return;
  const screen=document.createElement('section');
  screen.className='view';screen.id='v-exp-route';
  screen.style.cssText='--t-op:.42;--t-blur:26px;--t-h:300px;--t-mask:linear-gradient(180deg,#000 0%,#000 46%,transparent 100%)';
  screen.innerHTML='<div class="tint"></div>'+head.outerHTML+
    '<div class="wrap tight">'+
    '<div class="box exp-route-card" data-experiment="route-card">'+
      '<div class="exp-leg">'+
        '<div class="fi"><div class="cn" style="width:40px;height:40px"><img src="../assets/img-27f3d8cf.png" width="24" height="24" alt="alt.vu" style="border-radius:999px"></div></div>'+
        '<div class="exp-leg-main fl">'+
          '<i>Откуда → ALT.VU</i>'+
          '<b id="exp-balance" aria-live="polite">—</b>'+
        '</div>'+
      '</div>'+
      '<div class="exp-arrow-line"><span class="exp-arrow">'+arrow+'</span></div>'+
      '<div class="exp-leg">'+
        '<div class="fi"><div class="cn" style="width:40px;height:40px"><img id="exp-dest-logo" src="../assets/img-df9900c4.png" width="24" height="24" alt="" style="border-radius:999px"></div></div>'+
        '<div class="exp-leg-main fl">'+
          '<i id="exp-dest-label">Куда → USDT</i>'+
          '<input id="exp-recipient" class="exp-recipient" aria-label="Адрес получателя" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Адрес кошелька">'+
        '</div>'+
      '</div>'+
      '<div id="exp-actions-slot"></div>'+
    '</div>'+
    '<div id="exp-network-slot"></div>'+
    '<div class="fld w exp-amount-field">'+
      '<div class="fi"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--n850)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="6.4" rx="7.4" ry="3.1"></ellipse><path d="M4.6 6.4v5.2c0 1.7 3.3 3.1 7.4 3.1s7.4-1.4 7.4-3.1V6.4"></path><path d="M4.6 11.6v5.2c0 1.7 3.3 3.1 7.4 3.1s7.4-1.4 7.4-3.1v-5.2"></path></svg></div>'+
      '<div class="fl"><i>Сумма перевода</i><b><input id="exp-amount" class="wd-amt" inputmode="decimal" placeholder="0.00" aria-label="Сумма перевода в долларах"></b></div>'+
      '<div class="addon"><span class="cur">$</span><span class="mx wd-max" id="exp-max" role="button" tabindex="0" aria-label="Вся доступная сумма">MAX</span></div>'+
    '</div>'+
    '<div class="exp-limit" id="exp-limit"></div>'+
    '<p class="exp-note" id="exp-note"></p>'+
    '</div>'+
    '<div class="foot"><div class="exp-error" id="exp-error" role="alert"></div><button class="btn" type="button" id="exp-next">Продолжить</button></div>'+
    '<div class="dim exp-dim" id="exp-network-dim" hidden></div>'+
    '<div class="sheet exp-sheet" id="exp-network-sheet" role="dialog" aria-label="Выбор сети" hidden>'+
      '<div class="grab"></div><div class="sh2">Сеть перевода</div>'+
      '<div class="p">Выберите сеть, которой принадлежит адрес получателя.</div>'+
      '<div class="box" id="exp-network-options"></div>'+
    '</div>';
  document.querySelector('.phone').appendChild(screen);

  // Keep the exact existing network input anatomy, including its real logo
  // and chevron. The input has button semantics because it opens a sheet.
  const nativeNet=document.querySelector('#v-out-usdt-tron .fld.w.net-pick');
  if(!nativeNet)return;
  const netField=document.createElement('button');
  netField.type='button';
  netField.id='exp-net-toggle';
  netField.className='fld w net-pick exp-net-toggle';
  netField.setAttribute('aria-haspopup','dialog');
  netField.setAttribute('aria-controls','exp-network-sheet');
  netField.setAttribute('aria-expanded','false');
  netField.innerHTML=nativeNet.innerHTML;
  netField.querySelector('.fi .nlg').id='exp-net-icon';
  netField.querySelector('.fl b').id='exp-net-value';
  E('exp-network-slot').replaceChildren(netField);

  // Copy the native two-action row from the original matching method.
  // Remove the old data-act hooks: they target invisible source screens.
  function paintRecipientActions(){
    const selector=state.method==='altvu'?'#v-transfer #tr-who .uzones':
                                           '#v-out-usdt-tron .unit .uzones';
    const original=document.querySelector(selector);
    if(!original)return;
    const actions=document.createElement('div');
    actions.className='uzones exp-actions';
    [...original.querySelectorAll('.uzone')].slice(0,2).forEach((originalButton,index)=>{
      const button=originalButton.cloneNode(true);
      button.removeAttribute('data-act');
      button.removeAttribute('hidden');
      button.removeAttribute('id');
      button.id=index===0?'exp-paste':'exp-scan';
      actions.appendChild(button);
    });
    E('exp-actions-slot').replaceChildren(actions);
  }

  const to=E('exp-recipient'),amt=E('exp-amount');
  function say(text){E('exp-error').textContent=text||'';}
  function networks(){
    const coin=methods[state.method].coin;
    const all=PV.data['/networks']&&PV.data['/networks'].networks||[];
    return all.filter(n=>n.coin===coin&&n.enabled!==false&&n.can_withdraw!==false&&
      !!E('v-out-'+coin.toLowerCase()+'-'+n.network)).map(n=>n.network).filter((n,i,a)=>a.indexOf(n)===i);
  }
  function activeRule(){
    const all=PV.data['/networks']&&PV.data['/networks'].networks||[];
    return all.find(n=>n.coin===methods[state.method].coin&&n.network===state.network)||{};
  }
  function networkFee(){
    if(state.method==='altvu')return 0;
    const n=Number(activeRule().withdrawal_fee);
    return Math.round((Number.isFinite(n)&&n>=0?n:1)*100);
  }
  function serviceFee(cents){
    try{return mvFee(state.method==='altvu'?'transfer':'withdraw',cents)||0;}
    catch(e){return 0;}
  }
  function maximum(){
    const available=Math.max(0,state.balanceMinor-networkFee());
    let lo=0,hi=available;
    while(lo<hi){
      const mid=Math.ceil((lo+hi)/2);
      if(mid+serviceFee(mid)<=available)lo=mid;
      else hi=mid-1;
    }
    return lo;
  }
  function balancePaint(){
    E('exp-balance').textContent=moneyText(state.balanceMinor)+' $';
    E('exp-limit').innerHTML='Максимум с учётом комиссии: <b>'+moneyText(maximum())+' $</b>';
  }
  async function refreshBalance(){
    try{
      const response=await api('/balance',null,true);
      if(response&&Number.isFinite(Number(response.available_minor)))
        state.balanceMinor=Number(response.available_minor);
    }catch(e){
      const fallback=PV.data['/balance']||{};
      state.balanceMinor=Number(fallback.available_minor)||0;
    }
    balancePaint();
  }
  function paint(){
    const m=methods[state.method];
    screen.querySelector('.h1').textContent=m.title;
    const icon=E('exp-dest-logo');icon.src=m.logo;icon.alt=m.coin;
    E('exp-dest-label').textContent='Куда → '+m.coin;
    to.setAttribute('aria-label',state.method==='altvu'?'Получатель ALT.VU':'Адрес получателя');
    to.placeholder=state.method==='altvu'?'Почта или телефон':'Адрес кошелька';
    to.inputMode=state.method==='altvu'?'email':'text';
    to.value=state.address;amt.value=state.amount;
    E('exp-net-toggle').hidden=state.method==='altvu';
    E('exp-net-value').textContent=names[state.network]||state.network;
    E('exp-net-icon').className='nlg '+state.network;
    E('exp-net-toggle').setAttribute('aria-label','Сеть: '+(names[state.network]||state.network));
    paintRecipientActions();
    E('exp-note').textContent=state.method==='altvu'?
      'Получатель должен иметь счёт ALT.VU. Имя проверим перед подтверждением.':
      'Проверьте адрес и сеть. Перевод в криптосети нельзя отменить.';
    balancePaint();say('');
  }
  function open(method){
    if(!methods[method])return;
    state.method=method;state.network=methods[method].network;
    state.address='';state.scannedCode='';state.amount='';
    if(method!=='altvu'&&!networks().includes(state.network))
      state.network=networks()[0]||state.network;
    paint();show('exp-route');refreshBalance();
  }
  function closeSheet(){
    E('exp-network-dim').hidden=true;
    E('exp-net-toggle').setAttribute('aria-expanded','false');
    const sheet=E('exp-network-sheet');
    sheet.hidden=true;sheet.classList.remove('pop','settled','slide');sheet.style.transform='';
  }
  function pickNetwork(){
    if(state.method==='altvu')return;
    const available=networks();
    if(!available.length){say('Для выбранной валюты нет доступных сетей');return;}
    E('exp-network-options').innerHTML=available.map(n=>
      '<button type="button" class="exp-picker-button" data-exp-net="'+esc(n)+'" role="radio" aria-checked="'+String(n===state.network)+'">'+
      '<div class="ri">'+(typeof netLogo==='function'?netLogo(n):'<i class="nlg '+esc(n)+'"></i>')+'</div>'+
      '<div class="rt">'+esc(names[n]||n)+'</div>'+
      '<span class="rd'+(state.network===n?' on':'')+'"></span></button>').join('');
    if(typeof sheetOpen==='function')sheetOpen(E('exp-network-dim'),E('exp-network-sheet'));
    else {E('exp-network-dim').hidden=false;E('exp-network-sheet').hidden=false;}
    E('exp-net-toggle').setAttribute('aria-expanded','true');
    const chosen=E('exp-network-options').querySelector('[aria-checked="true"]')||
                 E('exp-network-options').querySelector('button');
    if(chosen)chosen.focus({preventScroll:true});
  }
  function fillMax(){
    state.amount=(maximum()/100).toFixed(2);amt.value=state.amount;say('');
  }
  function setRecipient(value,code){
    to.value=value;
    state.address=value;
    state.scannedCode=code ? value : '';
    say('');
  }
  async function pasteRecipient(){
    let raw='';
    try{
      if(!navigator.clipboard || !navigator.clipboard.readText)throw Error('clipboard');
      raw=String(await navigator.clipboard.readText()||'').trim();
    }catch(e){
      say('Не удалось прочитать буфер обмена. Вставьте адрес вручную.');
      to.focus();return;
    }
    if(!raw){say('Буфер обмена пуст');to.focus();return;}
    const parsed=qrAddress(raw);
    if(state.method==='altvu'){
      setRecipient(parsed.kind==='code'?parsed.value:raw,parsed.kind==='code');
    }else{
      if(parsed.kind==='code'){
        say('Это код ALT.VU, а не адрес криптокошелька');return;
      }
      setRecipient(parsed.value,false);
    }
  }
  async function scanRecipient(){
    const inside=state.method==='altvu';
    await scanQR({
      hint:inside?'Наведите камеру на код alt.vu':'Наведите камеру на QR-код кошелька',
      sub:inside?'Код есть у каждого: «Пополнить» → ALT.VU':
                 'Нужен адрес сети '+netName(state.network),
      say,
      take:r=>{
        if(inside && r.kind!=='code'){
          say('Это не код ALT.VU. Для перевода по почте или телефону используйте поле ввода.');
          return false;
        }
        if(!inside && r.kind==='code'){
          say('Это код ALT.VU, а не адрес криптокошелька');
          return false;
        }
        if(!r.value)return false;
        setRecipient(r.value,inside);
        return true;
      }
    });
  }
  E('exp-actions-slot').addEventListener('click',e=>{
    const action=e.target.closest('#exp-paste, #exp-scan');
    if(!action)return;
    e.preventDefault();
    if(action.id==='exp-paste')pasteRecipient();
    else scanRecipient();
  });
  to.addEventListener('input',()=>{state.address=to.value;state.scannedCode='';say('');});
  amt.addEventListener('input',()=>{state.amount=amt.value;say('');});
  // The native delegated '.wd-max' handler expects data-avail on its own
  // crypto view. Prevent that handler from blanking this composite amount.
  E('exp-max').addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();fillMax();
  });
  E('exp-max').addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();fillMax();}
  });
  E('exp-net-toggle').addEventListener('click',pickNetwork);
  E('exp-network-options').addEventListener('click',e=>{
    const row=e.target.closest('[data-exp-net]');
    if(!row)return;
    state.network=row.dataset.expNet;
    state.address='';state.scannedCode='';to.value='';
    E('exp-net-value').textContent=names[state.network]||state.network;
    E('exp-net-icon').className='nlg '+state.network;
    E('exp-net-toggle').setAttribute('aria-label','Сеть: '+(names[state.network]||state.network));
    balancePaint();closeSheet();E('exp-net-toggle').focus({preventScroll:true});say('');
  });
  E('exp-network-options').addEventListener('keydown',e=>{
    if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
    const rows=[...E('exp-network-options').querySelectorAll('[data-exp-net]')];
    const idx=rows.indexOf(document.activeElement);
    if(!rows.length)return;
    e.preventDefault();
    const next=e.key==='Home'?0:e.key==='End'?rows.length-1:
      (idx+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length;
    rows[next].focus();
  });
  E('exp-network-dim').addEventListener('click',closeSheet);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!E('exp-network-sheet').hidden){
      e.preventDefault();e.stopImmediatePropagation();closeSheet();
    }
  },true);
  document.addEventListener('click',e=>{
    if(e.target.closest('#v-exp-route .back')&&!E('exp-network-sheet').hidden){
      e.preventDefault();e.stopImmediatePropagation();closeSheet();
    }
  },true);

  async function next(){
    if(state.busy)return;
    const address=to.value.trim(),value=amt.value.trim().replace(',','.');
    const cents=Math.round(Number(value)*100);
    if(!/^\d+(?:\.\d{1,2})?$/.test(value)||!Number.isFinite(cents)||cents<=0){
      say('Введите сумму больше нуля');return;
    }
    if(!address){say(state.method==='altvu'?'Введите почту или телефон':'Введите адрес кошелька');return;}
    if(state.method!=='altvu'&&address.length<20){
      say('Проверьте адрес: он слишком короткий');return;
    }
    if(state.method!=='altvu'&&!networks().includes(state.network)){
      say('Выберите доступную сеть');return;
    }
    const verify=PV.data['/verification'];
    if(verify&&verify.kyc&&verify.kyc.status!=='approved'){
      say('Для перевода пройдите проверку личности');return;
    }
    if(cents+networkFee()+serviceFee(cents)>state.balanceMinor){
      say('Недостаточно средств с учётом комиссии');return;
    }
    state.busy=true;E('exp-next').disabled=true;say('');
    try{
      if(state.method==='altvu'){
        await trOpen(); // Existing lookup/account validation + confirmation.
        E('tr-to').value=address;E('tr-amt').value=(cents/100).toFixed(2);
        if(state.scannedCode && state.scannedCode===address){
          await trFind('code',address);
        }else{
          await trLookup();
        }
        if(!trTo){say('Получатель не найден или указан некорректно');return;}
        trCheck();
      }else{
        const viewId='out-'+state.method+'-'+state.network;
        const native=E('v-'+viewId);
        if(!native)throw Error('Выбранная сеть недоступна');
        await loadWithdraw(viewId);
        const fee=Number(native.dataset.fee)||0;
        const min=Number(native.dataset.min)||0;
        if(cents/100<min){
          say('Минимальная сумма для сети — '+min.toFixed(2)+' $');return;
        }
        const service=serviceFee(cents)/100;
        if(cents/100+fee+service>Number(native.dataset.avail||0)){
          say('Недостаточно средств с учётом комиссии сети');return;
        }
        native.querySelector('.wd-addr').value=address;
        native.querySelector('.wd-amt').value=(cents/100).toFixed(2);
        wdCheck(native,address,cents/100,fee,service);
      }
    }catch(e){say((e&&e.message)||'Не удалось подготовить перевод');}
    finally{state.busy=false;E('exp-next').disabled=false;}
  }
  E('exp-next').addEventListener('click',next);

  // Only intercept withdrawal method rows. All other existing flows untouched.
  document.addEventListener('click',function(e){
    const row=e.target.closest('#v-withdraw .sheet .m[data-go]');
    if(!row)return;
    const path=row.dataset.go||'';
    const method=path.startsWith('out-usdt-')?'usdt':
      path.startsWith('out-usdc-')?'usdc':path==='transfer'?'altvu':null;
    if(!method)return;
    e.preventDefault();e.stopImmediatePropagation();open(method);
  },true);

  // Deep links make each variant independently inspectable from the UI Kit.
  const qs=new URLSearchParams(location.search);
  if(qs.get('experiment')==='withdraw'){
    const method=(qs.get('mode')||'usdt').toLowerCase();
    setTimeout(()=>{
      if(typeof show!=='function')return;
      show('withdraw',false);
      open(methods[method]?method:'usdt');
    },650);
  }
  window.altWithdrawRouteExperiment={open,closeSheet,state};
})();