import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { boardId, installOrganizerBoard } from './helpers/organizerMocks';

for (const width of [320, 390, 1280]) {
  for (const textScale of [100, 200]) {
    test(`organizer names both team axes outside the scrolling grid at ${width}px and ${textScale}% text`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await installOrganizerBoard(page);
      await page.goto(`/boards/${boardId}`);
      await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale}%`; }, textScale);
      const axes = page.getByRole('group', { name: 'Team axes' });
      await expect(axes).toBeVisible();
      await expect(axes).toContainText('Top (columns) · WAS');
      await expect(axes).toContainText('Side (rows) · DAL');
      await expect(page.getByTestId('board-grid').getByRole('button')).toHaveCount(100);
      const before = await axes.boundingBox();
      expect(before!.x).toBeGreaterThanOrEqual(0);
      expect(before!.x + before!.width).toBeLessThanOrEqual(width + 1);
      const scroll = page.getByTestId('contained-board-overflow');
      await scroll.evaluate(node => { node.scrollLeft = node.scrollWidth; });
      const after = await axes.boundingBox();
      expect(after!.x).toBe(before!.x);
      expect(after!.width).toBe(before!.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await scroll.evaluate(node => { node.scrollLeft = 0; });
      await page.screenshot({ path: info.outputPath(`team-axes-${width}-${textScale}.png`), fullPage: false });
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
    });
  }
}
