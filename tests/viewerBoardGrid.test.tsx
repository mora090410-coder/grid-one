import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ViewerBoardGrid from '../src/features/viewer/board/ViewerBoardGrid';
import ViewerShell from '../src/features/viewer/shell/ViewerShell';
import type { BoardData, GameState, LiveGameData, WinnerResolution } from '../types';

const board: BoardData = {
  topAxis: [9, 4, 1, 7, 0, 8, 3, 6, 2, 5],
  leftAxis: [6, 2, 7, 1, 9, 4, 0, 5, 8, 3],
  squares: Array.from({ length: 100 }, () => []),
  allowOpenSquares: true,
  participants: [{ id: 'ann', displayName: 'Ann Lee', publicLabel: 'Ann Lee' }],
};
board.squares[2 * 10 + 1] = ['Ann Lee'];
board.squares[0 * 10 + 3] = ['Ann Lee'];

const game: GameState = {
  title: 'Published Week 1',
  meta: '',
  leftAbbr: 'DAL',
  leftName: 'Dallas Cowboys',
  topAbbr: 'WAS',
  topName: 'Washington Commanders',
  dates: '2026-09-13',
  lockTitle: false,
  lockMeta: false,
};

const live: LiveGameData = {
  leftScore: 17,
  topScore: 24,
  quarterScores: { Q1: { left: 3, top: 7 }, Q2: { left: 7, top: 7 }, Q3: { left: 7, top: 3 }, Q4: { left: 0, top: 7 }, OT: { left: 0, top: 0 } },
  clock: '2:31',
  period: 4,
  state: 'in',
  detail: 'Fourth quarter',
  isOvertime: false,
};

const winnerHistory: WinnerResolution[] = [
  { milestone: 'FINAL', topDigit: 4, sideDigit: 7, participantName: 'Ann Lee', corrected: true, correctionReason: 'Official score correction', resolvedAt: '2026-09-13T22:00:00.000Z', resolutionVersion: 2 },
  { milestone: 'Q1', topDigit: 7, sideDigit: 6, participantName: 'Ann Lee', corrected: false, correctionReason: '', resolvedAt: '2026-09-13T20:15:00.000Z', resolutionVersion: 1 },
];

const renderGrid = () => render(
  <ViewerBoardGrid
    board={board}
    game={game}
    live={live}
    highlights={{ quarterWinners: { Q3: '4-7' }, currentLabel: 'NOW' }}
    winnerHistory={winnerHistory}
    pendingMilestones={[{ milestone: 'Q3', topScore: 24, sideScore: 17, topDigit: 4, sideDigit: 7, stableSince: '', lastObservedAt: '', successfulReadCount: 2 }]}
    selectedPlayer="Ann Lee"
    highlightedCoords={{ top: 4, left: 7 }}
    showOpenSquares
  />
);

