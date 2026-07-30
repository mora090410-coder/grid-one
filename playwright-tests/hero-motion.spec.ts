import { expect, test, type Page } from '@playwright/test';

const waitForFilm = async (page: Page) => {
  await expect(page.locator('.fl-loader')).toHaveClass(/fl-done/);
};

test('desktop film progresses from the paper board to the live GridOne finale', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await waitForFilm(page);

  await expect(page.getByText('EVERY SEASON STARTS THE SAME')).toBeAttached();
  const film = page.locator('.fl-film');
  await film.evaluate((element) => {
    const section = element as HTMLElement;
    window.__lenis?.scrollTo(
      section.offsetTop + (section.offsetHeight - window.innerHeight) * 0.93,
      { immediate: true },
    );
  });

  const finale = page.locator('.fl-finale');
  await expect.poll(() => finale.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.9);
  await expect(finale.getByRole('heading', { name: 'The board watches the game', exact: true })).toBeVisible();
  await expect(finale.getByRole('button', { name: 'Build your board — free' })).toBeVisible();
});

test('reduced motion renders the completed film state without scrolling', async ({ browser }) => {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await page.goto('/');
  await waitForFilm(page);

  await expect(page.locator('.fl-finale').getByRole('heading', {
    name: 'The board watches the game',
    exact: true,
  })).toBeVisible();
  expect(await page.evaluate(() => window.__lenis)).toBeUndefined();
  await context.close();
});

test('narrow film landing stays within the viewport and reaches pricing', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await waitForFilm(page);

  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  )).toBe(true);
  await page.locator('#pricing').scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'What it costs' })).toBeVisible();
  await expect(page.getByText('$9.99', { exact: true })).toBeVisible();
  await expect(page.getByText('$79', { exact: true })).toBeVisible();
});

test('tablet matrix keeps landing, demo, and sign-in surfaces inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });

  const surfaces = [
    { path: '/', landmark: page.getByRole('heading', { name: 'The board watches the game', exact: true }) },
    { path: '/demo', landmark: page.getByText(/Demo: Super Bowl LIX/i).first() },
    { path: '/login?mode=signin', landmark: page.getByRole('heading', { name: /Welcome back/i }) },
  ];

  for (const surface of surfaces) {
    await page.goto(surface.path);
    await expect(surface.landmark).toBeVisible();
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )).toBe(true);
  }
});

test('film releases into the product bands and can reverse to its opening', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await waitForFilm(page);

  const film = page.locator('.fl-film');
  await film.evaluate((element) => {
    const section = element as HTMLElement;
    window.__lenis?.scrollTo(section.offsetTop + section.offsetHeight, { immediate: true });
  });
  await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible();

  await film.evaluate((element) => {
    window.__lenis?.scrollTo((element as HTMLElement).offsetTop, { immediate: true });
  });
  await expect.poll(() => page.locator('.fl-readout-label').textContent()).toBe('THE BOARD');
});

test('smooth scrolling is owned only by the film landing route', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__lenis))).toBe(true);

  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect.poll(() => page.evaluate(() => Boolean(window.__lenis))).toBe(false);

  await page.goBack();
  await expect.poll(() => page.evaluate(() => Boolean(window.__lenis))).toBe(true);
});
