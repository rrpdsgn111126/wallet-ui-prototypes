#!/usr/bin/env node
// DS: shared overlay scrollbar, not a permanently visible native track.
// Local: python3 -m http.server 8765 && node tests/design-system/overlay-scroll.mjs
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root = process.argv[2] || 'http://127.0.0.1:8765/';
const browser = await chromium.launch({headless: true});
try {
  for (const width of [390, 430, 1440]) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({viewport:{width,height:932}});
      const errors = [];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(new URL('components/scroll.html#'+theme, root).href);
      const scroller = page.locator('[data-overlay-scroll]');
      const thumb = page.locator('.ds-scroll-thumb');
      await page.waitForFunction(() => document.querySelector('.ds-scroll-thumb') &&
        document.querySelector('[data-overlay-scroll]')?.classList.contains('ds-overlay-scroll'));
      const initial = await page.evaluate(() => {
        const el = document.querySelector('[data-overlay-scroll]');
        const thumb = document.querySelector('.ds-scroll-thumb');
        return {
          range:el.scrollHeight-el.clientHeight,
          gutter:el.offsetWidth-el.clientWidth,
          nativeScrollbar:getComputedStyle(el).scrollbarWidth,
          thumbOpacity:getComputedStyle(thumb).opacity,
          thumbPosition:getComputedStyle(thumb).position,
          trackCount:document.querySelectorAll('.ds-scroll-track').length
        };
      });
      assert.ok(initial.range > 0, 'Scrollable content missing');
      assert.equal(initial.gutter,0,'Scroll gutter consumes layout width');
      assert.equal(initial.nativeScrollbar,'none','Native scrollbar must not remain visible');
      assert.equal(initial.thumbOpacity,'0','Thumb must be hidden before scrolling');
      assert.equal(initial.thumbPosition,'absolute','Thumb must overlay content');
      assert.equal(initial.trackCount,0,'No visible or hidden track element');
      // Programmatic scrolls (screen restoration/route changes) must not show a thumb.
      await scroller.evaluate(el => { el.scrollTop=12; });
      await page.waitForFunction(() => document.querySelector('[data-overlay-scroll]').scrollTop===12);
      assert.equal(await thumb.evaluate(el=>el.classList.contains('is-visible')),false,
        'Programmatic screen restoration flashed a scroll indicator');
      await scroller.evaluate(el => { el.scrollTop=0; });
      await scroller.hover();
      await page.mouse.wheel(0,180);
      await page.waitForFunction(() => document.querySelector('.ds-scroll-thumb')?.classList.contains('is-visible'));
      const before = await thumb.evaluate(el=>el.getBoundingClientRect().top);
      await page.mouse.wheel(0,80);
      await page.waitForTimeout(50);
      const after = await thumb.evaluate(el=>el.getBoundingClientRect().top);
      assert.ok(after>before,'Thumb does not follow scrolling');
      const box=await thumb.boundingBox();
      assert.ok(box && box.width<=4.5,'Overlay thumb should be thin');
      // Dragging the thumb must scroll the underlying native scrollport.
      const from=await scroller.evaluate(el=>el.scrollTop);
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
      await page.mouse.down();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2+35,{steps:4});
      await page.mouse.up();
      const to=await scroller.evaluate(el=>el.scrollTop);
      assert.ok(to>from,'Thumb drag failed to scroll');
      await page.waitForTimeout(1050);
      await page.waitForFunction(() => !document.querySelector('.ds-scroll-thumb')?.classList.contains('is-visible'));
      assert.deepEqual(errors,[],errors.join(' | '));
      console.log('Overlay scrollbar OK',width,theme);
      await page.close();
    }
  }
  for (const width of [390,430,1440]) {
    const page=await browser.newPage({viewport:{width,height:932}});
    await page.goto(new URL('transfi-remittance/legacy.html',root).href,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('.tf-scroll.ds-overlay-scroll'));
    assert.equal(await page.locator('.phone.tf-phone .ds-scroll-thumb').count(),1);
    const legacy=await page.locator('.tf-scroll').evaluate(el=>({
      gutter:el.offsetWidth-el.clientWidth, nativeScrollbar:getComputedStyle(el).scrollbarWidth
    }));
    assert.equal(legacy.gutter,0,'Legacy scrollport keeps a reserved gutter');
    assert.equal(legacy.nativeScrollbar,'none');
    await page.close();
  }
  // The production wallet profile does NOT scroll its child .wrap:
  // profile/settings/language/partner explicitly scroll .view.on with a stable
  // gutter in the old CSS. Test the real app, not just the standalone demo.
  for (const width of [390,430,1440]) {
    const page=await browser.newPage({viewport:{width,height:932}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(new URL('transfi-remittance/index.html',root).href,{waitUntil:'domcontentloaded'});
    for (const name of ['v-profile','v-settings','v-language','v-earn']) {
      await page.evaluate(id=>{
        document.querySelectorAll('.phone .view.on').forEach(el=>el.classList.remove('on'));
        const view=document.getElementById(id);
        if (id==='v-earn') view.classList.add('as-prof');
        view.classList.add('on');
      },name);
      await page.waitForFunction(id=>document.getElementById(id)?.classList.contains('ds-overlay-scroll'),name);
      const state=await page.evaluate(id=>{
        const el=document.getElementById(id);
        const c=getComputedStyle(el);
        const thumb=[...el.parentElement.children].find(x=>x.classList.contains('ds-scroll-thumb'));
        return {scrollbar:c.scrollbarWidth,gutter:c.scrollbarGutter,
          occupied:el.offsetWidth-el.clientWidth,
          overflowY:c.overflowY,
          thumbOpacity:thumb?getComputedStyle(thumb).opacity:null};
      },name);
      assert.equal(state.scrollbar,'none',name+' native track is visible');
      assert.equal(state.gutter,'auto',name+' still reserves scrollbar width');
      assert.equal(state.occupied,0,name+' scrollport shifts content horizontally');
      assert.equal(state.overflowY,'auto',name+' is no longer scrollable');
      assert.equal(state.thumbOpacity,'0',name+' thumb visible on opening');
      if (name==='v-earn') {
        const earn=page.locator('#v-earn');
        const range=await earn.evaluate(el=>el.scrollHeight-el.clientHeight);
        if (range>0) {
          await earn.hover({position:{x:180,y:180}});
          await page.mouse.wheel(0,150);
          await page.waitForFunction(()=>[...document.querySelector('.phone').children]
            .some(x=>x.classList.contains('ds-scroll-thumb')&&x.classList.contains('is-visible')));
        }
      }
    }
    assert.deepEqual(errors,[],errors.join(' | '));
    await page.close();
    console.log('Native profile/settings/language/earn scrollbars OK',width);
  }
} finally {
  await browser.close();
}
