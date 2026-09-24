import { verifyUnsubscribeToken } from '../../_lib/winnerNotifications';
import { emailLinkConfirmPage, emailLinkRedirect } from '../../_lib/emailLinkPages';
import { adminClient, type PagesFunction } from '../../_lib/http';

// GET (what mail scanners and the email link issue) only confirms; POST unsubscribes.
// POST serves both the page's button and RFC 8058 one-click
// (`List-Unsubscribe=One-Click` form body, signed token in the URL query).

const readLink = async (request: Request, env: any) => {
  const site = new URL(env.PUBLIC_SITE_URL || 'https://www.getgridone.com').origin;
  const url = new URL(request.url);
  const subscriptionId = url.searchParams.get('subscription');
  const token = url.searchParams.get('token');
  const board = url.searchParams.get('board') || '';
  const boardUrl = (state: string) => `${site}/b/${encodeURIComponent(board)}?email=${state}`;
  const valid = Boolean(
    env.SUPABASE_SERVICE_ROLE_KEY
    && env.NOTIFICATION_TOKEN_SECRET
    && subscriptionId
    && token
    && await verifyUnsubscribeToken(env.NOTIFICATION_TOKEN_SECRET, subscriptionId, token),
  );
  return { url, subscriptionId: subscriptionId as string, boardUrl, valid };
};

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const link = await readLink(request, env);
  if (!link.valid) return emailLinkRedirect(link.boardUrl('unsubscribe-invalid'), 302);
  return emailLinkConfirmPage({
    title: 'Stop GridOne winner emails',
    heading: 'Stop winner emails for this board name?',
    message: 'You will no longer get an email when this board name wins Q1, halftime, Q3, or Final.',
    buttonLabel: 'Unsubscribe',
    requestUrl: link.url,
  });
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const link = await readLink(request, env);
  if (!link.valid) return emailLinkRedirect(link.boardUrl('unsubscribe-invalid'), 303);
  const admin = adminClient(env);
  const { data } = await admin
    .from('notification_subscriptions')
    .update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', link.subscriptionId)
    .select('id')
    .maybeSingle();
  return emailLinkRedirect(link.boardUrl(data ? 'unsubscribed' : 'unsubscribe-invalid'), 303);
};
