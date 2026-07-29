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

export interface MilestoneObservation {
  winnerHistory: any[];
  pendingMilestones: any[];
  newlyConfirmedResolutionIds: string[];
}

export const observeMilestones = async (
  admin: SupabaseAdmin,
  contestId: string,
  snapshot: any,
) : Promise<MilestoneObservation> => {
  const { data, error } = await admin.rpc('gridone_observe_milestones', {
    p_contest_id: contestId,
    p_snapshot_id: snapshot.id,
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  return {
    winnerHistory: Array.isArray(result?.winner_history) ? result.winner_history : [],
    pendingMilestones: Array.isArray(result?.pending_milestones) ? result.pending_milestones : [],
    newlyConfirmedResolutionIds: Array.isArray(result?.newly_confirmed_resolution_ids)
      ? result.newly_confirmed_resolution_ids
      : [],
  };
};

export const resolveMilestonesAndNotify = async (
  admin: SupabaseAdmin,
  _env: WinnerNotificationEnv,
  contestId: string,
  snapshot: any,
) => (await observeMilestones(admin, contestId, snapshot)).winnerHistory;

export const verifyUnsubscribeToken = async (secret: string, subscriptionId: string, token: string) => {
  const expected = await signUnsubscribe(secret, subscriptionId);
  if (expected.length !== token.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ token.charCodeAt(index);
  }
  return mismatch === 0;
};
