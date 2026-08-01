import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLiveScoreboard } from '../functions/_lib/espnNfl';
import { providerScoreFromEspnSnapshot } from '../functions/_lib/scoreRefresh';
import { onRequestPost as refreshScores } from '../functions/api/scores/refresh';
import { regulationEspnSummary } from './fixtures/espnNfl.fixture';

const mocks = vi.hoisted(() => {
  const clients: any[] = [];
  const createClient = vi.fn(() => {
    const client = clients.shift();
    if (!client) throw new Error('No scripted Supabase client remains.');
    return client;
  });
  return { clients, createClient };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

const scoreboardEvent = regulationEspnSummary.header;

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

describe('fetchLiveScoreboard', () => {
  it('fetches the scoreboard once and normalizes every parseable event', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      events: [scoreboardEvent, { junk: true }],
    }));

    const result = await fetchLiveScoreboard(fetchImpl as any);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.games.size).toBe(1);
    const entry = result.games.get('401000001');
    expect(entry?.snapshot.state).toBe('post');
    expect(entry?.snapshot.homeTeam.abbr).toBe('WAS');
    expect(entry?.snapshot.awayTeam.abbr).toBe('DAL');
    expect(entry?.snapshot.homeTeam.score).toBe(27);
    expect(entry?.snapshot.awayTeam.score).toBe(24);
  });

  it('treats an event-less payload as a provider failure', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ nope: true }));
    await expect(fetchLiveScoreboard(fetchImpl as any)).rejects.toThrow(/did not contain events/);
  });
});

describe('providerScoreFromEspnSnapshot identity guard', () => {
  const contest = {
    id: 'contest-1',
    game_external_id: '401000001',
    game_starts_at: '2025-09-28T20:25:00.000Z',
    side_team_abbr: 'DAL',
    top_team_abbr: 'WSH',
  };

  it('accepts a matching event and maps away->side, home->top', async () => {
    const { games } = await fetchLiveScoreboard(async () => jsonResponse({ events: [scoreboardEvent] }));
    const entry = games.get('401000001')!;
    const provider = providerScoreFromEspnSnapshot(contest, entry.snapshot, entry.rawEvent);
    expect(provider.score.leftScore).toBe(24);
    expect(provider.score.topScore).toBe(27);
    expect(provider.score.state).toBe('post');
  });

  it('rejects a payload for a different board', async () => {
    const { games } = await fetchLiveScoreboard(async () => jsonResponse({ events: [scoreboardEvent] }));
    const entry = games.get('401000001')!;
    expect(() => providerScoreFromEspnSnapshot(
      { ...contest, side_team_abbr: 'PHI' },
      entry.snapshot,
      entry.rawEvent,
    )).toThrow(/different NFL game/);
  });
});

type AdminScript = {
  claimSlot?: boolean;
  contests?: any[];
};

const buildAdmin = (script: AdminScript) => {
  const rpcCalls: Array<{ name: string; args: any }> = [];
  const rpc = vi.fn(async (name: string, args: any) => {
    rpcCalls.push({ name, args });
    if (name === 'gridone_claim_scheduler_slot') return { data: script.claimSlot !== false, error: null };
    if (name === 'gridone_acquire_score_refresh_lease_v2') {
      return {
        data: [{
          acquired: true,
          authority_generation: 1,
          refresh_sequence: 1,
          refresh_started_at: new Date().toISOString(),
        }],
        error: null,
      };
    }
    if (name === 'gridone_promote_score_snapshot') return { data: true, error: null };
    return { data: null, error: null };
  });
  const from = vi.fn((table: string) => {
    if (table === 'contests') {
      const chain: any = {
        select: vi.fn(() => chain),
        not: vi.fn(() => chain),
        gte: vi.fn(() => chain),
        lte: vi.fn(async () => ({ data: script.contests || [], error: null })),
      };
      return chain;
    }
    if (table === 'contest_score_state') {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({ data: { current_snapshot_id: null }, error: null })),
      };
      return chain;
    }
    if (table === 'score_snapshots') {
      const chain: any = {
        insert: vi.fn(() => chain),
        select: vi.fn(() => chain),
        single: vi.fn(async () => ({ data: { id: `snapshot-${Math.random()}` }, error: null })),
      };
      return chain;
    }
    if (table === 'score_provider_payloads') {
      return { insert: vi.fn(async () => ({ error: null })) };
    }
    throw new Error(`Unexpected table ${table}`);
  });
  return { rpc, rpcCalls, from };
};

