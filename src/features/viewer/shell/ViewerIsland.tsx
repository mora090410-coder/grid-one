import React from 'react';
import type { BoardData, GameState, LiveGameData, WinnerResolution, PendingMilestone } from '../../../../types';
import { ContextNotch, type NotchModule } from '../../../design/primitives/ContextNotch';
import { buildViewerScoreModel } from '../score/viewerScoreModel';
import { viewerNotchResults } from './viewerNotchModel';

export interface ViewerIslandProps {
  game: GameState;
  board: BoardData;
  live: LiveGameData | null;
  liveStatus: string;
  isSynced: boolean;
  selectedPlayer: string;
  yourSquares: number;
  winsNow: boolean;
  requested?: boolean;
  winnerHistory?: WinnerResolution[];
  pendingMilestones?: PendingMilestone[];
  onFindSquares?: () => void;
  onViewSquares?: () => void;
  onViewScore?: () => void;
  onViewResults?: () => void;
  onNextScores?: () => void;
}

/** Public-only adapter. No payment/contact data or fetching enters this surface. */
const ViewerIsland: React.FC<ViewerIslandProps> = ({ game, live, liveStatus, isSynced, selectedPlayer, yourSquares, winsNow, requested, winnerHistory = [], pendingMilestones = [], onFindSquares, onViewSquares, onViewScore, onViewResults, onNextScores }) => {
  const score = buildViewerScoreModel({ live, liveStatus, isSynced });
  const stale = score.authority.tone === 'stale';
  const leftLabel = game.leftAbbr || 'AWAY';
  const topLabel = game.topAbbr || 'HOME';
  const authority = live?.isManual || liveStatus.startsWith('MANUAL') ? score.authority.label : `Automatic · ${score.authority.label}`;
  const modules: NotchModule[] = [
    { id: 'game', label: 'Game', detail: <><p>{authority} · {score.authority.detail}</p><p>{stale ? 'Last known · ' : ''}{score.freshness || 'Checked time unavailable'}</p><p>{score.pollingText}</p>{live?.sourceName && <p>Source · {live.sourceName}</p>}</>, actions: onViewScore ? [{ label: 'View score', onClick: onViewScore }] : [] },
    { id: 'squares', label: selectedPlayer ? 'Your squares' : 'Find squares', reading: selectedPlayer ? `${yourSquares} squares` : undefined,
      detail: selectedPlayer ? <><p>Selected name: {selectedPlayer}</p><p>{stale ? 'Last known · ' : ''}Currently matching: {winsNow ? 'one of your squares' : 'none of your squares'}.</p></> : <p>Choose the name used on this board.</p>,
      actions: [
        ...(selectedPlayer && onViewSquares ? [{ label: 'View your squares', onClick: onViewSquares }] : []),
        ...(onFindSquares ? [{ label: selectedPlayer ? 'Choose another name' : 'Find my squares', onClick: onFindSquares }] : []),
        ...(live?.state === 'in' && onNextScores ? [{ label: 'See next scores', onClick: onNextScores }] : []),
      ] },
    { id: 'results', label: 'Results', reading: `${winnerHistory.length} published`, detail: <ul>{viewerNotchResults(winnerHistory, pendingMilestones).map(row => <li key={row.label}>{row.label} · {row.status}</li>)}</ul>, actions: onViewResults ? [{ label: 'View results', onClick: onViewResults }] : [] },
  ];
  return <ContextNotch label="Score" placement="fixed" requested={requested} modules={modules} summary={<><span>{live ? `${leftLabel} ${live.leftScore} · ${topLabel} ${live.topScore} · ${score.periodLabel}` : 'Waiting for score'}</span><span>{authority} · {score.freshness || 'Checked time unavailable'}</span></>} />;
};

export default ViewerIsland;
