/* Shared canonical bank UI rendering and picker interactions.
   Single implementation used by work/design-system and experiment/withdraw-route.
   Requires bank-selector-flags.js; scenario data and navigation stay in each host. */
function tfStatusMark(type){
 const paths={
  pending:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  held:'<path d="M12 2.5 20 6.5v5.2c0 4.7-3 8-8 9.8-5-1.8-8-5.1-8-9.8V6.5Z"/><path d="M12 7v6"/><path d="M12 16.5v.1"/>',
  failed:'<circle cx="12" cy="12" r="9"/><path d="m8.5 8.5 7 7m0-7-7 7"/>',
  success:'<path d="m5.5 12.3 4.4 4.2 8.7-9.2"/>'
 };
 const circle=type==='success'?'okc':'tf-mark '+type;
 return '<div class="'+circle+'"><svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[type]+'</svg></div>';
}

function tfBankReviewRow(label,value){
 return '<div class="row tf-review-row"><div class="rt">'+esc(label)+'</div><div class="rv">'+esc(value)+'</div></div>';
}

function title(text){return `<div class="h2 tf-status-title">${esc(text)}</div>`}

function tfIconFor(key){
 const p=tfFieldIcons[tfFieldMap[key]||'card'];
 return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--n850)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
}

function field(label,key,placeholder,{optional=false,hint='',type='text'}={}){
 const plain=S.screen==='out-recipient';
 return `<div class="fld w tf-field${plain?' tf-recipient-field':''}" id="wrap-${key}">${plain?'':'<div class="fi">'+tfIconFor(key)+'</div>'}<label class="fl" for="f-${key}"><i>${esc(label)}${optional&&S.screen!=='out-recipient'?' · необязательно':''}</i><input id="f-${key}" type="${type}" placeholder="${esc(placeholder)}" value="${esc(S[key])}" oninput="store('${key}',this.value)" autocomplete="off"/></label></div>`;
}

function selectField(label,key,opts){return uxPickerField(label,key,key)}

function keyrow(k,v){return `<div class="rl tf-rl"><span>${esc(k)}</span><b>${esc(v)}</b></div>`}

function notice(text,t=''){return `<div class="tf-notice ${t}">${esc(text)}</div>`}

function primary(t,click,inactive=false){
 return `<button type="button" class="btn tf-button${inactive?' tf-inactive':''}" aria-disabled="${inactive?'true':'false'}" onclick="${click}">${esc(t)}</button>`;
}

function second(t,click){return `<button type="button" class="btno tf-button" onclick="${click}">${esc(t)}</button>`}

function action(t,click){return second(t,click)}

function copyrow(k,v,i){return `<div class="row tf-copyrow"><div class="rt"><i>${esc(k)}</i><span class="tf-copy-value">${esc(v)}</span></div><button type="button" class="tf-copy" title="Скопировать" aria-label="Скопировать: ${esc(k)}" onclick="copyText(getRequisites()[${i}][1])"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button></div>`}

function tfBankWait(heading,description){
 return '<div class="sbp-wait tf-bank-wait"><div class="ring"><div class="in"><div class="cn">'+
   '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--n850)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2.1"/></svg>'+
   '</div></div></div><div class="h2">'+esc(heading)+'</div><p class="p">'+esc(description)+'</p></div>';
}

function tfBankResult(status,heading,description){
 const mark=status==='success'
   ?'<div class="okc"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--n850)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 5 5 9-10"/></svg></div>'
   :'<div class="sbp-ic"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--n500)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg></div>';
 return '<div class="hero sbp-out tf-bank-result '+status+'">'+mark+
   '<div class="h2">'+esc(heading)+'</div><div class="p">'+esc(description)+'</div></div>';
}

function timeline(flow){const items=flow==='in'?[['done','Отправлено внешним банком','Ожидаем подтверждение'],['current','Проверка поступления','Сопоставление платежа'],['','Зачислено','После проверок']]:[['done','Перевод создан','initiated'],['current','Обрабатывается','fund_processing'],['','Доставлен','fund_settled']];return `<div class="timeline">${items.map(([s,a,b],i)=>`<div class="track ${s}"><div><div class="dot">${s==='done'?'✓':i+1}</div>${i<2?'<div class="line"></div>':''}</div><div><b>${a}</b><small>${b}</small></div></div>`).join('')}</div>`}

