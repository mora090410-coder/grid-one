import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { createClientMock, observeMilestonesMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  observeMilestonesMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('../functions/_lib/winnerNotifications', () => ({
  observeMilestones: observeMilestonesMock,
}));

import {
  onRequestDelete,
  onRequestPost,
  onRequestPut,
} from '../functions/api/pools/[id]/score/manual';
import { onRequestGet as onRequestAutomaticScore } from '../functions/api/pools/[id]/score';

const env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
};

const endpoint = 'https://getgridone.com/api/pools/11111111-1111-4111-8111-111111111111/score/manual';
const deleteRequest = () => new Request(endpoint, {
  method: 'DELETE',
  headers: { Authorization: 'Bearer owner-token' },
});
const postRequest = () => new Request(endpoint, {
  method: 'POST',
  headers: {
    Authorization: 'Bearer owner-token',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    quarterScores: {
      Q1: { left: 7, top: 3 },
      Q2: { left: 3, top: 7 },
      Q3: { left: 0, top: 0 },
      Q4: { left: 7, top: 7 },
      OT: { left: 0, top: 6 },
    },
    period: 4,
    state: 'post',
  }),
});
const putRequest = () => new Request(endpoint, {
  method: 'PUT',
  headers: { Authorization: 'Bearer owner-token' },
});

const contestQuery = (gameExternalId: string | null) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({
    data: {
      id: '11111111-1111-4111-8111-111111111111',
      status: 'draft',
      game_external_id: gameExternalId,
    },
  }),
});

