import { supabase } from '../../../../../services/supabase';
import type { WinnerResolution } from '../../../../../types';

export interface MilestoneCorrectionDraft {
  milestone: WinnerResolution['milestone'];
  expectedVersion: number;
  sideScore: number;
  topScore: number;
  reason: string;
}

const requireToken = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Sign in before correcting a result.');
  return token;
};

export const publishMilestoneCorrectionToServer = async (
  poolId: string,
  draft: MilestoneCorrectionDraft,
  notify = true,
): Promise<{ winnerHistory?: WinnerResolution[] }> => {
  const token = await requireToken();
  const response = await fetch(`/api/pools/${poolId}/milestones/${draft.milestone}/correct`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...draft, notify }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The correction could not be published.');
  return result;
};