function uxAmountField(){
 return '<div class="fld w tf-field tf-amount"><div class="fi">'+
 '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--n850)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6.4" rx="7.4" ry="3.1"></ellipse><path d="M4.6 6.4v5.2c0 1.7 3.3 3.1 7.4 3.1s7.4-1.4 7.4-3.1V6.4"></path><path d="M4.6 11.6v5.2c0 1.7 3.3 3.1 7.4 3.1s7.4-1.4 7.4-3.1v-5.2"></path></svg></div>'+
 '<div class="fl"><i>Сумма перевода</i><b><input class="wd-amt" id="tf-out-amount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" aria-label="Сумма перевода" value="'+esc(S.amount)+'" oninput="uxSetAmount(this.value)"></b></div>'+
 '<div class="addon"><span class="cur">$</span><span class="mx wd-max" role="button" tabindex="0" aria-label="Максимальная сумма перевода" onclick="uxMaxAmount()">MAX</span></div></div>';
}

function uxRailIcon(rail){
  const glyphs={
    SEPA:'<path d="M3.5 9.3 12 4.9l8.5 4.4M5 10.2h14M6.5 11.1v7.2m4-7.2v7.2m3-7.2v7.2m4-7.2v7.2M4.5 19.2h15"/>',
    SWIFT:'<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c-2.6 2.2-4 4.9-4 8s1.4 5.8 4 8c2.6-2.2 4-4.9 4-8s-1.4-5.8-4-8M6 8.4c1.7.8 3.7 1.2 6 1.2s4.3-.4 6-1.2M6 15.6c1.7-.8 3.7-1.2 6-1.2s4.3.4 6 1.2"/>'
  };
  if(!Object.prototype.hasOwnProperty.call(glyphs,rail))return '';
  return '<div class="cn tf-rail-icon" data-rail-icon="'+rail+'"><span class="tf-rail-mark"><svg class="tf-rail-glyph" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+glyphs[rail]+'</svg></span></div>';
}

function uxMethodRow(name,description,symbol,handler){
  const logos={USDT:'img-df9900c4.png',USDC:'img-a82008b8.png','ALT.VU':'img-27f3d8cf.png',СБП:'img-61ce324e.png'};
  const img=logos[name]
    ? `<div class="cn" style="width:40px;height:40px"><img src="../assets/${logos[name]}" alt="" width="24" height="24" style="border-radius:999px"/></div>`
    : uxRailIcon(name)||`<span aria-hidden="true">${esc(symbol)}</span>`;
  return `<button type="button" class="m tf-method-row" onclick="${handler}"><span class="ic" aria-hidden="true">${img}</span><span class="mt"><b>${esc(name)}</b><i>${esc(description)}</i></span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--n400)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>`;
}

function uxRenderMethods(){
  const layer=$('methodLayer');
  if(!S.modal){layer.hidden=true;layer.innerHTML='';return}
  const isIn=S.modal==='in';
  const other=isIn?[
    ['СБП','Все банки РФ','₽'],
    ['USDT','TRON · BNB Chain · Polygon · TON','₮'],
    ['USDC','BNB Chain · Polygon','$'],
    ['ALT.VU','От другого пользователя alt.vu','A']
  ]:[
    ['USDT','TRON · BNB Chain · Polygon · TON','₮'],
    ['USDC','BNB Chain · Polygon','$'],
    ['ALT.VU','Мгновенно и без комиссии','A']
  ];
  // Baseline order and geometry come from the live wallet. SEPA/SWIFT are additive TransFi rails.
  const nativeRows=other.map(([a,b,c])=>uxMethodRow(a,b,c,`uxOtherMethod('${a}')`)).join('');
  const rails=uxMethodRow('SEPA','Банковский перевод в евро','',"uxSelectMethod('SEPA')")+
    uxMethodRow('SWIFT','Международный банковский перевод','',"uxSelectMethod('SWIFT')");
  const note=isIn
    ? 'Зачисление стейблкоинов занимает 1–3 минуты после подтверждения сети. Перевод внутри alt.vu приходит сразу.'
    : 'Перевод внутри alt.vu — сразу и без комиссии.';
  layer.innerHTML=`<button type="button" class="tf-method-dim" aria-label="Закрыть выбор способа" onclick="uxCloseMethods()"></button>
    <section class="sheet tf-method-sheet tf-native-sheet" role="dialog" aria-modal="true" aria-labelledby="tfMethodTitle">
    <div class="grab"></div><h2 class="sh2" id="tfMethodTitle">${isIn?'Пополнить':'Вывести'}</h2>
    ${nativeRows}
    <p class="tf-method-subtitle">Международный банковский перевод</p>
    ${rails}
    <div class="note">${esc(note)}</div>
    <a class="lnk" href="#" onclick="event.preventDefault();uxOtherMethod('Условия и тарифы')">Условия и тарифы <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2"/><path d="M12 7.6v.1"/></svg></a>
    </section>`;
  layer.hidden=false;
}

