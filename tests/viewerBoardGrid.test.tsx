import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ViewerBoardGrid from '../features/viewer/board/ViewerBoardGrid';
import ViewerShell from '../features/viewer/shell/ViewerShell';
import type { BoardData, GameState, LiveGameData, WinnerResolution } from '../types';

const board: BoardData = {
  topAxis: [9, 4, 1, 7, 0, 8, 3, 6, 2, 5],
  leftAxis: [6, 2, 7, 1, 9, 4, 0, 5, 8, 3],
  squares: Array.from({ length: 100 }, () => []),
  allowOpenSquares: true,
  participants: [{ id: 'ann', displayName: 'Ann Lee', publicLabel: 'Ann Lee' }],
};
board.squares[2 * 10 + 1] = ['Ann Lee'];

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
    onFindSquares={vi.fn()}
  />
);

describe('ViewerBoardGrid Slice 7', () => {
  it('renders sticky top and side axes with exact Top team and Side team orientation labels', () => {
    renderGrid();
    const grid = screen.getByRole('grid', { name: /football squares board/i });
    expect(grid).toHaveAttribute('aria-rowcount', '11');
    expect(grid).toHaveAttribute('aria-colcount', '12');
    expect(grid.querySelectorAll('col')).toHaveLength(12);
    expect(within(grid).getByText('Top team')).toBeVisible();
    expect(within(grid).getByText('Side team')).toBeVisible();
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
  });

  it('renders zoom/find/center controls as 44px targets', () => {
    const { container } = renderGrid();
    for (const name of [/Zoom out/i, /Center current result/i, /Zoom in/i, /Fit board/i, /Find/i, /Center selected/i]) {
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
    fireEvent.click(screen.getByRole('button', { name: 'Center current result' }));
    fireEvent.click(screen.getByRole('button', { name: 'Center selected' }));
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it('ViewerShell uses the v2 viewer grid and leaves legacy BoardGrid dynamic quarter controls absent from viewer_v2', () => {
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
