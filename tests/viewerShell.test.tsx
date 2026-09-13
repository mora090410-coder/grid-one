import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ViewerShell from '../src/features/viewer/shell/ViewerShell';
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

describe('ViewerShell', () => {
  it('renders the unpersonalized stack: identity, score, trust, one primary action, no me language', () => {
    renderShell({ selectedPlayer: '' });
    const firstViewport = screen.getByTestId('viewer-first-viewport');
    expect(within(firstViewport).getByRole('heading', { level: 1, name: 'GridOne Bowl' })).toBeVisible();
    expect(within(firstViewport).getByText('KC at PHI')).toBeVisible();
    expect(within(firstViewport).getByRole('img', { name: 'Kansas City 21' })).toBeInTheDocument();
    expect(within(firstViewport).getByRole('img', { name: 'Philadelphia 14' })).toBeInTheDocument();
    const status = within(firstViewport).getByRole('status');
    expect(status).toHaveTextContent(/Currently matching/);
    expect(status).toHaveTextContent('Carrie Moss');
    expect(status).toHaveTextContent('PHI 4 across × KC 1 down');
    expect(status).toHaveTextContent(/Score updates about every three minutes/);
    expect(within(firstViewport).getByRole('button', { name: 'Find my squares' })).toBeVisible();
    expect(firstViewport).not.toHaveTextContent(/payout|makes me win/i);
    expect(screen.getByRole('main', { name: 'GridOne Bowl viewer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Score/ })).toBeNull();
  });

  it('puts personalized summary and scenarios before winner email', () => {
    renderShell({ selectedPlayer: 'Carrie Moss' });
    const summary = screen.getByRole('region', { name: 'Carrie Moss square summary' });
    const scenarios = screen.getByRole('region', { name: 'What score changes the next result?' });
    const winnerEmail = screen.getByRole('form', { name: 'winner email' });
    expect(summary.compareDocumentPosition(scenarios)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(scenarios.compareDocumentPosition(winnerEmail)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(summary).getByText('2 squares')).toBeVisible();
    expect(within(summary).getByText('Currently matching: one of your squares.')).toBeVisible();
    expect(within(summary).getByRole('button', { name: /View on board top 4 side 1/ })).toBeInTheDocument();
    expect(screen.getByText('Next score: KC Safety +2')).toBeVisible();
    expect(screen.getByText('These are arithmetic score outcomes, not odds or predictions.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Score/ })).toBeNull();
  });

  it('shows no inert scenarios in pregame and promotes the final record at Final', () => {
    const { rerender } = renderShell({ live: live({ state: 'pre', period: 0, leftScore: 0, topScore: 0 }) });
    expect(screen.queryByRole('button', { name: /Safety|Field goal|Touchdown/ })).toBeNull();
    expect(screen.getByText('Scenarios appear after kickoff.')).toBeVisible();

    rerender(<ViewerShell game={game} board={board} live={live({ state: 'post' })} liveStatus="FINAL" isSynced highlights={{ quarterWinners: {}, currentLabel: '' }} winnerHistory={[]} pendingMilestones={[]} selectedPlayer="Carrie Moss" onClearPlayer={vi.fn()} onFindSquares={vi.fn()} highlightedCoords={null} onScenarioFocus={vi.fn()} shareCode="ABCDEFGH" servicesEnabled organizerPreview={false} />);
    expect(screen.queryByText('What score changes the next result?')).toBeNull();
    const finalRecord = screen.getByRole('region', { name: 'Final record' });
    const grid = screen.getByTestId('viewer-board-grid');
    expect(finalRecord.compareDocumentPosition(grid)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('collapses unselected live outcomes behind a closed disclosure', () => {
    renderShell({ selectedPlayer: '' });
    const disclosure = screen.getByText('All possible next scores').closest('details');
    expect(disclosure).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('All possible next scores'));
    expect(disclosure).toHaveAttribute('open');
    expect(screen.getAllByText(/Safety \+2/)).toHaveLength(2);
  });

  it('shows stale last-known copy and hides winner email in preview or without a durable participant', () => {
    const { rerender } = renderShell({ live: live({ freshness: 'offline' }), selectedPlayer: 'Carrie Moss' });
    const firstViewportStatus = within(screen.getByTestId('viewer-first-viewport')).getByRole('status');
    expect(firstViewportStatus).toHaveTextContent(/Offline · last known/);
    expect(firstViewportStatus).toHaveTextContent(/Last known · /);
    expect(screen.getByText(/Using the last-known score checked .* until scoring reconnects\./)).toBeVisible();

    rerender(<ViewerShell game={game} board={board} live={live()} liveStatus="LIVE" isSynced highlights={{ quarterWinners: {}, currentLabel: '' }} winnerHistory={[]} pendingMilestones={[]} selectedPlayer="Carrie Moss" onClearPlayer={vi.fn()} onFindSquares={vi.fn()} highlightedCoords={null} onScenarioFocus={vi.fn()} shareCode="ABCDEFGH" servicesEnabled organizerPreview />);
    expect(screen.queryByRole('form', { name: 'winner email' })).toBeNull();

    rerender(<ViewerShell game={game} board={{ ...board, participants: [] }} live={live()} liveStatus="LIVE" isSynced highlights={{ quarterWinners: {}, currentLabel: '' }} winnerHistory={[]} pendingMilestones={[]} selectedPlayer="Carrie Moss" onClearPlayer={vi.fn()} onFindSquares={vi.fn()} highlightedCoords={null} onScenarioFocus={vi.fn()} shareCode="ABCDEFGH" servicesEnabled organizerPreview={false} />);
    expect(screen.queryByRole('form', { name: 'winner email' })).toBeNull();

    rerender(<ViewerShell game={game} board={{ ...board, participants: [{ id: 'first', displayName: 'Carrie Moss', publicLabel: 'Carrie' }, { id: 'second', displayName: 'Carrie Moss', publicLabel: 'Carrie 2' }] }} live={live()} liveStatus="LIVE" isSynced highlights={{ quarterWinners: {}, currentLabel: '' }} winnerHistory={[]} pendingMilestones={[]} selectedPlayer="Carrie Moss" onClearPlayer={vi.fn()} onFindSquares={vi.fn()} highlightedCoords={null} onScenarioFocus={vi.fn()} shareCode="ABCDEFGH" servicesEnabled organizerPreview={false} />);
    expect(screen.queryByRole('form', { name: 'winner email' })).toBeNull();
  });

  it('renders a region, not a nested main, when used inside the organizer preview', () => {
    renderShell({ organizerPreview: true });
    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.getByRole('region', { name: 'GridOne Bowl viewer' })).toBeInTheDocument();
  });

  it('uses randomized axis digits for View on board focus coordinates', () => {
    const randomized = { ...board, topAxis: [9,8,7,6,5,4,3,2,1,0], leftAxis: [9,8,7,6,5,4,3,2,1,0] };
    const onScenarioFocus = vi.fn();
    renderShell({ board: randomized, selectedPlayer: 'Carrie Moss', onScenarioFocus });
    const target = screen.getByRole('gridcell', { name: /Carrie Moss, coordinate row 2 column 5/ });
    target.scrollIntoView = vi.fn(); // jsdom has no layout/scroll implementation.
    fireEvent.click(screen.getByRole('button', { name: /View on board top 5 side 8/ }));
    expect(target).toHaveFocus();
    expect(target.scrollIntoView).toHaveBeenCalled();
    expect(onScenarioFocus).toHaveBeenCalledWith({ top: 5, left: 8 });
  });

  it('renders the final record with resolved winners and no scenarios', () => {
    const winnerHistory: WinnerResolution[] = [{ milestone: 'FINAL', sideScore: 21, topScore: 14, sideDigit: 1, topDigit: 4, participantName: 'Carrie Moss', resolvedAt: '2026-09-13T22:00:00.000Z' }];
    renderShell({ live: live({ state: 'post' }), liveStatus: 'FINAL', winnerHistory, selectedPlayer: 'Carrie Moss' });
    expect(screen.getByRole('region', { name: 'Final record' })).toHaveTextContent(/Final · Carrie Moss/);
    expect(screen.queryByText('What score changes the next result?')).toBeNull();
  });

  it('offers Share when a handler is provided and never uses feature-flag markers', () => {
    const onShare = vi.fn();
    const { container } = renderShell({ onShare });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(onShare).toHaveBeenCalled();
    expect(container.querySelector('[data-feature-flag]')).toBeNull();
  });
});

it('keeps the organizer return route available on the finalized public viewer', () => {
  renderShell({ organizerHref: '/boards/owner-board' });
  expect(screen.getByRole('link', { name: 'Manage board' })).toHaveAttribute('href', '/boards/owner-board');
});

it('shows the floating score only after the main score scrolls above the viewport', () => {
  let notify: IntersectionObserverCallback = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { notify = callback; }
    observe() {}
    disconnect = disconnect;
  });
  const view = renderShell();
  const update = (bottom: number, isIntersecting: boolean) => act(() => notify([{ isIntersecting, boundingClientRect: { bottom } } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(screen.queryByRole('button', { name: /^Score/ })).toBeNull();
  update(400, true);
  expect(screen.queryByRole('button', { name: /^Score/ })).toBeNull();
  update(-1, false);
  expect(screen.getByRole('button', { name: /^Score/ })).toHaveTextContent('KC 21');
  update(400, true);
  expect(screen.queryByRole('button', { name: /^Score/ })).toBeNull();
  view.unmount();
  expect(disconnect).toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it('shows the confirmed Q1 winner during Q2', () => {
  renderShell({ live: live({ period: 2 }), winnerHistory: [{ milestone: 'Q1', topDigit: 0, sideDigit: 0, participantName: 'Demo Family', resolvedAt: '2026-09-10T01:00:00Z' }] });
  expect(screen.getByRole('region', { name: 'Completed results' })).toHaveTextContent('Q1 · Demo Family');
  expect(screen.queryByRole('region', { name: 'Final record' })).toBeNull();
});
