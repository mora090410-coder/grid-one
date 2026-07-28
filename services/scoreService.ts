import { LiveGameData, WinnerResolution } from '../types';

export async function fetchLiveScore(boardRef: string): Promise<{
    score: LiveGameData;
    winnerHistory?: WinnerResolution[];
}> {
    const response = await fetch(`/api/pools/${encodeURIComponent(boardRef)}/score`, {
        headers: { Accept: 'application/json' },
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
