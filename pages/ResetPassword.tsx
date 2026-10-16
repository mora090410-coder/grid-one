import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { CapsuleButton, CapsuleInput, Eyebrow, Glass } from '../src/design/primitives';
import { ghostLink } from '../src/features/homepage/sections/cta';
import {
  clearVerifiedRecoverySession,
  consumeRecoveryArrival,
  isVerifiedRecoverySession,
  observeRecoveryAuthEvent,
  peekRecoveryArrival,
} from '../src/features/site/recoveryArrival';
import {
  initialResetPhase,
  hasRecoveryCredentials,
  RESET_LINK_EXPIRED,
  RESET_LINK_INVALID,
  type RecoveryLinkProblem,
} from '../src/features/site/passwordReset';
import { AuthShell } from './AuthShell';

type Phase = 'checking' | 'ready' | 'saved' | RecoveryLinkProblem;

const problemCopy = (problem: RecoveryLinkProblem) =>
  problem === 'expired' ? RESET_LINK_EXPIRED : RESET_LINK_INVALID;

const ResetPassword: React.FC = () => {
  // Auth consumes the recovery hash before this lazy page mounts. The arrival
  // snapshot retains errors; only a verified recovery event grants reset authority.
  const [phase, setPhase] = useState<Phase>(() => initialResetPhase(window.location.href, peekRecoveryArrival()));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const recoveredUserId = useRef<string | null>(null);
  const expectsRecoveryEvent = useRef(hasRecoveryCredentials(window.location.href)
    || hasRecoveryCredentials(peekRecoveryArrival() || window.location.href));

  React.useEffect(() => {
    consumeRecoveryArrival();
  }, []);

  React.useEffect(() => {
    if (phase !== 'checking' && phase !== 'ready') return;
    let active = true;
    let recoveryGrace: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      observeRecoveryAuthEvent(event, session);
      if (isVerifiedRecoverySession(session)) {
        recoveredUserId.current = session!.user.id;
        setPhase('ready');
      } else if (phase === 'ready') {
        recoveredUserId.current = null;
        setPhase('invalid');
      }
    });
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (!sessionError && isVerifiedRecoverySession(data.session)) {
        recoveredUserId.current = data.session!.user.id;
        setPhase('ready');
        return;
      }
      // Auth-js saves the URL session before it emits PASSWORD_RECOVERY on a
      // zero-delay timer. getSession can therefore settle before the proof.
      // Wait briefly with the form disabled; a URL never grants authority.
      if (!sessionError && phase === 'checking' && expectsRecoveryEvent.current) {
        recoveryGrace = setTimeout(() => {
          if (active) { recoveredUserId.current = null; setPhase('invalid'); }
        }, 500);
        return;
      }
      recoveredUserId.current = null;
      setPhase('invalid');
    }).catch(() => {
      if (active) { recoveredUserId.current = null; setPhase('invalid'); }
    });
    return () => {
      active = false;
      clearTimeout(recoveryGrace);
      subscription.unsubscribe();
    };
  }, [phase]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (phase !== 'ready' || sessionError || !isVerifiedRecoverySession(data.session)
        || data.session?.user.id !== recoveredUserId.current) {
        setPhase('invalid');
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        const message = updateError.message || '';
        if (/auth session missing|session missing|jwt expired|otp_expired|email link is invalid/i.test(message)) {
          setPhase('invalid');
          return;
        }
        setError(message);
        return;
      }
      clearVerifiedRecoverySession();
      recoveredUserId.current = null;
      setPhase('saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/fetch|network|load failed/i.test(message)) {
        setError('Unable to connect. Please check your connection and try again.');
      } else {
        setPhase('invalid');
      }
    } finally {
      setSaving(false);
    }
  };

  if (phase === 'expired' || phase === 'invalid') {
    return (
      <AuthShell>
        <Glass padding="lg" className="w-full max-w-[420px] flex flex-col gap-4">
          <Eyebrow>Organizer sign in</Eyebrow>
          <h1 className="font-display text-[32px] leading-[1.05] text-fg">Reset link did not work</h1>
          <p role="alert" className="font-ui text-[17px] leading-[1.6] text-fg-2">{problemCopy(phase)}</p>
          <div className="flex flex-col items-start gap-1">
            <Link to="/forgot-password" className={ghostLink}>Request a new reset link</Link>
            <Link to="/login" className={ghostLink}>Back to sign in</Link>
          </div>
        </Glass>
      </AuthShell>
    );
  }

  if (phase === 'saved') {
    return (
      <AuthShell>
        <Glass padding="lg" className="w-full max-w-[420px] flex flex-col gap-4">
          <Eyebrow>Organizer sign in</Eyebrow>
          <h1 className="font-display text-[32px] leading-[1.05] text-fg">Password updated</h1>
          <p className="font-ui text-[17px] leading-[1.6] text-fg-2">You can sign in with your new password.</p>
          <div>
            <Link to="/dashboard" className={ghostLink}>Continue to your boards</Link>
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
          <h1 className="font-display text-[32px] leading-[1.05] text-fg">Choose a new password</h1>
          <p className="font-ui text-[16px] leading-[1.5] text-fg-2">
            {phase === 'checking' ? 'Checking this reset link.' : 'Use at least 6 characters. You will sign in with this password next time.'}
          </p>
        </div>

        {error && (
          <Glass id="new-password-error" role="alert" className="mt-6 border-tone-cardinal/60 font-ui text-[15px] leading-[1.5] text-fg">
            {error}
          </Glass>
        )}

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <CapsuleInput
            id="new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={phase !== 'ready' || saving}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'new-password-error' : undefined}
            required
          />
          <CapsuleInput
            id="confirm-new-password"
            label="Confirm Password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={phase !== 'ready' || saving}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'new-password-error' : undefined}
            required
          />
          <CapsuleButton type="submit" variant="primary" disabled={phase !== 'ready' || saving} className="mt-2 w-full">
            {saving ? 'Saving...' : 'Update password'}
          </CapsuleButton>
        </form>
      </Glass>
    </AuthShell>
  );
};

export default ResetPassword;
