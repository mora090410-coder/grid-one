import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock, fetchScheduledGameByIdMock, fetchScheduledGamesMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  fetchScheduledGameByIdMock: vi.fn(),
  fetchScheduledGamesMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('../functions/_lib/espnNfl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../functions/_lib/espnNfl')>();
  return {
    ...actual,
    fetchScheduledGameById: fetchScheduledGameByIdMock,
    fetchScheduledGames: fetchScheduledGamesMock,
  };
});

import { onRequestPost } from '../functions/api/pools';
import {
  canonicalizeUpdatedGame,
  matchupDiffers,
  onRequestGet,
  onRequestPut,
} from '../functions/api/pools/[id]';

const scheduledGame = {
  id: '401772510',
  kickoffAt: '2026-09-13T17:00:00.000Z',
  state: 'pre' as const,
  season: 2026,
  week: 1,
  awayTeam: { abbr: 'DAL', name: 'Dallas Cowboys' },
  homeTeam: { abbr: 'WAS', name: 'Washington Commanders' },
};

const env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  PUBLIC_SITE_URL: 'https://getgridone.com',
};

const authClient = (overrides: Record<string, unknown> = {}) => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
      error: null,
    }),
  },
  ...overrides,
});

describe('scheduled-game persistence', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    fetchScheduledGameByIdMock.mockReset();
    fetchScheduledGamesMock.mockReset();
  });

  it('rejects board creation without a scheduled game ID', async () => {
    const request = new Request('https://getgridone.com/api/pools', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        game: { title: 'Week 1 board' },
        board: { squares: Array.from({ length: 100 }, () => []) },
      }),
    });

    const response = await onRequestPost({ request, env });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/choose a scheduled NFL game/i),
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('rejects an event ID that the server cannot resolve', async () => {
    createClientMock.mockReturnValue(authClient());
    fetchScheduledGameByIdMock.mockResolvedValue(null);
    const request = new Request('https://getgridone.com/api/pools', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        game: { title: 'Week 1 board', gameExternalId: '999999999' },
        board: { squares: Array.from({ length: 100 }, () => []) },
      }),
    });

    const response = await onRequestPost({ request, env });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/could not be verified/i),
    });
  });

  it('creates completed-game test boards with canonical identity under the 2026 launch season', async () => {
    const completedGame = { ...scheduledGame, season: 2025, state: 'post' as const };
    fetchScheduledGameByIdMock.mockResolvedValue(completedGame);
    fetchScheduledGamesMock.mockResolvedValue([completedGame]);
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: '11111111-1111-4111-8111-111111111111',
            share_code: 'ABCDEFGH',
            revision: 1,
          },
          error: null,
        }),
      }),
    });
    createClientMock.mockReturnValue(authClient({
      from: vi.fn().mockReturnValue({ insert }),
    }));
    const request = new Request('https://getgridone.com/api/pools', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scoreTestMode: true,
        game: {
          title: 'Completed score test',
          gameExternalId: completedGame.id,
          dates: '2026-07-28',
          leftAbbr: 'CHI',
          topAbbr: 'GB',
        },
        board: { squares: Array.from({ length: 100 }, () => []) },
      }),
    });

    const response = await onRequestPost({ request, env });

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      season_year: 2026,
      game_external_id: completedGame.id,
      game_starts_at: completedGame.kickoffAt,
      side_team_abbr: completedGame.awayTeam.abbr,
      top_team_abbr: completedGame.homeTeam.abbr,
      settings: expect.objectContaining({
        gameSeason: 2025,
        dates: '2026-09-13',
        leftAbbr: completedGame.awayTeam.abbr,
        topAbbr: completedGame.homeTeam.abbr,
      }),
    }));
  });

  it('rejects completed games outside the bounded score-test path', async () => {
    const completedGame = { ...scheduledGame, state: 'post' as const };
    createClientMock.mockReturnValue(authClient());
    fetchScheduledGameByIdMock.mockResolvedValue(completedGame);
    const request = new Request('https://getgridone.com/api/pools', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        game: { title: 'Past game', gameExternalId: completedGame.id },
        board: { squares: Array.from({ length: 100 }, () => []) },
      }),
    });

    const response = await onRequestPost({ request, env });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/upcoming NFL game/i),
    });
    expect(fetchScheduledGamesMock).not.toHaveBeenCalled();
  });

  it('limits score-test creation to the five most recent completed games', async () => {
    const completedGame = { ...scheduledGame, state: 'post' as const };
    createClientMock.mockReturnValue(authClient());
    fetchScheduledGameByIdMock.mockResolvedValue(completedGame);
    fetchScheduledGamesMock.mockResolvedValue([{ ...completedGame, id: 'different-event' }]);
    const request = new Request('https://getgridone.com/api/pools', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scoreTestMode: true,
        game: { title: 'Past game', gameExternalId: completedGame.id },
        board: { squares: Array.from({ length: 100 }, () => []) },
      }),
    });

    const response = await onRequestPost({ request, env });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/five most recent/i),
    });
  });

  it('overrides spoofed teams and dates with canonical event values', () => {
    const canonical = canonicalizeUpdatedGame({
      title: 'Week 1 board',
      gameExternalId: '401772510',
      dates: '2026-07-28',
      leftAbbr: 'CHI',
      leftName: 'Chicago Bears',
      topAbbr: 'GB',
      topName: 'Green Bay Packers',
    }, scheduledGame);

    expect(canonical).toMatchObject({
      gameExternalId: scheduledGame.id,
      gameStartsAt: scheduledGame.kickoffAt,
      dates: '2026-09-13',
      leftAbbr: 'DAL',
      leftName: 'Dallas Cowboys',
      topAbbr: 'WAS',
      topName: 'Washington Commanders',
    });
  });

  it('treats any canonical event identity difference as a matchup change', () => {
    expect(matchupDiffers({
      game_external_id: scheduledGame.id,
      game_starts_at: '2026-09-13T12:00:00-05:00',
      season_year: scheduledGame.season,
      side_team_name: scheduledGame.awayTeam.name,
      side_team_abbr: scheduledGame.awayTeam.abbr,
      top_team_name: scheduledGame.homeTeam.name,
      top_team_abbr: scheduledGame.homeTeam.abbr,
    }, scheduledGame)).toBe(false);

    expect(matchupDiffers({
      game_external_id: '401772511',
      game_starts_at: scheduledGame.kickoffAt,
      season_year: scheduledGame.season,
      side_team_name: scheduledGame.awayTeam.name,
      side_team_abbr: scheduledGame.awayTeam.abbr,
      top_team_name: scheduledGame.homeTeam.name,
      top_team_abbr: scheduledGame.homeTeam.abbr,
    }, scheduledGame)).toBe(true);
  });

  it('returns 409 before changing a published matchup', async () => {
    fetchScheduledGameByIdMock.mockResolvedValue(scheduledGame);
    const currentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          published_at: '2026-08-01T00:00:00.000Z',
          status: 'published',
          board_data: { squares: [] },
          settings: {},
          game_external_id: '401772511',
          game_starts_at: '2026-09-14T00:00:00.000Z',
          season_year: 2026,
          side_team_name: 'Other Away',
          side_team_abbr: 'CHI',
          top_team_name: 'Other Home',
          top_team_abbr: 'GB',
        },
        error: null,
      }),
    };
    createClientMock.mockReturnValue(authClient({
      from: vi.fn().mockReturnValue(currentQuery),
    }));
    const request = new Request('https://getgridone.com/api/pools/11111111-1111-4111-8111-111111111111', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        revision: 3,
        game: { title: 'Published', gameExternalId: scheduledGame.id },
      }),
    });

    const response = await onRequestPut({
      request,
      env,
      params: { id: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'MATCHUP_LOCKED' });
  });

  it('sends only canonical matchup values to the atomic draft-update RPC', async () => {
    fetchScheduledGameByIdMock.mockResolvedValue(scheduledGame);
    const currentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          published_at: null,
          status: 'draft',
          board_data: { squares: [] },
          settings: {},
          game_external_id: null,
          game_starts_at: null,
          season_year: 2026,
          side_team_name: null,
          side_team_abbr: null,
          top_team_name: null,
          top_team_abbr: null,
        },
        error: null,
      }),
    };
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        next_revision: 4,
        contest_updated_at: '2026-07-29T01:00:00.000Z',
        matchup_changed: true,
      }],
      error: null,
    });
    createClientMock.mockReturnValue(authClient({
      from: vi.fn().mockReturnValue(currentQuery),
      rpc,
    }));
    const request = new Request('https://getgridone.com/api/pools/11111111-1111-4111-8111-111111111111', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        revision: 3,
        game: {
          title: 'Draft',
          gameExternalId: scheduledGame.id,
          dates: '2026-07-28',
          leftAbbr: 'CHI',
          topAbbr: 'GB',
        },
      }),
    });

    const response = await onRequestPut({
      request,
      env,
      params: { id: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('gridone_update_draft_matchup', expect.objectContaining({
      p_game_external_id: scheduledGame.id,
      p_game_starts_at: scheduledGame.kickoffAt,
      p_season_year: 2026,
      p_side_team_name: scheduledGame.awayTeam.name,
      p_side_team_abbr: scheduledGame.awayTeam.abbr,
      p_top_team_name: scheduledGame.homeTeam.name,
      p_top_team_abbr: scheduledGame.homeTeam.abbr,
      p_settings: expect.objectContaining({
        dates: '2026-09-13',
        leftAbbr: 'DAL',
        topAbbr: 'WAS',
      }),
    }));
    await expect(response.json()).resolves.toMatchObject({
      revision: 4,
      matchupChanged: true,
    });
  });

  it('returns the latest revision so an explicit organizer retry can recover', async () => {
    const currentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          published_at: null,
          status: 'draft',
          revision: 7,
          title: 'Server draft',
          payout_labels: {},
          board_data: { squares: [] },
          settings: {},
          game_external_id: scheduledGame.id,
          game_starts_at: scheduledGame.kickoffAt,
          season_year: 2026,
          side_team_name: scheduledGame.awayTeam.name,
          side_team_abbr: scheduledGame.awayTeam.abbr,
          top_team_name: scheduledGame.homeTeam.name,
          top_team_abbr: scheduledGame.homeTeam.abbr,
        },
        error: null,
      }),
    };
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    createClientMock.mockReturnValue(authClient({
      from: vi.fn().mockReturnValue(currentQuery),
      rpc,
    }));
    const request = new Request('https://getgridone.com/api/pools/11111111-1111-4111-8111-111111111111', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        revision: 6,
        game: { title: 'Local draft', gameExternalId: scheduledGame.id },
      }),
    });

    const response = await onRequestPut({
      request,
      env,
      params: { id: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'REVISION_CONFLICT',
      currentRevision: 7,
    });
  });

  it('keeps provider season metadata without changing the 2026 launch entitlement season', () => {
    const completedGame = { ...scheduledGame, season: 2025, state: 'post' as const };
    const canonical = canonicalizeUpdatedGame({
      title: 'Completed score test',
      gameExternalId: completedGame.id,
    }, completedGame);

    expect(canonical.gameSeason).toBe(2025);
    expect(matchupDiffers({
      game_external_id: completedGame.id,
      game_starts_at: completedGame.kickoffAt,
      season_year: 2026,
      side_team_name: completedGame.awayTeam.name,
      side_team_abbr: completedGame.awayTeam.abbr,
      top_team_name: completedGame.homeTeam.name,
      top_team_abbr: completedGame.homeTeam.abbr,
    }, completedGame)).toBe(false);
  });

  it('reuses stored canonical identity instead of calling ESPN on routine autosaves', async () => {
    const currentQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          published_at: null,
          status: 'draft',
          board_data: { squares: [] },
          settings: { gameSeason: 2025, gameWeek: 'Postseason 4' },
          game_external_id: scheduledGame.id,
          game_starts_at: scheduledGame.kickoffAt,
          season_year: scheduledGame.season,
          side_team_name: scheduledGame.awayTeam.name,
          side_team_abbr: scheduledGame.awayTeam.abbr,
          top_team_name: scheduledGame.homeTeam.name,
          top_team_abbr: scheduledGame.homeTeam.abbr,
        },
        error: null,
      }),
    };
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        next_revision: 5,
        contest_updated_at: '2026-07-29T01:00:00.000Z',
        matchup_changed: false,
      }],
      error: null,
    });
    createClientMock.mockReturnValue(authClient({
      from: vi.fn().mockReturnValue(currentQuery),
      rpc,
    }));
    const request = new Request('https://getgridone.com/api/pools/11111111-1111-4111-8111-111111111111', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        revision: 4,
        game: {
          title: 'Routine autosave',
          gameExternalId: scheduledGame.id,
          leftAbbr: 'SPOOFED',
        },
        board: { squares: [] },
      }),
    });

    const response = await onRequestPut({
      request,
      env,
      params: { id: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.status).toBe(200);
    expect(fetchScheduledGameByIdMock).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('gridone_update_draft_matchup', expect.objectContaining({
      p_game_external_id: scheduledGame.id,
      p_settings: expect.objectContaining({
        leftAbbr: scheduledGame.awayTeam.abbr,
        topAbbr: scheduledGame.homeTeam.abbr,
        gameSeason: 2025,
        gameWeek: 'Postseason 4',
      }),
    }));
  });

  it('migration locks published identity and transactionally clears obsolete score state', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/009_scheduled_game_identity.sql'),
      'utf8',
    );

    expect(migration).toContain('gridone_protect_published_game_identity');
    expect(migration).toContain('Published game identity is locked');
    expect(migration).toContain('gridone_update_draft_matchup');
    expect(migration).toContain('DELETE FROM public.milestone_resolutions');
    expect(migration).toContain('DELETE FROM public.score_snapshots');
    expect(migration).toContain('DELETE FROM public.contest_score_state');
    expect(migration).toContain(') TO service_role;');
    expect(migration).not.toContain(') TO authenticated;');
  });

  it('returns a published viewer snapshot as available with normalized payouts', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          share_code: 'ABCDEFGH',
          revision: 8,
          board_title: 'Published board',
          matchup: {
            sideTeamAbbr: 'DAL',
            sideTeamName: 'Dallas Cowboys',
            topTeamAbbr: 'WAS',
            topTeamName: 'Washington Commanders',
            gameExternalId: scheduledGame.id,
            gameStartsAt: scheduledGame.kickoffAt,
          },
          board: { squares: Array.from({ length: 100 }, () => ['Mora']) },
          score: null,
          winner_history: [],
          payout_labels: { Q1: 50, Q2: 100, Q3: 50, Final: 300 },
          published_at: '2026-09-01T00:00:00.000Z',
          updated_at: '2026-09-01T00:00:00.000Z',
        },
        error: null,
      }),
    };
    createClientMock.mockReturnValue(authClient({
      from: vi.fn().mockReturnValue(query),
    }));

    const response = await onRequestGet({
      request: new Request('https://getgridone.com/api/pools/ABCDEFGH'),
      env,
      params: { id: 'ABCDEFGH' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      locked: false,
      gameExternalId: scheduledGame.id,
      payouts: { Q1: 50, Q2: 100, Q3: 50, Final: 300 },
    });
  });

  it('restores authoritative manual scoring mode and current snapshot for the owner', async () => {
    const rowsByTable: Record<string, unknown> = {
      contests: {
        id: '11111111-1111-4111-8111-111111111111',
        share_code: 'ABCDEFGH',
        owner_id: '22222222-2222-4222-8222-222222222222',
        title: 'Manual board',
        status: 'draft',
        revision: 4,
        settings: { useManualScores: false },
        board_data: { squares: Array.from({ length: 100 }, () => []) },
        payout_labels: { Q1: 25 },
        published_at: null,
        game_external_id: scheduledGame.id,
        game_starts_at: scheduledGame.kickoffAt,
        side_team_name: scheduledGame.awayTeam.name,
        side_team_abbr: scheduledGame.awayTeam.abbr,
        top_team_name: scheduledGame.homeTeam.name,
        top_team_abbr: scheduledGame.homeTeam.abbr,
        board_activations: [],
      },
      public_board_snapshots: null,
      contest_score_state: {
        scoring_mode: 'manual',
        current_snapshot_id: '33333333-3333-4333-8333-333333333333',
      },
      score_snapshots: {
        source_mode: 'manual',
        game_state: 'in',
        period: 2,
        side_score: 10,
        top_score: 7,
        quarter_scores: {
          Q1: { left: 7, top: 7 },
          Q2: { left: 3, top: 0 },
          Q3: { left: 0, top: 0 },
          Q4: { left: 0, top: 0 },
          OT: { left: 0, top: 0 },
        },
        clock: '4:31',
        detail: 'Organizer-entered score',
        source_name: 'Organizer',
        source_observed_at: '2026-09-13T18:00:00.000Z',
        retrieved_at: '2026-09-13T18:00:00.000Z',
        stale_after: '2027-09-13T18:00:00.000Z',
      },
    };
    const from = vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: rowsByTable[table],
        error: null,
      }),
    }));
    createClientMock.mockReturnValue(authClient({ from }));

    const response = await onRequestGet({
      request: new Request(
        'https://getgridone.com/api/pools/11111111-1111-4111-8111-111111111111',
        { headers: { Authorization: 'Bearer token' } },
      ),
      env,
      params: { id: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      useManualScores: true,
      manualPeriod: 2,
      manualGameState: 'in',
      manualLeftScore: 10,
      manualTopScore: 7,
      manualQuarterScores: {
        Q1: { left: 7, top: 7 },
        Q2: { left: 3, top: 0 },
      },
      score: {
        isManual: true,
        leftScore: 10,
        topScore: 7,
      },
    });
  });

  it('publishes contest, assignments, and viewer snapshot through one database transaction', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/010_atomic_board_publish.sql'),
      'utf8',
    );

    expect(migration).toContain('gridone_publish_board');
    expect(migration).toContain('UPDATE public.contests');
    expect(migration).toContain('INSERT INTO public.square_assignments');
    expect(migration).toContain('INSERT INTO public.public_board_snapshots');
    expect(migration).toContain(') TO service_role;');
    expect(migration).not.toContain(') TO authenticated;');
  });
});