describe('ViewerBoardGrid Slice 7', () => {
  it('renders sticky axes with actual team abbreviations and an across/down orientation explanation', () => {
    renderGrid();
    const grid = screen.getByRole('grid', { name: /football squares board/i });
    expect(grid).toHaveAttribute('aria-rowcount', '11');
    expect(grid).toHaveAttribute('aria-colcount', '12');
    expect(grid.querySelectorAll('col')).toHaveLength(12);
    expect(within(grid).getByText('Top · WAS')).toBeVisible();
    expect(within(grid).getByText('Side · DAL')).toBeVisible();
    expect(screen.getByText(/Columns: Washington Commanders — digit 4.*Rows: Dallas Cowboys — digit 7.*Current square: WAS 4 across × DAL 7 down/i)).toBeVisible();
    expect(within(grid).getByRole('columnheader', { name: /Washington Commanders top digit 4/i })).toHaveAttribute('data-sticky-axis', 'top');
    expect(within(grid).getByRole('rowheader', { name: /Dallas Cowboys side digit 7/i })).toHaveAttribute('data-sticky-axis', 'side');
  });

  it('uses one tab stop and roves with arrows, Home, End, Ctrl+Home, and Ctrl+End', () => {
    renderGrid();
    const grid = screen.getByRole('grid', { name: /football squares board/i });
    const cells = within(grid).getAllByRole('gridcell');
    expect(cells.filter((cell) => cell.getAttribute('tabindex') === '0')).toHaveLength(1);

    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: 'ArrowRight' });
    expect(within(grid).getByRole('gridcell', { name: /coordinate row 1 column 2,/i })).toHaveFocus();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(within(grid).getByRole('gridcell', { name: /coordinate row 2 column 2,/i })).toHaveFocus();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
    expect(within(grid).getByRole('gridcell', { name: /coordinate row 2 column 10,/i })).toHaveFocus();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' });
    expect(within(grid).getByRole('gridcell', { name: /coordinate row 2 column 1,/i })).toHaveFocus();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End', ctrlKey: true });
    expect(within(grid).getByRole('gridcell', { name: /coordinate row 10 column 10,/i })).toHaveFocus();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home', ctrlKey: true });
    expect(within(grid).getByRole('gridcell', { name: /coordinate row 1 column 1,/i })).toHaveFocus();
    expect(cells.filter((cell) => cell.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it('exposes assignment/OPEN coordinate digits and distinct state attributes', () => {
    renderGrid();
    const grid = screen.getByRole('grid', { name: /football squares board/i });
    const ann = within(grid).getByRole('gridcell', { name: /Ann Lee.*coordinate row 3 column 2.*top digit 4.*side digit 7.*current result.*corrected FINAL result/i });
    expect(ann).toHaveAttribute('aria-selected', 'true');
    expect(ann).toHaveAttribute('data-current', 'true');
    expect(ann).toHaveAttribute('data-resolved', 'true');
    expect(ann).toHaveAttribute('data-corrected', 'true');
    expect(ann).toHaveAttribute('data-open', 'false');
    expect(ann).toHaveClass('ring-gold');
    expect(ann).toHaveClass('text-broadcast-white');
    expect(within(ann).getByText('NOW')).toBeVisible();
    expect(within(ann).getByText('C')).toBeVisible();

    const open = within(grid).getByRole('gridcell', { name: /OPEN.*coordinate row 1 column 2.*top digit 4.*side digit 6/i });
    expect(open).toHaveAttribute('data-open', 'true');

    const selectedResolved = within(grid).getByRole('gridcell', { name: /Ann Lee.*coordinate row 1 column 4.*top digit 7.*side digit 6/i });
    expect(selectedResolved).toHaveAttribute('aria-selected', 'true');
    expect(selectedResolved).toHaveAttribute('data-current', 'false');
    expect(selectedResolved).toHaveAttribute('data-resolved', 'true');
    expect(selectedResolved).toHaveClass('border-gold');
    expect(selectedResolved).toHaveClass('ring-tone-cardinal');
  });

  it('gives every cell a short reveal with its name and digits', () => {
    renderGrid();
    const grid = screen.getByRole('grid', { name: /football squares board/i });
    within(grid).getAllByRole('gridcell').forEach((cell) => {
      const reveal = cell.querySelector('span[aria-hidden="true"]');
      expect(reveal).not.toBeNull();
      expect(reveal).toHaveTextContent(/across · .* down/);
      expect(reveal?.className).toContain('max-w-[220px]');
    });
  });

  it('renders zoom/find/center controls as 44px targets', () => {
    const { container } = renderGrid();
    for (const name of [/Zoom out/i, /Center current result/i, /Zoom in/i, /^Fit$/i, /Center selected square/i]) {
      expect(screen.getByRole('button', { name })).toHaveStyle({ minHeight: '44px', minWidth: '44px' });
    }
    expect(screen.getByRole('status', { name: 'Current zoom' })).toHaveTextContent('100%');
    const viewport = container.querySelector('.gridone-viewer-board-viewport') as HTMLDivElement;
    const scrollTo = vi.fn();
    Object.defineProperties(viewport, {
      clientWidth: { value: 320, configurable: true },
      clientHeight: { value: 240, configurable: true },
      scrollTo: { value: scrollTo, configurable: true },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(screen.getByRole('status', { name: 'Current zoom' })).toHaveTextContent('50%');
    fireEvent.click(screen.getByRole('button', { name: 'Center current result' }));
    fireEvent.click(screen.getByRole('button', { name: 'Center selected square' }));
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  });

  it('emphasizes a newly matching square without moving the grid', () => {
    const { rerender } = renderGrid();
    expect(document.querySelector('[data-match-emphasis="on"]')).toBeNull();
    rerender(
      <ViewerBoardGrid
        board={board}
        game={game}
        live={{ ...live, leftScore: 18 }}
        highlights={{ quarterWinners: { Q3: '4-7' }, currentLabel: 'NOW' }}
        winnerHistory={winnerHistory}
        pendingMilestones={[{ milestone: 'Q3', topScore: 24, sideScore: 17, topDigit: 4, sideDigit: 7, stableSince: '', lastObservedAt: '', successfulReadCount: 2 }]}
        selectedPlayer="Ann Lee"
        highlightedCoords={{ top: 4, left: 7 }}
        showOpenSquares
      />
    );
    const emphasized = document.querySelectorAll('[data-match-emphasis="on"]');
    expect(emphasized).toHaveLength(1);
    expect(emphasized[0]).toHaveAttribute('data-current', 'true');
    expect(emphasized[0].className).not.toMatch(/scale|translate/);
  });

  it('ViewerShell uses the viewer grid and leaves legacy dynamic quarter controls absent', () => {
    render(
      <ViewerShell
        game={game}
        board={board}
        live={live}
        liveStatus="LIVE"
        isSynced
        highlights={{ quarterWinners: {}, currentLabel: 'NOW' }}
        winnerHistory={[]}
        pendingMilestones={[]}
        selectedPlayer=""
        onClearPlayer={vi.fn()}
        onFindSquares={vi.fn()}
        highlightedCoords={null}
        onScenarioFocus={vi.fn()}
        shareCode="ABCDEFGH"
        servicesEnabled
        organizerPreview={false}
      />
    );
    expect(screen.getByRole('grid', { name: /football squares board/i })).toBeVisible();
    expect(screen.queryByText('Axis')).toBeNull();
  });
});
