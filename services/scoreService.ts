import { LiveGameData, PendingMilestone, WinnerResolution } from '../types';
import { supabase } from './supabase';

export async function fetchLiveScore(boardRef: string, accessToken?: string | null): Promise<{
    score: LiveGameData | null;
    scoreState?: 'awaiting_organizer_entry';
    message?: string;
    winnerHistory?: WinnerResolution[];
    pendingMilestones?: PendingMilestone[];
}> {
    let token = accessToken;
    if (token === undefined) {
        try {
            const { data } = await supabase.auth.getSession();
            token = data.session?.access_token || null;
        } catch {
            token = null;
        }
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`/api/pools/${encodeURIComponent(boardRef)}/score`, {
        headers,
        cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || 'The score service is unavailable.');
    }
    if (!data.score && data.scoreState !== 'awaiting_organizer_entry') {
        throw new Error('No score is available yet.');
    }
    return {
      score: data.score ? {
        ...(data.score as LiveGameData),
        warning: data.warning || data.score.warning,
      } : null,
      scoreState: data.scoreState,
      message: data.message,
      winnerHistory: Array.isArray(data.winnerHistory) ? data.winnerHistory : undefined,
      pendingMilestones: Array.isArray(data.pendingMilestones) ? data.pendingMilestones : undefined,
    };
}
