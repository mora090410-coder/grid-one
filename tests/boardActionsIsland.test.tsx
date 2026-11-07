import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OrganizerIsland from '../src/features/organizer/workspace/OrganizerIsland';

const base = { filled: 24, paid: 10, drawn: false, phase: 'Fill' as const, saveStatus: 'clean', primary: { label: 'Draw numbers', onClick: vi.fn() } };

describe('labelled Board actions Island', () => {
  it('fades out a completed next step before showing its replacement', () => {
    vi.useFakeTimers();
    try {
      const view = render(<OrganizerIsland {...base} />);
      view.rerender(<OrganizerIsland {...base} primary={{ label: 'Share the board', onClick: vi.fn() }} />);
      const next = screen.getByRole('button', { name: 'Next: Share the board' });
      expect(next).toHaveTextContent('Draw numbers');
      expect(next).toBeDisabled();
      act(() => vi.advanceTimersByTime(200));
      expect(next).toHaveTextContent('Share the board');
      expect(next).not.toBeDisabled();
    } finally { vi.useRealTimers(); }
  });
  it('keeps the next step discoverable outside a deliberately opened modal', () => {
    render(<OrganizerIsland {...base} />);
    const trigger = screen.getByRole('button', { name: 'Board actions' });
    expect(trigger).toHaveTextContent('Board actions');
    expect(screen.getByRole('button', { name: 'Next: Draw numbers' })).toBeVisible();
    fireEvent.mouseEnter(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Board actions' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('button', { name: 'Draw numbers' })).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });
});
