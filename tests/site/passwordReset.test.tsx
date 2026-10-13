import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyResetEmailError,
  hasRecoveryCredentials,
  initialResetPhase,
  isPasswordRecoveryLink,
  passwordResetLocation,
  passwordResetRedirect,
  recoveryLinkProblem,
  RESET_EMAIL_CONFIRMATION,
  shouldOpenPasswordReset,
} from '../../src/features/site/passwordReset';
import { captureRecoveryArrival, resetRecoveryArrivalForTests } from '../../src/features/site/recoveryArrival';

const mocks = vi.hoisted(() => ({
  session: null as Record<string, unknown> | null,
  loading: false,
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ session: mocks.session, user: null, loading: mocks.loading, signOut: vi.fn() }),
}));

vi.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      updateUser: mocks.updateUser,
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
}));

import ForgotPassword from '../../pages/ForgotPassword';
import { RecoveryLanding } from '../../pages/RecoveryLanding';
import ResetPassword from '../../pages/ResetPassword';

const renderAt = (ui: React.ReactElement, path: string) => {
  window.history.replaceState(null, '', path);
  return render(<MemoryRouter initialEntries={[path.split('#')[0]]}>{ui}</MemoryRouter>);
};

beforeEach(() => {
  resetRecoveryArrivalForTests();
  mocks.session = null;
  mocks.loading = false;
  mocks.resetPasswordForEmail.mockReset();
  mocks.updateUser.mockReset();
  mocks.getSession.mockReset();
  mocks.onAuthStateChange.mockReset();
  mocks.unsubscribe.mockReset();
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } });
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
});

describe('password reset helpers', () => {
  it('builds the reset redirect and classifies recovery links', () => {
    expect(passwordResetRedirect('https://www.getgridone.com')).toBe('https://www.getgridone.com/reset-password');
    expect(passwordResetRedirect('https://getgridone.com/')).toBe('https://getgridone.com/reset-password');
    expect(recoveryLinkProblem('https://www.getgridone.com/reset-password#error_code=otp_expired&error=access_denied&error_description=Email+link+is+invalid+or+has+expired')).toBe('expired');
    expect(recoveryLinkProblem('https://www.getgridone.com/reset-password?error=access_denied&error_description=no+such+link')).toBe('invalid');
    expect(recoveryLinkProblem('https://www.getgridone.com/reset-password#access_token=abc&type=recovery')).toBeNull();
    expect(hasRecoveryCredentials('https://www.getgridone.com/reset-password#access_token=abc&type=recovery')).toBe(true);
    expect(hasRecoveryCredentials('https://www.getgridone.com/reset-password?code=abc')).toBe(true);
    expect(hasRecoveryCredentials('https://www.getgridone.com/reset-password')).toBe(false);
    expect(initialResetPhase('https://www.getgridone.com/reset-password', null)).toBe('checking');
    expect(initialResetPhase('https://www.getgridone.com/reset-password', 'https://www.getgridone.com/#error_code=otp_expired&error=access_denied&type=recovery')).toBe('expired');
    expect(initialResetPhase('https://www.getgridone.com/reset-password', 'https://www.getgridone.com/#error_code=otp_expired&error=access_denied&type=signup')).toBe('checking');
    expect(isPasswordRecoveryLink('https://getgridone.com/#access_token=abc&type=recovery')).toBe(true);
    expect(isPasswordRecoveryLink('https://getgridone.com/#access_token=abc&type=signup')).toBe(false);
    expect(isPasswordRecoveryLink('https://getgridone.com/#access_token=abc&type=magiclink')).toBe(false);
    expect(isPasswordRecoveryLink('https://getgridone.com/?code=abc')).toBe(false);
    expect(isPasswordRecoveryLink('https://getgridone.com/#error=access_denied&error_code=otp_expired')).toBe(false);
    expect(shouldOpenPasswordReset('/', 'https://getgridone.com/#access_token=abc&type=recovery')).toBe(true);
    expect(shouldOpenPasswordReset('/', 'https://getgridone.com/#access_token=abc&type=signup')).toBe(false);
    expect(shouldOpenPasswordReset('/', 'https://getgridone.com/#access_token=abc&type=magiclink')).toBe(false);
    expect(shouldOpenPasswordReset('/', 'https://getgridone.com/#access_token=abc')).toBe(false);
    expect(shouldOpenPasswordReset('/', 'https://getgridone.com/?code=abc')).toBe(false);
    expect(shouldOpenPasswordReset('/', 'https://getgridone.com/#error=access_denied&error_code=otp_expired')).toBe(false);
    expect(shouldOpenPasswordReset('/reset-password', 'https://getgridone.com/reset-password#access_token=abc&type=recovery')).toBe(false);
    expect(passwordResetLocation('https://getgridone.com/#access_token=real-token&refresh_token=real-refresh&type=recovery')).toEqual({
      pathname: '/reset-password',
      search: '',
      hash: '#access_token=real-token&refresh_token=real-refresh&type=recovery',
    });
    expect(classifyResetEmailError('User not found')).toBe('sent');
    expect(classifyResetEmailError('Email rate limit exceeded')).toBe('wait');
    expect(classifyResetEmailError('For security purposes, you can only request this once every 60 seconds')).toBe('wait');
    expect(classifyResetEmailError('Failed to fetch')).toBe('offline');
  });
});

