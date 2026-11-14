import { expect, test, type Locator } from '@playwright/test';

for (const width of [1440, 320]) {
  test(`sample sheet preserves geometry and interrupts seeded axis motion at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    // The page may still be choosing between the 3D film and the static page; wait so geometry is final.
    await expect(page.locator('.cine')).toHaveAttribute('data-settled', 'true', { timeout: 15000 });
    const sample = page.getByRole('region', { name: 'Interactive sample board' });
    const sheet = sample.locator('.sample-board-sheet');
    await sample.scrollIntoViewIfNeeded();
    const originalTop = await sheet.evaluate(element => element.getBoundingClientRect().top + scrollY);
    const inspectorHeight = (await sample.getByRole('status').boundingBox())!.height;
    const firstLabel = await sample.getByRole('gridcell').first().getAttribute('aria-label');
    for (const stage of ['Share', 'Game day', 'Set up', 'Game day']) {
      await sample.getByRole('button', { name: stage, exact: true }).click();
      expect(await sheet.evaluate(element => element.getBoundingClientRect().top + scrollY)).toBeCloseTo(originalTop, 0);
      expect((await sample.getByRole('status').boundingBox())!.height).toBeCloseTo(inspectorHeight, 0);
      expect(await sample.locator('.sample-stage-copy').evaluate(element => getComputedStyle(element).opacity)).toBe('1');
      const digits = await sample.getByRole('columnheader').evaluateAll(nodes => nodes.map(node => node.querySelector('.g1-roll > .sr-only')?.textContent ?? node.textContent));
      expect(digits.slice(1)).toEqual(stage === 'Game day' ? ['4', '1', '8', '6', '2', '9', '0', '5', '7', '3'] : Array(10).fill('–'));
      if (stage !== 'Game day') {
        expect(await sample.locator('.sample-axis-digit').evaluateAll(elements => elements.flatMap(element => element.getAnimations()).length)).toBe(0);
        expect(await sample.getByRole('gridcell').first().getAttribute('aria-label')).toBe(firstLabel);
      }
    }
    // Repeated activation does not restart an already-entered stage.
    await sample.getByRole('button', { name: 'Game day', exact: true }).click();
    await sample.evaluate(async element => { await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))); });
    expect(await sample.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await sample.getByRole('button', { name: 'Set up', exact: true }).click();
    await sample.getByRole('button', { name: 'Game day', exact: true }).click();
    expect(await sample.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  });
}

const settleEntrance = (page: import('@playwright/test').Page) => page.evaluate(async () => {
  await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
});

const firstViewport = async (page: import('@playwright/test').Page, height: number) => {
  const hero = page.getByTestId('homepage-first-viewport');
  await expect(hero).toBeVisible();
  await settleEntrance(page);
  const required: Array<[string, Locator]> = [
    ['heading', hero.getByRole('heading', { level: 1 })],
    ['create', hero.getByRole('link', { name: 'Create your free board' })],
    ['demo', hero.getByRole('link', { name: 'Try the demo' })],
    ['free', hero.getByText('First published board free each season')],
    ['boundary', hero.getByText('For watch parties, office pools, friends, and fundraisers.')],
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
  ['hero', /^Your team\.\s*One board\.\s*Less chasing\.$/],
  ['organizer', /^Fill the board, not a spreadsheet\.$/],
  ['score', /^Everyone knows what to root for\.$/],
  ['fundraiser', /^Every seller gets a board\. One flat price\. Zero percent of your squares\.$/],
  ['pricing', /^Your first board is free\.$/],
  ['close', /^Ready to build the board\?$/],
];

test('conversion links retain visible focus under the editorial theme', async ({ page, browserName }) => {
  const forward = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  const backward = browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab';
  await page.goto('/');
  const hero = page.getByTestId('homepage-first-viewport');
  const create = hero.getByRole('link', { name: 'Create your free board' });
  const demo = hero.getByRole('link', { name: 'Try the demo' });
  await create.focus();
  await page.keyboard.press(forward);
  await expect(demo).toBeFocused();
  for (const link of [demo, create]) {
    if (link === create) await page.keyboard.press(backward);
    await expect(link).toBeFocused();
    const focus = await link.evaluate(element => {
      const style = getComputedStyle(element);
      return {
        visible: element.matches(':focus-visible'),
        outline: style.outlineStyle,
        width: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(focus.visible).toBe(true);
    expect(focus.outline).toBe('solid');
    expect(focus.width).toBeGreaterThanOrEqual(3);
  }
});

test('sample controls keep contrasting inset focus rings', async ({ page, browserName }) => {
  // macOS Safari uses Option+Tab to include all controls in keyboard navigation.
  const forward = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  const backward = browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab';
  await page.goto('/');
  const sample = page.getByRole('region', { name: 'Interactive sample board' });
  const stage = sample.getByRole('button', { name: 'Set up', exact: true });
  const cell = sample.getByRole('gridcell').first();
  for (const [control, offset] of [[stage, '-4px'], [cell, '-3px']] as const) {
    await control.focus();
    await page.keyboard.press(forward);
    await page.keyboard.press(backward);
    await expect(control).toBeFocused();
    const ring = await control.evaluate(element => {
      const style = getComputedStyle(element);
      return { visible: element.matches(':focus-visible'), offset: style.outlineOffset, outline: style.outlineColor, foreground: style.color, style: style.outlineStyle };
    });
    expect(ring.visible).toBe(true);
    expect(ring.style).toBe('solid');
    expect(ring.offset).toBe(offset);
    expect(ring.outline).toBe(ring.foreground);
  }
});

test('phone first viewport holds identity, actions, and group examples', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await firstViewport(page, 844);
  expect(await overflow(page)).toBe(0);
});

test('desktop first viewport holds the same and the labelled sample board', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await firstViewport(page, 720);
  const caption = page.getByTestId('homepage-first-viewport').getByText('Sample board — not a live game', { exact: true });
  await expect(caption).toBeVisible();
  const box = await caption.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(720);
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
  expect(await page.locator('[data-enter]').count(), 'entrance attributes').toBe(0);

  await context.close();
});

test('demo handoff leads to a personal board preview', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Try the demo' }).first().click();
  await expect(page).toHaveURL(/\/demo/);
  // The lazy demo route can keep the homepage on screen for a moment while it loads.
  await expect(page.getByTestId('homepage')).toHaveCount(0);
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
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your team. One board. Less chasing.');
  await expect(page.getByRole('link', { name: /Create your free board/i })).toBeVisible();
  await expect(page.getByText(/does not collect square money/i)).toBeVisible();
  await context.close();
});


test('interactive sample separates sharing capability and illustrative results', async ({ page }) => {
  await page.goto('/');
  const sample = page.getByRole('region', { name: 'Interactive sample board' });
  await expect(sample.getByRole('gridcell')).toHaveCount(100);
  await sample.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(sample.getByText(/Public viewer link: viewing only/)).toBeVisible();
  await expect(sample.getByRole('link', { name: 'Open sample viewer' })).toHaveAttribute('href', '/demo');
  await sample.getByRole('button', { name: 'Game day', exact: true }).click();
  await expect(sample.getByText(/Currently matching: Taylor M./)).toBeVisible();
  await expect(sample.getByText(/No confirmed quarter results/)).toBeVisible();
  const first = sample.getByRole('gridcell').first();
  await first.focus();
  await first.press('ArrowRight');
  await expect(sample.getByRole('gridcell').nth(1)).toBeFocused();
  await expect(sample.getByRole('status')).toContainText('Square 2');
});

test('phone first viewport prioritizes the organizer action before the sample', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await firstViewport(page, 844);
  const sample = page.getByRole('region', { name: 'Interactive sample board' });
  await expect(sample).toBeVisible();
  const sampleHandle = await sample.elementHandle();
  expect(await page.getByRole('heading', { level: 1 }).evaluate((heading, element) => element !== null && Boolean(heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING), sampleHandle)).toBe(true);
});

for (const rootFontPercent of [100, 200]) {
  test(`static hero reflows at 320px with ${rootFontPercent}% root font`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/');
    const hero = page.getByTestId('homepage-first-viewport');
    await expect(hero).toBeVisible();
    await page.addStyleTag({ content: `html { font-size: ${rootFontPercent}% !important; }` });
    for (const name of ['Interactive sample board']) {
      const region = page.getByRole('region', { name, exact: true });
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
  await page.route('**/fonts/*.woff2', route => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const hero = page.getByTestId('homepage-first-viewport');
  const action = hero.getByRole('link', { name: 'Create your free board' });
  await expect(action).toBeVisible();
  const box = await action.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  expect(await overflow(page)).toBe(0);
});
