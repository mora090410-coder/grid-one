import { LiveGameData, WinnerResolution } from '../types';
import { supabase } from './supabase';

export async function fetchLiveScore(boardRef: string, accessToken?: string | null): Promise<{
    score: LiveGameData;
    winnerHistory?: WinnerResolution[];
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
    if (!data.score) {
        throw new Error('No score is available yet.');
    }
    return {
      score: {
        ...(data.score as LiveGameData),
        warning: data.warning || data.score.warning,
      },
      winnerHistory: Array.isArray(data.winnerHistory) ? data.winnerHistory : undefined,
    };
}
