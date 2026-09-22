import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ViewerIsland from '../../src/features/viewer/shell/ViewerIsland';
import NotchResults from '../../src/features/viewer/shell/NotchResults';
import type { BoardData, GameState, LiveGameData } from '../../types';
const game: GameState = { title: 'Test board', meta: '', leftAbbr: 'CHI', topAbbr: 'GB', leftName: 'Chicago', topName: 'Green Bay', dates: '', lockTitle: false, lockMeta: false };
const board: BoardData = { squares: Array.from({ length: 100 }, () => []), leftAxis: [0,1,2,3,4,5,6,7,8,9], topAxis: [0,1,2,3,4,5,6,7,8,9] };
const live: LiveGameData = { leftScore: 14, topScore: 10, period: 3, clock: '5:00', state: 'in', detail: '', isOvertime: false, freshness: 'stale', sourceName: 'ESPN', quarterScores: { Q1: { left: 0, top: 0 }, Q2: { left: 0, top: 0 }, Q3: { left: 0, top: 0 }, Q4: { left: 0, top: 0 }, OT: { left: 0, top: 0 } } };
const base = { game, board, live, liveStatus: '', isSynced: true, selectedPlayer: '', yourSquares: 0, winsNow: false };
describe('viewer replacement notch', () => {
  it('keeps score authority visible collapsed, then opens the existing identity callback', () => {
    const find = vi.fn();
    render(<ViewerIsland {...base} onFindSquares={find} />);
    const trigger = screen.getByRole('button', { name: 'Score' });
    expect(trigger).toHaveTextContent('Stale · last known');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Find squares' }));
    fireEvent.click(within(screen.getByRole('region', { name: 'Find squares details' })).getByRole('button', { name: 'Find my squares' }));
    expect(find).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
  it('uses published OPEN/corrected/pending results at Final, never next scores', () => {
    render(<ViewerIsland {...base} live={{ ...live, state: 'post' }} selectedPlayer="Ann" yourSquares={2} winnerHistory={[{ milestone: 'Q1', participantName: null, topScore: 7, sideScore: 14, topDigit: 7, sideDigit: 4, openSquare: true, corrected: true, resolvedAt: '2026-09-13T18:00:00Z' }]} pendingMilestones={[{ milestone: 'Q2', topScore: 10, sideScore: 14, topDigit: 0, sideDigit: 4, stableSince: '2026-09-13T18:00:00Z', lastObservedAt: '2026-09-13T18:00:00Z', successfulReadCount: 1 }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Score' }));
    fireEvent.click(screen.getByRole('button', { name: 'Results' }));
    const results = screen.getByRole('region', { name: 'Results details' });
    expect(results).toHaveTextContent('Q1 · OPEN · corrected');
    expect(results).toHaveTextContent('CHI 14 · GB 7 · GB digit 7 · CHI digit 4');
    expect(results).toHaveTextContent('Halftime · Pending confirmation');
    expect(results).toHaveTextContent('CHI 14 · GB 10 · GB digit 0 · CHI digit 4');
    expect(results).toHaveTextContent('Final · Not yet confirmed');
    expect(within(results).queryByRole('button', { name: 'View results' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Your squares' }));
    expect(screen.queryByRole('button', { name: 'See next scores' })).toBeNull();
  });

  it('states when no published results exist while retaining pending milestone detail', () => {
    render(<NotchResults winnerHistory={[]} pendingMilestones={[{ milestone: 'Q1', topScore: 7, sideScore: 3, topDigit: 7, sideDigit: 3, stableSince: '', lastObservedAt: '', successfulReadCount: 1 }]} leftLabel="CHI" topLabel="GB" />);
    expect(screen.getByText('No published results yet.')).toBeInTheDocument();
    expect(screen.getByText(/Q1 · Pending confirmation/)).toBeInTheDocument();
    expect(screen.getByText('CHI 3 · GB 7 · GB digit 7 · CHI digit 3')).toBeInTheDocument();
  });

  it('keeps all four milestone statuses visible when no result or pending score exists', () => {
    render(<NotchResults winnerHistory={[]} leftLabel="CHI" topLabel="GB" />);
    expect(screen.getByText('No published results yet.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('Q1 · Not yet confirmed')).toBeInTheDocument();
    expect(screen.getByText('Halftime · Not yet confirmed')).toBeInTheDocument();
    expect(screen.getByText('Q3 · Not yet confirmed')).toBeInTheDocument();
    expect(screen.getByText('Final · Not yet confirmed')).toBeInTheDocument();
  });

  it('shows canonical team digits for legacy published results without saved scores', () => {
    render(<NotchResults winnerHistory={[{ milestone: 'Q1', participantName: 'Ann', topDigit: 7, sideDigit: 3, resolvedAt: '' }]} leftLabel="CHI" topLabel="GB" />);
    expect(screen.getByText('GB digit 7 · CHI digit 3')).toBeInTheDocument();
    expect(screen.queryByText(/CHI undefined|GB undefined/)).toBeNull();
  });
});
