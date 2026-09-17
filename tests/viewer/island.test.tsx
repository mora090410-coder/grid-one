import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ViewerIsland from '../../src/features/viewer/shell/ViewerIsland';
import type { BoardData, GameState, LiveGameData } from '../../types';

const board: BoardData = { topAxis: [0,1,2,3,4,5,6,7,8,9], leftAxis: [0,1,2,3,4,5,6,7,8,9], squares: Array.from({ length: 100 }, () => []) };
const game: GameState = { title: 'GridOne Bowl', meta: '', leftAbbr: 'KC', leftName: 'Kansas City', topAbbr: 'PHI', topName: 'Philadelphia', dates: 'Sep 13', lockTitle: false, lockMeta: false };
const live: LiveGameData = { leftScore: 21, topScore: 14, quarterScores: { Q1: { left: 7, top: 0 }, Q2: { left: 7, top: 7 }, Q3: { left: 7, top: 7 }, Q4: { left: 0, top: 0 }, OT: { left: 0, top: 0 } }, clock: '8:12', period: 3, state: 'in', detail: '3rd quarter', isOvertime: false, sourceName: 'ESPN', retrievedAt: '2026-09-13T20:15:00.000Z', staleAfter: '2026-09-13T20:16:00.000Z', freshness: 'fresh' };

describe('ViewerIsland', () => {
  it('shows the score strip collapsed and trust details expanded', () => {
    render(<ViewerIsland game={game} board={board} live={live} liveStatus="LIVE" isSynced selectedPlayer="" yourSquares={0} winsNow={false} />);
    const toggle = screen.getByRole('button', { name: /Score/ });
    expect(toggle).toHaveTextContent('KC 21');
    expect(toggle).toHaveTextContent('PHI 14');
    expect(screen.queryByRole('region', { name: 'Game details' })).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText(/Score updates about every three minutes/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Game details' })).toHaveTextContent('ESPN');
  });

  it('shows the selected square count and current match in the personal module, without a probability ring', () => {
    render(<ViewerIsland game={game} board={board} live={live} liveStatus="LIVE" isSynced selectedPlayer="Carrie Moss" yourSquares={3} winsNow />);
    fireEvent.click(screen.getByRole('button', { name: /Score/ }));
    expect(screen.getByRole('button', { name: 'Your squares' })).toHaveTextContent('3 squares');
    fireEvent.click(screen.getByRole('button', { name: 'Your squares' }));
    expect(screen.getByText('Selected name: Carrie Moss')).toBeInTheDocument();
    expect(screen.getByText('Currently matching: one of your squares.')).toBeInTheDocument();
  });

  it('honestly labels an unavailable score rather than inventing zeroes', () => {
    render(<ViewerIsland game={game} board={board} live={null} liveStatus="PREGAME" isSynced={false} selectedPlayer="" yourSquares={0} winsNow={false} />);
    expect(screen.getByRole('button', { name: 'Score' })).toHaveTextContent('Waiting for score');
    expect(screen.getByRole('button', { name: 'Score' })).toHaveTextContent('Score unavailable');
  });
});
