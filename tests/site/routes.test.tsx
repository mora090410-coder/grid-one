import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
const mocks = vi.hoisted(() => ({
  session: null as Record<string, unknown> | null,
  user: null as { id: string } | null,
  loading: false,
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  getSession: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ session: mocks.session, user: mocks.user, loading: mocks.loading, signOut: vi.fn() }),
}));

vi.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      signUp: mocks.signUp,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
      getSession: mocks.getSession,
    },
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

import Login from '../../pages/Login';
import NotFound from '../../pages/NotFound';
import Paid from '../../pages/Paid';
import Privacy from '../../pages/Privacy';
import Terms from '../../pages/Terms';

const renderAt = (ui: React.ReactElement, path = '/') =>
  render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

beforeEach(() => {
  navigate.mockClear();
  mocks.session = null;
  mocks.user = null;
  mocks.loading = false;
  mocks.signUp.mockReset();
  mocks.signInWithPassword.mockReset();
  mocks.getSession.mockReset();
  mocks.getSession.mockReturnValue(new Promise(() => {}));
});

describe('Login', () => {
  it('waits for the sign-in check instead of showing the form to a signed-in organizer', () => {
    mocks.loading = true;
    renderAt(<Login />, '/login?returnTo=%2Fdashboard');
    expect(screen.queryByLabelText('Email Address')).toBeNull();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('labels the sign-in fields and enables submit until a request is in flight', () => {
    renderAt(<Login />, '/login');
    expect(screen.getByLabelText('Email Address')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.queryByLabelText('Confirm Password')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps the site banner and one main landmark, without a redundant Sign in link', () => {
    renderAt(<Login />, '/login');
    const banner = screen.getByRole('banner');
    expect(banner).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'GridOne' })).toHaveAttribute('href', '/');
    expect(within(banner).getByRole('img', { name: 'GridOne' })).toHaveAttribute('aria-label', 'GridOne');
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.queryByRole('contentinfo')).toBeNull();
  });

  it('adds the confirmation and name fields in signup mode', () => {
    renderAt(<Login />, '/login?mode=signup');
    expect(screen.getByText('New organizer')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByLabelText('First Name (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create organizer account' })).toBeInTheDocument();
  });

  it('reports a mismatch through the auth-error alert', async () => {
    renderAt(<Login />, '/login?mode=signup');
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'organizer@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'abcdef' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'abcdefg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create organizer account' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('id', 'auth-error');
    expect(alert).toHaveTextContent('Passwords do not match');
    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Email Address')).toHaveAttribute('aria-describedby', 'auth-error');
  });

  it('keeps the inbox confirmation after a successful signup', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { identities: [{ id: 'i1' }] } }, error: null });
    renderAt(<Login />, '/login?mode=signup');
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'organizer@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'abcdef' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'abcdef' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create organizer account' }));

    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(screen.getByText('Check your email for the confirmation link!')).toBeInTheDocument();
  });

  it('sends an adopt-draft session on to the dashboard', async () => {
    mocks.session = { access_token: 'token' };
    renderAt(<Login />, '/login?mode=adopt-draft');
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard?mode=adopt-draft'));
  });
});

describe('NotFound', () => {
  it('offers the three recovery links', () => {
    renderAt(<NotFound />, '/nope');
    expect(screen.getByRole('link', { name: 'Return to GridOne' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Create a new board' })).toHaveAttribute('href', '/create');
    expect(screen.getByRole('link', { name: 'See the demo board' })).toHaveAttribute('href', '/demo');
    expect(screen.queryByRole('contentinfo')).toBeNull();
  });
});

describe('Paid', () => {
  it('announces the checking state politely', async () => {
    renderAt(<Paid />, '/paid?order=order-1');
    expect(await screen.findByRole('heading', { name: 'Finishing checkout.' })).toBeInTheDocument();
    expect(screen.getByText('Secure verification in progress')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('aria-live', 'polite');
  });
});

describe('legal pages', () => {
  it.each([
    ['Privacy', Privacy, 'Privacy Policy'],
    ['Terms', Terms, 'Terms of Service'],
  ])('%s sits on the legal article shell', (_name, Page, heading) => {
    const { unmount } = renderAt(<Page />, '/legal');
    expect(screen.getByText('Legal')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(heading);
    expect(screen.getByText('Last updated: July 28, 2026')).toBeInTheDocument();
    unmount();
  });
});
