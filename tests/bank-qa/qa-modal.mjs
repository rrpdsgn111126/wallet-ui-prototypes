import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

async function pickPort() {
  return new Promise((resolve, reject) => {
    const socket = createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

const port = await pickPort();
const base = 'http://127.0.0.1:' + port;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  cwd: process.cwd(), stdio: 'ignore'
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + '/transfi-remittance/')).ok) { ready = true; break; }
    } catch {}
    await delay(200);
  }
  assert(ready, 'Local prototype server did not start');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const width of [390, 430, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    await page.goto(base + '/transfi-remittance/?qa=1', { waitUntil: 'domcontentloaded' });
    const toggle = page.locator('#tf-qa-toggle');
    const panel = page.locator('#tf-qa-panel');
    await toggle.waitFor({ state: 'visible', timeout: 20000 });
    assert(await panel.isHidden(), 'QA must start collapsed');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    const toggleRect = await toggle.boundingBox();
    const phoneRect = await page.locator('body > .phone').boundingBox();
    assert(toggleRect && phoneRect, 'QA button and phone must exist');
    if (width < 768) {
      assert(toggleRect.y >= phoneRect.y + phoneRect.height - 2,
        'Mobile QA button must sit BELOW the phone');
      assert(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight),
        'Mobile QA button must be reachable by scrolling');
      await toggle.scrollIntoViewIfNeeded();
    } else {
      assert(toggleRect.x + toggleRect.width >= width - 20 && toggleRect.y <= 20,
        'Desktop QA toggle must be pinned to the top right of the viewport');
    }
    await toggle.click();
    await panel.waitFor({ state: 'visible' });
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await page.locator('#tfqa-tab-events').click();
    await page.locator('#pv-group-sepa > summary').waitFor({ state: 'visible' });
    await page.locator('#tfqa-tab-scenarios').click();
    if (width < 768) {
      await page.locator('#tf-qa-backdrop').waitFor({ state: 'visible' });
      assert.equal(await panel.getAttribute('aria-modal'), 'true');
    } else {
      assert(await page.locator('#tf-qa-backdrop').isHidden());
      assert.equal(await panel.getAttribute('aria-modal'), 'false');
    }
    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'hidden' });
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await toggle.click();
    await panel.waitFor({ state: 'visible' });
    if (width < 768) {
      await page.locator('#tf-qa-backdrop').click({ position: { x: 4, y: 4 } });
    } else {
      await page.locator('#tfqa-close').click();
    }
    await panel.waitFor({ state: 'hidden' });
    assert.deepEqual(errors, [], 'JavaScript errors at ' + width + 'px');
    console.log('PASS QA toggle, modal and tabs: ' + width + 'px');
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
