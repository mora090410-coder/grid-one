import { expect, test, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { boardId, ownerId, scheduledGame, installOrganizerSession, installOrganizerSupport } from './helpers/organizerMocks';

async function capture(page: Page, name: string, testInfo: TestInfo) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter(issue => issue.impact === 'serious' || issue.impact === 'critical')).toEqual([]);
  await testInfo.attach(name, { body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true }), contentType: 'image/png' });
}

for (const width of [390, 1440]) {
  test(`public preview retains draft through auth handoff at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await installOrganizerSupport(page);
    await page.goto('/create');
    await page.getByLabel('Board name', { exact: true }).fill('Lincoln Baseball Fundraiser');
    await page.getByRole('radio').first().click();
    await expect(page.getByRole('region', { name: 'Board preview' })).toContainText('Lincoln Baseball Fundraiser');
    await capture(page, `create-preview-${width}`, testInfo);
    await page.reload();
    await expect(page.getByLabel('Board name', { exact: true })).toHaveValue('Lincoln Baseball Fundraiser');
    await page.getByRole('button', { name: 'Save and continue', exact: true }).click();
    await expect(page).toHaveURL(/\/login.*returnTo=%2Fcreate/);
    // Simulate the successful auth return at its boundary, without a live account.
    await installOrganizerSession(page);
    await page.goto('/create');
    await expect(page.getByRole('button', { name: 'Create board', exact: true })).toBeEnabled();
    await expect(page.getByLabel('Board name', { exact: true })).toHaveValue('Lincoln Baseball Fundraiser');
    await expect(page.getByText('Dallas Cowboys at Washington Commanders', { exact: true })).toBeVisible();
    await capture(page, `create-restored-${width}`, testInfo);
  });

  test(`organizer participation and family access at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await installOrganizerSession(page); await installOrganizerSupport(page);
    let row = { id: boardId, owner_id: ownerId, share_code: 'ABCDEFGH', title: 'Lincoln Baseball', revision: 1, meta: '', gameExternalId: scheduledGame.id, kickoffAt: scheduledGame.kickoffAt, leftAbbr: 'DAL', leftName: 'Dallas Cowboys', topAbbr: 'WAS', topName: 'Washington Commanders', board: { squares: Array.from({ length: 100 }, (_, i) => i >= 12 && i < 20 ? ['Anthony'] : []), allocationLabels: Array.from({ length: 100 }, (_, i) => i >= 12 && i < 20 ? 'Anthony' : null), leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null), isDynamic: false, allowOpenSquares: false, participation: {} as Record<string, string> }, is_activated: false, locked: true, is_shared: false, shared_at: null, published_at: null, updated_at: new Date().toISOString(), winner_history: [], pending_milestones: [], notification_delivery_issues: [], payoutDescriptions: {} };
    const actions: string[] = [];
    await page.route(`**/api/pools/${boardId}/score`, route => route.fulfill({ json: { score: null, winnerHistory: [] } }));
    await page.route(`**/api/pools/${boardId}`, async route => {
      if (route.request().method() === 'PUT') {
        row = { ...row, board: route.request().postDataJSON().board, revision: row.revision + 1 };
        await route.fulfill({ json: { ok: true, revision: row.revision } });
      } else await route.fulfill({ json: row });
    });
    await page.route(`**/api/pools/${boardId}/family`, async route => {
      const body = route.request().postDataJSON();
      expect(body.revision).toBe(row.revision);
      actions.push(body.action); row.revision++;
      if (body.action === 'reassign') {
        expect(body.reviewPaymentNotes).toBe(true);
        for (const index of body.cells) row.board.allocationLabels[index] = body.label;
      }
      await route.fulfill({ json: { revision: row.revision, ...(body.action === 'invite' ? { url: `https://gridone.example/family#${'a'.repeat(64)}` } : {}) } });
    });
    await page.goto(`/boards/${boardId}`);
    await page.getByText('Help people join', { exact: true }).click();
    await page.getByLabel('What this board supports', { exact: true }).fill('Help Lincoln Baseball get to summer tournaments.');
    await page.getByLabel('Amount per square (optional)', { exact: true }).fill('$20');
    await page.getByLabel('How to join', { exact: true }).fill('Contact the family who shared this board with your square numbers.');
    await page.getByText('Send families their squares', { exact: true }).click();
    await page.getByRole('combobox', { name: 'Responsible family', exact: true }).selectOption('Anthony');
    await expect.poll(() => row.board.participation.instructions).toBe('Contact the family who shared this board with your square numbers.');
    await page.getByRole('button', { name: 'Create private family link', exact: true }).click();
    await expect(page.getByLabel('Private family link', { exact: true })).toHaveValue(`https://gridone.example/family#${'a'.repeat(64)}`);
    await capture(page, `organizer-invite-${width}`, testInfo);
    await page.getByRole('button', { name: 'Revoke family links', exact: true }).click();
    await expect(page.getByText('This family’s edit links are revoked.', { exact: true })).toBeVisible();
    await page.getByText('Change responsibility', { exact: true }).click();
    await page.getByLabel('Square numbers', { exact: true }).fill('13-14');
    await page.getByLabel('New responsible family', { exact: true }).fill('Maria');
    await page.getByRole('checkbox', { name: /I reviewed the old private payment notes/ }).check();
    await capture(page, `organizer-responsibility-review-${width}`, testInfo);
    await page.getByRole('button', { name: 'Change responsible family', exact: true }).click();
    await expect(page.getByText('Responsibility updated. Names on the board are unchanged.', { exact: true })).toBeVisible();
    expect(row.board.allocationLabels[12]).toBe('Maria');
    expect(row.board.squares[12]).toEqual(['Anthony']);
    expect(actions).toEqual(['invite', 'revoke', 'reassign']);
  });
}
