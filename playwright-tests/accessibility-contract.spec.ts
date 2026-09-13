import { expect, test, type Locator, type Page } from '@playwright/test';

const authStorageKey = 'sb-illqymckwqiawdwxhwcy-auth-token';
const ownerId = '11111111-1111-4111-8111-111111111111';

const sessionValue = () => JSON.stringify({
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  expires_in: 60 * 60,
  token_type: 'bearer',
  user: {
    id: ownerId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'organizer@example.test',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-07-28T00:00:00.000Z',
  },
});

const installOrganizerSession = async (page: Page) => {
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
  }, { key: authStorageKey, value: sessionValue() });
};

const publishedBoard = {
  leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  topAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  squares: Array.from({ length: 100 }, (_, index) => index === 0 ? ['Ann'] : [] as string[]),
  isDynamic: false,
  allowOpenSquares: true,
  participants: [{ id: 'participant-ann', displayName: 'Ann', publicLabel: 'AN' }],
};

const liveScore = {
  leftScore: 17,
  topScore: 24,
  quarterScores: {
    Q1: { left: 3, top: 7 },
    Q2: { left: 7, top: 7 },
    Q3: { left: 7, top: 3 },
    Q4: { left: 0, top: 7 },
    OT: { left: 0, top: 0 },
  },
  clock: '2:31',
  period: 4,
  state: 'in',
  detail: 'Fourth quarter',
  isOvertime: false,
  sourceName: 'ESPN',
  retrievedAt: '2026-09-13T20:15:00.000Z',
  staleAfter: '2099-09-13T20:16:00.000Z',
  freshness: 'fresh',
};

const organizerDraftBoard = {
  leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  topAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  squares: Array.from({ length: 100 }, (_, index) => index === 0 ? ['Ann'] : [] as string[]),
  isDynamic: false,
};

/** Numbers not drawn yet: the draw and the reconcile checklist both live here. */
const organizerUndrawnBoard = {
  ...organizerDraftBoard,
  leftAxis: Array(10).fill(null),
  topAxis: Array(10).fill(null),
};

/** Every square assigned and both axes drawn: the publish path is open. */
const organizerReadyBoard = {
  leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  topAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  squares: Array.from({ length: 100 }, () => ['Mora']),
  isDynamic: false,
};

const scheduledGame = {
  id: '401772510',
  kickoffAt: '2026-09-13T17:00:00.000Z',
  state: 'pre',
  season: 2026,
  week: 1,
  awayTeam: { abbr: 'DAL', name: 'Dallas Cowboys' },
  homeTeam: { abbr: 'WAS', name: 'Washington Commanders' },
};

const installPublishedBoard = async (page: Page, options: {
  board?: typeof publishedBoard;
  score?: typeof liveScore & Record<string, unknown>;
  winnerHistory?: Array<Record<string, unknown>>;
  pendingMilestones?: Array<Record<string, unknown>>;
  payoutDescriptions?: Record<string, string>;
} = {}) => {
  const board = options.board ?? publishedBoard;
  const score = options.score ?? liveScore;
  const winnerHistory = options.winnerHistory ?? [];
  const pendingMilestones = options.pendingMilestones ?? [];
  await page.route('**/api/pools/ABCDEFGH', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      share_code: 'ABCDEFGH',
      title: 'Published Week 1',
      revision: 7,
      published_at: '2026-09-12T20:00:00.000Z',
      leftAbbr: 'DAL',
      leftName: 'Dallas Cowboys',
      topAbbr: 'WAS',
      topName: 'Washington Commanders',
      gameExternalId: scheduledGame.id,
      kickoffAt: scheduledGame.kickoffAt,
      dates: '2026-09-13',
      board,
      score,
      winner_history: winnerHistory,
      pending_milestones: pendingMilestones,
      payoutDescriptions: options.payoutDescriptions ?? {},
      is_activated: true,
      locked: false,
    }),
  }));
  await page.route('**/api/pools/ABCDEFGH/score', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ score, winnerHistory, pendingMilestones }),
  }));
};

