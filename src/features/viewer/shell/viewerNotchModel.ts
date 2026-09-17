import type { PendingMilestone, WinnerResolution } from '../../../../types';
import { milestoneLabel } from '../milestones/milestoneViewModel';

/** Published history only: a current match and a Final score never resolve a milestone. */
export function viewerNotchResults(history: WinnerResolution[], pending: PendingMilestone[]) {
  return (['Q1', 'Q2', 'Q3', 'FINAL'] as const).map(milestone => {
    const result = history.find(row => row.milestone === milestone);
    return {
      label: milestoneLabel(milestone),
      status: result
        ? `${result.openSquare ? 'OPEN' : result.participantName || 'Unassigned'}${result.corrected ? ' · corrected' : ''}`
        : pending.some(row => row.milestone === milestone) ? 'Pending confirmation' : 'Not yet confirmed',
    };
  });
}
