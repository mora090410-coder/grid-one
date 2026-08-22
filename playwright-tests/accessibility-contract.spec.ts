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

const installOrganizerBoard = async (page: Page, options: { board?: typeof organizerDraftBoard; revision?: number } = {}) => {
  await installOrganizerSession(page);
  await page.route(`**/api/pools/${ownerId}`, async (route) => {
    if (route.request().method() === 'PUT') {
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
        score: null,
        is_activated: false,
        locked: false,
        published_at: null,
        winner_history: [],
        pending_milestones: [],
      }),
    });
  });
  await page.route(`**/api/pools/${ownerId}/score`, (route) => route.fulfill({
    status: 402,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Publish this board to use automatic live scoring and updates.' }),
  }));
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
        if (element.closest('.gridone-board-frame, .gridone-viewer-board-viewport, .gdh-board-viewport')) return false;
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
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByRole('alert')).toContainText('Passwords do not match');
    await expect(page.getByLabel('Confirm Password')).toHaveAttribute('aria-describedby', 'auth-error');
  });

  test('demo and published routes expose semantic headings and synthetic/demo identity', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByRole('heading', { level: 1, name: /Demo: Super Bowl LIX/i })).toBeVisible();
    await expect(page.getByText(/demo/i).first()).toBeVisible();

    await installPublishedBoard(page);
    await page.goto('/b/ABCDEFGH');
    await expect(page.getByRole('heading', { level: 1, name: /Published Week 1/i })).toBeVisible();
    await expect(page.getByRole('main', { name: /Published Week 1 game day/i })).toBeVisible();
  });

  test('homepage exposes a semantic level-one product heading', async ({ page }) => {
    test.fixme(true, 'Owner: Slice 12 A1 homepage. Expected: root route has exactly one product H1 naming GridOne and the football-squares fundraiser board promise. Remove when homepage_v2 replaces FilmLanding for this contract.');
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('representative public controls have visible focus and 44 by 44 geometry', async ({ page }) => {
    await page.goto('/');
    for (const control of [
      page.getByRole('button', { name: 'Build your board — free' }),
      page.getByRole('link', { name: 'See a live board' }),
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
    test.fixme(true, 'Owner: Slice 12 A1 homepage. Expected: signed-out header Sign in is a semantic control with a minimum 44 by 44 CSS-pixel hit target. Remove when homepage_v2 replaces FilmLanding header.');
    await page.goto('/');
    await expectTouchTarget(page.getByRole('button', { name: 'Sign in' }).first());
  });

  test('organizer Fill route exposes an empty or partial assignment grid without credentials beyond mocked owner auth', async ({ page }) => {
    await installOrganizerBoard(page);
    await page.goto(`/boards/${ownerId}`);
    await page.getByRole('button', { name: 'Fill 99 squares open' }).click();
    await expect(page.getByRole('heading', { name: 'Grid Editor' })).toBeVisible();
    await expect(page.getByText('Assign purchaser names, then run one random number draw. Publishing locks both axes.')).toBeVisible();
    await expect(page.getByLabel('Label to apply')).toBeFocused();
    await expect(page.getByRole('button', { name: /Square 1, assigned to Ann/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Square 2, unassigned/i })).toBeVisible();
  });

  test('organizer Reconcile advisory items have an explicit v2 contract owner', async ({ page }) => {
    test.fixme(true, 'Owner: Slice 10 organizer Reconcile checklist. Expected: advisory items for open squares, unpaid/unknown status, seller gaps, and payout/rules gaps are grouped as advisories, not blockers; hard blockers stay distinct; primary action is Continue anyway when only advisories remain. Remove when organizer_v2 Reconcile ships behind its flag.');
    await page.goto(`/boards/${ownerId}`);
  });

  test('organizer Draw open-square confirmation has accessible warning semantics and safe focus path', async ({ page }) => {
    await installOrganizerBoard(page);
    await page.goto(`/boards/${ownerId}`);
    await page.getByRole('button', { name: 'Fill 99 squares open' }).click();
    await page.getByRole('button', { name: 'Draw numbers' }).click();
    const confirmation = page.getByRole('group', { name: /99 squares are open\. Draw anyway\?/i });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText('Open squares stay marked OPEN');
    await expect(confirmation.getByRole('button', { name: 'Keep assigning' })).toBeVisible();
    await expect(confirmation.getByRole('button', { name: 'Draw with 99 OPEN' })).toBeVisible();
  });

  test('organizer Preview and Go Live dialogs have explicit v2 contract owners', async ({ page }) => {
    test.fixme(true, 'Owner: Slice 10 organizer Preview/Publish. Expected: private preview is entered by Review and publish, publication opens a role=dialog aria-modal confirmation summarizing board, matchup, kickoff, assigned/open counts, axis digits, public/private boundary, tier allowance, and safe cancel focus-return; success shows copy link, QR, open viewer, and game-day controls. Remove when organizer_v2 Preview and Go Live dialog flow ships.');
    await page.goto(`/boards/${ownerId}`);
  });

  test('organizer save conflict or error blocks progression with a live recoverable status', async ({ page }) => {
    test.fixme(true, 'Owner: Slice 10 organizer shell backed by Slice 9 draftSaveModel. Expected: save_failed and conflicted states use role=status or alert as severity requires, name Retry/Reload latest board recovery, preserve local work, and disable Draw/Preview/Publish progression until recovery. Remove when organizer_v2 save-state header and conflict UI ship.');
    await page.goto(`/boards/${ownerId}`);
  });

  test('viewer unpersonalized and personalized modes preserve structural semantics', async ({ page }) => {
    await installPublishedBoard(page);
    await page.goto('/b/ABCDEFGH');
    await expect(page.getByRole('main', { name: /Published Week 1 game day/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Find my squares/i }).first()).toBeVisible();
    await expect(page.getByText(/Select the name used by the organizer/i)).toBeVisible();
    await expect(page.getByText(/Quarter-winner email for Ann/i)).toHaveCount(0);

    await page.getByRole('button', { name: /Find my squares/i }).first().click();
    await page.getByLabel('Name used on board').fill('Ann');
    await page.getByLabel('Name used on board').press('Enter');
    await expect(page.getByText('1 square', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose another name' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear Ann' })).toBeVisible();
    await expect(page.getByText(/Quarter-winner email for Ann/i)).toBeVisible();
  });

  test('viewer C1 first-viewport, stale/offline scenario copy, and Final-record hierarchy have an explicit owner', async ({ page }) => {
    test.fixme(true, 'Owner: Slice 6 viewer. Expected: unpersonalized 390x844 first viewport shows board identity, score authority/freshness, Score updates about every minute, and Find my squares before payouts/rules; personalized mode shows selected name/count, coordinate/digit summary, View on board, personal status, matching next-score or explicit none before notification form; stale/offline scenarios say Using the last known score checked [time]; Final removes future-score scenarios and replaces them with the Final record. Remove when viewer_v2 C1 shell ships behind its flag.');
    await page.goto('/b/ABCDEFGH');
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
      await expect(page.getByText('Score updates about every minute')).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'Results pending confirmation' })).toBeVisible();
    await expect(page.getByText('Q3 result pending confirmation')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Resolved winners' })).toBeVisible();
    await expect(page.getByText('Open square —')).toBeVisible();
    await expect(page.getByText('Corrected result · Official final score corrected')).toBeVisible();
  });

  test('find-my-squares dialog keeps focus inside, closes, and returns focus', async ({ page }) => {
    await page.goto('/demo');
    const trigger = page.getByRole('button', { name: /Find my squares/i });
    await expectTouchTarget(trigger);
    await trigger.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'Find my squares' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
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
    await page.goto('/b/ABCDEFGH?viewer_v2=true');
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
      await expect(page.getByRole('main', { name: /Published Week 1 game day/i })).toBeVisible();
      await expectNoPageOverflowExceptBoardViewport(page);
    }
  });

  test('reduced-motion keeps public content and state reachable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2, name: 'The board watches the game' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Build your board — free' })).toBeVisible();
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
