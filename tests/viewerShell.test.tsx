import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ViewerShell from '../features/viewer/shell/ViewerShell';
import type { BoardData, GameState, LiveGameData, WinnerResolution } from '../types';

const board: BoardData = {
  topAxis: [0,1,2,3,4,5,6,7,8,9],
  leftAxis: [0,1,2,3,4,5,6,7,8,9],
  squares: Array.from({ length: 100 }, () => []),
  participants: [
    { id: 'p-carrie', displayName: 'Carrie Moss', publicLabel: 'Carrie Moss' },
    { id: 'p-open', displayName: 'OPEN', publicLabel: 'OPEN' },
  ],
};
board.squares[14] = ['Carrie Moss'];
board.squares[34] = ['Carrie Moss'];
board.squares[86] = ['Alex Kim'];

const game: GameState = {
  title: 'GridOne Bowl', meta: '', leftAbbr: 'KC', leftName: 'Kansas City', topAbbr: 'PHI', topName: 'Philadelphia', dates: 'Sep 13', lockTitle: false, lockMeta: false,
};

const live = (overrides: Partial<LiveGameData> = {}): LiveGameData => ({
  leftScore: 21,
  topScore: 14,
  quarterScores: { Q1: { left: 7, top: 0 }, Q2: { left: 7, top: 7 }, Q3: { left: 7, top: 7 }, Q4: { left: 0, top: 0 }, OT: { left: 0, top: 0 } },
  clock: '8:12', period: 3, state: 'in', detail: '3rd quarter', isOvertime: false, sourceName: 'ESPN', retrievedAt: '2026-09-13T20:15:00.000Z', staleAfter: '2026-09-13T20:16:00.000Z', freshness: 'fresh', ...overrides,
});

type ShellProps = React.ComponentProps<typeof ViewerShell>;

const renderShell = (props: Partial<ShellProps> = {}) => render(
  <ViewerShell
    game={game}
    board={board}
    live={live()}
    liveStatus="LIVE"
    isSynced
    highlights={{ quarterWinners: {}, currentLabel: '' }}
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
    {...props}
  />
);

