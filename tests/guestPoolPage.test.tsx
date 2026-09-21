import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GuestPoolPage from '../src/features/guest/GuestPoolPage';
import type { GuestSnapshot, GuestTransport } from '../src/features/guest/guestInviteTypes';

const snapshot = (patch: Partial<GuestSnapshot> = {}): GuestSnapshot => ({
  boardId: '11111111-1111-4111-8111-111111111111',
  title: 'Anthony family board',
  shareCode: 'ABCDEFGH',
  revision: 4,
  serverTime: '2026-09-20T18:00:00.000Z',
  stage: 'selling',
  squares: Array.from({ length: 100 }, (_, index) => index === 0 ? ['Anthony'] : []),
  allocationLabels: Array.from({ length: 100 }, (_, index) => index < 2 ? 'Anthony' : null),
  availability: Array.from({ length: 100 }, (_, index) => index < 2 ? 'available' : 'unspecified'),
  holds: [], claimedCells: [], heldCells: [],
  invite: { id: 'invite-1', label: 'Anthony', cells: [0, 1], maxSquares: 1, version: 1, expiresAt: null, disabledAt: null },
  ...patch,
});

const show = (transport: GuestTransport, path = '/p/11111111-1111-4111-8111-111111111111?invite=signed-invite') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/p/:poolId" element={<GuestPoolPage transport={transport} />} /></Routes>
  </MemoryRouter>,
);

