import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GameDayHorizon from '../components/GameDayHorizon';
import type { BoardData, GameState, WinnerHighlights, WinnerResolution } from '../types';

vi.mock('../components/NotificationOptIn', () => ({ default: () => null }));

const board: BoardData = {
  bearsAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  oppAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
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

const highlights: WinnerHighlights = { quarterWinners: {}, currentLabel: '' };

const renderHorizon = (
  payoutDescriptions: GameState['payoutDescriptions'],
  winnerHistory: WinnerResolution[] = [],
) => render(
  <GameDayHorizon
    game={{ ...game, payoutDescriptions }}
    board={board}
    live={null}
    liveStatus="Pregame"
    isSynced={false}
    highlights={highlights}
    winnerHistory={winnerHistory}
    pendingMilestones={[]}
    selectedPlayer=""
    onClearPlayer={() => undefined}
    onFindSquares={() => undefined}
    highlightedCoords={null}
    onScenarioFocus={() => undefined}
    shareCode="ABCDEFGH"
  />,
);

describe('viewer payout descriptions', () => {
  it('renders no payout block when descriptions are absent', () => {
    renderHorizon({});
    expect(screen.queryByRole('heading', { name: 'Payouts' })).not.toBeInTheDocument();
  });

  it('renders organizer text in milestone order with notes and the handling disclaimer', () => {
    renderHorizon({
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
    expect(payouts).toHaveTextContent('GridOne tracks the board. It does not collect square money or pay winners.');
  });

  it('links an open-square resolution to stable board rules when notes exist', () => {
    renderHorizon({ notes: 'Open results roll into the final.' }, [{
      milestone: 'Q1',
      sideDigit: 3,
      topDigit: 7,
      participantName: null,
      openSquare: true,
      resolvedAt: '2026-09-13T18:00:00.000Z',
    }]);

    expect(screen.getByText('Board rules / notes').closest('div')).toHaveAttribute('id', 'board-rules');
    expect(screen.getByRole('link', { name: 'see board rules' })).toHaveAttribute('href', '#board-rules');
  });

  it('does not render a broken rules link when an open-square resolution has no notes', () => {
    renderHorizon({}, [{
      milestone: 'Q1',
      sideDigit: 3,
      topDigit: 7,
      participantName: null,
      openSquare: true,
      resolvedAt: '2026-09-13T18:00:00.000Z',
    }]);

    expect(screen.getByText('Open square')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'see board rules' })).not.toBeInTheDocument();
  });
});