const cronEnv = {
  CRON_SECRET: 'cron-secret',
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

const cronRequest = (secret = 'cron-secret') => new Request('https://example.test/api/scores/refresh', {
  method: 'POST',
  headers: { Authorization: `Bearer ${secret}` },
});

const activeContest = (id: string) => ({
  id,
  game_external_id: '401000001',
  game_starts_at: '2025-09-28T20:25:00.000Z',
  side_team_abbr: 'DAL',
  top_team_abbr: 'WSH',
  board_activations: [{ id: `activation-${id}` }],
  contest_score_state: [{ scoring_mode: 'automatic', milestones_finalized_at: null }],
});

beforeEach(() => {
  mocks.clients.length = 0;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe.sequential('cron score refresh endpoint', () => {
  it('rejects a wrong or missing cron secret', async () => {
    const response = await refreshScores({ request: cronRequest('wrong'), env: cronEnv, params: {} });
    expect(response.status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('does nothing when the LIVE_SCORING_ENABLED kill switch is off', async () => {
    const response = await refreshScores({
      request: cronRequest(),
      env: { ...cronEnv, LIVE_SCORING_ENABLED: 'false' },
      params: {},
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ disabled: true });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('skips the tick when the scheduler slot is not yet due', async () => {
    const admin = buildAdmin({ claimSlot: false });
    mocks.clients.push(admin);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await refreshScores({
      request: cronRequest(),
      env: { ...cronEnv, SCORE_POLL_SECONDS: '90' },
      params: {},
    });

    await expect(response.json()).resolves.toMatchObject({ skipped: true, pollSeconds: 90 });
    expect(admin.from).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('exits after one database query when no boards are in their game window', async () => {
    const admin = buildAdmin({ contests: [] });
    mocks.clients.push(admin);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await refreshScores({ request: cronRequest(), env: cronEnv, params: {} });

    await expect(response.json()).resolves.toMatchObject({ active: 0, refreshed: 0 });
    expect(admin.from).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches ESPN once for the whole slate and refreshes every active board', async () => {
    const admin = buildAdmin({
      contests: [
        activeContest('contest-1'),
        activeContest('contest-2'),
        {
          ...activeContest('contest-manual'),
          contest_score_state: [{ scoring_mode: 'manual', milestones_finalized_at: null }],
        },
      ],
    });
    mocks.clients.push(admin);
    const fetchSpy = vi.fn(async () => jsonResponse({ events: [scoreboardEvent] }));
    vi.stubGlobal('fetch', fetchSpy);
    // jsdom's crypto lacks randomUUID, which the lease token generation uses.
    vi.stubGlobal('crypto', { randomUUID: () => '00000000-0000-4000-8000-000000000000' });

    const response = await refreshScores({ request: cronRequest(), env: cronEnv, params: {} });

    const body = await response.json();
    expect(body).toMatchObject({ active: 2, refreshed: 2, failed: 0 });
    // One upstream scoreboard call regardless of how many boards are live.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const leaseCalls = admin.rpcCalls.filter(call => call.name === 'gridone_acquire_score_refresh_lease_v2');
    const promoteCalls = admin.rpcCalls.filter(call => call.name === 'gridone_promote_score_snapshot');
    const pruneCalls = admin.rpcCalls.filter(call => call.name === 'gridone_prune_score_provider_payloads');
    expect(leaseCalls).toHaveLength(2);
    expect(promoteCalls).toHaveLength(2);
    expect(pruneCalls).toHaveLength(1);
  });
});
