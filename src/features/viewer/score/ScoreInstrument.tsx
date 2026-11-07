import React, { useEffect, useRef } from 'react';
import type { BoardData, GameState, LiveGameData } from '../../../../types';
import { DigitFlow, Eyebrow, Glass, Numeral } from '../../../design/primitives';
import { buildViewerScoreModel } from './viewerScoreModel';
import { playersForDigits, quarterForLive, squareIndexForDigits } from '../scenarios/scenarioModel';
import { hasValidAxes } from '../../../../utils/boardValidation';
import TeamStripe from '../teams/TeamStripe';

const shortName = (names: string[], empty = 'Unassigned') => {
  if (!names.length) return empty;
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
};

export interface ScoreInstrumentProps {
  game: GameState;
  board: BoardData;
  live: LiveGameData | null;
  liveStatus: string;
  isSynced: boolean;
  /** The real viewer is the page's one h1; a shell that previews the viewer (e.g. the homepage organizer preview) renders h2. */
  headingLevel?: 'h1' | 'h2';
  /** Extra chrome on the score panel. Demo uses the marketing glass surface. */
  surfaceClassName?: string;
  liquid?: boolean;
  simulated?: boolean;
  winFocus?: boolean;
  onWinnerVisibilityChange?: (visible: boolean) => void;
  selectedPlayer?: string;
  winsNow?: boolean;
}

