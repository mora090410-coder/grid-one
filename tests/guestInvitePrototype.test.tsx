import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import GuestInvitePrototype from '../src/features/guest/GuestInvitePrototype';
import { supabase } from '../services/supabase';

it('runs the owner-to-guest prototype without network requests', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const channel = vi.spyOn(supabase, 'channel');
  render(<MemoryRouter><GuestInvitePrototype /></MemoryRouter>);
  expect(screen.getByText(/Simulated prototype/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Create guest link' }));
  expect((screen.getByLabelText('Guest link') as HTMLInputElement).value).toContain('/dev/guest-invites?guest=1&seller=Anthony');
  expect(await screen.findByRole('heading', { name: "Choose from Anthony's available squares" })).toBeInTheDocument();
  const square = screen.getByRole('gridcell', { name: /Square 1, available/i });
  fireEvent.click(square);
  await waitFor(() => expect(square).toHaveAttribute('aria-selected', 'true'));
  fireEvent.change(screen.getByLabelText('Name on your squares'), { target: { value: 'Maria' } });
  fireEvent.click(screen.getByRole('button', { name: 'Claim 1 square' }));
  expect(await screen.findByText('Maria · Square 1')).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
  expect(channel).not.toHaveBeenCalled();
});

it('opens a pasted dev-only guest link directly with its seller label and no API request', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  render(<MemoryRouter initialEntries={['/dev/guest-invites?guest=1&seller=Maria']}><GuestInvitePrototype /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: "Choose from Maria's available squares" })).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});
