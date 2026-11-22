import { expect, test } from '@playwright/test';

test('the phone game-day glance joins the score with your squares and keeps the published axes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');

  const entry = page.getByRole('button', { name: 'Find my squares', exact: true });
  await expect(entry).toHaveCount(1);
  await entry.press('Enter');
  const picker = page.getByRole('dialog', { name: 'Find my squares' });
  await expect(picker.getByRole('searchbox')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(entry).toBeFocused();
  await entry.press('Enter');
  await picker.getByRole('button', { name: 'Taylor M.', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Choose another name', exact: true })).toBeFocused();

  const glance = page.getByTestId('game-day-glance');
  await expect(glance.getByRole('img', { name: 'Kansas City 17' })).toBeVisible();
  await expect(glance.getByRole('img', { name: 'Philadelphia 14' })).toBeVisible();
  const squares = glance.getByRole('region', { name: 'Taylor M. square summary' });
  await expect(squares).toContainText('Your square matches the current score.');
  await expect(squares).not.toContainText('Confirmed');
  const action = squares.getByRole('button', { name: 'View on board top 4 side 7' });
  await expect(action).toBeVisible();
  const actionBox = await action.boundingBox();
  expect(actionBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect((actionBox?.y ?? 844) + (actionBox?.height ?? 0)).toBeLessThanOrEqual(844);
  await action.press('Enter');

  const board = page.getByRole('grid', { name: /Top team Philadelphia, Side team Kansas City/ });
  const match = board.getByRole('gridcell', { name: /Taylor M.*coordinate row 1 column 1.*top digit 4.*side digit 7/i });
  await expect(match).toBeFocused();
  await expect(match).toHaveAttribute('data-current', 'true');
  await expect(board.getByRole('gridcell')).toHaveCount(100);
  await expect(page.getByText('All possible next scores')).toBeVisible();
  await expect(page.getByLabel('Published results')).toContainText('not confirmed quarter results');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
