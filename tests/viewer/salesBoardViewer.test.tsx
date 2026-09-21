import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SalesBoardViewer from '../../src/features/viewer/sales/SalesBoardViewer';
import { SAMPLE_BOARD } from '../../constants';
import type { BoardData, GameState } from '../../types';

const INITIAL_GAME: GameState = { title: 'Team fundraiser', meta: '', leftName: 'Bears', leftAbbr: 'CHI', topName: 'Packers', topAbbr: 'GB', dates: 'September 6', lockTitle: false, lockMeta: false };

const fixture = () => ({
  ...SAMPLE_BOARD,
  squares: Array.from({ length: 100 }, (_, i) => i === 0 ? ['Alice Long Buyer Name'] : []),
  allocationLabels: Array.from({ length: 100 }, (_, i) => i < 2 ? 'Mora family' : i === 2 ? 'Jones family' : null),
} as BoardData);

describe('SalesBoardViewer', () => {
  it('shows 100 fixed square identities, public family allocation, and selling context without game-day tools', () => {
    render(<SalesBoardViewer game={{ ...INITIAL_GAME, title: 'Team fundraiser' }} board={fixture()} />);
    expect(screen.getByRole('heading', { name: 'Team fundraiser' })).toBeInTheDocument();
    expect(screen.getByText('Selling squares')).toBeInTheDocument();
    expect(screen.getByText('Numbers will be drawn before the game.')).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell')).toHaveLength(100);
    expect(screen.getByRole('gridcell', { name: 'Square 1, Alice Long Buyer Name, Mora family' })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'Square 2, Blank, Mora family' })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'Square 100, Blank, No family assigned' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Manage board' })).not.toBeInTheDocument();
    expect(screen.queryByText('Find my squares')).not.toBeInTheDocument();
    expect(screen.queryByText(/winner email/i)).not.toBeInTheDocument();
    expect(screen.getByText('✓ Has a name · ◷ Guest selecting · No mark means blank')).toBeInTheDocument();
  });

  it('filters family details without removing any board squares and highlights unsold independently', () => {
    render(<SalesBoardViewer game={INITIAL_GAME} board={fixture()} />);
    fireEvent.change(screen.getByLabelText('Family'), { target: { value: 'Mora family' } });
    expect(screen.getAllByRole('gridcell')).toHaveLength(100);
    const details = screen.getByRole('region', { name: 'Square details' });
    expect(within(details).getAllByRole('listitem')).toHaveLength(2);
    expect(within(details).getByText('Alice Long Buyer Name')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Highlight blank squares' }));
    expect(screen.getByRole('button', { name: 'Highlight blank squares' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(details).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getAllByRole('gridcell')).toHaveLength(100);
  });

  it('provides one grid tab stop, arrow navigation, and full selected-cell details', () => {
    render(<SalesBoardViewer game={INITIAL_GAME} board={fixture()} />);
    const cells = screen.getAllByRole('gridcell');
    expect(cells.filter(cell => cell.tabIndex === 0)).toHaveLength(1);
    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: 'ArrowRight' });
    expect(cells[1]).toHaveFocus();
    expect(screen.getByRole('status', { name: 'Selected square' })).toHaveTextContent('Square 2 · Blank · Mora family');
    fireEvent.keyDown(cells[1], { key: 'End', ctrlKey: true });
    expect(cells[99]).toHaveFocus();
  });

  it('finds a holder or exact square number and keeps the full board visible', () => {
    render(<SalesBoardViewer game={INITIAL_GAME} board={fixture()} />);
    const search = screen.getByRole('searchbox', { name: 'Find a name or square number' });
    fireEvent.change(search, { target: { value: 'alice' } });
    expect(within(screen.getByRole('region', { name: 'Square details' })).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getAllByRole('gridcell')).toHaveLength(100);
    fireEvent.change(search, { target: { value: '13' } });
    expect(within(screen.getByRole('region', { name: 'Square details' })).getByText('Square 13')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'Nobody' } });
    expect(screen.getByText('No squares match these filters.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(search).toHaveValue('');
  });

  it('does not infer purchase or availability from names and keeps solo boards simple', () => {
    render(<SalesBoardViewer game={INITIAL_GAME} board={{ ...fixture(), allocationLabels: undefined }} />);
    expect(screen.queryByLabelText('Family')).not.toBeInTheDocument();
    expect(screen.getByText('Squares with names')).toBeInTheDocument();
    expect(screen.getByText('99 blank squares')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'How to join' }));
    expect(screen.getByText(/Contact the person who shared this board/)).toBeInTheDocument();
    expect(screen.getByText('Availability is confirmed by the organizer. Payments happen outside GridOne.')).toBeInTheDocument();
    expect(screen.queryByText(/sold/i)).not.toBeInTheDocument();
  });

  it('shows only explicitly published participation details and availability', () => {
    render(<SalesBoardViewer game={INITIAL_GAME} board={{ ...fixture(), participation: { purpose: 'Support our baseball season', instructions: 'Text Anthony with your square numbers.', squarePrice: '$20' }, availability: Array.from({ length: 100 }, (_, i) => i === 0 ? 'available' : 'unspecified') }} />);
    expect(screen.getByText('Support our baseball season')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'How to join' }));
    expect(screen.getByText('Text Anthony with your square numbers.')).toBeVisible();
    expect(screen.getByText('$20 per square')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show available squares' }));
    const details = screen.getByRole('region', { name: 'Square details' });
    expect(within(details).getAllByRole('listitem')).toHaveLength(1);
    expect(within(details).getByText('Alice Long Buyer Name')).toBeInTheDocument();
    expect(within(details).getByText('Available · confirm with organizer')).toBeInTheDocument();
  });

  it('reports freshness honestly and exposes refresh and an optional organizer link', () => {
    const refresh = vi.fn();
    const { rerender } = render(<SalesBoardViewer game={INITIAL_GAME} board={fixture()} onRefresh={refresh} organizerHref="/boards/owner-id" />);
    expect(screen.getByText('Update time unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh board' }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Manage board' })).toHaveAttribute('href', '/boards/owner-id');
    rerender(<SalesBoardViewer game={INITIAL_GAME} board={fixture()} onRefresh={refresh} refreshing updatedAt="2026-09-04T12:00:00Z" error="Could not refresh. Showing the last board loaded." />);
    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled();
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not refresh');
  });

  it('labels guest holds and claims from the narrow public occupancy snapshot', () => {
    render(<SalesBoardViewer game={INITIAL_GAME} board={{ ...fixture(), availability: Array(100).fill('available') }} guestOccupancy={{ holds: [{ index: 0, expiresAt: '2026-09-20T12:01:30Z' }], claimedCells: [1] }} guestConnection="live" />);
    expect(screen.getByRole('gridcell', { name: /Square 1.*temporarily held/i })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: /Square 2.*claimed through a guest link/i })).toBeInTheDocument();
    expect(screen.getByText('Guest availability live')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show available squares' }));
    const details = screen.getByRole('region', { name: 'Square details' });
    expect(within(details).queryByText('Square 1')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('gridcell')[0]);
    expect(screen.getByRole('status', { name: 'Selected square' })).toHaveTextContent('Guest selecting · temporarily held');
  });
});
