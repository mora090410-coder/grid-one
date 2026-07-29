import { expect, test } from '@playwright/test';

test('warm inputs retain rendered boundaries, focus, error semantics, and touch geometry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');

  const email = page.getByLabel('Email Address');
  const submit = page.getByRole('button', { name: 'Sign In', exact: true });

  await expect(email).toHaveCSS('min-height', '44px');
  await expect(email).toHaveCSS('border-top-width', '2px');
  await expect(email).toHaveCSS('border-top-style', 'solid');
  await expect(submit).toHaveCSS('min-height', '44px');

  const emailBox = await email.boundingBox();
  const submitBox = await submit.boundingBox();
  expect(emailBox?.height).toBeGreaterThanOrEqual(44);
  expect(submitBox?.height).toBeGreaterThanOrEqual(44);

  await email.focus();
  await expect(email).toBeFocused();
  await expect(email).toHaveCSS('border-top-color', 'rgb(143, 29, 44)');
  await expect.poll(() => email.evaluate((element) => getComputedStyle(element).boxShadow))
    .not.toBe('none');

  await page.getByRole('button', { name: /Don't have an account/i }).click();
  await page.getByLabel('Email Address').fill('organizer@example.test');
  await page.getByLabel('Password', { exact: true }).fill('abcdef');
  await page.getByLabel('Confirm Password').fill('uvwxyz');
  await page.getByRole('button', { name: 'Create Account' }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Passwords do not match');
  await expect(alert.locator('svg')).toHaveCount(1);
  await expect(page.getByLabel('Email Address')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Email Address')).toHaveAttribute('aria-describedby', 'auth-error');
});
