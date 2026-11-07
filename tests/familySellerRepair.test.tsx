import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const { session } = vi.hoisted(() => ({ session: vi.fn(async () => ({ data: { session: { access_token: 'test-jwt' } } })) }));
vi.mock('../services/supabase', () => ({ supabase: { auth: { getSession: session } } }));
import FamilyWorkspace from '../src/features/family/FamilyWorkspace';
import SellerLinksCard from '../src/features/organizer/sellers/SellerLinksCard';

const http = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const labels = ['Maple', 'River'];
const links = labels.map((label, i) => ({ label, code: String(i).repeat(16), url: `https://example.test/s/${String(i).repeat(16)}` }));
const flush = vi.fn(async () => ({ status: 'clean', revision: 1 }));
const card = (boardId = 'test-board', saver = flush) => <SellerLinksCard boardId={boardId} boardTitle="Test" shared clean labels={labels} squares={labels.map(label => [label])} flush={saver} />;
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); session.mockReset().mockResolvedValue({ data: { session: { access_token: 'test-jwt' } } }); window.location.hash = ''; });

it('saves blank availability, then buyer name, then cleared name using each returned revision', async () => {
  window.location.hash = 'a'.repeat(64);
  let record = { title: 'Test', label: 'Maple', revision: 1, cells: [{ index: 12, name: '', availability: 'unspecified' }] };
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    if (body.action === 'edit') {
      expect(body.revision).toBe(record.revision);
      record = { ...record, revision: record.revision + 1, cells: body.changes };
    }
    return http(record);
  });
  vi.stubGlobal('fetch', fetcher); render(<FamilyWorkspace />);
  await screen.findByRole('heading', { name: 'Your 1 square' });
  const save = screen.getByRole('button', { name: 'Save changes' });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Availability for square 13'), { target: { value: 'available' } });
  expect(save).toBeEnabled(); fireEvent.click(save);
  await screen.findByText('Changes saved.'); expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Name on square 13'), { target: { value: 'Ann Buyer' } });
  expect(save).toBeEnabled(); fireEvent.click(save); await screen.findByText('Changes saved.');
  fireEvent.change(screen.getByLabelText('Name on square 13'), { target: { value: '' } });
  expect(save).toBeEnabled(); fireEvent.click(save); await screen.findByText('Changes saved.');
  expect(record).toMatchObject({ revision: 4, label: 'Maple', cells: [{ index: 12, name: '', availability: 'available' }] });
});

it.each(['flush', 'session', 'fetch', 'body'] as const)('recovers from stalled %s and ignores late results', async stage => {
  vi.useFakeTimers();
  let resolveLate!: (value: any) => void;
  const never = new Promise<any>(resolve => { resolveLate = resolve; });
  const saver = vi.fn(async () => ({ status: 'clean', revision: 1 }));
  const fetcher = vi.fn().mockResolvedValue(http({ links }));
  if (stage === 'flush') saver.mockReturnValueOnce(never);
  if (stage === 'session') session.mockReturnValueOnce(never);
  if (stage === 'fetch') fetcher.mockReturnValueOnce(never);
  if (stage === 'body') fetcher.mockResolvedValueOnce({ ok: true, json: () => never });
  vi.stubGlobal('fetch', fetcher); render(card('test-board', saver));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Get seller links' })); });
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(screen.getByRole('alert')).toHaveTextContent('taking too long');
  expect(screen.getByRole('button', { name: 'Get seller links' })).toBeEnabled();
  const before = fetcher.mock.calls.length;
  await act(async () => { resolveLate(stage === 'flush' ? { status: 'clean' } : stage === 'session' ? { data: { session: { access_token: 'test-jwt' } } } : stage === 'fetch' ? http({ links }) : { links }); });
  expect(fetcher.mock.calls).toHaveLength(before);
  expect(screen.queryByRole('list', { name: 'Seller links' })).not.toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Get seller links' })); });
  expect(screen.getByRole('list', { name: 'Seller links' })).toHaveTextContent('Maple');
  expect(screen.getByRole('list', { name: 'Seller links' })).toHaveTextContent('River');
});

it('keeps stable links after an update timeout and rejects late stale results after a successful retry', async () => {
  vi.useFakeTimers();
  let finish!: (value: unknown) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(http({links})).mockImplementationOnce(() => new Promise(resolve => {finish=resolve;})).mockResolvedValue(http({links}));
  vi.stubGlobal('fetch',fetcher); render(card());
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Get seller links'}));});
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Update for new sellers'}));});
  await act(async()=>{await vi.advanceTimersByTimeAsync(15_000);});
  expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
  expect(screen.getByRole('list',{name:'Seller links'})).toHaveTextContent('River');
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Update for new sellers'}));});
  await act(async()=>{finish(http({links:[{...links[0],label:'Stale Maple'}]}));});
  expect(screen.getByRole('list',{name:'Seller links'})).toHaveTextContent('River');
  expect(screen.queryByText('Stale Maple')).not.toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('does not share uncertain rotated links or automatically repeat a rotation after timeout', async () => {
  vi.useFakeTimers();
  const nextLinks=[{...links[0],code:'f'.repeat(16),url:`https://example.test/s/${'f'.repeat(16)}`},links[1]];
  const fetcher=vi.fn().mockResolvedValueOnce(http({links})).mockImplementationOnce(()=>new Promise(()=>{})).mockResolvedValue(http({links:nextLinks}));
  vi.stubGlobal('fetch',fetcher); render(card());
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Get seller links'}));});
  fireEvent.click(screen.getByRole('button',{name:'New link for Maple'}));
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Yes, replace Maple’s link'}));});
  await act(async()=>{await vi.advanceTimersByTimeAsync(15_000);});
  expect(screen.getByRole('alert')).toHaveTextContent('could not be confirmed');
  expect(screen.queryByRole('button',{name:'Share Maple’s link'})).not.toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Get seller links'}));});
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({action:'sync'});
  expect(screen.getByRole('button',{name:'Share Maple’s link'})).toBeEnabled();
});

it('ignores results and clears old links when the board changes', async () => {
  let finish!: (value: unknown) => void;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(http({ links }));
  vi.stubGlobal('fetch', fetcher);
  const view = render(card('first'));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Get seller links' })); });
  view.rerender(card('second'));
  await act(async () => { finish(http({ links })); });
  expect(screen.queryByRole('list', { name: 'Seller links' })).not.toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Get seller links' })); });
  expect(fetcher.mock.calls[1][0]).toBe('/api/pools/second/seller-links');
  expect(screen.getByRole('list', { name: 'Seller links' })).toBeVisible();
});
