import { verifyUnsubscribeToken } from '../../_lib/winnerNotifications';
import { adminClient, type PagesFunction } from '../../_lib/http';

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const site = new URL(env.PUBLIC_SITE_URL || 'https://www.getgridone.com').origin;
  const url = new URL(request.url);
  const subscriptionId = url.searchParams.get('subscription');
  const token = url.searchParams.get('token');
  const board = url.searchParams.get('board') || '';
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.NOTIFICATION_TOKEN_SECRET || !subscriptionId || !token) {
    return Response.redirect(`${site}/b/${encodeURIComponent(board)}?email=unsubscribe-invalid`, 302);
  }
  const valid = await verifyUnsubscribeToken(env.NOTIFICATION_TOKEN_SECRET, subscriptionId, token);
  if (!valid) return Response.redirect(`${site}/b/${encodeURIComponent(board)}?email=unsubscribe-invalid`, 302);
  const admin = adminClient(env);
  const { data } = await admin
    .from('notification_subscriptions')
    .update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)
    .select('id')
    .maybeSingle();
  return Response.redirect(`${site}/b/${encodeURIComponent(board)}?email=${data ? 'unsubscribed' : 'unsubscribe-invalid'}`, 302);
};
