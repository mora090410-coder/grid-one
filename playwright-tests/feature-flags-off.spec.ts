import { expect, test } from '@playwright/test';

const routes = [
  { path: '/', legacyText: /The board watches\s*the game/i },
  { path: '/demo', legacyText: 'Demo: Super Bowl LIX' },
  { path: '/b/smoke-share-code', legacyText: /Board not found|Unable to load board|This board is not available|Sign in/i },
  { path: '/boards/smoke-board-id', legacyText: /Create your organizer account|Welcome back|Sign in/i },
  { path: '/create', legacyText: /Create your organizer account|Welcome back|Sign in/i },
  { path: '/dashboard', legacyText: /Create your organizer account|Welcome back|Sign in/i },
];

test.describe('feature flags off route smoke', () => {
  for (const route of routes) {
    test(`${route.path} remains legacy with all v2 flags off`, async ({ page }) => {
      if (route.path.startsWith('/b/')) {
        await page.route('**/api/pools/smoke-share-code', (request) => request.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Board not found' }),
        }));
      }
      await page.goto(`${route.path}?viewer_v2=false&organizer_v2=false&homepage_v2=false`);

      await expect(page.getByText(route.legacyText).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('[data-feature-flag="viewer_v2"]')).toHaveCount(0);
      await expect(page.locator('[data-feature-flag="organizer_v2"]')).toHaveCount(0);
      await expect(page.locator('[data-feature-flag="homepage_v2"]')).toHaveCount(0);
      await expect(page.locator('[data-variant*="_v2:on"]')).toHaveCount(0);
    });
  }

  test('query parameters do not enable legacy production mutation routes', async ({ page }) => {
    await page.goto('/create?viewer_v2=true&organizer_v2=true&homepage_v2=true');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /Create your organizer account|Welcome back/i })).toBeVisible();
    await expect(page.locator('[data-feature-flag="organizer_v2"]')).toHaveCount(0);
    await expect(page.locator('[data-variant*="_v2:on"]')).toHaveCount(0);
  });
});
