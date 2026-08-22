import React from 'react';
import type { BoardData, GameState, LiveGameData } from '../../../types';
import { buildViewerScoreModel } from './viewerScoreModel';
import { playersForDigits, quarterForLive } from '../scenarios/scenarioModel';

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
}

const ScoreInstrument: React.FC<ScoreInstrumentProps> = ({ game, board, live, liveStatus, isSynced }) => {
  const score = buildViewerScoreModel({ live, liveStatus, isSynced });
  const quarter = quarterForLive(live);
  const currentNames = live ? playersForDigits(board, live.topScore % 10, live.leftScore % 10, quarter) : [];
  const stale = live?.freshness === 'stale' || live?.freshness === 'offline' || live?.freshness === 'refreshing';

  return (
    <section className="border-b border-broadcast-white/20 pb-5" aria-labelledby="viewer-score-title">
      <p className="oa-slab text-xs uppercase tracking-[0.18em] text-gold">{game.dates || 'Game date pending'}</p>
      <h1 id="viewer-score-title" className="oa-headline mt-2 text-3xl text-broadcast-white">{game.title || 'Football squares'}</h1>
      <p className="oa-body mt-1 text-broadcast-white/75">{game.leftAbbr || 'AWAY'} at {game.topAbbr || 'HOME'}</p>

      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3" aria-label="Score">
        <div className="border border-broadcast-white/20 bg-ink/40 p-3 text-center">
          <span className="oa-slab block text-sm text-broadcast-white/70">{game.leftAbbr || 'AWAY'}</span>
          <strong className="oa-data block text-4xl text-broadcast-white">{live?.leftScore ?? '—'}</strong>
        </div>
        <div className="oa-slab text-broadcast-white/50">at</div>
        <div className="border border-broadcast-white/20 bg-ink/40 p-3 text-center">
          <span className="oa-slab block text-sm text-broadcast-white/70">{game.topAbbr || 'HOME'}</span>
          <strong className="oa-data block text-4xl text-broadcast-white">{live?.topScore ?? '—'}</strong>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-broadcast-white" role="status" aria-live="polite">
        <p><strong>{score.periodLabel}</strong> · Current result: <strong>{live ? shortName(currentNames) : 'Waiting for score'}</strong></p>
        <p><strong>{score.authority.label}</strong> · {score.authority.detail}</p>
        <p>{stale ? 'Last known · ' : ''}{score.freshness || 'Checked time unavailable'} · {score.pollingText}</p>
        {live?.detail && <p className="text-broadcast-white/70">{live.detail}</p>}
        {live?.warning && <p className="text-gold">{live.warning}</p>}
      </div>
    </section>
  );
};

export default ScoreInstrument;
