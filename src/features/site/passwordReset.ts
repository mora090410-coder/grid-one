export const FORGOT_PASSWORD_PATH = '/forgot-password';
export const RESET_PASSWORD_PATH = '/reset-password';

/**
 * Supabase Auth only follows this URL when it is on the project's redirect
 * allow list. Production needs both hosts the app is served from:
 * https://www.getgridone.com/reset-password and https://getgridone.com/reset-password.
 * Local development needs http://localhost:5173/reset-password.
 */
export const passwordResetRedirect = (origin: string) =>
  `${origin.replace(/\/$/, '')}${RESET_PASSWORD_PATH}`;

export const RESET_EMAIL_CONFIRMATION = 'If an account exists for that email, we sent a link to choose a new password.';
export const RESET_LINK_EXPIRED = 'This reset link has expired. Request a new one.';
export const RESET_LINK_INVALID = 'This reset link is invalid. Request a new one.';

export type RecoveryLinkProblem = 'expired' | 'invalid';

const readLink = (href: string) => {
  const url = new URL(href, 'https://www.getgridone.com');
  const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
  return { url, hash };
};

/** A recovery redirect that Supabase marked as unusable. Null when the URL has no error. */
export const recoveryLinkProblem = (href: string): RecoveryLinkProblem | null => {
  const { url, hash } = readLink(href);
  const code = hash.get('error_code') || url.searchParams.get('error_code') || '';
  const description = `${hash.get('error_description') || ''} ${url.searchParams.get('error_description') || ''}`.toLowerCase();
  const error = hash.get('error') || url.searchParams.get('error');
  if (!error && !code) return null;
  if (code === 'otp_expired' || description.includes('expired')) return 'expired';
  return 'invalid';
};

/**
 * The reset page starts here. An error in the live URL, or in the URL captured
 * before Auth cleared it, is final. Anything else waits for the session:
 * a missing hash is not itself an invalid link, because Auth removes the hash
 * after a successful recovery.
 */
export const initialResetPhase = (
  liveHref: string,
  arrivalHref: string | null,
): 'checking' | RecoveryLinkProblem => {
  const problem = recoveryLinkProblem(liveHref) ?? (arrivalHref ? recoveryLinkProblem(arrivalHref) : null);
  return problem ?? 'checking';
};

/** Send a recovery that landed on another route to the reset page, once. */
export const shouldOpenPasswordReset = (pathname: string, href: string | null): boolean => {
  if (!href || pathname === RESET_PASSWORD_PATH) return false;
  return recoveryLinkProblem(href) !== null || hasRecoveryCredentials(href);
};

/** True when the URL carries a recovery session, implicit tokens, or a PKCE code. */
export const hasRecoveryCredentials = (href: string) => {
  const { url, hash } = readLink(href);
  return hash.get('type') === 'recovery'
    || url.searchParams.get('type') === 'recovery'
    || hash.has('access_token')
    || url.searchParams.has('code');
};

export type ResetEmailOutcome = 'sent' | 'wait' | 'offline';

/**
 * Missing accounts stay on the sent path so the page never says whether the
 * email is registered. Only transport and rate-limit failures are distinct.
 */
export const classifyResetEmailError = (message: string): ResetEmailOutcome => {
  const msg = message.toLowerCase();
  if (
    msg.includes('rate')
    || msg.includes('too many')
    || msg.includes('over_email_send_rate_limit')
    || msg.includes('only request this once')
    || msg.includes('once every')
  ) return 'wait';
  if (msg === 'load failed' || msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('fetch')) return 'offline';
  return 'sent';
};
