import { hmacSha256Hex, timingSafeEqual } from './crypto';

type SupabaseAdmin = any;

interface WinnerNotificationEnv {
  EMAIL_PROVIDER_API_KEY?: string;
  EMAIL_FROM?: string;
  NOTIFICATION_TOKEN_SECRET?: string;
  PUBLIC_SITE_URL?: string;
}

type Milestone = 'Q1' | 'Q2' | 'Q3' | 'FINAL';

/** The only unsubscribe-token signer. The retry worker signs with it; verifyUnsubscribeToken checks it. */
export const signUnsubscribe = (secret: string, subscriptionId: string) => hmacSha256Hex(secret, subscriptionId);

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
  return timingSafeEqual(expected, token);
};
