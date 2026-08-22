import React, { useMemo, useState } from 'react';
import {
  BoardData,
  GameState,
  LiveGameData,
  PendingMilestone,
  WinnerHighlights,
  WinnerResolution,
} from '../types';
import { buildResolvedMilestoneRows } from '../features/viewer/milestones/milestoneViewModel';
import { buildScenarioModel, playersForDigits } from '../features/viewer/scenarios/scenarioModel';
import { buildViewerScoreModel } from '../features/viewer/score/viewerScoreModel';
import BoardGrid from './BoardGrid';
import NotificationOptIn from './NotificationOptIn';

type Highlight = { left: number; top: number } | null;

interface GameDayHorizonProps {
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
  highlightedCoords: Highlight;
  onScenarioFocus: (coords: Highlight) => void;
  locked?: boolean;
  shareCode?: string | null;
  servicesEnabled?: boolean;
  organizerPreview?: boolean;
}

const shortName = (names: string[], emptyLabel = 'Unassigned') => {
  if (!names.length) return emptyLabel;
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
};

const GameDayHorizon: React.FC<GameDayHorizonProps> = ({
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
  const [zoom, setZoom] = useState(1);
  const emailResult = new URLSearchParams(window.location.search).get('email');
  const scenarioModel = useMemo(
    () => buildScenarioModel({ board, game, live }),
    [board, game.leftAbbr, game.topAbbr, live],
  );
  const currentQuarter = scenarioModel.currentQuarter;
  const currentTopDigit = live ? live.topScore % 10 : null;
  const currentLeftDigit = live ? live.leftScore % 10 : null;
  const currentWinners = useMemo(
    () => currentTopDigit === null || currentLeftDigit === null
      ? []
      : playersForDigits(board, currentTopDigit, currentLeftDigit, currentQuarter),
    [board, currentLeftDigit, currentQuarter, currentTopDigit],
  );
  const selectedCount = useMemo(
    () => selectedPlayer
      ? board.squares.filter((names) => names.includes(selectedPlayer)).length
      : 0,
    [board.squares, selectedPlayer],
  );
  const selectedParticipant = board.participants?.find(
    (participant) => participant.displayName === selectedPlayer,
  );
  const scoreModel = buildViewerScoreModel({ live, liveStatus, isSynced });
  const authority = scoreModel.authority;
  const freshness = scoreModel.freshness;
  const isLive = authority.tone === 'live';
  const isFinal = authority.tone === 'final';
  const horizonClass = isFinal ? 'gdh-final' : isLive ? 'gdh-live' : 'gdh-pregame';
  const showOpenSquares = board.allowOpenSquares === true;
  const isEmpty = !board.squares.some((names) => names.length);
  const payoutRows = useMemo(() => ([
    ['Q1', 'Q1'],
    ['HALF', 'Halftime'],
    ['Q3', 'Q3'],
    ['FINAL', 'Final'],
  ] as const).flatMap(([key, label]) => {
    const description = game.payoutDescriptions?.[key]?.trim();
    return description ? [{ key, label, description }] : [];
  }), [game.payoutDescriptions]);
  const payoutNotes = game.payoutDescriptions?.notes?.trim();
  const hasPayoutDescriptions = payoutRows.length > 0 || Boolean(payoutNotes);

  const scenarios = scenarioModel.scenarios;
  const resolvedWinners = useMemo(
    () => buildResolvedMilestoneRows(winnerHistory),
    [winnerHistory],
  );

  return (
    <main className={`gdh-stage ${horizonClass}`} aria-label={`${game.title || 'GridOne board'} game day`}>
      {emailResult && (
        <div className={`gdh-email-result ${emailResult.includes('invalid') || emailResult.includes('error') ? 'is-error' : ''}`} role="status">
          {emailResult === 'verified' && 'Winner emails are verified for this board name.'}
          {emailResult === 'unsubscribed' && 'Winner emails are turned off for this board name.'}
          {emailResult === 'invalid' && 'That email verification link is invalid or expired.'}
          {emailResult === 'configuration-error' && 'Email verification is temporarily unavailable. Please try again later.'}
          {emailResult === 'unsubscribe-invalid' && 'That unsubscribe link is invalid or expired.'}
        </div>
      )}
      <section className="gdh-score-field" aria-labelledby="game-state-title">
        <div className="gdh-score-meta">
          <p className="gdh-kicker">{game.title || 'Football squares'}</p>
          {game.organizationDisplayName && (
            <p className="gdh-organization">{game.organizationDisplayName}</p>
          )}
          <p className="gdh-date">{game.dates || 'Game date to be announced'}</p>
        </div>

        <div className="gdh-score-line">
          <div className="gdh-team-score">
            <span>{game.leftAbbr || 'AWAY'}</span>
            <strong>{live?.leftScore ?? '—'}</strong>
          </div>

          <div className="gdh-current">
            <span id="game-state-title">{scoreModel.periodLabel}</span>
            <strong>{live ? shortName(currentWinners, showOpenSquares ? 'Open square' : 'Unassigned') : 'Waiting for score'}</strong>
            <small>Current {currentQuarter === 'Q2' ? 'halftime' : currentQuarter} result</small>
          </div>

          <div className="gdh-team-score">
            <span>{game.topAbbr || 'HOME'}</span>
            <strong>{live?.topScore ?? '—'}</strong>
          </div>
        </div>

        <div className="gdh-authority" role="status" aria-live="polite">
          <span className={isLive ? 'gdh-live-dot' : 'gdh-status-mark'} aria-hidden="true" />
          <strong>{authority.label}</strong>
          {live?.sourceUrl ? (
            <a href={live.sourceUrl} target="_blank" rel="noreferrer">{authority.detail}</a>
          ) : (
            <span>{authority.detail}</span>
          )}
          {freshness && <span>{freshness}{live?.freshness === 'stale' ? ' · stale' : ''}</span>}
          <span>{scoreModel.pollingText || 'Score updates about every minute'}</span>
          {live?.detail && <span>{live.detail}</span>}
          {live?.warning && <span>{live.warning}</span>}
        </div>

        {hasPayoutDescriptions && (
          <section className="mt-6 border border-gold bg-ink/30 p-5 text-broadcast-white" aria-labelledby="payouts-title">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="payouts-title" className="oa-headline !text-2xl">Payouts</h2>
              <span className="oa-slab text-xs text-gold">Organizer-published descriptions</span>
            </div>
            {payoutRows.length > 0 && (
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {payoutRows.map((row) => (
                  <div key={row.key} className="border-t border-broadcast-white/20 pt-2">
                    <dt className="oa-slab text-xs text-gold">{row.label}</dt>
                    <dd className="oa-body mt-1 text-sm text-broadcast-white">{row.description}</dd>
                  </div>
                ))}
              </dl>
            )}
            {payoutNotes && (
              <div id="board-rules" className="scroll-mt-6 mt-4 border-t border-broadcast-white/20 pt-3">
                <h3 className="oa-slab text-xs text-gold">Board rules / notes</h3>
                <p className="oa-body mt-1 text-sm text-broadcast-white">{payoutNotes}</p>
              </div>
            )}
            <p className="oa-body mt-4 text-xs text-broadcast-white/70">
              GridOne tracks the board. It does not collect square money or pay winners.
            </p>
          </section>
        )}

        <div className="gdh-personal-row">
          <button type="button" className="gdh-find-action" onClick={onFindSquares}>
            {selectedPlayer ? 'Choose another name' : 'Find my squares'}
          </button>
          {selectedPlayer ? (
            <div className="gdh-selected" aria-live="polite">
              <span>{selectedPlayer}</span>
              <strong>{selectedCount} {selectedCount === 1 ? 'square' : 'squares'}</strong>
              <button type="button" onClick={onClearPlayer} aria-label={`Clear ${selectedPlayer}`}>Clear</button>
            </div>
          ) : (
            <p>Select the name used by the organizer to trace your squares and winning paths.</p>
          )}
        </div>
        {selectedPlayer && servicesEnabled && (
          <NotificationOptIn
            shareCode={shareCode}
            participantId={selectedParticipant?.id}
            displayName={selectedPlayer}
          />
        )}
      </section>

      <div className="gdh-horizon" aria-hidden="true"><span /></div>

      <section className="gdh-board-field" aria-labelledby="board-title" data-board-locked={locked}>
        <aside className="gdh-scenarios" aria-labelledby="scenario-title">
          <div className="gdh-section-heading">
            <div>
              <p className="gdh-kicker">Current quarter</p>
              <h2 id="scenario-title">What score makes me win next?</h2>
            </div>
          </div>
          {!servicesEnabled ? (
            <p className="gdh-scenario-empty">Publish this board to add live scoring, automatic updates, winner scenarios, and notifications.</p>
          ) : !live ? (
            <p className="gdh-scenario-empty">Scenarios appear when a score is available.</p>
          ) : (
            <div className="gdh-scenario-list">
              {scenarios.map((scenario) => {
                const helpsSelected = Boolean(selectedPlayer && scenario.names.some(
                  (name) => name === selectedPlayer,
                ));
                return (
                  <button
                    type="button"
                    key={`${scenario.team}-${scenario.points}`}
                    className={helpsSelected ? 'gdh-scenario is-mine' : 'gdh-scenario'}
                    onMouseEnter={() => onScenarioFocus({ left: scenario.left, top: scenario.top })}
                    onMouseLeave={() => onScenarioFocus(null)}
                    onFocus={() => onScenarioFocus({ left: scenario.left, top: scenario.top })}
                    onBlur={() => onScenarioFocus(null)}
                    onClick={() => onScenarioFocus({ left: scenario.left, top: scenario.top })}
                  >
                    <span>{scenario.team} · {scenario.label} +{scenario.points}</span>
                    <strong>{scenario.top} / {scenario.left}</strong>
                    <small>{helpsSelected ? 'Makes you the winner' : shortName(scenario.names, showOpenSquares ? 'Open square' : 'Unassigned')}</small>
                  </button>
                );
              })}
            </div>
          )}
          {servicesEnabled && (
            <p className="gdh-scenario-note">
              These are arithmetic score outcomes, not odds or predictions.
            </p>
          )}
          {servicesEnabled && pendingMilestones.length > 0 && (
            <section className="gdh-pending-results" aria-labelledby="pending-results-title">
              <p className="gdh-kicker">Provisional · not settled</p>
              <h2 id="pending-results-title">Results pending confirmation</h2>
              <ul>
                {pendingMilestones.map((pending) => (
                  <li key={pending.milestone}>
                    <strong>{pending.milestone === 'Q2' ? 'Halftime' : pending.milestone} result pending confirmation</strong>
                    <span>{pending.topScore}–{pending.sideScore} · digits {pending.topDigit} / {pending.sideDigit}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {servicesEnabled && <section className="gdh-resolved" aria-labelledby="resolved-title">
            <p className="gdh-kicker">Completed milestones</p>
            <h2 id="resolved-title">Resolved winners</h2>
            {resolvedWinners.length ? (
              <ol>
                {resolvedWinners.map((winner) => (
                  <li key={`${winner.label}-${winner.resolutionVersion}`} className={winner.corrected ? 'is-corrected' : undefined}>
                    <span>{winner.label}</span>
                    <strong>
                      {winner.openSquare ? (
                        payoutNotes
                          ? <>Open square — <a href="#board-rules" className="underline underline-offset-2">see board rules</a></>
                          : 'Open square'
                      ) : winner.name}
                    </strong>
                    <small>{winner.digits}</small>
                    {winner.corrected && (
                      <em>Corrected result · {winner.correctionReason || 'Organizer correction'}</em>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p>No quarter has been resolved yet.</p>
            )}
          </section>}
        </aside>
        <div className="gdh-board-work">
          <div className="gdh-section-heading">
            <div>
              <p className="gdh-kicker">{servicesEnabled ? 'Published board' : 'Board preview'}</p>
              <h2 id="board-title">The exact grid</h2>
              <p>
                {!servicesEnabled && organizerPreview
                  ? 'Private draft · sharing and live services are off. Pan to inspect every square.'
                  : 'Pan to inspect. Tap or focus a square to reveal the organizer-entered name.'}
              </p>
            </div>
          </div>
          <div className="gdh-floating-board-controls">
            <button type="button" className="gdh-find-action" onClick={onFindSquares} aria-label="Find squares on the board">
              Find
            </button>
            <div className="gdh-zoom" aria-label="Board zoom">
              <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.25))} disabled={zoom === 1} aria-label="Zoom board out">−</button>
              <output aria-live="polite">{Math.round(zoom * 100)}%</output>
              <button type="button" onClick={() => setZoom((value) => Math.min(1.5, value + 0.25))} disabled={zoom === 1.5} aria-label="Zoom board in">+</button>
              <button type="button" onClick={() => setZoom(1)}>Reset</button>
            </div>
          </div>

          <div className="gdh-board-viewport" tabIndex={0} aria-label="Scrollable football squares board">
            {isEmpty && !organizerPreview ? (
              <div className="gdh-empty-board">
                <strong>This board has no assignments yet.</strong>
                <span>Ask the organizer to finish and publish the board.</span>
              </div>
            ) : (
              <div className="gdh-board-scale" style={{ width: `${zoom * 100}%` }}>
                <BoardGrid
                  board={board}
                  highlights={highlights}
                  live={live}
                  selectedPlayer={selectedPlayer}
                  highlightedCoords={highlightedCoords}
                  leftTeamName={game.leftName || game.leftAbbr}
                  topTeamName={game.topName || game.topAbbr}
                  showOpenSquares={showOpenSquares}
                />
              </div>
            )}
          </div>
        </div>

      </section>
    </main>
  );
};

export default GameDayHorizon;
