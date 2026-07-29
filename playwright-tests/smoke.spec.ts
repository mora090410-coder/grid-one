import { test, expect } from '@playwright/test';

test('landing page leads with the live board and paid unlock model', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /The board watches the game/i })).toBeVisible();
  await expect(page.getByText(/Football squares for booster clubs, teams, and church halls/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Build your board/i })).toBeVisible();
  await expect(page.getByText(/\$4\.99 unlocks up to 20 boards in 2026/i).first()).toBeVisible();
});

test('demo board renders the sample game', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByText(/Demo: Super Bowl LIX/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Find my squares/i })).toBeVisible();
});

test('create route redirects unauthenticated users into login flow', async ({ page }) => {
  await page.goto('/create');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /Create your organizer account|Welcome back/i })).toBeVisible();
});
