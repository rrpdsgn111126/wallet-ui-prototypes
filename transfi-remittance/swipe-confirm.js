/* Shared experimental swipe CTA. Keeps native buttons, disabled state and keyboard access. */
(function(){
  'use strict';
  if(window.AltvuSwipeConfirm)return;
  const instances=new WeakMap();
  function mount(slider,onConfirm){
    if(instances.has(slider))return instances.get(slider);
    const labelText=slider.textContent.trim()||'Подтвердить';
    slider.classList.add('btn','exp-confirm-slide','nav-loading-exempt');
    if(!slider.hasAttribute('aria-label'))slider.setAttribute('aria-label',labelText+'. Сдвиньте вправо или нажмите Enter.');
    slider.innerHTML='<span class="exp-slide-fill" aria-hidden="true"></span><span class="exp-slide-label"></span><span class="exp-slide-thumb" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></span>';
    const label=slider.querySelector('.exp-slide-label'),thumb=slider.querySelector('.exp-slide-thumb');
    const spinner=document.createElement('span');
    spinner.className='spin nav-spinner';spinner.setAttribute('aria-hidden','true');
    label.textContent=labelText;
    let pointer=null,x0=0,travel=0,pos=0,scale=1,locked=false;
    function draw(x){
      pos=Math.max(0,Math.min(travel,x));
      slider.style.setProperty('--slide-x',pos+'px');
    }
    let generation=0;
    function setLoading(value){
      locked=!!value;
      slider.classList.toggle('nav-loading',locked);
      slider.classList.toggle('nav-loading-button',locked);
      if(locked){slider.setAttribute('aria-busy','true');slider.appendChild(spinner);}
      else{slider.removeAttribute('aria-busy');spinner.remove();}
    }
    function reset(){
      generation++;
      pointer=null;slider.classList.remove('dragging');draw(0);setLoading(false);
    }
    async function finish(){
      if(locked||slider.disabled||slider.getAttribute('aria-disabled')==='true')return;
      const current=++generation;
      setLoading(true);
      try{
        // Same minimum visual feedback as other navigation CTAs in this mock.
        await new Promise(resolve=>setTimeout(resolve,190));
        if(current!==generation||!slider.isConnected)return;
        await onConfirm();
      }catch(error){
        console.error('Swipe confirmation failed',error);
      }finally{
        if(current===generation)reset();
      }
    }
    slider.addEventListener('pointerdown',e=>{
      if(pointer!==null||locked||slider.disabled||e.button!==0)return;
      e.preventDefault();pointer=e.pointerId;x0=e.clientX;
      travel=Math.max(1,slider.clientWidth-thumb.offsetWidth-8);
      scale=slider.getBoundingClientRect().width/Math.max(1,slider.offsetWidth)||1;
      slider.classList.add('dragging');slider.setPointerCapture(pointer);draw(0);
    });
    slider.addEventListener('pointermove',e=>{if(e.pointerId===pointer)draw((e.clientX-x0)/scale);});
    function stop(e,commit){
      if(e.pointerId!==pointer)return;
      pointer=null;slider.classList.remove('dragging');
      if(commit&&pos>=travel*.9){finish();return;}
      draw(0);
    }
    slider.addEventListener('pointerup',e=>{if(e.pointerId===pointer)draw((e.clientX-x0)/scale);stop(e,true);});
    slider.addEventListener('pointercancel',e=>stop(e,false));
    slider.addEventListener('lostpointercapture',e=>stop(e,false));
    // Suppress the old delegated click action; keyboard activation is explicit.
    slider.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(e.detail===0)finish();},true);
    const instance=Object.freeze({reset,setLoading});instances.set(slider,instance);return instance;
  }
  window.AltvuSwipeConfirm=Object.freeze({mount});
})();
