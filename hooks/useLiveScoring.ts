/**
 * useLiveScoring Hook
 * Consumes the server-authoritative score snapshot. Provider credentials and
 * grounding requests never run in the browser.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, LiveGameData, PendingMilestone, WinnerResolution } from '../types';
import { fetchLiveScore } from '../services/scoreService';

interface UseLiveScoringReturn {
    liveData: LiveGameData | null;
    liveStatus: string;
    isSynced: boolean;
    isRefreshing: boolean;
    lastUpdated: string;
    fetchLive: () => Promise<void>;
    winnerHistory: WinnerResolution[];
    pendingMilestones: PendingMilestone[];
}

const EMPTY_WINNER_HISTORY: WinnerResolution[] = [];
const EMPTY_PENDING_MILESTONES: PendingMilestone[] = [];

export function useLiveScoring(
    game: GameState,
    dataReady: boolean,
    loadingPool: boolean,
    boardRef?: string | null,
    initialWinnerHistory: WinnerResolution[] = EMPTY_WINNER_HISTORY,
    enabled = true,
    initialPendingMilestones: PendingMilestone[] = EMPTY_PENDING_MILESTONES,
): UseLiveScoringReturn {
    const gameRef = useRef(game);
    gameRef.current = game;
    const externalEventId = game.gameExternalId || null;
    const manualScoringEnabled = Boolean(game.useManualScores);
    const manualScoreSignature = JSON.stringify({
        manualScoringEnabled,
        manualQuarterScores: game.manualQuarterScores,
        manualLeftScore: game.manualLeftScore,
        manualTopScore: game.manualTopScore,
        manualGameState: game.manualGameState,
        manualPeriod: game.manualPeriod,
    });
    const initialWinnerHistoryRef = useRef(initialWinnerHistory);
    initialWinnerHistoryRef.current = initialWinnerHistory;
    const initialPendingMilestonesRef = useRef(initialPendingMilestones);
    initialPendingMilestonesRef.current = initialPendingMilestones;
    const initialWinnerHistorySignature = JSON.stringify(initialWinnerHistory);
    const initialPendingMilestonesSignature = JSON.stringify(initialPendingMilestones);
    const [liveData, setLiveData] = useState<LiveGameData | null>(null);
    const [liveStatus, setLiveStatus] = useState<string>('Initializing...');
    const [isSynced, setIsSynced] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState('');
    const [winnerHistory, setWinnerHistory] = useState<WinnerResolution[]>(initialWinnerHistory);
    const [pendingMilestones, setPendingMilestones] = useState<PendingMilestone[]>(initialPendingMilestones);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const isFinalRef = useRef(false);
    const clearPoll = useCallback(() => {
        if (!pollRef.current) return;
        clearInterval(pollRef.current);
        pollRef.current = null;
    }, []);

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
            && !manualScoringEnabled
            && externalEventId,
        );
        isFinalRef.current = score.state === 'post' && !needsAutomaticRefresh;
        if (isFinalRef.current) clearPoll();
        setLiveData(score);
        setLiveStatus(score.state === 'post' ? 'FINAL' : score.freshness === 'stale' ? 'STALE' : score.state === 'in' ? 'LIVE' : 'PRE-GAME');
        setIsSynced(score.freshness !== 'offline' && score.freshness !== 'rejected');
        setLastUpdated(score.retrievedAt ? new Date(score.retrievedAt).toLocaleTimeString() : '');
    }, [clearPoll, enabled, externalEventId, game.scoreSnapshot, manualScoringEnabled]);

    useEffect(() => {
        setWinnerHistory(current =>
            JSON.stringify(current) === initialWinnerHistorySignature
                ? current
                : initialWinnerHistoryRef.current);
    }, [initialWinnerHistorySignature]);

    useEffect(() => {
        setPendingMilestones(current =>
            JSON.stringify(current) === initialPendingMilestonesSignature
                ? current
                : initialPendingMilestonesRef.current);
    }, [initialPendingMilestonesSignature]);

    const fetchLive = useCallback(async () => {
        const currentGame = gameRef.current;
        if (!enabled) {
            setLiveStatus('UNLOCK LIVE SCORING');
            return;
        }
        if (!dataReady || loadingPool) {
            setLiveStatus('WAITING FOR DATA');
            return;
        }

        // Manual scores mode: the organizer is the source of truth, no date needed
        if (manualScoringEnabled) {
            const zero = { left: 0, top: 0 };
            const mq = currentGame.manualQuarterScores;
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
            const leftScore = mq ? total('left') : (currentGame.manualLeftScore || 0);
            const topScore = mq ? total('top') : (currentGame.manualTopScore || 0);
            const state = currentGame.manualGameState ?? 'in';
            const period = currentGame.manualPeriod ?? 1;

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

        if (!externalEventId) {
            const legacyManual = currentGame.scoreSnapshot?.isManual
                ? currentGame.scoreSnapshot
                : null;
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

            if (!data && result.scoreState === 'awaiting_organizer_entry') {
                setLiveData(null);
                setLiveStatus('MANUAL · AWAITING SCORE');
                setIsSynced(true);
                setLastUpdated('');
                if (result.winnerHistory) setWinnerHistory(result.winnerHistory);
                if (result.pendingMilestones) setPendingMilestones(result.pendingMilestones);
                return;
            }
            if (!data) {
                throw new Error(result.message || 'No score is available yet.');
            }
            setLiveData(data);
            if (result.winnerHistory) setWinnerHistory(result.winnerHistory);
            if (result.pendingMilestones) setPendingMilestones(result.pendingMilestones);

            if (data.freshness === 'offline') {
                setLiveStatus('OFFLINE · LAST KNOWN');
            } else if (data.freshness === 'refreshing') {
                setLiveStatus('REFRESHING');
            } else if (data.freshness === 'stale') {
                setLiveStatus('STALE · LAST KNOWN');
            } else if (data.state === 'post') {
                isFinalRef.current = true;
                clearPoll();
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
    }, [
        boardRef,
        clearPoll,
        dataReady,
        enabled,
        externalEventId,
        loadingPool,
        manualScoringEnabled,
    ]);

    useEffect(() => {
        if (!manualScoringEnabled || !dataReady || loadingPool || !enabled) return;
        void fetchLive();
    }, [
        dataReady,
        enabled,
        fetchLive,
        loadingPool,
        manualScoreSignature,
        manualScoringEnabled,
    ]);

    // Auto-polling owns one stable timer per board/scoring identity. Visibility
    // changes pause the timer itself, rather than burning hidden no-op ticks.
    useEffect(() => {
        const startPoll = () => {
            clearPoll();
            if (
                !dataReady
                || !enabled
                || manualScoringEnabled
                || document.hidden
                || isFinalRef.current
            ) return;
            void fetchLive();
            if (externalEventId) pollRef.current = setInterval(fetchLive, 60_000);
        };
        const handleVisibility = () => {
            if (document.hidden) clearPoll();
            else startPoll();
        };

        startPoll();
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            clearPoll();
        };
    }, [
        clearPoll,
        dataReady,
        enabled,
        externalEventId,
        fetchLive,
        manualScoringEnabled,
    ]);

    return {
        liveData,
        liveStatus,
        isSynced,
        isRefreshing,
        lastUpdated,
        fetchLive,
        winnerHistory,
        pendingMilestones
    };
}

export default useLiveScoring;