const installOrganizerBoard = async (page: Page, options: {
  board?: typeof organizerDraftBoard;
  revision?: number;
  /** Answer every save with a revision conflict, as a second session would. */
  saveConflict?: boolean;
  /** Paid activation: the viewer surfaces expose Share and game day exposes manual scoring. */
  activated?: boolean;
  /** Already published: the workspace opens on the game-day layout. */
  published?: boolean;
} = {}) => {
  await installOrganizerSession(page);
  await page.route(`**/api/pools/${ownerId}`, async (route) => {
    if (route.request().method() === 'PUT') {
      if (options.saveConflict) {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'This board changed in another session.',
            code: 'REVISION_CONFLICT',
            currentRevision: (options.revision ?? 1) + 4,
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, revision: (options.revision ?? 1) + 1 }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: ownerId,
        share_code: 'ABCDEFGH',
        owner_id: ownerId,
        title: 'QA draft board',
        status: 'draft',
        revision: options.revision ?? 1,
        gameExternalId: scheduledGame.id,
        kickoffAt: scheduledGame.kickoffAt,
        dates: '2026-09-13',
        leftAbbr: 'DAL',
        leftName: 'Dallas Cowboys',
        topAbbr: 'WAS',
        topName: 'Washington Commanders',
        payoutDescriptions: {},
        board: options.board ?? organizerDraftBoard,
        score: options.published ? liveScore : null,
        is_activated: options.activated ?? false,
        locked: false,
        published_at: options.published ? '2026-09-12T20:00:00.000Z' : null,
        winner_history: [],
        pending_milestones: [],
      }),
    });
  });
  await page.route(`**/api/pools/${ownerId}/score/manual`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, useManualScores: true }),
  }));
  await page.route(`**/api/pools/${ownerId}/score`, (route) => (options.published
    ? route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ score: liveScore, winnerHistory: [], pendingMilestones: [] }),
    })
    : route.fulfill({
      status: 402,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Publish this board to use automatic live scoring and updates.' }),
    })));
  await page.route('**/rest/v1/contest_entries*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  await page.route('**/api/nfl/games?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ games: [scheduledGame] }),
  }));
  await page.route('**/api/billing/status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ tier: 'free', used: 0, allowance: 1 }),
  }));
  await page.route(`**/api/pools/${ownerId}/publish`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ published: true, shareCode: 'ABCDEFGH', viewerUrl: '/b/ABCDEFGH', revision: 3, tier: 'free', used: 1, allowance: 1 }),
  }));
};

const expectTouchTarget = async (locator: Locator) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
};

const expectNoPageOverflowExceptBoardViewport = async (page: Page) => {
  const overflow = await page.evaluate(() => {
    const documentWidth = document.documentElement.clientWidth;
    return Array.from(document.body.querySelectorAll<HTMLElement>('*'))
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (element.closest('.gridone-viewer-board-viewport, .sr-only')) return false;
        return element.scrollWidth > element.clientWidth + 1 || element.getBoundingClientRect().right > documentWidth + 1;
      })
      .map((element) => ({
        tag: element.tagName,
        text: element.textContent?.trim().slice(0, 80),
        className: typeof element.className === 'string' ? element.className : '',
      }));
  });
  expect(overflow).toEqual([]);
};

