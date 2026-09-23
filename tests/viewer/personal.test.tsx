import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import YourSquaresSummary from '../../src/features/viewer/personal/YourSquaresSummary';
import ScenarioDisclosure from '../../src/features/viewer/scenarios/ScenarioDisclosure';
import BoardDetailsDisclosure from '../../src/features/viewer/details/BoardDetailsDisclosure';
import type { BoardData, GameState, LiveGameData, WinnerResolution } from '../../types';

const board: BoardData = { topAxis: [0,1,2,3,4,5,6,7,8,9], leftAxis: [0,1,2,3,4,5,6,7,8,9], squares: Array.from({ length: 100 }, () => []), participants: [{ id: 'p', displayName: 'Carrie Moss', publicLabel: 'Carrie Moss' }] };
board.squares[14] = ['Carrie Moss'];
board.squares[34] = ['Carrie Moss'];
const game: GameState = { title: 'GridOne Bowl', meta: '', leftAbbr: 'KC', leftName: 'Kansas City', topAbbr: 'PHI', topName: 'Philadelphia', dates: 'Sep 13', lockTitle: false, lockMeta: false };
const live: LiveGameData = { leftScore: 21, topScore: 14, quarterScores: { Q1: { left: 7, top: 0 }, Q2: { left: 7, top: 7 }, Q3: { left: 7, top: 7 }, Q4: { left: 0, top: 0 }, OT: { left: 0, top: 0 } }, clock: '8:12', period: 3, state: 'in', detail: '3rd quarter', isOvertime: false, sourceName: 'ESPN', retrievedAt: '2026-09-13T20:15:00.000Z', staleAfter: '2026-09-13T20:16:00.000Z', freshness: 'fresh' };

describe('YourSquaresSummary', () => {
  it('answers "what makes me win" in the headline when not winning now', () => {
    const oneAway: BoardData = { ...board, squares: board.squares.map((names, index) => index === 34 ? ['Dana Ruiz'] : names) };
    render(<YourSquaresSummary board={oneAway} game={game} live={live} selectedPlayer="Dana Ruiz" onViewSquare={vi.fn()} />);
    const region = screen.getByRole('region', { name: 'Dana Ruiz square summary' });
    expect(within(region).getByText('Not winning right now. Next winning score: KC Safety +2.')).toBeVisible();
  });

  it('shows one detailed list with the current match status first', () => {
    const onViewSquare = vi.fn();
    render(<YourSquaresSummary board={board} game={game} live={live} selectedPlayer="Carrie Moss" onViewSquare={onViewSquare} />);
    const region = screen.getByRole('region', { name: 'Carrie Moss square summary' });
    expect(within(region).getByText('2 squares')).toBeInTheDocument();
    const winsNow = within(region).getByText('You’re winning right now.');
    expect(winsNow.className).toContain('text-gold');
    const list = within(region).getByRole('list', { name: 'Your squares' });
    expect(within(region).getAllByRole('list')).toHaveLength(1);
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(winsNow.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(within(region).getByRole('button', { name: /View on board top 4 side 1/ }));
    expect(onViewSquare).toHaveBeenCalledWith({ top: 4, left: 1 });
    expect(within(region).getByText(/Next score: KC Safety \+2/)).toBeInTheDocument();
  });

  it('keeps a large selection compact, with the current match first and every square reachable', () => {
    const manySquares = { ...board, squares: Array.from({ length: 100 }, () => ['Carrie Moss']) };
    const onViewSquare = vi.fn();
    render(<YourSquaresSummary board={manySquares} game={game} live={live} selectedPlayer="Carrie Moss" onViewSquare={onViewSquare} />);
    const list = screen.getByRole('list', { name: 'Your squares' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('PHI column 4 × KC row 1');
    const expand = screen.getByRole('button', { name: 'Show all 100 squares' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(expand);
    expect(within(list).getAllByRole('listitem')).toHaveLength(100);
    fireEvent.click(screen.getByRole('button', { name: 'View on board top 9 side 9' }));
    expect(onViewSquare).toHaveBeenCalledWith({ top: 9, left: 9 });
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer squares' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
  });
});

describe('ScenarioDisclosure', () => {
  it('keeps matching scenarios first and the rest behind a closed disclosure', () => {
    render(<ScenarioDisclosure board={board} game={game} live={live} selectedPlayer="Carrie Moss" servicesEnabled onScenarioFocus={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'What score changes the next result?' })).toBeInTheDocument();
    const details = screen.getByText('All possible next scores').closest('details');
    expect(details?.open).toBe(false);
    expect(screen.getByText('Just math on the score. Not odds or predictions.')).toBeInTheDocument();
  });
});

describe('BoardDetailsDisclosure', () => {
  it('names milestones in the final record', () => {
    const history: WinnerResolution[] = [{ milestone: 'Q2', sideScore: 14, topScore: 7, sideDigit: 4, topDigit: 7, participantName: 'Carrie Moss', resolvedAt: '2026-09-13T21:00:00.000Z' }];
    render(<BoardDetailsDisclosure game={game} board={board} winnerHistory={history} final />);
    expect(screen.getByRole('heading', { name: 'Final record' })).toBeInTheDocument();
    expect(screen.getByText(/Halftime/)).toBeInTheDocument();
    expect(screen.getByText('Board details')).toBeInTheDocument();
  });

  it('shows the correction reason for a corrected result', () => {
    const history: WinnerResolution[] = [{
      milestone: 'FINAL',
      sideScore: 24,
      topScore: 17,
      sideDigit: 4,
      topDigit: 7,
      participantName: 'Carrie Moss',
      resolvedAt: '2026-09-13T22:00:00.000Z',
      corrected: true,
      correctedAt: '2026-09-13T22:05:00.000Z',
      correctionReason: 'Official final score corrected',
      versions: [{
        resolutionVersion: 1,
        sideScore: 23,
        topScore: 17,
        sideDigit: 3,
        topDigit: 7,
        participantName: 'Ann Lee',
        resolvedAt: '2026-09-13T21:55:00.000Z',
        corrected: false,
      }],
    }];
    render(<BoardDetailsDisclosure game={game} board={board} winnerHistory={history} final />);
    expect(screen.getByText(/Official final score corrected/)).toBeInTheDocument();
    expect(screen.getByText(/Previously Ann Lee/)).toBeInTheDocument();
  });
});
