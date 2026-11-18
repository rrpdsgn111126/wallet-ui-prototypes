#!/usr/bin/env node
// DS-03: each UI Kit card reports the actually rendered typography, not copied numbers.
// Run against a local HTTP server, e.g. python3 -m http.server 8765.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:8765/ui-kit/';
const output = path.join(process.env.RUNNER_TEMP || '/tmp', 'ds-03-typography');
fs.mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
let fail = false;
try {
  for (const width of [390, 430, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 932 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const cards = page.locator('article.cmp');
      assert.equal(await cards.count(), 42, 'Unexpected component gallery count');
      assert.equal(await page.locator('article.cmp .ds-typography').count(), 42,
        'Not every component received a typography panel');
      // Bank component frames are intentionally loading="lazy" in the UI Kit.
      // Scroll the checked specimens into view before expecting their metrics.
      for (const id of ['btn','head','bnv','amount','type','bankfields','recipientfields']) {
        const frames = page.locator('#' + id + ' figure.v:not(.d) iframe');
        const n = await frames.count();
        for (let k = 0; k < n; k++) await frames.nth(k).scrollIntoViewIfNeeded();
        await page.waitForFunction(id => document.querySelector('#' + id +
          ' .ds-typography')?.dataset.ready === '1', id, { timeout: 30000 });
      }

      const report = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('article.cmp')];
        return cards.map(card => ({
          id: card.id,
          count: card.querySelectorAll('.ds-typo-item').length,
          text: card.querySelector('.ds-typography').innerText
        }));
      });
      const find = id => report.find(x => x.id === id);
      assert.ok(find('btn')?.text.includes('16 px'), 'Button text has no computed 16px size');
      assert.ok(find('btn')?.text.includes('--ds-type-button'), 'Button token name missing');
      assert.ok(find('head')?.text.includes('20 px'), 'Screen title typography missing');
      assert.ok(find('bnv')?.text.includes('12 px'), 'Navigation typography missing');
      assert.ok(find('amount')?.text.includes('12 px'), 'Amount field caption missing');
      assert.ok(find('type')?.count >= 6, 'Typography scale specimen incomplete');
      if (find('bankfields')?.count === 0) {
        const debug = await page.evaluate(() => {
          const outer = document.querySelector('#bankfields figure.v:not(.d) iframe');
          const doc = outer?.contentDocument;
          const nested = doc?.querySelector('iframe');
          const inner = nested?.contentDocument;
          const phone = inner?.querySelector('.phone');
          const candidates = phone ? [...phone.querySelectorAll('h1,h2,p,span,b,i,button,div,input')].filter(el=>(el.textContent || el.getAttribute('placeholder') || '').trim()).slice(0,15).map(el=>({
            tag:el.tagName, cls:el.className?.toString().slice(0,60), text:el.textContent.slice(0,50),
            style:inner.defaultView.getComputedStyle(el).fontSize, rects:el.getClientRects().length,
            visible:inner.defaultView.getComputedStyle(el).display
          })) : [];
          return {outerSrc:outer?.src,outerReady:doc?.readyState,outerURL:doc?.URL,
            innerSrc:nested?.src,innerReady:inner?.readyState,innerURL:inner?.URL,
            innerBody:inner?.body?.className,phoneClass:phone?.className,phoneText:phone?.innerText?.slice(0,200),
            candidates};
        });
        console.error('BANK DEBUG', JSON.stringify(debug));
      }
      assert.ok(find('bankfields')?.count > 0,
        'Nested bank specimen was not inspected: ' + JSON.stringify(find('bankfields')));
      assert.ok(find('recipientfields')?.count > 0,
        'Nested recipient specimen was not inspected: ' + JSON.stringify(find('recipientfields')));

      // Changing a real CSS variable changes the rendered value after remeasurement.
      if (width === 1440) {
        const iframe = page.locator('#btn figure.v:not(.d) iframe').first();
        await iframe.evaluate(node => {
          node.contentDocument.documentElement.style.setProperty('--ds-font-size-16', '18px');
          node.dispatchEvent(new Event('load'));
        });
        await page.waitForFunction(() =>
          document.querySelector('#btn .ds-typo-list')?.textContent.includes('18 px'),
          null, { timeout: 10000 });
        await iframe.evaluate(node => {
          node.contentDocument.documentElement.style.removeProperty('--ds-font-size-16');
          node.dispatchEvent(new Event('load'));
        });
      }

      await page.locator('#btn .meta').screenshot({ path: path.join(output, 'button-typography-' + width + '.png') });
      await page.locator('#type .meta').screenshot({ path: path.join(output, 'type-typography-' + width + '.png') });
      assert.deepEqual(errors, [], 'UI Kit page errors: ' + errors.join(' | '));
      console.log('UI Kit ' + width + 'px: ' + report.length + ' cards, ' +
        report.filter(x => x.count > 0).length + ' cards with text, measured values OK');
    } catch (e) {
      fail = true;
      console.error('DS-03 ERROR at ' + width + 'px:', e.stack || e);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (fail) process.exitCode = 1;
else console.log('DS-03 UI Kit typography inspection passed');
