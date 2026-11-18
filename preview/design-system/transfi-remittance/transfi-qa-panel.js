/* Separate desktop QA controls for the alt.vu TransFi UX prototype. */
(function(){
'use strict';
const qa=window.tfVerificationQA;
if(!qa||!document.querySelector('.phone'))return;
const style=document.createElement('style');style.id='tf-qa-panel-style';
style.textContent=[
'#tf-qa-panel{position:fixed;z-index:105;top:50%;left:calc(50% + 202px);transform:translateY(-50%);width:min(306px,calc(50vw - 220px));max-height:calc(100vh - 36px);overflow:auto;background:#fff;color:#211e1d;border:1px solid #e3e6e8;border-radius:22px;box-shadow:0 14px 38px #16151418;padding:22px;font:400 14px/20px Inter,system-ui,sans-serif;text-align:left}',
'#tf-qa-panel *{box-sizing:border-box}',
'#tf-qa-panel > header{padding-bottom:14px;border-bottom:1px solid #edf0f2;margin-bottom:12px}',
'#tf-qa-panel .tfqa-eyebrow{color:#737775;font-size:12px;line-height:16px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}',
'#tf-qa-panel h2{font:600 19px/24px Inter,system-ui,sans-serif;color:#211e1d;margin:6px 0 4px}',
'#tf-qa-panel p{font-size:12px;line-height:18px;color:#6b6767;margin:0}',
'#tf-qa-panel .tfqa-field{display:block;margin:0 0 15px}',
'#tf-qa-panel .tfqa-field span{display:block;font:600 12px/16px Inter,system-ui,sans-serif;margin:0 0 7px;color:#484b49}',
'#tf-qa-panel .tfqa-field select{display:block;appearance:none;-webkit-appearance:none;width:100%;min-height:44px;border:1px solid #d9dfe1;border-radius:12px;padding:10px 32px 10px 12px;color:#161514;background-color:#f7f8f9;background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%236b6767%27 stroke-width=%272%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 11px center;font:500 14px/20px Inter,system-ui,sans-serif;cursor:pointer}',
'#tf-qa-panel select:focus-visible,#tf-qa-panel button:focus-visible{outline:3px solid #8baa21;outline-offset:2px}',
'#tf-qa-panel .tfqa-note{padding:11px 12px;border-radius:12px;background:#f1f3f4;color:#505450;font-size:12px;line-height:17px;margin:-3px 0 15px}',
'#tf-qa-panel .tfqa-actions{display:grid;gap:8px;margin-top:18px}',
'#tf-qa-panel .tfqa-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#f1f3f4;padding:4px;border-radius:14px;margin:0 0 18px}',
'#tf-qa-panel .tfqa-tabs button{background:transparent;border:0;border-radius:10px;min-height:40px;padding:7px 4px;color:#656a66;font-weight:600}',
'#tf-qa-panel .tfqa-tabs button[aria-selected="true"]{background:#fff;color:#161514;box-shadow:0 1px 3px #16151418}',
'#tf-qa-panel .tfqa-pane[hidden]{display:none!important}',
'#tf-qa-panel #tfqa-events{min-height:120px}',
'#tf-qa-panel #pv-qa{position:static!important;inset:auto!important;width:100%!important;max-width:none!important;max-height:none!important;transform:none!important;z-index:auto!important;box-shadow:none!important;border:0!important;border-radius:0!important;background:transparent!important;margin:0!important;padding:0!important;overflow:visible!important;color:inherit;font:inherit}',
'#tf-qa-panel #pv-qa h3{display:none!important}',
'#tf-qa-panel #pv-qa label{display:block;color:#484b49;font:600 12px/16px Inter,system-ui,sans-serif;margin:0 0 12px}',
'#tf-qa-panel #pv-qa select{display:block;margin-top:7px;min-height:44px;border-radius:12px;padding:10px 12px;background:#f7f8f9;color:#161514;border:1px solid #d9dfe1;font:500 14px/20px Inter,system-ui,sans-serif}',
'#tf-qa-panel #pv-qa button{min-height:44px;margin:0 0 8px;padding:10px 12px;border:0;border-radius:12px;background:#e9ecf0;color:#211e1d;font:600 14px/18px Inter,system-ui,sans-serif;white-space:normal}',
'#tf-qa-panel #pv-qa .pv-group{border:1px solid #e1e4e6;border-radius:12px;margin:0 0 8px!important;overflow:hidden}',
'#tf-qa-panel #pv-qa .pv-group>summary{cursor:pointer;padding:12px 14px;font-weight:600;list-style:none;display:flex;justify-content:space-between;align-items:center}',
'#tf-qa-panel #pv-qa .pv-group>summary::-webkit-details-marker{display:none}',
'#tf-qa-panel #pv-qa .pv-group>summary::after{content:"⌄";color:#626760;transition:transform .18s ease}',
'#tf-qa-panel #pv-qa .pv-group[open]>summary::after{transform:rotate(180deg)}',
'#tf-qa-panel #pv-qa .pv-group-actions{padding:0 10px 10px}',
'#tf-qa-panel #pv-qa .pv-group-actions>button:last-child{margin-bottom:0}',
'#tf-qa-panel #pv-qa small{display:block;color:#6b6767;font-size:12px;line-height:18px;margin-top:7px}',
'#tf-qa-panel button{appearance:none;width:100%;min-height:44px;display:flex;align-items:center;justify-content:center;padding:10px 12px;border-radius:12px;border:0;font:600 14px/18px Inter,system-ui,sans-serif;cursor:pointer}',
'#tf-qa-panel .tfqa-primary{background:#cbf14a;color:#161514}',
'#tf-qa-panel .tfqa-secondary{background:#e9ecf0;color:#211e1d}',
'#tf-qa-panel .tfqa-reset{background:transparent;color:#676b69;border:1px solid #e1e4e6}',
'#tf-qa-panel footer{margin-top:16px;padding-top:14px;border-top:1px solid #edf0f2}',
'#tf-qa-panel .tfqa-state{display:flex;gap:7px;align-items:center;margin-bottom:8px;font-size:12px;font-weight:600;color:#333}',
'#tf-qa-panel .tfqa-dot{width:7px;height:7px;border-radius:50%;background:#7c8580}',
'#tf-qa-panel .tfqa-dot.approved{background:#1f8948}',
'#tf-qa-panel .tfqa-dot.pending{background:#d39227}',
'@media(max-width:1023px),(max-height:679px){#tf-qa-panel{display:none!important}}',
'@media(min-width:1024px) and (max-width:1119px){#tf-qa-panel{left:calc(50% + 184px);width:calc(50vw - 198px);padding:15px}}'
].join('\n');
document.head.appendChild(style);
const aside=document.createElement('aside');
aside.id='tf-qa-panel';
aside.setAttribute('aria-label','Управление тестовыми состояниями TransFi');
aside.innerHTML='<header><div class="tfqa-eyebrow">alt.vu · QA</div><h2>Тестирование</h2><p>Выберите сценарий или имитируйте событие</p></header>'+
'<div class="tfqa-tabs" role="tablist" aria-label="Тестовые инструменты"><button type="button" role="tab" id="tfqa-tab-scenarios" aria-selected="true" aria-controls="tfqa-scenarios">Сценарии</button><button type="button" role="tab" id="tfqa-tab-events" aria-selected="false" aria-controls="tfqa-events">События</button></div>'+
'<section id="tfqa-scenarios" class="tfqa-pane" role="tabpanel" aria-labelledby="tfqa-tab-scenarios">'
+'<label class="tfqa-field" for="tfqa-status"><span>Статус проверки</span><select id="tfqa-status"><option value="idle">Email не подтверждён</option><option value="initiated">Письмо отправлено</option><option value="verified">Проверяем почту</option><option value="approved">Проверка одобрена</option><option value="rejected">Проверка отклонена</option><option value="error">Ошибка проверки</option></select></label>'
+'<div class="tfqa-note" id="tfqa-help" aria-live="polite"></div><div class="tfqa-actions"><button class="tfqa-primary" type="button" id="tfqa-open">Открыть сценарий</button><button class="tfqa-secondary" type="button" id="tfqa-notify">Получить уведомление</button><button class="tfqa-reset" type="button" id="tfqa-reset">Сбросить проверку</button></div>'
+'<footer><div class="tfqa-state"><span class="tfqa-dot" id="tfqa-dot"></span><span id="tfqa-summary"></span></div><p>Тестовый режим без платежей и запросов к TransFi</p></footer></section>'+
'<section id="tfqa-events" class="tfqa-pane" role="tabpanel" aria-labelledby="tfqa-tab-events" hidden></section>';
document.body.appendChild(aside);
const el=(id)=>aside.querySelector('#'+id);
const events=el('tfqa-events');
const nativeEvents=document.getElementById('pv-qa');
// Preserve the existing original wallet test callbacks; do not reimplement them.
if(nativeEvents){
  events.appendChild(nativeEvents);
}else{
  events.innerHTML='<p>Тестовые события недоступны в этой сборке</p>';
}
function selectTab(tab){
 const isEvents=tab==='events';
 el('tfqa-scenarios').hidden=isEvents;
 events.hidden=!isEvents;
 el('tfqa-tab-scenarios').setAttribute('aria-selected',String(!isEvents));
 el('tfqa-tab-events').setAttribute('aria-selected',String(isEvents));
}
el('tfqa-tab-scenarios').addEventListener('click',()=>selectTab('scenarios'));
el('tfqa-tab-events').addEventListener('click',()=>selectTab('events'));
aside.querySelector('[role="tablist"]').addEventListener('keydown',event=>{
 const tabs=[el('tfqa-tab-scenarios'),el('tfqa-tab-events')];
 if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
 event.preventDefault();
 const i=event.key==='Home'?0:event.key==='End'?1:
   (tabs.indexOf(document.activeElement)+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;
 const target=tabs[i<0?0:i];
 selectTab(target===tabs[0]?'scenarios':'events');
 target.focus();
});

const help={
 idle:'',
 initiated:'Письмо отправлено. Показан экран ожидания перехода по ссылке',
 verified:'Почта подтверждена. Ожидается завершение проверки',
 approved:'Проверка завершена. Откроется обычный сценарий без подтверждения',
 manual_review:'Почта подтверждена. Ожидается завершение проверки',
 rejected:'Проверка не пройдена. Пользователь может обратиться в поддержку',
 error:'Ошибка получения статуса. Пользователь может повторить проверку'
};
function render(){
 const s=qa.getState();
 el('tfqa-status').value=s.status==='manual_review'?'verified':(Object.hasOwn(help,s.status)?s.status:'idle');
 const description=help[s.status]||'';
 el('tfqa-help').textContent=description;
 el('tfqa-help').hidden=!description;
 el('tfqa-summary').textContent=s.notice==='approved'?'Уведомление получено':s.status==='approved'?'Можно продолжать':'Проверка не завершена';
 el('tfqa-dot').className='tfqa-dot'+(s.status==='approved'?' approved':s.status==='verified'||s.status==='initiated'||s.status==='manual_review'?' pending':'');
}
el('tfqa-status').addEventListener('change',function(){qa.setScenarioStatus(this.value)});
el('tfqa-open').addEventListener('click',function(){qa.openSelected()});
el('tfqa-notify').addEventListener('click',function(){qa.triggerApprovalNotice()});
el('tfqa-reset').addEventListener('click',function(){qa.reset()});
document.addEventListener('tfv-change',render);
render();
})();