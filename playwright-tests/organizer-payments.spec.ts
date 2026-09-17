import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { boardId, ownerId, scheduledGame, installOrganizerSession, installOrganizerSupport } from './helpers/organizerMocks';

/** Keep server rows outside the page so reload verifies a read, not a React cache. */
function paymentsFixture() {
  const entries = new Map(Array.from({ length: 4 }, (_, cell_index) => [cell_index, {
    contest_id: boardId, cell_index, paid_status: ['paid', 'unpaid', 'unknown', 'paid'][cell_index],
    seller_label: 'Private seller', notify_opt_in: true, contact_type: 'email', contact_value: 'private@example.test',
  }]));
  const writes: Record<string, unknown>[][] = [];
  let failSave = false;
  const row = {
    id: boardId, owner_id: ownerId, share_code: 'PAYTEST1', title: 'Payments browser board', revision: 1,
    meta: 'Parkside fundraiser', gameExternalId: scheduledGame.id, kickoffAt: scheduledGame.kickoffAt,
    dates: 'September 13, 2026', leftAbbr: 'DAL', leftName: 'Dallas Cowboys', topAbbr: 'WAS', topName: 'Washington Commanders',
    board: {
      squares: Array.from({ length: 100 }, (_, index) => index < 4 ? [['Alice Renamed', 'Bob', 'Cara', 'David'][index]] : []),
      allocationLabels: Array.from({ length: 100 }, (_, index) => index < 3 ? 'Mora family' : index === 3 ? 'Jones family' : null),
      leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null), isDynamic: false, allowOpenSquares: false,
    },
    is_activated: false, locked: true, is_shared: false, shared_at: null, published_at: null,
    winner_history: [], pending_milestones: [], notification_delivery_issues: [], payoutDescriptions: {},
  };
  return {
    entries, writes, row, failNextSave: () => { failSave = true; },
    install: async (page: Page) => {
      await installOrganizerSession(page);
      await installOrganizerSupport(page);
      await page.route('**/rest/v1/contest_entries*', async route => {
        if (route.request().method() === 'POST') {
          const payload = route.request().postDataJSON();
          const updates = Array.isArray(payload) ? payload : [payload];
          writes.push(updates);
          if (failSave) { await route.fulfill({ status: 500, json: { message: 'Payment service unavailable' } }); return; }
          for (const update of updates) entries.set(update.cell_index, { ...entries.get(update.cell_index)!, ...update });
          await route.fulfill({ json: updates.map(update => entries.get(update.cell_index)) });
          return;
        }
        await route.fulfill({ json: [...entries.values()] });
      });
      await page.route('**/rest/v1/contests*', route => route.fulfill({ json: [{ id: boardId }] }));
      await page.route(`**/api/pools/${boardId}`, route => route.fulfill({ json: row }));
      await page.route('**/api/pools/*/score', route => route.fulfill({ json: { score: null, winnerHistory: [], pendingMilestones: [] } }));
    },
  };
}

async function openPayments(page: Page) {
  const button = page.getByRole('button', { name: 'Payments', exact: true });
  await expect(button).toBeVisible();
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Payments', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('payments groups allocation owners, finds renamed buyers, and persists only payment fields', async ({ page }) => {
  const fixture = paymentsFixture();
  await fixture.install(page);
  await page.goto(`/boards/${boardId}`);
  const dialog = await openPayments(page);
  await expect(dialog.getByText('Mora family', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Jones family', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Paid · 2 squares', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Unpaid · 1 squares', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Not asked yet · 1 squares', exact: true })).toBeVisible();
  await expect(dialog.getByText('3 squares · 1 paid · 1 unpaid · 1 not asked yet', { exact: true })).toBeVisible();
  await dialog.getByRole('searchbox').fill('Alice Renamed');
  await expect(dialog.getByText('Mora family', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Jones family', { exact: true })).toHaveCount(0);
  await dialog.getByRole('searchbox').fill('');
  await dialog.getByRole('button', { name: 'Show squares for Mora family', exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'Select square 2', exact: true }).check();
  await dialog.getByRole('button', { name: 'Mark 1 selected paid', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Saved 1 square as paid.');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect.poll(() => fixture.entries.get(1)?.paid_status).toBe('paid');
  expect(fixture.writes).toHaveLength(1);
  expect(fixture.writes[0]).toHaveLength(1);
  expect(Object.keys(fixture.writes[0][0]).sort()).toEqual(['cell_index', 'contest_id', 'paid_status']);
  expect(fixture.entries.get(1)).toMatchObject({ seller_label: 'Private seller', contact_value: 'private@example.test', notify_opt_in: true });
  await page.reload();
  const reopened = await openPayments(page);
  await reopened.getByRole('button', { name: 'Show squares for Mora family', exact: true }).click();
  await expect(reopened.getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: 'Select square 2', exact: true }) }).getByText('Paid', { exact: true })).toBeVisible();
});

