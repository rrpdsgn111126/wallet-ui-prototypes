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

// Every semantic alias must depend on exactly one shared typographic foundation.
const definitionCss = fs.readFileSync(new URL('../../tokens/tokens.css', import.meta.url), 'utf8');
const definitionJson = JSON.parse(fs.readFileSync(new URL('../../tokens/tokens.json', import.meta.url), 'utf8'));
const foundations = new Map(definitionJson.text_styles.map(style => [style.key, style]));
assert.equal(definitionJson.text_styles.length, foundations.size, 'Duplicate foundation key');
assert.equal(new Set(definitionJson.text_styles.map(style =>
  [style.size, style.line ?? 'normal', style.weight].join('|'))).size,
  foundations.size, 'Equivalent metric combinations must share one foundation');
for (const role of definitionJson.type) {
  const base = foundations.get(role.base);
  assert.ok(base, 'Missing typography foundation for ' + role.key);
  assert.deepEqual([role.size, role.line, role.weight], [base.size, base.line, base.weight],
    'Semantic style not equal to foundation: ' + role.key);
  assert.ok(definitionCss.includes('--ds-type-' + role.key + ': var(--ds-text-' + role.base + ');'),
    'Semantic style must reference foundation: ' + role.key);
}
const sameBody = ['row','field-value','lead','body-compact','body-compact-strong'];
assert.ok(sameBody.every(key => definitionJson.type.find(r => r.key === key).base === 'body-m'),
  'Identical 16/22/400 styles must share body-m');
