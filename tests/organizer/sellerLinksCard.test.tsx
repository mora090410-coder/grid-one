import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/supabase', () => ({ supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'jwt' } } })) } } }));
import SellerLinksCard from '../../src/features/organizer/sellers/SellerLinksCard';
import { allLinksMessage, summarizeSellers } from '../../src/features/organizer/sellers/sellerLinksModel';

const labels = Array.from({ length: 100 }, (_, i) => (i < 10 ? 'Anthony' : i < 15 ? 'Maria' : null));
const squares = Array.from({ length: 100 }, (_, i) => (i < 3 ? ['Buyer'] : labels[i] ? [labels[i]!] : []));
const links = [
  { label: 'Anthony', code: '0123456789abcdef', url: 'https://www.getgridone.com/s/0123456789abcdef' },
  { label: 'Maria', code: 'fedcba9876543210', url: 'https://www.getgridone.com/s/fedcba9876543210' },
];
const flush = vi.fn(async () => ({ status: 'clean', revision: 4 }));

beforeEach(() => { flush.mockClear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('seller links model', () => {
  it('counts each seller’s squares and the ones still in their own name', () => {
    expect(summarizeSellers(labels, squares)).toEqual([
      { label: 'Anthony', total: 10, unsold: 7 },
      { label: 'Maria', total: 5, unsold: 5 },
    ]);
  });
  it('writes one team-chat message with every link', () => {
    expect(allLinksMessage('Lincoln Board', links)).toBe(
      'Here’s everyone’s link for Lincoln Board. Post yours so people can pick your squares:\n\nAnthony: https://www.getgridone.com/s/0123456789abcdef\nMaria: https://www.getgridone.com/s/fedcba9876543210',
    );
  });
});

describe('SellerLinksCard', () => {
  it('asks the organizer to share first when the board is private', () => {
    render(<SellerLinksCard boardId="b1" boardTitle="Lincoln Board" shared={false} labels={labels} squares={squares} clean flush={flush} />);
    expect(screen.getByText('Share your board first. Then every seller gets their own link.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get seller links' })).not.toBeInTheDocument();
  });

  it('gets every seller’s link in one tap and shares each with a written message', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ links }) });
    vi.stubGlobal('fetch', fetcher);
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    render(<SellerLinksCard boardId="b1" boardTitle="Lincoln Board" shared labels={labels} squares={squares} clean flush={flush} />);
    expect(screen.getByText('2 sellers · 15 squares')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Get seller links' }));
    const list = await screen.findByRole('list', { name: 'Seller links' });
    expect(flush).toHaveBeenCalled();
    expect(fetcher.mock.calls[0][0]).toBe('/api/pools/b1/seller-links');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ action: 'sync' });
    const anthony = within(list).getByRole('listitem', { name: 'Anthony' });
    expect(within(anthony).getByText('10 squares · 7 not sold yet')).toBeInTheDocument();
    fireEvent.click(within(anthony).getByRole('button', { name: 'Share Anthony’s link' }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({
      title: 'Lincoln Board',
      text: 'I’m selling football squares for Lincoln Board. Pick yours here and pay me directly:',
      url: links[0].url,
    }));
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });

  it('copies all links at once for the team chat', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ links }) }));
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<SellerLinksCard boardId="b1" boardTitle="Lincoln Board" shared labels={labels} squares={squares} clean flush={flush} />);
    fireEvent.click(screen.getByRole('button', { name: 'Get seller links' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy all links' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(allLinksMessage('Lincoln Board', links)));
    expect(await screen.findByRole('status')).toHaveTextContent('All links copied. Paste them in your team chat.');
  });

  it('replaces one seller’s link after confirming', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ links }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ links: [{ ...links[0], code: 'aaaaaaaaaaaaaaaa', url: 'https://www.getgridone.com/s/aaaaaaaaaaaaaaaa' }, links[1]] }) });
    vi.stubGlobal('fetch', fetcher);
    render(<SellerLinksCard boardId="b1" boardTitle="Lincoln Board" shared labels={labels} squares={squares} clean flush={flush} />);
    fireEvent.click(screen.getByRole('button', { name: 'Get seller links' }));
    const anthony = within(await screen.findByRole('list', { name: 'Seller links' })).getByRole('listitem', { name: 'Anthony' });
    fireEvent.click(within(anthony).getByRole('button', { name: 'New link for Anthony' }));
    fireEvent.click(within(anthony).getByRole('button', { name: 'Yes, replace Anthony’s link' }));
    await waitFor(() => expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ action: 'rotate', label: 'Anthony' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Anthony has a new link. The old one stopped working.');
  });

  it('shows a plain error and keeps the button usable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'Seller links are temporarily unavailable. Please try again.' }) }));
    render(<SellerLinksCard boardId="b1" boardTitle="Lincoln Board" shared labels={labels} squares={squares} clean flush={flush} />);
    fireEvent.click(screen.getByRole('button', { name: 'Get seller links' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Seller links are temporarily unavailable. Please try again.');
    expect(screen.getByRole('button', { name: 'Get seller links' })).toBeEnabled();
  });
});
