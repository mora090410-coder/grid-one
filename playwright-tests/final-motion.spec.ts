import { test, expect } from '@playwright/test';
import { installOrganizerBoard, boardId } from './helpers/organizerMocks';

for (const width of [320, 1280]) test(`Island reverses its entrance before closing at ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await installOrganizerBoard(page); await page.goto(`/boards/${boardId}`);
  const trigger = page.getByRole('button', { name: 'Board actions', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: /Board actions$/ });
  await expect(dialog).toHaveAttribute('data-state', 'open');
  await dialog.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
  await page.screenshot({ path: info.outputPath(`final-island-${width}.png`) });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await page.locator('dialog[open][data-state="closing"]').count()).toBe(1);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('one winner light transfers on scroll without replaying the border sweep', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await page.goto('/demo');
  const card = page.locator('.g1-current-card');
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveClass(/g1-win-focus/);
  await expect(page.locator('.g1-win-focus')).toHaveCount(1);
  await expect(card).toHaveCSS('animation-duration', '4.5s');
  await page.screenshot({ path: info.outputPath('final-winning-card.png') });
  await page.locator('.g1-cell--live').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.g1-current-card')!.getBoundingClientRect().bottom + window.scrollY + 30));
  await expect(page.locator('.g1-cell--live')).toHaveClass(/g1-win-focus/);
  await expect(page.locator('.g1-win-focus')).toHaveCount(1);
  await expect(page.locator('.g1-cell--past.g1-win-focus')).toHaveCount(0);
});

test('reduced motion makes the Island appear and close immediately, with no effect animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installOrganizerBoard(page); await page.goto(`/boards/${boardId}`);
  await page.getByRole('button', { name: 'Board actions', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Board actions$/ });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBe(0);
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
  await page.goto('/demo');
  expect(await page.locator('.g1-win-focus').evaluateAll(nodes => nodes.flatMap(n => n.getAnimations({ subtree: true })).filter(a => a.playState === 'running').length)).toBe(0);
  await expect(page.locator('.g1-roll-strip').first()).toHaveCSS('transition-duration', '0s');
});

test('fifty primary presses leave no rings or dimples behind', async ({ page }) => {
  await page.goto('/demo');
  const primary = page.getByRole('button', { name: 'Find my squares', exact: true });
  for (let i = 0; i < 50; i++) {
    await primary.dispatchEvent('pointerdown', { clientX: 40, clientY: 40, pointerType: 'touch' });
    await primary.dispatchEvent('pointerup');
  }
  await expect(primary.locator('.g1-ring')).toHaveCount(3);
  await expect(primary.locator('.g1-dimple')).toHaveCount(1);
  await expect(primary.locator('.g1-ring,.g1-dimple')).toHaveCount(0, { timeout: 2000 });
});

test('buyer fill reverses on unpick and is immediate under reduced motion', async ({ page }) => {
  await page.route('**/api/sellers/0123456789abcdef', route => route.fulfill({ json: {
    title: 'Motion test board', label: 'Test seller', shareCode: 'ABCDEFGH', open: true,
    cells: [{ index: 0, available: true }],
  } }));
  await page.goto('/s/0123456789abcdef');
  await expect(page.locator('.g1-buyer-sheet')).toHaveCSS('position', 'sticky');
  const tile = page.getByRole('button', { name: 'Square 1, open' });
  await tile.click();
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  await expect(tile.locator('.g1-fill')).toHaveCSS('transition-duration', '0.7s');
  await tile.click();
  await expect(tile).toHaveAttribute('aria-pressed', 'false');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await tile.click();
  await expect(tile.locator('.g1-fill')).toHaveCSS('transition-duration', '0s');
  await expect(tile.locator('.g1-fill-label').first()).toHaveCSS('transition-duration', '0s');
  expect(await tile.evaluate(n => n.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBe(0);
});
