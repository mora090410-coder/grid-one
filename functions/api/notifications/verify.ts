import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const site = new URL(env.PUBLIC_SITE_URL || 'https://www.getgridone.com').origin;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return Response.redirect(`${site}/?email=configuration-error`, 302);
  const url = new URL(request.url);
  const id = url.searchParams.get('subscription');
  const token = url.searchParams.get('token');
  const board = url.searchParams.get('board') || '';
  if (!id || !token) return Response.redirect(`${site}/b/${encodeURIComponent(board)}?email=invalid`, 302);
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const hash = await hashToken(token);
  const { data } = await admin
    .from('notification_subscriptions')
    .update({
      status: 'verified',
      verified_at: new Date().toISOString(),
      verification_token_hash: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('verification_token_hash', hash)
    .gte('verification_sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .select('id')
    .maybeSingle();
  return Response.redirect(`${site}/b/${encodeURIComponent(board)}?email=${data ? 'verified' : 'invalid'}`, 302);
};
