/**
 * usePoolData Hook
 * Manages pool loading, saving, and state
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
    GameState,
    BoardData,
    NotificationDeliveryIssue,
    PendingMilestone,
    PayoutDescriptions,
    WinnerResolution,
} from '../types';
import { supabase } from '../services/supabase';

const INITIAL_GAME: GameState = {
    title: '',
    meta: 'Super Bowl Party',
    leftAbbr: '',
    leftName: '',
    topAbbr: '',
    topName: '',
    dates: '',
    lockTitle: false,
    lockMeta: false,
    useManualScores: false,
    manualLeftScore: 0,
    manualTopScore: 0,
    coverImage: '',
    payoutDescriptions: {},
};

const EMPTY_BOARD: BoardData = {
    leftAxis: [null, null, null, null, null, null, null, null, null, null],
    topAxis: [null, null, null, null, null, null, null, null, null, null],
    squares: Array(100).fill(null).map(() => []),
    isDynamic: false
};

interface PoolDataState {
    game: GameState;
    board: BoardData;
    activePoolId: string | null;
    shareCode: string | null;
    revision: number | null;
    ownerId: string | null;
    loadingPool: boolean;
    dataReady: boolean;
    error: string | null;
    isActivated: boolean;
    isPaid: boolean;
    isLocked: boolean;
    isPublished: boolean;
    isShared: boolean;
    updatedAt: string | null;
    refreshing: boolean;
    refreshError: string | null;
    winnerHistory: WinnerResolution[];
    pendingMilestones: PendingMilestone[];
    notificationDeliveryIssues: NotificationDeliveryIssue[];
}

interface UsePoolDataReturn extends PoolDataState {
    setGame: React.Dispatch<React.SetStateAction<GameState>>;
    setBoard: React.Dispatch<React.SetStateAction<BoardData>>;
    setActivePoolId: React.Dispatch<React.SetStateAction<string | null>>;
    loadPoolData: (poolId: string, options?: { background?: boolean }) => Promise<void>;
    shareBoard: (poolId: string) => Promise<void>;
    publishPool: (currentData?: { game: GameState; board: BoardData }) => Promise<string | void>;
    updatePool: (poolId: string, data: { game: GameState; board: BoardData }) => Promise<boolean>;
    updatePayoutDescriptions: (poolId: string, descriptions: PayoutDescriptions) => Promise<PayoutDescriptions>;
    updatePublishedOpenSquares: (poolId: string, squares: string[][]) => Promise<void>;
    migrateGuestBoard: (_user: unknown, guestData: { game: GameState; board: BoardData }) => Promise<string>;
    clearError: () => void;
}

export function usePoolData(): UsePoolDataReturn {
    const [game, setGame] = useState<GameState>(INITIAL_GAME);
    const [board, setBoard] = useState<BoardData>(EMPTY_BOARD);
    const [activePoolId, setActivePoolId] = useState<string | null>(null);
    const [shareCode, setShareCode] = useState<string | null>(null);
    const [revision, setRevision] = useState<number | null>(null);
    const revisionRef = useRef<number | null>(null);
    const updateQueueRef = useRef<Promise<unknown>>(Promise.resolve());
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [loadingPool, setLoadingPool] = useState(true);
    const [dataReady, setDataReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isActivated, setIsActivated] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [isPublished, setIsPublished] = useState(false);
    const [isShared, setIsShared] = useState(false);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState<string | null>(null);
    const loadSequence = useRef(0);
    // Board id the current revisionRef belongs to, so a stale load of the same
    // board can be told apart from a load of a different board.
    const loadedPoolIdRef = useRef<string | null>(null);
    const [winnerHistory, setWinnerHistory] = useState<WinnerResolution[]>([]);
    const [pendingMilestones, setPendingMilestones] = useState<PendingMilestone[]>([]);
    const [notificationDeliveryIssues, setNotificationDeliveryIssues] = useState<NotificationDeliveryIssue[]>([]);

    useEffect(() => {
        revisionRef.current = revision;
    }, [revision]);

    // Every revision-carrying write runs one at a time, so each request sends
    // the revision the previous write returned.
    const enqueueWrite = useCallback(<T,>(run: () => Promise<T>): Promise<T> => {
        const queued = updateQueueRef.current.then(run, run);
        updateQueueRef.current = queued.then(() => undefined, () => undefined);
        return queued;
    }, []);


    // Load pool data through the API so unpaid boards can be masked for non-owners.
    const loadPoolData = useCallback(async (poolId: string, options?: { background?: boolean }) => {
        const sequence = ++loadSequence.current;
        const background = options?.background === true;
        if (background) setRefreshing(true);
        else { setLoadingPool(true); setError(null); }
        setRefreshError(null);

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;
            const response = await fetch(`/api/pools/${poolId}`, {
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
            });
            const data = await response.json();

            if (sequence !== loadSequence.current) return;
            if (!response.ok) throw Object.assign(new Error(data.error || 'Board not found'), { status: response.status });
            // A load that started before a save can answer after the save was
            // acknowledged. Its older board would roll the organizer back and
            // turn the next save into a false conflict, so drop it.
            const loadedId = data.id || poolId;
            if (
                loadedId === loadedPoolIdRef.current
                && Number.isInteger(data.revision)
                && revisionRef.current !== null
                && data.revision < revisionRef.current
            ) return;
            loadedPoolIdRef.current = loadedId;
            setError(null);

            setActivePoolId(data.id || poolId);
            setShareCode(data.share_code || (poolId.length === 8 ? poolId : null));
            setRevision(Number.isInteger(data.revision) ? data.revision : null);
            revisionRef.current = Number.isInteger(data.revision) ? data.revision : null;
            setOwnerId(data.owner_id || null);
            setIsActivated(Boolean(data.is_activated));
            setIsLocked(Boolean(data.locked));
            setIsPublished(Boolean(data.published_at));
            setIsShared(Boolean(data.shared_at || data.published_at));
            setUpdatedAt(data.updated_at || data.shared_at || null);
            setWinnerHistory(Array.isArray(data.winner_history) ? data.winner_history : []);
            setPendingMilestones(Array.isArray(data.pending_milestones) ? data.pending_milestones : []);
            setNotificationDeliveryIssues(
                Array.isArray(data.notification_delivery_issues)
                    ? data.notification_delivery_issues
                    : [],
            );

            const nextGame = {
                ...INITIAL_GAME,
                ...data,
                payoutDescriptions: data.payoutDescriptions || {},
                scoreSnapshot: data.score || null,
            };
            delete (nextGame as any).payouts;
            delete (nextGame as any).payout_labels;
            delete (nextGame as any).board;
            delete (nextGame as any).locked;
            delete (nextGame as any).owner_id;
            delete (nextGame as any).is_activated;
            delete (nextGame as any).activated_at;

            setGame(nextGame);
            // Preserve legacy per-quarter axes on load. Unsupported mutation
            // paths must reject dynamic boards rather than flattening their data.
            setBoard(data.board ? { ...data.board } : EMPTY_BOARD);
            setDataReady(true);
        } catch (err: any) {
            console.error("Load Pool Error:", err);
            if (sequence !== loadSequence.current) return;
            if (background && err.status !== 404 && err.status !== 403) setRefreshError(err.message);
            else setError(err.message);
            setDataReady(true);
        } finally {
            if (sequence === loadSequence.current) { setLoadingPool(false); setRefreshing(false); }
        }
    }, []);

    // Shares only an explicitly saved board. Queue with writes so the revision is current.
    const shareBoard = useCallback((poolId: string): Promise<void> => {
        const run = async () => {
            const currentRevision = revisionRef.current;
            if (!currentRevision) throw new Error('Reload this board before sharing.');
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            if (!token) throw new Error('Sign in before sharing.');
            const response = await fetch(`/api/pools/${poolId}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ revision: currentRevision }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw Object.assign(new Error(result.error || 'The board could not be shared. Try again.'), {
                    code: result.code, upgradeTo: result.upgradeTo,
                });
            }
            if (!result.shared || !result.shareCode || !Number.isInteger(result.revision)) {
                throw new Error('Sharing could not be confirmed. Reload the board before trying again.');
            }
            revisionRef.current = result.revision;
            setRevision(result.revision);
            setShareCode(result.shareCode);
            setIsShared(true);
            setIsActivated(true);
            setUpdatedAt(result.sharedAt || null);
        };
        return enqueueWrite(run);
    }, [enqueueWrite]);

    // Create a board through the authenticated API.
    const publishPool = useCallback(async (
        currentData?: { game: GameState; board: BoardData }
    ): Promise<string | void> => {
        const g = currentData?.game || game;
        const b = currentData?.board || board;

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;
            if (!accessToken) throw new Error("You must be logged in to publish a pool.");

            const response = await fetch('/api/pools', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    game: g,
                    board: b,
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || data.error || 'Failed to create pool');

            const poolId = data.boardId || data.poolId;
            if (!poolId) throw new Error('No pool ID returned from server');

            setActivePoolId(poolId);
            loadedPoolIdRef.current = poolId;
            setShareCode(data.shareCode || null);
            const nextRevision = Number.isInteger(data.revision) ? data.revision : null;
            setRevision(nextRevision);
            revisionRef.current = nextRevision;
            return poolId;
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }, [game, board]);

    // Update existing pool in Supabase
    const updatePool = useCallback((
        poolId: string,
        data: { game: GameState; board: BoardData }
    ): Promise<boolean> => {
        const run = async () => {
            try {
                const currentRevision = revisionRef.current;
                if (!currentRevision) throw new Error('Reload this board before saving.');
                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData.session?.access_token;
                if (!token) throw new Error('Sign in before saving.');
                const response = await fetch(`/api/pools/${poolId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ ...data, revision: currentRevision }),
                });
                const result = await response.json();
                if (!response.ok) {
                    if (
                        response.status === 409
                        && result.code === 'REVISION_CONFLICT'
                        && Number.isInteger(result.currentRevision)
                    ) {
                        revisionRef.current = result.currentRevision;
                        setRevision(result.currentRevision);
                    }
                    throw new Error(result.error || 'Unable to save the board.');
                }
                revisionRef.current = result.revision;
                setRevision(result.revision);
                return true;
            } catch (err: any) {
                console.error("Update Pool Error:", err);
                return false;
            }
        };
        return enqueueWrite(run);
    }, [enqueueWrite]);

    const updatePayoutDescriptions = useCallback((
        poolId: string,
        descriptions: PayoutDescriptions,
    ): Promise<PayoutDescriptions> => {
        const run = async () => {
            const currentRevision = revisionRef.current;
            if (!currentRevision) throw new Error('Reload this board before saving payout descriptions.');
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            if (!token) throw new Error('Sign in before saving payout descriptions.');
            const response = await fetch(`/api/pools/${poolId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ payoutDescriptions: descriptions, revision: currentRevision }),
            });
            const result = await response.json();
            if (!response.ok) {
                if (
                    response.status === 409
                    && result.code === 'REVISION_CONFLICT'
                    && Number.isInteger(result.currentRevision)
                ) {
                    revisionRef.current = result.currentRevision;
                    setRevision(result.currentRevision);
                }
                throw Object.assign(new Error(result.error || 'Unable to save payout descriptions.'), {
                    code: result.code,
                    currentRevision: result.currentRevision,
                });
            }
            revisionRef.current = result.revision;
            setRevision(result.revision);
            const normalized = result.payoutDescriptions || {};
            setGame((current) => ({ ...current, payoutDescriptions: normalized }));
            return normalized;
        };
        return enqueueWrite(run);
    }, [enqueueWrite]);

    const updatePublishedOpenSquares = useCallback((
        poolId: string,
        squares: string[][],
    ): Promise<void> => enqueueWrite(async () => {
        const currentRevision = revisionRef.current;
        if (!currentRevision) throw new Error('Reload this board before assigning open squares.');
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Sign in before assigning open squares.');

        const response = await fetch(`/api/pools/${poolId}/open-squares`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ revision: currentRevision, squares }),
        });
        const result = await response.json();
        if (!response.ok) {
            if (
                response.status === 409
                && result.code === 'REVISION_CONFLICT'
                && Number.isInteger(result.currentRevision)
            ) {
                revisionRef.current = result.currentRevision;
                setRevision(result.currentRevision);
            }
            throw new Error(result.error || 'Open squares could not be assigned.');
        }
        if (!result.success || !Number.isInteger(result.revision)) {
            throw new Error('The board update returned an invalid response. Reload and try again.');
        }
        revisionRef.current = result.revision;
        setRevision(result.revision);
    }), [enqueueWrite]);

    // Migrate guest board to Supabase
    const migrateGuestBoard = useCallback(async (
        _user: unknown,
        guestData: { game: GameState; board: BoardData }
    ): Promise<string> => {
        try {
            const leagueTitle = guestData.game.title?.trim();
            if (!leagueTitle) {
                throw new Error("Cannot recover this board because its name is missing.");
            }
            if (!guestData.game.gameExternalId) {
                throw new Error("This recovered board is not linked to an NFL game. Recreate it and choose the scheduled game.");
            }
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;
            if (!accessToken) throw new Error("Sign in before recovering this board.");
            const response = await fetch('/api/pools', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    game: { ...guestData.game, title: leagueTitle },
                    board: guestData.board,
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'The recovered board could not be saved.');
            const id = result.boardId || result.poolId;
            if (!id) throw new Error('The recovered board did not return an ID.');
            return id;
        } catch (err: any) {
            console.error("Migration Error:", err);
            throw err;
        }
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return {
        game,
        board,
        activePoolId,
        shareCode,
        revision,
        ownerId,
        loadingPool,
        dataReady,
        error,
        setGame,
        setBoard,
        setActivePoolId,
        loadPoolData,
        publishPool,
        updatePool,
        updatePayoutDescriptions,
        updatePublishedOpenSquares,
        migrateGuestBoard,
        clearError,
        isActivated,
        isPaid: isActivated,
        isLocked,
        isPublished,
        isShared,
        updatedAt,
        refreshing,
        refreshError,
        shareBoard,
        winnerHistory,
        pendingMilestones,
        notificationDeliveryIssues,
    };
}

export { INITIAL_GAME, EMPTY_BOARD };
export default usePoolData;
