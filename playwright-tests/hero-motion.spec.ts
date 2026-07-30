import { expect, test } from '@playwright/test';

test('desktop game arc progresses the demonstration board from pregame to final', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const arcHeading = page.getByRole('heading', { name: /Scores come in.*Winners light up/i });
  const arc = page.locator('section').filter({ has: arcHeading });
  await expect(page.getByText('Board · pregame')).toBeVisible();
  await arc.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }));
  await expect(page.getByText('Board · final')).toBeVisible();
  await expect(page.getByText(/Square 4.*7 settled/i)).toBeVisible();
});

test('reduced motion renders the completed board without requiring scroll', async ({ browser }) => {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await page.goto('/');

  await expect(page.getByText('Board · final')).toBeVisible();
  await expect(page.getByText(/Square 4.*7 settled/i)).toBeVisible();
  await context.close();
});

test('narrow landing page stays within the viewport and exposes the real board', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  const heading = page.getByRole('heading', { name: /The board watches the game/i });
  await expect(heading).toBeVisible();
  const firstBand = page.locator('section').filter({ has: heading });
  await expect(firstBand.getByRole('table', { name: /Sample football squares board/i })).toBeVisible();
  const boardScroller = firstBand.getByRole('group', {
    name: /Squares board, scrolls horizontally on small screens/i,
  });
  expect(await boardScroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
});

test('tablet matrix keeps landing, demo, and sign-in surfaces inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });

  const surfaces = [
    { path: '/', landmark: page.getByRole('heading', { name: /The board watches the game/i }) },
    { path: '/demo', landmark: page.getByText(/Demo: Super Bowl LIX/i).first() },
    { path: '/login?mode=signin', landmark: page.getByRole('heading', { name: /Welcome back/i }) },
  ];

  for (const surface of surfaces) {
    await page.goto(surface.path);
    await expect(surface.landmark).toBeVisible();
    expect(await page.evaluate(() => {
      window.scrollTo({ left: document.documentElement.scrollWidth, top: window.scrollY, behavior: 'auto' });
      return window.scrollX;
    })).toBe(0);
  }
});

test('landing game arc reverses, releases its sticky board, and reaches post-hero content', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const arcHeading = page.getByRole('heading', { name: /Scores come in.*Winners light up/i });
  const arc = page.locator('section').filter({ has: arcHeading });
  const arcBoard = arc.getByRole('group', {
    name: /Squares board, scrolls horizontally on small screens/i,
  });
  const stickyBoard = arcBoard.locator('..');

  await expect(page.getByText('Board · pregame')).toBeVisible();
  await arc.evaluate((element) => {
    const section = element as HTMLElement;
    const top = section.offsetTop + Math.max(1, section.offsetHeight - window.innerHeight) * 0.8;
    window.__lenis?.scrollTo(top, { immediate: true });
  });
  await expect.poll(async () => (await stickyBoard.boundingBox())?.y ?? 0).toBeGreaterThanOrEqual(115);
  await expect.poll(async () => (await stickyBoard.boundingBox())?.y ?? 999).toBeLessThanOrEqual(125);

  await arc.evaluate((element) => {
    const section = element as HTMLElement;
    window.__lenis?.scrollTo(section.offsetTop + section.offsetHeight, { immediate: true });
  });
  await expect(page.getByText('Board · final')).toBeVisible();

  await arc.evaluate((element) => {
    window.__lenis?.scrollTo((element as HTMLElement).offsetTop, { immediate: true });
  });
  await expect(page.getByText('Board · pregame')).toBeVisible();

  const how = page.locator('#how');
  await how.evaluate((element) => {
    window.__lenis?.scrollTo((element as HTMLElement).offsetTop, { immediate: true });
  });
  await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Build your board.' })).toBeVisible();
  await expect.poll(async () => (await arcBoard.boundingBox())?.y ?? 0).toBeLessThan(0);
});

test('smooth scrolling is owned only by the cinematic landing route', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__lenis))).toBe(true);

  await page.getByRole('button', { name: /Sign in/i }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await expect.poll(() => page.evaluate(() => Boolean(window.__lenis))).toBe(false);

  await page.goBack();
  await expect.poll(() => page.evaluate(() => Boolean(window.__lenis))).toBe(true);
});
