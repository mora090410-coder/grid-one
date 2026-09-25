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
