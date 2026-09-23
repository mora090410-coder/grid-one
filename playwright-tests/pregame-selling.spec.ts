import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { boardId, ownerId, scheduledGame, installOrganizerSession, installOrganizerSupport } from './helpers/organizerMocks';

/** Stateful API boundary: UI exercises real saving, sharing, and same-link transitions. */
function sellingFixture() {
  const row = {
    id: boardId, owner_id: ownerId, share_code: 'ABCDEFGH', title: 'Parkside selling board',
    revision: 1, meta: 'Parkside fundraiser', gameExternalId: scheduledGame.id,
    kickoffAt: scheduledGame.kickoffAt, dates: 'September 13, 2026',
    leftAbbr: 'DAL', leftName: 'Dallas Cowboys', topAbbr: 'WAS', topName: 'Washington Commanders',
    board: { squares: Array.from({ length: 100 }, () => [] as string[]), leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null), allocationLabels: Array(100).fill(null), isDynamic: false, allowOpenSquares: false },
    is_activated: false, locked: true, is_shared: false, shared_at: null as string | null, published_at: null as string | null,
    updated_at: '2026-09-04T12:00:00Z', winner_history: [], pending_milestones: [], notification_delivery_issues: [], payoutDescriptions: {},
  };
  let publicReads = 0;
  const privateEntries = new Map<number, Record<string, unknown>>();
  const install = async (page: Page, owner: boolean) => {
    if (owner) {
      await installOrganizerSession(page); await installOrganizerSupport(page);
      await page.route('**/rest/v1/contest_entries*', async route => {
        if (route.request().method() === 'POST') {
          const payload = route.request().postDataJSON();
          for (const entry of Array.isArray(payload) ? payload : [payload]) privateEntries.set(entry.cell_index, entry);
        }
        await route.fulfill({ json: [...privateEntries.values()] });
      });
      await page.route('**/rest/v1/contests*', route => route.fulfill({ json: [{ id: boardId }] }));
    }
    await page.route('**/api/pools/*/score', route => route.fulfill({ json: { score: null, winnerHistory: [], pendingMilestones: [] } }));
    await page.route('**/api/pools/*', async route => {
      if (route.request().method() === 'PUT') {
        const payload = route.request().postDataJSON();
        row.board = payload.board;
        row.title = payload.game?.title || row.title;
        row.meta = payload.game?.meta || row.meta;
        row.revision += 1;
        row.updated_at = new Date().toISOString();
        await route.fulfill({ json: { ok: true, revision: row.revision } });
      } else {
        if (!owner) publicReads++;
        const publicRef = new URL(route.request().url()).pathname.endsWith('/ABCDEFGH');
        await route.fulfill({ json: { ...row, owner_id: owner && !publicRef ? ownerId : undefined, board: publicRef && !row.published_at ? { ...row.board, leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null) } : row.board } });
      }
    });
    await page.route(`**/api/pools/${boardId}/share`, async route => {
      row.is_shared = true; row.locked = false; row.is_activated = true;
      row.shared_at = new Date().toISOString(); row.revision++;
      await route.fulfill({ json: { shared: true, shareCode: row.share_code, viewerUrl: '/b/ABCDEFGH', revision: row.revision, sharedAt: row.shared_at } });
    });
    await page.route(`**/api/pools/${boardId}/publish`, async route => {
      row.published_at = new Date().toISOString(); row.revision++;
      await route.fulfill({ json: { published: true, shareCode: row.share_code, viewerUrl: '/b/ABCDEFGH', revision: row.revision, tier: 'free', used: 1, allowance: 1 } });
    });
  };
  return { row, install, privateEntries, publicReads: () => publicReads };
}

