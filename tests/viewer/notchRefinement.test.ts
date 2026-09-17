import { describe, expect, it } from 'vitest';
import { viewerNotchResults } from '../../src/features/viewer/shell/viewerNotchModel';

describe('notch OPEN precedence', () => {
  it('never names a winner for OPEN even when a stale participant name remains', () => {
    const rows = viewerNotchResults([{ milestone: 'Q1', openSquare: true, participantName: 'Stale name', topDigit: 0, sideDigit: 7, corrected: true, resolvedAt: '2026-09-13T18:00:00Z' }], []);
    expect(rows[0]).toEqual({ label: 'Q1', status: 'OPEN · corrected' });
    expect(JSON.stringify(rows)).not.toContain('Stale name');
  });
});