function uxCloseMethods(){S.modal=null;render()}

function uxFlag(country){return window.AltvuSelectorFlags.flag(country);}

function uxFlagPlate(country){return window.AltvuSelectorFlags.plate(country);}

function uxCurrencyPickerIcon(code){
  return window.AltvuSelectorFlags.currencyPlate(code) || uxCurrencySymbol(code);
}

function uxPickerTitle(key){
  // In the design-system specimen the label is generic. The same picker in
  // a payment flow retains its contextual "получения"/"пополнения" heading.
  if(S.componentPickerKey===key)return S.componentPickerLabel;
  return {inCurrency:'Валюта пополнения',outCurrency:'Валюта получения',country:'Страна получателя',purpose:'Назначение перевода'}[key]||'Выберите значение';
}

function uxCurrencySymbol(code){
  const glyph={
    EUR:'<path d="M18.5 5.9A7.4 7.4 0 0 0 13.1 3.7C8.9 3.7 6 7.4 6 12s2.9 8.3 7.1 8.3a7.4 7.4 0 0 0 5.4-2.2"/><path d="M3.7 9.5h10.4M3.7 14.3h10.4"/>',
    USD:'<path d="M17.8 6.5c-1.4-1.3-3.3-2.1-5.8-2.1-3.3 0-5.4 1.7-5.4 4.1 0 2.2 1.8 3.1 5.5 3.7 3.8.6 5.7 1.9 5.7 4.1 0 2.5-2.2 4.2-5.8 4.2-2.4 0-4.5-.8-6.1-2.3"/><path d="M12 2v20"/>',
    GBP:'<path d="M18.1 6.6a5.7 5.7 0 0 0-5.1-2.9c-3.2 0-5.3 2.1-5.3 5.3 0 1.8.6 3.3 1.1 5 .4 2.4-.8 4.4-3.7 6h13.6"/><path d="M4.8 13.8h10.6"/>'
  };
  if(!glyph[code])return tfIconFor('currency');
  return '<svg class="tf-currency-icon" data-currency="'+esc(code)+'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--n850)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+glyph[code]+'</svg>';
}

function uxSourceAccountField(){
  return '<div class="fld g tf-field tf-source">'+
    '<div class="fi"><div class="cn" style="width:40px;height:40px"><img width="24" height="24" src="../assets/img-27f3d8cf.png" alt="" style="display:block;border-radius:50%"></div></div>'+
    '<div class="fl"><i>Со счёта alt.vu</i><b>Доступно 4 812.60 $</b></div></div>';
}

function uxFixedCurrencyField(label,value){
  return '<div class="fld w tf-field tf-fixed-currency'+(label==='Валюта пополнения'?' tf-deposit-currency':'')+'"><div class="fi">'+uxCurrencySymbol(value)+
    '</div><div class="fl"><i>'+esc(label)+'</i><b>'+esc(value)+'</b></div></div>';
}

