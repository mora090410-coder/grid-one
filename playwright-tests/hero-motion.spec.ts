import { expect, test, type Page } from '@playwright/test';

const waitForHero = async (page: Page) => {
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate(() => document.fonts.ready);
};

const seekHero = async (page: Page, progress: number) => {
  await page.evaluate((value) => window.__heroScrollTo?.(value), progress);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
};

const heroState = (page: Page) => page.evaluate(() => {
  const style = (selector: string) => getComputedStyle(document.querySelector(selector) as Element);
  const paperArt = document.querySelector('[data-paper-crumple-group]') as SVGGElement;
  const displacement = document.querySelector('[data-crumple-displacement]') as SVGFEDisplacementMapElement;
  const stage = document.querySelector('[data-hero-stage]') as HTMLElement;
  const progressBar = document.querySelector('[data-hero-progress]') as HTMLElement;
  return {
    narration: document.querySelector('[data-hero-narr]')?.textContent,
    paperOpacity: Number(style('[data-hero-paper]').opacity),
    cleanOpacity: Number(style('[data-hero-clean]').opacity),
    cleanFilter: style('[data-hero-clean]').filter,
    winnerOpacity: Number(style('[data-hero-winner]').opacity),
    scoreOpacity: Number(style('[data-hero-live-score]').opacity),
    ballOpacity: Number(style('[data-paper-ball]').opacity),
    ballVisibility: style('[data-paper-ball]').visibility,
    paperFilter: getComputedStyle(paperArt).filter,
    filterAttribute: paperArt.getAttribute('filter'),
    displacement: Number(displacement.getAttribute('scale')),
    progress: progressBar.getBoundingClientRect().width / window.innerWidth,
    stageTop: stage.getBoundingClientRect().top,
    pinSpacers: document.querySelectorAll('.pin-spacer').length,
    nestedPinSpacers: document.querySelectorAll('.pin-spacer .pin-spacer').length,
  };
});

test('paper crumples, tosses, and reveals the winner across the pinned desktop timeline', async ({ page }, testInfo) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.addStyleTag({ content: '.ne-halo{animation:none!important}' });
  await waitForHero(page);

  await seekHero(page, 0.2);
  let state = await heroState(page);
  expect(state.narration).toBe('01 — The old paper way');
  expect(state.paperOpacity).toBeGreaterThan(0.99);
  expect(state.cleanOpacity).toBeLessThan(0.01);
  expect(state.filterAttribute).toBe('none');
  expect(state.progress).toBeCloseTo(0.2, 2);
  expect(Math.abs(state.stageTop)).toBeLessThan(2);

  await seekHero(page, 0.55);
  state = await heroState(page);
  expect(state.narration).toBe('02 — Crumple the paper');
  expect(state.filterAttribute).toBe('url(#crumple)');
  expect(state.paperFilter).toContain('#crumple');
  expect(state.displacement).toBeGreaterThan(3);
  expect(state.displacement).toBeLessThan(7);
  await seekHero(page, 0.66);
  await page.locator('[data-hero-stage]').screenshot({ path: testInfo.outputPath('hero-crumple.png') });

  await seekHero(page, 0.69);
  state = await heroState(page);
  expect(state.displacement).toBeGreaterThan(28);

  await seekHero(page, 0.8);
  state = await heroState(page);
  expect(state.narration).toBe('02 — Crumple the paper');
  expect(state.filterAttribute).toBe('none');
  expect(state.cleanOpacity).toBeGreaterThan(0.4);
  expect(state.cleanFilter).not.toContain('6px');

  await seekHero(page, 0.89);
  state = await heroState(page);
  expect(state.ballOpacity).toBeGreaterThan(0);
  await page.locator('[data-hero-stage]').screenshot({ path: testInfo.outputPath('hero-toss-impact.png') });

  await seekHero(page, 0.95);
  state = await heroState(page);
  expect(state.narration).toBe('03 — We have a winner');
  expect(state.cleanOpacity).toBeGreaterThan(0.99);
  expect(state.cleanFilter).toBe('blur(0px)');
  expect(state.winnerOpacity).toBeGreaterThan(0.99);
  expect(state.scoreOpacity).toBeGreaterThan(0.99);
  expect(state.ballOpacity).toBeLessThan(0.01);
  expect(state.progress).toBeCloseTo(0.95, 2);
  await page.locator('[data-hero-stage]').screenshot({ path: testInfo.outputPath('hero-winner.png') });

  await seekHero(page, 0.55);
  state = await heroState(page);
  expect(state.narration).toBe('02 — Crumple the paper');
  expect(state.filterAttribute).toBe('url(#crumple)');
  await seekHero(page, 0.2);
  state = await heroState(page);
  expect(state.narration).toBe('01 — The old paper way');
  expect(state.filterAttribute).toBe('none');
  expect(state.paperOpacity).toBeGreaterThan(0.99);
  expect(state.cleanOpacity).toBeLessThan(0.01);
  expect(state.pinSpacers).toBe(1);
  expect(runtimeErrors).toEqual([]);
});

test('reduced motion renders the completed clean board without smooth scroll or pinning', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto('/');
  await waitForHero(page);

  const state = await heroState(page);
  expect(state.narration).toBe('03 — We have a winner');
  expect(state.paperOpacity).toBeLessThan(0.01);
  expect(state.cleanOpacity).toBeGreaterThan(0.99);
  expect(state.winnerOpacity).toBeGreaterThan(0.99);
  expect(state.scoreOpacity).toBeGreaterThan(0.99);
  expect(state.pinSpacers).toBe(0);
  expect(await page.evaluate(() => ({
    lenisPresent: Boolean(window.lenis),
    legacyPresent: Boolean(window.__lenis),
    seekPresent: Boolean(window.__heroScrollTo),
  }))).toEqual({
    lenisPresent: false,
    legacyPresent: false,
    seekPresent: false,
  });
  await context.close();
});

test('narrow fallback avoids displacement, overflow, and duplicate pin lifecycles', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await waitForHero(page);

  await seekHero(page, 0.55);
  let state = await heroState(page);
  expect(state.narration).toBe('02 — Crumple the paper');
  expect(state.filterAttribute).toBe('none');
  expect(state.displacement).toBe(0);
  expect(state.ballOpacity).toBe(0);
  expect(state.ballVisibility).toBe('hidden');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const headingLines = await page.getByRole('heading', { name: /keep score/i }).evaluate((heading) => {
    const lineHeight = Number.parseFloat(getComputedStyle(heading).lineHeight);
    return heading.getBoundingClientRect().height / lineHeight;
  });
  expect(headingLines).toBeLessThanOrEqual(2.1);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(100);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(100);
  state = await heroState(page);
  expect(state.pinSpacers).toBe(1);
  expect(state.nestedPinSpacers).toBe(0);

  await seekHero(page, 1);
  await page.evaluate(() => {
    const next = window.scrollY + 100;
    if (window.__lenis) window.__lenis.scrollTo(next, { immediate: true });
    else window.scrollTo({ top: next, behavior: 'auto' });
  });
  await page.waitForTimeout(50);
  expect((await heroState(page)).stageTop).toBeLessThan(-20);
});
