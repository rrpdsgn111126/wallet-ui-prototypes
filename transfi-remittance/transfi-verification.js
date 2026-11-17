/* TransFi contact verification mock, UX only: no API, emails or payments. */
(function(){
'use strict';
const phone=document.querySelector('.phone'),baseOpen=window.tfOpenBank;
if(!phone||typeof baseOpen!=='function')return;
const KEY='altvu-transfi-verification-mock-v1';
const store=window.__tfNativeMockStorage||window.localStorage;
const blank=()=>({status:'idle',context:{rail:'SEPA',flow:'in'},requestedAt:0,requests:0,windowStart:0,notice:'',noticeAt:0,noticeRead:false,sheetShown:false});
let s=blank();
try{const value=JSON.parse(store.getItem(KEY)||'null');if(value&&value.status)s=Object.assign(blank(),value)}catch(e){}
function save(){try{store.setItem(KEY,JSON.stringify(s))}catch(e){}}
function safe(x){return String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function emailLabel(){try{if(typeof me!=='undefined'&&me&&me.email)return me.email;if(typeof email!=='undefined'&&String(email).includes('@'))return email}catch(e){}return 'Email из профиля alt.vu'}
const css=[
'#tfv-page{position:absolute;inset:0;z-index:97;display:flex;flex-direction:column;background:var(--n50);color:var(--n900);overflow:hidden}',
'#tfv-page[hidden],#tfv-sheet[hidden]{display:none!important}',
'#tfv-page .head{flex:0 0 auto}',
'#tfv-page .head .back{border:0;cursor:pointer}',
'#tfv-head .h1{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'#tfv-head .hacts{flex:0 0 auto;margin-left:auto}',
'#tfv-head .ha{appearance:none;padding:0;border:0;cursor:pointer}',
'#tfv-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:16px 16px 0;overscroll-behavior:contain}',
'#tfv-body{position:relative;z-index:1}',
'#tfv-body .tfv-status-hero{padding:36px 8px 0}',
'#tfv-page.tfv-final #tfv-head{display:none}',
'#tfv-page.tfv-final #tfv-body{padding-top:min(130px,17vh)}',
'#tfv-page.tfv-final #tfv-body .tfv-status-hero{padding:0 8px}',
'#tfv-body .tfv-status-hero .p{margin:0 auto;max-width:330px;overflow-wrap:anywhere}',
'#tfv-body .tfv-wait .p{max-width:330px;overflow-wrap:anywhere}',
'#tfv-body .tfv-wait .cn{display:flex;align-items:center;justify-content:center;background:var(--n100);border-radius:50%}',
'#tfv-body .tfv-wait svg{display:block}',
'#tfv-body .tfv-email{height:auto;min-height:68px;margin:18px 0 12px;padding-top:10px;padding-bottom:10px}',
'#tfv-body .tfv-email .fl b{white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere}',
'#tfv-body .tfv-email .fi svg{display:block}',
'#tfv-body .tfv-inline-note{margin:12px 4px 18px}',
'#tfv-foot{position:static;flex:0 0 auto;padding:16px 16px calc(34px + env(safe-area-inset-bottom));box-sizing:border-box}',
'#tfv-foot .tfv-btn{width:100%;min-height:52px;cursor:pointer;font:600 16px Inter,system-ui,sans-serif}',
'#tfv-foot .tfv-btn + .tfv-btn{margin-top:12px}',
'#tfv-foot .tfv-btn.text{background:transparent;box-shadow:none;min-height:44px}',
'#tfv-foot .tfv-btn:disabled{opacity:.5;cursor:default}',
'#tfv-sheet{position:absolute;inset:0;z-index:99}',
'#tfv-sheet .tfv-dim{animation:tfv-dim-in .62s cubic-bezier(.28,.78,0,1) both}',
'#tfv-sheet .tfv-panel{z-index:5;padding-bottom:calc(34px + env(safe-area-inset-bottom))}',
'#tfv-sheet .tfv-btn{width:100%;cursor:pointer;font:600 16px Inter,system-ui,sans-serif}',
'#tfv-sheet .tfv-btn.alt{margin-top:12px}',
'#tfv-sheet .tfv-notice-copy .p{margin:0 auto 18px}',
'.tfv-note{cursor:pointer}.tfv-note .nm{color:var(--brand-600)}',
'@keyframes tfv-dim-in{from{opacity:0}to{opacity:.4}}',
'@media(prefers-reduced-motion:reduce){#tfv-sheet .tfv-panel,#tfv-sheet .tfv-dim{animation:none}}'
].join('\n');
const style=document.createElement('style');style.id='tfv-css';style.textContent=css;document.head.appendChild(style);
const page=document.createElement('section');page.id='tfv-page';page.hidden=true;page.setAttribute('aria-label','Подтверждение почты');
page.style.setProperty('--t-op','.42');
page.style.setProperty('--t-blur','26px');
page.style.setProperty('--t-h','300px');
page.style.setProperty('--t-mask','linear-gradient(180deg,#000 0%,#000 46%,transparent 100%)');
page.innerHTML='<div class="tint" aria-hidden="true"></div><header id="tfv-head" class="head hic"><button type="button" class="back" data-tfv="close" aria-label="Назад"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg></button><div class="h1">Подтверждение почты</div><div class="hacts"><button type="button" class="ha" data-go="notes" aria-label="Уведомления"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.2 7.5-2.2 7.5h16.4S18 14.5 18 8.5Z"/><path d="M13.7 19.5a2 2 0 0 1-3.4 0"/></svg></button><button type="button" class="ha" data-go="support" aria-label="Поддержка"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 11.6a7.9 7.9 0 0 1-8.5 7.9 9 9 0 0 1-3.2-.6L3.5 20.5l1.6-4.8A7.6 7.6 0 0 1 4 11.6C4 7.2 7.7 3.7 12.3 3.7s8.2 3.5 8.2 7.9Z"/></svg></button></div></header><main id="tfv-body" class="wrap tight"></main><footer id="tfv-foot" class="foot"></footer>';phone.appendChild(page);
const sheet=document.createElement('div');sheet.id='tfv-sheet';sheet.hidden=true;
sheet.innerHTML='<div class="dim tfv-dim" data-tfv="dismiss"></div><section class="sheet tfv-panel" role="dialog" aria-modal="true" aria-label="Международные переводы доступны"><div class="grab"></div><div class="hero sbp-out tfv-notice-copy"><div class="okc" aria-hidden="true"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--n850)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 5 5 9-10"/></svg></div><div class="h2">Международные переводы доступны</div><p class="p">Проверка завершена</p></div><button type="button" class="btn tfv-btn" data-tfv="continue">Продолжить</button></section>';phone.appendChild(sheet);
function button(text,action,variant,disabled){return '<button type="button" class="'+(['alt','text'].includes(variant)?'btno':'btn')+' tfv-btn '+(variant||'')+'" data-tfv="'+action+'"'+(disabled?' disabled':'')+'>'+text+'</button>'}
function tfvIcon(kind){
 const paths={
  mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
  clock:'<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2.1"/>',
  check:'<path d="m5 12.5 5 5 9-10"/>',
  cross:'<path d="M7 7l10 10M17 7 7 17"/>'
 };
 const size=kind==='cross'?34:kind==='clock'?30:40;
 const color=kind==='cross'?'var(--n500)':'var(--n850)';
 return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="'+color+'" stroke-width="'+(kind==='cross'?'2.4':'2.2')+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[kind]||'')+'</svg>';
}
function statusHero(kind,title,description){
 const symbol=kind==='cross'
  ?'<div class="sbp-ic" aria-hidden="true">'+tfvIcon('cross')+'</div>'
  :'<div class="okc '+(kind==='mail'?'pw-wait':'')+'" aria-hidden="true">'+tfvIcon(kind)+'</div>';
 return '<div class="hero sbp-out tfv-status-hero">'+symbol+
  (title?'<div class="h2">'+title+'</div>':'')+
  '<div class="p">'+description+'</div></div>';
}
function waiting(title,description){
 // Same canonical SBP/TransFi processing pattern as legacy.html: tfBankWait().
 return '<div class="sbp-wait tfv-wait"><div class="ring"><div class="in"><div class="cn">'+tfvIcon('clock')+
  '</div></div></div><div class="h2">'+title+'</div><p class="p">'+description+'</p></div>';
}
function emailField(){
 const mail='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--n850)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>';
 // Exact structural pattern: components/fld.html -> "Только чтение (серое)".
 return '<div class="fld g tfv-email" aria-label="Адрес почты, только чтение"><div class="fi">'+mail+
  '</div><div class="fl"><i>Адрес почты</i><b>'+safe(emailLabel())+'</b></div></div>';
}
function canRequest(){return !s.windowStart||Date.now()-s.windowStart>=600000||s.requests<3}
function render(){
 let html='',final=false;
 if(s.status==='idle'){
   html=statusHero('mail','','Подтвердите адрес почты, чтобы воспользоваться международными переводами')+
    emailField()+button('Отправить письмо','send')+button('Позже','close','alt');
 }else if(s.status==='initiated'){
   const expired=Date.now()-s.requestedAt>=600000;
   html=waiting(expired?'Срок действия ссылки истёк':'Подтвердите почту',
    expired?'Отправьте новую ссылку для подтверждения':'Перейдите по ссылке в письме, отправленном на ваш адрес. Ссылка действует 10 минут')+
    emailField()+
    button(expired?'Отправить новую ссылку':'Отправить ещё раз','send','alt',!canRequest())+
    button('В кошелёк','close','text')+
    (!canRequest()?'<p class="note tfv-inline-note">Превышен лимит отправок. Попробуйте позже</p>':'');
 }else if(s.status==='verified'||s.status==='manual_review'){
   // Both backend states use one customer-facing screening screen.
   html=waiting('Проверяем почту','После проверки станут доступны международные переводы')+
    button('В кошелёк','close','alt');
 }else if(s.status==='approved'){
   final=true;
   html=statusHero('check','Проверка завершена','Международные переводы доступны')+
    button('Продолжить','continue')+button('Позже','close','alt');
 }else if(s.status==='rejected'){
   final=true;
   html=statusHero('cross','Проверка не пройдена','Международные переводы недоступны. Обратитесь в поддержку')+
    button('Связаться с поддержкой','support')+button('Закрыть','close','alt');
 }else{
   final=true;
   html=statusHero('cross','Не удалось проверить статус','Повторите попытку')+
    button('Проверить ещё раз','retry')+button('Закрыть','close','alt');
 }
 page.classList.toggle('tfv-final',final);
 const main=page.querySelector('#tfv-body');
 main.innerHTML=html;
 page.querySelector('#tfv-foot').replaceChildren(...main.querySelectorAll('button.tfv-btn'));
}
function requestLink(){
 if(!canRequest())return;
 if(!s.windowStart||Date.now()-s.windowStart>=600000){s.windowStart=Date.now();s.requests=0}
 s.requests++;s.requestedAt=Date.now();s.status='initiated';save();render();emitState();
}
function noticeInfo(){return {approved:['Международные переводы доступны','Проверка завершена','Продолжить'],manual_review:['Проверяем почту','После проверки станут доступны международные переводы','Посмотреть статус'],rejected:['Проверка не пройдена','Банковские переводы недоступны','Посмотреть статус']}[s.notice]}
function syncNotice(){
 const list=document.getElementById('n-list');if(!list)return;
 list.querySelectorAll('.tfv-note,.tfv-note-date').forEach(el=>el.remove());
 const data=noticeInfo();if(!data)return;
 if(list.children.length===1&&list.firstElementChild.classList.contains('box'))list.textContent='';
 const date=document.createElement('div');date.className='d tfv-note-date';date.textContent='Проверка TransFi';
 const card=document.createElement('div');card.className='nt k-security tfv-note';card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('data-tfv','notice');
 const at=new Date(s.noticeAt||Date.now()).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
 const badge=(typeof NOTE_ICON!=='undefined'&&NOTE_ICON.security)?NOTE_ICON.security:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2 4 6v6c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V6z"/><path d="m8 12 3 3 5-6"/></svg>';
 card.innerHTML='<div class="ni" aria-hidden="true">'+badge+'</div><div class="nb"><div class="nh"><h4>'+data[0]+'</h4><span class="nw">'+at+'</span>'+(s.noticeRead?'':'<span class="nd"></span>')+'</div><p>'+data[1]+'</p><div class="nm">'+data[2]+' →</div></div>';
 list.prepend(card);list.prepend(date);
 const mark=document.getElementById('n-read');if(mark&&!s.noticeRead)mark.hidden=false;
}
const oldNotes=window.renderNotes;
if(typeof oldNotes==='function')window.renderNotes=function(){const r=oldNotes.apply(this,arguments);syncNotice();return r};
const oldBadge=window.paintBadges;
if(typeof oldBadge==='function')window.paintBadges=function(n,sp){return oldBadge.call(this,(n|0)+(s.notice&&!s.noticeRead?1:0),sp)};
function updateNotes(){if(typeof window.renderNotes==='function')window.renderNotes();else syncNotice();if(typeof window.paintBadges==='function'){let n=0,sp=0;try{n=typeof notes!=='undefined'?notes.filter(x=>!x.read).length:0;sp=typeof supUnread!=='undefined'?supUnread:0}catch(e){}window.paintBadges(n,sp)}}
function close(){page.hidden=true;if(s.status==='approved'){s.sheetShown=true;save()}emitState()}
function proceed(){page.hidden=true;sheet.hidden=true;s.sheetShown=true;save();baseOpen(s.context.rail,s.context.flow);emitState()}
function safeToInterrupt(){const v=typeof view!=='undefined'?view:'home';const bank=document.getElementById('tf-bank-overlay');return ['home','topup','withdraw','profile'].includes(v)&&(!bank||bank.hidden)&&!document.querySelector('.view.on .sheet:not([hidden]),.view.on .dim.pop:not([hidden])')}
function maybeSheet(){if(s.status==='approved'&&!s.sheetShown&&page.hidden&&sheet.hidden&&safeToInterrupt()){s.sheetShown=true;save();sheet.hidden=false;const b=sheet.querySelector('[data-tfv="continue"]');if(b)b.focus({preventScroll:true})}}
function emitState(){document.dispatchEvent(new CustomEvent('tfv-change',{detail:Object.assign({},s)}))}
function hideBank(){
 const overlay=document.getElementById('tf-bank-overlay');
 if(overlay&&!overlay.hidden){overlay.hidden=true;const frame=overlay.querySelector('iframe');if(frame)frame.removeAttribute('src')}
}
function setStatus(status,options={}){
 if(status==='reset'){s=blank();save();page.hidden=true;sheet.hidden=true;hideBank();updateNotes();emitState();return}
 if(!['idle','initiated','verified','approved','manual_review','rejected','error'].includes(status))return;
 const quiet=!!options.quiet;
 if(status==='initiated'&&!s.requestedAt){s.requestedAt=Date.now();s.windowStart=Date.now();s.requests=1}
 if(status==='idle'){s.requestedAt=0;s.windowStart=0;s.requests=0}
 s.status=status;
 if(quiet){s.notice='';s.noticeAt=0;s.noticeRead=false;s.sheetShown=true;sheet.hidden=true;page.hidden=true;hideBank()}
 else if(['approved','rejected'].includes(status)&&s.notice!==status){
   s.notice=status;s.noticeAt=Date.now();s.noticeRead=false;s.sheetShown=false;
 }
 save();render();updateNotes();
 if(status==='approved'&&!quiet&&page.hidden)maybeSheet();
 emitState();
}
function setContext(rail,flow){
 s.context={rail:rail==='SWIFT'?'SWIFT':'SEPA',flow:flow==='out'?'out':'in'};
 save();emitState();
}
function triggerApprovalNotice(){
 // Test an incoming provider approval, independently of the selected starting state.
 s.status='approved';
 s.notice='approved';s.noticeAt=Date.now();s.noticeRead=false;s.sheetShown=false;
 page.hidden=true;save();render();updateNotes();maybeSheet();emitState();
}
window.tfOpenBank=function(rail,flow){
 setContext(rail,flow);sheet.hidden=true;
 if(s.status==='approved')return proceed();
 hideBank();render();page.hidden=false;emitState();
};
function action(which){
 if(which==='close')return close();
 if(which==='send')return requestLink();
 if(which==='continue')return proceed();
 if(which==='dismiss'){sheet.hidden=true;emitState();return}
 if(which==='retry'){s.status=s.requestedAt?'initiated':'idle';save();render();emitState();return}
 if(which==='support'){close();if(typeof show==='function')show('support');return}
 if(which==='notice'){s.noticeRead=true;save();updateNotes();if(s.status==='approved')proceed();else{render();page.hidden=false;emitState()}}
}
phone.addEventListener('click',function(e){
 // Native data-go performs navigation and afterShow; first dismiss our overlay.
 // Keep data-go so the wallet's existing paintBadges() updates both icon counters.
 if(!page.hidden&&e.target.closest('#tfv-head .ha[data-go]')){close();return}
 const a=e.target.closest('[data-tfv]');if(a){e.preventDefault();action(a.dataset.tfv)}
 if(e.target.closest('[data-act="notes-read"]')&&s.notice&&!s.noticeRead){s.noticeRead=true;save();setTimeout(updateNotes,0)}
},true);
phone.addEventListener('keydown',function(e){
 if((e.key==='Enter'||e.key===' ')&&e.target.matches('.tfv-note')){e.preventDefault();action('notice')}
 if(e.key==='Escape'&&!sheet.hidden){e.preventDefault();e.stopImmediatePropagation();sheet.hidden=true}
 else if(e.key==='Escape'&&!page.hidden){e.preventDefault();e.stopImmediatePropagation();close()}
},true);
window.tfVerificationQA={
 setStatus, setScenarioStatus:(status)=>setStatus(status,{quiet:true}),
 setContext, openSelected:()=>window.tfOpenBank(s.context.rail,s.context.flow),
 triggerApprovalNotice,
 reset:()=>setStatus('reset'),
 getState:()=>JSON.parse(JSON.stringify(s))
};
updateNotes();
document.addEventListener('visibilitychange',function(){if(!document.hidden){render();updateNotes();setTimeout(maybeSheet,150)}});
window.addEventListener('focus',()=>setTimeout(maybeSheet,150));
document.addEventListener('click',function(){setTimeout(maybeSheet,150)},true);
window.addEventListener('message',function(){setTimeout(maybeSheet,250)});
setTimeout(maybeSheet,450);
if(window.__tfInitialBank){
 const initial=window.__tfInitialBank;
 delete window.__tfInitialBank;
 window.tfOpenBank(initial.rail,initial.flow);
}
})();
