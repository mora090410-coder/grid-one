type SupabaseAdmin = any;

interface WinnerNotificationEnv {
  EMAIL_PROVIDER_API_KEY?: string;
  EMAIL_FROM?: string;
  NOTIFICATION_TOKEN_SECRET?: string;
  PUBLIC_SITE_URL?: string;
}

type Milestone = 'Q1' | 'Q2' | 'Q3' | 'FINAL';

const encodeHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');

const signUnsubscribe = async (secret: string, subscriptionId: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return encodeHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(subscriptionId)));
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export const milestoneScores = (snapshot: any): Array<{ milestone: Milestone; side: number; top: number }> => {
  const scores = snapshot.quarter_scores || {};
  const q = (key: string, side: 'left' | 'top') => Number(scores[key]?.[side] || 0);
  const cumulative = (through: number, side: 'left' | 'top') =>
    ['Q1', 'Q2', 'Q3', 'Q4'].slice(0, through).reduce((sum, key) => sum + q(key, side), 0);
  const resolved: Array<{ milestone: Milestone; side: number; top: number }> = [];
  if (snapshot.period > 1 || snapshot.game_state === 'post') {
    resolved.push({ milestone: 'Q1', side: cumulative(1, 'left'), top: cumulative(1, 'top') });
  }
  if (snapshot.period > 2 || snapshot.game_state === 'post') {
    resolved.push({ milestone: 'Q2', side: cumulative(2, 'left'), top: cumulative(2, 'top') });
  }
  if (snapshot.period > 3 || snapshot.game_state === 'post') {
    resolved.push({ milestone: 'Q3', side: cumulative(3, 'left'), top: cumulative(3, 'top') });
  }
  if (snapshot.game_state === 'post') {
    resolved.push({ milestone: 'FINAL', side: Number(snapshot.side_score), top: Number(snapshot.top_score) });
  }
  return resolved;
};

export const toPublicWinnerHistory = (resolutions: any[]) => resolutions.map((resolution: any) => {
  const participant = Array.isArray(resolution.contest_participants)
    ? resolution.contest_participants[0]
    : resolution.contest_participants;
  return {
    milestone: resolution.milestone,
    sideDigit: resolution.side_digit,
    topDigit: resolution.top_digit,
    participantName: participant?.display_name || null,
    resolvedAt: resolution.resolved_at,
  };
});

export const resolutionParticipantName = (resolution: any) => {
  const participant = Array.isArray(resolution?.contest_participants)
    ? resolution.contest_participants[0]
    : resolution?.contest_participants;
  return participant?.display_name || 'Your square';
};

export const deliveryIsActivelySending = (
  delivery: { status?: string; last_attempted_at?: string | null } | null,
  now = Date.now(),
) => {
  if (delivery?.status !== 'sending' || !delivery.last_attempted_at) return false;
  const attemptedAt = new Date(delivery.last_attempted_at).getTime();
  return Number.isFinite(attemptedAt) && now - attemptedAt < 5 * 60 * 1000;
};

const sendWinnerEmail = async (
  admin: SupabaseAdmin,
  env: WinnerNotificationEnv,
  resolution: any,
  subscription: any,
  context: { boardTitle: string; shareCode: string; participantName: string; sideTeam: string; topTeam: string },
) => {
  if (!env.EMAIL_PROVIDER_API_KEY || !env.EMAIL_FROM || !env.NOTIFICATION_TOKEN_SECRET) return;
  if (subscription.created_at && new Date(subscription.created_at).getTime() > new Date(resolution.resolved_at).getTime()) return;
  const idempotencyKey = `winner:${resolution.id}:${subscription.id}`;
  const { data: existing } = await admin
    .from('notification_deliveries')
    .select('id, status, attempt_count, last_attempted_at')
    .eq('resolution_id', resolution.id)
    .eq('subscription_id', subscription.id)
    .maybeSingle();
  if (existing?.status === 'sent' || deliveryIsActivelySending(existing)) return;

  let delivery = existing;
  if (!delivery) {
    const { data, error } = await admin
      .from('notification_deliveries')
      .insert({
        resolution_id: resolution.id,
        subscription_id: subscription.id,
        idempotency_key: idempotencyKey,
        status: 'pending',
      })
      .select('id, status, attempt_count, last_attempted_at')
      .single();
    if (error) return;
    delivery = data;
  }
  const attempt = Number(delivery.attempt_count || 0) + 1;
  await admin.from('notification_deliveries').update({
    status: 'sending',
    attempt_count: attempt,
    last_attempted_at: new Date().toISOString(),
    last_error: null,
  }).eq('id', delivery.id);

  const site = new URL(env.PUBLIC_SITE_URL || 'https://www.getgridone.com').origin;
  const unsubscribeToken = await signUnsubscribe(env.NOTIFICATION_TOKEN_SECRET, subscription.id);
  const unsubscribeUrl = `${site}/api/notifications/unsubscribe?subscription=${encodeURIComponent(subscription.id)}&token=${unsubscribeToken}&board=${encodeURIComponent(context.shareCode)}`;
  const boardUrl = `${site}/b/${encodeURIComponent(context.shareCode)}`;
  const label = resolution.milestone === 'Q2' ? 'halftime' : resolution.milestone === 'FINAL' ? 'Final' : resolution.milestone;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [subscription.email],
      subject: `${context.participantName} won ${label} on ${context.boardTitle}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0E0F12"><p style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6B7280">GridOne winner update</p><h1 style="font-size:30px;line-height:1.1">${escapeHtml(context.participantName)} won ${escapeHtml(label)}</h1><p style="font-size:17px">${escapeHtml(context.sideTeam)} ${resolution.side_digit} · ${escapeHtml(context.topTeam)} ${resolution.top_digit}</p><p><a href="${boardUrl}" style="display:inline-block;background:#FFC72C;color:#0E0F12;padding:14px 20px;text-decoration:none;font-weight:700">Open live board</a></p><p style="color:#5f6368;font-size:13px">GridOne tracks the board. It does not collect square money or pay winners.</p><p style="font-size:12px"><a href="${unsubscribeUrl}" style="color:#5f6368">Stop winner emails for this board name</a></p></div>`,
    }),
  });
  const responseBody = await response.json().catch(() => ({})) as any;
  await admin.from('notification_deliveries').update(response.ok ? {
    status: 'sent',
    provider_message_id: responseBody?.id || null,
    sent_at: new Date().toISOString(),
    last_error: null,
  } : {
    status: 'failed',
    last_error: String(responseBody?.message || response.statusText || 'Email provider rejected the request').slice(0, 1000),
  }).eq('id', delivery.id);
};

