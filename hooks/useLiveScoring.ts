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
        if (!dataReady || loadingPool || !game.dates) {
            setLiveStatus('WAITING FOR DATA');
            return;
        }

        // Manual scores mode
        if (game.useManualScores) {
            setLiveData({
                leftScore: game.manualLeftScore || 0,
                topScore: game.manualTopScore || 0,
                quarterScores: {
                    Q1: { left: 0, top: 0 },
                    Q2: { left: 0, top: 0 },
                    Q3: { left: game.manualLeftScore || 0, top: game.manualTopScore || 0 },
                    Q4: { left: 0, top: 0 },
                    OT: { left: 0, top: 0 },
                },
                clock: '',
                period: 3,
                state: 'in',
                detail: 'Manual Entry',
                isOvertime: false,
                isManual: true
            });
            setLiveStatus('MANUAL');
            setIsSynced(true);
            setLastUpdated(new Date().toLocaleTimeString());
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
