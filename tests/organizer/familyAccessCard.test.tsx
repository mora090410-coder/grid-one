import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FamilyAccessCard from '../../src/features/organizer/workspace/FamilyAccessCard';
vi.mock('../../services/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) } } }));
const props = () => ({ boardId: 'one', labels: ['Anthony', 'Anthony', null], clean: true, flush: vi.fn(async () => ({ status: 'clean', revision: 4 })), onReload: vi.fn(async () => undefined), onBusy: vi.fn() });
describe('family access', () => {
 it('issues a scoped link only for explicit allocations after flushing', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ url: 'https://gridone.app/family/private-token', expiresAt: '2026-09-20T12:00:00Z' })));
  const p = props(); render(<FamilyAccessCard {...p}/>);
  fireEvent.click(screen.getByText('Send families their squares'));
  fireEvent.change(screen.getByLabelText('Responsible family'), { target: { value: 'Anthony' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create private family link' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ action: 'invite', revision: 4, label: 'Anthony', cells: [0, 1] });
  expect(await screen.findByLabelText('Private family link')).toHaveValue('https://gridone.app/family/private-token');
  expect(screen.getByText(/This private link expires/)).toBeVisible();
  expect(screen.getByText(/Link ready for Anthony.*send it directly to them by text or email/)).toBeVisible();
  expect(screen.getByText(/Anthony · 2 assigned squares: 1, 2/)).toBeVisible();
  expect(p.onReload).toHaveBeenCalledOnce(); fetch.mockRestore();
 });
 it('does not permit mutations while unsaved or infer a family from holder names', () => {
  render(<FamilyAccessCard {...props()} labels={[]} clean={false}/>);
  expect(screen.getByRole('button', { name: 'Create private family link' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Change responsible family' })).toBeDisabled();
 });
 it('requires deliberate payment-note acknowledgement before reassignment', () => {
  render(<FamilyAccessCard {...props()}/>);
  fireEvent.change(screen.getByLabelText('Square numbers'), { target: { value: '13-14' } });
  fireEvent.change(screen.getByLabelText('New responsible family'), { target: { value: 'Bill' } });
  expect(screen.getByRole('button', { name: 'Change responsible family' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: 'Change responsible family' })).toBeEnabled();
 });
});