function uxPickerField(label,key,icon){
  const selected=uxPickerOptions(key).find(option=>option.value===S[key]);
  return '<button type="button" class="fld w tf-field tf-picker-trigger'+(S.screen==='out-recipient'&&key==='purpose'?' tf-recipient-field':'')+'" data-picker="'+esc(key)+
    '" aria-haspopup="dialog" aria-label="'+esc(label)+': '+esc(selected?selected.label:'Не выбрано')+
    '">'+(S.screen==='out-recipient'&&key==='purpose'?'':'<span class="fi">'+(key==='country'?uxFlagPlate(S.country):(key==='outCurrency'||key==='inCurrency')?uxCurrencyPickerIcon(S[key]):tfIconFor(icon||key))+'</span>')+'<span class="fl"><i>'+esc(label)+
    '</i><b>'+esc(selected?selected.label:'Выбрать')+'</b></span>'+
    '<span class="tf-picker-chevron" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg></span></button>';
}

function uxOpenPicker(key,{settled=false,focus=true}={}){
  if(!uxPickerOptions(key).length||S.modal)return;
  S.picker=key;
  // Initial UI Kit previews are fully open at the first paint. Subsequent
  // user interactions use the unchanged source sheet-in/dim-in animation.
  uxRenderPicker({settled});
  const first=$('pickerLayer').querySelector('.tf-picker-row[aria-checked="true"]') ||
    $('pickerLayer').querySelector('.tf-picker-row');
  // Focusing a row while the sheet is translating must NOT scroll the nested
  // iframe or move the selector field behind the dim.
  if(focus&&first)first.focus({preventScroll:true});
}

function uxClosePicker(){
  S.picker=null;
  uxRenderPicker();
}

function uxChoosePicker(value){
  const key=S.picker;
  if(!key)return;
  if(!uxPickerOptions(key).some(option=>option.value===value))return;
  const scrollTop=$('content').scrollTop;
  if(key==='inCurrency')S.inCurrency=value;
  if(key==='outCurrency'){S.outCurrency=value;configRail();}
  if(key==='country'){S.country=value;configRail();}
  if(key==='purpose')S.purpose=value;
  S.picker=null;
  render();
  $('content').scrollTop=scrollTop;
  const trigger=document.querySelector('.phone.tf-phone [data-picker="'+key+'"]');
  if(trigger)trigger.focus({preventScroll:true});
}

function uxRenderPicker({settled=false}={}){
 const layer=$('pickerLayer');
 if(!layer)return;
 if(!S.picker){layer.hidden=true;layer.innerHTML='';return;}
 const key=S.picker,choices=uxPickerOptions(key),heading=uxPickerTitle(key);
 const rows=choices.map(option=>{
   const checked=S[key]===option.value;
   const icon=key==='country'?uxFlagPlate(option.value):(key==='outCurrency'||key==='inCurrency')?uxCurrencyPickerIcon(option.value):tfIconFor(key==='purpose'?'note':'currency');
   return '<button type="button" class="row tf-picker-row" data-picker-value="'+esc(option.value)+
     '" role="radio" aria-checked="'+checked+'"><span class="ri">'+icon+
     '</span><span class="rt">'+esc(option.label)+'</span>'+
     '<span class="rd'+(checked?' on':'')+'" aria-hidden="true"></span></button>';
 }).join('');
 layer.innerHTML='<div class="dim tf-picker-dim'+(settled?' settled':'')+'" data-picker-dismiss aria-hidden="true"></div>'+
   '<section class="sheet tf-picker-sheet'+(settled?' settled':'')+'" role="dialog" aria-modal="true" aria-label="'+esc(heading)+'">'+
   '<div class="grab"></div><h2 class="sh2">'+esc(heading)+'</h2>'+
   '<div class="box tf-picker-box" role="radiogroup" aria-label="'+esc(heading)+'">'+rows+'</div>'+
   '</section>';
 layer.hidden=false;
}


/* Canonical navigation and form-feedback controls. */
function uxBottomNav(event){
  const target=event.target.closest('[data-mb]');
  if(!target)return;
  event.preventDefault();
  const key=target.dataset.mb;
  if(key==='home')uxGo('home');
  else if(key==='topup')setFlow('in');
  else if(key==='withdraw')setFlow('out');
  else if(key==='card')uxGo('wallet-card');
  else if(key==='profile')uxGo('wallet-profile');
}

