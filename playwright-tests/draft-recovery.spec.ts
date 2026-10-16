import { expect, test } from '@playwright/test';
import { boardId, ownerId, installOrganizerBoard } from './helpers/organizerMocks';

for (const width of [390, 1440]) {
  test(`same-tab reload recovers an unacknowledged owner edit with explicit save ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    // No real account or production request: all remote traffic is intercepted.
    await page.route('https://**/*', route => route.fulfill({ json: [] }));
    await installOrganizerBoard(page);
    const recoveryKey = `gridone:draft-recovery:${ownerId}:${boardId}`;
    let writes = 0;
    let permitSave = false;
    await page.route(`**/api/pools/${boardId}`, async route => {
      if (route.request().method() !== 'PUT') return route.fallback();
      writes += 1;
      if (!permitSave) return route.fulfill({ status: 503, json: { error: 'Simulated unavailable connection' } });
      expect(route.request().postDataJSON().game.title).toBe('Unacknowledged browser edit');
      return route.fulfill({ json: { ok: true, revision: 2 } });
    });
    await page.goto(`/boards/${boardId}`);
    const title = page.getByLabel('Board name');
    await expect(title).toHaveValue('Parkside browser board');
    await title.fill('Unacknowledged browser edit');
    // The title control commits its local input on blur/Enter.
    await title.press('Tab');
    await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) || 'null')?.game?.title, recoveryKey)).toBe('Unacknowledged browser edit');
    await page.reload();
    await expect(title).toHaveValue('Unacknowledged browser edit');
    const explicitSave = page.getByRole('button', { name: 'Save recovered changes', exact: true });
    await expect(explicitSave).toBeVisible();
    await expect(page.getByRole('button', { name: 'Discard and reload server board', exact: true })).toBeVisible();
    const writesAfterReload = writes;
    // Longer than the autosave debounce: recovered content must not autosave.
    await page.waitForTimeout(700);
    expect(writes).toBe(writesAfterReload);
    permitSave = true;
    await explicitSave.click();
    await expect(explicitSave).toBeHidden();
    await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), recoveryKey)).toBeNull();
    expect(writes).toBe(writesAfterReload + 1);
  });
}
