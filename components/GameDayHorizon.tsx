import React, { useMemo, useState } from 'react';
import {
  BoardData,
  GameState,
  LiveGameData,
  PendingMilestone,
  WinnerHighlights,
  WinnerResolution,
} from '../types';
import { getAxisForQuarter } from '../utils/winnerLogic';
import BoardGrid from './BoardGrid';
import NotificationOptIn from './NotificationOptIn';

type Highlight = { left: number; top: number } | null;
type WinnerQuarter = 'Q1' | 'Q2' | 'Q3' | 'Final';

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

const scoringEvents = [
  { label: 'Safety', points: 2 },
  { label: 'Field goal', points: 3 },
  { label: 'Touchdown', points: 6 },
  { label: 'TD + kick', points: 7 },
  { label: 'TD + two', points: 8 },
] as const;

const quarterForLive = (live: LiveGameData | null): WinnerQuarter => {
  if (!live || live.period <= 1) return 'Q1';
  if (live.period === 2) return 'Q2';
  if (live.period === 3) return 'Q3';
  return 'Final';
};

const playersForDigits = (
  board: BoardData,
  topDigit: number,
  leftDigit: number,
  quarter: WinnerQuarter,
) => {
  const topAxis = getAxisForQuarter(board, 'top', quarter);
  const leftAxis = getAxisForQuarter(board, 'left', quarter);
  const col = topAxis.indexOf(topDigit);
  const row = leftAxis.indexOf(leftDigit);
  return col < 0 || row < 0 ? [] : (board.squares[row * 10 + col] || []);
};

const periodLabel = (live: LiveGameData | null) => {
  if (!live) return 'Score unavailable';
  if (live.state === 'post') return 'Final';
  if (live.state === 'pre') return 'Pregame';
  if (live.period > 4 || live.isOvertime) return `OT · ${live.clock || 'In progress'}`;
  return `Q${Math.max(live.period, 1)} · ${live.clock || 'In progress'}`;
};

const authorityLabel = (live: LiveGameData | null, liveStatus: string, isSynced: boolean) => {
  if (!live && liveStatus.startsWith('MANUAL')) {
    return { label: 'Manual · awaiting entry', detail: 'The organizer has scoring authority', tone: 'manual' };
  }
  if (live?.isManual) return { label: 'Manual score', detail: 'Entered by the organizer', tone: 'manual' };
  if (!live) return { label: 'Score unavailable', detail: liveStatus || 'Try again shortly', tone: 'stale' };
  const source = live.sourceName || 'Automatic beta score';
  if (live.state === 'post') return { label: 'Final', detail: source, tone: 'final' };
  if (live.freshness === 'refreshing') return { label: 'Refreshing', detail: `${source} · last known score shown`, tone: 'stale' };
  if (live.freshness === 'offline') return { label: 'Offline · last known', detail: source, tone: 'stale' };
  if (live.freshness === 'rejected') return { label: 'Source rejected', detail: 'Organizer review needed', tone: 'stale' };
  if (live.freshness === 'stale') return { label: 'Stale · last known', detail: source, tone: 'stale' };
  if (live.state === 'in' && isSynced) return { label: 'Live', detail: source, tone: 'live' };
  if (live.state === 'pre') return { label: 'Pregame', detail: source, tone: 'pregame' };
  return { label: 'Last known score', detail: source, tone: 'stale' };
};

