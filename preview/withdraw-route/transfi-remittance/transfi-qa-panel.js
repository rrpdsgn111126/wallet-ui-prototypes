/* Load the single canonical QA panel; no branch-local UI/CSS copy. */
(function(){
  'use strict';
  const current=document.currentScript;
  const script=document.createElement('script');
  script.src=new URL('../../design-system/transfi-remittance/transfi-qa-panel.js',current.src).href;
  script.async=false;
  script.onerror=function(){console.error('Failed to load canonical transfi-qa-panel.js');};
  document.head.appendChild(script);
})();
