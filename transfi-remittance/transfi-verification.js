/* TransFi contact verification mock, UX only: no API, emails or payments. */
(function(){
'use strict';
const phone=document.querySelector('.phone'),baseOpen=window.tfOpenBank;
if(!phone||typeof baseOpen!=='function')return;
const KEY='altvu-transfi-verification-mock-v1',QA=new URLSearchParams(location.search).get('qa')==='1';
const store=window.__tfNativeMockStorage||window.localStorage;
const blank=()=>({status:'idle',context:{rail:'SEPA',flow:'in'},requestedAt:0,requests:0,windowStart:0,notice:'',noticeAt:0,noticeRead:false,sheetShown:false});
let s=blank();
try{const value=JSON.parse(store.getItem(KEY)||'null');if(value&&value.status)s=Object.assign(blank(),value)}catch(e){}
function save(){try{store.setItem(KEY,JSON.stringify(s))}catch(e){}}
function safe(x){return String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function emailLabel(){try{if(typeof me!=='undefined'&&me&&me.email)return me.email;if(typeof email!=='undefined'&&String(email).includes('@'))return email}catch(e){}return 'Email из профиля alt.vu'}
const css=[
'#tfv-page{position:absolute;inset:0;z-index:97;overflow:auto;background:var(--n50,#f6f7f8);color:var(--n900,#161514);font:400 15px/22px Inter,system-ui,sans-serif}',
'#tfv-page[hidden],#tfv-sheet[hidden],#tfv-qa-options[hidden]{display:none!important}',
'#tfv-head{display:flex;align-items:center;gap:12px;padding:calc(14px + env(safe-area-inset-top)) 16px 14px;font-size:20px;font-weight:600;line-height:24px}',
'#tfv-head button{display:grid;place-items:center;width:40px;height:40px;border:0;border-radius:50%;background:white;box-shadow:0 1px 3px #1615141a;cursor:pointer;font-size:23px;font-weight:400}',
'#tfv-body{padding:32px 16px 30px}',
'.tfv-hero{text-align:center;padding:0 10px 22px}',
'.tfv-icon{width:88px;height:88px;display:grid;place-items:center;border-radius:50%;background:var(--brand,#cbf14a);margin:0 auto 24px;font-size:35px}',
'.tfv-icon.wait{background:#e9ecf0}.tfv-icon.fail{background:#fbe9e4}',
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
'#tfv-qa{position:absolute;right:10px;bottom:10px;z-index:111;font:12px Inter,system-ui,sans-serif}',
'#tfv-qa button{cursor:pointer}',
'#tfv-qa-main{border:1px solid #ddd;background:white;border-radius:14px;padding:8px 11px;box-shadow:0 1px 10px #0002}',
'#tfv-qa-options{position:absolute;right:0;bottom:43px;min-width:175px;padding:8px;background:white;border-radius:14px;box-shadow:0 4px 16px #0003;display:grid;gap:4px}',
'#tfv-qa-options button{background:#f6f7f8;border:0;padding:9px;border-radius:9px;text-align:left}',
'.tfv-note{cursor:pointer}.tfv-note .nm{color:var(--brand-600,#12833a)}',
'@keyframes tfv-slide-in{from{transform:translateY(100%)}to{transform:translateY(0)}}',
'@keyframes tfv-dim-in{from{opacity:0}to{opacity:1}}',
'@media(prefers-reduced-motion:reduce){#tfv-sheet .tfv-panel,#tfv-sheet .tfv-dim{animation:none}}'
].join('\n');
const style=document.createElement('style');style.id='tfv-css';style.textContent=css;document.head.appendChild(style);
const page=document.createElement('section');page.id='tfv-page';page.hidden=true;page.setAttribute('aria-label','Подтверждение email');
page.innerHTML='<header id="tfv-head"><button type="button" data-tfv="close" aria-label="Назад">‹</button><span>Подтверждение email</span></header><main id="tfv-body"></main>';phone.appendChild(page);
const sheet=document.createElement('div');sheet.id='tfv-sheet';sheet.hidden=true;
sheet.innerHTML='<div class="tfv-dim" data-tfv="dismiss"></div><section class="tfv-panel" role="dialog" aria-modal="true" aria-label="Проверка завершена"><div class="grab"></div><h2>Проверка завершена</h2><p>Теперь вы можете пользоваться банковскими переводами SEPA и SWIFT.</p><button type="button" class="tfv-btn" data-tfv="continue">Продолжить</button><button type="button" class="tfv-btn alt" data-tfv="dismiss">Позже</button></section>';phone.appendChild(sheet);
if(QA){const qa=document.createElement('div');qa.id='tfv-qa';qa.innerHTML='<div id="tfv-qa-options" hidden><button data-tfv-status="initiated">Письмо отправлено</button><button data-tfv-status="verified">Email подтверждён</button><button data-tfv-status="approved">Проверка одобрена</button><button data-tfv-status="manual_review">Ручная проверка</button><button data-tfv-status="rejected">Отказ</button><button data-tfv-status="error">Ошибка</button><button data-tfv-status="reset">Сброс</button></div><button type="button" id="tfv-qa-main">QA · TransFi</button>';phone.appendChild(qa);qa.querySelector('#tfv-qa-main').addEventListener('click',()=>{const menu=qa.querySelector('#tfv-qa-options');menu.hidden=!menu.hidden})}
function button(text,action,variant,disabled){return '<button type="button" class="tfv-btn '+(variant||'')+'" data-tfv="'+action+'"'+(disabled?' disabled':'')+'>'+text+'</button>'}
function hero(icon,title,description,cls){return '<div class="tfv-hero"><div class="tfv-icon '+(cls||'')+'" aria-hidden="true">'+icon+'</div><h1 class="tfv-title">'+title+'</h1><p class="tfv-desc">'+description+'</p></div>'}
function canRequest(){return !s.windowStart||Date.now()-s.windowStart>=600000||s.requests<3}
function render(){
 const address='<div class="tfv-card"><div class="tfv-caption">Email для подтверждения</div><div class="tfv-value">'+safe(emailLabel())+'</div></div>';
 let html='';
 if(s.status==='idle')html=hero('✉','Подтвердите email','Для банковских переводов необходимо подтвердить контакт в TransFi.')+address+'<div class="tfv-info">Email повторно вводить не нужно. После подтверждения провайдер проверит доступность переводов.</div>'+button('Отправить письмо','send')+button('Позже','close','alt');
 else if(s.status==='initiated'){const expired=Date.now()-s.requestedAt>=600000;html=hero('✉',expired?'Ссылка больше не действует':'Проверьте почту',expired?'Запросите новую ссылку.':'Откройте письмо от TransFi и перейдите по ссылке. Проверим результат автоматически.')+address+'<div class="tfv-info">Ссылка действует 10 минут. Экран можно закрыть, не прерывая проверку.</div>'+button(expired?'Отправить новую ссылку':'Отправить повторно','send','alt',!canRequest())+button('Вернуться в кошелёк','close','text')+(!canRequest()?'<p class="tfv-desc" style="text-align:center">Лимит запросов. Повторите позже.</p>':'')}
 else if(s.status==='verified')html=hero('◷','Проверяем данные','Email подтверждён. TransFi проводит проверку перед использованием банковских переводов.','wait')+'<div class="tfv-info">Подтверждение email ещё не означает разрешение на операцию.</div>'+button('Вернуться в кошелёк','close','alt');
 else if(s.status==='approved')html=hero('✓','Проверка завершена','Теперь можно продолжить пополнение или вывод через SEPA и SWIFT.')+button('Продолжить','continue')+button('Позже','close','alt');
 else if(s.status==='manual_review')html=hero('◷','Проверка занимает больше времени','TransFi дополнительно проверяет данные. Сообщим о результате.','wait')+button('Вернуться в кошелёк','close','alt');
 else if(s.status==='rejected')html=hero('!','Проверка не пройдена','Банковские переводы пока недоступны. Уточнить причину можно в поддержке.','fail')+button('Связаться с поддержкой','support')+button('Закрыть','close','alt');
 else html=hero('!','Не удалось проверить статус','Попробуйте повторить проверку.','fail')+button('Повторить','retry')+button('Закрыть','close','alt');
 page.querySelector('#tfv-body').innerHTML=html;
}
function requestLink(){
 if(!canRequest())return;
 if(!s.windowStart||Date.now()-s.windowStart>=600000){s.windowStart=Date.now();s.requests=0}
 s.requests++;s.requestedAt=Date.now();s.status='initiated';save();render();
}
function noticeInfo(){return {approved:['Проверка завершена','Теперь вам доступны банковские переводы SEPA и SWIFT.','Продолжить'],manual_review:['Проверка продолжается','TransFi дополнительно проверяет данные.','Посмотреть статус'],rejected:['Проверка не пройдена','Банковские переводы пока недоступны.','Посмотреть статус']}[s.notice]}
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
function close(){page.hidden=true}
function proceed(){page.hidden=true;sheet.hidden=true;baseOpen(s.context.rail,s.context.flow)}
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
 if(which==='retry')return render();
 if(which==='support'){close();if(typeof show==='function')show('support');return}
 if(which==='notice'){s.noticeRead=true;save();updateNotes();if(s.status==='approved')proceed();else{render();page.hidden=false}}
}
phone.addEventListener('click',function(e){
 const b=e.target.closest('[data-tfv-status]');if(b&&QA){e.preventDefault();setStatus(b.dataset.tfvStatus);const menu=document.getElementById('tfv-qa-options');if(menu)menu.hidden=true;return}
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
