import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { peekRecoveryArrival } from '../src/features/site/recoveryArrival';
import { RESET_PASSWORD_PATH, shouldOpenPasswordReset } from '../src/features/site/passwordReset';

/**
 * A recovery email can land on the site root when the reset URL is not on
 * Supabase's allow list. Auth then clears the hash. This sends that arrival
 * to the reset page once, while the captured URL still describes the link.
 */
export const RecoveryLanding: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    if (!shouldOpenPasswordReset(location.pathname, peekRecoveryArrival())) return;
    redirected.current = true;
    navigate(RESET_PASSWORD_PATH, { replace: true });
  }, [location.pathname, navigate]);

  return null;
};
