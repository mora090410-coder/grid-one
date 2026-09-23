import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SellerClaimPage from '../src/features/seller/SellerClaimPage';
import { amountOwed, claimedSquaresText, parseSellerView, toggleSquare } from '../src/features/seller/sellerClaimModel';

const code = '0123456789abcdef';
const view = {
  title: 'Lincoln Softball Booster Board',
  label: 'Anthony',
  shareCode: 'ABCDEFGH',
  open: true,
  sideTeamName: 'Kansas City Chiefs',
  topTeamName: 'Philadelphia Eagles',
  gameStartsAt: '2026-09-27T17:00:00Z',
  squarePrice: '$20',
  instructions: 'Venmo @anthony',
  cells: [{ index: 61, available: true }, { index: 62, available: true }, { index: 63, available: false }],
};
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number, body: unknown) => ({ ok: false, status, json: async () => body });
const renderPage = () => render(
  <MemoryRouter initialEntries={[`/s/${code}`]}>
    <Routes><Route path="/s/:code" element={<SellerClaimPage />} /></Routes>
  </MemoryRouter>,
);
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe('seller claim model', () => {
  it('accepts only a well-formed public seller view', () => {
    expect(parseSellerView(view)?.cells).toHaveLength(3);
    expect(parseSellerView({ ...view, cells: [{ index: 100, available: true }] })).toBeNull();
    expect(parseSellerView({ ...view, label: 7 })).toBeNull();
  });
  it('toggles squares up to the limit of 10', () => {
    const ten = Array.from({ length: 10 }, (_, i) => i);
    expect(toggleSquare([1], 1)).toEqual([]);
    expect(toggleSquare([1], 2)).toEqual([1, 2]);
    expect(toggleSquare(ten, 50)).toEqual(ten);
  });
  it('adds up what the buyer owes only for plain dollar prices', () => {
    expect(amountOwed('$20', 2)).toBe('$40');
    expect(amountOwed('$12.50', 3)).toBe('$37.50');
    expect(amountOwed('20 dollars', 2)).toBeNull();
    expect(amountOwed(null, 2)).toBeNull();
  });
  it('describes squares by their permanent numbers', () => {
    expect(claimedSquaresText([61])).toBe('Square 62');
    expect(claimedSquaresText([62, 61])).toBe('Squares 62 and 63');
    expect(claimedSquaresText([0, 1, 2])).toBe('Squares 1, 2, and 3');
  });
});

describe('SellerClaimPage', () => {
  it('shows only this seller’s squares, then claims with one tap and remembers the buyer', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(ok(view))
      .mockResolvedValueOnce(ok({ cells: [61, 62], name: 'Maria Lopez', label: 'Anthony', shareCode: 'ABCDEFGH' }));
    vi.stubGlobal('fetch', fetcher);
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Pick your squares from Anthony' })).toBeInTheDocument();
    expect(screen.getByText('$20 a square')).toBeInTheDocument();
    const squares = screen.getByRole('group', { name: 'Anthony’s squares' });
    expect(within(squares).getByRole('button', { name: 'Square 64, taken' })).toBeDisabled();
    const claimButton = screen.getByRole('button', { name: /Claim/ });
    expect(claimButton).toBeDisabled();

    fireEvent.click(within(squares).getByRole('button', { name: 'Square 62, open' }));
    fireEvent.click(within(squares).getByRole('button', { name: 'Square 63, open' }));
    expect(within(squares).getByRole('button', { name: 'Square 62, open' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Your name, as it shows on the board'), { target: { value: 'Maria Lopez' } });
    fireEvent.click(screen.getByRole('button', { name: 'Claim 2 squares' }));

    expect(await screen.findByRole('heading', { name: 'You’re in!' })).toBeInTheDocument();
    expect(screen.getByText('Squares 62 and 63 are yours.')).toBeInTheDocument();
    expect(screen.getByText('Pay Anthony however you usually do. GridOne doesn’t handle money.')).toBeInTheDocument();
    expect(screen.getByText('Venmo @anthony')).toBeInTheDocument();
    expect(screen.getByText('Total: $40')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See the whole board' })).toHaveAttribute('href', '/b/ABCDEFGH');
    expect(fetcher.mock.calls[1][0]).toBe(`/api/sellers/${code}`);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ cells: [61, 62], name: 'Maria Lopez' });
    expect(JSON.parse(localStorage.getItem('gridone:find-squares:ABCDEFGH')!)).toEqual({ version: 1, displayName: 'Maria Lopez' });
  });

  it('keeps the name and refreshes squares when someone else got there first', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(ok(view))
      .mockResolvedValueOnce(fail(409, { code: 'SQUARE_TAKEN', error: 'taken' }))
      .mockResolvedValueOnce(ok({ ...view, cells: [{ index: 61, available: false }, { index: 62, available: true }, { index: 63, available: false }] })));
    renderPage();
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Square 62, open' }));
    fireEvent.change(screen.getByLabelText('Your name, as it shows on the board'), { target: { value: 'Maria' } });
    fireEvent.click(screen.getByRole('button', { name: 'Claim 1 square' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Someone just grabbed one of those squares. Pick another.');
    expect(await screen.findByRole('button', { name: 'Square 62, taken' })).toBeDisabled();
    expect(screen.getByLabelText('Your name, as it shows on the board')).toHaveValue('Maria');
  });

  it('closes claiming once the numbers are locked and points to the board', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok({ ...view, open: false })));
    renderPage();
    expect(await screen.findByText('The numbers are locked, so claiming is closed.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Claim/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See the whole board' })).toHaveAttribute('href', '/b/ABCDEFGH');
  });

  it('says plainly when every square is spoken for', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok({ ...view, cells: [{ index: 63, available: false }] })));
    renderPage();
    expect(await screen.findByText('All of Anthony’s squares are taken.')).toBeInTheDocument();
  });

  it('explains a dead link without guessing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(fail(404, { error: 'nope' })));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('This seller link isn’t active. Ask the seller for a new one.');
  });

  it('does not submit twice while a claim is in flight', async () => {
    let resolveClaim: (value: unknown) => void = () => {};
    const fetcher = vi.fn()
      .mockResolvedValueOnce(ok(view))
      .mockImplementationOnce(() => new Promise(resolve => { resolveClaim = resolve; }));
    vi.stubGlobal('fetch', fetcher);
    renderPage();
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Square 62, open' }));
    fireEvent.change(screen.getByLabelText('Your name, as it shows on the board'), { target: { value: 'Maria' } });
    const button = screen.getByRole('button', { name: 'Claim 1 square' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    resolveClaim(ok({ cells: [61], name: 'Maria', label: 'Anthony', shareCode: 'ABCDEFGH' }));
    expect(await screen.findByRole('heading', { name: 'You’re in!' })).toBeInTheDocument();
  });
});
