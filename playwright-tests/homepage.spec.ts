import { expect, test, type Locator } from '@playwright/test';

const firstViewport = async (page: import('@playwright/test').Page, height: number) => {
  const hero = page.getByTestId('homepage-first-viewport');
  await expect(hero).toBeVisible();
  const required: Array<[string, Locator]> = [
    ['heading', hero.getByRole('heading', { level: 1 })],
    ['create', hero.getByRole('link', { name: 'Create your free board' })],
    ['demo', hero.getByRole('link', { name: 'Explore a sample board' })],
    ['free', hero.getByText('First published board free')],
    ['boundary', hero.getByText(/does not collect square money, hold funds, settle payments, or pay winners/i)],
  ];
  for (const [label, locator] of required) {
    const box = await locator.boundingBox();
    expect(box?.y, label).toBeGreaterThanOrEqual(0);
    expect((box?.y || 0) + (box?.height || 0), label).toBeLessThanOrEqual(height);
  }
};

const overflow = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/**
 * Walk the page to the bottom in viewport-sized steps, giving the scroll-driven
 * explanation two animation frames to observe each stop. Two
 * frames rather than a fixed sleep, so the walk is as fast as the browser and
 * never papers over a slow condition with a guessed delay.
 */
const scrollThroughPage = async (page: import('@playwright/test').Page) => {
  const settleFrames = () => page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const height = await page.evaluate(() => document.body.scrollHeight);
  const step = await page.evaluate(() => window.innerHeight);
  for (let offset = 0; offset < height; offset += step) {
    await page.evaluate((y) => window.scrollTo(0, y), offset);
    await settleFrames();
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await settleFrames();
};

/** Computed opacity of the first match, read straight from the rendered style. */
const opacityOf = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).opacity);

/**
 * One heading per homepage section. Every one of these must be present and
 * fully opaque for a reduced-motion reader who never scrolls.
 */
const SECTION_HEADINGS: Array<[string, RegExp]> = [
  ['hero', /^Your fundraiser\.\s*One clear board\.$/],
  ['score', /^Scores update themselves\.$/],
  ['organizer', /^Less paper\. Less chasing\.$/],
  ['pricing', /^Free to start\. Ready for your next board\.$/],
  ['close', /^Ready to build the board\?$/],
];

test('phone first viewport holds identity, actions, and the money boundary', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await firstViewport(page, 844);
  expect(await overflow(page)).toBe(0);
});

test('desktop first viewport holds the same and the demo card', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await firstViewport(page, 720);
  await expect(page.getByRole('region', { name: 'Prepare your board', exact: true })).toBeVisible();
  expect(await overflow(page)).toBe(0);
});

test('page has no horizontal overflow after full scroll on phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  // Wait for the lazy homepage chunk before measuring: the Suspense fallback is
  // a fraction of the real page's height, so scrolling it proves nothing.
  await expect(page.getByTestId('homepage-first-viewport')).toBeVisible();
  await scrollThroughPage(page);
  expect(await overflow(page)).toBe(0);

});

test('page has no horizontal overflow after full scroll on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  // The lazy homepage chunk, not the Suspense fallback — the fallback has its
  // own h1 and its own (much shorter) scroll height.
  await expect(page.getByTestId('homepage-first-viewport')).toBeVisible();
  await scrollThroughPage(page);
  expect(await overflow(page)).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await overflow(page)).toBe(0);
});

test('reduced motion shows every section finished, without scrolling', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto('/');

  // No scrolling anywhere in this test. A reduced-motion reader must never be
  // handed a page whose content is waiting on an intersection that only a
  // scroll would produce.
  for (const [section, name] of SECTION_HEADINGS) {
    const heading = page.getByRole('heading', { name }).first();
    await expect(heading, section).toBeVisible();
    // toBeVisible() passes on an opacity-0 element, so read the opacity too:
    // that is the exact way a reveal would strand this content.
    expect(await opacityOf(heading), section).toBe('1');
  }

  expect(await page.locator('[data-reveal="pending"]').count(), 'pending reveals').toBe(0);
  // The contract is stronger than "not pending": under reduced motion Reveal
  // carries no data-reveal attribute at all, so it has no transition either.
  expect(await page.locator('[data-reveal]').count(), 'reveal attributes').toBe(0);

  await context.close();
});

