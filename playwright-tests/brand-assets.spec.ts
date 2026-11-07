import { expect, test } from '@playwright/test';

// Corner Square rebrand: every icon and share image the head names is served.
test('the head names brand icons and a share image that all load', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page.locator('head link[rel="icon"], head link[rel="apple-touch-icon"]').evaluateAll(
    links => links.map(link => link.getAttribute('href')),
  );
  expect(hrefs).toEqual(['/favicon.ico', '/favicon.svg', '/favicon-32.png', '/favicon-16.png', '/apple-touch-icon.png']);
  await expect(page.locator('head meta[name="theme-color"]')).toHaveAttribute('content', '#101B2A');

  for (const path of [...hrefs, '/icon-192.png', '/icon-512.png', '/og-image.png', '/site.webmanifest']) {
    const response = await request.get(path!);
    expect(response.status(), path!).toBe(200);
    expect(response.headers()['content-type'], path!).not.toContain('text/html');
  }
});

// Corner Square rebrand: Archivo type and brand ink/chalk text.
test('landing and product surfaces use the adopted Inter glass theme', async ({ page }) => {
  await page.goto('/');
  const body = await page.evaluate(() => {
    const style = getComputedStyle(document.body);
    return { font: style.fontFamily, color: style.color };
  });
  expect(body.font).toMatch(/^"?Archivo"?,/);
  expect(body.color).toBe('rgb(240, 237, 229)');

  const heading = page.getByRole('heading', { level: 1 }).first();
  await expect(heading).toHaveCSS('font-family', /^"?Inter"?,/);
  await expect(heading).toHaveCSS('color', 'rgb(233, 236, 242)');
  await expect.poll(() => heading.evaluate(el => parseFloat(getComputedStyle(el).letterSpacing) / parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(-0.045, 3);
  await expect.poll(() => page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('400 16px Inter');
  })).toBe(true);

  // The adopted acquisition/create scope: editorial ink on warm paper.
  await page.goto('/create');
  const ground = page.locator('[data-g1-theme="liquid"]').first();
  await expect(ground).toHaveCSS('font-family', /^Inter,/);
  await expect(ground).toHaveCSS('color', 'rgb(233, 236, 242)');
  await expect(ground).toHaveCSS('background-color', 'rgb(7, 11, 20)');
});
