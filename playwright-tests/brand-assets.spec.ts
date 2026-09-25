import { expect, test } from '@playwright/test';

// Corner Square rebrand: every icon and share image the head names is served.
test('the head names brand icons and a share image that all load', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page.locator('head link[rel="icon"], head link[rel="apple-touch-icon"]').evaluateAll(
    links => links.map(link => link.getAttribute('href')),
  );
  expect(hrefs).toEqual(['/favicon.ico', '/favicon.svg', '/favicon-32.png', '/favicon-16.png', '/apple-touch-icon.png']);
  await expect(page.locator('head meta[name="theme-color"]')).toHaveAttribute('content', '#13212E');

  for (const path of [...hrefs, '/icon-192.png', '/icon-512.png', '/og-image.png', '/site.webmanifest']) {
    const response = await request.get(path!);
    expect(response.status(), path!).toBe(200);
    expect(response.headers()['content-type'], path!).not.toContain('text/html');
  }
});

// Corner Square rebrand: Archivo type and brand ink/chalk text.
test('pages paint in Archivo with brand text colors and tight headings', async ({ page }) => {
  await page.goto('/');
  const body = await page.evaluate(() => {
    const style = getComputedStyle(document.body);
    return { font: style.fontFamily, color: style.color };
  });
  expect(body.font).toMatch(/^"?Archivo"?,/);
  expect(body.color).toBe('rgb(246, 247, 245)');

  const heading = page.getByRole('heading', { level: 1 }).first();
  await expect(heading).toHaveCSS('font-family', /^"?Archivo"?,/);
  await expect(heading).toHaveCSS('color', 'rgb(238, 241, 238)');
  expect(await heading.evaluate(el => parseFloat(getComputedStyle(el).letterSpacing) / parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(-0.03, 2);
  await expect.poll(() => page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('700 16px Archivo');
  })).toBe(true);

  // The light (organizer) base: ink text on chalk.
  await page.goto('/create');
  const ground = page.locator('[data-base="cream"]').first();
  await expect(ground).toHaveCSS('color', 'rgb(19, 33, 46)');
  await expect(ground).toHaveCSS('background-color', 'rgb(246, 247, 245)');
});
