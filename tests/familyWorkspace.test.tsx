import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FamilyWorkspace from '../src/features/family/FamilyWorkspace';

const token = 'a'.repeat(64);
const record = { title: 'Baseball board', revision: 3, label: 'Anthony', cells: [{ index: 12, name: 'Anthony', availability: 'unspecified' }, { index: 13, name: 'Bill W', availability: 'available' }] };
const http = (body: unknown, init: { ok?: boolean; status?: number } = {}) => ({ ok: init.ok ?? true, status: init.status ?? 200, json: async () => body });
const familyFetcher = (...results: Array<ReturnType<typeof http> | Error>) => {
  const queue = [...results];
  return vi.fn(async (url: string) => {
    if (url === '/api/family/guest-link') return http({ code: 'SHARING_UNAVAILABLE' }, { ok: false, status: 404 });
    const next = queue.shift();
    if (next instanceof Error) throw next;
    if (!next) throw new Error('Unexpected family request');
    return next;
  });
};
const familyCalls = (fetcher: ReturnType<typeof vi.fn>) => fetcher.mock.calls.filter(call => call[0] === '/api/family');
afterEach(() => { vi.unstubAllGlobals(); window.location.hash = ''; });
describe('FamilyWorkspace', () => {
  it('loads only assigned squares and saves explicit changes with revision and private bearer token', async () => {
    window.location.hash = token;
    const fetcher = familyFetcher(http(record), http({ ...record, revision: 4 }));
    vi.stubGlobal('fetch', fetcher);
    render(<FamilyWorkspace />);
    expect(await screen.findByRole('heading', { name: 'Your 2 squares' })).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Name on square 13'), { target: { value: 'Bill W' } });
    const leaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(familyCalls(fetcher)).toHaveLength(2));
    expect(familyCalls(fetcher)[1][1].headers.Authorization).toBe(`Bearer ${token}`);
    expect(JSON.parse(familyCalls(fetcher)[1][1].body)).toEqual({ action: 'edit', revision: 3, changes: [{ index: 12, name: 'Bill W', availability: 'unspecified' }] });
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
  });
  it('retains typed names after conflicts and requires an explicit reload', async () => {
    window.location.hash = token;
    vi.stubGlobal('fetch', familyFetcher(http(record), http({ error: 'REVISION_CONFLICT' }, { ok: false, status: 409 })));
    render(<FamilyWorkspace />);
    await screen.findByRole('heading', { name: 'Your 2 squares' });
    fireEvent.change(screen.getByLabelText('Name on square 13'), { target: { value: 'Bill W' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('board changed');
    expect(screen.getByLabelText('Name on square 13')).toHaveValue('Bill W');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reload latest' })).toBeInTheDocument();
  });
  it('retains edits after a network failure and does not automatically retry', async () => {
    window.location.hash = token;
    const fetcher = familyFetcher(http(record), new Error('offline'));
    vi.stubGlobal('fetch', fetcher);
    render(<FamilyWorkspace />);
    await screen.findByRole('heading', { name: 'Your 2 squares' });
    fireEvent.change(screen.getByLabelText('Name on square 13'), { target: { value: 'Maria' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save changes');
    expect(screen.getByLabelText('Name on square 13')).toHaveValue('Maria');
    expect(familyCalls(fetcher)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('rejects malformed responses without rendering editable squares', async () => {
    window.location.hash = token;
    vi.stubGlobal('fetch', familyFetcher(http({ ...record, cells: [{ index: 200, name: 'Bad', availability: 'unspecified' }] })));
    render(<FamilyWorkspace />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not open');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('saves one blank allocation without requiring invented names on other allocations', async () => {
    window.location.hash = token;
    const blank = { ...record, cells: record.cells.map(cell => ({ ...cell, name: '' })) };
    const fetcher = familyFetcher(http(blank), http({ ...blank, revision: 4, cells: [{ ...blank.cells[0], name: 'Bill W' }, blank.cells[1]] }));
    vi.stubGlobal('fetch', fetcher);
    render(<FamilyWorkspace />);
    await screen.findByRole('heading', { name: 'Your 2 squares' });
    fireEvent.change(screen.getByLabelText('Name on square 13'), { target: { value: 'Bill W' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(familyCalls(fetcher)).toHaveLength(2));
    expect(JSON.parse(familyCalls(fetcher)[1][1].body).changes).toEqual([{ index: 12, name: 'Bill W', availability: 'unspecified' }]);
  });

  it('does not send invalid links to the API', () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    render(<FamilyWorkspace />);
    expect(screen.getByRole('alert')).toHaveTextContent('Ask your organizer');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('places public sharing before the names and refreshes saved availability after a family save', async () => {
    window.location.hash = token;
    let current = record;
    const guest = (availableCount: number) => ({ boardId: '5a812684-87d1-4c10-9638-d81822b1f755', title: current.title, label: current.label, cells: current.cells.map(cell => cell.index), revision: current.revision, state: 'active', availableCount, maxSquares: 1, url: 'https://www.getgridone.com/p/public' });
    let guestReads = 0;
    const fetcher = vi.fn(async (url: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body));
      if (url === '/api/family/guest-link') return http(guest(++guestReads === 1 ? 1 : 2));
      if (body.action === 'read') return http(current);
      current = { ...current, revision: 4, cells: current.cells.map(cell => cell.index === 12 ? { ...cell, availability: 'available' as const } : cell) };
      return http(current);
    });
    vi.stubGlobal('fetch', fetcher);
    render(<FamilyWorkspace />);
    const shareHeading = await screen.findByRole('heading', { name: 'Share your squares' });
    expect(await screen.findByText('1 of 2 squares available')).toBeInTheDocument();
    const firstName = screen.getByLabelText('Name on square 13');
    expect(shareHeading.compareDocumentPosition(firstName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Availability for square 13'), { target: { value: 'available' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('2 of 2 squares available')).toBeInTheDocument();
  });

  it('reloads the complete canonical family record after creating a buyer link', async () => {
    window.location.hash = token;
    const canonical = { ...record, revision: 5, cells: record.cells.map(cell => cell.index === 12 ? { ...cell, name: 'Organizer updated' } : cell) };
    let familyReads = 0;
    const notCreated = { boardId: '5a812684-87d1-4c10-9638-d81822b1f755', title: record.title, label: record.label, cells: [12, 13], revision: 3, state: 'not_created', availableCount: 1 };
    const fetcher = vi.fn(async (url: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body));
      if (url === '/api/family/guest-link') return http(body.action === 'create' ? { ...notCreated, revision: 5, state: 'active', maxSquares: 1, url: 'https://www.getgridone.com/p/public' } : notCreated);
      familyReads += 1;
      return http(familyReads === 1 ? record : canonical);
    });
    vi.stubGlobal('fetch', fetcher);
    render(<FamilyWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create public buyer link' }));
    expect(await screen.findByLabelText('Name on square 13')).toHaveValue('Organizer updated');
    expect(familyReads).toBe(2);
  });

  it('keeps the old family revision when the post-create canonical refresh fails', async () => {
    window.location.hash = token;
    const notCreated = { boardId: '5a812684-87d1-4c10-9638-d81822b1f755', title: record.title, label: record.label, cells: [12, 13], revision: 3, state: 'not_created', availableCount: 1 };
    let familyReads = 0;
    let editBody: Record<string, unknown> | null = null;
    const fetcher = vi.fn(async (url: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body));
      if (url === '/api/family/guest-link') return http(body.action === 'create' ? { ...notCreated, revision: 5, state: 'active', maxSquares: 1, url: 'https://www.getgridone.com/p/public' } : notCreated);
      if (body.action === 'read') {
        familyReads += 1;
        if (familyReads > 1) throw new Error('offline');
        return http(record);
      }
      editBody = body;
      return http({ code: 'REVISION_CONFLICT' }, { ok: false, status: 409 });
    });
    vi.stubGlobal('fetch', fetcher);
    render(<FamilyWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create public buyer link' }));
    expect(await screen.findByText(/link was created, but this private workspace could not refresh/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name on square 13'), { target: { value: 'Maria' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(editBody).not.toBeNull());
    expect(editBody).toMatchObject({ action: 'edit', revision: 3 });
  });
});
