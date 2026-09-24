import { escapeHtml } from './crypto';

/**
 * Pages reached from links in GridOne emails. Mail-security scanners (Outlook
 * Safe Links, Gmail/Proofpoint prefetch) GET every link in a message, so a GET
 * only renders a confirmation form; the state change happens on POST.
 * The signed link carries a token, so these responses are never cached,
 * indexed, or sent onward as a referrer.
 */
export const EMAIL_LINK_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex',
} as const;

/** A redirect that keeps the signed link out of caches and referrers. */
export const emailLinkRedirect = (location: string, status: 302 | 303) => new Response(null, {
  status,
  headers: { Location: location, ...EMAIL_LINK_HEADERS },
});

interface ConfirmPageOptions {
  title: string;
  heading: string;
  message: string;
  buttonLabel: string;
  /** The URL the button posts to: the same signed link the email carried. */
  requestUrl: URL;
}

/** One-button confirmation page, styled like the other email-link pages. */
export const emailLinkConfirmPage = ({ title, heading, message, buttonLabel, requestUrl }: ConfirmPageOptions) => {
  const action = `${requestUrl.pathname}${requestUrl.search}`;
  return new Response(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <meta name="referrer" content="no-referrer">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#EFF0F1;color:#0E0F12;font-family:Arial,sans-serif">
    <main style="max-width:560px;margin:64px auto;padding:32px;border:1px solid #DEE0E1;background:#EFF0F1">
      <p style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#8F1D2C">GridOne</p>
      <h1 style="font-size:30px;line-height:1.1">${escapeHtml(heading)}</h1>
      <p>${escapeHtml(message)}</p>
      <form method="post" action="${escapeHtml(action)}">
        <button type="submit" style="display:inline-block;min-height:44px;border:0;background:#FFC72C;color:#0E0F12;padding:14px 20px;font:inherit;font-size:16px;font-weight:700;cursor:pointer">${escapeHtml(buttonLabel)}</button>
      </form>
      <p style="color:#16181D;font-size:13px">GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners.</p>
    </main>
  </body>
</html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...EMAIL_LINK_HEADERS },
  });
};
