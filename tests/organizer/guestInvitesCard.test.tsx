import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GuestInvitesCard from '../../src/features/organizer/workspace/GuestInvitesCard';
import type { BoardData } from '../../types';

vi.mock('../../services/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'owner-token' } } }) },
    channel: () => { const value: any = { on: () => value, subscribe: () => value }; return value; },
    removeChannel: async () => undefined,
  },
}));

const board = {
  squares: Array.from({ length: 100 }, (_, index) => index === 0 ? ['Anthony'] : index === 1 ? ['Existing buyer'] : []),
  availability: Array.from({ length: 100 }, (_, index) => index < 3 ? 'available' : 'unspecified'),
} as BoardData;

const list = {
  revision: 7,
  invites: [{
    id: 'invite-1', label: 'Anthony', cells: [0, 1], maxSquares: 1, version: 1,
    expiresAt: null, disabledAt: null, url: 'https://gridone.app/p/board-1?invite=stable',
    payment: { label: 'Arrange payment with Anthony', detail: 'Text 555-0100', url: 'https://example.com/pay' },
    counts: { available: 0, held: 1, claimed: 1 },
  }],
  claims: [{ groupId: 'claim-1', inviteId: 'invite-1', displayName: 'Jamie', cells: [1], claimedAt: '2026-09-20T12:00:00Z', canManage: false, payment: null }],
  holds: [{ index: 0, inviteId: 'invite-1', expiresAt: '2026-09-20T12:01:30Z' }],
};

const props = () => ({
  boardId: 'board-1', board, clean: true, workspaceRevision: 7,
  flush: vi.fn(async () => ({ status: 'clean', revision: 7 })),
  onReload: vi.fn(async () => undefined), onSync: vi.fn(async () => undefined), onBusy: vi.fn(),
});

afterEach(() => { vi.restoreAllMocks(); });

