import { createClient } from '@supabase/supabase-js';
import {
  findVisiblePublicBoard,
  publicBoardNotFoundResponse,
} from '../../../_lib/publicBoardVisibility';

type PagesFunction = (context: any) => Promise<Response> | Response;

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const hmacHex = async (secret: string, value: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
};

const isValidIpv4 = (value: string) => {
  const parts = value.split('.');
  return parts.length === 4 && parts.every(part => (
    /^\d{1,3}$/.test(part)
    && String(Number(part)) === part
    && Number(part) <= 255
  ));
};

const isValidIpv6 = (value: string) => {
  if (!value.includes(':') || !/^[a-f0-9:.]+$/i.test(value)) return false;
  const halves = value.split('::');
  if (halves.length > 2) return false;
  const segments = halves.flatMap(half => half ? half.split(':') : []);
  let segmentCount = 0;
  for (const segment of segments) {
    if (segment.includes('.')) {
      if (!isValidIpv4(segment)) return false;
      segmentCount += 2;
    } else {
      if (!/^[a-f0-9]{1,4}$/i.test(segment)) return false;
      segmentCount += 1;
    }
  }
  return halves.length === 2 ? segmentCount < 8 : segmentCount === 8;
};

const isValidClientIp = (value: string | null): value is string =>
  Boolean(value && (isValidIpv4(value) || isValidIpv6(value)));

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const acceptedResponse = () => Response.json({
  accepted: true,
  message: 'If this address needs verification, check your inbox. Any already verified address remains active.',
}, { status: 202 });

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  if (
    !env.SUPABASE_SERVICE_ROLE_KEY
    || !env.EMAIL_PROVIDER_API_KEY
    || !env.EMAIL_FROM
    || !env.NOTIFICATION_TOKEN_SECRET
  ) {
    return Response.json({ error: 'Winner email is not configured yet.' }, { status: 503 });
  }
  const clientIp = request.headers.get('CF-Connecting-IP');
  if (!isValidClientIp(clientIp)) {
    return Response.json({ error: 'Winner email verification is temporarily unavailable.' }, { status: 503 });
  }
  const shareCode = String(params.shareCode || '').toUpperCase();
  const body = await request.json().catch(() => ({})) as { participantId?: string; email?: string };
  const email = body.email?.trim().toLowerCase();
  if (
    !body.participantId
    || !email
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || email.length > 320
  ) {
    return Response.json({ error: 'Enter a valid email and select your board name.' }, { status: 400 });
  }
  const participantId = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
    .test(body.participantId)
    ? body.participantId
    : '00000000-0000-4000-8000-000000000000';
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let contest: Record<string, any> | null = null;
  try {
    const visibleBoard = await findVisiblePublicBoard(admin, shareCode, {
      snapshot: 'contest_id, board_title',
      contest: 'id, status',
    });
    contest = visibleBoard?.snapshot || null;
  } catch (error) {
    console.error('Public board visibility lookup failed:', error);
  }
  if (!contest) return publicBoardNotFoundResponse();

  const verificationToken = crypto.randomUUID() + crypto.randomUUID();
  const unsubscribeToken = crypto.randomUUID() + crypto.randomUUID();
  const verificationHash = await hashToken(verificationToken);
  const unsubscribeHash = await hashToken(unsubscribeToken);
  const addressHash = await hmacHex(env.NOTIFICATION_TOKEN_SECRET, `address:${email}`);
  const { data: claimData, error: claimError } = await admin.rpc('gridone_claim_notification_send', {
    p_contest_id: contest.contest_id,
    p_requested_participant_id: participantId,
    p_email: email,
    p_address_hash: addressHash,
    p_client_ip: clientIp,
    p_verification_token_hash: verificationHash,
    p_unsubscribe_token_hash: unsubscribeHash,
  });
  if (claimError) {
    console.error('Notification claim failed:', claimError);
    return acceptedResponse();
  }
  const claim = Array.isArray(claimData) ? claimData[0] : claimData;
  if (claim?.is_throttled) {
    const retryAfter = Math.max(1, Number(claim.retry_after_seconds) || 60);
    return Response.json(
      { error: 'Too many verification requests. Try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'Cache-Control': 'no-store',
        },
      },
    );
  }
  if (!claim?.should_send || !claim.claim_id || !claim.subscription_id || !claim.participant_name) {
    return acceptedResponse();
  }

  const site = new URL(env.PUBLIC_SITE_URL || 'https://www.getgridone.com').origin;
  const verifyUrl = `${site}/api/notifications/verify?subscription=${encodeURIComponent(claim.subscription_id)}&token=${encodeURIComponent(verificationToken)}&board=${encodeURIComponent(shareCode)}`;
  let providerStatus: number | null = null;
  let providerMessageId: string | null = null;
  let providerError: string | null = null;
  let providerOutcome: 'sent' | 'provider_failed' = 'provider_failed';
  try {
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `verification:${claim.claim_id}`,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [email],
        subject: `Verify winner emails for ${contest.board_title}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0E0F12"><h1 style="font-size:28px">Verify winner emails</h1><p>${escapeHtml(claim.participant_name)}, confirm this address to receive one email if this board name wins Q1, halftime, Q3, or Final.</p><p><a href="${verifyUrl}" style="display:inline-block;background:#FFC72C;color:#0E0F12;padding:14px 20px;text-decoration:none;font-weight:700">Verify email</a></p><p style="color:#5f6368">GridOne tracks the board. It does not collect square money or pay winners.</p></div>`,
      }),
    });
    providerStatus = emailResponse.status;
    const providerBody = await emailResponse.json().catch(() => ({})) as any;
    providerMessageId = emailResponse.ok && providerBody?.id ? String(providerBody.id) : null;
    providerError = emailResponse.ok
      ? null
      : String(providerBody?.message || emailResponse.statusText || 'Email provider rejected the request');
    providerOutcome = emailResponse.ok ? 'sent' : 'provider_failed';
  } catch (error) {
    providerError = error instanceof Error ? error.message : String(error);
  }
  const { error: completionError } = await admin.rpc('gridone_complete_notification_send', {
    p_claim_id: claim.claim_id,
    p_outcome: providerOutcome,
    p_provider_status: providerStatus,
    p_provider_message_id: providerMessageId,
    p_error: providerError?.slice(0, 1000) || null,
  });
  if (completionError) console.error('Notification completion failed:', completionError);
  return acceptedResponse();
};
