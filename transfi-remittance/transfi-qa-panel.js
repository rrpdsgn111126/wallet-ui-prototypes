/* Separate desktop QA controls for the alt.vu TransFi UX prototype. */
(function(){
'use strict';
const qa=window.tfVerificationQA;
if(!qa||!document.querySelector('.phone'))return;
const style=document.createElement('style');style.id='tf-qa-panel-style';
style.textContent=[
'#tf-qa-panel{position:fixed;z-index:105;top:50%;left:calc(50% + 202px);transform:translateY(-50%);width:min(306px,calc(50vw - 220px));max-height:calc(100vh - 36px);overflow:auto;background:#fff;color:#211e1d;border:1px solid #e3e6e8;border-radius:22px;box-shadow:0 14px 38px #16151418;padding:22px;font:400 14px/20px Inter,system-ui,sans-serif;text-align:left}',
'#tf-qa-panel *{box-sizing:border-box}',
'#tf-qa-panel header{padding-bottom:14px;border-bottom:1px solid #edf0f2;margin-bottom:17px}',
'#tf-qa-panel .tfqa-eyebrow{color:#737775;font-size:11px;line-height:16px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}',
'#tf-qa-panel h2{font:650 19px/24px Inter,system-ui,sans-serif;color:#211e1d;margin:6px 0 4px}',
'#tf-qa-panel p{font-size:12px;line-height:18px;color:#6b6767;margin:0}',
'#tf-qa-panel .tfqa-field{display:block;margin:0 0 15px}',
'#tf-qa-panel .tfqa-field span{display:block;font:600 12px/16px Inter,system-ui,sans-serif;margin:0 0 7px;color:#484b49}',
'#tf-qa-panel .tfqa-field select{display:block;appearance:none;-webkit-appearance:none;width:100%;min-height:44px;border:1px solid #d9dfe1;border-radius:12px;padding:10px 32px 10px 12px;color:#161514;background-color:#f7f8f9;background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%236b6767%27 stroke-width=%272%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 11px center;font:500 13px/20px Inter,system-ui,sans-serif;cursor:pointer}',
'#tf-qa-panel select:focus-visible,#tf-qa-panel button:focus-visible{outline:3px solid #8baa21;outline-offset:2px}',
'#tf-qa-panel .tfqa-note{padding:11px 12px;border-radius:12px;background:#f1f3f4;color:#505450;font-size:12px;line-height:17px;margin:-3px 0 15px}',
'#tf-qa-panel .tfqa-actions{display:grid;gap:8px;margin-top:18px}',
'#tf-qa-panel button{appearance:none;width:100%;min-height:44px;display:flex;align-items:center;justify-content:center;padding:10px 12px;border-radius:12px;border:0;font:600 13px/18px Inter,system-ui,sans-serif;cursor:pointer}',
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
aside.innerHTML='<header><div class="tfqa-eyebrow">alt.vu · TransFi</div><h2>Тестовые сценарии</h2><p>Выберите условия и проверьте путь пользователя</p></header>'
+'<label class="tfqa-field" for="tfqa-flow"><span>Направление</span><select id="tfqa-flow"><option value="in">Пополнение</option><option value="out">Вывод</option></select></label>'
+'<label class="tfqa-field" for="tfqa-rail"><span>Метод перевода</span><select id="tfqa-rail"><option value="SEPA">SEPA</option><option value="SWIFT">SWIFT</option></select></label>'
+'<label class="tfqa-field" for="tfqa-status"><span>Статус проверки</span><select id="tfqa-status"><option value="idle">Email не подтверждён</option><option value="initiated">Письмо отправлено</option><option value="verified">Email подтверждён, идёт проверка</option><option value="approved">Проверка одобрена</option><option value="manual_review">Дополнительная проверка</option><option value="rejected">Проверка отклонена</option><option value="error">Ошибка проверки</option></select></label>'
+'<div class="tfqa-note" id="tfqa-help" aria-live="polite"></div><div class="tfqa-actions"><button class="tfqa-primary" type="button" id="tfqa-open">Открыть сценарий</button><button class="tfqa-secondary" type="button" id="tfqa-notify">Получить уведомление</button><button class="tfqa-reset" type="button" id="tfqa-reset">Сбросить проверку</button></div>'
+'<footer><div class="tfqa-state"><span class="tfqa-dot" id="tfqa-dot"></span><span id="tfqa-summary"></span></div><p>Это тестовые состояния. Письма не отправляются, API TransFi не подключён</p></footer>';
document.body.appendChild(aside);
const el=(id)=>aside.querySelector('#'+id);
const help={
 idle:'При входе в SEPA/SWIFT появится запрос подтверждения email',
 initiated:'Письмо отправлено. Показан экран ожидания перехода по ссылке',
 verified:'Email подтверждён, но банковские операции ещё недоступны',
 approved:'Проверка завершена. Откроется обычный сценарий без подтверждения',
 manual_review:'Проверка продолжается. Продолжить перевод пока нельзя',
 rejected:'Проверка не пройдена. Пользователь может обратиться в поддержку',
 error:'Ошибка получения статуса. Пользователь может повторить проверку'
};
function render(){
 const s=qa.getState(),ctx=s.context||{flow:'in',rail:'SEPA'};
 el('tfqa-flow').value=ctx.flow==='out'?'out':'in';
 el('tfqa-rail').value=ctx.rail==='SWIFT'?'SWIFT':'SEPA';
 el('tfqa-status').value=help[s.status]?s.status:'idle';
 el('tfqa-help').textContent=help[s.status]||help.idle;
 el('tfqa-summary').textContent=s.notice==='approved'?'Уведомление получено':s.status==='approved'?'Можно продолжать':'Проверка не завершена';
 el('tfqa-dot').className='tfqa-dot'+(s.status==='approved'?' approved':s.status==='verified'||s.status==='initiated'||s.status==='manual_review'?' pending':'');
}
function contextChange(){qa.setContext(el('tfqa-rail').value,el('tfqa-flow').value)}
el('tfqa-flow').addEventListener('change',contextChange);
el('tfqa-rail').addEventListener('change',contextChange);
el('tfqa-status').addEventListener('change',function(){qa.setScenarioStatus(this.value)});
el('tfqa-open').addEventListener('click',function(){contextChange();qa.openSelected()});
el('tfqa-notify').addEventListener('click',function(){contextChange();qa.triggerApprovalNotice()});
el('tfqa-reset').addEventListener('click',function(){qa.reset()});
document.addEventListener('tfv-change',render);
render();
})();