import { expect, type Page } from '@playwright/test';

/** The floating Score control is only eligible once the full main score region has left the viewport. */
export async function scrollPastViewerScore(page: Page) {
  const score = page.locator('.g1-score-region');
  await score.evaluate(async (element) => {
    await document.fonts.ready;
    const bottom = element.getBoundingClientRect().bottom + window.scrollY;
    window.scrollTo({ top: Math.ceil(bottom) + 8, behavior: 'instant' });
  });
  await expect.poll(() => score.evaluate((element) => element.getBoundingClientRect().bottom))
    .toBeLessThanOrEqual(0);
}
