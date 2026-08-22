import { describe, expect, it } from 'vitest';
import { buildResolvedMilestoneRows } from '../features/viewer/milestones/milestoneViewModel';
import type { WinnerResolution } from '../types';

const resolution = (overrides: Partial<WinnerResolution>): WinnerResolution => ({
  milestone: 'Q1',
  sideScore: 3,
  topScore: 7,
  sideDigit: 3,
  topDigit: 7,
  participantName: 'Ann',
  resolvedAt: '2026-08-22T18:00:00.000Z',
  ...overrides,
});

describe('milestone view model', () => {
  it('preserves OPEN outcomes exactly and does not roll them to a participant', () => {
    const [row] = buildResolvedMilestoneRows([
      resolution({ participantName: null, openSquare: true, milestone: 'FINAL', topDigit: 4, sideDigit: 0 }),
    ]);
    expect(row).toMatchObject({ label: 'Final', name: 'Unassigned', openSquare: true, displayName: 'Open square', digits: '4 / 0' });
  });

  it('preserves corrected state, version, and organizer correction reason', () => {
    const [row] = buildResolvedMilestoneRows([
      resolution({ milestone: 'Q2', corrected: true, correctionReason: 'Score correction', resolutionVersion: 3 }),
    ]);
    expect(row).toMatchObject({ label: 'Halftime', corrected: true, correctionReason: 'Score correction', resolutionVersion: 3 });
  });
});
