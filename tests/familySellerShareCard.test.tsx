import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FamilySellerShareCard from '../src/features/family/FamilySellerShareCard';
const token = 'a'.repeat(64);
const url = `${window.location.origin}/s/0123456789abcdef`;
const response = (body: unknown) => ({ ok: true, json: async () => body });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); });
describe('Family seller sharing', () => {
  it('reads without creating and creates one stable buyer link for copying, never the private token', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ state: 'not_created', availableCount: 2 })).mockResolvedValue(response({ state: 'active', availableCount: 2, url: '/s/0123456789abcdef' }));
    vi.stubGlobal('fetch', fetcher);
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
    render(<FamilySellerShareCard token={token} revision={1} disabled={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create buyer link' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy buyer link' }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith(url));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ action: 'read' });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ action: 'create' });
    expect(document.body.textContent).not.toContain(token);
  });
  it.each(['https://evil.example/s/0123456789abcdef', `${url}#private`, `${window.location.origin}/family#${token}`])('rejects unsafe buyer URL %s', async bad => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ state: 'active', availableCount: 2, url: bad })));
    render(<FamilySellerShareCard token={token} revision={1} disabled={false} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');
    expect(screen.queryByRole('button', { name: 'Copy buyer link' })).not.toBeInTheDocument();
  });
  it.each(['not_shared', 'locked', 'no_available'])('does not offer creation for %s', async state => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ state, availableCount: 0 })));
    render(<FamilySellerShareCard token={token} revision={1} disabled={false} />);
    await waitFor(() => expect(screen.queryByText('Checking available squares…')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Create buyer link' })).not.toBeInTheDocument();
  });
  it('disables sharing with unsaved changes and refreshes after saved revision changes', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ state: 'active', availableCount: 2, url }));
    vi.stubGlobal('fetch', fetcher);
    const { rerender } = render(<FamilySellerShareCard token={token} revision={1} disabled={true} />);
    expect(await screen.findByRole('button', { name: 'Copy buyer link' })).toBeDisabled();
    rerender(<FamilySellerShareCard token={token} revision={2} disabled={false} />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Copy buyer link' })).toBeEnabled();
  });
  it('shares only the public buyer URL using the native share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ state: 'active', availableCount: 2, url })));
    render(<FamilySellerShareCard token={token} revision={1} disabled={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Share buyer link' }));
    expect(share).toHaveBeenCalledWith({ title: 'Choose your squares', url });
  });
  it('provides selectable public URL when copying is denied', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ state: 'active', availableCount: 2, url })));
    render(<FamilySellerShareCard token={token} revision={1} disabled={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Copy buyer link' }));
    expect(await screen.findByLabelText('Buyer link')).toHaveValue(url);
  });
  it('ignores a stale request after a saved revision refresh', async () => {
    let finish: (value: unknown) => void = () => {};
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(response({ state: 'no_available', availableCount: 0 }));
    vi.stubGlobal('fetch', fetcher);
    const { rerender } = render(<FamilySellerShareCard token={token} revision={1} disabled={false} />);
    rerender(<FamilySellerShareCard token={token} revision={2} disabled={false} />);
    await screen.findByText(/No squares are available/);
    finish(response({ state: 'active', availableCount: 2, url }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Copy buyer link' })).not.toBeInTheDocument());
  });

});
