// Isolated browser smoke test; does not access Supabase or production.
// Run with: npx playwright test inventory/tests/inventory-readonly-preview-browser.test.mjs
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
const root = process.cwd();
let server;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const path = decodeURIComponent((req.url || '/').split('?')[0]);
    const allowed = new Map([
      ['/inventory/inventory-readonly-preview-v1-DRAFT.html', 'inventory/inventory-readonly-preview-v1-DRAFT.html'],
      ['/inventory/inventory-readonly-provider-v1-DRAFT.js', 'inventory/inventory-readonly-provider-v1-DRAFT.js']
    ]);
    if (!allowed.has(path)) { res.writeHead(404); res.end('Not found'); return; }
    const file = resolve(root, allowed.get(path));
    res.setHeader('Content-Type', extname(file) === '.js' ? 'text/javascript' : 'text/html');
    res.setHeader('Cache-Control', 'no-store');
    res.end(readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
});
test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });
test('offline inventory preview loads, refreshes, and stays read-only', async ({ page }) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const address = server.address();
  await page.goto('http://127.0.0.1:' + address.port + '/inventory/inventory-readonly-preview-v1-DRAFT.html');
  await expect(page.getByRole('status')).toContainText('Offline sample loaded');
  await expect(page.locator('#items tr')).toHaveCount(2);
  await expect(page.locator('#recipes tr')).toHaveCount(1);
  await expect(page.locator('#movements tr')).toHaveCount(1);
  await expect(page.locator('#items')).toContainText('Coffee Beans');
  await expect(page.getByText('OFFLINE · ILLUSTRATIVE DATA')).toBeVisible();
  await page.getByRole('button', { name: 'Refresh inventory snapshot' }).click();
  await expect(page.getByRole('status')).toContainText('Offline sample loaded');
  expect(errors).toEqual([]);
  expect(requests.every(url => new URL(url).origin === 'http://127.0.0.1:' + address.port)).toBe(true);
  expect(requests.some(url => /supabase|\.co\/rest\/v1/i.test(url))).toBe(false);
});
