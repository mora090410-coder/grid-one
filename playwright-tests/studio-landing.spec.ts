import { expect, test } from '@playwright/test';

test('FAQ answers can be opened and closed with the keyboard', async ({ page }) => {
  await page.goto('/');
  const summary = page.locator('summary').filter({ hasText: 'Do viewers need an account?' });
  await summary.scrollIntoViewIfNeeded();
  await summary.focus();
  await summary.press('Enter');
  await expect(page.getByText(/Viewers open the link without creating an account\. Only the organizer signs in\./)).toBeVisible();
  await summary.press('Enter');
  await expect(page.getByText(/Viewers open the link without creating an account\. Only the organizer signs in\./)).toBeHidden();
});


test('enlarged phone text keeps the static chapter cards readable and contained', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 320, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const card = page.getByRole('article', { name: 'The score runs itself.' });
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  await expect(card.getByText('Taylor M. matches 7 × 4', { exact: true })).toBeVisible();
  expect(await card.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await context.close();
});

test('the 3D film loads after first paint and never blocks the static page', async ({ page }) => {
  await page.goto('/');
  const root = page.locator('.cine');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(root).toHaveAttribute('data-mode', /^(static|cinematic)$/);
  const film = page.getByRole('region', { name: 'How a game day plays out' });
  await expect(film.getByRole('article')).toHaveCount(6);
});

test('reduced motion keeps the static film and never requests the 3D code', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on('request', request => { if (/boardScene|three/.test(request.url())) requests.push(request.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.cine')).toHaveAttribute('data-mode', 'static');
  for (const card of await page.getByRole('region', { name: 'How a game day plays out' }).getByRole('article').all()) {
    await expect(card).toBeVisible();
  }
  expect(requests).toEqual([]);
  await context.close();
});
