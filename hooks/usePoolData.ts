/**
 * usePoolData Hook
 * Manages pool loading, saving, and state
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, BoardData, WinnerResolution } from '../types';
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
    payouts: {
        Q1: 125,
        Q2: 125,
        Q3: 125,
        Final: 250
    }
};

const EMPTY_BOARD: BoardData = {
    bearsAxis: [null, null, null, null, null, null, null, null, null, null],
    oppAxis: [null, null, null, null, null, null, null, null, null, null],
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
    winnerHistory: WinnerResolution[];
}

interface UsePoolDataReturn extends PoolDataState {
    setGame: React.Dispatch<React.SetStateAction<GameState>>;
    setBoard: React.Dispatch<React.SetStateAction<BoardData>>;
    setActivePoolId: React.Dispatch<React.SetStateAction<string | null>>;
    loadPoolData: (poolId: string) => Promise<void>;
    publishPool: (currentData?: { game: GameState; board: BoardData }) => Promise<string | void>;
    updatePool: (poolId: string, data: { game: GameState; board: BoardData }) => Promise<boolean>;
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
    const [winnerHistory, setWinnerHistory] = useState<WinnerResolution[]>([]);

    useEffect(() => {
        revisionRef.current = revision;
    }, [revision]);


    // Load pool data through the API so unpaid boards can be masked for non-owners.
    const loadPoolData = useCallback(async (poolId: string) => {
        setLoadingPool(true);
        setError(null);

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;
            const response = await fetch(`/api/pools/${poolId}`, {
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Pool not found');

            setActivePoolId(data.id || poolId);
            setShareCode(data.share_code || (poolId.length === 8 ? poolId : null));
            setRevision(Number.isInteger(data.revision) ? data.revision : null);
            revisionRef.current = Number.isInteger(data.revision) ? data.revision : null;
            setOwnerId(data.owner_id || null);
            setIsActivated(Boolean(data.is_activated));
            setIsLocked(Boolean(data.locked));
            setIsPublished(Boolean(data.published_at));
            setWinnerHistory(Array.isArray(data.winner_history) ? data.winner_history : []);

            const nextGame = {
                ...INITIAL_GAME,
                ...data,
                payouts: data.payouts || data.payout_labels || INITIAL_GAME.payouts,
                scoreSnapshot: data.score || null,
            };
            delete (nextGame as any).board;
            delete (nextGame as any).locked;
            delete (nextGame as any).owner_id;
            delete (nextGame as any).is_activated;
            delete (nextGame as any).activated_at;

            setGame(nextGame);
            setBoard(data.board ? { ...data.board, isDynamic: false } : EMPTY_BOARD);
            setDataReady(true);
        } catch (err: any) {
            console.error("Load Pool Error:", err);
            setError(err.message);
            setDataReady(true);
        } finally {
            setLoadingPool(false);
        }
    }, []);

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
        const queued = updateQueueRef.current.then(run, run);
        updateQueueRef.current = queued.then(() => undefined, () => undefined);
        return queued;
    }, []);

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
        migrateGuestBoard,
        clearError,
        isActivated,
        isPaid: isActivated,
        isLocked,
        isPublished,
        winnerHistory
    };
}

export { INITIAL_GAME, EMPTY_BOARD };
export default usePoolData;
