import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FindSquaresEntry from '../../src/features/viewer/identity/FindSquaresEntry';

describe('FindSquaresEntry', () => {
  it('offers one primary action and the organizer-name hint before selection', () => {
    const onFindSquares = vi.fn();
    render(<FindSquaresEntry selectedPlayer="" onFindSquares={onFindSquares} onClearPlayer={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Find my squares' });
    expect(button.className).toContain('bg-action');
    fireEvent.click(button);
    expect(onFindSquares).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Pick your name to see your squares.')).toBeInTheDocument();
  });

  it('shows the selected name as a chip with Clear and a change action', () => {
    const onClearPlayer = vi.fn();
    render(<FindSquaresEntry selectedPlayer="Carrie Moss" onFindSquares={vi.fn()} onClearPlayer={onClearPlayer} />);
    expect(screen.getByText('Carrie Moss')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClearPlayer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Choose another name' })).toBeInTheDocument();
  });
});