describe('Forgot password', () => {
  it('sends a reset email and confirms without saying whether the account exists', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    renderAt(<ForgotPassword />, '/forgot-password');
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'organizer@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await screen.findByRole('heading', { name: 'Check your inbox' });
    expect(screen.getByText(RESET_EMAIL_CONFIRMATION)).toBeInTheDocument();
    expect(screen.getByText(RESET_EMAIL_CONFIRMATION).textContent).not.toMatch(/found|not registered|no account/i);
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('organizer@example.com', {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
  });

  it('shows the same confirmation when the email is not registered', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ data: null, error: { message: 'User not found' } });
    renderAt(<ForgotPassword />, '/forgot-password');
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'missing@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(RESET_EMAIL_CONFIRMATION)).toBeInTheDocument();
    expect(screen.queryByText(/not found|not registered/i)).toBeNull();
  });

  it('reports a connection problem without a confirmation', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
    renderAt(<ForgotPassword />, '/forgot-password');
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'organizer@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to connect');
    expect(screen.queryByText(RESET_EMAIL_CONFIRMATION)).toBeNull();
  });
});

describe('Reset password', () => {
  it('explains an expired recovery link', () => {
    renderAt(<ResetPassword />, '/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    expect(screen.getByRole('alert')).toHaveTextContent('This reset link has expired. Request a new one.');
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute('href', '/forgot-password');
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('explains a link that is not a recovery link', async () => {
    renderAt(<ResetPassword />, '/reset-password');
    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link is invalid. Request a new one.');
  });

  it('shows the new-password form when the token was consumed and the hash cleared before mount', async () => {
    window.history.replaceState(null, '', '/reset-password#access_token=real-token&refresh_token=real-refresh&type=recovery');
    captureRecoveryArrival();
    window.history.replaceState(null, '', '/reset-password');
    expect(window.location.hash).toBe('');
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'recovery' } }, error: null });
    renderAt(<ResetPassword />, '/reset-password');
    const password = await screen.findByLabelText('New password');
    await waitFor(() => expect(password).toBeEnabled());
    expect(screen.queryByText('This reset link is invalid. Request a new one.')).toBeNull();
  });

  it('shows the new-password form from the recovery session when the hash is already gone', async () => {
    mocks.onAuthStateChange.mockImplementation((callback: (event: string, session: { access_token: string } | null) => void) => {
      callback('PASSWORD_RECOVERY', { access_token: 'recovery' });
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
    });
    renderAt(<ResetPassword />, '/reset-password');
    const password = await screen.findByLabelText('New password');
    await waitFor(() => expect(password).toBeEnabled());
    expect(screen.queryByText('This reset link is invalid. Request a new one.')).toBeNull();
  });

  it('keeps an expired link expired when a session already exists', () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'old' } }, error: null });
    renderAt(<ResetPassword />, '/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    expect(screen.getByRole('alert')).toHaveTextContent('This reset link has expired. Request a new one.');
    expect(screen.queryByLabelText('New password')).toBeNull();
  });

  it('lets a recovered session set a new password', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'recovery' } }, error: null });
    mocks.updateUser.mockResolvedValue({ data: { user: { id: 'user' } }, error: null });
    renderAt(<ResetPassword />, '/reset-password#access_token=abc&refresh_token=def&type=recovery');
    const password = await screen.findByLabelText('New password');
    await waitFor(() => expect(password).toBeEnabled());
    fireEvent.change(password, { target: { value: 'new-secret' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match');
    expect(mocks.updateUser).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'new-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'new-secret' }));
    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue to your boards' })).toHaveAttribute('href', '/dashboard');
  });

  it('turns a missing recovery session into an invalid-link error', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'recovery' } }, error: null });
    mocks.updateUser.mockResolvedValue({ data: null, error: { message: 'Auth session missing!' } });
    renderAt(<ResetPassword />, '/reset-password#access_token=abc&type=recovery');
    fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'new-secret' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'new-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link is invalid. Request a new one.');
  });
});

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</div>;
};

const renderLanding = () => render(
  <MemoryRouter initialEntries={['/']}>
    <RecoveryLanding />
    <Routes>
      <Route path="/" element={<h1>Home</h1>} />
      <Route path="/reset-password" element={<ResetPassword />} />
    </Routes>
    <LocationProbe />
  </MemoryRouter>,
);

describe('Recovery landing', () => {
  it('carries a root recovery token onto the new-password form', async () => {
    window.history.replaceState(null, '', '/#access_token=real-token&refresh_token=real-refresh&type=recovery');
    captureRecoveryArrival();
    window.history.replaceState(null, '', '/');
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'recovery' } }, error: null });
    renderLanding();
    const password = await screen.findByLabelText('New password');
    await waitFor(() => expect(password).toBeEnabled());
    expect(screen.getByTestId('location')).toHaveTextContent('/reset-password#access_token=real-token&refresh_token=real-refresh&type=recovery');
    expect(screen.queryByText('This reset link is invalid. Request a new one.')).toBeNull();
  });

  it('leaves sign-up confirmation and other auth links on the page they opened', async () => {
    window.history.replaceState(null, '', '/#access_token=confirm-token&type=signup');
    captureRecoveryArrival();
    const signup = renderLanding();
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
    signup.unmount();

    resetRecoveryArrivalForTests();
    window.history.replaceState(null, '', '/#access_token=magic-token&type=magiclink');
    captureRecoveryArrival();
    const magic = renderLanding();
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).toBeNull();
    magic.unmount();

    resetRecoveryArrivalForTests();
    window.history.replaceState(null, '', '/?code=pkce-code');
    captureRecoveryArrival();
    renderLanding();
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Choose a new password' })).toBeNull();
  });
});