test('marks remaining family squares paid in one click and persists without changing names or private metadata', async ({ page }) => {
  const fixture = paymentsFixture();
  const originalBoard = structuredClone(fixture.row.board);
  const originalEntries = structuredClone([...fixture.entries.values()]);
  await fixture.install(page);
  await page.goto(`/boards/${boardId}`);
  const dialog = await openPayments(page);
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Mark remaining 2 paid for Mora family', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Saved 2 squares as paid for Mora family.');
  expect(fixture.writes).toHaveLength(1);
  expect(fixture.writes[0].map(entry => entry.cell_index)).toEqual([1, 2]);
  for (const write of fixture.writes[0]) expect(Object.keys(write).sort()).toEqual(['cell_index', 'contest_id', 'paid_status']);
  for (const entry of originalEntries) expect(fixture.entries.get(entry.cell_index)).toEqual({ ...entry, paid_status: 'paid' });
  expect(fixture.row.board).toEqual(originalBoard);
  await page.reload();
  const reopened = await openPayments(page);
  await expect(reopened.getByText('3 squares · 3 paid · 0 unpaid · 0 not asked yet', { exact: true })).toBeVisible();
  await expect(reopened.getByRole('button', { name: /Mark remaining/ })).toHaveCount(0);
  await reopened.getByRole('button', { name: 'Show squares for Mora family', exact: true }).click();
  for (const name of ['Alice Renamed', 'Bob', 'Cara']) await expect(reopened.getByText(name, { exact: true })).toBeVisible();
});

