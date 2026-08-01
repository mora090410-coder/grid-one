import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet as getScore } from '../functions/api/pools/[id]/score';

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

const env = {
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

const contest = {
  id: 'contest-1',
  owner_id: 'owner-1',
  status: 'live',
  game_external_id: '401000001',
  game_starts_at: '2025-09-28T20:25:00.000Z',
  side_team_abbr: 'DAL',
  top_team_abbr: 'WAS',
  board_activations: [{ id: 'activation-1' }],
};

const snapshot = (staleAfter: string, state = 'in') => ({
  id: 'snap-1',
  contest_id: 'contest-1',
  source_mode: 'automatic',
  game_state: state,
  period: 2,
  side_score: 10,
  top_score: 7,
  quarter_scores: {},
  clock: '5:00',
  detail: '',
  source_observed_at: '2026-08-01T17:00:00.000Z',
  retrieved_at: '2026-08-01T17:00:00.000Z',
  stale_after: staleAfter,
});

const buildAdmin = (currentSnapshot: any) => {
  let boardSnapshotReads = 0;
  const from = vi.fn((table: string) => {
    if (table === 'public_board_snapshots') {
      boardSnapshotReads += 1;
      const isVisibilityRead = boardSnapshotReads === 1;
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        is: vi.fn(() => chain),
        in: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({
          data: isVisibilityRead
            ? { contest_id: contest.id, contest }
            : { winner_history: [], pending_milestones: [] },
          error: null,
        })),
      };
      return chain;
    }
    if (table === 'contest_score_state') {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({
          data: { scoring_mode: 'automatic', current_snapshot_id: currentSnapshot?.id || null },
          error: null,
        })),
      };
      return chain;
    }
    if (table === 'score_snapshots') {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({ data: currentSnapshot, error: null })),
      };
      return chain;
    }
    throw new Error(`Unexpected table ${table}`);
  });
  return { from, rpc: vi.fn() };
};

const publicRequest = (headers: Record<string, string> = {}) =>
  new Request('https://example.test/api/pools/ABCDEFGH/score', { headers });

beforeEach(() => {
  mocks.clients.length = 0;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe.sequential('public share-code score caching', () => {
  it('serves a fresh snapshot with shared-cache headers, an ETag, and nextPollSeconds', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    mocks.clients.push(buildAdmin(snapshot(future)));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const put = vi.fn(async () => undefined);
    vi.stubGlobal('caches', { default: { match: vi.fn(async () => null), put } });
    const waitUntil = vi.fn();

    const response = await getScore({
      request: publicRequest(),
      env,
      params: { id: 'abcdefgh' },
      waitUntil,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=30, stale-while-revalidate=60');
    expect(response.headers.get('ETag')).toMatch(/^W\//);
    const body = await response.json();
    expect(body.nextPollSeconds).toBe(60);
    expect(body.refreshAttempted).toBe(false);
    expect(body.score.freshness).toBe('fresh');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('answers 304 when the client already holds the current representation', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    mocks.clients.push(buildAdmin(snapshot(future)));
    const first = await getScore({
      request: publicRequest(),
      env,
      params: { id: 'ABCDEFGH' },
    });
    const etag = first.headers.get('ETag')!;

    mocks.clients.push(buildAdmin(snapshot(future)));
    const second = await getScore({
      request: publicRequest({ 'If-None-Match': etag }),
      env,
      params: { id: 'ABCDEFGH' },
    });

    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');
  });

  it('serves a slightly-stale live snapshot inside the grace window without hitting ESPN', async () => {
    const oneMinuteStale = new Date(Date.now() - 60_000).toISOString();
    const admin = buildAdmin(snapshot(oneMinuteStale));
    mocks.clients.push(admin);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await getScore({
      request: publicRequest(),
      env,
      params: { id: 'ABCDEFGH' },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.refreshAttempted).toBe(false);
    expect(body.score.freshness).toBe('stale');
    // The cron owns routine freshness; anonymous viewers must not become an
    // upstream amplifier for a snapshot that is only briefly past its TTL.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('keeps the LIVE_SCORING_ENABLED kill switch from triggering inline refreshes', async () => {
    const veryStale = new Date(Date.now() - 30 * 60_000).toISOString();
    const admin = buildAdmin(snapshot(veryStale));
    mocks.clients.push(admin);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await getScore({
      request: publicRequest(),
      env: { ...env, LIVE_SCORING_ENABLED: 'false' },
      params: { id: 'ABCDEFGH' },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.score.freshness).toBe('stale');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});
