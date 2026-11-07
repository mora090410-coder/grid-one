import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { boardId, installOrganizerBoard, installOrganizerContests } from './helpers/organizerMocks';

test.use({ hasTouch: true });

for (const width of [390, 1280]) {
  test(`selected Board actions labels retain their light foreground at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await installOrganizerBoard(page);
    await page.goto(`/boards/${boardId}`);
    await page.getByRole('button', { name: 'Board actions', exact: true }).tap();
    const dialog = page.getByRole('dialog', { name: /Board actions$/ });
    await dialog.evaluate(node => Promise.all(node.getAnimations().map(a => a.finished)));
    for (const name of ['Payments', 'Share', 'Board']) {
      const card = dialog.getByRole('button', { name, exact: true });
      await card.tap();
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      const colors = await card.evaluate(node => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--g1-chalk)';
        node.append(probe);
        const expected = getComputedStyle(probe).color;
        probe.remove();
        return { actual: getComputedStyle(node.querySelector('strong')!).color, expected };
      });
      await dialog.evaluate(node => { node.scrollTop = 0; });
      await page.screenshot({ path: info.outputPath(`selected-${name}-${width}.png`), fullPage: true });
      expect(colors.actual).toBe(colors.expected);
    }
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });

  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test(`selected module details enter the visible sheet at ${width}px with ${reducedMotion} motion`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion });
      await installOrganizerBoard(page);
      await page.goto(`/boards/${boardId}`);
      await page.getByRole('button', { name: 'Board actions', exact: true }).tap();
      const dialog = page.getByRole('dialog', { name: /Board actions$/ });
      await dialog.evaluate(node => Promise.all(node.getAnimations().map(a => a.finished)));
      // Start with details below the task grid, as in the reported phone state.
      await dialog.evaluate(node => { node.scrollTop = 0; });
      await dialog.getByRole('button', { name: 'Payments', exact: true }).tap();
      const details = dialog.getByRole('region', { name: 'Payments details' });
      await expect(details).toBeFocused();
      await expect(details.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible();
      const bounds = await details.evaluate(node => ({
        top: node.getBoundingClientRect().top,
        headerBottom: node.closest('dialog')!.querySelector('header')!.getBoundingClientRect().bottom,
        bottom: node.getBoundingClientRect().bottom,
        sheetBottom: node.closest('dialog')!.getBoundingClientRect().bottom,
      }));
      expect(bounds.top).toBeGreaterThanOrEqual(bounds.headerBottom);
      expect(bounds.bottom).toBeLessThanOrEqual(bounds.sheetBottom + 1);
      await page.screenshot({ path: info.outputPath(`payments-details-${width}-${reducedMotion}.png`), fullPage: true });
      await details.getByRole('button', { name: 'Open payments', exact: true }).tap();
      await expect(page.getByRole('dialog', { name: 'Payments', exact: true })).toBeVisible();
      await page.getByRole('dialog', { name: 'Payments', exact: true }).getByRole('button', { name: 'Close', exact: true }).tap();
      await expect(page.getByRole('button', { name: 'Board actions', exact: true })).toBeFocused();
    });
  }

  test(`dashboard uses a readable wordmark on its dark ground at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await installOrganizerBoard(page);
    await installOrganizerContests(page);
    await page.goto('/dashboard');
    const logo = page.getByRole('img', { name: 'GridOne', exact: true });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', /gridone-lockup-horizontal-white/);
    expect(await logo.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    await page.screenshot({ path: info.outputPath(`dashboard-${width}.png`), fullPage: true });
  });
}
