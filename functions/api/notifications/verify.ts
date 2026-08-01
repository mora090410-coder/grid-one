import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

const shareCodePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

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
      <p style="color:#16181D;font-size:13px">GridOne tracks the board. It does not collect square money or pay winners.</p>
    </main>
  </body>
</html>`, {
  status: 503,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  },
});

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const site = new URL(env.PUBLIC_SITE_URL || 'https://www.getgridone.com').origin;
  const url = new URL(request.url);
  const id = url.searchParams.get('subscription');
  const token = url.searchParams.get('token');
  const board = (url.searchParams.get('board') || '').trim().toUpperCase();
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    if (shareCodePattern.test(board)) {
      return Response.redirect(`${site}/b/${encodeURIComponent(board)}?email=configuration-error`, 302);
    }
    return configurationErrorPage();
  }
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
