import React from 'react';
import type { BoardData, GameState, LiveGameData, WinnerResolution, PendingMilestone } from '../../../../types';
import { ContextNotch, type NotchModule } from '../../../design/primitives/ContextNotch';
import { buildViewerScoreModel } from '../score/viewerScoreModel';
import NotchResults from './NotchResults';

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
const ViewerIsland: React.FC<ViewerIslandProps> = ({ game, board, live, liveStatus, isSynced, selectedPlayer, winsNow, requested, winnerHistory = [], pendingMilestones = [], onFindSquares, onViewSquares, onViewScore, onNextScores }) => {
  const score = buildViewerScoreModel({ live, liveStatus, isSynced });
  const stale = score.authority.tone === 'stale';
  const leftLabel = game.leftAbbr || 'AWAY';
  const topLabel = game.topAbbr || 'HOME';
  const authority = live?.isManual || liveStatus.startsWith('MANUAL') ? score.authority.label : `Automatic · ${score.authority.label}`;
  const squareNumbers = selectedPlayer
    ? board.squares.flatMap((names, index) => names.includes(selectedPlayer) ? [index + 1] : [])
    : [];
  const squareCount = squareNumbers.length;
  const modules: NotchModule[] = [
    { id: 'game', label: 'Game', detail: <>{live && <p className="context-notch-score">{leftLabel} {live.leftScore} · {topLabel} {live.topScore} · {score.periodLabel}</p>}<p>{authority} · {score.authority.detail}</p><p>{stale ? 'Last known · ' : ''}{score.freshness || 'Checked time unavailable'}</p><p>{score.pollingText}</p>{live?.sourceName && <p>Source · {live.sourceName}</p>}</>, actions: onViewScore ? [{ label: 'View score', onClick: onViewScore }] : [] },
    { id: 'squares', label: selectedPlayer ? 'Your squares' : 'Find squares', reading: selectedPlayer ? `${squareCount} squares` : undefined,
      detail: selectedPlayer ? <><p>Selected name: {selectedPlayer}</p>{squareNumbers.length > 0 && <p>Squares {squareNumbers.join(', ')}</p>}<p>{stale ? 'Last known · ' : ''}{winsNow ? 'You’re winning right now.' : 'Not winning right now.'}</p></> : <p>Choose the name used on this board.</p>,
      actions: [
        ...(selectedPlayer && onViewSquares ? [{ label: 'View your squares', onClick: onViewSquares }] : []),
        ...(onFindSquares ? [{ label: selectedPlayer ? 'Choose another name' : 'Find my squares', onClick: onFindSquares }] : []),
        ...(live?.state === 'in' && onNextScores ? [{ label: 'See next scores', onClick: onNextScores }] : []),
      ] },
    { id: 'results', label: 'Results', reading: `${winnerHistory.length} published`, detail: <NotchResults winnerHistory={winnerHistory} pendingMilestones={pendingMilestones} leftLabel={leftLabel} topLabel={topLabel} /> },
  ];
  return <ContextNotch label="Score" placement="fixed" requested={requested} modules={modules} summary={<><span>{live ? `${leftLabel} ${live.leftScore} · ${topLabel} ${live.topScore} · ${score.periodLabel}` : 'Waiting for score'}</span><span>{authority} · {score.freshness || 'Checked time unavailable'}</span></>} />;
};

export default ViewerIsland;
