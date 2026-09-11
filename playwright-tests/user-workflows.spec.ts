import { expect, test, type Page } from '@playwright/test';

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

const scheduledGame = {
  id: '401772510',
  kickoffAt: '2026-09-13T17:00:00.000Z',
  state: 'pre',
  season: 2026,
  week: 1,
  awayTeam: { abbr: 'DAL', name: 'Dallas Cowboys' },
  homeTeam: { abbr: 'WAS', name: 'Washington Commanders' },
};

const createdBoardId = '33333333-3333-4333-8333-333333333333';

/** Owner-only requests the workspace makes on every board route. */
const installOrganizerSupport = async (page: Page) => {
  await page.route('**/rest/v1/contest_entries*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  await page.route('**/api/billing/status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ tier: 'free', used: 0, allowance: 1 }),
  }));
  await page.route('**/api/nfl/games?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ games: [scheduledGame] }),
  }));
};

/** The board row the create flow lands on once /api/pools has accepted the POST. */
const installCreatedBoard = async (page: Page, boardId: string, title: string) => {
  await page.route(`**/api/pools/${boardId}/score`, (route) => route.fulfill({
    status: 402,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Publish this board to use automatic live scoring and updates.' }),
  }));
  await page.route(`**/api/pools/${boardId}`, (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, revision: 2 }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: boardId,
        share_code: 'ABCDEFGH',
        owner_id: ownerId,
        title,
        status: 'draft',
        revision: 1,
        gameExternalId: scheduledGame.id,
        kickoffAt: scheduledGame.kickoffAt,
        dates: '2026-09-13',
        leftAbbr: 'DAL',
        leftName: 'Dallas Cowboys',
        topAbbr: 'WAS',
        topName: 'Washington Commanders',
        payoutDescriptions: {},
        board: {
          leftAxis: Array(10).fill(null),
          topAxis: Array(10).fill(null),
          squares: Array.from({ length: 100 }, () => [] as string[]),
          isDynamic: false,
        },
        score: null,
        is_activated: false,
        locked: true,
        published_at: null,
        winner_history: [],
      }),
    });
  });
  await installOrganizerSupport(page);
};

const quarterScores = {
  Q1: { left: 3, top: 7 },
  Q2: { left: 7, top: 7 },
  Q3: { left: 7, top: 3 },
  Q4: { left: 0, top: 7 },
  OT: { left: 0, top: 0 },
};

test('protected routes preserve the exact destination through sign-in', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(new RegExp(`/login\\?.*returnTo=${encodeURIComponent('/dashboard').replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`));

  await page.route('**/api/nfl/games?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ games: [scheduledGame] }),
  }));
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: authStorageKey,
    value: sessionValue(),
  });
  await page.reload();

  await expect(page).toHaveURL(/\/dashboard$/);
});

test('organizer creates a board from one scheduled NFL event', async ({ page }) => {
  await installOrganizerSession(page);
  await page.route('**/api/nfl/games?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ games: [scheduledGame] }),
  }));

  let submitted: any;
  await page.route('**/api/pools', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    submitted = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        poolId: createdBoardId,
        boardId: createdBoardId,
        shareCode: 'ABCDEFGH',
        revision: 1,
      }),
    });
  });
  await installCreatedBoard(page, createdBoardId, 'Week 1 fundraiser');

  await page.goto('/create');
  await page.getByLabel('Board name').fill('Week 1 fundraiser');
  await page.getByRole('radio', { name: /DAL.*at.*WAS/i }).click();
  await page.getByRole('button', { name: 'Create board' }).click();

  // Creation lands straight in the workspace: there is no interstitial.
  await expect(page).toHaveURL(new RegExp(`/boards/${createdBoardId}$`));
  await expect(page.getByRole('main', { name: /workspace$/ })).toBeVisible();
  await expect(page.getByLabel('Board name')).toHaveValue('Week 1 fundraiser');
  expect(submitted.game.gameExternalId).toBe(scheduledGame.id);
  expect(submitted.game.kickoffAt).toBe(scheduledGame.kickoffAt);
  expect(submitted.board.squares).toHaveLength(100);
});

