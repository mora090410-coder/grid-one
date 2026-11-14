import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installOrganizerBoard, boardId } from './helpers/organizerMocks';

test('homepage carries the liquid material without simulated-live claims', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('.g1-homepage[data-g1-theme="liquid"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Your team/ })).toBeVisible();
  await expect(page.getByText(/Checked .* ET/)).toHaveCount(0);
  const film = page.getByRole('region', { name: 'Board film' });
  await expect(film.getByText('Sample game', { exact: true })).toBeVisible();
  await expect(film.getByRole('heading', { name: 'Board film', exact: true })).toHaveCount(0);
  await expect(film.getByRole('button', { name: 'Build', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(film.getByRole('button', { name: 'Build', exact: true })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(film.getByRole('button', { name: 'Game day', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const violations = (await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;
  expect(violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  await page.screenshot({ path: info.outputPath('quiet-homepage-desktop.png'), fullPage: true });
});

for (const width of [320, 390, 1280]) test(`Board actions modal reflows and contains focus at ${width}, including 200% text`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await installOrganizerBoard(page);
  await page.goto(`/boards/${boardId}`);
  const trigger = page.getByRole('button', { name: 'Board actions', exact: true });
  await expect(trigger).toBeVisible();
  for (const fontSize of ['100%', '200%']) {
    await page.evaluate(size => { document.documentElement.style.fontSize = size; }, fontSize);
    await expect(page.getByRole('button', { name: /^Next:/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: /Board actions$/ });
    await expect(dialog).toBeVisible();
    await dialog.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    expect(await dialog.evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true);
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(n => n.contains(document.activeElement))).toBe(true);
    const violations = (await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations;
    await info.attach(`axe-${fontSize}.json`, { body: JSON.stringify(violations, null, 2), contentType: 'application/json' });
    expect(violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
    await page.screenshot({ path: info.outputPath(`quiet-island-${width}-${fontSize.replace('%','')}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }
});

test('opening Payments from settings leaves no native dialog trapping the task', async ({ page }) => {
  await installOrganizerBoard(page); await page.goto(`/boards/${boardId}`);
  await page.getByRole('button', { name: 'Board actions', exact: true }).click();
  await page.getByRole('dialog', { name: /Board actions$/ }).getByRole('button', { name: 'Game & settings', exact: true }).click();
  await page.getByRole('dialog', { name: 'Game & settings', exact: true }).getByRole('button', { name: 'Payments', exact: true }).click();
  const payments = page.getByRole('dialog', { name: 'Payments', exact: true });
  await expect(payments).toBeVisible();
  await payments.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Board actions', exact: true })).toBeFocused();
});

test('demo uses liquid materials and identifies scores as simulated', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.locator('[data-base][data-g1-theme="liquid"]')).toBeVisible();
  await expect(page.getByText('Simulated score · not a live feed', { exact: true })).toBeVisible();
  await expect(page.getByText(/Checked .* ET|Checked [0-9]/)).toHaveCount(0);
});

test('quiet organizer puts the board first and retains payout drafts across task panels', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installOrganizerBoard(page);
  await page.goto(`/boards/${boardId}`);
  await expect(page.getByRole('main', { name: 'Parkside browser board workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payout rules', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Board actions', exact: true }).click();
  const actions = page.getByRole('dialog', { name: /Board actions$/ });
  await actions.getByRole('button', { name: 'Payout rules', exact: true }).click();
  const payouts = page.getByRole('dialog', { name: 'Payout rules', exact: true });
  await expect(payouts).toBeVisible();
  const firstInput = payouts.locator('input,textarea').first();
  await firstInput.fill('LOCAL TEST · preserve this draft');
  await payouts.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Board actions', exact: true }).click();
  await page.getByRole('dialog', { name: /Board actions$/ }).getByRole('button', { name: 'Payout rules', exact: true }).click();
  await expect(firstInput).toHaveValue('LOCAL TEST · preserve this draft');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Board actions', exact: true })).toBeFocused();
  await page.screenshot({ path: info.outputPath('quiet-organizer-desktop.png'), fullPage: true });
});
