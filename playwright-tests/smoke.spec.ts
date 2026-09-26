import { test, expect, type Locator } from '@playwright/test';

const expectTouchTarget = async (locator: Locator) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
};

test('landing page leads with the live board and free-first publishing model', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Football squares. Made easy.');
  await expect(page.getByText(/Create your board, share one link/i)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create your free board' }).first()).toBeVisible();
  await expect(page.getByText('First published board free')).toBeAttached();
});

test('demo board renders the sample game', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByText(/Sunday Football Board/i).first()).toBeVisible();
  await expect(page.getByText('Score updates about every three minutes')).toBeVisible();
  await expect(page.getByRole('button', { name: /Find my squares/i })).toBeVisible();
});

test('representative landing controls expose names, touch geometry, and keyboard focus', async ({ page }) => {
  await page.goto('/');

  const build = page.getByRole('link', { name: 'Create your free board' }).first();
  const demo = page.getByRole('link', { name: 'Try the demo' }).first();

  await expect(build).toHaveAccessibleName('Create your free board');
  await expect(demo).toHaveAccessibleName('Try the demo');
  await expectTouchTarget(build);
  await expectTouchTarget(demo);

  const signIn = page.getByRole('link', { name: 'Sign in' }).first();
  await signIn.focus();
  await expect(signIn).toBeFocused();
  await expect.poll(() => signIn.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
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
  await expect(player).toBeFocused();
  await expect(close).toHaveAccessibleName('Close');
  await expect(player).toHaveAccessibleName('Name used on board');
  await expectTouchTarget(close);
  await expectTouchTarget(player);

  const lastBrowseName = dialog.getByTestId('browse-name-list').getByRole('button').last();
  await lastBrowseName.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('create route offers an unsaved preview before authentication', async ({ page }) => {
  await page.goto('/create');
  await expect(page).toHaveURL(/\/create/);
  await expect(page.getByRole('region', {name:'Board preview'})).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save and continue' })).toBeVisible();
});
