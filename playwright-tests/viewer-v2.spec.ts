import { expect, test } from '@playwright/test';

test.describe('viewer_v2 shell', () => {
  test('demo read-only query can show C1 viewer without enabling mutation routes', async ({ page }) => {
    await page.goto('/demo?viewer_v2=true');

    await expect(page.locator('[data-feature-flag="viewer_v2"]')).toHaveCount(1);
    await expect(page.getByTestId('viewer-first-viewport').getByRole('heading', { name: /Demo: Super Bowl LIX/i })).toBeVisible();
    await expect(page.getByTestId('viewer-first-viewport').getByRole('button', { name: /Find my squares/i })).toBeVisible();
    await expect(page.getByTestId('viewer-first-viewport')).not.toContainText(/Payouts|makes me win/i);

    await page.goto('/create?viewer_v2=true');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[data-feature-flag="viewer_v2"]')).toHaveCount(0);
  });
});
