import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.EMAIL_PROVIDER_API_KEY || !env.EMAIL_FROM) {
    return Response.json({ error: 'Winner email is not configured yet.' }, { status: 503 });
  }
  const shareCode = String(params.shareCode || '').toUpperCase();
  const body = await request.json() as { participantId?: string; email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!body.participantId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return Response.json({ error: 'Enter a valid email and select your board name.' }, { status: 400 });
  }
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: contest } = await admin
    .from('public_board_snapshots')
    .select('contest_id, board_title')
    .eq('share_code', shareCode)
    .is('withdrawn_at', null)
    .maybeSingle();
  if (!contest) return Response.json({ error: 'This board is not available.' }, { status: 404 });
  const { data: participant } = await admin
    .from('contest_participants')
    .select('id, display_name')
    .eq('id', body.participantId)
    .eq('contest_id', contest.contest_id)
    .maybeSingle();
  if (!participant) return Response.json({ error: 'Select a name published on this board.' }, { status: 400 });

  const verificationToken = crypto.randomUUID() + crypto.randomUUID();
  const unsubscribeToken = crypto.randomUUID() + crypto.randomUUID();
  const verificationHash = await hashToken(verificationToken);
  const unsubscribeHash = await hashToken(unsubscribeToken);
  const { data: existing } = await admin
    .from('notification_subscriptions')
    .select('id')
    .eq('contest_id', contest.contest_id)
    .eq('participant_id', participant.id)
    .ilike('email', email)
    .maybeSingle();
  const values = {
    contest_id: contest.contest_id,
    participant_id: participant.id,
    email,
    status: 'pending',
    verification_token_hash: verificationHash,
    unsubscribe_token_hash: unsubscribeHash,
    verification_sent_at: new Date().toISOString(),
    verified_at: null,
    unsubscribed_at: null,
    updated_at: new Date().toISOString(),
  };
  const write = existing
    ? await admin.from('notification_subscriptions').update(values).eq('id', existing.id).select('id').single()
    : await admin.from('notification_subscriptions').insert(values).select('id').single();
  if (write.error) return Response.json({ error: 'Unable to save the email preference.' }, { status: 500 });

  const site = new URL(env.PUBLIC_SITE_URL || 'https://www.getgridone.com').origin;
  const verifyUrl = `${site}/api/notifications/verify?subscription=${encodeURIComponent(write.data.id)}&token=${encodeURIComponent(verificationToken)}&board=${encodeURIComponent(shareCode)}`;
  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: `Verify winner emails for ${contest.board_title}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0E0F12"><h1 style="font-size:28px">Verify winner emails</h1><p>${escapeHtml(participant.display_name)}, confirm this address to receive one email if this board name wins Q1, halftime, Q3, or Final.</p><p><a href="${verifyUrl}" style="display:inline-block;background:#FFC72C;color:#0E0F12;padding:14px 20px;text-decoration:none;font-weight:700">Verify email</a></p><p style="color:#5f6368">GridOne tracks the board. It does not collect square money or pay winners.</p></div>`,
    }),
  });
  if (!emailResponse.ok) {
    await admin.from('notification_subscriptions').update({ status: 'pending' }).eq('id', write.data.id);
    return Response.json({ error: 'The verification email could not be sent. Try again shortly.' }, { status: 502 });
  }
  return Response.json({ sent: true });
};
