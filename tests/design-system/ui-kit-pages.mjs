#!/usr/bin/env node
// Navigation and layout regression for the split component/foundations UI Kit.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:8765/ui-kit/';
const output = path.join(process.env.RUNNER_TEMP || '/tmp', 'ui-kit-pages');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
let failed = false;
try {
  for (const width of [390, 430, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 932 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      assert.equal(await page.locator('article.cmp').count(), 47,
        'The component index must keep only its 47 component cards');
      assert.equal(await page.locator('#tokens, #type, #ds-type-catalog').count(), 0,
        'Foundations must no longer render on the component index');
      assert.equal(await page.locator('nav.toc a[href="styles.html#tokens"]').count(), 1);
      assert.equal(await page.locator('nav.toc a[href="styles.html#text-styles"]').count(), 1);
      assert.equal(await page.locator('nav.toc a[href="./"][aria-current="page"]').count(), 1);

      await page.locator('nav.toc a[href="styles.html#tokens"]').click();
      await page.waitForURL(/\/styles\.html#tokens$/, { timeout: 30000 });
      assert.equal(await page.locator('#tokens .tk').count() > 30, true,
        'Token specimens missing');
      assert.equal(await page.locator('nav.toc a[href="#tokens"][aria-current="location"]').count(), 1);

      await page.locator('nav.toc a[href="#text-styles"]').click();
      await page.waitForURL(/\/styles\.html#text-styles$/);
      assert.equal(await page.locator('#type figure.v iframe').count(), 2,
        'Typography must keep its light and dark live tables');
      await page.waitForFunction(() =>
        [...document.querySelectorAll('#type figure.v iframe')]
          .every(frame => frame.contentDocument?.querySelector('[data-ds-type-style]')),
        null, { timeout: 30000 });
      await page.waitForFunction(() => {
        const status = document.querySelector('#ds-type-catalog-status')?.textContent || '';
        const ready = status.match(/(\d+) из (\d+) образцов загружены/);
        return ready && Number(ready[1]) >= 40 &&
          document.querySelectorAll('#ds-type-catalog .ds-type-catalog-row').length >= 10;
      }, null, { timeout: 60000 });
      assert.equal(await page.locator('#ds-measurement-samples article.cmp').count(), 47,
        'Live component sample list must be generated from the index');
      assert.equal(await page.locator('nav.toc a[href="#text-styles"][aria-current="location"]').count(), 1);
      const hrefs = await page.locator('#ds-type-catalog .ds-type-catalog-components a')
        .evaluateAll(links => links.map(link => link.getAttribute('href')));
      assert.ok(hrefs.some(href => href?.startsWith('./#')),
        'Typography references must link back to the component page');
      assert.ok(hrefs.every(href => href === '#type' || href?.startsWith('./#')),
        'Typography contains a broken component link');
      await page.screenshot({
        path: path.join(output, 'styles-' + width + '.png'), fullPage: false
      });

      await page.locator('nav.toc a[href="./"]').click();
      await page.waitForURL(u => u.pathname.endsWith('/ui-kit/'));
      await page.locator('nav.toc a[href="#g-buttons"]').click();
      await page.waitForURL(/#g-buttons$/);
      assert.equal(await page.locator('#g-buttons').count(), 1);
      await page.screenshot({
        path: path.join(output, 'components-' + width + '.png'), fullPage: false
      });
      assert.deepEqual(errors, [], 'Browser errors in navigation: ' + errors.join(' | '));
      console.log('UI Kit pages ' + width + 'px: navigation, layout and live typography sources OK');
    } catch (error) {
      failed = true;
      console.error('UI Kit pages ' + width + 'px FAILED:', error.stack || error);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (failed) process.exitCode = 1;
