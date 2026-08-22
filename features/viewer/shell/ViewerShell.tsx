import React, { useMemo, useState } from 'react';
import type { BoardData, GameState, LiveGameData, PendingMilestone, WinnerHighlights, WinnerResolution } from '../../../types';
import ViewerBoardGrid from '../board/ViewerBoardGrid';
import ScoreInstrument from '../score/ScoreInstrument';
import FindSquaresEntry from '../identity/FindSquaresEntry';
import YourSquaresSummary from '../personal/YourSquaresSummary';
import ScenarioDisclosure from '../scenarios/ScenarioDisclosure';
import WinnerEmailDisclosure from '../notifications/WinnerEmailDisclosure';
import BoardDetailsDisclosure from '../details/BoardDetailsDisclosure';

export interface ViewerShellProps {
  game: GameState;
  board: BoardData;
  live: LiveGameData | null;
  liveStatus: string;
  isSynced: boolean;
  highlights: WinnerHighlights;
  winnerHistory: WinnerResolution[];
  pendingMilestones: PendingMilestone[];
  selectedPlayer: string;
  onClearPlayer: () => void;
  onFindSquares: () => void;
  highlightedCoords: { left: number; top: number } | null;
  onScenarioFocus: (coords: { left: number; top: number } | null) => void;
  locked?: boolean;
  shareCode?: string | null;
  servicesEnabled?: boolean;
  organizerPreview?: boolean;
}

const ViewerShell: React.FC<ViewerShellProps> = ({
  game,
  board,
  live,
  liveStatus,
  isSynced,
  highlights,
  winnerHistory,
  pendingMilestones,
  selectedPlayer,
  onClearPlayer,
  onFindSquares,
  highlightedCoords,
  onScenarioFocus,
  locked = false,
  shareCode,
  servicesEnabled = true,
  organizerPreview = false,
}) => {
  const [boardFocus, setBoardFocus] = useState(highlightedCoords);
  const selectedParticipant = useMemo(() => {
    const matches = board.participants?.filter((participant) => participant.displayName === selectedPlayer) || [];
    return matches.length === 1 ? matches[0] : undefined;
  },
    [board.participants, selectedPlayer],
  );
  const isFinal = live?.state === 'post';
  const isEmpty = !board.squares.some((names) => names.length > 0);
  const showNotification = Boolean(servicesEnabled && !organizerPreview && shareCode && selectedParticipant?.id);

  const setFocus = (coords: { left: number; top: number } | null) => {
    setBoardFocus(coords);
    onScenarioFocus(coords);
  };

  return (
    <main
      className="min-h-[100dvh] bg-ink px-4 py-4 text-broadcast-white md:px-6"
      aria-label={`${game.title || 'GridOne board'} viewer`}
      data-feature-flag="viewer_v2"
      data-variant="viewer_v2:on"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <div data-testid="viewer-first-viewport" className="min-w-0">
          <ScoreInstrument game={game} board={board} live={live} liveStatus={liveStatus} isSynced={isSynced} />
          <FindSquaresEntry selectedPlayer={selectedPlayer} onFindSquares={onFindSquares} onClearPlayer={onClearPlayer} />
          <YourSquaresSummary board={board} game={game} live={live} selectedPlayer={selectedPlayer} onViewSquare={setFocus} />
          {pendingMilestones.length > 0 && servicesEnabled && (
            <section className="border-t border-broadcast-white/20 py-5" aria-labelledby="pending-results-title">
              <h2 id="pending-results-title" className="oa-headline text-xl text-broadcast-white">Pending confirmation</h2>
              <ul className="mt-2 grid gap-2 text-sm text-broadcast-white/75">
                {pendingMilestones.map((pending) => (
                  <li key={pending.milestone}>{pending.milestone} · {pending.topScore}-{pending.sideScore} · digits {pending.topDigit}/{pending.sideDigit}</li>
                ))}
              </ul>
            </section>
          )}
          <WinnerEmailDisclosure
            shareCode={shareCode}
            participantId={selectedParticipant?.id}
            displayName={selectedPlayer}
            enabled={showNotification}
          />
          <ScenarioDisclosure
            board={board}
            game={game}
            live={live}
            selectedPlayer={selectedPlayer}
            servicesEnabled={servicesEnabled}
            onScenarioFocus={setFocus}
          />
          <BoardDetailsDisclosure game={game} board={board} winnerHistory={winnerHistory} final={Boolean(isFinal)} />
        </div>

        <section className="min-w-0" aria-labelledby="viewer-board-title" data-board-locked={locked}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="oa-slab text-xs uppercase tracking-[0.18em] text-gold">Published board</p>
              <h2 id="viewer-board-title" className="oa-headline text-2xl text-broadcast-white">Board</h2>
            </div>
            <button type="button" className="oa-slab min-h-11 border border-broadcast-white/30 px-3 text-broadcast-white" style={{ minHeight: 44 }} onClick={onFindSquares}>Find</button>
          </div>
          <div className="overflow-auto border border-broadcast-white/20 bg-broadcast-white p-2 text-ink" aria-label="Scrollable football squares board">
            {isEmpty && !organizerPreview ? (
              <div className="p-6 text-center text-ink">This board has no assignments yet.</div>
            ) : (
              <ViewerBoardGrid
                board={board}
                game={game}
                highlights={highlights}
                winnerHistory={winnerHistory}
                pendingMilestones={pendingMilestones}
                live={live}
                selectedPlayer={selectedPlayer}
                highlightedCoords={boardFocus}
                showOpenSquares={board.allowOpenSquares === true}
                onFindSquares={onFindSquares}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default ViewerShell;
