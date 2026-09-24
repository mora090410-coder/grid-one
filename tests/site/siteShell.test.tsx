import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const signOut = vi.fn().mockResolvedValue(undefined);
const navigate = vi.fn();
let currentUser: { id: string } | null = null;
let authLoading = false;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: currentUser, session: null, loading: authLoading, signOut }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

import { ArticleShell, SiteHeader, SitePage } from '../../src/features/site';

const renderAt = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  currentUser = null;
  authLoading = false;
  signOut.mockClear();
  navigate.mockClear();
});

describe('SiteHeader', () => {
  it('offers sign in when signed out', () => {
    renderAt(<SiteHeader />);
    expect(screen.getByRole('link', { name: 'GridOne' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?mode=signin');
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
  });

  it('offers boards and log out when signed in', async () => {
    currentUser = { id: 'u1' };
    renderAt(<SiteHeader />);
    expect(screen.getByRole('link', { name: 'Your boards' })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
  });

  it('holds the auth slot, unlabeled and the same size, while the sign-in check runs', () => {
    authLoading = true;
    const { container } = renderAt(<SiteHeader />);
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Your boards' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
    const slot = container.querySelector('[data-auth-slot="pending"]');
    expect(slot).not.toBeNull();
    expect(slot).toHaveAttribute('aria-hidden', 'true');
    expect(slot!.className).toContain('invisible');
    // Same box as the signed-out link, so the signed-out result does not shift.
    authLoading = false;
    const settled = renderAt(<SiteHeader />);
    const link = settled.container.querySelector('a[href="/login?mode=signin"]');
    expect(slot!.className.replace(/\s*invisible\s*/, ' ').trim()).toBe(link!.className.trim());
    expect(slot!.textContent).toBe(link!.textContent);
  });

  it('keeps the sign-in page free of the pending placeholder', () => {
    authLoading = true;
    const { container } = renderAt(<SiteHeader hideSignIn />);
    expect(container.querySelector('[data-auth-slot]')).toBeNull();
  });
});

describe('SitePage', () => {
  it('renders one main and one footer on the dark base', () => {
    const { container } = renderAt(<SitePage><p>Body</p></SitePage>);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(container.querySelectorAll('[data-base]')).toHaveLength(1);
    expect(container.querySelector('[data-base]')).toHaveAttribute('data-base', 'dark');
    expect(screen.getByRole('main').className).toContain('max-w-[720px]');
  });

  it('widens on request and can drop the footer', () => {
    renderAt(<SitePage width="wide" withFooter={false}><p>Body</p></SitePage>);
    expect(screen.getByRole('main').className).toContain('max-w-[1100px]');
    expect(screen.queryByRole('contentinfo')).toBeNull();
  });
});

describe('ArticleShell', () => {
  it('renders the eyebrow, one h1, the lede, and the page metadata', async () => {
    renderAt(
      <ArticleShell
        tag="Explainer"
        title="How football squares work"
        lede="A board, one hundred squares, and two axis digits."
        path="/articles/how-football-squares-work"
        description="The rules, the draw, and the payouts."
      >
        <h2>The draw</h2>
      </ArticleShell>,
    );

    expect(screen.getByText('Explainer')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('How football squares work');
    expect(screen.getByText('A board, one hundred squares, and two axis digits.')).toBeInTheDocument();

    await waitFor(() => expect(document.title).toBe('How football squares work'));
    const canonical = document.head.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toContain('/articles/how-football-squares-work');
  });
});
