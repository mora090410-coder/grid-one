import type { PendingMilestone, WinnerResolution } from '../../../../types';
import { milestoneLabel } from '../milestones/milestoneViewModel';

/** Published history only: a current match and a Final score never resolve a milestone. */
export function viewerNotchResults(history: WinnerResolution[], pending: PendingMilestone[]) {
  return (['Q1', 'Q2', 'Q3', 'FINAL'] as const).map(milestone => {
    const result = history.find(row => row.milestone === milestone);
    const pendingResult = pending.find(row => row.milestone === milestone);
    const canonicalRecord = result ?? pendingResult;
    return {
      label: milestoneLabel(milestone),
      status: result
        ? `${result.openSquare ? 'OPEN' : result.participantName || 'Unassigned'}${result.corrected ? ' · corrected' : ''}`
        : pendingResult ? 'Pending confirmation' : 'Not yet confirmed',
      topScore: canonicalRecord?.topScore ?? null,
      sideScore: canonicalRecord?.sideScore ?? null,
      topDigit: canonicalRecord?.topDigit ?? null,
      sideDigit: canonicalRecord?.sideDigit ?? null,
      published: Boolean(result),
    };
  });
}
