import { describe, expect, it } from 'vitest';
import { buildScenarioModel } from '../features/viewer/scenarios/scenarioModel';
import type { BoardData, GameState, LiveGameData } from '../types';

const board = (): BoardData => {
  const squares = Array.from({ length: 100 }, (_, index) => [`P${index}`]);
  return {
    topAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    squares,
  };
};

const game: Pick<GameState, 'leftAbbr' | 'topAbbr'> = { leftAbbr: 'KC', topAbbr: 'PHI' };
const live = (overrides: Partial<LiveGameData> = {}): LiveGameData => ({
  leftScore: 10,
  topScore: 14,
  quarterScores: {
    Q1: { left: 3, top: 7 },
    Q2: { left: 7, top: 7 },
    Q3: { left: 0, top: 0 },
    Q4: { left: 0, top: 0 },
    OT: { left: 0, top: 0 },
  },
  clock: '8:12',
  period: 2,
  state: 'in',
  detail: '',
  isOvertime: false,
  freshness: 'fresh',
  ...overrides,
});

describe('viewer scenario model', () => {
  it('covers +2/+3/+6/+7/+8 for either team using current-quarter arithmetic', () => {
    const model = buildScenarioModel({ board: board(), game, live: live() });
    expect(model.disclaimer).toBe('These are arithmetic score outcomes, not odds or predictions.');
    expect(model.scenarios.map((scenario) => `${scenario.team}:${scenario.points}`)).toEqual([
      'KC:2', 'KC:3', 'KC:6', 'KC:7', 'KC:8',
      'PHI:2', 'PHI:3', 'PHI:6', 'PHI:7', 'PHI:8',
    ]);
    expect(model.scenarios[0]).toMatchObject({ left: 2, top: 4, names: ['P24'] });
    expect(model.scenarios[5]).toMatchObject({ left: 0, top: 6, names: ['P6'] });
  });

  it('uses last-known stale/offline scores explicitly and suppresses no-score and final states', () => {
    expect(buildScenarioModel({ board: board(), game, live: live({ freshness: 'stale' }) }).status).toBe('last-known');
    expect(buildScenarioModel({ board: board(), game, live: live({ freshness: 'offline' }) }).status).toBe('last-known');
    expect(buildScenarioModel({ board: board(), game, live: null }).scenarios).toEqual([]);
    expect(buildScenarioModel({ board: board(), game, live: null }).status).toBe('no-score');
    expect(buildScenarioModel({ board: board(), game, live: live({ state: 'post' }) }).scenarios).toEqual([]);
    expect(buildScenarioModel({ board: board(), game, live: live({ state: 'post' }) }).status).toBe('final');
  });
});