describe('GuestPoolPage', () => {
  beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); vi.restoreAllMocks(); });

  it('loads without an account and marks a square selected only after the hold is acknowledged', async () => {
    let resolveHold!: (value: GuestSnapshot) => void;
    const held = new Promise<GuestSnapshot>((resolve) => { resolveHold = resolve; });
    const transport: GuestTransport = {
      snapshot: vi.fn((request) => request.action === 'hold' ? held : Promise.resolve(snapshot())),
      manage: vi.fn(),
    };
    show(transport);
    expect(await screen.findByRole('heading', { name: "Choose from Anthony's available squares" })).toBeInTheDocument();
    const square = screen.getByRole('gridcell', { name: /Square 1, available/i });
    square.focus();
    fireEvent.keyDown(square, { key: 'ArrowRight' });
    expect(screen.getByRole('gridcell', { name: /Square 2, available/i })).toHaveFocus();
    fireEvent.click(square);
    expect(square).toHaveAttribute('aria-busy', 'true');
    expect(square).toHaveAttribute('aria-selected', 'false');
    resolveHold(snapshot({ holds: [{ index: 0, expiresAt: '2026-09-20T18:01:30.000Z', mine: true }], heldCells: [0] }));
    await waitFor(() => expect(square).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByText(/Held for you/)).toBeInTheDocument();
    const continueButton = screen.getByRole('button', { name: 'Continue with Square 1' });
    fireEvent.click(continueButton);
    expect(screen.getByLabelText('Name on your squares')).toHaveFocus();
  });

  it('shows public names on occupied squares and explains the clipped phone board', async () => {
    const squares = snapshot().squares.map(cell => [...cell]);
    squares[2] = ['Maria'];
    show({ snapshot: vi.fn().mockResolvedValue(snapshot({ squares, claimedCells: [2] })), manage: vi.fn() });
    expect(await screen.findByText('Swipe horizontally to see all 10 columns.')).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: /Square 3, claimed, Maria/i })).toHaveTextContent('Maria');
  });

  it('does not let a delayed background read erase a newer acknowledged hold', async () => {
    let resolveRead!: (value: GuestSnapshot) => void;
    const delayedRead = new Promise<GuestSnapshot>((resolve) => { resolveRead = resolve; });
    const acknowledged = snapshot({
      revision: 5,
      serverTime: '2026-09-20T18:00:02.000Z',
      holds: [{ index: 0, expiresAt: '2026-09-20T18:01:32.000Z', mine: true }],
      heldCells: [0],
    });
    const transport: GuestTransport = {
      snapshot: vi.fn()
        .mockResolvedValueOnce(snapshot())
        .mockReturnValueOnce(delayedRead)
        .mockResolvedValueOnce(acknowledged),
      manage: vi.fn(),
    };
    show(transport);
    const square = await screen.findByRole('gridcell', { name: /Square 1, available/i });
    fireEvent.focus(window);
    await waitFor(() => expect(transport.snapshot).toHaveBeenCalledTimes(2));
    fireEvent.click(square);
    await waitFor(() => expect(square).toHaveAttribute('aria-selected', 'true'));
    await act(async () => { resolveRead(snapshot({ revision: 4, serverTime: '2026-09-20T18:00:01.000Z' })); });
    expect(square).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('gridcell', { name: /Square 1, held for you/i })).toBeInTheDocument();
  });

  it('keeps the entered name when a hold expires and explains how to select again', async () => {
    const transport: GuestTransport = {
      snapshot: vi.fn().mockResolvedValue(snapshot({ holds: [{ index: 0, expiresAt: '2026-09-20T18:01:30.000Z', mine: true }], heldCells: [0] })),
      manage: vi.fn().mockRejectedValue(Object.assign(new Error('Your hold expired. Select a square again.'), { code: 'HOLD_EXPIRED' })),
    };
    show(transport);
    const input = await screen.findByLabelText('Name on your squares');
    fireEvent.change(input, { target: { value: 'Maria' } });
    fireEvent.click(screen.getByRole('button', { name: 'Claim 1 square' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Select a square again');
    expect(input).toHaveValue('Maria');
  });

  it('refreshes at the server hold deadline instead of waiting for the fallback poll', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const held = snapshot({
      serverTime: '2026-09-20T18:00:00.000Z',
      holds: [{ index: 0, expiresAt: '2026-09-20T18:00:05.000Z', mine: true }],
      heldCells: [0],
    });
    const transport: GuestTransport = { snapshot: vi.fn().mockResolvedValue(held), manage: vi.fn() };
    show(transport);
    await screen.findByRole('gridcell', { name: /Square 1, held for you/i });
    expect(transport.snapshot).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5_100);
    await waitFor(() => expect(transport.snapshot).toHaveBeenCalledTimes(2));
    vi.useRealTimers();
  });

  it('refreshes when another guest hold expires', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const held = snapshot({
      serverTime: '2026-09-20T18:00:00.000Z',
      holds: [{ index: 1, expiresAt: '2026-09-20T18:00:04.000Z', mine: false }],
    });
    const transport: GuestTransport = { snapshot: vi.fn().mockResolvedValue(held), manage: vi.fn() };
    show(transport);
    await screen.findByRole('gridcell', { name: /Square 2, temporarily held/i });
    await vi.advanceTimersByTimeAsync(4_100);
    await waitFor(() => expect(transport.snapshot).toHaveBeenCalledTimes(2));
    vi.useRealTimers();
  });

  it('clears a selectable board immediately when a hold reports a terminal invite error', async () => {
    const transport: GuestTransport = {
      snapshot: vi.fn().mockResolvedValue(snapshot()),
      manage: vi.fn(),
    };
    vi.mocked(transport.snapshot).mockResolvedValueOnce(snapshot()).mockRejectedValue(Object.assign(new Error('Access denied'), { code: 'INVITE_INACTIVE', status: 403 }));
    show(transport);
    fireEvent.click(await screen.findByRole('gridcell', { name: /Square 1, available/i }));
    expect(await screen.findByText('This invite link is no longer active.')).toBeInTheDocument();
    expect(screen.queryByRole('gridcell', { name: /Square 1, available/i })).not.toBeInTheDocument();
  });

  it('preserves the acknowledged hold and explains the limit instead of silently replacing it', async () => {
    const held = snapshot({ holds: [{ index: 0, expiresAt: '2026-09-20T18:01:30.000Z', mine: true }], heldCells: [0] });
    const transport: GuestTransport = { snapshot: vi.fn().mockResolvedValue(held), manage: vi.fn() };
    show(transport);
    await screen.findByRole('gridcell', { name: /Square 1, held for you/i });
    fireEvent.click(screen.getByRole('gridcell', { name: /Square 2, available/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('up to 1 square');
    expect(screen.getByRole('gridcell', { name: /Square 1, held for you/i })).toHaveAttribute('aria-selected', 'true');
    expect(transport.snapshot).toHaveBeenCalledTimes(1);
  });

  it('shows the private claim code and generic outside-GridOne payment details after confirmation', async () => {
    const receipt = { groupId: 'group-1', inviteId: 'invite-1', displayName: 'Maria', cells: [0], claimedAt: '2026-09-20T18:00:10Z', canManage: true, claimCode: 'amber-river-maple-star', payment: { label: 'Arrange payment with Anthony', detail: 'Text Anthony after claiming.', url: 'https://example.com/anthony' } };
    const transport: GuestTransport = {
      snapshot: vi.fn().mockResolvedValue(snapshot({ holds: [{ index: 0, expiresAt: '2026-09-20T18:01:30.000Z', mine: true }], heldCells: [0] })),
      manage: vi.fn().mockResolvedValue(receipt),
    };
    show(transport);
    fireEvent.change(await screen.findByLabelText('Name on your squares'), { target: { value: ' Maria ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Claim 1 square' }));
    expect(await screen.findByRole('heading', { name: 'Your squares are claimed' })).toBeInTheDocument();
    expect(screen.getByText('amber-river-maple-star')).toBeInTheDocument();
    expect(screen.getByText(/Payments happen outside GridOne/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Arrange payment with Anthony' })).toHaveAttribute('href', 'https://example.com/anthony');
    expect(transport.manage).toHaveBeenCalledWith(expect.objectContaining({ action: 'confirm', name: 'Maria', cells: [0] }));
  });

  it('recovers a receipt with a claim code and keeps the prior receipt when a swap fails', async () => {
    const receipt = { groupId: 'group-1', inviteId: 'invite-1', displayName: 'Maria', cells: [0], claimedAt: '2026-09-20T18:00:10Z', canManage: true, payment: null };
    const transport: GuestTransport = {
      snapshot: vi.fn().mockResolvedValue(snapshot()),
      manage: vi.fn().mockResolvedValueOnce(receipt).mockRejectedValueOnce(new Error('Someone just grabbed that one — pick another.')),
    };
    show(transport);
    fireEvent.change(await screen.findByLabelText('Private claim code'), { target: { value: 'amber river maple star' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open my claim' }));
    expect(await screen.findByRole('heading', { name: 'Your squares are claimed' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change squares' }));
    fireEvent.click(screen.getByRole('gridcell', { name: /Square 2, available/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save square change' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Someone just grabbed');
    expect(screen.getByText(/Current claim: Square 1/)).toBeInTheDocument();
    expect(transport.snapshot).toHaveBeenCalledTimes(1);
  });

  it('allows claim-code recovery when the invite read is dead or missing', async () => {
    const receipt = { groupId: 'group-1', inviteId: 'invite-1', displayName: 'Maria', cells: [0], claimedAt: '2026-09-20T18:00:10Z', canManage: false, payment: null };
    const transport: GuestTransport = {
      snapshot: vi.fn().mockRejectedValue(Object.assign(new Error('Access denied'), { code: 'INVITE_DISABLED', status: 403 })),
      manage: vi.fn().mockResolvedValue(receipt),
    };
    show(transport, '/p/11111111-1111-4111-8111-111111111111');
    expect(await screen.findByText('This invite link is no longer active.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Private claim code'), { target: { value: 'amber river maple star' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open my claim' }));
    expect(await screen.findByRole('heading', { name: 'Your squares are claimed' })).toBeInTheDocument();
  });

  it('keeps a newly issued claim code when a background snapshot omits the one-time secret', async () => {
    const held = snapshot({ holds: [{ index: 0, expiresAt: '2026-09-20T18:01:30.000Z', mine: true }], heldCells: [0] });
    const publicReceipt = { groupId: 'group-1', inviteId: 'invite-1', displayName: 'Maria', cells: [0], claimedAt: '2026-09-20T18:00:10Z', canManage: true, payment: null };
    const issued = { ...publicReceipt, claimCode: 'amber-river-maple-star' };
    const transport: GuestTransport = {
      snapshot: vi.fn().mockResolvedValueOnce(held).mockResolvedValue({ ...held, mine: publicReceipt, holds: [], heldCells: [] }),
      manage: vi.fn().mockResolvedValue(issued),
    };
    show(transport);
    fireEvent.change(await screen.findByLabelText('Name on your squares'), { target: { value: 'Maria' } });
    fireEvent.click(screen.getByRole('button', { name: 'Claim 1 square' }));
    expect(await screen.findByText('amber-river-maple-star')).toBeInTheDocument();
    fireEvent.focus(window);
    await waitFor(() => expect(transport.snapshot).toHaveBeenCalledTimes(2));
    expect(screen.getByText('amber-river-maple-star')).toBeInTheDocument();
  });

  it('keeps an empty managed receipt after release so the guest can choose again', async () => {
    const existing = { groupId: 'group-1', inviteId: 'invite-1', displayName: 'Maria', cells: [0], claimedAt: '2026-09-20T18:00:10Z', canManage: true, claimCode: 'amber-river-maple-star', payment: null };
    const released = { ...existing, cells: [] };
    const transport: GuestTransport = {
      snapshot: vi.fn().mockResolvedValueOnce(snapshot({ mine: existing })).mockResolvedValue(snapshot()),
      manage: vi.fn().mockResolvedValue(released),
    };
    show(transport);
    fireEvent.click(await screen.findByRole('button', { name: 'Release my claim' }));
    expect(await screen.findByText(/No squares currently claimed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose squares' })).toBeInTheDocument();
    expect(screen.getByText('amber-river-maple-star')).toBeInTheDocument();
  });

  it('removes stale selectable state when a background read says the invite is dead', async () => {
    const transport: GuestTransport = {
      snapshot: vi.fn().mockResolvedValueOnce(snapshot()).mockRejectedValue(Object.assign(new Error('Access denied'), { code: 'INVITE_DISABLED', status: 403 })),
      manage: vi.fn(),
    };
    show(transport);
    await screen.findByRole('gridcell', { name: /Square 1, available/i });
    fireEvent.focus(window);
    expect(await screen.findByText('This invite link is no longer active.')).toBeInTheDocument();
    expect(screen.queryByRole('gridcell', { name: /Square 1, available/i })).not.toBeInTheDocument();
  });

  it.each([
    ['finalized', 'Game numbers are locked. You can still follow the board.'],
    ['disabled', 'This invite link is no longer active.'],
  ])('renders the %s state without claim controls', async (state, message) => {
    const value = state === 'finalized'
      ? snapshot({ stage: 'finalized' })
      : snapshot({ invite: { ...snapshot().invite!, disabledAt: '2026-09-20T18:00:00Z' } });
    show({ snapshot: vi.fn().mockResolvedValue(value), manage: vi.fn() });
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Claim \d/ })).not.toBeInTheDocument();
  });
});
