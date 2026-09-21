import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440]) {
  test(`family names preserve responsibility at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const token = 'a'.repeat(64);
    let record = { title: 'Lincoln Baseball', revision: 1, label: 'Anthony', cells: Array.from({ length: 8 }, (_, i) => ({ index: i + 12, name: i < 2 ? 'Bill W' : 'Anthony', availability: 'unspecified' })) };
    let guestLinkCreated = false;
    await page.route('**/api/family', async route => {
      expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
      const body = route.request().postDataJSON();
      if (body.action === 'edit') {
        expect(body.revision).toBe(record.revision);
        record = { ...record, revision: record.revision + 1, cells: record.cells.map(cell => ({ ...cell, ...body.changes.find((change: { index: number }) => change.index === cell.index) })) };
      }
      await route.fulfill({ json: record });
    });
    await page.route('**/api/family/guest-link', async route => {
      expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
      const body = route.request().postDataJSON();
      if (body.action === 'create') {
        guestLinkCreated = true;
        record = { ...record, revision: record.revision + 1 };
      }
      await route.fulfill({ json: {
        boardId: '5a812684-87d1-4c10-9638-d81822b1f755', title: record.title, label: record.label,
        cells: record.cells.map(cell => cell.index), revision: record.revision,
        state: guestLinkCreated ? 'active' : 'not_created', availableCount: record.cells.filter(cell => cell.availability === 'available').length,
        ...(guestLinkCreated ? { maxSquares: 1, url: 'https://www.getgridone.com/p/public-family-buyer-link' } : {}),
      } });
    });
    await page.goto(`/family#${token}`);
    await expect(page.getByRole('heading', { name: 'Your 8 squares' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Share your squares' })).toBeVisible();
    await expect(page.getByText('0 of 8 squares available')).toBeVisible();
    await page.getByRole('button', { name: 'Create public buyer link', exact: true }).click();
    await expect(page.getByLabel('Public buyer link')).toHaveValue('https://www.getgridone.com/p/public-family-buyer-link');
    await expect(page.getByLabel('Prepared share message')).toContainText('no account needed');
    await expect(page.locator('body')).not.toContainText(token);
    await page.getByLabel('Name on square 15', { exact: true }).fill('Maria');
    await page.getByRole('combobox', { name: 'Availability for square 15', exact: true }).selectOption('available');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible();
    await expect(page.getByText('1 of 8 squares available')).toBeVisible();
    await expect(page.getByText('Responsible family: Anthony', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter(issue => issue.impact === 'serious' || issue.impact === 'critical')).toEqual([]);
    await testInfo.attach(`family-${width}`, { body: await page.screenshot({ path: testInfo.outputPath(`family-${width}.png`), fullPage: true }), contentType: 'image/png' });
    await page.reload();
    await expect(page.getByLabel('Name on square 15', { exact: true })).toHaveValue('Maria');
  });
}