const sameCaption = ['field-label','hint','action-label','nav-label'];
assert.ok(sameCaption.every(key => definitionJson.type.find(r => r.key === key).base === 'caption'),
  'Identical 12/16/400 styles must share caption');

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
      assert.equal(await page.locator('article.cmp .ds-typography').count(), 41,
        'Typography component must use only its two theme tables');
      // Bank component frames are intentionally loading="lazy" in the UI Kit.
      // Scroll the checked specimens into view before expecting their metrics.
      for (const id of ['btn','head','bnv','acts','amount','bankfields','recipientfields']) {
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
          text: card.querySelector('.ds-typography')?.innerText || ''
        }));
      });
      const find = id => report.find(x => x.id === id);
      assert.ok(find('btn')?.text.includes('16 px'), 'Button text has no computed 16px size');
      assert.ok(find('btn')?.text.includes('--ds-type-button'), 'Button token name missing');
      assert.ok(find('head')?.text.includes('20 px'), 'Screen title typography missing');
      // DS-06: header text shares the screen title metrics; input values are regular.
      for (const id of ['hdr','head','fld','amount']) {
        const frames = page.locator('#' + id + ' figure.v:not(.d) iframe');
        for (let k = 0; k < await frames.count(); k++) await frames.nth(k).scrollIntoViewIfNeeded();
        await page.waitForFunction(id => document.querySelector('#' + id +
          ' .ds-typography')?.dataset.ready === '1', id, { timeout: 30000 });
      }
      const measurements = await page.evaluate(() => {
        const get = (id, selector) => {
          const doc = document.querySelector('#' + id + ' figure.v:not(.d) iframe')?.contentDocument;
          const el = doc?.querySelector(selector);
          if (!el) return null;
          const c = doc.defaultView.getComputedStyle(el);
          return [c.fontSize, c.lineHeight, c.fontWeight];
        };
        return {
          home: get('hdr', '.who .uname'), title: get('head', '.h1'),
          field: get('fld', '.fld.w:not(.off) .fl input'),
          amount: get('amount', '.fld.w .fl .wd-amt')
        };
      });
      assert.deepEqual(measurements.home, measurements.title, 'Home header and screen title differ');
      assert.deepEqual(measurements.title, ['20px','24px','600'], 'Wrong heading font metrics');
      assert.deepEqual(measurements.field, ['16px','22px','400'], 'Field input weight mismatch');
      assert.deepEqual(measurements.amount, ['16px','22px','400'], 'Amount input weight mismatch');

      // Active filter chips retain the strong weight; inactive chips are regular.
      for (const id of ['chips']) {
        const frames = page.locator('#' + id + ' figure.v:not(.d) iframe');
        for (let k = 0; k < await frames.count(); k++) await frames.nth(k).scrollIntoViewIfNeeded();
      }
      const chipWeights = await page.locator('#chips figure.v:not(.d) iframe').first().evaluate(node => {
        const doc = node.contentDocument;
        const active = doc.querySelector('.chip.on');
        const inactive = doc.querySelector('.chip:not(.on)');
        if (!active || !inactive) return null;
        return [doc.defaultView.getComputedStyle(active).fontWeight,
          doc.defaultView.getComputedStyle(inactive).fontWeight];
      });
      assert.deepEqual(chipWeights, ['600','400'], 'Filter chip active/inactive weights mismatch');


      assert.ok(find('bnv')?.text.includes('12 px'), 'Navigation typography missing');
      assert.equal(await page.locator('.tbls').count(), 0, 'Legacy hard-coded tables must be removed');
      assert.equal(await page.locator('#ds-type-catalog').count(), 1, 'Measured typography catalog missing');
      await page.waitForFunction(() => {
        const aliases = [...document.querySelectorAll('#ds-type-catalog .ds-type-catalog-aliases')]
          .map(x => x.textContent);
        return aliases.some(x => x.includes('--ds-type-action-label') && x.includes('--ds-type-nav-label'));
      }, null, { timeout: 30000 });
      const catalog = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#ds-type-catalog .ds-type-catalog-row')];
        const captionRows = rows.filter(row => row.querySelector('.ds-type-catalog-aliases')?.textContent.includes('--ds-type-action-label'));
        const caption = captionRows[0] || null;
        return {
          captionRows:captionRows.length,
          metrics:caption ? [...caption.cells].slice(2, 5).map(td => td.textContent.trim()) : null,
          aliases:caption?.querySelector('.ds-type-catalog-aliases')?.textContent || '',
          foundation:caption?.querySelector('.ds-type-catalog-foundation')?.textContent || '',
          count:rows.length,
          components:document.querySelector('#ds-type-catalog-status')?.textContent
        };
      });
      assert.equal(catalog.captionRows, 1, 'Action and navigation must not create separate rows');
      assert.deepEqual(catalog.metrics, ['12 px','16 px','400'], 'Caption rollback/catalog mismatch');
      assert.equal(catalog.foundation, '--ds-text-caption', 'Wrong shared caption foundation');
      assert.ok(catalog.aliases.includes('--ds-type-nav-label'), 'Navigation alias absent from shared row');
      assert.ok(catalog.count >= 10, 'Measured summary unexpectedly empty');
      assert.ok(catalog.components.includes('образцов загружены'), 'Catalog readiness status missing');
      assert.ok(find('bnv')?.text.includes('--ds-type-nav-label'), 'Inherited navigation token was not detected');
      assert.ok(find('bnv')?.text.includes('--ds-text-caption'), 'Shared navigation foundation absent');

      assert.ok(find('amount')?.text.includes('12 px'), 'Amount field caption missing');
      // The foundation is a pair of actual styles instead of metadata + two samples.
      assert.equal(await page.locator('#type .meta, #type .ds-typography').count(), 0,
        'Third typography metadata column must not exist');
      const frames = page.locator('#type figure.v iframe');
      assert.equal(await frames.count(), 2, 'Exactly two themed typography tables required');
      await page.waitForFunction(expected => [...document.querySelectorAll('#type figure.v iframe')]
        .every(frame => frame.contentDocument?.querySelectorAll('[data-ds-type-style]').length === expected),
        definitionJson.text_styles.length, { timeout: 30000 });
      const themed = await page.evaluate(() => {
        const frames = [...document.querySelectorAll('#type figure.v iframe')];
        return frames.map(frame => {
          const doc = frame.contentDocument;
          const rows = [...doc.querySelectorAll('[data-ds-type-style]')];
          return {
            dark:doc.documentElement.classList.contains('dark'),
            count:rows.length, width:frame.getBoundingClientRect().width,
            rect:frame.getBoundingClientRect().toJSON(),
            items:rows.map(row => {
              const target = row.querySelector('[data-ds-type-sample]');
              const cs = doc.defaultView.getComputedStyle(target);
              return {
                key:row.dataset.dsTypeStyle, metrics:row.querySelector('[data-ds-type-metric]').textContent,
                size:cs.fontSize, line:cs.lineHeight, weight:cs.fontWeight,
                font:target.style.font
              };
            })
          };
        });
      });
      assert.deepEqual(themed.map(item => item.dark), [false,true], 'Theme variants mismatch');
      for (const view of themed) {
        assert.equal(view.count, definitionJson.text_styles.length, 'Incomplete live typography table');
        for (const item of view.items) {
          const style = foundations.get(item.key);
          assert.ok(style, 'Unknown style in table: ' + item.key);
          assert.equal(item.size, style.size, 'Rendered size mismatch for ' + item.key);
          assert.equal(item.weight, style.weight, 'Rendered weight mismatch for ' + item.key);
          if (style.line) assert.equal(item.line, style.line, 'Rendered line-height mismatch for ' + item.key);
          assert.ok(item.metrics.includes(item.size.replace('px',' px')), 'Computed metrics absent for ' + item.key);
          assert.ok(item.font.includes(style.token), 'Sample must use canonical shared style ' + item.key);
        }
      }
      if (width === 1440) assert.ok(themed[1].rect.left > themed[0].rect.right,
        'Desktop theme tables should be side by side');
      else assert.ok(themed[1].rect.top > themed[0].rect.top,
        'Mobile theme tables should be stacked');

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
      await page.locator('#type figure.v').first().screenshot({ path: path.join(output, 'type-light-' + width + '.png') });
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
