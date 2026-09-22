import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OrganizerIsland from '../src/features/organizer/workspace/OrganizerIsland';
import { buildOrganizerIslandSummary } from '../src/features/organizer/workspace/organizerIslandModel';

const base = { filled: 72, paid: 40, unpaid: 20, unknown: 12, drawn: false, phase: 'Fill' as const, primary: { label: 'Draw numbers', onClick: vi.fn() }, saveStatus: 'clean' };

describe('organizer island summary', () => {
  it('prioritizes conflicts over payment and game state', () => {
    expect(buildOrganizerIslandSummary({ ...base, saveStatus: 'conflicted', activeTask: 'payments', isPublished: true }).label).toBe('Changes need review');
    expect(buildOrganizerIslandSummary({ ...base, saveStatus: 'save_failed' }).label).toBe('Save failed');
  });
  it('reports square counts, shared state and honest readiness', () => {
    expect(buildOrganizerIslandSummary({ ...base, activeTask: 'payments' }).label).toBe('40 paid · 20 unpaid · 12 not asked');
    expect(buildOrganizerIslandSummary({ ...base, isShared: true }).label).toBe('Shared · numbers not drawn');
    expect(buildOrganizerIslandSummary({ ...base, phase: 'Draw' }).label).toBe('Ready to draw');
    expect(buildOrganizerIslandSummary({ ...base, phase: 'Draw', hasBlocker: true }).label).toBe('72 of 100 assigned');
    expect(buildOrganizerIslandSummary({ ...base, phase: 'Draw', primary: { ...base.primary, disabled: true } }).label).toBe('72 of 100 assigned');
    expect(buildOrganizerIslandSummary({ ...base, drawn: true }).label).toBe('Numbers drawn');
  });
  it('retains supplied live trust and Final status', () => {
    expect(buildOrganizerIslandSummary({ ...base, isPublished: true, liveSummary: 'SEA 14 · NE 7', liveTrust: 'Manual score' })).toMatchObject({ label: 'SEA 14 · NE 7', detail: 'Manual score' });
    expect(buildOrganizerIslandSummary({ ...base, isPublished: true, isFinal: true }).label).toBe('Final record');
  });
});

describe('organizer island disclosure', () => {
  it('opens deliberately, hides collapsed actions, and restores keyboard focus on Escape', () => {
    render(<OrganizerIsland {...base} />);
    const trigger = screen.getByRole('button', { name: 'Organizer status' });
    fireEvent.mouseEnter(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Draw numbers' })).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(within(screen.getByRole('region', { name: 'Board details' })).getByText('72 of 100 assigned')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Board details' })).toHaveTextContent('Saved');
    fireEvent.click(screen.getByRole('button', { name: 'Payments' }));
    expect(screen.getByText('12 not asked yet')).toBeVisible();
    screen.getByRole('button', { name: 'Draw numbers' }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
  it('closes before opening a task and gives that task a stable focus return target', () => {
    const callback = vi.fn(() => {
      expect(screen.getByRole('button', { name: 'Organizer status' })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('button', { name: 'Organizer status' })).toHaveFocus();
    });
    render(<OrganizerIsland {...base} onPayments={callback} />);
    fireEvent.click(screen.getByRole('button', { name: 'Organizer status' }));
    fireEvent.click(screen.getByRole('button', { name: 'Payments' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open payments' }));
    expect(callback).toHaveBeenCalledOnce();
  });
  it('dismisses outside without stealing focus from another control', () => {
    render(<><OrganizerIsland {...base} /><button>Other task</button></>);
    const trigger = screen.getByRole('button', { name: 'Organizer status' });
    fireEvent.click(trigger);
    const outside = screen.getByRole('button', { name: 'Other task' });
    outside.focus();
    fireEvent.pointerDown(outside);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(outside).toHaveFocus();
  });
});


describe('organizer island touch hold', () => {
  function pointer(target: HTMLElement, type: string, x = 0) {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, { pointerType: 'touch', clientX: x, clientY: 0, pointerId: 1 });
    fireEvent(target, event);
  }
  it('opens after a hold and suppresses the release click', () => {
    vi.useFakeTimers();
    try {
      render(<OrganizerIsland {...base} />);
      const toggle = screen.getByRole('button', { name: 'Organizer status' });
      pointer(toggle, 'pointerdown');
      act(() => vi.advanceTimersByTime(450));
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      pointer(toggle, 'pointerup');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    } finally { vi.useRealTimers(); }
  });
  it.each(['pointerup', 'pointercancel', 'pointermove'])('cancels on %s without blocking scrolling', (type) => {
    vi.useFakeTimers();
    try {
      render(<OrganizerIsland {...base} />);
      const toggle = screen.getByRole('button', { name: 'Organizer status' });
      pointer(toggle, 'pointerdown');
      pointer(toggle, type, 20);
      act(() => vi.advanceTimersByTime(500));
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    } finally { vi.useRealTimers(); }
  });
});

it('adds actionable issue detail and gates preview readiness', () => {
  expect(buildOrganizerIslandSummary({ ...base, saveStatus: 'conflicted' }).detail).toBe('Review this session’s changes');
  expect(buildOrganizerIslandSummary({ ...base, saveStatus: 'save_failed' }).detail).toBe('Your changes need saving');
  expect(buildOrganizerIslandSummary({ ...base, drawn: true }).detail).toBe('Preview ready');
  expect(buildOrganizerIslandSummary({ ...base, drawn: true, hasBlocker: true }).detail).toBe('Saved');
  expect(buildOrganizerIslandSummary({ ...base, drawn: true, saveStatus: 'saving' }).detail).toBe('Saving…');
});

it('shows results immediately and reserves sharing controls for Share', () => {
  const copy = vi.fn();
  render(<OrganizerIsland {...base} isPublished primary={null} shareActions={[{ label: 'Copy link', onClick: copy }]} winnerHistory={[]} onResults={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Organizer status' }));
  fireEvent.click(screen.getByRole('button', { name: 'Results' }));
  expect(screen.getByText('No published results yet.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'View results' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Correct a published result' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Share' }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
  expect(copy).toHaveBeenCalledOnce();
});

it('separates published results from pending scores and offers explicit correction', () => {
  const correct = vi.fn();
  render(<OrganizerIsland {...base} isPublished primary={null} onResults={correct}
    winnerHistory={[{ milestone: 'Q1', participantName: 'Old name', openSquare: true, corrected: true, topScore: 3, sideScore: 7, topDigit: 3, sideDigit: 7, resolvedAt: '' }]}
    pendingMilestones={[{ milestone: 'Q2', topScore: 10, sideScore: 14, topDigit: 0, sideDigit: 4, stableSince: '', lastObservedAt: '', successfulReadCount: 1 }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Organizer status' }));
  fireEvent.click(screen.getByRole('button', { name: 'Results' }));
  const results = screen.getByRole('region', { name: 'Results details' });
  expect(results).toHaveTextContent('OPEN · corrected');
  expect(results).toHaveTextContent('Pending confirmation');
  expect(results).not.toHaveTextContent('Old name');
  fireEvent.click(screen.getByRole('button', { name: 'Correct a published result' }));
  expect(correct).toHaveBeenCalledOnce();
});