function uxHomeNav(event){
  const el=event.target.closest('[data-go]');if(!el)return;
  const route=el.getAttribute('data-go');
  if(route==='topup')setFlow('in');
  else if(route==='withdraw')setFlow('out');
  else if(route==='history')uxGo('history');
  else if(route==='card')uxGo('wallet-card');
  else if(route==='profile')uxGo('wallet-profile');
  else if(route==='earn')uxGo('wallet-earn');
  else if(route==='notes')uxGo('wallet-notes');
  else uxOtherMethod(({card:'Карта',earn:'Партнёрская программа',notes:'Уведомления',support:'Поддержка',profile:'Профиль'})[route]||route);
}

function uxHomeNavKey(e){
  if(e.key!=='Enter'&&e.key!==' ')return;
  if(e.target.closest('[data-go]')){e.preventDefault();uxHomeNav(e)}
}

function uxProfileTab(tab){if(['data','settings','earn'].includes(tab)){S.profileTab=tab;render()}}

function uxUpdateFlowCTA(){
 const footer=$('footer');
 if(!footer||S.flow!=='out')return;
 const button=footer.querySelector('button.tf-button');
 if(!button||!['out-config','out-recipient'].includes(S.screen))return;
 const invalid=S.screen==='out-config'?uxConfigValidation():uxRecipientValidation();
 const inactive=Boolean(invalid);
 button.classList.toggle('tf-inactive',inactive);
 button.setAttribute('aria-disabled',String(inactive));
 const message=footer.querySelector('.tf-submit-error');
 if(message){message.hidden=true;message.textContent='';}
}

function uxFormError(error){
 if(!error)return;
 notify(error.message);
 const footer=$('footer');
 if(footer){
   let hint=footer.querySelector('.tf-submit-error');
   if(!hint){hint=document.createElement('div');hint.className='tf-submit-error';hint.setAttribute('role','alert');footer.appendChild(hint);}
   hint.textContent=error.message;hint.hidden=false;
 }
 const input=$(error.field);
 if(input){input.scrollIntoView({block:'center',behavior:'smooth'});input.focus();}
}

function uxRender(){
  const phone=document.querySelector('.phone.tf-phone');
  phone.classList.toggle('is-home',S.screen==='home');
  phone.classList.toggle('tf-bank-final',S.flow==='out'&&['out-success','out-failed'].includes(S.screen));
  phone.classList.toggle('tf-bank-waiting',S.flow==='out'&&['out-progress','out-held'].includes(S.screen));
  const tabs=document.querySelector('.tf-bottom-nav');
  const showTabs=['home','wallet-card','wallet-profile','wallet-earn','wallet-notes'].includes(S.screen);
  phone.classList.toggle('has-bottom-nav',showTabs);
  tabs.hidden=!showTabs;
  for(const tab of tabs.querySelectorAll('[data-mb]')){
    const key=tab.dataset.mb;
    const selected=(key==='home'&&S.screen==='home')
      ||(key==='card'&&S.screen==='wallet-card')
      ||(key==='profile'&&['wallet-profile','wallet-earn','wallet-notes'].includes(S.screen));
    tab.classList.toggle('on',selected);
    if(selected)tab.setAttribute('aria-current','page');
    else tab.removeAttribute('aria-current');
  }

  _tfBaseRender();
  uxUpdateFlowCTA();
  $('methodLayer').hidden=!S.modal;
  uxRenderMethods();
  uxRenderPicker();
  document.querySelector('.phone.tf-phone .back').hidden=S.screen==='home';
  const home=$('flow-home');
  if(home)home.classList.toggle('active',S.screen==='home');
  if(S.screen==='home'){
    $('stageLabel').textContent='Главная · Кошелёк alt.vu';
    $('stageIndex').textContent='Главная';
  }else{
    $('stageLabel').textContent=(S.flow==='in'?'Пополнение':'Вывод')+' · '+(S.flow==='in'?S.inRail:S.outRail);
  }
}
