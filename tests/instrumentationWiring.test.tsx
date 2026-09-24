import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { track, getSession } = vi.hoisted(() => ({ track: vi.fn(), getSession: vi.fn() }));
vi.mock('../src/features/instrumentation/track', () => ({ track }));
vi.mock('../services/supabase', () => ({ supabase: { auth: { getSession } } }));

import Homepage from '../src/features/homepage/Homepage';
import FindSquaresModal from '../components/board/FindSquaresModal';
import WinnerEmailDisclosure from '../src/features/viewer/notifications/WinnerEmailDisclosure';
import ShareModal from '../components/board/ShareModal';
import SharePanel from '../src/features/organizer/workspace/gameday/SharePanel';
import PublishedSheet from '../src/features/organizer/workspace/PublishedSheet';
import { publishBoard } from '../src/features/organizer/workspace/publishBoard';
import { usePoolData } from '../hooks/usePoolData';
import { renderBoardPng } from '../utils/boardImage';
import type { BoardData, GameState } from '../types';

const boardWithNames = (...labels: string[]): BoardData => ({
  leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  topAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  squares: Array.from({ length: 100 }, (_, index) => (labels[index] ? [labels[index]] : [])),
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const trackedNames = () => track.mock.calls.map(([event]) => event.name);

beforeEach(() => {
  track.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('homepage calls to action', () => {
  it('tracks the primary create action and the sample-board secondary action', () => {
    render(<MemoryRouter><Homepage /></MemoryRouter>);
    fireEvent.click(screen.getAllByRole('link', { name: /Create your free board/ })[0]);
    expect(track).toHaveBeenLastCalledWith({ name: 'homepage_primary_action', action: 'create_board', surface: 'homepage' });
    fireEvent.click(screen.getAllByRole('link', { name: 'Explore a sample board' })[0]);
    expect(track).toHaveBeenLastCalledWith({ name: 'homepage_secondary_action', action: 'view_demo', surface: 'homepage' });
  });
});

describe('find my squares', () => {
  it('tracks opening when the sheet mounts (the tracker dedupes StrictMode double effects)', () => {
    render(<FindSquaresModal board={boardWithNames('Ann')} selectedPlayer="" onSelectPlayer={vi.fn()} onClose={vi.fn()} />);
    expect(trackedNames()).toEqual(['find_my_squares_opened']);
    expect(track).toHaveBeenCalledWith({ name: 'find_my_squares_opened', surface: 'viewer' });
  });

  it('tracks a resolved single match without sending the name', () => {
    render(<FindSquaresModal board={boardWithNames('Mike S.')} selectedPlayer="" onSelectPlayer={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name used on board'), { target: { value: 'mike s' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find' }));
    expect(track).toHaveBeenLastCalledWith({ name: 'find_my_squares_resolved', matchBucket: 'one' });
    expect(JSON.stringify(track.mock.calls)).not.toMatch(/mike/i);
  });

  it('tracks a choice among several suggestions as multiple', () => {
    render(<FindSquaresModal board={boardWithNames('Ann Lee', 'Ann Park')} selectedPlayer="" onSelectPlayer={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name used on board'), { target: { value: 'ann' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ann Park' }));
    expect(track).toHaveBeenLastCalledWith({ name: 'find_my_squares_resolved', matchBucket: 'multiple' });
  });

  it('tracks a no-match search with only a length bucket when the sheet closes unresolved', () => {
    const onClose = vi.fn();
    render(<FindSquaresModal board={boardWithNames('Ann')} selectedPlayer="" onSelectPlayer={vi.fn()} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('Name used on board'), { target: { value: 'Zebulon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(track).toHaveBeenCalledWith({ name: 'find_my_squares_no_match', queryLengthBucket: '6_10' });
    expect(JSON.stringify(track.mock.calls)).not.toMatch(/zebulon/i);
  });
});

describe('winner email form', () => {
  it('tracks the form opening once it is shown for a selected viewer', () => {
    const { rerender } = render(<WinnerEmailDisclosure shareCode="ABCDEFGH" participantId="p1" displayName="Ann" enabled={false} />);
    expect(track).not.toHaveBeenCalled();
    rerender(<WinnerEmailDisclosure shareCode="ABCDEFGH" participantId="p1" displayName="Ann" enabled />);
    expect(track).toHaveBeenCalledWith({ name: 'notification_form_opened', surface: 'viewer', notificationIntent: 'winner_updates' });
  });
});

describe('copy-link failures', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => { throw new Error('denied'); }) } });
  });

  it('tracks clipboard_denied from the viewer share sheet', async () => {
    render(<ShareModal shareUrl="https://getgridone.com/p/ABCDEFGH" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(track).toHaveBeenCalledWith({ name: 'recoverable_ui_failure_code', code: 'clipboard_denied', surface: 'viewer' }));
  });

  it('tracks clipboard_denied from the organizer share panel and published sheet', async () => {
    render(<SharePanel shareUrl="https://getgridone.com/p/ABCDEFGH" onOpenViewer={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(track).toHaveBeenCalledWith({ name: 'recoverable_ui_failure_code', code: 'clipboard_denied', surface: 'organizer' }));
    track.mockReset();
    render(<PublishedSheet open shareUrl="https://getgridone.com/p/ABCDEFGH" onClose={vi.fn()} onOpenViewer={vi.fn()} onEnterGameDay={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy link' }).at(-1)!);
    await waitFor(() => expect(track).toHaveBeenCalledWith({ name: 'recoverable_ui_failure_code', code: 'clipboard_denied', surface: 'organizer' }));
  });
});

describe('organizer phases', () => {
  it('tracks publish completion only after the server confirms it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Choose a plan', upgradeTo: 'gameday' }, 402)));
    await publishBoard('pool-1', { allowOpenSquares: false, revision: 3 });
    expect(track).not.toHaveBeenCalled();

    vi.stubGlobal('fetch', vi.fn(async () => json({ shareCode: 'ABCDEFGH', viewerUrl: '/p/ABCDEFGH', revision: 2, tier: 'free', used: 1, allowance: 1 })));
    await publishBoard('pool-1', { allowOpenSquares: false, revision: 3 });
    expect(track).toHaveBeenCalledWith({ name: 'organizer_phase_completed', phase: 'publish' });
  });

  it('tracks share completion only after a confirmed share', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const stored = { id, title: 'Team board', revision: 3, board: boardWithNames('Ann'), published_at: null, shared_at: null, updated_at: '2026-09-04T12:01:00Z', share_code: 'ABCDEFGH', is_activated: true };
    let shareStatus = 402;
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      if (!init?.method) return json(stored);
      return shareStatus === 200
        ? json({ shared: true, sharedAt: '2026-09-04T12:02:00Z', shareCode: 'ABCDEFGH', revision: 4 })
        : json({ error: 'Choose a plan', upgradeTo: 'gameday' }, shareStatus);
    }));
    const { result } = renderHook(() => usePoolData());
    await act(async () => { await result.current.loadPoolData(id); });
    await act(async () => { await expect(result.current.shareBoard(id)).rejects.toBeTruthy(); });
    expect(track).not.toHaveBeenCalled();
    shareStatus = 200;
    await act(async () => { await result.current.shareBoard(id); });
    expect(track).toHaveBeenCalledWith({ name: 'organizer_phase_completed', phase: 'share' });
  });
});

describe('board image export', () => {
  it('tracks image_export_failed when the browser cannot render the image, and still rejects', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const game = { title: 'Board', meta: '', leftAbbr: 'CHI', leftName: 'Chicago', topAbbr: 'GB', topName: 'Green Bay', dates: '', lockTitle: false, lockMeta: false } as GameState;
    await expect(renderBoardPng({ board: boardWithNames('Ann'), game })).rejects.toThrow();
    expect(track).toHaveBeenCalledWith({ name: 'recoverable_ui_failure_code', code: 'image_export_failed', surface: 'organizer' });
  });

  it('does not report a missing quarter choice as an export failure', async () => {
    const game = { title: 'Board', meta: '', leftAbbr: 'CHI', leftName: 'Chicago', topAbbr: 'GB', topName: 'Green Bay', dates: '', lockTitle: false, lockMeta: false } as GameState;
    await expect(renderBoardPng({ board: { ...boardWithNames('Ann'), isDynamic: true }, game })).rejects.toThrow(/quarter/);
    expect(track).not.toHaveBeenCalled();
  });
});