const formatFreshness = (live: LiveGameData | null) => {
  if (!live?.retrievedAt) return null;
  const timestamp = new Date(live.retrievedAt);
  if (Number.isNaN(timestamp.getTime())) return null;
  return `Checked ${timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

const shortName = (names: string[]) => {
  if (!names.length) return 'Unassigned';
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
  const currentQuarter = quarterForLive(live);
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
      ? board.squares.filter((names) => names.some((name) => name.toLowerCase() === selectedPlayer.toLowerCase())).length
      : 0,
    [board.squares, selectedPlayer],
  );
  const selectedParticipant = board.participants?.find(
    (participant) => participant.displayName.toLowerCase() === selectedPlayer.toLowerCase(),
  );
  const authority = authorityLabel(live, liveStatus, isSynced);
  const freshness = formatFreshness(live);
  const isLive = authority.tone === 'live';
  const isFinal = authority.tone === 'final';
  const horizonClass = isFinal ? 'gdh-final' : isLive ? 'gdh-live' : 'gdh-pregame';
  const isEmpty = !board.squares.some((names) => names.length);

  const scenarios = useMemo(() => {
    if (!live) return [];
    return [
      ...scoringEvents.map((event) => {
        const left = (live.leftScore + event.points) % 10;
        const top = live.topScore % 10;
        const names = playersForDigits(board, top, left, currentQuarter);
        return { ...event, team: game.leftAbbr, left, top, names };
      }),
      ...scoringEvents.map((event) => {
        const left = live.leftScore % 10;
        const top = (live.topScore + event.points) % 10;
        const names = playersForDigits(board, top, left, currentQuarter);
        return { ...event, team: game.topAbbr, left, top, names };
      }),
    ];
  }, [board, currentQuarter, game.leftAbbr, game.topAbbr, live]);
  const resolvedWinners = useMemo(() => winnerHistory.map((resolution) => ({
    label: resolution.milestone === 'Q2'
      ? 'Halftime'
      : resolution.milestone === 'FINAL'
        ? 'Final'
        : resolution.milestone,
    digits: `${resolution.topDigit} / ${resolution.sideDigit}`,
    name: resolution.participantName || 'Unassigned',
    resolvedAt: resolution.resolvedAt,
    corrected: Boolean(resolution.corrected),
    correctionReason: resolution.correctionReason,
    resolutionVersion: resolution.resolutionVersion || 1,
  })), [winnerHistory]);

  return (
    <main className={`gdh-stage ${horizonClass}`} aria-label={`${game.title || 'GridOne board'} game day`}>
      {emailResult && (
        <div className={`gdh-email-result ${emailResult.includes('invalid') || emailResult.includes('error') ? 'is-error' : ''}`} role="status">
          {emailResult === 'verified' && 'Winner emails are verified for this board name.'}
          {emailResult === 'unsubscribed' && 'Winner emails are turned off for this board name.'}
          {(emailResult === 'invalid' || emailResult === 'configuration-error') && 'That email verification link is invalid or expired.'}
          {emailResult === 'unsubscribe-invalid' && 'That unsubscribe link is invalid or expired.'}
        </div>
      )}
      <section className="gdh-score-field" aria-labelledby="game-state-title">
        <div className="gdh-score-meta">
          <p className="gdh-kicker">{game.title || 'Football squares'}</p>
          <p className="gdh-date">{game.dates || 'Game date to be announced'}</p>
        </div>

        <div className="gdh-score-line">
          <div className="gdh-team-score">
            <span>{game.leftAbbr || 'AWAY'}</span>
            <strong>{live?.leftScore ?? '—'}</strong>
          </div>

          <div className="gdh-current">
            <span id="game-state-title">{periodLabel(live)}</span>
            <strong>{live ? shortName(currentWinners) : 'Waiting for score'}</strong>
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
          <span>Score updates about every minute</span>
          {live?.detail && <span>{live.detail}</span>}
          {live?.warning && <span>{live.warning}</span>}
        </div>

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
            <p className="gdh-scenario-empty">Unlock GridOne services to add live scoring, automatic updates, winner scenarios, and notifications to this board.</p>
          ) : !live ? (
            <p className="gdh-scenario-empty">Scenarios appear when a score is available.</p>
          ) : (
            <div className="gdh-scenario-list">
              {scenarios.map((scenario) => {
                const helpsSelected = Boolean(selectedPlayer && scenario.names.some(
                  (name) => name.toLowerCase() === selectedPlayer.toLowerCase(),
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
                    <small>{helpsSelected ? 'Makes you the winner' : shortName(scenario.names)}</small>
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
                    <strong>{winner.name}</strong>
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