test('published viewer renders the board and persists its canonical square selection', async ({ page }) => {
  const squares = Array.from({ length: 100 }, () => [] as string[]);
  squares[0] = ['Ann'];
  squares[1] = ['Anna'];
  const board = {
    leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    topAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    squares,
    isDynamic: false,
    participants: [
      { id: 'participant-ann', displayName: 'Ann', publicLabel: 'AN' },
      { id: 'participant-anna', displayName: 'Anna', publicLabel: 'AN' },
    ],
  };
  const score = {
    leftScore: 17,
    topScore: 24,
    quarterScores,
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
      winner_history: [],
      payoutDescriptions: {
        Q1: 'Winner gets bragging rights',
        HALF: 'A homemade pie',
        notes: 'Organizer rules apply.',
      },
      is_activated: true,
      locked: false,
    }),
  }));
  await page.route('**/api/pools/ABCDEFGH/score', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ score, winnerHistory: [] }),
  }));

  await page.goto('/b/ABCDEFGH');
  await expect(page.getByRole('main', { name: /Published Week 1 viewer/i })).toBeVisible();
  await expect(page.getByText(/This board is not published yet/i)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Payouts' })).toBeVisible();
  await expect(page.getByText('Winner gets bragging rights')).toBeVisible();
  await expect(page.getByText('A homemade pie')).toBeVisible();
  await expect(page.getByText('GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners.')).toBeVisible();
  await page.getByRole('button', { name: /Find my squares/i }).click();
  await page.getByLabel('Name used on board').fill('ann');
  await page.getByLabel('Name used on board').press('Enter');

  await expect(page.getByText('1 square', { exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: /^Ann,/ })).toHaveClass(/(?:^|\s)ring-2 ring-inset ring-tone-cardinal(?:\s|$)/);
  await expect(page.getByRole('gridcell', { name: /^Anna,/ })).not.toHaveClass(/(?:^|\s)ring-2 ring-inset ring-tone-cardinal(?:\s|$)/);
  await expect(page.getByText(/Quarter-winner email for Ann/i)).toBeVisible();

  await page.reload();
  await expect(page.getByText('1 square', { exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: /^Ann,/ })).toHaveClass(/(?:^|\s)ring-2 ring-inset ring-tone-cardinal(?:\s|$)/);
  await expect(page.getByRole('gridcell', { name: /^Anna,/ })).not.toHaveClass(/(?:^|\s)ring-2 ring-inset ring-tone-cardinal(?:\s|$)/);
  await expect(page.getByText(/Quarter-winner email for Ann/i)).toBeVisible();
});

test('invalid public links show an explicit unavailable state', async ({ page }) => {
  await page.route('**/api/pools/BADLINK2', (route) => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'This board is unavailable or has not been published.' }),
  }));

  await page.goto('/b/BADLINK2');
  await expect(page.getByRole('alert')).toContainText('This GridOne board is unavailable.');
});

test('draft organizer preview opens the private viewer without sharing the board', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installOrganizerSession(page);
  const boardId = ownerId;
  let automaticScoreRequests = 0;
  const board = {
    leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    topAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    squares: Array.from({ length: 100 }, (_, index) => (index === 0 ? ['Ann'] : ([] as string[]))),
    isDynamic: false,
  };
  await page.route(`**/api/pools/${boardId}`, (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, revision: 2 }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: boardId,
        share_code: 'ABCDEFGH',
        owner_id: ownerId,
        title: 'QA draft board',
        status: 'draft',
        revision: 1,
        meta: 'Preview verification',
        gameExternalId: scheduledGame.id,
        kickoffAt: scheduledGame.kickoffAt,
        dates: '2026-09-13',
        leftAbbr: 'DAL',
        leftName: 'Dallas Cowboys',
        topAbbr: 'WAS',
        topName: 'Washington Commanders',
        payoutDescriptions: {},
        board,
        score: null,
        is_activated: false,
        locked: true,
        published_at: null,
        winner_history: [],
      }),
    });
  });
  await page.route(`**/api/pools/${boardId}/score`, (route) => {
    automaticScoreRequests += 1;
    return route.fulfill({
      status: 402,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Publish this board to use automatic live scoring and updates.' }),
    });
  });
  await installOrganizerSupport(page);

  await page.goto(`/boards/${boardId}`);
  await expect(page.getByRole('main', { name: 'QA draft board workspace' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __lenis?: unknown }).__lenis)).toBeUndefined();
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  )).toBe(true);

  const beforePageDown = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('PageDown');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(beforePageDown);

  await page.getByRole('button', { name: 'Preview', exact: true }).click();

  const preview = page.getByRole('dialog', { name: 'Private preview — sharing is off' });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('region', { name: /QA draft board viewer/i })).toBeVisible();
  await expect(preview.getByRole('gridcell', { name: /^Unassigned/i })).toHaveCount(99);
  await expect(preview.getByRole('button', { name: 'Review and publish' })).toBeEnabled();
  expect(automaticScoreRequests).toBe(0);
});