test.describe('Slice 2 signed-out accessibility contract automation', () => {
  test('signed-out login and signup failures expose recoverable field-linked errors', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible();

    await page.route('**/auth/v1/token?grant_type=password', (route) => route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Invalid login credentials' }),
    }));
    await page.getByLabel('Email Address').fill('missing@example.test');
    await page.getByLabel('Password', { exact: true }).fill('bad-password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('No account found or incorrect password. Create one?');
    await expect(page.getByLabel('Email Address')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('aria-describedby', 'auth-error');

    await page.getByRole('button', { name: /Don't have an account/i }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Create your organizer account' })).toBeVisible();
    await page.getByLabel('Password', { exact: true }).fill('abcdef');
    await page.getByLabel('Confirm Password').fill('uvwxyz');
    await page.getByRole('button', { name: 'Create organizer account' }).click();
    await expect(page.getByRole('alert')).toContainText('Passwords do not match');
    await expect(page.getByLabel('Confirm Password')).toHaveAttribute('aria-describedby', 'auth-error');
  });

  // Folded in from the retired playwright-tests/phase5-accessibility.spec.ts:
  // the sign-in fields are the only text inputs a signed-out organizer meets,
  // so their rendered boundary, focus change, touch geometry, and wordy (not
  // iconographic) error stay under contract.
  test('sign-in fields render a boundary, a focus change, 44 by 44 geometry, and a wordless-icon-free error', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');

    const email = page.getByLabel('Email Address');
    const submit = page.getByRole('button', { name: 'Sign In', exact: true });

    await expect(email).toHaveCSS('border-top-style', 'solid');
    // The input draws a 1px boundary; a hairline that renders at 0 or thickens
    // under a stray override are both regressions.
    await expect.poll(() => email.evaluate((element) => getComputedStyle(element).borderTopWidth))
      .toBe('1px');

    await expectTouchTarget(email);
    await expectTouchTarget(submit);

    const restingBorder = await email.evaluate((element) => getComputedStyle(element).borderTopColor);
    await email.focus();
    await expect(email).toBeFocused();
    // The focused boundary changes colour and gains a ring; either alone would
    // leave a keyboard organizer guessing where they are.
    await expect.poll(() => email.evaluate((element) => getComputedStyle(element).borderTopColor))
      .not.toBe(restingBorder);
    await expect.poll(() => email.evaluate((element) => getComputedStyle(element).boxShadow))
      .not.toBe('none');

    await page.getByRole('button', { name: /Don't have an account/i }).click();
    await page.getByLabel('Email Address').fill('organizer@example.test');
    await page.getByLabel('Password', { exact: true }).fill('abcdef');
    await page.getByLabel('Confirm Password').fill('uvwxyz');
    await page.getByRole('button', { name: 'Create organizer account' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Passwords do not match');
    await expect(alert).toHaveAttribute('id', 'auth-error');
    // The dark base carries no icons: the alert says it in words.
    await expect(alert.locator('svg')).toHaveCount(0);
    await expect(page.getByLabel('Email Address')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Email Address')).toHaveAttribute('aria-describedby', 'auth-error');
  });

  test('demo and published routes expose semantic headings and synthetic/demo identity', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByRole('heading', { level: 1, name: /Demo: Super Bowl LIX/i })).toBeVisible();
    await expect(page.getByText(/demo/i).first()).toBeVisible();

    await installPublishedBoard(page);
    await page.goto('/b/ABCDEFGH');
    await expect(page.getByRole('heading', { level: 1, name: /Published Week 1/i })).toBeVisible();
    await expect(page.getByRole('main', { name: /Published Week 1 viewer/i })).toBeVisible();
  });

  test('homepage exposes a semantic level-one product heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('representative public controls have visible focus and 44 by 44 geometry', async ({ page }) => {
    await page.goto('/');
    for (const control of [
      page.getByRole('link', { name: 'Create your free board' }).first(),
      page.getByRole('link', { name: 'Explore a sample board' }).first(),
    ]) {
      await expectTouchTarget(control);
      await control.focus();
      await expect(control).toBeFocused();
      await expect.poll(() => control.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.outlineStyle, style.outlineWidth, style.boxShadow].join('|');
      })).not.toMatch(/^none\|0px\|none$/);
    }
  });

  test('homepage sign-in control meets the 44 by 44 target contract', async ({ page }) => {
    await page.goto('/');
    await expectTouchTarget(page.getByRole('link', { name: 'Sign in' }).first());
  });

  test('organizer board editor exposes every square by name without credentials beyond mocked owner auth', async ({ page }) => {
    await installOrganizerBoard(page);
    await page.goto(`/boards/${ownerId}`);
    await expect(page.getByRole('main', { name: 'QA draft board workspace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Square 1, assigned to Ann' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Square 2, unassigned' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Square \d+, unassigned/ })).toHaveCount(99);

    await page.getByRole('button', { name: 'Square 2, unassigned' }).click();
    const square = page.getByRole('dialog', { name: 'Square 2' });
    await expect(square).toBeVisible();
    await expect(square.getByLabel('Name on the board')).toBeFocused();
  });

  test('organizer range assignment selects a block, labels it once, and leaves on Escape', async ({ page }) => {
    await installOrganizerBoard(page);
    await page.goto(`/boards/${ownerId}`);
    await expect(page.getByRole('main', { name: 'QA draft board workspace' })).toBeVisible();

    const toggle = page.getByRole('button', { name: 'Select squares' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    const doneSelecting = page.getByRole('button', { name: 'Done selecting' });
    await expect(doneSelecting).toHaveAttribute('aria-pressed', 'true');

    // Two single picks, then a shift-click that fills the block up to square 4.
    const firstPick = page.getByRole('button', { name: 'Square 2, unassigned' });
    await firstPick.scrollIntoViewIfNeeded();
    const beforePick = await page.evaluate(() => window.scrollY);
    await firstPick.click();
    await expect(firstPick).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Name for these squares')).not.toBeFocused();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(beforePick);
    await page.getByRole('button', { name: 'Square 3, unassigned' }).click();
    await page.getByRole('button', { name: 'Square 4, unassigned' }).click({ modifiers: ['Shift'] });

    for (const label of ['Square 2, unassigned', 'Square 3, unassigned', 'Square 4, unassigned']) {
      await expect(page.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(page.getByRole('button', { name: 'Square 5, unassigned' })).toHaveAttribute('aria-pressed', 'false');

    const bar = page.getByRole('group', { name: 'Assign selected squares' });
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('3 selected');
    await expect(bar.getByLabel('Sold by (optional)')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Paste names' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Name 3 selected squares' }).click();
    await expect(bar.getByLabel('Name for these squares')).toBeFocused();
    await expect(bar.getByRole('radiogroup', { name: 'Payment' })).toBeVisible();
    await expect(bar.getByRole('radio', { name: 'Not asked yet' })).toHaveAttribute('aria-checked', 'true');

    await bar.getByLabel('Name for these squares').fill('Dana');
    await bar.getByRole('button', { name: 'Apply to 3' }).click();

    for (const index of [2, 3, 4]) {
      await expect(page.getByRole('button', { name: `Square ${index}, assigned to Dana` })).toBeVisible();
    }
    await expect(bar).toBeHidden();

    // Escape on a square leaves selection mode; the cells drop pressed state.
    await page.getByRole('button', { name: 'Square 6, unassigned' }).focus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Select squares' })).toHaveAttribute('aria-pressed', 'false');
    await expect
      .poll(() => page.getByRole('button', { name: 'Square 6, unassigned' }).getAttribute('aria-pressed'))
      .toBeNull();
  });

  test('organizer Reconcile separates private advisories from publish blockers', async ({ page }) => {
    await installOrganizerBoard(page, { board: organizerUndrawnBoard });
    await page.goto(`/boards/${ownerId}`);
    await expect(page.getByRole('main', { name: 'QA draft board workspace' })).toBeVisible();

    const blockers = page.getByRole('region', { name: 'Before you can publish' });
    const advisories = page.getByRole('region', { name: 'Private follow-up' });

    await expect(blockers).toContainText('Confirm that the remaining OPEN squares should stay OPEN.');
    await expect(advisories).toContainText('OPEN squares remain. You can publish if you are okay leaving them OPEN.');
    await expect(advisories).toContainText('Some private payment notes still need follow-up.');
    await expect(advisories).not.toContainText('Some seller notes still need follow-up.');

    // Advisories never masquerade as blockers, and the draw stays reachable.
    await expect(blockers).not.toContainText('OPEN squares remain');
    await expect(blockers).not.toContainText('still need follow-up');
    await expect(page.getByRole('button', { name: 'Prepare to publish' })).toBeEnabled();
  });

  test('organizer Draw open-square confirmation has accessible warning semantics and safe focus path', async ({ page }) => {
    await installOrganizerBoard(page, { board: organizerUndrawnBoard });
    await page.goto(`/boards/${ownerId}`);
    await page.getByRole('button', { name: 'Prepare to publish' }).click();

    const confirmation = page.getByRole('group', { name: /99 squares are open\. Draw anyway\?/i });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText('Open squares stay marked OPEN');
    const keepAssigning = confirmation.getByRole('button', { name: 'Keep assigning' });
    const drawAnyway = confirmation.getByRole('button', { name: 'Draw with 99 OPEN' });
    await expect(keepAssigning).toBeVisible();
    await expect(drawAnyway).toBeVisible();
    await expectTouchTarget(keepAssigning);
    await expectTouchTarget(drawAnyway);

    await keepAssigning.focus();
    await expect(keepAssigning).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(confirmation).toBeHidden();
  });

  test('organizer publish confirmation summarizes the board and opens on a safe cancel', async ({ page }) => {
    await installOrganizerBoard(page, { board: organizerReadyBoard });
    await page.goto(`/boards/${ownerId}`);
    await page.getByRole('button', { name: 'Preview and publish', exact: true }).click();

    const preview = page.getByRole('dialog', { name: 'Private preview — sharing is off' });
    await expect(preview).toBeVisible();
    await preview.getByRole('button', { name: 'Review and publish' }).click();

    const publish = page.getByRole('dialog', { name: 'Publish viewer link' });
    await expect(publish).toBeVisible();
    await expect(publish).toHaveAttribute('aria-modal', 'true');
    const cancel = publish.getByRole('button', { name: 'Cancel' });
    await expect(cancel).toBeFocused();
    await expectTouchTarget(cancel);

    await expect(publish).toContainText('Board name');
    await expect(publish).toContainText('QA draft board');
    await expect(publish).toContainText('Matchup');
    await expect(publish).toContainText('DAL at WAS');
    await expect(publish).toContainText('Kickoff');
    await expect(publish).toContainText('Squares');
    await expect(publish).toContainText('100 assigned · 0 OPEN');
    await expect(publish).toContainText('Top axis');
    await expect(publish).toContainText('Side axis');
    await expect(publish).toContainText('What becomes public');
    await expect(publish).toContainText('What remains private');
    await expect(publish).toContainText('0 of 1 published this season · Free');
    await expect(publish.getByRole('button', { name: 'Publish viewer link' })).toBeEnabled();

    await cancel.click();
    await expect(publish).toBeHidden();
  });

  test('the share sheet paints above the private preview and Escape closes only the share sheet', async ({ page }) => {
    await installOrganizerBoard(page, { board: organizerReadyBoard, activated: true });
    await page.goto(`/boards/${ownerId}`);
    await page.getByRole('button', { name: 'Preview and publish', exact: true }).click();

    const preview = page.getByRole('dialog', { name: 'Private preview — sharing is off' });
    await expect(preview).toBeVisible();

    const shareTrigger = preview.getByRole('button', { name: 'Share', exact: true });
    await expect(shareTrigger).toBeVisible();
    await shareTrigger.focus();
    await page.keyboard.press('Enter');

    const share = page.getByRole('dialog', { name: 'Share link' });
    await expect(share).toBeVisible();
    const copy = share.getByRole('button', { name: 'Copy', exact: true });
    await expect(copy).toBeVisible();
    await expect(copy).toBeEnabled();

    // The share sheet is mounted before the preview in the DOM, so the only
    // thing that keeps it clickable is its stacking layer: hit-test the Copy
    // button rather than trusting document order.
    const hit = await copy.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      const dialog = top?.closest('[role="dialog"]');
      return {
        insideCopy: element.contains(top),
        dialogLabel: dialog?.querySelector('h2')?.textContent ?? null,
      };
    });
    expect(hit.insideCopy).toBe(true);
    expect(hit.dialogLabel).toBe('Share link');

    await page.keyboard.press('Escape');
    await expect(share).toBeHidden();
    await expect(preview).toBeVisible();
    await expect(shareTrigger).toBeFocused();
  });

  test('manual score controls expose a visible focus ring', async ({ page }) => {
    await installOrganizerBoard(page, { board: organizerReadyBoard, activated: true, published: true });
    await page.goto(`/boards/${ownerId}`);
    await expect(page.getByRole('main', { name: 'QA draft board workspace' })).toBeVisible();

    await page.getByRole('button', { name: 'Manual', exact: true }).click();

    const status = page.getByLabel('Game Status');
    await expect(status).toBeVisible();
    const quarter = page.locator('input[type="number"]').first();
    await expect(quarter).toBeVisible();

    for (const control of [status, quarter]) {
      await control.focus();
      await expect(control).toBeFocused();
      const shadow = await control.evaluate((element) => getComputedStyle(element).boxShadow);
      expect(shadow).not.toBe('none');
    }
  });

  test('organizer save conflict blocks progression with a live recoverable alert', async ({ page }) => {
    await installOrganizerBoard(page, { board: organizerReadyBoard, saveConflict: true });
    await page.goto(`/boards/${ownerId}`);
    await expect(page.getByRole('main', { name: 'QA draft board workspace' })).toBeVisible();

    // First save fails; the second edit meets a revision that moved underneath it.
    await page.getByLabel('Board name').fill('Conflicting title');
    await page.getByLabel('Board name').press('Enter');
    await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'Save failed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Organizer status', exact: true })).toHaveAccessibleDescription(/Save failed/);
    await page.getByLabel('Board name').fill('Conflicting title again');
    await page.getByLabel('Board name').press('Enter');

    const conflict = page.getByRole('alert').filter({ hasText: 'This board changed in another session.' });
    await expect(conflict).toBeVisible();
    const reload = conflict.getByRole('button', { name: 'Reload latest board' });
    await expect(reload).toBeVisible();
    await expectTouchTarget(reload);

    // Local work survives, and publishing stays closed until the reload happens.
    await expect(page.getByLabel('Board name')).toHaveValue('Conflicting title again');
    await expect(page.getByRole('region', { name: 'Before you can publish' }))
      .toContainText('This board changed in another session. Reload the latest version.');

    await page.getByRole('button', { name: 'Preview and publish', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Private preview — sharing is off' });
    await expect(preview).toBeVisible();
    await expect(preview.getByRole('button', { name: 'Review and publish' })).toBeDisabled();
  });

  test('viewer unpersonalized and personalized modes preserve structural semantics', async ({ page }) => {
    await installPublishedBoard(page);
    await page.goto('/b/ABCDEFGH');
    await expect(page.getByRole('main', { name: /Published Week 1 viewer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Find my squares/i }).first()).toBeVisible();
    await expect(page.getByText(/Quarter-winner email for Ann/i)).toHaveCount(0);

    await page.getByRole('button', { name: /Find my squares/i }).first().click();
    await page.getByLabel('Name used on board').fill('Ann');
    await page.getByLabel('Name used on board').press('Enter');
    await expect(page.getByText('1 square', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose another name' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeVisible();
    await expect(page.getByText(/Quarter-winner email for Ann/i)).toBeVisible();
  });

  test('viewer C1 first-viewport, stale/offline scenario copy, and Final-record hierarchy stay deterministic', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installPublishedBoard(page, {
      score: { ...liveScore, freshness: 'offline', warning: 'Offline warning', retrievedAt: '2026-09-13T20:15:00.000Z' },
    });
    await page.goto('/b/ABCDEFGH');

    const firstViewport = page.getByTestId('viewer-first-viewport');
    await expect(page.getByRole('main', { name: /Published Week 1 viewer/i })).toBeVisible();
    await expect(firstViewport.getByRole('heading', { name: 'Published Week 1' })).toBeVisible();
    await expect(firstViewport.getByRole('status').filter({ hasText: 'Offline · last known' })).toBeVisible();
    await expect(firstViewport.getByText('Score updates about every three minutes')).toBeVisible();
    await expect(firstViewport.getByRole('button', { name: 'Find my squares' })).toBeVisible();
    await expect(firstViewport.getByText(/Using the last-known score checked .+ until scoring reconnects\./i)).toBeVisible();

    const firstViewportOrder = await firstViewport.evaluate((root) => {
      const heading = root.querySelector('h1');
      const status = root.querySelector('[role="status"]');
      const find = Array.from(root.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Find my squares');
      const details = Array.from(root.querySelectorAll('summary')).find((summary) => summary.textContent?.includes('All possible next scores'));
      if (!heading || !status || !find || !details) return false;
      const position = Node.DOCUMENT_POSITION_FOLLOWING;
      return Boolean(
        heading.compareDocumentPosition(status) & position
        && status.compareDocumentPosition(find) & position
        && find.compareDocumentPosition(details) & position
      );
    });
    expect(firstViewportOrder).toBe(true);

    const findButtonBox = await firstViewport.getByRole('button', { name: 'Find my squares' }).boundingBox();
    expect(findButtonBox?.y ?? 845).toBeLessThan(844);

    await page.getByRole('button', { name: /Find my squares/i }).first().click();
    await page.getByLabel('Name used on board').fill('Ann');
    await page.getByLabel('Name used on board').press('Enter');
    const summary = page.getByRole('region', { name: /Ann square summary/i });
    const winnerEmail = page.getByRole('form', { name: /winner email/i });
    await expect(summary.getByText('1 square', { exact: true })).toBeVisible();
    await expect(summary.getByText(/WAS column 0 × DAL row 0/i)).toBeVisible();
    await expect(summary.getByRole('button', { name: /View on board top 0 side 0/i })).toBeVisible();
    await expect(summary.getByText(/None of the next scores listed here match this square\./i)).toBeVisible();
    await expect(winnerEmail).toBeVisible();
    const personalizedBeforeEmail = await page.locator('[aria-label="Ann square summary"], [role="form"][aria-label="winner email"]').evaluateAll((nodes) => {
      const [summaryNode, emailNode] = nodes;
      return Boolean(summaryNode && emailNode && summaryNode.compareDocumentPosition(emailNode) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(personalizedBeforeEmail).toBe(true);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installPublishedBoard(page, {
      score: { ...liveScore, state: 'post', period: 4, clock: 'Final', detail: 'Final', freshness: 'fresh' },
      winnerHistory: [
        { milestone: 'FINAL', topDigit: 4, sideDigit: 7, participantName: 'Ann', resolvedAt: '2026-09-13T21:00:00.000Z', resolutionVersion: 1 },
      ],
    });
    await page.goto('/b/ABCDEFGH');
    await expect(page.getByRole('heading', { name: 'Final record' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What score changes the next result?' })).toHaveCount(0);
    await expect(page.getByText(/Safety \+2|Field goal \+3|Touchdown \+6/)).toHaveCount(0);
  });

  test('viewer stale, offline, and manual score authority states remain explicit', async ({ page }) => {
    for (const [freshness, label] of [
      ['stale', 'Stale · last known'],
      ['offline', 'Offline · last known'],
    ] as const) {
      await installPublishedBoard(page, {
        score: { ...liveScore, freshness, warning: `${label} warning`, retrievedAt: '2026-09-13T20:00:00.000Z' },
      });
      await page.goto('/b/ABCDEFGH');
      await expect(page.getByRole('status').filter({ hasText: label })).toBeVisible();
      await expect(page.getByText('Score updates about every three minutes')).toBeVisible();
      await expect(page.getByText(`${label} warning`)).toBeVisible();
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }

    await installPublishedBoard(page, {
      score: { ...liveScore, isManual: true, sourceName: 'Organizer entry', detail: 'Manual score entered by organizer' },
    });
    await page.goto('/b/ABCDEFGH');
    await expect(page.getByRole('status').filter({ hasText: 'Manual score' })).toContainText('Entered by the organizer');
  });

  test('viewer pending, corrected, OPEN, and Final records expose non-future-looking semantics', async ({ page }) => {
    await installPublishedBoard(page, {
      score: { ...liveScore, state: 'post', period: 4, clock: 'Final', detail: 'Final', freshness: 'fresh' },
      pendingMilestones: [{ milestone: 'Q3', topScore: 24, sideScore: 17, topDigit: 4, sideDigit: 7 }],
      winnerHistory: [
        { milestone: 'Q1', topDigit: 7, sideDigit: 3, participantName: 'Ann', resolvedAt: '2026-09-13T18:00:00.000Z', resolutionVersion: 1 },
        { milestone: 'Q2', topDigit: 7, sideDigit: 7, participantName: null, openSquare: true, resolvedAt: '2026-09-13T19:00:00.000Z', resolutionVersion: 1 },
        { milestone: 'FINAL', topDigit: 4, sideDigit: 7, participantName: 'Ann', corrected: true, correctionReason: 'Official final score corrected', resolvedAt: '2026-09-13T21:00:00.000Z', resolutionVersion: 2 },
      ],
      payoutDescriptions: { notes: 'Open squares follow organizer house rules.' },
    });
    await page.goto('/b/ABCDEFGH');
    await expect(page.getByRole('status').filter({ hasText: 'Final' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pending confirmation' })).toBeVisible();
    await expect(page.getByText('Q3 · 24-17 · digits 4/7')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Final record' })).toBeVisible();
    await expect(page.getByText(/Halftime.*Open square/)).toBeVisible();
    await expect(page.getByText(/Final.*Ann/)).toBeVisible();
    await expect(page.getByText('Official final score corrected')).toBeVisible();
  });

  test('find-my-squares dialog keeps focus inside, closes, and returns focus', async ({ page }) => {
    await page.goto('/demo');
    const trigger = page.getByRole('button', { name: /Find my squares/i });
    await expectTouchTarget(trigger);
    await trigger.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'Find my squares' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Name used on board')).toBeFocused();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    await dialog.getByTestId('browse-name-list').getByRole('button').last().focus();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('viewer board uses one keyboard target and exposes cell coordinates/status names', async ({ page }) => {
    await installPublishedBoard(page);
    await page.goto('/b/ABCDEFGH');
    const grid = page.getByRole('grid', { name: /football squares board/i });
    const namedCell = grid.getByRole('gridcell', { name: /Ann.*coordinate row 1 column 1.*top digit 0.*side digit 0/i });
    await expect(namedCell).toBeVisible();

    const tabStops = await grid.getByRole('gridcell').evaluateAll((cells) =>
      cells.filter((cell) => cell.getAttribute('tabindex') === '0').length
    );
    expect(tabStops).toBe(1);

    await namedCell.focus();
    await page.keyboard.press('ArrowRight');
    await expect(grid.getByRole('gridcell', { name: /OPEN.*coordinate row 1 column 2.*top digit 1.*side digit 0/i })).toBeFocused();
    await page.keyboard.press('End');
    await expect(grid.getByRole('gridcell', { name: /coordinate row 1 column 10/i })).toBeFocused();
    await page.keyboard.press('Control+Home');
    await expect(namedCell).toBeFocused();
  });

  test('320 and 390 phone widths avoid page overflow outside the intentional board viewport', async ({ page }) => {
    await installPublishedBoard(page);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/b/ABCDEFGH');
      await expect(page.getByRole('main', { name: /Published Week 1 viewer/i })).toBeVisible();
      await expectNoPageOverflowExceptBoardViewport(page);
    }
  });

  test('reduced-motion keeps public content and state reachable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2, name: 'Scores update themselves.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create your free board' }).first()).toBeVisible();
    await page.goto('/demo');
    await expect(page.getByRole('button', { name: /Find my squares/i })).toBeVisible();
  });

  test('forced-colors preserves reliable public boundaries and focus indicators', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('webkit'), 'Playwright forced-colors emulation is Chromium-only; owner: accessibility slice; remove when WebKit supports reliable forced-colors emulation.');
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/login');
    const email = page.getByLabel('Email Address');
    await email.focus();
    await expect(email).toBeFocused();
    await expect.poll(() => email.evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.borderTopStyle}|${style.outlineStyle}`;
    })).not.toBe('none|none');
  });
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
  test(`publish continuation stays visible without scrolling at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installOrganizerBoard(page, { board: { ...organizerReadyBoard, leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null) } });
    await page.goto(`/boards/${ownerId}`);
    await page.getByRole('button', { name: 'Prepare to publish', exact: true }).click();
    await page.getByRole('button', { name: 'Use numbers and continue', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Private preview — sharing is off' });
    await expect(preview).toBeVisible();
    const next = preview.getByRole('button', { name: 'Review and publish', exact: true });
    await expect(next).toBeInViewport({ ratio: 1 });
    await expectTouchTarget(next);
    const previewBoard = preview.getByRole('region', { name: 'Board', exact: true });
    await expect.poll(async () => (await previewBoard.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(300);
    await expect.poll(() => preview.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await testInfo.attach('preview-visible-next-action', { body: await page.screenshot({ path: testInfo.outputPath(`preview-${viewport.width}.png`) }), contentType: 'image/png' });
    await next.focus();
    await page.keyboard.press('Enter');
    const confirmation = page.getByRole('dialog', { name: 'Publish viewer link' });
    await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  });

  test(`availability stays separate from name entry and supports keyboard selection at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installOrganizerBoard(page, { board: organizerUndrawnBoard });
    await page.goto(`/boards/${ownerId}`);
    await page.getByRole('button', { name: 'Square 2, unassigned', exact: true }).click();
    const nameSheet = page.getByRole('dialog', { name: 'Square 2', exact: true });
    await expect(nameSheet.getByRole('textbox', { name: 'Name on the board' })).toBeFocused();
    await expect(nameSheet.getByRole('combobox')).toHaveCount(0);
    await testInfo.attach('simple-name-entry', { body: await page.screenshot({ path: testInfo.outputPath(`name-entry-${viewport.width}.png`) }), contentType: 'image/png' });
    await nameSheet.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Offer squares as available', exact: true }).click();
    const board = page.getByRole('region', { name: 'Board', exact: true });
    await expect(board.getByRole('button', { name: 'Done selecting', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Square 2, unassigned', exact: true }).focus();
    await page.keyboard.press('Space');
    await board.getByRole('button', { name: 'Review 1 selected square', exact: true }).click();
    const controls = page.getByRole('group', { name: 'Offer squares as available', exact: true });
    await expect(controls.getByRole('button', { name: 'Offer 1 selected square as available', exact: true })).toBeVisible();
    await testInfo.attach('separate-availability', { body: await page.screenshot({ path: testInfo.outputPath(`availability-${viewport.width}.png`) }), contentType: 'image/png' });
    await controls.getByRole('button', { name: 'Offer 1 selected square as available', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '1 square offered as available.' })).toBeVisible();
    await expect(board.getByRole('button', { name: 'Done selecting', exact: true })).toBeFocused();
    await board.getByRole('button', { name: 'Done selecting', exact: true }).click();
    await expect(board.getByRole('button', { name: 'Select squares', exact: true })).toBeFocused();
  });
}
