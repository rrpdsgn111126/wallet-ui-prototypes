/* Experiment boot: load canonical wallet preview behavior once,
   then mount ONLY the experimental route logic. */
(function(){
  'use strict';
  const current=document.currentScript;
  const src=new URL('../../design-system/transfi-remittance/preview-interactions.js',current.src);
  const script=document.createElement('script');
  script.src=src.href;
  script.async=false;
  script.onload=function(){
    const route=document.createElement('script');
    route.src=new URL('./withdraw-route-experiment.js?v=20261120',current.src).href;
    document.head.appendChild(route);
  };
  script.onerror=function(){console.error('Failed to load canonical preview-interactions.js');};
  document.head.appendChild(script);
})();
