import { describe, expect, it } from 'vitest';
import { buildViewerScoreModel } from '../features/viewer/score/viewerScoreModel';
import type { LiveGameData } from '../types';

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
  sourceName: 'ESPN',
  retrievedAt: '2026-08-22T18:05:00.000Z',
  freshness: 'fresh',
  ...overrides,
});

describe('viewer score model', () => {
  it('names every viewer score authority status and preserves minute polling disclosure', () => {
    expect(buildViewerScoreModel({ live: live(), liveStatus: '', isSynced: true }).authority.label).toBe('Live');
    expect(buildViewerScoreModel({ live: live({ state: 'pre' }), liveStatus: '', isSynced: true }).authority.label).toBe('Pregame');
    expect(buildViewerScoreModel({ live: live({ isManual: true }), liveStatus: '', isSynced: true }).authority.label).toBe('Manual score');
    expect(buildViewerScoreModel({ live: null, liveStatus: 'MANUAL_AWAITING', isSynced: false }).authority.label).toBe('Manual · awaiting entry');
    expect(buildViewerScoreModel({ live: live({ freshness: 'refreshing' }), liveStatus: '', isSynced: true }).authority.label).toBe('Refreshing');
    expect(buildViewerScoreModel({ live: live({ freshness: 'stale' }), liveStatus: '', isSynced: true }).authority.label).toBe('Stale · last known');
    expect(buildViewerScoreModel({ live: live({ freshness: 'offline' }), liveStatus: '', isSynced: true }).authority.label).toBe('Offline · last known');
    expect(buildViewerScoreModel({ live: live({ freshness: 'rejected' }), liveStatus: '', isSynced: true }).authority.label).toBe('Source rejected');
    expect(buildViewerScoreModel({ live: live({ state: 'post' }), liveStatus: '', isSynced: true }).authority.label).toBe('Final');
    expect(buildViewerScoreModel({ live: live(), liveStatus: '', isSynced: true }).pollingText).toBe('Score updates about every minute');
  });

  it('formats period labels and checked-at freshness without inventing realtime language', () => {
    const model = buildViewerScoreModel({ live: live(), liveStatus: '', isSynced: true });
    expect(model.periodLabel).toBe('Q2 · 8:12');
    expect(model.freshness).toMatch(/^Checked /);
    expect(model.pollingText).not.toContain('instant');
    expect(buildViewerScoreModel({ live: live({ state: 'post' }), liveStatus: '', isSynced: true }).periodLabel).toBe('Final');
    expect(buildViewerScoreModel({ live: null, liveStatus: '', isSynced: false }).periodLabel).toBe('Score unavailable');
  });
});
