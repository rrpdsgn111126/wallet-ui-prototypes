/* Canonical bank selector flags. Shared by the design-system preview and
   the isolated withdrawal-route experiment; no locally duplicated flag SVGs. */
(function(root){
'use strict';
function uxFlag(country){
 const c=String(country||'').toUpperCase();
 const stripe=(color,x,y,w,h)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+color+'"/>';
 const patterns={
  EU:stripe('#003399',0,0,24,24)+
    Array.from({length:12},(_,i)=>{
      const a=i*Math.PI/6-Math.PI/2;
      const x=(12+7.5*Math.cos(a)).toFixed(2);
      const y=(12+7.5*Math.sin(a)).toFixed(2);
      return '<polygon points="0,-1.85 .45,-.57 1.77,-.57 .7,.22 1.1,1.54 0,.77 -1.1,1.54 -.7,.22 -1.77,-.57 -.45,-.57" transform="translate('+x+' '+y+')" fill="#FFCC00"/>';
    }).join(''),
  DE:stripe('#161616',0,0,24,8)+stripe('#DD0000',0,8,24,8)+stripe('#FFCE00',0,16,24,8),
  FR:stripe('#0055A4',0,0,8,24)+stripe('#FFFFFF',8,0,8,24)+stripe('#EF4135',16,0,8,24),
  NL:stripe('#AE1C28',0,0,24,8)+stripe('#FFFFFF',0,8,24,8)+stripe('#21468B',0,16,24,8),
  ES:stripe('#AA151B',0,0,24,6)+stripe('#F1BF00',0,6,24,12)+stripe('#AA151B',0,18,24,6)+
    '<rect x="7" y="10" width="2.7" height="5" rx=".5" fill="#C62828"/><rect x="7.5" y="10.2" width="1.7" height="1.2" fill="#FFFFFF"/>',
  GB:stripe('#012169',0,0,24,24)+
    '<path d="M-2 -1 26 25M26 -1 -2 25" stroke="#FFFFFF" stroke-width="6"/>'+
    '<path d="M-2 -1 26 25M26 -1 -2 25" stroke="#C8102E" stroke-width="2.6"/>'+
    '<path d="M12 0V24M0 12H24" stroke="#FFFFFF" stroke-width="8"/>'+
    '<path d="M12 0V24M0 12H24" stroke="#C8102E" stroke-width="4"/>',
  US:stripe('#FFFFFF',0,0,24,24)+
    Array.from({length:7},(_,i)=>stripe('#B22234',0,(i*48/13).toFixed(3),24,(24/13).toFixed(3))).join('')+
    stripe('#3C3B6E',0,0,10.7,12.9)+
    Array.from({length:12},(_,i)=>'<circle cx="'+(1.7+(i%3)*3.4)+'" cy="'+(1.5+Math.floor(i/3)*3.2)+'" r=".7" fill="#FFFFFF"/>').join('')
 };
 return '<svg class="tf-country-flag" width="24" height="24" viewBox="0 0 24 24" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'+
   (patterns[c]||stripe('#E9ECF0',0,0,24,24))+'</svg>';
}
function uxFlagPlate(country){
 return '<span class="tf-flag-circle" aria-hidden="true">'+uxFlag(country)+'</span>';
}
// Flags identify the associated currency area, not necessarily one country.
// Keep unsupported currencies on the existing currency-icon fallback.

function currencyPlate(currency){
  const region={EUR:'EU',USD:'US',GBP:'GB'}[String(currency||'').toUpperCase()];
  return region ? uxFlagPlate(region) : null;
}
root.AltvuSelectorFlags=Object.freeze({
  flag:uxFlag,
  plate:uxFlagPlate,
  currencyPlate
});
})(window);
