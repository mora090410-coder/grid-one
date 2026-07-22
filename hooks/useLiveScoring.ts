/**
 * useLiveScoring Hook
 * Manages live game data using Gemini AI with Search Grounding
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, LiveGameData } from '../types';
import { fetchLiveScore } from '../services/scoreService';

interface UseLiveScoringReturn {
    liveData: LiveGameData | null;
    liveStatus: string;
    isSynced: boolean;
    isRefreshing: boolean;
    lastUpdated: string;
    fetchLive: () => Promise<void>;
}

export function useLiveScoring(game: GameState, dataReady: boolean, loadingPool: boolean): UseLiveScoringReturn {
    const [liveData, setLiveData] = useState<LiveGameData | null>(null);
    const [liveStatus, setLiveStatus] = useState<string>('Initializing...');
    const [isSynced, setIsSynced] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState('');
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    const fetchLive = useCallback(async () => {
        if (!dataReady || loadingPool) {
            setLiveStatus('WAITING FOR DATA');
            return;
        }

        // Manual scores mode: the organizer is the source of truth, no date needed
        if (game.useManualScores) {
            const zero = { left: 0, top: 0 };
            const mq = game.manualQuarterScores;
            const quarterScores = {
                Q1: mq?.Q1 ?? zero,
                Q2: mq?.Q2 ?? zero,
                Q3: mq?.Q3 ?? zero,
                Q4: mq?.Q4 ?? zero,
                OT: mq?.OT ?? zero,
            };
            const total = (side: 'left' | 'top') =>
                quarterScores.Q1[side] + quarterScores.Q2[side] + quarterScores.Q3[side] +
                quarterScores.Q4[side] + quarterScores.OT[side];
            // Boards saved before the quarter-entry UI only have single totals
            const leftScore = mq ? total('left') : (game.manualLeftScore || 0);
            const topScore = mq ? total('top') : (game.manualTopScore || 0);
            const state = game.manualGameState ?? 'in';
            const period = game.manualPeriod ?? 1;

            setLiveData({
                leftScore,
                topScore,
                quarterScores,
                clock: '',
                period,
                state,
                detail: 'Manual Entry',
                isOvertime: period > 4,
                isManual: true
            });
            setLiveStatus(state === 'post' ? 'FINAL' : state === 'pre' ? 'PRE-GAME' : 'MANUAL');
            setIsSynced(true);
            setLastUpdated(new Date().toLocaleTimeString());
            return;
        }

        if (!game.dates) {
            setLiveStatus('WAITING FOR DATA');
            return;
        }

        setIsRefreshing(true);

        try {
            const data = await fetchLiveScore(
                game.leftName || game.leftAbbr,
                game.topName || game.topAbbr,
                game.dates
            );

            setLiveData(data);

            if (data.state === 'post') {
                setLiveStatus('FINAL');
            } else if (data.state === 'in') {
                setLiveStatus('LIVE');
            } else {
                setLiveStatus('PRE-GAME');
            }
            setIsSynced(true);
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (err: unknown) {
            console.error("Live Scoring Error:", err);
            setLiveStatus('OFFLINE');
            setIsSynced(false);
        } finally {
            setIsRefreshing(false);
        }
    }, [game, dataReady, loadingPool]);

    // Auto-polling
    useEffect(() => {
        if (!dataReady) return;

        fetchLive();
        pollRef.current = setInterval(fetchLive, 60000); // 1 minute interval for AI calls to manage quota

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [dataReady, fetchLive]);

    return {
        liveData,
        liveStatus,
        isSynced,
        isRefreshing,
        lastUpdated,
        fetchLive
    };
}

export default useLiveScoring;
