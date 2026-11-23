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
    const component=document.createElement('script');
    component.src=new URL('../../design-system/transfi-remittance/route-card.js',current.src).href;
    component.async=false;
    component.onload=function(){
      const route=document.createElement('script');
      route.src=new URL('./withdraw-route-experiment.js?v=20261123',current.src).href;
      document.head.appendChild(route);
    };
    component.onerror=function(){console.error('Failed to load canonical route-card.js');};
    document.head.appendChild(component);
  };
  script.onerror=function(){console.error('Failed to load canonical preview-interactions.js');};
  document.head.appendChild(script);
})();
