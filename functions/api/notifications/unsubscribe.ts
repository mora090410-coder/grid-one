import { createClient } from '@supabase/supabase-js';
import { verifyUnsubscribeToken } from '../../_lib/winnerNotifications';

type PagesFunction = (context: any) => Promise<Response> | Response;

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
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
