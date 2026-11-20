/* Reusable overlay scrollbar for phone scroll regions.
   The native scroller still handles wheel, touch, keyboard and inertia. */
(() => {
  'use strict';
  const selector = '.phone .view.on > .wrap, .phone.tf-phone .tf-scroll, .phone [data-overlay-scroll]';
  const instances = new Map();
  let scanQueued = false;

  function create(scroller) {
    if (instances.has(scroller) || !scroller.parentElement) return;
    const host = scroller.parentElement;
    const hostStyle = getComputedStyle(host);
    if (hostStyle.position === 'static') host.style.position = 'relative';
    scroller.classList.add('ds-overlay-scroll');

    const thumb = document.createElement('div');
    thumb.className = 'ds-scroll-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    host.appendChild(thumb);
    let timeout = 0;
    let dragging = false;
    let pointerY = 0;
    let initialTop = 0;
    let thumbTravel = 0;
    let scrollRange = 0;

    function hideLater() {
      clearTimeout(timeout);
      if (!dragging) timeout = window.setTimeout(() => thumb.classList.remove('is-visible'), 850);
    }
    function update() {
      if (!scroller.isConnected) return;
      const range = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      if (!range || scroller.clientHeight < 10) {
        thumb.classList.remove('is-visible');
        thumb.style.height = '0px';
        return;
      }
      const scrollRect = scroller.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      const visibleHeight = scrollRect.height;
      const handleHeight = Math.max(28, Math.min(visibleHeight, visibleHeight * scroller.clientHeight / scroller.scrollHeight));
      const travel = Math.max(0, visibleHeight - handleHeight);
      thumb.style.height = handleHeight + 'px';
      thumb.style.top = (scrollRect.top - hostRect.top + (scroller.scrollTop / range) * travel) + 'px';
      thumb.style.right = '4px';
      thumbTravel = travel;
      scrollRange = range;
    }
    function onScroll() {
      update();
      if (!scrollRange) return;
      thumb.classList.add('is-visible');
      hideLater();
    }
    function startDrag(event) {
      if (event.button !== 0 || !scrollRange) return;
      event.preventDefault();
      dragging = true;
      pointerY = event.clientY;
      initialTop = scroller.scrollTop;
      clearTimeout(timeout);
      thumb.classList.add('is-visible', 'is-dragging');
      thumb.setPointerCapture(event.pointerId);
    }
    function moveDrag(event) {
      if (!dragging) return;
      event.preventDefault();
      scroller.scrollTop = initialTop + (event.clientY - pointerY) * (scrollRange / Math.max(1, thumbTravel));
      update();
    }
    function stopDrag() {
      if (!dragging) return;
      dragging = false;
      thumb.classList.remove('is-dragging');
      hideLater();
    }
    scroller.addEventListener('scroll', onScroll, {passive:true});
    thumb.addEventListener('pointerdown', startDrag);
    thumb.addEventListener('pointermove', moveDrag);
    thumb.addEventListener('pointerup', stopDrag);
    thumb.addEventListener('pointercancel', stopDrag);
    thumb.addEventListener('lostpointercapture', stopDrag);
    instances.set(scroller, {thumb, update, dispose() {
      clearTimeout(timeout);
      scroller.removeEventListener('scroll', onScroll);
      thumb.removeEventListener('pointerdown', startDrag);
      thumb.removeEventListener('pointermove', moveDrag);
      thumb.removeEventListener('pointerup', stopDrag);
      thumb.removeEventListener('pointercancel', stopDrag);
      thumb.removeEventListener('lostpointercapture', stopDrag);
      thumb.remove();
      scroller.classList.remove('ds-overlay-scroll');
    }});
    update();
  }

  function scan() {
    scanQueued = false;
    for (const [node, instance] of instances) {
      if (!node.isConnected || !node.matches(selector)) {
        instance.dispose();
        instances.delete(node);
      }
    }
    document.querySelectorAll(selector).forEach(create);
    for (const instance of instances.values()) instance.update();
  }
  function scheduleScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', scheduleScan, {once:true});
  else scheduleScan();
  window.addEventListener('resize', scheduleScan, {passive:true});
  if (typeof ResizeObserver !== 'undefined') {
    // The parent browser's viewport can change without a window resize in embeds.
    new ResizeObserver(scheduleScan).observe(document.documentElement);
  }
  new MutationObserver(scheduleScan).observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['class']});
})();
