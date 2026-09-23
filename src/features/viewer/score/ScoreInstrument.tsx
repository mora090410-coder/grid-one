import React from 'react';
import type { BoardData, GameState, LiveGameData } from '../../../../types';
import { DigitFlow, Eyebrow, Glass, Numeral } from '../../../design/primitives';
import { buildViewerScoreModel } from './viewerScoreModel';
import { playersForDigits, quarterForLive } from '../scenarios/scenarioModel';
import { hasValidAxes } from '../../../../utils/boardValidation';

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
}

const ScoreInstrument: React.FC<ScoreInstrumentProps> = ({ game, board, live, liveStatus, isSynced, headingLevel = 'h1', surfaceClassName = '' }) => {
  const score = buildViewerScoreModel({ live, liveStatus, isSynced });
  const Heading = headingLevel;
  const quarter = quarterForLive(live);
  const currentNames = live ? playersForDigits(board, live.topScore % 10, live.leftScore % 10, quarter) : [];
  const stale = live?.freshness === 'stale' || live?.freshness === 'offline' || live?.freshness === 'refreshing';
  const topDigit = live ? live.topScore % 10 : null;
  const sideDigit = live ? live.leftScore % 10 : null;
  const leftLabel = game.leftAbbr || 'AWAY';
  const topLabel = game.topAbbr || 'HOME';

  return (
    <section className="flex flex-col gap-4" aria-labelledby="viewer-score-title">
      <div className="flex flex-col gap-2">
        <Eyebrow>{game.dates || 'Game date pending'}</Eyebrow>
        <Heading id="viewer-score-title" className="font-display text-[34px] leading-[1.05] tracking-[-0.01em] text-fg">{game.title || 'Football squares'}</Heading>
        <p className="font-ui text-[15px] text-fg-2">{leftLabel} at {topLabel}</p>
      </div>

      <Glass as="div" padding="lg" className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-4 ${surfaceClassName}`.trim()} aria-label="Score">
        <div className="flex flex-col gap-2 min-w-0">
          <Eyebrow>{game.leftName || leftLabel}</Eyebrow>
          {live ? <Numeral value={live.leftScore} size="lg" label={`${game.leftName || leftLabel} ${live.leftScore}`} /> : <span role="img" aria-label={`${game.leftName || leftLabel} score not yet available`} className="font-mono text-[36px] text-fg-3">—</span>}
        </div>
        <span className="font-mono text-[13px] text-fg-3 pb-2">{score.periodLabel}</span>
        <div className="flex flex-col items-end gap-2 min-w-0 text-right">
          <Eyebrow>{game.topName || topLabel}</Eyebrow>
          {live ? <Numeral value={live.topScore} size="lg" label={`${game.topName || topLabel} ${live.topScore}`} /> : <span role="img" aria-label={`${game.topName || topLabel} score not yet available`} className="font-mono text-[36px] text-fg-3">—</span>}
        </div>
      </Glass>

      <div className="flex flex-col gap-1 font-ui text-[15px] text-fg" role="status" aria-live="polite">
        <p>{live?.state === 'post' ? 'Final score matches:' : 'Currently matching:'} <strong className="font-medium">{!hasValidAxes(board) ? 'Numbers need review' : live && live.state !== 'pre' ? shortName(currentNames, 'Open square') : 'Waiting for score'}</strong></p>
        {hasValidAxes(board) && live && live.state !== 'pre' && <p>Square: <strong className="font-mono font-medium">{topLabel} <DigitFlow value={topDigit ?? ''} /> across × {leftLabel} <DigitFlow value={sideDigit ?? ''} /> down</strong></p>}
        <p className="text-fg-2"><strong className="font-medium text-fg">{score.authority.label}</strong> · {score.authority.detail}</p>
        <p className="font-mono text-[13px] text-fg-3">{stale ? 'Last known · ' : ''}{score.freshness || 'Checked time unavailable'} · {score.pollingText}</p>
        {score.phaseDetail && <p className="text-fg-3">{score.phaseDetail}</p>}
        {live?.warning && <p className="text-gold">{live.warning}</p>}
      </div>
    </section>
  );
};

export default ScoreInstrument;
