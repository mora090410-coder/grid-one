import { describe, expect, it, vi } from 'vitest';
import { createScoreProviderRecovery } from '../functions/_lib/scoreProviderRecovery';

const contest = { game_external_id: '401000001', game_starts_at: '2026-09-13T17:00:00Z', side_team_abbr: 'CHI', top_team_abbr: 'CAR' };

describe('independent provider recovery', () => {
  it('does not request a paid provider when the key is absent', async () => {
    const fetchSpy = vi.fn();
    const recover = createScoreProviderRecovery({}, fetchSpy);
    await expect(recover(contest, async () => { throw new Error('ESPN unavailable'); })).rejects.toThrow('ESPN unavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps a valid primary score and deduplicates it across boards', async () => {
    const fetchSpy = vi.fn();
    const recover = createScoreProviderRecovery({ API_SPORTS_KEY: 'test-only' }, fetchSpy);
    const score: any = { provider: 'espn', score: { leftScore: 7, topScore: 0 } };
    const primary = vi.fn(async () => score);
    expect(await recover(contest, primary)).toBe(score);
    expect(await recover({ ...contest, id: 'other-board' }, primary)).toBe(score);
    expect(primary).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not reinterpret a legacy unlinked board using another provider', async () => {
    const fetchSpy = vi.fn();
    const recover = createScoreProviderRecovery({ API_SPORTS_KEY: 'test-only' }, fetchSpy);
    await expect(recover({ ...contest, game_external_id: null }, async () => { throw new Error('unlinked'); })).rejects.toThrow('linked scheduled');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
