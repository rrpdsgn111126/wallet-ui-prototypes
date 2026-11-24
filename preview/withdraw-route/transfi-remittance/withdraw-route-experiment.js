/* alt.vu experiment: shared from/to route for USDT, USDC, ALT.VU.
   The established native review, PIN and local preview callbacks remain in use. */
(function(){
  'use strict';
  if(!window.altPreview || !window.PV || !document.querySelector('.phone'))return;
  // Experiment-only QR link revision; no change to shared DS preview runtime.
  const sharedQrPreviewApi = pvApi;
  let receiveLinkRevision = 1;
  pvApi = function(path, body) {
    const p = String(path || '').split('?')[0];
    if(p === '/profile/qr' || p === '/profile/qr/rotate') {
      if(p.endsWith('/rotate')) receiveLinkRevision++;
      return Promise.resolve(sharedQrPreviewApi(path, body)).then(payload =>
        Object.assign({}, payload, {url: 'https://example.invalid/altvu-receive-' + receiveLinkRevision})
      );
    }
    return sharedQrPreviewApi(path, body);
  };

  // The UI Kit embeds only the live from/to component, without a full screen.
  // It is still the same DOM and handlers as the working experiment.
  if(new URLSearchParams(location.search).get('component')==='route-card'){
    document.documentElement.classList.add('exp-route-specimen');
  }
  const E=id=>document.getElementById(id);
  const methods={
    usdt:{coin:'USDT',title:'Вывод USDT',logo:'../assets/img-df9900c4.png',network:'tron'},
    usdc:{coin:'USDC',title:'Вывод USDC',logo:'../assets/img-a82008b8.png',network:'polygon'},
    altvu:{coin:'ALT.VU',title:'Перевод в ALT.VU',logo:'../assets/img-27f3d8cf.png',network:''}
  };
  const names={tron:'TRC20',bnb:'BEP-20',polygon:'Polygon',ton:'TON'};
  const state={method:'usdt',network:'tron',address:'',scannedCode:'',amount:'',balanceMinor:0,busy:false,networkCatalog:null,sheetBusy:false};
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const moneyText=cents=>groupAmount((cents/100).toFixed(2));
  // Display 7 whole digits + 2 decimals like 9 999 999.01; calculations use ungrouped decimals.
  const MAX_AMOUNT_MINOR=999999999;
  function cleanAmount(raw){
    const str=String(raw||'').replace(/[\s\u00a0\u202f]/g,'').replace(/,/g,'.').replace(/[^\d.]/g,'');
    const dot=str.indexOf('.');
    let whole=(dot<0?str:str.slice(0,dot)).replace(/^0+(?=\d)/,'').slice(0,7);
    const decimals=dot<0?'':str.slice(dot+1).replace(/\D/g,'').slice(0,2);
    if(dot>=0&&!whole)whole='0';
    return whole+(dot>=0?'.'+decimals:'');
  }
  function groupAmount(value){
    const raw=String(value||'');
    const dot=raw.indexOf('.');
    const whole=(dot<0?raw:raw.slice(0,dot)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
    return whole+(dot<0?'':raw.slice(dot));
  }
  if(!window.AltvuRouteCard)throw new Error('Shared route-card module is missing');
  const routeCss=document.createElement('link');routeCss.rel='stylesheet';
  routeCss.href='../../design-system/transfi-remittance/route-card.css';
  document.head.appendChild(routeCss);
  if(!document.querySelector('link[data-exp-route-css]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./withdraw-route-experiment.css';link.dataset.expRouteCss='1';document.head.appendChild(link);}

  const head=document.querySelector('#v-out-usdt-tron > .head');
  if(!head)return;
  const screen=document.createElement('section');
  screen.className='view';screen.id='v-exp-route';
  screen.style.cssText='--t-op:.42;--t-blur:26px;--t-h:300px;--t-mask:linear-gradient(180deg,#000 0%,#000 46%,transparent 100%)';
  screen.innerHTML='<div class="tint"></div>'+head.outerHTML+
    '<div class="wrap tight">'+
    window.AltvuRouteCard.render({
      variant:'crypto',
      source:{
        iconHtml:'<img src="../assets/img-27f3d8cf.png" width="20" height="20" alt="alt.vu" style="border-radius:999px">',
        label:'Откуда → ALT.VU',
        contentHtml:'<b id="exp-balance" aria-live="polite">—</b>'
      },
      destination:{
        iconHtml:'<img id="exp-dest-logo" src="../assets/img-df9900c4.png" width="20" height="20" alt="" style="border-radius:999px">',
        label:'Куда → USDT',
        labelId:'exp-dest-label',
        contentHtml:'<input id="exp-recipient" class="exp-recipient" aria-label="Адрес получателя" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Адрес кошелька">',
      },
      actionsHtml:'<div id="exp-actions-slot"></div>'
    })+
    '<div id="exp-network-slot"></div>'+
    '<div class="fld w exp-amount-field">'+
      '<div class="fl"><i>Сумма перевода</i><b><input id="exp-amount" class="wd-amt" inputmode="decimal" placeholder="0.00" aria-label="Сумма перевода в долларах"></b></div>'+
      '<div class="addon"><span class="cur">$</span></div>'+
    '</div>'+
    '<div class="exp-limit"><button id="exp-use-all" class="exp-use-all" type="button">Использовать всё: <span id="exp-max-value" aria-live="polite">0.00 $</span></button></div>'+
    '<p class="exp-note" id="exp-note"></p>'+
    '</div>'+
    '<div class="foot"><div class="exp-error" id="exp-error" role="alert"></div><button class="btn" type="button" id="exp-next">Продолжить</button></div>'+
    '';
  document.querySelector('.phone').appendChild(screen);

  // Clone the exact selector from USDT DEPOSIT, removing only the native
  // data-act handler that otherwise navigates to a deposit screen.
  const depositField=document.querySelector('#v-dep-usdt-tron .fld.w.net-pick');
  const nativeDim=document.querySelector('.phone > .ns-dim');
  const nativeSheet=document.querySelector('.phone > .ns-sheet');
  if(!depositField||!nativeDim||!nativeSheet)return;
  const netField=depositField.cloneNode(true);
  netField.removeAttribute('data-act');
  netField.id='exp-net-toggle';
  netField.setAttribute('role','button');
  netField.setAttribute('tabindex','0');
  netField.setAttribute('aria-haspopup','dialog');
  netField.setAttribute('aria-expanded','false');
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
  // Deposits use netAll() with "key"; preview fixtures use "network".
  // Limit the same native catalogue to enabled withdrawal routes.
  function nativeNetworkRows(){
    const coin=methods[state.method].coin;
    const fallback=PV.data['/networks']&&PV.data['/networks'].networks||[];
    const all=state.networkCatalog||fallback;
    return all.map(n=>({...n,key:n.key||n.network}))
      .filter(n=>n.coin===coin&&n.enabled!==false&&n.can_withdraw!==false&&
        !!E('v-out-'+coin.toLowerCase()+'-'+n.key))
      .sort((a,b)=>netOrder(a.key)-netOrder(b.key));
  }
  function networks(){return nativeNetworkRows().map(n=>n.key);}
  function activeRule(){return nativeNetworkRows().find(n=>n.key===state.network)||{};}
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
    let lo=0,hi=Math.min(MAX_AMOUNT_MINOR,available);
    while(lo<hi){
      const mid=Math.ceil((lo+hi)/2);
      if(mid+serviceFee(mid)<=available)lo=mid;
      else hi=mid-1;
    }
    return lo;
  }
  function balancePaint(){
    E('exp-balance').textContent=moneyText(state.balanceMinor)+' $';
    const max=maximum();
    E('exp-max-value').textContent=groupAmount((max/100).toFixed(2))+' $';
    E('exp-use-all').disabled=max===0;
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
    to.value=state.address;amt.value=groupAmount(state.amount);
    E('exp-net-toggle').hidden=state.method==='altvu';
    E('exp-net-value').textContent=netName(state.network);
    E('exp-net-icon').className='nlg '+state.network;
    E('exp-net-toggle').setAttribute('aria-label','Сеть: '+netName(state.network));
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
  // The same global .ns-sheet used by native USDT/USDC deposits.
  function closeSheet(restoreFocus=true){
    netSheet(false);
    netField.setAttribute('aria-expanded','false');
    if(restoreFocus&&screen.classList.contains('on'))netField.focus({preventScroll:true});
  }
  async function pickNetwork(){
    if(state.method==='altvu'||state.sheetBusy)return;
    state.sheetBusy=true;
    try{
      state.networkCatalog=await netAll();
      const list=nativeNetworkRows();
      const box=nativeSheet.querySelector('.ns-box');
      const note=nativeSheet.querySelector('.ns-note');
      if(!list.length){
        box.innerHTML='<div class="row"><div class="rt">Сети недоступны<i>Попробуйте позже</i></div></div>';
      }else{
        // Native netPickOpen() row anatomy, selected radio and second line.
        box.innerHTML=list.map(n=>{
          const selected=n.key===state.network;
          const sub='комиссия сети '+coinAmt(n.withdrawal_fee)+' '+methods[state.method].coin;
          return '<div class="row" data-ns="'+esc(n.key)+'" role="radio" tabindex="'+
            (selected?'0':'-1')+'" aria-checked="'+String(selected)+'">'+
            '<div class="ri">'+netLogo(n.key)+'</div>'+
            '<div class="rt">'+esc(netName(n.key))+'<i>'+esc(sub)+'</i></div>'+
            '<div class="rd'+(selected?' on':'')+'"></div></div>';
        }).join('');
      }
      if(note)note.textContent='Адрес получателя должен быть в выбранной сети. Перевод в чужую сеть не вернуть.';
      netSheet(true);
      netField.setAttribute('aria-expanded','true');
      const focused=box.querySelector('[aria-checked="true"]')||box.querySelector('[data-ns]');
      if(focused)focused.focus({preventScroll:true});
      say('');
    }catch(e){
      say('Не удалось загрузить доступные сети. Попробуйте ещё раз.');
    }finally{
      state.sheetBusy=false;
    }
  }
  function selectNetwork(key){
    if(!networks().includes(key))return;
    const changed=key!==state.network;
    state.network=key;
    if(changed){state.address='';state.scannedCode='';to.value='';}
    E('exp-net-value').textContent=netName(key);
    E('exp-net-icon').className='nlg '+key;
    netField.setAttribute('aria-label','Сеть: '+netName(key));
    balancePaint();
    closeSheet();
    say('');
  }
  function fillMax(){
    state.amount=(maximum()/100).toFixed(2);
    amt.value=groupAmount(state.amount);
    say('');
    amt.focus({preventScroll:true});
    amt.setSelectionRange(amt.value.length,amt.value.length);
  }
  function updateAmount(raw,caret){
    const clean=cleanAmount(raw);
    const shown=groupAmount(clean);
    const offset=Math.min(shown.length,groupAmount(cleanAmount(raw.slice(0,caret))).length);
    amt.value=shown;
    amt.setSelectionRange(offset,offset);
    state.amount=clean;
    say('');
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
  to.addEventListener('input',()=>{
    state.address=to.value;state.scannedCode='';say('');
  });
  amt.addEventListener('input',()=>{
    updateAmount(amt.value,amt.selectionStart==null?amt.value.length:amt.selectionStart);
  });
  // Backspace/Delete across a grouping space removes the next digit.
  amt.addEventListener('beforeinput',e=>{
    if(amt.selectionStart!==amt.selectionEnd)return;
    const pos=amt.selectionStart,raw=amt.value;
    if(e.inputType==='deleteContentBackward'&&pos>1&&raw[pos-1]===' '){
      e.preventDefault();
      updateAmount(raw.slice(0,pos-2)+raw.slice(pos),pos-2);
    }else if(e.inputType==='deleteContentForward'&&raw[pos]===' '&&pos+1<raw.length){
      e.preventDefault();
      updateAmount(raw.slice(0,pos)+raw.slice(pos+2),pos);
    }
  });
  // Native button prevents the original delegated .wd-max handler from firing.
  E('exp-use-all').addEventListener('click',fillMax);
  netField.addEventListener('click',pickNetwork);
  netField.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();pickNetwork();}
  });
  // The native wallet also has a delegated click handler on the network dim.
  // Intercept backdrop clicks at window capture, before native handlers can
  // navigate or mutate the active view. Restrict this to the active experiment.
  window.addEventListener('click',e=>{
    if(!screen.classList.contains('on')||nativeDim.hidden)return;
    if(!e.target.closest('.ns-dim'))return;
    e.preventDefault();e.stopImmediatePropagation();
    closeSheet();
  },true);
  // The global native dispatcher also owns [data-ns]. Intercept only while
  // the experiment is visible; all deposit flows remain unchanged.
  document.addEventListener('click',e=>{
    if(!screen.classList.contains('on')||nativeSheet.hidden)return;
    const row=e.target.closest('.ns-sheet .ns-box [data-ns]');
    if(row){
      e.preventDefault();e.stopImmediatePropagation();selectNetwork(row.dataset.ns);
      return;
    }
    if(e.target.closest('.ns-dim')){
      e.preventDefault();e.stopImmediatePropagation();closeSheet();
    }
  },true);
  document.addEventListener('keydown',e=>{
    if(!screen.classList.contains('on')||nativeSheet.hidden)return;
    if(e.key==='Escape'){
      e.preventDefault();e.stopImmediatePropagation();closeSheet();return;
    }
    if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    const rows=[...nativeSheet.querySelectorAll('.ns-box [data-ns]')];
    if(!rows.length)return;
    const current=rows.indexOf(document.activeElement);
    if(current<0)return;
    e.preventDefault();e.stopImmediatePropagation();
    const next=e.key==='Home'?0:e.key==='End'?rows.length-1:
      (current+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length;
    rows.forEach((row,i)=>row.tabIndex=i===next?0:-1);
    rows[next].focus({preventScroll:true});
  },true);
  document.addEventListener('click',e=>{
    if(!screen.classList.contains('on')||nativeSheet.hidden)return;
    if(e.target.closest('#v-exp-route .back')){
      e.preventDefault();e.stopImmediatePropagation();closeSheet();
    }
  },true);

  async function next(){
    if(state.busy)return;
    const address=to.value.trim(),value=cleanAmount(amt.value);
    const cents=Math.round(Number(value)*100);
    if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(value)||!Number.isFinite(cents)||cents<=0||cents>MAX_AMOUNT_MINOR){
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