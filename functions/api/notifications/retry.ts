import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

type RetryEnv = {
  CRON_SECRET?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  EMAIL_PROVIDER_API_KEY?: string;
  EMAIL_FROM?: string;
  NOTIFICATION_TOKEN_SECRET?: string;
  PUBLIC_SITE_URL?: string;
};

type ClaimedDelivery = {
  delivery_id: string;
  lease_token: string;
  idempotency_key: string;
  notification_kind: string;
  attempt_count: number;
  recipient_email: string;
  subscription_id: string;
  milestone: string;
  side_digit: number;
  top_digit: number;
  participant_name: string;
  board_title: string;
  share_code: string;
  side_team: string;
  top_team: string;
};

export type ProviderOutcome = {
  outcome: 'sent' | 'transient' | 'permanent';
  providerMessageId?: string;
  error?: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  },
});

const timingSafeEqual = (left: string, right: string) => {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let mismatch = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return mismatch === 0;
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const encodeHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');

const signUnsubscribe = async (secret: string, subscriptionId: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return encodeHex(await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(subscriptionId),
  ));
};

const providerError = (body: any, fallback: string) =>
  String(body?.message || body?.error?.message || fallback || 'Email delivery failed').slice(0, 1000);

export const classifyProviderResponse = (
  status: number,
  body: any,
  statusText = '',
): ProviderOutcome => {
  if (status >= 200 && status < 300) {
    return {
      outcome: 'sent',
      providerMessageId: typeof body?.id === 'string' ? body.id : undefined,
    };
  }
  const error = providerError(body, statusText);
  if ([408, 409, 425, 429].includes(status)) return { outcome: 'transient', error };
  if (status >= 400 && status < 500) return { outcome: 'permanent', error };
  return { outcome: 'transient', error };
};

const winnerLabel = (milestone: string) =>
  milestone === 'Q2' ? 'halftime' : milestone === 'FINAL' ? 'Final' : milestone;

const buildProviderPayload = async (
  delivery: ClaimedDelivery,
  env: RetryEnv,
) => {
  const site = new URL(env.PUBLIC_SITE_URL || 'https://www.getgridone.com').origin;
  const label = winnerLabel(delivery.milestone);
  const previousWinnerCorrection = delivery.notification_kind === 'correction_previous';
  const correctedWinner = delivery.notification_kind === 'correction_current';
  const unsubscribeToken = await signUnsubscribe(
    String(env.NOTIFICATION_TOKEN_SECRET),
    delivery.subscription_id,
  );
  const boardUrl = `${site}/b/${encodeURIComponent(delivery.share_code)}`;
  const unsubscribeUrl = `${site}/api/notifications/unsubscribe?subscription=${encodeURIComponent(delivery.subscription_id)}&token=${unsubscribeToken}&board=${encodeURIComponent(delivery.share_code)}`;
  const subject = previousWinnerCorrection
    ? `Correction to the ${label} result on ${delivery.board_title}`
    : correctedWinner
      ? `Correction: ${delivery.participant_name} won ${label} on ${delivery.board_title}`
      : `${delivery.participant_name} won ${label} on ${delivery.board_title}`;
  const heading = previousWinnerCorrection
    ? `The ${label} result was corrected`
    : correctedWinner
      ? `Corrected result: ${delivery.participant_name} won ${label}`
      : `${delivery.participant_name} won ${label}`;
  const correctionDetail = previousWinnerCorrection
    ? `<p style="font-size:17px">The corrected winner is ${escapeHtml(delivery.participant_name)}.</p>`
    : '';

  return {
    from: env.EMAIL_FROM,
    to: [delivery.recipient_email],
    subject,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0E0F12"><p style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6B7280">GridOne winner update</p><h1 style="font-size:30px;line-height:1.1">${escapeHtml(heading)}</h1>${correctionDetail}<p style="font-size:17px">${escapeHtml(delivery.side_team)} ${delivery.side_digit} · ${escapeHtml(delivery.top_team)} ${delivery.top_digit}</p><p><a href="${boardUrl}" style="display:inline-block;background:#FFC72C;color:#0E0F12;padding:14px 20px;text-decoration:none;font-weight:700">Open live board</a></p><p style="color:#5f6368;font-size:13px">GridOne tracks the board. It does not collect square money or pay winners.</p><p style="font-size:12px"><a href="${unsubscribeUrl}" style="color:#5f6368">Stop winner emails for this board name</a></p></div>`,
  };
};

const sendClaimedDelivery = async (
  delivery: ClaimedDelivery,
  env: RetryEnv,
): Promise<ProviderOutcome> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const payload = await buildProviderPayload(delivery, env);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': delivery.idempotency_key,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    return classifyProviderResponse(response.status, body, response.statusText);
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Email provider request timed out'
      : 'Email provider request failed';
    return { outcome: 'transient', error: message };
  } finally {
    clearTimeout(timeout);
  }
};

const runBounded = async <T>(
  values: T[],
  concurrency: number,
  operation: (value: T) => Promise<void>,
) => {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (cursor < values.length) {
        const value = values[cursor];
        cursor += 1;
        await operation(value);
      }
    },
  );
  await Promise.all(workers);
};

const handleRetry: PagesFunction = async ({ request, env: rawEnv }) => {
  const env = rawEnv as RetryEnv;
  if (!env.CRON_SECRET) return json({ error: 'Retry worker is not configured.' }, 503);
  const authorization = request.headers.get('Authorization') || '';
  if (!timingSafeEqual(authorization, `Bearer ${env.CRON_SECRET}`)) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  if (
    !env.VITE_SUPABASE_URL
    || !env.SUPABASE_SERVICE_ROLE_KEY
    || !env.EMAIL_PROVIDER_API_KEY
    || !env.EMAIL_FROM
    || !env.NOTIFICATION_TOKEN_SECRET
  ) {
    return json({ error: 'Retry worker dependencies are not configured.' }, 503);
  }

  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc('gridone_claim_notification_deliveries', {
    p_limit: 20,
    p_lease_seconds: 120,
  });
  if (error) return json({ error: 'Unable to claim notification deliveries.' }, 500);

  const deliveries = (Array.isArray(data) ? data : []) as ClaimedDelivery[];
  const counts = { claimed: deliveries.length, sent: 0, retrying: 0, terminal: 0, completionErrors: 0 };

  await runBounded(deliveries, 5, async delivery => {
    const result = await sendClaimedDelivery(delivery, env);
    const { data: completed, error: completionError } = await admin.rpc(
      'gridone_complete_notification_delivery',
      {
        p_delivery_id: delivery.delivery_id,
        p_lease_token: delivery.lease_token,
        p_outcome: result.outcome,
        p_provider_message_id: result.providerMessageId || null,
        p_error: result.error || null,
      },
    );

    if (completionError || !Array.isArray(completed) || completed.length !== 1) {
      counts.completionErrors += 1;
      return;
    }
    if (completed[0].status === 'sent') counts.sent += 1;
    else if (completed[0].status === 'failed') counts.retrying += 1;
    else counts.terminal += 1;
  });

  return json(counts, counts.completionErrors > 0 ? 502 : 200);
};

export const onRequestGet = handleRetry;
export const onRequestPost = handleRetry;
