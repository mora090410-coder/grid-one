import type { Page } from '@playwright/test';

/**
 * Minimal organizer route mocks, copied from `organizer.spec.ts` so the axe
 * sweep can reach `/dashboard`, `/create`, and the draft workspace without the
 * functions server or a live Supabase project. The specs that already own these
 * helpers keep their local copies; only `axe.spec.ts` imports this module.
 */

const authStorageKey = 'sb-illqymckwqiawdwxhwcy-auth-token';

export const ownerId = '11111111-1111-4111-8111-111111111111';
export const boardId = '22222222-2222-4222-8222-222222222222';

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
    created_at: '2026-08-22T00:00:00.000Z',
  },
});

export const scheduledGame = {
  id: '401772510',
  kickoffAt: '2026-09-13T17:00:00.000Z',
  state: 'pre',
  season: 2026,
  week: 1,
  awayTeam: { abbr: 'DAL', name: 'Dallas Cowboys' },
  homeTeam: { abbr: 'WAS', name: 'Washington Commanders' },
};

/** Seeds a signed-in organizer session before the app boots. */
export const installOrganizerSession = async (page: Page) => {
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
  }, { key: authStorageKey, value: sessionValue() });
};

/** Owner-only requests every authenticated organizer route makes. */
export const installOrganizerSupport = async (page: Page) => {
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

/** The draft board row the workspace loads at `/boards/:id`. */
export const installOrganizerBoard = async (page: Page) => {
  await installOrganizerSession(page);

  const squares = Array.from({ length: 100 }, (_, index) => (index === 0 ? ['Ava'] : ([] as string[])));
  const board = {
    leftAxis: Array(10).fill(null),
    topAxis: Array(10).fill(null),
    squares,
    isDynamic: false,
    allowOpenSquares: true,
    participants: [{ id: 'p1', displayName: 'Ava', publicLabel: 'Ava' }],
  };

  await page.route(`**/api/pools/${boardId}/score`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ score: null, winnerHistory: [] }),
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
        share_code: 'SHARE123',
        owner_id: ownerId,
        title: 'Parkside browser board',
        revision: 1,
        meta: 'Parkside fundraiser',
        gameExternalId: scheduledGame.id,
        kickoffAt: scheduledGame.kickoffAt,
        dates: '2026-09-13',
        leftAbbr: 'DAL',
        leftName: 'Dallas Cowboys',
        topAbbr: 'WAS',
        topName: 'Washington Commanders',
        payoutDescriptions: {},
        board,
        is_activated: false,
        locked: true,
        published_at: null,
        winner_history: [],
        pending_milestones: [],
        notification_delivery_issues: [],
      }),
    });
  });
  await installOrganizerSupport(page);
};

/** The dashboard board list. */
export const installOrganizerContests = async (page: Page) => {
  await page.route('**/rest/v1/contests*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      id: boardId,
      title: 'Parkside browser board',
      created_at: '2026-08-22T00:00:00.000Z',
      settings: { leftAbbr: 'DAL', topAbbr: 'WAS' },
      board_data: {
        leftAxis: Array(10).fill(null),
        topAxis: Array(10).fill(null),
        squares: Array.from({ length: 100 }, (_, index) => (index === 0 ? ['Ava'] : [])),
      },
      published_at: null,
      board_activations: [],
    }]),
  }));
};
