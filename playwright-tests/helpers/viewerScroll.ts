import { expect, type Page } from '@playwright/test';

/** Scroll like a viewer, not through a CSS/test override. The return control
 * may appear after the whole score panel leaves, but never over board digits. */
export async function scrollToUncoveredScoreNotch(page: Page) {
  const score = page.locator('.g1-score-region');
  const grid = page.getByRole('grid', { name: /football squares board/i });
  await expect(score).toBeVisible();
  await expect(grid).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    const scoreBounds = document.querySelector('.g1-score-region')!.getBoundingClientRect();
    const gridBounds = document.querySelector('.g1-board-region [role="grid"]')!.getBoundingClientRect();
    const scoreOut = Math.ceil(scrollY + scoreBounds.bottom) + 1;
    const gridTop = scrollY + gridBounds.top;
    const gridOut = Math.ceil(scrollY + gridBounds.bottom) + 1;
    const target = gridTop - scoreOut >= 130 ? scoreOut : Math.max(scoreOut, gridOut);
    window.scrollTo({ top: target, behavior: 'instant' });
  });
  await expect.poll(async () => ({
    scoreAboveViewport: await score.evaluate((element) => element.getBoundingClientRect().bottom <= 0),
    gridDoesNotCoverNotch: await grid.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.top >= 130 || bounds.bottom <= 0;
    }),
  })).toEqual({ scoreAboveViewport: true, gridDoesNotCoverNotch: true });
}