test('organizer flushes the latest draft before publishing the viewer link', async ({ page }) => {
  await installOrganizerSession(page);
  const boardId = ownerId;
  const fullBoard = {
    leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    topAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    squares: Array.from({ length: 100 }, () => ['Mora']),
    isDynamic: false,
  };
  const score = {
    leftScore: 0,
    topScore: 0,
    quarterScores: {
      Q1: { left: 0, top: 0 },
      Q2: { left: 0, top: 0 },
      Q3: { left: 0, top: 0 },
      Q4: { left: 0, top: 0 },
      OT: { left: 0, top: 0 },
    },
    clock: '',
    period: 0,
    state: 'pre',
    detail: 'Scheduled',
    isOvertime: false,
    sourceName: 'ESPN',
    retrievedAt: '2026-09-01T00:00:00.000Z',
    staleAfter: '2099-09-01T00:00:00.000Z',
    freshness: 'fresh',
  };
  const requestOrder: string[] = [];
  let savedTitle = '';

  await page.route(`**/api/pools/${boardId}`, async (route) => {
    if (route.request().method() === 'PUT') {
      requestOrder.push('save');
      const payload = route.request().postDataJSON();
      savedTitle = payload.game.title;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, revision: 2 }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: boardId,
        share_code: 'ABCDEFGH',
        owner_id: ownerId,
        title: 'Original title',
        status: 'ready',
        revision: 1,
        meta: 'Fundraiser',
        gameExternalId: scheduledGame.id,
        kickoffAt: scheduledGame.kickoffAt,
        dates: '2026-09-13',
        leftAbbr: 'DAL',
        leftName: 'Dallas Cowboys',
        topAbbr: 'WAS',
        topName: 'Washington Commanders',
        payoutDescriptions: {},
        board: fullBoard,
        score,
        is_activated: true,
        locked: false,
        published_at: null,
        winner_history: [],
      }),
    });
  });
  await page.route(`**/api/pools/${boardId}/score`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ score, winnerHistory: [] }),
  }));
  await page.route(`**/api/pools/${boardId}/publish`, (route) => {
    requestOrder.push('publish');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ published: true, shareCode: 'ABCDEFGH', viewerUrl: '/b/ABCDEFGH', revision: 3, tier: 'free', used: 1, allowance: 1 }),
    });
  });
  await installOrganizerSupport(page);

  await page.goto(`/boards/${boardId}`);
  await expect(page.getByRole('main', { name: 'Original title workspace' })).toBeVisible();
  await page.getByLabel('Board name').fill('Latest title');
  await page.getByLabel('Board name').press('Enter');

  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.getByRole('button', { name: 'Review and publish' }).click();
  const publishDialog = page.getByRole('dialog', { name: 'Publish viewer link' });
  await expect(publishDialog).toBeVisible();
  await publishDialog.getByRole('button', { name: 'Publish viewer link' }).click();

  await expect.poll(() => requestOrder).toEqual(['save', 'publish']);
  expect(savedTitle).toBe('Latest title');
});
