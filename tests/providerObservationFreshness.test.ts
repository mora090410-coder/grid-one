import { describe, expect, it, vi } from 'vitest';
import { applyProviderScore } from '../functions/_lib/scoreRefresh';

const provider = (observed: number) => ({
  provider: 'api-sports' as const,
  score: { leftScore: 0, topScore: 0, quarterScores: Object.fromEntries(['Q1', 'Q2', 'Q3', 'Q4', 'OT'].map(key => [key, { left: 0, top: 0 }])) as any, clock: '10:00', period: 1, state: 'in' as const, detail: 'Q1', isOvertime: false, sourceObservedAt: new Date(observed).toISOString() },
  source: { title: 'API-Sports', uri: 'https://api-sports.io/sports/nfl' }, raw: {},
});

describe('provider observation freshness at persistence', () => {
  it.each([-120_000, 10_000])('rejects expired or future observations before touching storage (%s ms)', async offset => {
    const now = Date.now();
    const admin = { from: vi.fn(), rpc: vi.fn() };
    await expect(applyProviderScore(admin, {}, {}, provider(now + offset), null)).rejects.toThrow(/observation/i);
    expect(admin.from).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('expires a live snapshot from observation time instead of insertion time', async () => {
    const observed = Date.now() - 60_000;
    const insert = vi.fn((_row: any) => ({ select: () => ({ single: async () => ({ data: { id: 'snapshot' }, error: null }) }) }));
    const admin = { from: vi.fn(() => ({ insert })), rpc: vi.fn(async () => ({ data: true, error: null })) };
    await applyProviderScore(admin, {}, {}, provider(observed), { side_score: 0, top_score: 0, game_state: 'in', period: 1 });
    expect(insert.mock.calls[0][0]).toMatchObject({ stale_after: new Date(observed + 240_000).toISOString() });
  });
});
