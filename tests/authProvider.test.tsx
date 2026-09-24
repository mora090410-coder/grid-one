import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: mocks.signOut,
    },
  },
}));

import { AuthProvider, useAuth } from '../context/AuthContext';

const Probe = () => {
  const { user, loading, signOut } = useAuth();
  return (
    <main>
      <p>Public page</p>
      <p>{loading ? 'auth: loading' : `auth: ${user ? user.id : 'signed out'}`}</p>
      <button type="button" onClick={() => void signOut()}>Sign out</button>
    </main>
  );
};

const deferred = <T,>() => {
  let resolveValue!: (value: T) => void;
  let rejectValue!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolveValue = res; rejectValue = rej; });
  return { promise, resolve: resolveValue, reject: rejectValue };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } });
});

describe('AuthProvider', () => {
  it('renders public pages immediately while the sign-in check is still running', async () => {
    const session = deferred<any>();
    mocks.getSession.mockReturnValue(session.promise);
    render(<AuthProvider><Probe /></AuthProvider>);

    expect(screen.getByText('Public page')).toBeInTheDocument();
    expect(screen.getByText('auth: loading')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await act(async () => { session.resolve({ data: { session: { user: { id: 'organizer-1' } } } }); });
    expect(await screen.findByText('auth: organizer-1', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('settles to signed out when there is no session or the check fails', async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session: null } });
    const first = render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('auth: signed out', {}, { timeout: 5000 })).toBeInTheDocument();
    first.unmount();

    mocks.getSession.mockRejectedValueOnce(new Error('offline'));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('auth: signed out', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('follows later sign-in changes and unsubscribes on unmount', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    const view = render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(mocks.onAuthStateChange).toHaveBeenCalledTimes(1), { timeout: 5000 });
    const listener = mocks.onAuthStateChange.mock.calls[0][0];
    await act(async () => { listener('SIGNED_IN', { user: { id: 'organizer-2' } }); });
    expect(screen.getByText('auth: organizer-2')).toBeInTheDocument();
    view.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('never subscribes after an unmount that beat the auth client', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    const view = render(<AuthProvider><Probe /></AuthProvider>);
    view.unmount();
    // Let the provider's own dynamic import settle before asserting.
    await act(async () => {
      await import('../services/supabase');
      await new Promise((done) => setTimeout(done, 50));
    });
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.onAuthStateChange).not.toHaveBeenCalled();
  });

  it('signs out through the auth client', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('auth: signed out', {}, { timeout: 5000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1), { timeout: 5000 });
  });
});

describe('first paint does not require the Supabase chunk', () => {
  const source = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');
  const staticSupabaseImport = /^import\s+(?!type\b)[^;]*from\s+['"][./]*(?:\.\.\/)*services\/supabase['"]/m;

  it('loads the auth client dynamically in AuthContext', () => {
    const auth = source('context/AuthContext.tsx');
    expect(auth).not.toMatch(staticSupabaseImport);
    expect(auth).toMatch(/import\(['"]\.\.\/services\/supabase['"]\)/);
    expect(auth).not.toMatch(/^import\s+\{[^}]*\}\s+from\s+['"]@supabase\/supabase-js['"]/m);
  });

  it('signs out from the site header through useAuth, not the Supabase client', () => {
    expect(source('src/features/site/SiteHeader.tsx')).not.toMatch(/services\/supabase/);
  });
});
