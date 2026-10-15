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

/** Password recovery only. Sign-up, magic-link, and other auth redirects are not this. */
export const isPasswordRecoveryLink = (href: string | null): boolean => {
  if (!href) return false;
  const { url, hash } = readLink(href);
  const type = (hash.get('type') || url.searchParams.get('type') || '').toLowerCase();
  return type === 'recovery';
};

/**
 * The reset page starts here. An error in the live URL is final. An error in
 * the captured URL counts only when that URL is a password recovery, so a
 * sign-up failure left on the site root cannot poison this page. Anything
 * else waits for the session: Auth removes a successful recovery hash.
 */
export const initialResetPhase = (
  liveHref: string,
  arrivalHref: string | null,
): 'checking' | RecoveryLinkProblem => {
  const liveProblem = recoveryLinkProblem(liveHref);
  if (liveProblem) return liveProblem;
  if (arrivalHref && isPasswordRecoveryLink(arrivalHref)) {
    const arrivalProblem = recoveryLinkProblem(arrivalHref);
    if (arrivalProblem) return arrivalProblem;
  }
  return 'checking';
};

/**
 * Send a recovery that landed on another route to the reset page, once.
 * `type=recovery` is required. A bare access token, PKCE code, or error
 * fragment is also how sign-up confirmation arrives, and those stay put.
 */
export const shouldOpenPasswordReset = (pathname: string, href: string | null): boolean => {
  if (!href || pathname === RESET_PASSWORD_PATH) return false;
  return isPasswordRecoveryLink(href);
};

/** Keep the recovery hash and query when moving that arrival onto the reset page. */
export const passwordResetLocation = (href: string): { pathname: string; search: string; hash: string } => {
  const url = new URL(href, 'https://www.getgridone.com');
  return { pathname: RESET_PASSWORD_PATH, search: url.search, hash: url.hash };
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
