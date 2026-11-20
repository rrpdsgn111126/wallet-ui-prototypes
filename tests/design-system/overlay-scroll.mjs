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
      await scroller.evaluate(el => el.scrollTop=180);
      await page.waitForFunction(() => document.querySelector('.ds-scroll-thumb')?.classList.contains('is-visible'));
      const before = await thumb.evaluate(el=>el.getBoundingClientRect().top);
      await scroller.evaluate(el => el.scrollTop+=80);
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
  const page=await browser.newPage({viewport:{width:430,height:932}});
  await page.goto(new URL('transfi-remittance/legacy.html',root).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.tf-scroll.ds-overlay-scroll'));
  assert.equal(await page.locator('.phone.tf-phone .ds-scroll-thumb').count(),1);
  await page.close();
} finally {
  await browser.close();
}
