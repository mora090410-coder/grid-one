import { describe, expect, it } from 'vitest';
import { viewerNotchResults } from '../../src/features/viewer/shell/viewerNotchModel';

describe('notch OPEN precedence', () => {
  it('never names a winner for OPEN even when a stale participant name remains', () => {
    const rows = viewerNotchResults([{ milestone: 'Q1', openSquare: true, participantName: 'Stale name', topScore: 10, sideScore: 7, topDigit: 0, sideDigit: 7, corrected: true, resolvedAt: '2026-09-13T18:00:00Z' }], []);
    expect(rows[0]).toEqual({ label: 'Q1', status: 'OPEN · corrected', topScore: 10, sideScore: 7, topDigit: 0, sideDigit: 7, published: true });
    expect(JSON.stringify(rows)).not.toContain('Stale name');
  });

  it('uses only published resolutions for winner status and exposes canonical pending score data', () => {
    const rows = viewerNotchResults([], [{ milestone: 'Q2', topScore: 10, sideScore: 14, topDigit: 0, sideDigit: 4, stableSince: '', lastObservedAt: '', successfulReadCount: 1 }]);
    expect(rows).toEqual([
      { label: 'Q1', status: 'Not yet confirmed', topScore: null, sideScore: null, topDigit: null, sideDigit: null, published: false },
      { label: 'Halftime', status: 'Pending confirmation', topScore: 10, sideScore: 14, topDigit: 0, sideDigit: 4, published: false },
      { label: 'Q3', status: 'Not yet confirmed', topScore: null, sideScore: null, topDigit: null, sideDigit: null, published: false },
      { label: 'Final', status: 'Not yet confirmed', topScore: null, sideScore: null, topDigit: null, sideDigit: null, published: false },
    ]);
  });

  it('never combines a published legacy result with a pending score for the same milestone', () => {
    const rows = viewerNotchResults(
      [{ milestone: 'Q1', participantName: 'Published winner', topDigit: 7, sideDigit: 3, resolvedAt: '' }],
      [{ milestone: 'Q1', topScore: 20, sideScore: 14, topDigit: 0, sideDigit: 4, stableSince: '', lastObservedAt: '', successfulReadCount: 2 }],
    );
    expect(rows[0]).toEqual({
      label: 'Q1',
      status: 'Published winner',
      topScore: null,
      sideScore: null,
      topDigit: 7,
      sideDigit: 3,
      published: true,
    });
  });
});