test('group selection respects a renamed-buyer search and leaves other squares unchanged', async ({ page }) => {
  const fixture = paymentsFixture();
  await fixture.install(page);
  await page.goto(`/boards/${boardId}`);
  const dialog = await openPayments(page);
  await dialog.getByRole('searchbox').fill('Alice Renamed');
  await dialog.getByRole('button', { name: 'Show squares for Mora family', exact: true }).click();
  await dialog.getByRole('button', { name: 'Select 1 shown squares for Mora family', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Select square 1', exact: true })).toBeChecked();
  await dialog.getByRole('button', { name: 'Mark 1 selected unpaid', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Saved 1 square as unpaid.');
  await expect.poll(() => fixture.entries.get(0)?.paid_status).toBe('unpaid');
  expect(fixture.writes[0].map(entry => entry.cell_index)).toEqual([0]);
  expect(fixture.entries.get(2)?.paid_status).toBe('unknown');
  expect(fixture.entries.get(3)?.paid_status).toBe('paid');
  await dialog.getByRole('searchbox').fill('');
  await dialog.getByRole('button', { name: 'Select 3 shown squares for Mora family', exact: true }).click();
  await dialog.getByRole('button', { name: 'Mark 3 selected paid', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Saved 3 squares as paid.');
  expect(fixture.writes[1].map(entry => entry.cell_index)).toEqual([0, 1, 2]);
  expect([...fixture.entries.values()].every(entry => entry.paid_status === 'paid')).toBe(true);
});

test('viewing a square then reopening Payments restores the payment trigger on close', async ({ page }) => {
  await paymentsFixture().install(page);
  await page.goto(`/boards/${boardId}`);
  const dialog = await openPayments(page);
  await dialog.getByRole('button', { name: 'Show squares for Mora family', exact: true }).click();
  await dialog.getByRole('button', { name: 'View square 2 on board', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: /^Square 2,/ })).toBeFocused();
  const reopened = await openPayments(page);
  await reopened.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(reopened).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Payments', exact: true })).toBeFocused();
});

test('failed payment save keeps the persisted status and exposes an error', async ({ page }) => {
  const fixture = paymentsFixture();
  fixture.failNextSave();
  await fixture.install(page);
  await page.goto(`/boards/${boardId}`);
  const dialog = await openPayments(page);
  await dialog.getByRole('button', { name: 'Show squares for Mora family', exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'Select square 2', exact: true }).check();
  await dialog.getByRole('button', { name: 'Mark 1 selected paid', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  expect(fixture.entries.get(1)?.paid_status).toBe('unpaid');
  await expect(dialog.getByText(/^Saved /)).toHaveCount(0);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
  test(`compact organizer and private payment layout at ${viewport.width}px with reduced motion`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await paymentsFixture().install(page);
    await page.goto(`/boards/${boardId}`);
    await expect(page.getByRole('button', { name: 'Payments', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const toggle = page.getByRole('button', { name: 'Organizer status', exact: true });
    const details = page.getByRole('region', { name: 'Board details', exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const island = page.locator('.organizer-island');
    const compact = await island.boundingBox();
    expect(compact!.height).toBeLessThan(90);
    const gameSummary = await page.getByText(/^DAL at WAS ·/).boundingBox();
    expect(gameSummary!.height).toBeLessThanOrEqual(48);
    const firstSquare = await page.getByRole('button', { name: /^Square 1,/ }).boundingBox();
    expect(compact!.y + compact!.height).toBeLessThan(firstSquare!.y);
    await toggle.click();
    await expect(details).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await testInfo.attach('expanded-organizer', { body: await page.screenshot({ path: testInfo.outputPath(`expanded-organizer-${viewport.width}.png`) }), contentType: 'image/png' });
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
    await testInfo.attach('compact-organizer', { body: await page.screenshot({ path: testInfo.outputPath(`compact-organizer-${viewport.width}.png`) }), contentType: 'image/png' });
    const dialog = await openPayments(page);
    await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const surfaceColor = await dialog.evaluate(element => getComputedStyle(element).backgroundColor);
    expect(surfaceColor).toMatch(/^rgb\(/); // Computed rgb() is opaque; rgba() would expose the board behind the dialog.
    await expect.poll(async () => { const box = await dialog.boundingBox(); return box ? box.y + box.height : Infinity; }).toBeLessThanOrEqual(viewport.height);
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter(issue => issue.impact === 'serious' || issue.impact === 'critical')).toEqual([]);
    await expect(dialog.getByRole('button', { name: 'Mark remaining 2 paid for Mora family', exact: true })).toBeInViewport();
    await expect(dialog.getByText('Jones family', { exact: true })).toBeInViewport();
    await expect(dialog.getByRole('checkbox')).toHaveCount(0);
    await testInfo.attach('payments', { body: await page.screenshot({ path: testInfo.outputPath(`payments-${viewport.width}.png`) }), contentType: 'image/png' });
    await dialog.getByRole('button', { name: 'Show squares for Mora family', exact: true }).click();
    await dialog.getByRole('checkbox', { name: 'Select square 2', exact: true }).check();
    const selectedActions = dialog.getByRole('group', { name: 'Update selected payment notes', exact: true });
    await expect(selectedActions.getByRole('button', { name: 'Mark 1 selected paid', exact: true })).toBeInViewport();
    await testInfo.attach('payments-selected', { body: await page.screenshot({ path: testInfo.outputPath(`payments-selected-${viewport.width}.png`) }), contentType: 'image/png' });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Payments', exact: true })).toBeFocused();
  });
}

test('normal motion morphs through intermediate geometry and reverses smoothly', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await paymentsFixture().install(page);
  await page.goto(`/boards/${boardId}`);
  const toggle = page.getByRole('button', { name: 'Organizer status', exact: true });
  await expect(toggle).toBeVisible();
  const samples = await toggle.evaluate(async button => {
    const island = button.closest('.organizer-island')!;
    const frames: { time: number; width: number; height: number }[] = [];
    const capture = (time: number) => { const box = island.getBoundingClientRect(); frames.push({ time, width: box.width, height: box.height }); };
    capture(0);
    (button as HTMLButtonElement).click();
    const start = performance.now();
    await new Promise<void>(resolve => {
      const frame = () => { const elapsed = performance.now() - start; capture(elapsed); if (elapsed < 650) requestAnimationFrame(frame); else resolve(); };
      requestAnimationFrame(frame);
    });
    return frames;
  });
  const first = samples[0], last = samples.at(-1)!;
  expect(last.width).toBeGreaterThan(first.width + 50);
  expect(last.height).toBeGreaterThan(first.height + 100);
  expect(samples.some(frame => frame.width > first.width + 5 && frame.width < last.width - 5 && frame.height > first.height + 5 && frame.height < last.height - 5)).toBe(true);
  expect(last.height).toBeLessThan(752);
  await testInfo.attach('normal-motion-frames', { body: JSON.stringify(samples), contentType: 'application/json' });
  await toggle.click();
  await expect.poll(async () => (await page.locator('.organizer-island').boundingBox())!.height).toBeLessThan(90);
  const reversed = await toggle.evaluate(async button => {
    const island = button.closest('.organizer-island')!;
    const heights: number[] = [];
    (button as HTMLButtonElement).click();
    const start = performance.now(); let reversed = false;
    await new Promise<void>(resolve => {
      const frame = () => {
        const elapsed = performance.now() - start;
        heights.push(island.getBoundingClientRect().height);
        if (!reversed && elapsed > 120) { (button as HTMLButtonElement).click(); reversed = true; }
        if (elapsed < 750) requestAnimationFrame(frame); else resolve();
      }; requestAnimationFrame(frame);
    });
    return heights;
  });
  expect(Math.max(...reversed)).toBeGreaterThan(reversed[0] + 20);
  expect(reversed.at(-1)!).toBeLessThan(90);
  expect(Math.max(...reversed.slice(1).map((height, index) => Math.abs(height - reversed[index])))).toBeLessThan(last.height * .5);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('iPad touch hold remains expanded on release and movement cancels hold', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await paymentsFixture().install(page);
  await page.goto(`/boards/${boardId}`);
  const toggle = page.getByRole('button', { name: 'Organizer status', exact: true });
  await expect(toggle).toBeVisible();
  await toggle.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 410, clientY: 40 });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 1 });
  await toggle.dispatchEvent('click');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await toggle.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 2, clientX: 410, clientY: 40 });
  await toggle.dispatchEvent('pointermove', { pointerType: 'touch', pointerId: 2, clientX: 410, clientY: 100 });
  await toggle.dispatchEvent('pointercancel', { pointerType: 'touch', pointerId: 2 });
  await page.mouse.move(4, 700);
  await page.mouse.wheel(0, 350);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  // Observe longer than the hold threshold so a forgotten timer cannot pass.
  await page.waitForTimeout(650);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await toggle.click();
  await expect(page.getByRole('region', { name: 'Board details', exact: true })).toBeVisible();
  // Responsive spring retargeting may cancel a prior animation; wait for the
  // actual surface to settle rather than treating a valid retarget as failure.
  await expect.poll(() => page.locator('.organizer-island').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  const expanded = await page.locator('.organizer-island').boundingBox();
  expect(expanded!.x).toBeGreaterThanOrEqual(0);
  expect(expanded!.x + expanded!.width).toBeLessThanOrEqual(820);
  expect(expanded!.y + expanded!.height).toBeLessThanOrEqual(1180);
  await testInfo.attach('ipad-expanded', { body: await page.screenshot({ path: testInfo.outputPath('ipad-expanded.png') }), contentType: 'image/png' });
});

test('320px enlarged text keeps the trigger and payment controls reachable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await paymentsFixture().install(page);
  await page.goto(`/boards/${boardId}`);
  // Doubled inherited text size exercises text zoom without changing viewport size.
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const toggle = page.getByRole('button', { name: 'Organizer status', exact: true });
  await expect(toggle).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await toggle.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true);
  const bounds = await toggle.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await toggle.click();
  const notch = page.getByRole('region', { name: 'Organizer status', exact: true });
  await notch.getByRole('button', { name: 'Payments', exact: true }).click();
  await notch.getByRole('button', { name: 'Open payments', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Payments', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('searchbox').fill('Bob');
  await dialog.getByRole('button', { name: 'Show squares for Mora family', exact: true }).click();
  await dialog.getByRole('button', { name: 'Select 1 shown squares for Mora family', exact: true }).click();
  await dialog.getByRole('button', { name: 'Mark 1 selected paid', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Saved 1 square as paid.');
  await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await testInfo.attach('enlarged-text-payments', { body: await page.screenshot({ path: testInfo.outputPath('enlarged-text-payments.png') }), contentType: 'image/png' });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(toggle).toBeFocused();
});
