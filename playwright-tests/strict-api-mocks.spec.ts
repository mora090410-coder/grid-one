import { expect, test } from '@playwright/test';
import { guardUnmockedApi } from './helpers/strictApiMocks';

test('unmocked API calls and explicit fallbacks are caught without leaking query values', async ({ page, baseURL }) => {
  const unexpected = await guardUnmockedApi(page, baseURL!);
  await page.route('**/guard-fixture', route => route.fulfill({ contentType: 'text/html', body: '<title>API guard fixture</title>' }));
  await page.goto('/guard-fixture');
  await page.route('**/api/fallback', route => route.fallback());
  const statuses = await page.evaluate(async () => {
    const first = await fetch('/api/unmocked?token=must-not-be-logged', { method: 'POST', body: 'private body' });
    const second = await fetch('/api/fallback');
    return [first.status, second.status];
  });
  expect(statuses).toEqual([503, 503]);
  expect(unexpected).toEqual(['POST /api/unmocked', 'GET /api/fallback']);
});

test('explicit failure mocks remain valid and non-API document loads are unaffected', async ({ page, baseURL }) => {
  const unexpected = await guardUnmockedApi(page, baseURL!);
  await page.route('**/guard-fixture', route => route.fulfill({ contentType: 'text/html', body: '<title>API guard fixture</title>' }));
  await page.route('**/api/intentional-error', route => route.fulfill({ status: 409, json: { code: 'REVISION_CONFLICT' } }));
  await page.goto('/guard-fixture');
  await expect(page).toHaveTitle('API guard fixture');
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/intentional-error');
    return { status: response.status, body: await response.json() };
  });
  expect(result).toEqual({ status: 409, body: { code: 'REVISION_CONFLICT' } });
  expect(unexpected).toEqual([]);
});
