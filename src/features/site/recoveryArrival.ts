/**
 * The recovery URL, captured once before Supabase Auth reads it.
 * Auth clears the hash after it creates the session, and the reset page is
 * lazy, so a read of window.location at mount time can already be empty.
 */
let arrivalHref: string | null = null;
let consumed = false;

type RecoverySession = { access_token: string; user?: { id: string } } | null;
let verifiedRecovery: { userId: string; accessToken: string } | null = null;

/** Only the Auth recovery event grants reset authority, never a URL or old login. */
export const observeRecoveryAuthEvent = (event: string, session: RecoverySession): void => {
  if (event === 'PASSWORD_RECOVERY') {
    verifiedRecovery = session?.user?.id && session.access_token
      ? { userId: session.user.id, accessToken: session.access_token }
      : null;
    return;
  }
  if (!verifiedRecovery) return;
  if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || !session || session.user?.id !== verifiedRecovery.userId) {
    verifiedRecovery = null;
  } else if (event === 'TOKEN_REFRESHED') {
    verifiedRecovery = { userId: session.user.id, accessToken: session.access_token };
  }
};

export const isVerifiedRecoverySession = (session: RecoverySession): boolean => Boolean(
  verifiedRecovery && session?.user?.id === verifiedRecovery.userId
    && session?.access_token === verifiedRecovery.accessToken,
);

export const clearVerifiedRecoverySession = (): void => { verifiedRecovery = null; };

export const captureRecoveryArrival = (): void => {
  if (arrivalHref !== null || typeof window === 'undefined') return;
  arrivalHref = window.location.href;
};

export const peekRecoveryArrival = (): string | null => (consumed ? null : arrivalHref);

export const consumeRecoveryArrival = (): void => {
  consumed = true;
};

/** Test isolation. Production captures once per page load. */
export const resetRecoveryArrivalForTests = (): void => {
  arrivalHref = null;
  consumed = false;
  clearVerifiedRecoverySession();
};
