import { test, expect, type Locator } from '@playwright/test';

const expectTouchTarget = async (locator: Locator) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
};

test('landing page leads with the live board and free-first publishing model', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The board watches the game', exact: true })).toBeVisible();
  await expect(page.getByText(/Football squares for booster clubs, offices, and game-day crews/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Build your board — free/i })).toBeVisible();
  await expect(page.getByText('Your first published board is free. Upgrade only when you need another.')).toBeAttached();
});

test('demo board renders the sample game', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByText(/Demo: Super Bowl LIX/i).first()).toBeVisible();
  await expect(page.getByText('Score updates about every minute')).toBeVisible();
  await expect(page.getByRole('button', { name: /Find my squares/i })).toBeVisible();
});

test('representative landing controls expose names, touch geometry, and keyboard focus', async ({ page }) => {
  await page.goto('/');

  const build = page.getByRole('button', { name: 'Build your board — free' });
  const demo = page.getByRole('link', { name: 'See a live board' });

  await expect(build).toHaveAccessibleName('Build your board — free');
  await expect(demo).toHaveAccessibleName('See a live board');
  await expectTouchTarget(build);
  await expectTouchTarget(demo);

  const signIn = page.getByRole('button', { name: 'Sign in' }).first();
  await signIn.focus();
  await expect(signIn).toBeFocused();
  await expect.poll(() => signIn.evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.outlineStyle} ${style.outlineWidth}`;
  })).toBe('solid 3px');
});

test('find-squares dialog traps focus, closes with Escape, and returns focus', async ({ page }) => {
  await page.goto('/demo');

  const trigger = page.getByRole('button', { name: /Find my squares/i });
  await expect(trigger).toHaveAccessibleName(/Find my squares/i);
  await expectTouchTarget(trigger);
  await trigger.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Find my squares' });
  const close = dialog.getByRole('button', { name: 'Close' });
  const player = dialog.getByLabel('Name used on board');
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();
  await expect(close).toHaveAccessibleName('Close');
  await expect(player).toHaveAccessibleName('Name used on board');
  await expectTouchTarget(close);
  await expectTouchTarget(player);

  await page.keyboard.press('Tab');
  await expect(player).toBeFocused();
  const lastBrowseName = dialog.getByTestId('browse-name-list').getByRole('button').last();
  await lastBrowseName.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('create route redirects unauthenticated users into login flow', async ({ page }) => {
  await page.goto('/create');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /Create your organizer account|Welcome back/i })).toBeVisible();
});
