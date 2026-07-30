import { describe, expect, it, vi } from 'vitest';
import {
  fetchExactEventScore,
  hasActivatedBoardServices,
  scoreStaleAfter,
  toClientScore,
  validateScore,
} from '../functions/api/pools/[id]/score';
import { overtimeEspnSummary, regulationEspnSummary } from './fixtures/espnNfl.fixture';

const valid = {
  leftScore: 17,
  topScore: 24,
  quarterScores: {
    Q1: { left: 3, top: 7 },
    Q2: { left: 7, top: 7 },
    Q3: { left: 7, top: 3 },
    Q4: { left: 0, top: 7 },
    OT: { left: 0, top: 0 },
  },
  clock: '2:31',
  period: 4,
  state: 'in',
  detail: 'Fourth quarter',
  isOvertime: false,
  sourceObservedAt: '2026-09-13T20:15:00.000Z',
};

describe('server score validation', () => {
  it('requires an activated board before automatic score services run', () => {
    expect(hasActivatedBoardServices({ board_activations: [] })).toBe(false);
    expect(hasActivatedBoardServices({ board_activations: null })).toBe(false);
    expect(hasActivatedBoardServices({ board_activations: [{ id: 'activation-id' }] })).toBe(true);
    expect(hasActivatedBoardServices({ board_activations: { id: 'activation-id' } })).toBe(true);
  });

  it('accepts a complete internally consistent NFL score snapshot', () => {
    expect(validateScore(valid)).toMatchObject({ leftScore: 17, topScore: 24, state: 'in' });
  });

  it('rejects quarter totals that do not match the game totals', () => {
    expect(() => validateScore({
      ...valid,
      leftScore: 18,
    })).toThrow(/quarter scoring/i);
  });

  it('rejects invalid game states and impossible score values', () => {
    expect(() => validateScore({ ...valid, state: 'live' })).toThrow(/game state/i);
    expect(() => validateScore({ ...valid, leftScore: -1 })).toThrow(/score totals/i);
  });

  it('marks an organizer snapshot as manual in the viewer projection', () => {
    const projected = toClientScore({
      side_score: 10,
      top_score: 7,
      quarter_scores: valid.quarterScores,
      clock: '',
      period: 2,
      game_state: 'in',
      detail: 'Organizer entry',
      source_mode: 'manual',
      source_name: 'Organizer',
      retrieved_at: '2026-09-13T20:15:00.000Z',
      stale_after: '2026-09-13T20:30:00.000Z',
    });
    expect(projected).toMatchObject({ isManual: true, sourceName: 'Organizer' });
  });
});

describe('exact-event automatic scoring', () => {
  const contest = {
    game_external_id: '401000001',
    game_starts_at: '2025-09-28T20:25:00.000Z',
    side_team_abbr: 'DAL',
    top_team_abbr: 'WAS',
  };
  const response = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

  it('maps the exact linked event into the board axis orientation', async () => {
    const result = await fetchExactEventScore(contest, vi.fn(async () => response(regulationEspnSummary)));
    expect(result.score).toMatchObject({
      leftScore: 24,
      topScore: 27,
      state: 'post',
      period: 4,
      quarterScores: {
        Q1: { left: 3, top: 7 },
        Q4: { left: 7, top: 7 },
      },
    });
    expect(result.source.title).toBe('ESPN');
  });

  it('rejects a response whose event identity, teams, or kickoff differs', async () => {
    const fetchMock = vi.fn(async () => response(regulationEspnSummary));
    await expect(fetchExactEventScore({ ...contest, game_external_id: '401999999' }, fetchMock))
      .rejects.toThrow(/different NFL game/i);
    await expect(fetchExactEventScore({ ...contest, side_team_abbr: 'PHI' }, fetchMock))
      .rejects.toThrow(/different NFL game/i);
    await expect(fetchExactEventScore({ ...contest, game_starts_at: '2025-09-28T21:25:00Z' }, fetchMock))
      .rejects.toThrow(/different NFL game/i);
  });

  it('aggregates multi-overtime scoring into the single OT milestone', async () => {
    const result = await fetchExactEventScore({
      game_external_id: '401000002',
      game_starts_at: '2025-10-19T17:00:00.000Z',
      side_team_abbr: 'LAR',
      top_team_abbr: 'JAX',
    }, vi.fn(async () => response(overtimeEspnSummary)));
    expect(result.score.period).toBe(5);
    expect(result.score.isOvertime).toBe(true);
    expect(result.score.quarterScores.OT).toEqual({ left: 0, top: 6 });
  });

  it('keeps legacy boards manual-only until an event is linked', async () => {
    await expect(fetchExactEventScore({
      game_external_id: null,
      game_starts_at: null,
      side_team_abbr: 'DAL',
      top_team_abbr: 'WAS',
    })).rejects.toThrow(/manual scoring/i);
  });
});

describe('score freshness', () => {
  const retrieved = new Date('2026-09-13T16:59:30.000Z');

  it('never lets a pre-game snapshot stay fresh past kickoff', () => {
    expect(scoreStaleAfter('pre', retrieved, '2026-09-13T17:00:00.000Z'))
      .toBe('2026-09-13T17:00:00.000Z');
  });

  it('forces an immediate recheck when ESPN still reports pre after kickoff', () => {
    expect(scoreStaleAfter('pre', retrieved, '2026-09-13T16:59:00.000Z'))
      .toBe(retrieved.toISOString());
  });

  it('keeps live and final freshness independent of kickoff', () => {
    expect(scoreStaleAfter('in', retrieved, '2026-09-13T17:00:00.000Z'))
      .toBe('2026-09-13T17:01:30.000Z');
    expect(scoreStaleAfter('post', retrieved, '2026-09-13T17:00:00.000Z'))
      .toBe('2027-09-13T16:59:30.000Z');
  });
});
