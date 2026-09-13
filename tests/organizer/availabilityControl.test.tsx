import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AvailabilityControl from '../../src/features/organizer/workspace/AvailabilityControl';

describe('AvailabilityControl', () => {
  it('guides selection before offering any change', () => {
    render(<AvailabilityControl selectedCount={0} disabled={false} onChange={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/Tap squares to select/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as available/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Names and private payment notes stay unchanged/)).toBeInTheDocument();
  });

  it('offers all three explicit labels for the selected squares', () => {
    const onChange = vi.fn();
    render(<AvailabilityControl selectedCount={3} disabled={false} onChange={onChange} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Offer 3 selected squares as available' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark 3 selected squares unavailable' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove availability label' }));
    expect(onChange.mock.calls).toEqual([['available'], ['unavailable'], ['unspecified']]);
  });

  it('supports closing with Escape and the done button', () => {
    const onClose = vi.fn();
    render(<AvailabilityControl selectedCount={1} disabled={false} onChange={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('group'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Done selecting' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('prevents changes and closing while saving', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<AvailabilityControl selectedCount={1} disabled onChange={onChange} onClose={onClose} />);
    screen.getAllByRole('button').forEach(button => {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    });
    fireEvent.keyDown(screen.getByRole('group'), { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
