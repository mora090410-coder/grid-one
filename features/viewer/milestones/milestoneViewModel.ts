import type { WinnerResolution } from '../../../types';

export interface ResolvedMilestoneRow {
  label: string;
  digits: string;
  name: string;
  displayName: string;
  openSquare: boolean;
  resolvedAt: string;
  corrected: boolean;
  correctionReason?: string | null;
  resolutionVersion: number;
}

export const milestoneLabel = (milestone: WinnerResolution['milestone']): string => {
  if (milestone === 'Q2') return 'Halftime';
  if (milestone === 'FINAL') return 'Final';
  return milestone;
};

export const buildResolvedMilestoneRows = (winnerHistory: WinnerResolution[]): ResolvedMilestoneRow[] => (
  winnerHistory.map((resolution) => {
    const name = resolution.participantName || 'Unassigned';
    const openSquare = Boolean(resolution.openSquare);
    return {
      label: milestoneLabel(resolution.milestone),
      digits: `${resolution.topDigit} / ${resolution.sideDigit}`,
      name,
      displayName: openSquare ? 'Open square' : name,
      openSquare,
      resolvedAt: resolution.resolvedAt,
      corrected: Boolean(resolution.corrected),
      correctionReason: resolution.correctionReason,
      resolutionVersion: resolution.resolutionVersion || 1,
    };
  })
);
