import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { peekRecoveryArrival } from '../src/features/site/recoveryArrival';
import { passwordResetLocation, shouldOpenPasswordReset } from '../src/features/site/passwordReset';

/**
 * A recovery email can land on the site root when /reset-password is not on
 * Supabase's allow list. Move that arrival to the reset page and keep the
 * hash, so the auth client can still create the session there. Sign-up and
 * other auth links stay on the page they opened.
 */
export const RecoveryLanding: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    const arrival = peekRecoveryArrival();
    if (!shouldOpenPasswordReset(location.pathname, arrival) || !arrival) return;
    redirected.current = true;
    navigate(passwordResetLocation(arrival), { replace: true });
  }, [location.pathname, navigate]);

  return null;
};
