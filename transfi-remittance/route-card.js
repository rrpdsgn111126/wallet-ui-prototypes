/* Shared "Откуда / Куда" card renderer.
   One structural source for the live crypto-withdrawal and SEPA/SWIFT routes.
   Receives real values, icons and controls from the hosting flow; owns no payment state. */
(function(root){
'use strict';
function escapeText(v){
  return String(v==null?'':v).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
/* The single clear control is shared by crypto addresses and bank destinations.
   Picker buttons cannot contain nested buttons: render the clear action after
   the picker leg as a sibling and position it over the value row with CSS. */
function clearButton(spec){
  if(!spec.clearable)return '';
  return '<button type="button" class="tf-route-clear"'+
    (spec.clearId?' id="'+escapeText(spec.clearId)+'"':'')+
    ' data-route-clear="'+escapeText(spec.clearKey||'destination')+'"'+
    ' aria-label="'+escapeText(spec.clearLabel||'Очистить поле')+'"'+
    (spec.filled?'':' hidden')+'>'+
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"'+
    ' stroke="currentColor" stroke-width="1.8" stroke-linecap="round"'+
    ' stroke-linejoin="round" aria-hidden="true">'+
    '<path d="M6 6l12 12M18 6L6 18"/></svg></button>';
}
function leg(spec,isCrypto){
  const button=Boolean(spec.picker);
  const tag=button?'button':'div';
  const attributes=button?' type="button" data-picker="'+escapeText(spec.picker)+
    '" aria-haspopup="dialog" aria-label="'+escapeText(spec.ariaLabel||spec.label)+'"':'';
  const id=spec.id?' id="'+escapeText(spec.id)+'"':'';
  const extra=button?' tf-bank-destination':'';
  // Coin/ALT.VU legs use the canonical 40/24 framed icon. Country flags
  // and generic bank symbols keep their independent icon treatment.
  const frameClass=(isCrypto||spec.framedIcon===true)?' ds-icon-frame':'';
  const control=clearButton(spec);
  const content=spec.clearable&&!button
    ?'<div class="tf-route-value-row">'+(spec.contentHtml||'')+control+'</div>'
    :(spec.contentHtml||'');
  return '<'+tag+attributes+id+' class="tf-bank-leg'+(isCrypto?' exp-leg':'')+extra+
    (button&&spec.filled&&spec.clearable?' tf-route-has-clear':'')+'">'+
    '<div class="fi"><div class="cn'+frameClass+'">'+(spec.iconHtml||'')+'</div></div>'+
    '<div class="fl'+(isCrypto?' exp-leg-main':'')+'"><i'+
      (spec.labelId?' id="'+escapeText(spec.labelId)+'"':'')+'>'+escapeText(spec.label)+'</i>'+
      content+'</div></'+tag+'>'+(button?control:'');
}
function syncClear(card,key,filled){
  if(!card)return;
  const control=card.querySelector('[data-route-clear="'+String(key||'destination')+'"]');
  if(control)control.hidden=!filled;
}
const arrow='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--n850)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v15m-6-6 6 6 6-6"/></svg>';
function render(options){
  const crypto=options.variant==='crypto';
  return '<div class="box tf-bank-route-card'+(crypto?' exp-route-card':'')+'" data-route-variant="'+escapeText(options.variant||'country')+'">'+
    leg(options.source,crypto)+
    '<div class="tf-bank-arrow-line'+(crypto?' exp-arrow-line':'')+'"><span class="tf-bank-arrow'+(crypto?' exp-arrow':'')+'">'+arrow+'</span></div>'+
    leg(options.destination,crypto)+
    (options.actionsHtml||'')+
    '</div>';
}
root.AltvuRouteCard=Object.freeze({render:render,syncClear:syncClear});
})(window);
