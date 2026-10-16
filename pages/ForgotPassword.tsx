import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { CapsuleButton, CapsuleInput, Eyebrow, Glass } from '../src/design/primitives';
import { ghostLink } from '../src/features/homepage/sections/cta';
import {
  classifyResetEmailError,
  passwordResetRedirect,
  RESET_EMAIL_CONFIRMATION,
} from '../src/features/site/passwordReset';
import FullScreenLoading from '../components/loading/FullScreenLoading';
import { AuthShell } from './AuthShell';

const ForgotPassword: React.FC = () => {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  React.useEffect(() => {
    if (session) navigate('/dashboard');
  }, [session, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: passwordResetRedirect(window.location.origin),
      });
      if (resetError) {
        const outcome = classifyResetEmailError(resetError.message || '');
        if (outcome === 'wait') {
          setError('We could not send a reset email just now. Wait a few minutes and try again.');
          return;
        }
        if (outcome === 'offline') {
          setError('Unable to connect. Please check your connection and try again.');
          return;
        }
      }
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (classifyResetEmailError(message) === 'offline') {
        setError('Unable to connect. Please check your connection and try again.');
      } else {
        setSent(true);
      }
    } finally {
      setSending(false);
    }
  };

  if (authLoading) return <FullScreenLoading />;

  if (sent) {
    return (
      <AuthShell>
        <Glass padding="lg" className="w-full max-w-[420px] flex flex-col gap-4">
          <Eyebrow>Organizer sign in</Eyebrow>
          <h1 className="font-display text-[32px] leading-[1.05] text-fg">Check your inbox</h1>
          <p className="font-ui text-[17px] leading-[1.6] text-fg-2">{RESET_EMAIL_CONFIRMATION}</p>
          <div>
            <Link to="/login" className={ghostLink}>Back to sign in</Link>
          </div>
        </Glass>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Glass padding="lg" className="w-full max-w-[420px]">
        <div className="flex flex-col gap-3">
          <Eyebrow>Organizer sign in</Eyebrow>
          <h1 className="font-display text-[32px] leading-[1.05] text-fg">Reset your password</h1>
          <p className="font-ui text-[16px] leading-[1.5] text-fg-2">
            Enter the email on your organizer account. If we have it, we will send a link to choose a new password.
          </p>
        </div>

        {error && (
          <Glass id="reset-error" role="alert" className="mt-6 border-tone-cardinal/60 font-ui text-[15px] leading-[1.5] text-fg">
            {error}
          </Glass>
        )}

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <CapsuleInput
            id="reset-email"
            label="Email Address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'reset-error' : undefined}
            required
          />
          <CapsuleButton type="submit" variant="primary" disabled={sending} className="mt-2 w-full">
            {sending ? 'Sending...' : 'Send reset link'}
          </CapsuleButton>
        </form>

        <div className="mt-6 flex flex-col items-start gap-1 border-t border-hairline pt-4">
          <Link to="/login" className={ghostLink}>Back to sign in</Link>
        </div>
      </Glass>
    </AuthShell>
  );
};

export default ForgotPassword;
