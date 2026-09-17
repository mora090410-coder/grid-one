import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OrganizerIsland from '../../src/features/organizer/workspace/OrganizerIsland';

const base = { filled: 72, paid: 40, unpaid: 20, unknown: 12, drawn: false, phase: 'Fill' as const, primary: { label: 'Draw numbers', onClick: vi.fn() } };

describe('replacement notch interaction', () => {
  it('selects one attached detail without executing the selected module action', () => {
    const pay = vi.fn();
    render(<OrganizerIsland {...base} onPayments={pay} />);
    fireEvent.click(screen.getByRole('button', { name: 'Organizer status' }));
    const payments = screen.getByRole('button', { name: 'Payments' });
    expect(payments).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(payments);
    expect(pay).not.toHaveBeenCalled();
    expect(payments).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Payments details' })).toHaveTextContent('Payment notes are private. Counts are squares.');
    expect(screen.queryByRole('region', { name: 'Board details' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open payments' }));
    expect(pay).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Organizer status' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Organizer status' })).toHaveAttribute('aria-expanded', 'false');
  });
  it('pins a hover preview and Escape closes with a persistent focus target', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    render(<OrganizerIsland {...base} />);
    const trigger = screen.getByRole('button', { name: 'Organizer status' });
    fireEvent.mouseEnter(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Unpin' })).toBeVisible();
    fireEvent.mouseLeave(screen.getByRole('region', { name: 'Organizer status' }));
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    vi.unstubAllGlobals();
  });
  it('published modules omit private payment content and retain the primary callback', () => {
    render(<OrganizerIsland {...base} isPublished liveTrust="Manual score" onPayments={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Organizer status' }));
    const region = screen.getByRole('region', { name: 'Organizer status' });
    expect(within(region).getByRole('button', { name: 'Game' })).toBeVisible();
    expect(within(region).getByRole('button', { name: 'Results' })).toBeVisible();
    expect(within(region).getByRole('button', { name: 'Share' })).toBeVisible();
    expect(within(region).queryByText(/40 paid/)).toBeNull();
    expect(within(region).getByRole('button', { name: 'Draw numbers' })).toBeEnabled();
  });
});
