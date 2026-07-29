import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  findVisiblePublicBoard: vi.fn(),
  observeMilestones: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('../functions/_lib/publicBoardVisibility', () => ({
  findVisiblePublicBoard: mocks.findVisiblePublicBoard,
  publicBoardNotFoundResponse: vi.fn(() => new Response(null, { status: 404 })),
}));

vi.mock('../functions/_lib/winnerNotifications', () => ({
  observeMilestones: mocks.observeMilestones,
}));

import { onRequestGet } from '../functions/api/pools/[id]/score';

const env = {
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

const contest = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'final',
  game_external_id: '401000001',
  game_starts_at: '2026-09-13T17:00:00.000Z',
  side_team_abbr: 'CHI',
  top_team_abbr: 'GB',
  board_activations: [{ id: 'activation-1' }],
};

const finalSnapshot = {
  id: '22222222-2222-4222-8222-222222222222',
  contest_id: contest.id,
  source_mode: 'automatic',
  game_state: 'post',
  period: 4,
  side_score: 27,
  top_score: 24,
  quarter_scores: {
    Q1: { left: 7, top: 3 },
    Q2: { left: 10, top: 7 },
    Q3: { left: 3, top: 7 },
    Q4: { left: 7, top: 7 },
    OT: { left: 0, top: 0 },
  },
  clock: '0:00',
  detail: 'Final',
  source_name: 'ESPN',
  source_observed_at: '2026-09-13T20:00:00.000Z',
  retrieved_at: '2026-09-13T20:00:01.000Z',
  stale_after: '2027-09-13T20:00:01.000Z',
};

const projection = {
  winner_history: [
    { milestone: 'Q1' },
    { milestone: 'Q2' },
    { milestone: 'Q3' },
    { milestone: 'FINAL' },
  ],
  pending_milestones: [],
};

const finalAdmin = () => {
  const rpc = vi.fn();
  const from = vi.fn((table: string) => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({
        data: table === 'contest_score_state'
          ? {
            scoring_mode: 'automatic',
            current_snapshot_id: finalSnapshot.id,
            milestones_finalized_at: '2026-09-13T20:00:02.000Z',
          }
          : table === 'score_snapshots'
            ? finalSnapshot
            : table === 'public_board_snapshots'
              ? projection
              : null,
        error: null,
      })),
    };
    return chain;
  });
  return { from, rpc };
};

const getFinishedBoard = () => onRequestGet({
  request: new Request('https://getgridone.com/api/pools/ABCDEFGH/score'),
  env,
  params: { id: 'ABCDEFGH' },
});

describe('milestone load efficiency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findVisiblePublicBoard.mockResolvedValue({
      contest,
      snapshot: { contest_id: contest.id },
    });
  });

  it('performs zero milestone observation work for 50 sequential finished-board GETs', async () => {
    const admin = finalAdmin();
    mocks.createClient.mockReturnValue(admin);

    for (let request = 0; request < 50; request += 1) {
      expect((await getFinishedBoard()).status).toBe(200);
    }

    expect(mocks.observeMilestones).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('performs zero milestone observation work for 50 concurrent finished-board GETs', async () => {
    const admin = finalAdmin();
    mocks.createClient.mockReturnValue(admin);

    const responses = await Promise.all(
      Array.from({ length: 50 }, () => getFinishedBoard()),
    );

    expect(responses.every(response => response.status === 200)).toBe(true);
    expect(mocks.observeMilestones).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});
