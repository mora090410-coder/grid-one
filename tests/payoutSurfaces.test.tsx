import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ViewerShell from '../src/features/viewer/shell/ViewerShell';
import type { BoardData, GameState, LiveGameData, WinnerResolution } from '../types';

vi.mock('../components/NotificationOptIn', () => ({ default: () => null }));

const board: BoardData = {
  topAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  squares: Array.from({ length: 100 }, () => []),
};

const game: GameState = {
  title: 'Week One',
  meta: 'Fundraiser',
  leftAbbr: 'DAL',
  leftName: 'Dallas Cowboys',
  topAbbr: 'WAS',
  topName: 'Washington Commanders',
  dates: 'September 13',
  lockTitle: false,
  lockMeta: false,
};

const live = (overrides: Partial<LiveGameData> = {}): LiveGameData => ({
  leftScore: 21,
  topScore: 14,
  quarterScores: { Q1: { left: 7, top: 0 }, Q2: { left: 7, top: 7 }, Q3: { left: 7, top: 7 }, Q4: { left: 0, top: 0 }, OT: { left: 0, top: 0 } },
  clock: '0:00', period: 4, state: 'in', detail: 'Final', isOvertime: false, sourceName: 'ESPN', retrievedAt: '2026-09-13T22:00:00.000Z', staleAfter: '2026-09-13T22:01:00.000Z', freshness: 'fresh', ...overrides,
});

const renderShell = (
  payoutDescriptions: GameState['payoutDescriptions'],
  winnerHistory: WinnerResolution[] = [],
  overrides: Partial<React.ComponentProps<typeof ViewerShell>> = {},
) => render(
  <ViewerShell
    game={{ ...game, payoutDescriptions }}
    board={board}
    live={live()}
    liveStatus="LIVE"
    isSynced
    highlights={{ quarterWinners: {}, currentLabel: '' }}
    winnerHistory={winnerHistory}
    pendingMilestones={[]}
    selectedPlayer=""
    onClearPlayer={() => undefined}
    onFindSquares={() => undefined}
    highlightedCoords={null}
    onScenarioFocus={() => undefined}
    shareCode="ABCDEFGH"
    servicesEnabled
    organizerPreview={false}
    {...overrides}
  />,
);

describe('viewer payout descriptions', () => {
  it('renders no payout block when descriptions are absent', () => {
    renderShell({});
    expect(screen.queryByRole('heading', { name: 'Payouts' })).not.toBeInTheDocument();
  });

  it('renders organizer text in milestone order with notes and the handling disclaimer', () => {
    renderShell({
      FINAL: '<strong>Trophy</strong>',
      Q1: 'A pie',
      notes: 'Organizer rules apply.',
    });

    const payouts = screen.getByRole('heading', { name: 'Payouts' }).closest('section');
    expect(payouts).toHaveTextContent('Q1');
    expect(payouts).toHaveTextContent('A pie');
    expect(payouts).toHaveTextContent('Final');
    expect(payouts).toHaveTextContent('<strong>Trophy</strong>');
    expect(payouts?.querySelector('strong strong')).toBeNull();
    expect(payouts).toHaveTextContent('Organizer rules apply.');
    expect(payouts).toHaveTextContent('GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners.');
  });

  it('links an open-square resolution at Final to the board rules', () => {
    const winnerHistory: WinnerResolution[] = [{
      milestone: 'Q1',
      sideDigit: 3,
      topDigit: 7,
      participantName: null,
      openSquare: true,
      resolvedAt: '2026-09-13T18:00:00.000Z',
    }];
    renderShell(
      { notes: 'Open results roll into the final.' },
      winnerHistory,
      { live: live({ state: 'post' }), liveStatus: 'FINAL' },
    );

    const finalRecord = screen.getByRole('region', { name: 'Final record' });
    expect(finalRecord).toHaveTextContent('Open square');
    const link = screen.getByRole('link', { name: 'see board rules' });
    expect(link).toHaveAttribute('href', '#board-rules');
  });
});