describe('manual scoring mode transitions', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    observeMilestonesMock.mockReset();
    observeMilestonesMock.mockResolvedValue({
      winnerHistory: [],
      pendingMilestones: [],
      newlyConfirmedResolutionIds: [],
    });
    vi.unstubAllGlobals();
  });

  it('returns an explicit awaiting-entry state without refreshing a fresh manual board', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    const admin = {
      from: vi.fn((table: string) => {
        const result = table === 'contests'
          ? {
            id: '11111111-1111-4111-8111-111111111111',
            owner_id: 'owner',
            status: 'published',
            game_external_id: '401000001',
            game_starts_at: '2026-09-13T17:00:00.000Z',
            side_team_abbr: 'CHI',
            top_team_abbr: 'GB',
            board_activations: [{ id: 'activation-1' }],
          }
          : table === 'contest_score_state'
            ? { scoring_mode: 'manual', current_snapshot_id: null }
            : null;
        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          in: vi.fn(() => chain),
          is: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => ({ data: result, error: null })),
        };
        return chain;
      }),
      rpc: vi.fn(async () => ({ data: true, error: null })),
    };
    createClientMock
      .mockReturnValueOnce(admin)
      .mockReturnValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } } }),
        },
      });

    const response = await onRequestAutomaticScore({
      request: new Request(
        'https://getgridone.com/api/pools/11111111-1111-4111-8111-111111111111/score',
        { headers: { Authorization: 'Bearer owner-token' } },
      ),
      env,
      params: { id: '11111111-1111-4111-8111-111111111111' },
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      scoringMode: 'manual',
      scoreState: 'awaiting_organizer_entry',
      refreshAttempted: false,
      score: null,
      message: 'Manual scoring is on. Waiting for the organizer to enter a score.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(observeMilestonesMock).not.toHaveBeenCalled();
  });

  it('uses one atomic RPC to clear manual authority before automatic refresh resumes', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const admin = {
      from: vi.fn((table: string) => {
        if (table === 'contests') return contestQuery('401000001');
        throw new Error(`Unexpected table ${table}`);
      }),
      rpc,
    };
    createClientMock
      .mockReturnValueOnce({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } } }) } })
      .mockReturnValueOnce(admin);

    const response = await onRequestDelete({
      request: deleteRequest(),
      env,
      params: { id: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('gridone_enable_automatic_scoring', expect.objectContaining({
      p_contest_id: '11111111-1111-4111-8111-111111111111',
      p_owner_id: 'owner',
      p_changed_at: expect.any(String),
    }));
  });

  it('persists manual authority before the organizer enters the first score', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const admin = {
      from: vi.fn((table: string) => {
        if (table === 'contests') return contestQuery('401000001');
        throw new Error(`Unexpected table ${table}`);
      }),
      rpc,
    };
    createClientMock
      .mockReturnValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } } }),
        },
      })
      .mockReturnValueOnce(admin);

    const response = await onRequestPut({
      request: putRequest(),
      env,
      params: { id: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('gridone_enable_manual_scoring', expect.objectContaining({
      p_contest_id: '11111111-1111-4111-8111-111111111111',
      p_owner_id: 'owner',
      p_changed_at: expect.any(String),
    }));
    await expect(response.json()).resolves.toMatchObject({
      scoringMode: 'manual',
      scoreState: 'awaiting_organizer_entry',
    });
  });

  it('keeps an unlinked legacy board manual-only', async () => {
    const admin = {
      from: vi.fn((table: string) => {
        if (table === 'contests') return contestQuery(null);
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    createClientMock
      .mockReturnValueOnce({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } } }) } })
      .mockReturnValueOnce(admin);

    const response = await onRequestDelete({
      request: deleteRequest(),
      env,
      params: { id: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/Link this legacy board/i) });
  });

  it('commits manual mode, snapshot, milestone projection, and audit through one RPC', async () => {
    const snapshot = {
      id: '22222222-2222-4222-8222-222222222222',
      contest_id: '11111111-1111-4111-8111-111111111111',
      side_score: 17,
      top_score: 23,
      quarter_scores: {
        Q1: { left: 7, top: 3 },
        Q2: { left: 3, top: 7 },
        Q3: { left: 0, top: 0 },
        Q4: { left: 7, top: 7 },
        OT: { left: 0, top: 6 },
      },
      clock: '',
      period: 5,
      game_state: 'post',
      detail: 'Organizer-entered score',
      source_observed_at: '2026-09-13T20:00:00.000Z',
      retrieved_at: '2026-09-13T20:00:00.000Z',
      stale_after: '2027-09-13T20:00:00.000Z',
    };
    const rpc = vi.fn().mockResolvedValue({ data: [snapshot], error: null });
    const admin = {
      from: vi.fn((table: string) => {
        if (table === 'contests') return contestQuery('401000001');
        if (table === 'public_board_snapshots') {
          const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                winner_history: [{ milestone: 'FINAL' }],
                pending_milestones: [],
              },
              error: null,
            }),
          };
          return chain;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
      rpc,
    };
    createClientMock
      .mockReturnValueOnce({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } } }) } })
      .mockReturnValueOnce(admin);

    const response = await onRequestPost({
      request: postRequest(),
      env,
      params: { id: '11111111-1111-4111-8111-111111111111' },
      waitUntil: vi.fn(),
    });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('gridone_commit_manual_score', expect.objectContaining({
      p_owner_id: 'owner',
      p_game_state: 'post',
      p_period: 5,
      p_side_score: 17,
      p_top_score: 23,
      p_quarter_scores: snapshot.quarter_scores,
    }));
    expect(observeMilestonesMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      winnerHistory: [{ milestone: 'FINAL' }],
      pendingMilestones: [],
    });
  });

  it('does not resolve winners when the atomic manual commit fails', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Published score projection is unavailable' },
    });
    const admin = {
      from: vi.fn((table: string) => {
        if (table === 'contests') return contestQuery('401000001');
        throw new Error(`Unexpected table ${table}`);
      }),
      rpc,
    };
    createClientMock
      .mockReturnValueOnce({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } } }) } })
      .mockReturnValueOnce(admin);

    const response = await onRequestPost({
      request: postRequest(),
      env,
      params: { id: '11111111-1111-4111-8111-111111111111' },
    });

    expect(response.status).toBe(500);
    expect(observeMilestonesMock).not.toHaveBeenCalled();
  });

  it('defines service-role-only transactional score RPC contracts', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/011_atomic_manual_scoring.sql'),
      'utf8',
    );
    expect(migration).toContain('gridone_commit_manual_score');
    expect(migration).toContain('gridone_enable_automatic_scoring');
    expect(migration).toContain('Published score projection is unavailable');
    expect(migration).toContain('RAISE EXCEPTION');
    expect(migration).toMatch(
      /UPDATE public\.score_snapshots[\s\S]*UPDATE public\.contest_score_state[\s\S]*score\.automatic_enabled/,
    );
    expect(migration).toMatch(
      /gridone_promote_score_snapshot[\s\S]*UPDATE public\.public_board_snapshots[\s\S]*score\.manual_updated/,
    );
    expect(migration).toContain('TO service_role;');
    expect(migration).not.toContain('TO authenticated;');
  });

  it('defines monotonic refresh authority and atomic public projection in migration 014', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/014_score_promotion_ordering.sql'),
      'utf8',
    );
    expect(migration).toContain('authority_generation');
    expect(migration).toContain('latest_refresh_sequence');
    expect(migration).toContain('promoted_refresh_sequence');
    expect(migration).toContain('gridone_acquire_score_refresh_lease_v2');
    expect(migration).toContain('gridone_enable_manual_scoring');
    expect(migration).toMatch(
      /gridone_promote_score_snapshot[\s\S]*UPDATE public\.contest_score_state[\s\S]*UPDATE public\.public_board_snapshots/,
    );
    expect(migration).toContain('Published score projection is unavailable');
    expect(migration).toContain('TO service_role;');
    expect(migration).not.toContain('TO authenticated;');
  });

  it('passes refresh-start authority to PostgreSQL without a handler-side public score write', () => {
    const handler = readFileSync(
      resolve(process.cwd(), 'functions/api/pools/[id]/score.ts'),
      'utf8',
    );
    // The snapshot insert lives in the shared refresh library so the cron
    // endpoint and the viewer endpoint persist scores identically.
    const refreshLibrary = readFileSync(
      resolve(process.cwd(), 'functions/_lib/scoreRefresh.ts'),
      'utf8',
    );
    expect(handler).toContain('gridone_acquire_score_refresh_lease_v2');
    expect(handler).toContain('applyProviderScore');
    expect(refreshLibrary).toContain('authority_generation: lease.authority_generation');
    expect(refreshLibrary).toContain('refresh_sequence: lease.refresh_sequence');
    expect(refreshLibrary).toContain('refresh_started_at: lease.refresh_started_at');
    for (const source of [handler, refreshLibrary]) {
      expect(source).not.toMatch(
        /from\(['"]public_board_snapshots['"]\)\.update\(\{[\s\S]*score:/,
      );
    }
  });
});
