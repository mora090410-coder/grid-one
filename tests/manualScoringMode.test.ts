import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { createClientMock, resolveMilestonesMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  resolveMilestonesMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('../functions/_lib/winnerNotifications', () => ({
  resolveMilestonesAndNotify: resolveMilestonesMock,
}));

import { onRequestDelete, onRequestPost } from '../functions/api/pools/[id]/score/manual';

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
    resolveMilestonesMock.mockReset();
    resolveMilestonesMock.mockResolvedValue([]);
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

  it('commits manual mode, snapshot, projection, and audit through one RPC', async () => {
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
    expect(resolveMilestonesMock).toHaveBeenCalledWith(
      admin,
      env,
      '11111111-1111-4111-8111-111111111111',
      snapshot,
      { sendNotifications: false },
    );
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
    expect(resolveMilestonesMock).not.toHaveBeenCalled();
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
});
