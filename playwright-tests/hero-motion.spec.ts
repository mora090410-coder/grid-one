import { expect, test } from '@playwright/test';

test('desktop game arc progresses the demonstration board from pregame to final', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const arc = page.getByRole('heading', { name: /Automatic first/i }).locator('..');
  await expect(page.getByText('Board · pregame')).toBeVisible();
  await arc.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }));
  await expect(page.getByText('Board · final')).toBeVisible();
  await expect(page.getByText(/Square 4.*7 settled/i)).toBeVisible();
});

test('reduced motion renders the completed board without requiring scroll', async ({ browser }) => {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await page.goto('/');

  await expect(page.getByText('Board · final')).toBeVisible();
  await expect(page.getByText(/Square 4.*7 settled/i)).toBeVisible();
  await context.close();
});

test('narrow landing page stays within the viewport and exposes the real board', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  const heading = page.getByRole('heading', { name: /The board watches the game/i });
  await expect(heading).toBeVisible();
  const firstBand = page.locator('section').filter({ has: heading });
  await expect(firstBand.getByRole('table', { name: /Demonstration squares board/i })).toBeVisible();
  const boardScroller = firstBand.getByRole('group', {
    name: /Squares board, scrolls horizontally on small screens/i,
  });
  expect(await boardScroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
});
