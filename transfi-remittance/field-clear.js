/* Shared clearable input behavior for the canonical text field, amount field
   and amount-with-conversion. No button is ever added to the From/To card.
   Hosts retain ownership of validation, formatting, quote and payment state. */
(function(root){
'use strict';
if(root.AltvuFieldClear)return;
const SELECTOR='.fld.w input, .tf-bank-sbp .h:first-child .t input';
const CLEAR_CLASS='ds-field-clear';
const SVG='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
let scheduled=false;
function eligible(input){
  if(!(input instanceof HTMLInputElement)||input.disabled||input.readOnly)return false;
  if(!['text','search','email','tel','url','number'].includes(input.type))return false;
  if(input.closest('.tf-bank-route-card, .exp-route-card, .fld.off, .fld.g, [data-no-clear]'))return false;
  const field=input.closest('.fld.w');
  if(field&&field.matches('button, [role="button"], .net-pick, .tf-picker-trigger'))return false;
  if(field&&input.closest('.fl'))return true;
  return Boolean(input.closest('.tf-bank-sbp .h:first-child .t'));
}
function owner(input){
  return input.closest('.tf-bank-sbp .h:first-child .t')||input.closest('.fld.w .fl');
}
function control(input){
  const host=owner(input);
  return host&&[...host.children].find(el=>el.classList&&el.classList.contains(CLEAR_CLASS))||null;
}
function update(input){
  const button=control(input);
  if(!button)return;
  button.hidden=!(input.value&&String(input.value).trim());
}
function enhance(rootNode){
  const base=rootNode&&rootNode.querySelectorAll?rootNode:document;
  base.querySelectorAll(SELECTOR).forEach(input=>{
    if(!eligible(input))return;
    const host=owner(input);
    if(!host)return;
    let button=control(input);
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className=CLEAR_CLASS;
      button.setAttribute('aria-label','Очистить '+(host.querySelector('i,label')?.textContent?.trim()||input.getAttribute('aria-label')||'поле'));
      button.innerHTML=SVG;
      button.hidden=true;
      host.appendChild(button);
      host.classList.add('ds-has-clear');
    }
    update(input);
  });
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;enhance();});
}
function findInput(button){
  const host=button.parentElement;
  return host&&host.querySelector('input');
}
document.addEventListener('click',event=>{
  const button=event.target.closest&&event.target.closest('button.'+CLEAR_CLASS);
  if(button){
    const input=findInput(button);
    if(!input||!eligible(input))return;
    event.preventDefault();event.stopImmediatePropagation();
    input.value='';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    update(input);
    input.focus({preventScroll:true});
    return;
  }
  if(event.target.closest&&event.target.closest('.wd-max, #exp-use-all, #tf-bank-use-all'))schedule();
},true);
document.addEventListener('input',event=>{
  if(event.target instanceof HTMLInputElement)update(event.target);
},true);
document.addEventListener('change',event=>{
  if(event.target instanceof HTMLInputElement)update(event.target);
},true);
function start(){
  enhance();
  if(document.body){
    new MutationObserver(records=>{
      if(records.some(r=>r.addedNodes.length||r.removedNodes.length))schedule();
    }).observe(document.body,{subtree:true,childList:true});
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
root.AltvuFieldClear=Object.freeze({enhance,sync:update});
})(window);