export const resolveMilestonesAndNotify = async (
  admin: SupabaseAdmin,
  env: WinnerNotificationEnv,
  contestId: string,
  snapshot: any,
  options: { sendNotifications?: boolean } = {},
) => {
  const { data: contest } = await admin
    .from('contests')
    .select('id, title, share_code, side_axis, top_axis, side_team_name, side_team_abbr, top_team_name, top_team_abbr')
    .eq('id', contestId)
    .maybeSingle();
  if (!contest || !Array.isArray(contest.side_axis) || !Array.isArray(contest.top_axis)) return;

  for (const score of milestoneScores(snapshot)) {
    const sideDigit = score.side % 10;
    const topDigit = score.top % 10;
    const row = contest.side_axis.indexOf(sideDigit);
    const column = contest.top_axis.indexOf(topDigit);
    if (row < 0 || column < 0) continue;
    const cellIndex = row * 10 + column;
    const { data: assignment } = await admin
      .from('square_assignments')
      .select('id, participant_id, contest_participants(display_name)')
      .eq('contest_id', contestId)
      .eq('cell_index', cellIndex)
      .maybeSingle();
    const { data: inserted } = await admin
      .from('milestone_resolutions')
      .upsert({
        contest_id: contestId,
        milestone: score.milestone,
        score_snapshot_id: snapshot.id,
        side_digit: sideDigit,
        top_digit: topDigit,
        assignment_id: assignment?.id || null,
        participant_id: assignment?.participant_id || null,
      }, { onConflict: 'contest_id,milestone', ignoreDuplicates: true })
      .select('*, contest_participants(display_name)')
      .maybeSingle();
    const resolution = inserted || (await admin
      .from('milestone_resolutions')
      .select('*, contest_participants(display_name)')
      .eq('contest_id', contestId)
      .eq('milestone', score.milestone)
      .maybeSingle()).data;
    if (!resolution?.participant_id || options.sendNotifications === false) continue;
    const { data: subscriptions } = await admin
      .from('notification_subscriptions')
      .select('id, email, status, created_at')
      .eq('contest_id', contestId)
      .eq('participant_id', resolution.participant_id)
      .eq('status', 'verified');
    for (const subscription of subscriptions || []) {
      try {
        await sendWinnerEmail(admin, env, resolution, subscription, {
          boardTitle: contest.title,
          shareCode: contest.share_code,
          participantName: resolutionParticipantName(resolution),
          sideTeam: contest.side_team_abbr || contest.side_team_name || 'Side',
          topTeam: contest.top_team_abbr || contest.top_team_name || 'Top',
        });
      } catch (error) {
        console.error('Winner notification delivery failed:', error);
      }
    }
  }

  const { data: canonicalResolutions, error: historyError } = await admin
    .from('milestone_resolutions')
    .select('milestone, side_digit, top_digit, resolved_at, contest_participants(display_name)')
    .eq('contest_id', contestId)
    .order('resolved_at', { ascending: true });
  if (historyError) throw historyError;

  const winnerHistory = toPublicWinnerHistory(canonicalResolutions || []);
  const { error: snapshotError } = await admin
    .from('public_board_snapshots')
    .update({ winner_history: winnerHistory, updated_at: new Date().toISOString() })
    .eq('contest_id', contestId);
  if (snapshotError) throw snapshotError;
  return winnerHistory;
};

export const verifyUnsubscribeToken = async (secret: string, subscriptionId: string, token: string) => {
  const expected = await signUnsubscribe(secret, subscriptionId);
  if (expected.length !== token.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ token.charCodeAt(index);
  }
  return mismatch === 0;
};
