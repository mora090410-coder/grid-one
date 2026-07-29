/**
 * useLiveScoring Hook
 * Consumes the server-authoritative score snapshot. Provider credentials and
 * grounding requests never run in the browser.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, LiveGameData, WinnerResolution } from '../types';
import { fetchLiveScore } from '../services/scoreService';

interface UseLiveScoringReturn {
    liveData: LiveGameData | null;
    liveStatus: string;
    isSynced: boolean;
    isRefreshing: boolean;
    lastUpdated: string;
    fetchLive: () => Promise<void>;
    winnerHistory: WinnerResolution[];
}

export function useLiveScoring(
    game: GameState,
    dataReady: boolean,
    loadingPool: boolean,
    boardRef?: string | null,
    initialWinnerHistory: WinnerResolution[] = [],
    enabled = true,
): UseLiveScoringReturn {
    const [liveData, setLiveData] = useState<LiveGameData | null>(null);
    const [liveStatus, setLiveStatus] = useState<string>('Initializing...');
    const [isSynced, setIsSynced] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState('');
    const [winnerHistory, setWinnerHistory] = useState<WinnerResolution[]>(initialWinnerHistory);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const isFinalRef = useRef(false);

    useEffect(() => {
        if (!enabled) {
            isFinalRef.current = false;
            setLiveData(null);
            setLiveStatus('UNLOCK LIVE SCORING');
            setIsSynced(false);
            setLastUpdated('');
            return;
        }
        if (!game.scoreSnapshot) {
            isFinalRef.current = false;
            return;
        }
        const score = game.scoreSnapshot;
        const needsAutomaticRefresh = Boolean(
            score.isManual
            && !game.useManualScores
            && game.gameExternalId,
        );
        isFinalRef.current = score.state === 'post' && !needsAutomaticRefresh;
        setLiveData(score);
        setLiveStatus(score.state === 'post' ? 'FINAL' : score.freshness === 'stale' ? 'STALE' : score.state === 'in' ? 'LIVE' : 'PRE-GAME');
        setIsSynced(score.freshness !== 'offline' && score.freshness !== 'rejected');
        setLastUpdated(score.retrievedAt ? new Date(score.retrievedAt).toLocaleTimeString() : '');
    }, [enabled, game.gameExternalId, game.scoreSnapshot, game.useManualScores]);

    useEffect(() => {
        setWinnerHistory(initialWinnerHistory);
    }, [initialWinnerHistory]);

    const fetchLive = useCallback(async () => {
        if (!enabled) {
            setLiveStatus('UNLOCK LIVE SCORING');
            return;
        }
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

        if (!game.gameExternalId) {
            const legacyManual = game.scoreSnapshot?.isManual ? game.scoreSnapshot : null;
            if (legacyManual) {
                setLiveData(legacyManual);
                setLiveStatus(legacyManual.state === 'post'
                    ? 'FINAL'
                    : legacyManual.state === 'pre'
                        ? 'PRE-GAME'
                        : 'MANUAL');
                setIsSynced(
                    legacyManual.freshness !== 'offline'
                    && legacyManual.freshness !== 'rejected',
                );
                setLastUpdated(
                    legacyManual.retrievedAt
                        ? new Date(legacyManual.retrievedAt).toLocaleTimeString()
                        : '',
                );
                return;
            }
            setLiveStatus('LINK GAME OR USE MANUAL SCORE');
            setIsSynced(false);
            return;
        }

        if (isFinalRef.current || document.hidden) {
            return;
        }

        if (!boardRef) {
            setLiveStatus('SCORE UNAVAILABLE');
            return;
        }

        setIsRefreshing(true);

        try {
            const result = await fetchLiveScore(boardRef);
            const data = result.score;

            setLiveData(data);
            if (result.winnerHistory) setWinnerHistory(result.winnerHistory);

            if (data.freshness === 'offline') {
                setLiveStatus('OFFLINE · LAST KNOWN');
            } else if (data.freshness === 'refreshing') {
                setLiveStatus('REFRESHING');
            } else if (data.freshness === 'stale') {
                setLiveStatus('STALE · LAST KNOWN');
            } else if (data.state === 'post') {
                isFinalRef.current = true;
                setLiveStatus('FINAL');
            } else if (data.state === 'in') {
                setLiveStatus('LIVE');
            } else {
                setLiveStatus('PRE-GAME');
            }
            setIsSynced(data.freshness !== 'offline' && data.freshness !== 'rejected');
            setLastUpdated(data.retrievedAt ? new Date(data.retrievedAt).toLocaleTimeString() : new Date().toLocaleTimeString());
        } catch (err: unknown) {
            console.error("Live Scoring Error:", err);
            const message = err instanceof Error ? err.message : 'The score service is unavailable.';
            setLiveData((current) => current ? { ...current, freshness: 'offline', warning: message } : current);
            setLiveStatus('OFFLINE · LAST KNOWN');
            setIsSynced(false);
        } finally {
            setIsRefreshing(false);
        }
    }, [boardRef, dataReady, enabled, game, loadingPool]);

    // Auto-polling
    useEffect(() => {
        if (!dataReady || !enabled) return;

        fetchLive();
        if (game.scoreSnapshot?.state !== 'post') {
            pollRef.current = setInterval(fetchLive, 60000);
        }

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [dataReady, enabled, fetchLive, game.scoreSnapshot?.state]);

    return {
        liveData,
        liveStatus,
        isSynced,
        isRefreshing,
        lastUpdated,
        fetchLive,
        winnerHistory
    };
}

export default useLiveScoring;