const ScoreInstrument: React.FC<ScoreInstrumentProps> = ({ game, board, live, liveStatus, isSynced, headingLevel = 'h1', surfaceClassName = '', liquid = false, simulated = false, selectedPlayer = '', winsNow = false, winFocus = false, onWinnerVisibilityChange }) => {
  const sourceScore = buildViewerScoreModel({ live, liveStatus, isSynced });
  const score = simulated ? { ...sourceScore, authority: { ...sourceScore.authority, label: 'Sample game', detail: 'Simulated score · not a live feed' }, freshness: 'Simulated', pollingText: 'Example only · scores do not update' } : sourceScore;
  const Heading = headingLevel;
  const quarter = quarterForLive(live);
  const currentNames = live ? playersForDigits(board, live.topScore % 10, live.leftScore % 10, quarter) : [];
  const stale = live?.freshness === 'stale' || live?.freshness === 'offline' || live?.freshness === 'refreshing';
  const personalWin = Boolean(liquid && selectedPlayer && winsNow && live?.state === 'in' && !stale && live.freshness !== 'rejected' && isSynced);
  const topDigit = live ? live.topScore % 10 : null;
  const sideDigit = live ? live.leftScore % 10 : null;
  const winnerCard = useRef<HTMLElement>(null);
  const eligibleWin = Boolean(liquid && live?.state === 'in' && !stale && live.freshness !== 'rejected' && isSynced && hasValidAxes(board));
  useEffect(() => {
    const node = winnerCard.current;
    if (!node || !eligibleWin) { onWinnerVisibilityChange?.(false); return; }
    const update = () => {
      const r = node.getBoundingClientRect();
      onWinnerVisibilityChange?.(r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth && getComputedStyle(node).display !== 'none');
    };
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(update) : null;
    observer?.observe(node); update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { observer?.disconnect(); window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [eligibleWin, personalWin, onWinnerVisibilityChange]);
  const leftLabel = game.leftAbbr || 'AWAY';
  const topLabel = game.topAbbr || 'HOME';

  return (
    <section className={`flex flex-col gap-4${liquid ? ' g1-score-section' : ''}`} aria-labelledby="viewer-score-title">
      <div className="flex flex-col gap-2">
        <Eyebrow>{game.dates || 'Game date pending'}</Eyebrow>
        <Heading id="viewer-score-title" className="font-display text-[34px] leading-[1.05] text-fg">{game.title || 'Football squares'}</Heading>
        <p className="font-ui text-[15px] text-fg-2">{leftLabel} at {topLabel}</p>
      </div>

      {liquid && live && live.state !== 'pre' && hasValidAxes(board) && <Glass as="section" ref={winnerCard} padding="lg" className={`g1-current-card g1-sheen${winFocus && eligibleWin ? ' g1-win-focus' : ''}`} data-g1-personal-win={personalWin ? 'true' : undefined} data-g1-blur="true">
        {eligibleWin && <span key={`${quarter}-${topDigit}-${sideDigit}`} className="g1-win-sweep" aria-hidden="true" />}
        <h2 className="g1-label"><span className={personalWin ? 'g1-only-desktop' : undefined}>{live.state === 'post' ? 'Final score matches:' : stale || live.freshness === 'rejected' || !isSynced ? 'Last known' : 'Winning right now'}</span>{personalWin && <span className="g1-only-phone">You’re winning {quarter}</span>}</h2>
        <p className="g1-big-number"><span className={personalWin ? 'g1-only-desktop' : undefined}>{shortName(currentNames, 'Open square')}</span>{personalWin && <span className="g1-only-phone">Square {squareIndexForDigits(board, live.topScore % 10, live.leftScore % 10, quarter) + 1}</span>}</p>
        <p className="g1-label">Square {squareIndexForDigits(board, live.topScore % 10, live.leftScore % 10, quarter) + 1}</p>
      </Glass>}
      <Glass as="div" padding="lg" data-g1-blur={liquid ? 'true' : undefined} className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-4 ${liquid ? 'g1-sheen' : ''} ${surfaceClassName}`.trim()} aria-label="Score">
        <div className="flex flex-col gap-2 min-w-0">
          <span className="flex items-center gap-1.5 min-w-0"><TeamStripe abbr={game.leftAbbr} /><span className="min-w-0 break-words"><Eyebrow>{game.leftName || leftLabel}</Eyebrow></span></span>
          {live ? <Numeral value={live.leftScore} size="lg" label={`${game.leftName || leftLabel} ${live.leftScore}`} /> : <span role="img" aria-label={`${game.leftName || leftLabel} score not yet available`} className="font-mono text-[36px] text-fg-3">—</span>}
        </div>
        <span className="font-mono text-[13px] text-fg-3 pb-2">{score.periodLabel}</span>
        <div className="flex flex-col items-end gap-2 min-w-0 text-right">
          <span className="flex items-center justify-end gap-1.5 min-w-0"><span className="min-w-0 break-words"><Eyebrow>{game.topName || topLabel}</Eyebrow></span><TeamStripe abbr={game.topAbbr} /></span>
          {live ? <Numeral value={live.topScore} size="lg" label={`${game.topName || topLabel} ${live.topScore}`} /> : <span role="img" aria-label={`${game.topName || topLabel} score not yet available`} className="font-mono text-[36px] text-fg-3">—</span>}
        </div>
      </Glass>

      <div className="flex flex-col gap-1 font-ui text-[15px] text-fg">
        <div role="status" aria-live="polite" aria-atomic="true">
        <p>{live?.state === 'post' ? 'Final score matches:' : 'Currently matching:'} <strong className="font-medium">{!hasValidAxes(board) ? 'Numbers need review' : live && live.state !== 'pre' ? shortName(currentNames, 'Open square') : 'Waiting for score'}</strong></p>
        {hasValidAxes(board) && live && live.state !== 'pre' && <p>Square: <strong className="font-mono font-medium">{topLabel} <DigitFlow value={topDigit ?? ''} /> across × {leftLabel} <DigitFlow value={sideDigit ?? ''} /> down</strong></p>}
        <p className="text-fg-2"><strong className="font-medium text-fg">{score.authority.label}</strong> · <span>{score.authority.detail}</span></p>
        </div>
        <p className="font-mono text-[13px] text-fg-3">{stale ? 'Last known · ' : ''}{score.freshness || 'Checked time unavailable'} · {score.pollingText}</p>
        {score.phaseDetail && <p className="text-fg-3">{score.phaseDetail}</p>}
        {live?.warning && <p className="font-medium text-fg">{live.warning}</p>}
      </div>
    </section>
  );
};

export default ScoreInstrument;