describe('GuestInvitesCard', () => {
  it('hides the guest-link surface when the rollout gate returns 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }));
    const { container } = render(<GuestInvitesCard {...props()} />);
    fireEvent.click(screen.getByText('Guest claim links (optional)'));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('reviews offered names, requires acknowledgement, and creates only explicitly available squares after flushing', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 7, invites: [], claims: [], holds: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify(list)));
    const inputProps = props();
    render(<GuestInvitesCard {...inputProps} />);
    fireEvent.click(screen.getByText('Guest claim links (optional)'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Seller label'), { target: { value: 'Anthony' } });
    fireEvent.change(screen.getByLabelText('Guest square numbers'), { target: { value: '1-2' } });
    expect(screen.getByLabelText('Guest link offer review')).toHaveTextContent('Square 1: Anthony');
    expect(screen.getByLabelText('Guest link offer review')).toHaveTextContent('Square 2: Existing buyer');
    expect(screen.getByRole('button', { name: 'Create guest link' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /replace the current public names/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Create guest link' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(inputProps.flush).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      action: 'create', revision: 7, label: 'Anthony', cells: [0, 1], maxSquares: 1, offerAcknowledged: true,
    });
  });

  it('shows stable share controls, occupancy counts, source-labelled claims, and private payment preview', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(list)));
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<GuestInvitesCard {...props()} />);
    fireEvent.click(screen.getByText('Guest claim links (optional)'));
    await screen.findByRole('article', { name: 'Guest link for Anthony' });
    const invite = screen.getByRole('article', { name: 'Guest link for Anthony' });
    expect(within(invite).getByText('0 available · 1 held · 1 claimed')).toBeInTheDocument();
    expect(within(invite).getByText(/Jamie · Squares 2 · Claimed through Anthony/)).toBeInTheDocument();
    expect(within(within(invite).getByLabelText('Payment preview for Anthony')).getByText('Text 555-0100')).toBeInTheDocument();
    fireEvent.click(within(invite).getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(list.invites[0].url));
    expect(await screen.findByText('Guest link copied.')).toBeInTheDocument();
    expect(within(invite).getByLabelText('Guest link URL')).toHaveValue(list.invites[0].url);
  });

  it('requires explicit confirmation for destructive owner actions and returns a reusable recovery code', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(list)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...list, claimCode: 'amber-river-quiet-maple' })));
    render(<GuestInvitesCard {...props()} />);
    fireEvent.click(screen.getByText('Guest claim links (optional)'));
    await screen.findByRole('article', { name: 'Guest link for Anthony' });
    fireEvent.click(screen.getByRole('button', { name: 'Rotate Jamie claim code' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/old code/i));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ action: 'rotate_code', revision: 7, groupId: 'claim-1' });
    expect(await screen.findByText('amber-river-quiet-maple')).toBeInTheDocument();
    expect(screen.getByText('New recovery code')).toBeInTheDocument();
    expect(screen.getByText(/remains valid until you rotate it again/i)).toBeInTheDocument();
  });

  it('confirms release, hold cancellation, regeneration, and disable before sending owner actions', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(list)));
    render(<GuestInvitesCard {...props()} />);
    fireEvent.click(screen.getByText('Guest claim links (optional)'));
    await screen.findByRole('article', { name: 'Guest link for Anthony' });
    for (const name of ['Release claim', 'Cancel active holds', 'Regenerate link', 'Disable link']) {
      const before = fetchMock.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name }));
      await waitFor(() => expect(fetchMock.mock.calls.length).toBe(before + 1));
    }
    expect(confirm).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.slice(1).map(call => JSON.parse(String(call[1]?.body)).action)).toEqual([
      'release_claim', 'cancel_holds', 'regenerate', 'disable',
    ]);
  });

  it('edits scope and settings with the exact flushed board revision', async () => {
    const updated = { ...list, revision: 9 };
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(updated)))
      .mockResolvedValueOnce(new Response(JSON.stringify(updated)));
    const inputProps = { ...props(), flush: vi.fn(async () => ({ status: 'clean', revision: 8 })) };
    render(<GuestInvitesCard {...inputProps} />);
    fireEvent.click(screen.getByText('Guest claim links (optional)'));
    await screen.findByRole('article', { name: 'Guest link for Anthony' });
    fireEvent.click(screen.getByText('Manage settings'));
    fireEvent.change(screen.getByLabelText('Managed square numbers'), { target: { value: '1-2' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /reviewed the updated offer/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save guest link settings' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({ action: 'update', revision: 8, inviteId: 'invite-1', cells: [0, 1], offerAcknowledged: true });
  });

  it('shows disabled or expired state, anonymous hold time, and disables every mutation while the draft is dirty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      ...list,
      invites: [{ ...list.invites[0], disabledAt: '2026-09-20T12:00:00Z' }],
    })));
    render(<GuestInvitesCard {...props()} clean={false} />);
    fireEvent.click(screen.getByText('Guest claim links (optional)'));
    const invite = await screen.findByRole('article', { name: 'Guest link for Anthony' });
    expect(within(invite).getByText('Disabled')).toBeInTheDocument();
    expect(within(invite).getByText(/Guest selecting square 1/)).toBeInTheDocument();
    for (const name of ['Rotate Jamie claim code', 'Release claim', 'Cancel active holds', 'Reactivate with new link']) {
      expect(within(invite).getByRole('button', { name })).toBeDisabled();
    }
  });

  it('requires a future expiry before reactivating a disabled expired invite', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      ...list,
      invites: [{ ...list.invites[0], disabledAt: '2026-09-19T12:00:00Z', expiresAt: '2026-09-19T12:00:00Z' }],
    })));
    render(<GuestInvitesCard {...props()} />);
    fireEvent.click(screen.getByText('Guest claim links (optional)'));
    const invite = await screen.findByRole('article', { name: 'Guest link for Anthony' });
    expect(within(invite).getByText('Disabled · expired')).toBeInTheDocument();
    expect(within(invite).getByText(/Set a future expiry in Manage settings/i)).toBeInTheDocument();
    expect(within(invite).getByRole('button', { name: 'Reactivate with new link' })).toBeDisabled();
  });

  it('attributes overlapping holds only to the invite that created them', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      ...list,
      invites: [list.invites[0], { ...list.invites[0], id: 'invite-2', label: 'Jordan', counts: { available: 1, held: 0, claimed: 0 } }],
    })));
    render(<GuestInvitesCard {...props()} />);
    fireEvent.click(screen.getByText('Guest claim links (optional)'));
    const anthony = await screen.findByRole('article', { name: 'Guest link for Anthony' });
    const jordan = screen.getByRole('article', { name: 'Guest link for Jordan' });
    expect(within(anthony).getByText(/Guest selecting square 1/)).toBeInTheDocument();
    expect(within(jordan).queryByText(/Guest selecting square 1/)).not.toBeInTheDocument();
  });

  it('syncs a clean workspace to a newer guest revision but preserves dirty edits', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ ...list, revision: 8 })));
    const cleanProps = props();
    const { unmount } = render(<GuestInvitesCard {...cleanProps} />);
    fireEvent.click(screen.getByText('Guest claim links (optional)'));
    await waitFor(() => expect(cleanProps.onSync).toHaveBeenCalledOnce());
    unmount();

    const dirtyProps = { ...props(), clean: false };
    render(<GuestInvitesCard {...dirtyProps} />);
    fireEvent.click(screen.getByText('Guest claim links (optional)'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Your edits are still here/);
    expect(dirtyProps.onSync).not.toHaveBeenCalled();
  });

  it('does not auto-sync if an edit starts while the guest summary is loading', async () => {
    let resolveFetch!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(resolve => { resolveFetch = resolve; }));
    const inputProps = props();
    const { rerender } = render(<GuestInvitesCard {...inputProps} />);
    fireEvent.click(screen.getByText('Guest claim links (optional)'));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledOnce());
    rerender(<GuestInvitesCard {...inputProps} clean={false} />);
    resolveFetch(new Response(JSON.stringify({ ...list, revision: 8 })));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Your edits are still here/);
    expect(inputProps.onSync).not.toHaveBeenCalled();
  });

  it('rejects unsafe payment destinations and incomplete payment instructions before create', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ revision: 7, invites: [], claims: [], holds: [] })));
    render(<GuestInvitesCard {...props()} />);
    fireEvent.click(screen.getByText('Guest claim links (optional)'));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Seller label'), { target: { value: 'Anthony' } });
    fireEvent.change(screen.getByLabelText('Guest square numbers'), { target: { value: '1-2' } });
    fireEvent.click(screen.getByText('External payment instructions (optional)'));
    fireEvent.change(screen.getByLabelText('HTTPS payment link'), { target: { value: 'https://user@example.com/pay#claim' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /replace the current public names/i }));
    expect(screen.getByText(/public HTTPS link without credentials/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create guest link' })).toBeDisabled();
  });
});
