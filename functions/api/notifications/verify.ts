import { sha256Hex } from '../../_lib/crypto';
import { EMAIL_LINK_HEADERS, emailLinkConfirmPage, emailLinkRedirect } from '../../_lib/emailLinkPages';
import { adminClient, SHARE_CODE_PATTERN as shareCodePattern, type PagesFunction } from '../../_lib/http';

const configurationErrorPage = () => new Response(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>GridOne email verification</title>
  </head>
  <body style="margin:0;background:#EFF0F1;color:#0E0F12;font-family:Arial,sans-serif">
    <main style="max-width:560px;margin:64px auto;padding:32px;border:1px solid #DEE0E1;background:#EFF0F1">
      <p style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#8F1D2C">GridOne</p>
      <h1 style="font-size:30px;line-height:1.1">Email verification is temporarily unavailable</h1>
      <p>Please try this verification link again later.</p>
      <p style="color:#16181D;font-size:13px">GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners.</p>
    </main>
  </body>
</html>`, {
  status: 503,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    ...EMAIL_LINK_HEADERS,
  },
});

// GET (what mail scanners and the email link issue) only confirms; POST verifies.
type LinkCheck =
  | { response: Response }
  | { response?: undefined; url: URL; id: string; token: string; boardUrl: (state: string) => string };

const readLink = (request: Request, env: any, redirectStatus: 302 | 303): LinkCheck => {
  const site = new URL(env.PUBLIC_SITE_URL || 'https://www.getgridone.com').origin;
  const url = new URL(request.url);
  const id = url.searchParams.get('subscription');
  const token = url.searchParams.get('token');
  const board = (url.searchParams.get('board') || '').trim().toUpperCase();
  const boardUrl = (state: string) => `${site}/b/${encodeURIComponent(board)}?email=${state}`;
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    if (shareCodePattern.test(board)) {
      return { response: emailLinkRedirect(boardUrl('configuration-error'), redirectStatus) };
    }
    return { response: configurationErrorPage() };
  }
  if (!id || !token) return { response: emailLinkRedirect(boardUrl('invalid'), redirectStatus) };
  return { url, id, token, boardUrl };
};

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const link = readLink(request, env, 302);
  if (link.response) return link.response;
  return emailLinkConfirmPage({
    title: 'Confirm GridOne winner emails',
    heading: 'Confirm your email',
    message: 'Confirm this address to receive one email if your board name wins Q1, halftime, Q3, or Final.',
    buttonLabel: 'Confirm my email',
    requestUrl: link.url,
  });
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const link = readLink(request, env, 303);
  if (link.response) return link.response;
  const admin = adminClient(env);
  const hash = await sha256Hex(link.token);
  const { data, error } = await admin.rpc('gridone_verify_notification_subscription', {
    p_subscription_id: link.id,
    p_verification_token_hash: hash,
  });
  const verified = !error && data === true;
  return emailLinkRedirect(link.boardUrl(verified ? 'verified' : 'invalid'), 303);
};