test('demo handoff leads to a personal board preview', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Explore a sample board' }).first().click();
  await expect(page.getByText('Sample board — not a live game', { exact: true })).toBeVisible();
  await expect(page.getByText('This is a sample board. Ready to run yours?')).toBeVisible();
  await page.getByRole('button', { name: 'Create your own board' }).click();
  await expect(page).toHaveURL(/\/create/);
  await expect(page.getByRole('region', {name:'Board preview'})).toBeVisible();
});

test('no-JS fallback keeps the promise, the actions, and the boundary', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your fundraiser. One clear board.');
  await expect(page.getByRole('link', { name: /Create your free board/i })).toBeVisible();
  await expect(page.getByText(/does not collect square money/i)).toBeVisible();
  await context.close();
});


test('static hero connects preparation and game day with one fictional board', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByTestId('homepage-first-viewport');
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText(/Your fundraiser\.\s*One clear board\./);
  for (const name of ['Prepare your board', 'Your group on game day']) {
    const region = hero.getByRole('region', { name, exact: true });
    await expect(region).toBeVisible();
    await expect(region.getByText('Lincoln Softball Booster Board', { exact: true })).toBeVisible();
    expect(await region.locator('a[href], button, input, select, textarea, [contenteditable="true"], [tabindex]:not([tabindex="-1"])').count(), `${name} is a static preview`).toBe(0);
  }
  const viewer = hero.getByRole('region', { name: 'Your group on game day', exact: true });
  await expect(viewer.getByText('Currently matching', { exact: true })).toBeVisible();
  await expect(viewer.getByText('Taylor M.', { exact: true })).toBeVisible();
});

test('phone hero puts game-day proof and its primary action in the first viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const hero = page.getByTestId('homepage-first-viewport');
  const viewer = hero.getByRole('region', { name: 'Your group on game day', exact: true });
  const preparation = hero.getByRole('region', { name: 'Prepare your board', exact: true });
  await expect(viewer).toBeVisible();
  await expect(preparation).toBeVisible();
  const preparationElement = await preparation.elementHandle();
  expect(await viewer.evaluate((element, nextRegion) => (
    nextRegion !== null && Boolean(element.compareDocumentPosition(nextRegion) & Node.DOCUMENT_POSITION_FOLLOWING)
  ), preparationElement), 'viewer precedes preparation in reading order').toBe(true);
  for (const locator of [
    hero.getByRole('link', { name: 'Create your free board' }),
    viewer.getByText('Currently matching', { exact: true }),
    viewer.getByText('Taylor M.', { exact: true }),
  ]) {
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  }
});

for (const rootFontPercent of [100, 200]) {
  test(`static hero reflows at 320px with ${rootFontPercent}% root font`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/');
    const hero = page.getByTestId('homepage-first-viewport');
    await expect(hero).toBeVisible();
    await page.addStyleTag({ content: `html { font-size: ${rootFontPercent}% !important; }` });
    for (const name of ['Your group on game day', 'Prepare your board']) {
      const region = hero.getByRole('region', { name, exact: true });
      await expect(region).toBeVisible();
      await region.scrollIntoViewIfNeeded();
      const box = await region.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(321);
      expect(await region.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    }
    expect(await overflow(page)).toBe(0);
  });
}


test('phone hero remains readable when web fonts are unavailable', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const hero = page.getByTestId('homepage-first-viewport');
  const result = hero.getByRole('region', { name: 'Your group on game day' }).getByText('Taylor M.', { exact: true });
  await expect(result).toBeVisible();
  const box = await result.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  expect(await overflow(page)).toBe(0);
});
