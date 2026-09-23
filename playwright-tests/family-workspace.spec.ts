import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440]) {
  test(`family names preserve responsibility at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const token = 'a'.repeat(64);
    let record = { title: 'Lincoln Baseball', revision: 1, label: 'Anthony', cells: Array.from({ length: 8 }, (_, i) => ({ index: i + 12, name: i < 2 ? 'Bill W' : 'Anthony', availability: 'unspecified' })) };
    await page.route('**/api/family', async route => {
      expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
      const body = route.request().postDataJSON();
      if (body.action === 'edit') {
        expect(body.revision).toBe(record.revision);
        record = { ...record, revision: record.revision + 1, cells: record.cells.map(cell => ({ ...cell, ...body.changes.find((change: { index: number }) => change.index === cell.index) })) };
      }
      await route.fulfill({ json: record });
    });
    await page.goto(`/family#${token}`);
    await expect(page.getByRole('heading', { name: 'Your 8 squares' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(token);
    await page.getByLabel('Name on square 15', { exact: true }).fill('Maria');
    await page.getByRole('combobox', { name: 'Availability for square 15', exact: true }).selectOption('available');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible();
    await expect(page.getByText('Responsible family: Anthony', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter(issue => issue.impact === 'serious' || issue.impact === 'critical')).toEqual([]);
    await testInfo.attach(`family-${width}`, { body: await page.screenshot({ path: testInfo.outputPath(`family-${width}.png`), fullPage: true }), contentType: 'image/png' });
    await page.reload();
    await expect(page.getByLabel('Name on square 15', { exact: true })).toHaveValue('Maria');
  });
}