describe('ViewerShell Slice 6 C1', () => {
  it('renders the unpersonalized phone-first top stack without payout or me language above Find my squares', () => {
    renderShell({ selectedPlayer: '' });

    const firstViewport = screen.getByTestId('viewer-first-viewport');
    expect(within(firstViewport).getByRole('heading', { name: 'GridOne Bowl' })).toBeVisible();
    expect(within(firstViewport).getByText('KC at PHI')).toBeVisible();
    expect(within(firstViewport).getByText('21')).toBeVisible();
    expect(within(firstViewport).getByText('14')).toBeVisible();
    expect(within(firstViewport).getByText(/Current result/i)).toHaveTextContent('Carrie Moss');
    expect(within(firstViewport).getByText(/Live/i)).toBeVisible();
    expect(within(firstViewport).getByText(/Checked/i)).toBeVisible();
    expect(within(firstViewport).getByText(/Score updates about every minute/i)).toBeVisible();
    expect(within(firstViewport).getByRole('button', { name: /Find my squares/i })).toBeVisible();
    expect(firstViewport).not.toHaveTextContent(/payout|makes me win/i);
  });

  it('puts personalized summary with coordinates and current/next status before winner email', () => {
    renderShell({ selectedPlayer: 'Carrie Moss' });

    const summary = screen.getByRole('region', { name: /Carrie Moss square summary/i });
    expect(summary.compareDocumentPosition(screen.getByRole('form', { name: /winner email/i }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(summary).getByText(/Carrie Moss/)).toBeVisible();
    expect(within(summary).getByText('2 squares')).toBeVisible();
    expect(within(summary).getAllByText(/top 4.*side 1/i)).toHaveLength(2);
    expect(within(summary).getByText('Current result matches now.')).toBeVisible();
    expect(within(summary).getByRole('button', { name: /View on board top 4 side 1/i })).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByText('Next score: KC Safety +2')).toBeVisible();
    expect(screen.getByText(/arithmetic score outcomes, not odds or predictions/i)).toBeVisible();
  });

  it('does not render inert scenario rows in pregame and suppresses scenarios at Final', () => {
    const { rerender } = renderShell({ live: live({ state: 'pre', period: 0, leftScore: 0, topScore: 0 }) });
    expect(screen.queryByRole('button', { name: /Safety|Field goal|Touchdown/ })).toBeNull();
    expect(screen.getByText(/Scenarios appear after kickoff/i)).toBeVisible();

    rerender(<ViewerShell game={game} board={board} live={live({ state: 'post' })} liveStatus="FINAL" isSynced highlights={{ quarterWinners: {}, currentLabel: '' }} winnerHistory={[]} pendingMilestones={[]} selectedPlayer="Carrie Moss" onClearPlayer={vi.fn()} onFindSquares={vi.fn()} highlightedCoords={null} onScenarioFocus={vi.fn()} shareCode="ABCDEFGH" servicesEnabled organizerPreview={false} />);
    expect(screen.queryByText(/What score changes the next result/i)).toBeNull();
    expect(screen.getByText(/Final record/i)).toBeVisible();
  });

  it('collapses unselected live outcomes and exposes all outcomes as secondary details', async () => {
    renderShell({ selectedPlayer: '' });
    const disclosure = screen.getByText(/All next-score outcomes/i).closest('details');
    expect(disclosure).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText(/All next-score outcomes/i));
    expect(disclosure).toHaveAttribute('open');
    expect(screen.getAllByText(/Safety \+2/)).toHaveLength(2);
  });

  it('shows stale/offline last-known timestamp and hides notification in preview or without durable participant', () => {
    const { rerender } = renderShell({ live: live({ freshness: 'offline' }), selectedPlayer: 'Carrie Moss' });
    expect(screen.getByText(/Offline .* last known/i)).toBeVisible();
    expect(screen.getByText(/Last known.*Checked/i)).toBeVisible();

    rerender(<ViewerShell game={game} board={board} live={live()} liveStatus="LIVE" isSynced highlights={{ quarterWinners: {}, currentLabel: '' }} winnerHistory={[]} pendingMilestones={[]} selectedPlayer="Carrie Moss" onClearPlayer={vi.fn()} onFindSquares={vi.fn()} highlightedCoords={null} onScenarioFocus={vi.fn()} shareCode="ABCDEFGH" servicesEnabled organizerPreview />);
    expect(screen.queryByRole('form', { name: /winner email/i })).toBeNull();

    rerender(<ViewerShell game={game} board={{ ...board, participants: [] }} live={live()} liveStatus="LIVE" isSynced highlights={{ quarterWinners: {}, currentLabel: '' }} winnerHistory={[]} pendingMilestones={[]} selectedPlayer="Carrie Moss" onClearPlayer={vi.fn()} onFindSquares={vi.fn()} highlightedCoords={null} onScenarioFocus={vi.fn()} shareCode="ABCDEFGH" servicesEnabled organizerPreview={false} />);
    expect(screen.queryByRole('form', { name: /winner email/i })).toBeNull();

    rerender(<ViewerShell game={game} board={{ ...board, participants: [{ id: 'first', displayName: 'Carrie Moss', publicLabel: 'Carrie' }, { id: 'second', displayName: 'Carrie Moss', publicLabel: 'Carrie 2' }] }} live={live()} liveStatus="LIVE" isSynced highlights={{ quarterWinners: {}, currentLabel: '' }} winnerHistory={[]} pendingMilestones={[]} selectedPlayer="Carrie Moss" onClearPlayer={vi.fn()} onFindSquares={vi.fn()} highlightedCoords={null} onScenarioFocus={vi.fn()} shareCode="ABCDEFGH" servicesEnabled organizerPreview={false} />);
    expect(screen.queryByRole('form', { name: /winner email/i })).toBeNull();
  });

  it('uses randomized axis digits for View on board focus coordinates', () => {
    const randomized = {
      ...board,
      topAxis: [9,8,7,6,5,4,3,2,1,0],
      leftAxis: [9,8,7,6,5,4,3,2,1,0],
    };
    const onScenarioFocus = vi.fn();
    renderShell({ board: randomized, selectedPlayer: 'Carrie Moss', onScenarioFocus });
    fireEvent.click(screen.getByRole('button', { name: /View on board top 5 side 8/i }));
    expect(onScenarioFocus).toHaveBeenCalledWith({ top: 5, left: 8 });
  });

  it('renders Final record with resolved winners and no scenarios', () => {
    const winnerHistory: WinnerResolution[] = [{ milestone: 'FINAL', sideScore: 21, topScore: 14, sideDigit: 1, topDigit: 4, participantName: 'Carrie Moss', resolvedAt: '2026-09-13T22:00:00.000Z' }];
    renderShell({ live: live({ state: 'post' }), liveStatus: 'FINAL', winnerHistory, selectedPlayer: 'Carrie Moss' });
    expect(screen.getByText(/Final record/i)).toBeVisible();
    expect(screen.getByText(/FINAL/)).toBeVisible();
    expect(screen.queryByText(/What score changes the next result/i)).toBeNull();
  });
});
