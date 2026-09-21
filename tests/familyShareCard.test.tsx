import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FamilyShareCard from '../src/features/family/FamilyShareCard';

const token = 'a'.repeat(64);
const active = {
  boardId: '5a812684-87d1-4c10-9638-d81822b1f755', title: 'Baseball board', label: 'Anthony',
  cells: [12, 13], revision: 4, state: 'active' as const, availableCount: 1, maxSquares: 1,
  url: 'https://www.getgridone.com/p/5a812684-87d1-4c10-9638-d81822b1f755?invite=public-token',
};

const response = (body: unknown, init: { ok?: boolean; status?: number } = {}) => ({
  ok: init.ok ?? true, status: init.status ?? 200, json: async () => body,
});

function props(overrides: Partial<React.ComponentProps<typeof FamilyShareCard>> = {}) {
  return {
    token, dirty: false, disabled: false, refreshKey: 0,
    onBusy: vi.fn(), onCreated: vi.fn(async () => undefined), ...overrides,
  };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('FamilyShareCard', () => {
  it('reads only link state, shows saved availability, and never leaks the private family URL', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(active));
    vi.stubGlobal('fetch', fetcher);
    render(<FamilyShareCard {...props()} />);

    expect(await screen.findByRole('heading', { name: 'Share your squares' })).toBeInTheDocument();
    expect(screen.getByText('1 of 2 squares available')).toBeInTheDocument();
    expect(screen.getByLabelText('Public buyer link')).toHaveValue(active.url);
    expect((screen.getByLabelText('Prepared share message') as HTMLTextAreaElement).value).toContain(active.url);
    expect(document.body.textContent).not.toContain(token);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe('/api/family/guest-link');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${token}`);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ action: 'read' });
  });

  it('creates the stable full-scope link explicitly even when zero squares are available', async () => {
    const notCreated = { ...active, state: 'not_created' as const, availableCount: 0, url: undefined };
    const fetcher = vi.fn().mockResolvedValueOnce(response(notCreated)).mockResolvedValueOnce(response({ ...active, revision: 5, availableCount: 0 }));
    vi.stubGlobal('fetch', fetcher);
    const input = props();
    render(<FamilyShareCard {...input} />);

    expect(await screen.findByText('0 of 2 squares available')).toBeInTheDocument();
    expect(screen.getByText(/mark squares Available below/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create public buyer link' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ action: 'create' });
    expect(input.onCreated).toHaveBeenCalledOnce();
    expect(await screen.findByLabelText('Public buyer link')).toHaveValue(active.url);
  });

  it('requires saved family edits before creation but permits an existing-link copy', async () => {
    const clipboard = { writeText: vi.fn(async () => undefined) };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
    const fetcher = vi.fn().mockResolvedValue(response(active));
    vi.stubGlobal('fetch', fetcher);
    const { rerender } = render(<FamilyShareCard {...props()} />);
    await screen.findByLabelText('Public buyer link');
    rerender(<FamilyShareCard {...props({ dirty: true })} />);
    expect(screen.getByText(/saved availability/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy buyer link' }));
    await waitFor(() => expect(clipboard.writeText).toHaveBeenCalledWith(active.url));

    const notCreated = { ...active, state: 'not_created' as const, url: undefined };
    fetcher.mockResolvedValue(response(notCreated));
    rerender(<FamilyShareCard {...props({ dirty: true, refreshKey: 1 })} />);
    expect(await screen.findByRole('button', { name: 'Create public buyer link' })).toBeDisabled();
    expect(screen.getByText('Save changes before creating your share link.')).toBeInTheDocument();
  });

  it('treats native share cancellation as a quiet cancellation', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn(async () => { throw new DOMException('cancelled', 'AbortError'); }) });
    const clipboard = { writeText: vi.fn(async () => undefined) };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(active)));
    render(<FamilyShareCard {...props()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Share buyer link' }));
    await waitFor(() => expect(navigator.share).toHaveBeenCalledOnce());
    expect(clipboard.writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('falls back to a truthful prepared-message copy when native share is unavailable', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    const clipboard = { writeText: vi.fn().mockRejectedValue(new Error('denied')) };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(active)));
    render(<FamilyShareCard {...props()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Share buyer link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be copied');
    expect(clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining(active.url));
  });

  it.each([
    ['disabled', /disabled/i], ['expired', /expired/i], ['locked', /locked/i],
    ['not_shared', /organizer must share/i], ['scope_mismatch', /assigned squares changed/i],
  ] as const)('does not offer activation for %s state', async (state, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...active, state, url: undefined })));
    render(<FamilyShareCard {...props()} />);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create public buyer link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Share buyer link/i })).not.toBeInTheDocument();
  });

  it('keeps rollout-off state visible on 404 and refreshes when saved availability changes', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ code: 'NOT_FOUND' }, { ok: false, status: 404 }))
      .mockResolvedValueOnce(response({ ...active, availableCount: 2 }));
    vi.stubGlobal('fetch', fetcher);
    const input = props();
    const { rerender } = render(<FamilyShareCard {...input} />);
    expect(await screen.findByText(/not available for this board yet/i)).toBeInTheDocument();
    rerender(<FamilyShareCard {...input} refreshKey={1} />);
    expect(await screen.findByText('2 of 2 squares available')).toBeInTheDocument();
  });

  it('does not let an older read overwrite a newer created link', async () => {
    let resolveRefresh!: (value: ReturnType<typeof response>) => void;
    const staleRefresh = new Promise<ReturnType<typeof response>>(resolve => { resolveRefresh = resolve; });
    const notCreated = { ...active, state: 'not_created' as const, url: undefined };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(notCreated))
      .mockReturnValueOnce(staleRefresh)
      .mockResolvedValueOnce(response({ ...active, revision: 5 }));
    vi.stubGlobal('fetch', fetcher);
    const input = props();
    const { rerender } = render(<FamilyShareCard {...input} />);
    await screen.findByRole('button', { name: 'Create public buyer link' });
    rerender(<FamilyShareCard {...input} refreshKey={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create public buyer link' }));
    expect(await screen.findByLabelText('Public buyer link')).toHaveValue(active.url);
    resolveRefresh(response(notCreated));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(screen.getByLabelText('Public buyer link')).toHaveValue(active.url);
  });

  it('honors a disabled state returned during create without announcing a ready link', async () => {
    const notCreated = { ...active, state: 'not_created' as const, url: undefined };
    const fetcher = vi.fn().mockResolvedValueOnce(response(notCreated)).mockResolvedValueOnce(response({ ...notCreated, state: 'disabled' as const }));
    vi.stubGlobal('fetch', fetcher);
    const input = props();
    render(<FamilyShareCard {...input} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create public buyer link' }));
    expect(await screen.findByText(/buyer link is disabled/i)).toBeInTheDocument();
    expect(screen.queryByText(/ready to send/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Public buyer link')).not.toBeInTheDocument();
    expect(input.onCreated).not.toHaveBeenCalled();
  });
});
