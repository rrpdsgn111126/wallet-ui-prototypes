/* One clearable-input controller for text, address, amount and FX amount.
   The common From/To card, selectors and readonly fields are excluded.
   Each layout gets the clear icon where its own component defines the action zone. */
(function(root){
'use strict';
if(root.AltvuFieldClear)return;
const CLASS='ds-field-clear';
const SELECTOR='.fld.w .fl input, .unit .urow .ut textarea, .unit .urow .ut input, .tf-bank-sbp .h:first-child .t input';
const SVG='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const buttons=new WeakMap();
const controls=new WeakMap();
let scheduled=false;
function kind(input){
  if(!(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement)||
    input.disabled||input.readOnly)return null;
  if(input.closest('.tf-bank-route-card, .exp-route-card, .fld.off, .fld.g, [data-no-clear]'))return null;
  if(input instanceof HTMLInputElement && !['text','search','email','tel','url','number'].includes(input.type))return null;
  if(input.closest('.tf-bank-sbp .h:first-child .t'))return 'conversion';
  const field=input.closest('.fld.w');
  if(field && input.closest('.fl')){
    if(field.matches('button, [role="button"], .net-pick, .tf-picker-trigger'))return null;
    return input.classList.contains('wd-amt')?'amount':'text';
  }
  if(input.closest('.unit .urow .ut'))return 'address';
  return null;
}
function buttonFor(input){
  return controls.get(input)||null;
}
function sync(input){
  const button=buttonFor(input);
  if(!button)return;
  button.hidden=!String(input.value||'').trim();
  const mirror=button.closest('.ds-conversion-inline')?.querySelector('.ds-conversion-mirror');
  if(mirror){
    mirror.textContent=input.value||input.placeholder||'0.00';
  }
}
function labelFor(input){
  const parent=input.closest('.fld.w, .urow, .tf-bank-sbp .t');
  const label=parent?.querySelector('.fl i, .ut i, label');
  return 'Очистить '+(label?.textContent?.trim()||input.getAttribute('aria-label')||'поле');
}
function makeButton(input){
  const button=document.createElement('button');
  button.type='button';
  button.className=CLASS;
  button.setAttribute('aria-label',labelFor(input));
  button.innerHTML=SVG;
  button.hidden=true;
  controls.set(input,button);
  buttons.set(button,input);
  return button;
}
function enhance(rootNode){
  const base=rootNode&&rootNode.querySelectorAll?rootNode:document;
  base.querySelectorAll(SELECTOR).forEach(input=>{
    const type=kind(input);
    if(!type)return;
    if(buttonFor(input)){sync(input);return;}
    const button=makeButton(input);
    if(type==='text'){
      const field=input.closest('.fld.w');
      let slot=[...field.children].find(el=>el.classList?.contains('ds-clear-slot'));
      if(!slot){
        slot=document.createElement('span');
        slot.className='ds-clear-slot';
        field.appendChild(slot);
      }
      slot.appendChild(button);
    }else if(type==='amount'){
      const field=input.closest('.fld.w');
      const addon=field.querySelector(':scope > .addon');
      const currency=addon?.querySelector('.cur');
      // Amount input's trailing action zone: X, currency symbol, MAX.
      // Never place X next to the leading coin illustration.
      if(!addon||!currency)return;
      field.classList.add('ds-clear-amount');
      addon.insertBefore(button,currency);
    }else if(type==='address'){
      const row=input.closest('.unit .urow');
      row.classList.add('ds-clear-address');
      row.appendChild(button);
    }else{
      const parent=input.parentElement;
      const inline=document.createElement('span');
      inline.className='ds-conversion-inline';
      const track=document.createElement('span');
      track.className='ds-conversion-track';
      const mirror=document.createElement('span');
      mirror.className='ds-conversion-mirror';
      mirror.setAttribute('aria-hidden','true');
      parent.insertBefore(inline,input);
      track.append(input,mirror);
      inline.append(track,button);
      parent.classList.add('ds-clear-conversion');
    }
    sync(input);
  });
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;enhance();});
}
document.addEventListener('click',event=>{
  const button=event.target.closest&&event.target.closest('button.'+CLASS);
  if(button){
    const input=buttons.get(button);
    if(!input||!kind(input))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    input.value='';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    sync(input);
    input.focus({preventScroll:true});
    return;
  }
  if(event.target.closest&&event.target.closest('.wd-max, #exp-use-all, #tf-bank-use-all, [data-act*="paste"], [data-act*="scan"], [data-act*="book"]')){
    setTimeout(schedule,0);
    setTimeout(schedule,250);
  }
},true);
document.addEventListener('input',event=>{
  if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)sync(event.target);
},true);
document.addEventListener('change',event=>{
  if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)sync(event.target);
},true);
document.addEventListener('focusin',event=>{
  if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)sync(event.target);
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
root.AltvuFieldClear=Object.freeze({enhance,sync});
})(window);
