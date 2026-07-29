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
  const { data, error } = await admin.rpc('gridone_verify_notification_subscription', {
    p_subscription_id: id,
    p_verification_token_hash: hash,
  });
  const verified = !error && data === true;
  return Response.redirect(`${site}/b/${encodeURIComponent(board)}?email=${verified ? 'verified' : 'invalid'}`, 302);
};
