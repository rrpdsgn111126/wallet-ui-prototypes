/* Experiment-only navigation loading. Reuses the existing .spin component.
   A pending navigation keeps the current view mounted until its original
   handler is invoked; completion is detected from the actual rendered view. */
(function(){
  'use strict';
  if(window.altNavigationLoader)return;
  const MIN_PREVIEW_MS=190;
  const FAILURE_TIMEOUT_MS=10000;
  let pending=null;
  let replaying=false;
  const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));

  function viewState(){
    const phone=document.querySelector('.phone');
    const bank=document.querySelector('.phone.tf-phone #content');
    const overlay=document.querySelector('#tf-bank-overlay');
    const screen=(typeof S!=='undefined'&&S&&typeof S.screen==='string')?S.screen:null;
    return {
      views:phone?[...phone.querySelectorAll('.view.on, .view.ovl')].map(v=>v.id+':'+v.className).join('|'):'',
      bankChild:bank?.firstElementChild||null,
      bankScreen:screen,
      overlay:overlay?(overlay.hidden?'hidden':overlay.className):'absent',
      url:location.href,
      error:document.querySelector('.tf-submit-error, #exp-error, [role="alert"]')?.textContent?.trim()||''
    };
  }
  function changed(before,after,element){
    return !element.isConnected || before.views!==after.views ||
      before.bankChild!==after.bankChild || before.bankScreen!==after.bankScreen ||
      before.overlay!==after.overlay || before.url!==after.url ||
      (after.error!==before.error&&!!after.error);
  }
  function candidate(event){
    if(!(event.target instanceof Element))return null;
    const scope=event.target.closest('.phone');
    if(!scope)return null;
    if(event.target.closest('[role="radio"],[role="option"],[data-picker-value],[data-ns],.nav-loading-exempt'))return null;
    const row=event.target.closest(
      '.phone .method-list .method-option, .phone .m[data-go], .phone .row[data-go], '+
      '.phone .row[data-tf-bank], .phone .op[data-go], .phone .op[data-id], .phone .op[onclick], '+
      '.phone #v-history .op, .phone .row[data-open], .phone .row[data-act^="open-"], .phone .row[data-act^="go-"]'
    );
    if(row)return {element:row,kind:'row'};
    const button=event.target.closest('.phone button.btn, .phone button.btno');
    if(!button)return null;
    const label=(button.textContent||'').trim();
    const action=(button.getAttribute('onclick')||'').toLowerCase();
    if(!/^(продолжить|далее|проверить|перевести|вывести|пополнить|подтвердить|отправить|перейти|открыть|начать|создать|готово|завершить|оформить|получить|оплатить|на главную|показать|попробовать|вернуться|войти)/i.test(label) &&
       !/\b(checkrecipient|checkconfig|checkreview|wdcheck|trcheck)\b/.test(action))return null;
    return {element:button,kind:'button'};
  }
  function attachSpinner(element,kind){
    element.classList.add('nav-loading');
    element.setAttribute('aria-busy','true');
    const spinner=document.createElement('span');
    spinner.className='spin nav-spinner';
    spinner.setAttribute('aria-hidden','true');
    const holder=kind==='row'&&element.querySelector('.method-chevron, .row-chevron, .chevron, :scope > svg');
    // SVG cannot render an HTML <span>; keep the spinner as a row sibling,
    // in the same right-hand slot as the original chevron.
    element.appendChild(spinner);
    if(kind==='row')element.classList.add(holder?'nav-loading-slot':'nav-loading-plain');
    else element.classList.add('nav-loading-button');
    return spinner;
  }
  function finish(task){
    if(pending!==task)return;
    clearTimeout(task.startTimer);clearTimeout(task.expireTimer);
    task.observer?.disconnect();
    task.spinner.remove();
    task.element.classList.remove('nav-loading','nav-loading-slot','nav-loading-plain','nav-loading-button');
    task.element.removeAttribute('aria-busy');
    pending=null;
  }
  async function start(task){
    await frame();
    if(pending!==task)return;
    task.startTimer=setTimeout(async()=>{
      if(pending!==task)return;
      await frame();
      if(pending!==task)return;
      const original=viewState();
      task.observer=new MutationObserver(()=>{
        if(pending===task&&changed(original,viewState(),task.element)){
          requestAnimationFrame(()=>finish(task));
        }
      });
      task.observer.observe(document.documentElement,{
        subtree:true,childList:true,attributes:true,
        attributeFilter:['class','hidden']
      });
      task.expireTimer=setTimeout(()=>finish(task),FAILURE_TIMEOUT_MS);
      try{
        replaying=true;
        task.element.click();
      }catch(err){
        finish(task);
        console.error('Navigation retry failed',err);
      }finally{replaying=false;}
      if(pending===task&&changed(original,viewState(),task.element)){
        requestAnimationFrame(()=>finish(task));
      }
    },MIN_PREVIEW_MS);
  }
  window.addEventListener('click',event=>{
    if(replaying||event.defaultPrevented)return;
    const target=candidate(event);
    if(!target)return;
    if(target.element.matches('[disabled],[aria-disabled="true"],[aria-busy="true"]') ||
       target.element.closest('[inert],.method-skeleton-loading'))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(pending)return; // Ignore rapid repeated navigation taps.
    const task={...target,spinner:attachSpinner(target.element,target.kind)};
    pending=task;
    start(task);
  },true);
  window.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&pending)finish(pending);
  },true);
  window.altNavigationLoader=Object.freeze({
    isLoading:()=>!!pending,
    cancel:()=>{if(pending)finish(pending);}
  });
})();