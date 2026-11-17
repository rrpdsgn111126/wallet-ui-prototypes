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
'#tfv-page{position:absolute;inset:0;z-index:97;overflow:auto;background:var(--n50,#f6f7f8);color:var(--n900,#161514);font:400 15px/22px Inter,system-ui,sans-serif}',
'#tfv-page[hidden],#tfv-sheet[hidden]{display:none!important}',
'#tfv-head{display:flex;align-items:center;gap:12px;padding:calc(14px + env(safe-area-inset-top)) 16px 14px;font-size:20px;font-weight:600;line-height:24px}',
'#tfv-head button{display:grid;place-items:center;width:40px;height:40px;border:0;border-radius:50%;background:white;box-shadow:0 1px 3px #1615141a;cursor:pointer;font-size:23px;font-weight:400}',
'#tfv-body{padding:32px 16px 30px}',
'.tfv-hero{text-align:center;padding:0 10px 22px}',
'.tfv-icon{width:88px;height:88px;display:grid;place-items:center;border-radius:50%;background:var(--brand,#cbf14a);margin:0 auto 24px;font-size:35px}',
'.tfv-icon.wait{background:#e9ecf0}.tfv-icon.fail{background:#fbe9e4}',
'.tfv-icon svg{width:36px;height:36px;display:block}',
'.tfv-title{font-size:26px;line-height:32px;font-weight:600;margin:0 0 10px}',
'.tfv-desc{font-size:15px;line-height:22px;color:var(--n500,#6b6767);margin:0;overflow-wrap:anywhere}',
'.tfv-card{background:#fff;border-radius:20px;padding:16px;margin-bottom:12px;box-shadow:0 1px 2px #1615140a}',
'.tfv-caption{font-size:12px;color:var(--n500,#6b6767)}',
'.tfv-value{font-size:16px;font-weight:500;margin-top:5px;overflow-wrap:anywhere}',
'.tfv-info{padding:14px 16px;background:var(--n100,#e9ecf0);border-radius:16px;font-size:13px;line-height:19px;margin:12px 0 18px}',
'.tfv-btn{display:flex;width:100%;height:52px;align-items:center;justify-content:center;background:var(--brand,#cbf14a);color:var(--n900,#161514);border:0;border-radius:16px;font:600 16px Inter,system-ui,sans-serif;cursor:pointer;margin:12px 0 0}',
'.tfv-btn.alt{background:var(--n100,#e9ecf0)}.tfv-btn.text{background:transparent;height:44px}.tfv-btn:disabled{opacity:.5;cursor:default}',
'#tfv-sheet{position:absolute;inset:0;z-index:99;display:flex;align-items:flex-end}',
'#tfv-sheet .tfv-dim{position:absolute;inset:0;background:#16151466;animation:tfv-dim-in .62s ease-out}',
'#tfv-sheet .tfv-panel{position:relative;z-index:1;width:100%;box-sizing:border-box;background:var(--n50,#f6f7f8);border-radius:24px 24px 0 0;padding:10px 16px calc(24px + env(safe-area-inset-bottom));box-shadow:0 -10px 30px #16151430;animation:tfv-slide-in .62s cubic-bezier(.28,.78,0,1)}',
'#tfv-sheet .grab{height:5px;width:44px;border-radius:5px;background:var(--n400,#8a8686);margin:0 auto 22px}',
'#tfv-sheet h2{font:600 22px/28px Inter,system-ui,sans-serif;margin:0 0 8px}',
'#tfv-sheet p{color:var(--n500,#6b6767);font:400 15px/22px Inter,system-ui,sans-serif;margin:0 0 14px}',
'.tfv-note{cursor:pointer}.tfv-note .nm{color:var(--brand-600,#12833a)}',
'@keyframes tfv-slide-in{from{transform:translateY(100%)}to{transform:translateY(0)}}',
'@keyframes tfv-dim-in{from{opacity:0}to{opacity:1}}',
'@media(prefers-reduced-motion:reduce){#tfv-sheet .tfv-panel,#tfv-sheet .tfv-dim{animation:none}}'
].join('\n');
const style=document.createElement('style');style.id='tfv-css';style.textContent=css;document.head.appendChild(style);
const page=document.createElement('section');page.id='tfv-page';page.hidden=true;page.setAttribute('aria-label','Подтверждение email');
page.innerHTML='<header id="tfv-head" class="head"><button type="button" data-tfv="close" aria-label="Назад">‹</button><span>Подтверждение email</span></header><main id="tfv-body"></main>';phone.appendChild(page);
const sheet=document.createElement('div');sheet.id='tfv-sheet';sheet.hidden=true;
sheet.innerHTML='<div class="dim tfv-dim" data-tfv="dismiss"></div><section class="sheet tfv-panel" role="dialog" aria-modal="true" aria-label="Проверка завершена"><div class="grab"></div><h2>Проверка завершена</h2><p>Банковские переводы SEPA и SWIFT доступны</p><button type="button" class="btn tfv-btn" data-tfv="continue">Продолжить</button><button type="button" class="btno tfv-btn alt" data-tfv="dismiss">Позже</button></section>';phone.appendChild(sheet);
function button(text,action,variant,disabled){return '<button type="button" class="'+(variant==='alt'?'btno':'btn')+' tfv-btn '+(variant||'')+'" data-tfv="'+action+'"'+(disabled?' disabled':'')+'>'+text+'</button>'}
function hero(icon,title,description,cls){
const icons={
 '✉':'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
 '✓':'<path d="m5 12 5 5 9-10"/>',
 '◷':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 '!':'<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>'
};
const svg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'+(icons[icon]||'')+'</svg>';
return '<div class="tfv-hero"><div class="tfv-icon '+(cls||'')+'" aria-hidden="true">'+svg+'</div>'+(title?'<h1 class="tfv-title">'+title+'</h1>':'')+'<p class="tfv-desc">'+description+'</p></div>'
}
function canRequest(){return !s.windowStart||Date.now()-s.windowStart>=600000||s.requests<3}
function render(){
 const address='<div class="box tfv-card"><div class="tfv-caption">Email для подтверждения</div><div class="tfv-value">'+safe(emailLabel())+'</div></div>';
 let html='';
 if(s.status==='idle')html=hero('✉','','Подтвердите адрес почты, чтобы пользоваться банковскими переводами')+address+'<div class="tfv-info">После подтверждения мы проверим доступность переводов</div>'+button('Отправить письмо','send')+button('Позже','close','alt');
 else if(s.status==='initiated'){const expired=Date.now()-s.requestedAt>=600000;html=hero('✉',expired?'Срок действия ссылки истёк':'Проверьте почту',expired?'Отправьте новую ссылку для подтверждения':'Перейдите по ссылке в письме. Статус обновится автоматически')+address+'<div class="tfv-info">Ссылка действует 10 минут. Проверку можно продолжить позже</div>'+button(expired?'Отправить новую ссылку':'Отправить ещё раз','send','alt',!canRequest())+button('В кошелёк','close','text')+(!canRequest()?'<p class="tfv-desc" style="text-align:center">Превышен лимит отправок. Попробуйте позже</p>':'')}
 else if(s.status==='verified')html=hero('◷','Проверяем данные','Адрес почты подтверждён. Проверяем доступность банковских переводов','wait')+button('В кошелёк','close','alt');
 else if(s.status==='approved')html=hero('✓','Проверка завершена','Банковские переводы доступны')+button('Продолжить','continue')+button('Позже','close','alt');
 else if(s.status==='manual_review')html=hero('◷','Проверяем данные','Нужна дополнительная проверка. Сообщим, когда она завершится','wait')+button('В кошелёк','close','alt');
 else if(s.status==='rejected')html=hero('!','Проверка не пройдена','Банковские переводы недоступны. За подробностями обратитесь в поддержку','fail')+button('Связаться с поддержкой','support')+button('Закрыть','close','alt');
 else html=hero('!','Не удалось проверить статус','Повторите попытку','fail')+button('Проверить ещё раз','retry')+button('Закрыть','close','alt');
 page.querySelector('#tfv-body').innerHTML=html;
}
function requestLink(){
 if(!canRequest())return;
 if(!s.windowStart||Date.now()-s.windowStart>=600000){s.windowStart=Date.now();s.requests=0}
 s.requests++;s.requestedAt=Date.now();s.status='initiated';save();render();
}
function noticeInfo(){return {approved:['Проверка завершена','Банковские переводы SEPA и SWIFT доступны','Продолжить'],manual_review:['Проверка продолжается','Нужна дополнительная проверка','Посмотреть статус'],rejected:['Проверка не пройдена','Банковские переводы недоступны','Посмотреть статус']}[s.notice]}
function syncNotice(){
 const list=document.getElementById('n-list');if(!list)return;
 list.querySelectorAll('.tfv-note,.tfv-note-date').forEach(el=>el.remove());
 const data=noticeInfo();if(!data)return;
 if(list.children.length===1&&list.firstElementChild.classList.contains('box'))list.textContent='';
 const date=document.createElement('div');date.className='d tfv-note-date';date.textContent='Проверка TransFi';
 const card=document.createElement('div');card.className='nt k-security tfv-note';card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('data-tfv','notice');
 const at=new Date(s.noticeAt||Date.now()).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
 card.innerHTML='<div class="ni" aria-hidden="true">✓</div><div class="nb"><div class="nh"><h4>'+data[0]+'</h4><span class="nw">'+at+'</span>'+(s.noticeRead?'':'<span class="nd"></span>')+'</div><p>'+data[1]+'</p><div class="nm">'+data[2]+' →</div></div>';
 list.prepend(card);list.prepend(date);
 const mark=document.getElementById('n-read');if(mark&&!s.noticeRead)mark.hidden=false;
}
const oldNotes=window.renderNotes;
if(typeof oldNotes==='function')window.renderNotes=function(){const r=oldNotes.apply(this,arguments);syncNotice();return r};
const oldBadge=window.paintBadges;
if(typeof oldBadge==='function')window.paintBadges=function(n,sp){return oldBadge.call(this,(n|0)+(s.notice&&!s.noticeRead?1:0),sp)};
function updateNotes(){if(typeof window.renderNotes==='function')window.renderNotes();else syncNotice();if(typeof window.paintBadges==='function'){let n=0,sp=0;try{n=typeof notes!=='undefined'?notes.filter(x=>!x.read).length:0;sp=typeof supUnread!=='undefined'?supUnread:0}catch(e){}window.paintBadges(n,sp)}}
function close(){page.hidden=true;if(s.status==='approved'){s.sheetShown=true;save()}}
function proceed(){page.hidden=true;sheet.hidden=true;s.sheetShown=true;save();baseOpen(s.context.rail,s.context.flow)}
function safeToInterrupt(){const v=typeof view!=='undefined'?view:'home';const bank=document.getElementById('tf-bank-overlay');return ['home','topup','withdraw','profile'].includes(v)&&(!bank||bank.hidden)&&!document.querySelector('.view.on .sheet:not([hidden]),.view.on .dim.pop:not([hidden])')}
function maybeSheet(){if(s.status==='approved'&&!s.sheetShown&&page.hidden&&sheet.hidden&&safeToInterrupt()){s.sheetShown=true;save();sheet.hidden=false;const b=sheet.querySelector('[data-tfv="continue"]');if(b)b.focus({preventScroll:true})}}
function setStatus(status){
 if(status==='reset'){s=blank();save();page.hidden=true;sheet.hidden=true;updateNotes();return}
 if(!['initiated','verified','approved','manual_review','rejected','error'].includes(status))return;
 if(status==='initiated'&&!s.requestedAt){s.requestedAt=Date.now();s.windowStart=Date.now();s.requests=1}
 s.status=status;
 if(['approved','manual_review','rejected'].includes(status)&&s.notice!==status){s.notice=status;s.noticeAt=Date.now();s.noticeRead=false;s.sheetShown=false}
 save();render();updateNotes();
 if(status==='approved'&&page.hidden)maybeSheet();
}
window.tfOpenBank=function(rail,flow){
 s.context={rail:rail==='SWIFT'?'SWIFT':'SEPA',flow:flow==='out'?'out':'in'};save();sheet.hidden=true;
 if(s.status==='approved')return proceed();
 render();page.hidden=false;
};
function action(which){
 if(which==='close')return close();
 if(which==='send')return requestLink();
 if(which==='continue')return proceed();
 if(which==='dismiss'){sheet.hidden=true;return}
 if(which==='retry'){s.status=s.requestedAt?'initiated':'idle';save();return render()}
 if(which==='support'){close();if(typeof show==='function')show('support');return}
 if(which==='notice'){s.noticeRead=true;save();updateNotes();if(s.status==='approved')proceed();else{render();page.hidden=false}}
}
phone.addEventListener('click',function(e){
 const a=e.target.closest('[data-tfv]');if(a){e.preventDefault();action(a.dataset.tfv)}
 if(e.target.closest('[data-act="notes-read"]')&&s.notice&&!s.noticeRead){s.noticeRead=true;save();setTimeout(updateNotes,0)}
},true);
phone.addEventListener('keydown',function(e){
 if((e.key==='Enter'||e.key===' ')&&e.target.matches('.tfv-note')){e.preventDefault();action('notice')}
 if(e.key==='Escape'&&!sheet.hidden){e.preventDefault();e.stopImmediatePropagation();sheet.hidden=true}
 else if(e.key==='Escape'&&!page.hidden){e.preventDefault();e.stopImmediatePropagation();close()}
},true);
window.tfVerificationQA={setStatus:setStatus,reset:()=>setStatus('reset'),getState:()=>Object.assign({},s)};
updateNotes();
document.addEventListener('visibilitychange',function(){if(!document.hidden){render();updateNotes();setTimeout(maybeSheet,150)}});
window.addEventListener('focus',()=>setTimeout(maybeSheet,150));
setTimeout(maybeSheet,450);
})();
