import { expect, test } from '@playwright/test';

// The hero reassurance must not depend on a third-party font arriving in time.
for (const width of [1024, 1280, 1440]) {
  test(`desktop trust copy stays in the first viewport without web fonts at ${width}px`, async ({ page }, info) => {
    await page.route('**/*', route => {
      const { hostname } = new URL(route.request().url());
      return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort();
    });
    await page.setViewportSize({ width, height: 720 });
    await page.goto('/');
    const hero = page.getByTestId('homepage-first-viewport');
    await expect(hero).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const required = [
      hero.getByRole('heading', { level: 1 }),
      hero.getByRole('link', { name: 'Create your free board' }),
      hero.getByRole('link', { name: 'Try the demo' }),
      hero.getByText('First published board free each season'),
      hero.getByText('No account needed to view'),
      hero.getByText('For watch parties, office pools, friends, and fundraisers.'),
    ];
    const boxes = await Promise.all(required.map(async locator => ({ text: await locator.innerText(), box: await locator.boundingBox() })));
    await info.attach('first-viewport-geometry', { body: JSON.stringify(boxes, null, 2), contentType: 'application/json' });
    await info.attach('first-viewport', { body: await page.screenshot(), contentType: 'image/png' });
    for (const { text, box } of boxes) {
      expect(box, text).not.toBeNull();
      expect(box!.y, text).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height, text).toBeLessThanOrEqual(720);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
}
