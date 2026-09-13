import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ScoreInstrument from '../../src/features/viewer/score/ScoreInstrument';
import type { BoardData, GameState, LiveGameData } from '../../types';

const board: BoardData = { topAxis: [0,1,2,3,4,5,6,7,8,9], leftAxis: [0,1,2,3,4,5,6,7,8,9], squares: Array.from({ length: 100 }, () => []) };
board.squares[14] = ['Carrie Moss'];
const game: GameState = { title: 'GridOne Bowl', meta: '', leftAbbr: 'KC', leftName: 'Kansas City', topAbbr: 'PHI', topName: 'Philadelphia', dates: 'Sep 13', lockTitle: false, lockMeta: false };
const live = (o: Partial<LiveGameData> = {}): LiveGameData => ({ leftScore: 21, topScore: 14, quarterScores: { Q1: { left: 7, top: 0 }, Q2: { left: 7, top: 7 }, Q3: { left: 7, top: 7 }, Q4: { left: 0, top: 0 }, OT: { left: 0, top: 0 } }, clock: '8:12', period: 3, state: 'in', detail: '3rd quarter', isOvertime: false, sourceName: 'ESPN', retrievedAt: '2026-09-13T20:15:00.000Z', staleAfter: '2026-09-13T20:16:00.000Z', freshness: 'fresh', ...o });

describe('ScoreInstrument', () => {
  it('renders identity, accessible numerals, and the trust sentences', () => {
    render(<ScoreInstrument game={game} board={board} live={live()} liveStatus="LIVE" isSynced />);
    expect(screen.getByRole('heading', { level: 1, name: 'GridOne Bowl' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Kansas City 21' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Philadelphia 14' })).toBeInTheDocument();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/Currently matching/);
    expect(status).toHaveTextContent('Carrie Moss');
    expect(status).toHaveTextContent('PHI 4 across × KC 1 down');
    expect(status).toHaveTextContent(/Score updates about every three minutes/);
    expect(status).toHaveTextContent(/Checked/);
    expect(screen.getAllByText('Q3 · 8:12')).toHaveLength(1);
    expect(screen.queryByText('3rd quarter')).toBeNull();
  });

  it('marks stale scores as last known', () => {
    render(<ScoreInstrument game={game} board={board} live={live({ freshness: 'offline' })} liveStatus="LIVE" isSynced />);
    expect(screen.getByRole('status')).toHaveTextContent(/Offline · last known/);
    expect(screen.getByRole('status')).toHaveTextContent(/Last known · /);
  });

  it('shows dashes before a score exists', () => {
    render(<ScoreInstrument game={game} board={board} live={null} liveStatus="PREGAME" isSynced={false} />);
    expect(screen.getAllByText('—').length).toBe(2);
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for score');
    expect(screen.getByRole('img', { name: 'Kansas City score not yet available' })).toBeInTheDocument();
  });
});

it('preserves meaningful provider phase details', () => {
  render(<ScoreInstrument game={game} board={board} live={live({ detail: 'Halftime' })} liveStatus="LIVE" isSynced />);
  expect(screen.getByText('Halftime')).toBeVisible();
});
