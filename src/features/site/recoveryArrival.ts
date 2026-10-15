/**
 * The recovery URL, captured once before Supabase Auth reads it.
 * Auth clears the hash after it creates the session, and the reset page is
 * lazy, so a read of window.location at mount time can already be empty.
 */
let arrivalHref: string | null = null;
let consumed = false;

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
};
