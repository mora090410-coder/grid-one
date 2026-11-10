import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { boardId, installOrganizerBoard, installOrganizerContests } from './helpers/organizerMocks';

test.describe('responsive touch notch', () => {
  test.use({ hasTouch: true });
  for (const width of [320, 390, 640]) for (const scale of [100, 200]) for (const dashboard of [false, true]) {
    test(`${dashboard ? 'dashboard' : 'board'} at ${width}px and ${scale}% text retains touch, focus and containment`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await installOrganizerBoard(page);
      if (dashboard) await installOrganizerContests(page);
      await page.goto(dashboard ? '/dashboard' : `/boards/${boardId}`);
      await page.evaluate(value => { document.documentElement.style.fontSize = `${value}%`; }, scale);
      const name = dashboard ? 'Menu' : 'Board actions';
      const trigger = page.getByRole('button', { name, exact: true });
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      const before = await trigger.boundingBox();
      expect(before!.height).toBeGreaterThanOrEqual(44);
      expect(before!.width).toBeGreaterThanOrEqual(44);
      const layout = await page.evaluate(() => ({
        fits: document.documentElement.scrollWidth <= innerWidth,
        overflow: [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }).slice(0, 12).map(el => ({ tag: el.tagName, class: el.className, text: el.textContent?.slice(0, 60) })),
      }));
      expect(layout.fits, JSON.stringify(layout.overflow)).toBe(true);
      await page.screenshot({ path: info.outputPath(`notch-closed-${width}-${scale}.png`) });
      await trigger.tap();
      const dialog = page.getByRole('dialog', { name: dashboard ? 'Your boards · Menu' : /Board actions$/ });
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      if (scale === 200) {
        const heading = await dialog.getByRole('heading', { level: 2 }).boundingBox();
        expect(heading!.width).toBeGreaterThanOrEqual(Math.min(240, box!.width - 50));
      }
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      if (width < 640) expect(Math.abs(box!.y + box!.height - 900)).toBeLessThan(2);
      else { expect(box!.width).toBeLessThanOrEqual(480); expect(box!.y).toBeGreaterThanOrEqual(before!.y + before!.height); }
      if (width === 320 || scale === 200) await expect(dialog.locator('.g1-island-tiles')).toHaveCSS('grid-template-columns', /^\d+(?:\.\d+)?px$/);
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press(i < 4 ? 'Tab' : 'Shift+Tab');
        expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
      }
      expect(await dialog.evaluate(node => node.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBe(0);
      await page.screenshot({ path: info.outputPath(`notch-open-${width}-${scale}.png`) });
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
      await dialog.getByRole('button', { name: 'Close', exact: true }).tap();
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    });
  }
});

test('dashboard reuses the notch for real account and creation actions', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installOrganizerBoard(page);
  await installOrganizerContests(page);
  await page.goto('/dashboard');
  const trigger = page.getByRole('button', { name: 'Menu', exact: true });
  await expect(trigger).toHaveCount(1);
  await trigger.click();
  const menu = page.getByRole('dialog', { name: 'Your boards · Menu', exact: true });
  await expect(menu).toHaveClass(/g1-task-dialog--notch/);
  await expect(menu.getByRole('button', { name: 'Log out', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'GridOne home', exact: true })).toBeVisible();
  await menu.evaluate(node => Promise.all(node.getAnimations().map(a => a.finished)));
  await page.screenshot({ path: info.outputPath('dashboard-notch-1280.png') });
  await menu.getByRole('button', { name: 'New board', exact: true }).click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('one shared highlight follows hover and keyboard focus without activating a task', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installOrganizerBoard(page);
  await page.goto(`/boards/${boardId}`);
  await page.getByRole('button', { name: 'Board actions', exact: true }).click();
  const panel = page.getByRole('dialog', { name: /Board actions$/ });
  const share = panel.getByRole('button', { name: 'Share', exact: true });
  const board = panel.getByRole('button', { name: 'Board', exact: true });
  const highlight = panel.locator('.g1-menu-highlight');
  await share.hover();
  await expect(highlight).toHaveCount(1);
  await expect(highlight).toHaveAttribute('data-visible', 'true');
  await expect(share).toHaveAttribute('data-menu-active', 'true');
  await expect(share).toHaveAttribute('aria-pressed', 'false');
  await expect(board).toHaveAttribute('aria-pressed', 'true');
  await board.focus();
  await expect(board).toHaveAttribute('data-menu-active', 'true');
  await expect(share).not.toHaveAttribute('data-menu-active', 'true');
  await highlight.evaluate(node => Promise.all(node.getAnimations().map(a => a.finished)));
  const a = await highlight.boundingBox();
  const b = await board.boundingBox();
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(1);
  expect(Math.abs(a!.height - b!.height)).toBeLessThan(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await share.focus();
  await expect(share.locator('strong')).toHaveCSS('transform', 'none');
  expect(await highlight.evaluate(node => node.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
  await expect(panel.locator('.g1-win-focus')).toHaveCount(0);
});

test('desktop Board actions is one named notch with a downward compact panel', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installOrganizerBoard(page);
  await page.goto(`/boards/${boardId}`);
  const trigger = page.getByRole('button', { name: 'Board actions', exact: true });
  await expect(trigger).toHaveCount(1);
  await expect(trigger).toContainText('Parkside browser board');
  await trigger.hover();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  const closed = await trigger.boundingBox();
  expect(Math.abs(closed!.x + closed!.width / 2 - 640)).toBeLessThan(50);
  await trigger.click();
  const panel = page.getByRole('dialog', { name: /Board actions$/ });
  await panel.evaluate(node => Promise.all(node.getAnimations().map(a => a.finished)));
  const bounds = await panel.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(480);
  expect(bounds!.y).toBeGreaterThanOrEqual(closed!.y + closed!.height);
  await expect(panel.locator('.g1-island-tiles')).toHaveCSS('grid-template-columns', /^\d+(?:\.\d+)?px$/);
  await page.screenshot({ path: info.outputPath('board-notch-1280.png') });
  await page.keyboard.press('Escape');
  await expect(panel).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(panel).toBeVisible();
  await page.mouse.click(4, 4);
  await expect(panel).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
