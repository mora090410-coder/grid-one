import React from 'react';
import type { PendingMilestone, WinnerResolution } from '../../../../types';
import { viewerNotchResults } from './viewerNotchModel';

export interface NotchResultsProps {
  winnerHistory: WinnerResolution[];
  pendingMilestones?: PendingMilestone[];
  leftLabel?: string;
  topLabel?: string;
}

const NotchResults: React.FC<NotchResultsProps> = ({
  winnerHistory,
  pendingMilestones = [],
  leftLabel = 'Side',
  topLabel = 'Top',
}) => {
  const rows = viewerNotchResults(winnerHistory, pendingMilestones);

  return (
    <>
      {winnerHistory.length === 0 && <p>No published results yet.</p>}
      <ul className="context-notch-results">
        {rows.map((row) => {
          const hasCanonicalScore = row.topScore !== null && row.sideScore !== null;
          const hasCanonicalDigits = row.topDigit !== null && row.sideDigit !== null;
          return (
            <li key={row.label} className="context-notch-result">
              <span>{row.label} · {row.status}</span>
              {hasCanonicalDigits && (
                <span className="context-notch-result-detail">
                  {hasCanonicalScore && <>{leftLabel} {row.sideScore} · {topLabel} {row.topScore} · </>}
                  {topLabel} digit {row.topDigit} · {leftLabel} digit {row.sideDigit}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
};

export default NotchResults;
