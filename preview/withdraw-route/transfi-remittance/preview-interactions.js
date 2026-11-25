/* Experiment boot: load canonical wallet preview behavior once,
   then mount ONLY the experimental route logic. */
(function(){
  'use strict';
  const current=document.currentScript;
  const version=new URL(current.src).searchParams.get('v');
  function versioned(path){const url=new URL(path,current.src);if(version)url.searchParams.set('v',version);return url;}
  const src=versioned('../../design-system/transfi-remittance/preview-interactions.js');
  const script=document.createElement('script');
  script.src=src.href;
  script.async=false;
  script.onload=function(){
    const component=document.createElement('script');
    component.src=versioned('../../design-system/transfi-remittance/route-card.js').href;
    component.async=false;
    component.onload=function(){
      const route=document.createElement('script');
      route.src=versioned('./withdraw-route-experiment.js').href;
      document.head.appendChild(route);
    };
    component.onerror=function(){console.error('Failed to load canonical route-card.js');};
    document.head.appendChild(component);
  };
  script.onerror=function(){console.error('Failed to load canonical preview-interactions.js');};
  document.head.appendChild(script);
})();