for (const width of [390, 1440]) {
  test(`selling board: allocate, share, rename, finalize on same link at ${width}px`, async ({ page, browser }, testInfo) => {
    test.setTimeout(90_000);
    page.setDefaultTimeout(12_000);
    await page.setViewportSize({ width, height: 900 });
    const fixture = sellingFixture();
    await fixture.install(page, true);
    await page.goto(`/boards/${boardId}`);
    await page.getByRole('button', { name: 'Select squares', exact: true }).click();
    const firstPick = page.getByRole('button', { name: /^Square 1,/ });
    await firstPick.scrollIntoViewIfNeeded();
    const beforePick = await page.evaluate(() => window.scrollY);
    await firstPick.click();
    // Safari does not focus buttons on mouse click; selection must still never
    // move focus into the form or scroll away from the selected square.
    await expect(firstPick).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('textbox', { name: 'Name for these squares' })).not.toBeFocused();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(beforePick);
    for (const square of [12, 23]) {
      await page.getByRole('button', { name: new RegExp(`^Square ${square},`) }).click();
    }
    await page.getByRole('button', { name: 'Name 3 selected squares', exact: true }).click();
    const allocation = page.locator('#allocation-editor');
    await expect(allocation.getByRole('textbox', { name: 'Name for these squares' })).toBeFocused();
    await allocation.getByRole('textbox', { name: 'Name for these squares' }).fill('Mora family');
    await allocation.getByRole('radio', { name: 'Paid', exact: true }).click();
    await allocation.getByRole('button', { name: 'Apply to 3', exact: true }).click();
    await expect.poll(() => fixture.row.board.allocationLabels[22]).toBe('Mora family');
    await expect.poll(() => fixture.privateEntries.get(22)?.paid_status).toBe('paid');
    await expect(page.getByRole('button', { name: 'Share while selling', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Share while selling', exact: true }).click();
    await page.getByRole('button', { name: 'Enable shared board', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Open shared board', exact: true })).toBeVisible();

    await testInfo.attach(`organizer-selling-${width}`, { body: await page.screenshot({ path: testInfo.outputPath(`organizer-selling-${width}.png`), fullPage: true }), contentType: 'image/png' });

    const viewerContext = await browser.newContext();
    const viewer = await viewerContext.newPage();
    viewer.setDefaultTimeout(12_000);
    await viewer.setViewportSize({ width, height: 900 });
    await fixture.install(viewer, false);
    await viewer.goto(new URL('/b/ABCDEFGH', page.url()).href);
    await expect(viewer.getByText('Selling squares', { exact: true })).toBeVisible();
    await expect(viewer.getByRole('gridcell')).toHaveCount(100);
    await expect(viewer.getByRole('gridcell', { name: 'Square 12, Mora family, Mora family', exact: true })).toBeVisible();
    await expect(viewer.getByRole('link', { name: 'Manage board' })).toHaveCount(0);
    await viewer.getByRole('button', { name: 'How to join', exact: true }).click();
    await expect(viewer.getByText(/Text the person who sent you this link/)).toBeVisible();
    await viewer.getByRole('searchbox', { name: 'Find a name or square number', exact: true }).fill('12');
    await expect(viewer.getByRole('region', { name: 'Square details', exact: true }).getByRole('listitem')).toHaveCount(1);
    await viewer.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await viewer.getByLabel('Family', { exact: true }).selectOption('Mora family');
    await expect(viewer.getByRole('region', { name: 'Square details', exact: true }).getByRole('listitem')).toHaveCount(3);
    await expect(viewer.getByRole('gridcell')).toHaveCount(100);
    const grid = viewer.getByRole('grid', { name: 'Selling squares board, 100 squares' });
    await expect.poll(() => grid.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const tenth = await viewer.getByRole('gridcell').nth(9).boundingBox();
    expect(tenth!.x + tenth!.width).toBeLessThanOrEqual(width);
    if (width < 768) {
      const fullDetails = await viewer.getByRole('region', { name: 'Square details', exact: true }).boundingBox();
      const boardRegion = await viewer.getByRole('region', { name: 'Board', exact: true }).boundingBox();
      expect(fullDetails!.y).toBeLessThan(boardRegion!.y);
    }
    const accessibility = await new AxeBuilder({ page: viewer }).analyze();
    expect(accessibility.violations.filter(issue => issue.impact === 'serious' || issue.impact === 'critical')).toEqual([]);
    const first = viewer.getByRole('gridcell').first();
    await first.focus(); await viewer.keyboard.press('ArrowRight');
    await expect(viewer.getByRole('gridcell').nth(1)).toBeFocused();
    await expect.poll(() => viewer.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await testInfo.attach(`selling-board-${width}`, { body: await viewer.screenshot({ path: testInfo.outputPath(`selling-board-${width}.png`), fullPage: true }), contentType: 'image/png' });

    // Display-name edits preserve the responsible family on the existing public link.
    await expect(viewer.getByRole('radiogroup', { name: 'Payment' })).toHaveCount(0);
    await expect(viewer.getByText('Paid', { exact: true })).toHaveCount(0);
    const done = page.getByRole('button', { name: 'Done selecting', exact: true });
    if (await done.isVisible()) await done.click();
    await page.getByRole('button', { name: /^Square 1,/ }).click();
    const squareSheet = page.getByRole('dialog', { name: 'Square 1', exact: true });
    await squareSheet.getByRole('textbox', { name: 'Name on the board', exact: true }).fill('Alice Long Buyer Name');
    await squareSheet.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => fixture.row.board.squares[0]?.[0]).toBe('Alice Long Buyer Name');
    expect(fixture.row.board.allocationLabels[0]).toBe('Mora family');
    expect(fixture.privateEntries.get(0)?.paid_status).toBe('paid');
    await viewer.getByRole('button', { name: 'Refresh board', exact: true }).click();
    await expect(viewer.getByRole('gridcell', { name: 'Square 1, Alice Long Buyer Name, Mora family', exact: true })).toBeVisible();
    await viewer.getByRole('button', { name: 'Highlight blank squares', exact: true }).click();
    await expect(viewer.getByRole('region', { name: 'Square details', exact: true }).getByRole('listitem')).toHaveCount(0);

    await page.getByRole('button', { name: 'Prepare to publish', exact: true }).click();
    await page.getByRole('button', { name: 'Draw with 97 OPEN', exact: true }).click();
    await page.getByRole('button', { name: 'Use numbers and continue', exact: true }).click();
    await page.getByRole('button', { name: 'Review and lock numbers', exact: true }).click();
    await page.getByRole('button', { name: 'Lock game numbers', exact: true }).click();
    await expect.poll(() => fixture.row.published_at).not.toBeNull();
    // Background polling upgrades the open viewer without another navigation.
    const previousReads = fixture.publicReads();
    await expect.poll(fixture.publicReads, { timeout: 35_000 }).toBeGreaterThan(previousReads);
    await expect(viewer.getByText('Selling squares', { exact: true })).toHaveCount(0);
    await expect(viewer.getByRole('button', { name: 'Find my squares', exact: true })).toBeVisible();
    await expect(viewer).toHaveURL(/\/b\/ABCDEFGH$/);
    await testInfo.attach(`finalized-board-${width}`, { body: await viewer.screenshot({ path: testInfo.outputPath(`finalized-board-${width}.png`), fullPage: true }), contentType: 'image/png' });
    await viewerContext.close();
    // Returning through the shared URL still offers the owner's management route.
    await page.goto('/b/ABCDEFGH');
    const manage = page.getByRole('link', { name: 'Manage board', exact: true });
    await expect(manage).toHaveAttribute('href', `/boards/${boardId}`);
    await manage.click();
    await expect(page).toHaveURL(new RegExp(`/boards/${boardId}$`));
    await expect(page.getByRole('link', { name: 'My boards', exact: true })).toBeVisible();
  });
}
