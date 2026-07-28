/**
 * usePoolData Hook
 * Manages pool loading, saving, and state
 */
import { useState, useCallback } from 'react';
import { GameState, BoardData, WinnerResolution } from '../types';
import { supabase } from '../services/supabase';

const INITIAL_GAME: GameState = {
    title: '',
    meta: 'Super Bowl Party',
    leftAbbr: 'DAL',
    leftName: 'Dallas Cowboys',
    topAbbr: 'WAS',
    topName: 'Washington Commanders',
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
    publishPool: (_legacyToken: string, currentData?: { game: GameState; board: BoardData }) => Promise<string | void>;
    updatePool: (poolId: string, data: { game: GameState; board: BoardData }) => Promise<boolean>;
    migrateGuestBoard: (user: any, guestData: { game: GameState; board: BoardData }) => Promise<string>;
    clearError: () => void;
}

export function usePoolData(): UsePoolDataReturn {
    const [game, setGame] = useState<GameState>(INITIAL_GAME);
    const [board, setBoard] = useState<BoardData>(EMPTY_BOARD);
    const [activePoolId, setActivePoolId] = useState<string | null>(null);
    const [shareCode, setShareCode] = useState<string | null>(null);
    const [revision, setRevision] = useState<number | null>(null);
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [loadingPool, setLoadingPool] = useState(true);
    const [dataReady, setDataReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isActivated, setIsActivated] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [isPublished, setIsPublished] = useState(false);
    const [winnerHistory, setWinnerHistory] = useState<WinnerResolution[]>([]);


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
            setOwnerId(data.owner_id || null);
            setIsActivated(Boolean(data.is_activated));
            setIsLocked(Boolean(data.locked));
            setIsPublished(Boolean(data.published_at));
            setWinnerHistory(Array.isArray(data.winner_history) ? data.winner_history : []);

            const nextGame = {
                ...INITIAL_GAME,
                ...data,
                payouts: data.payouts || INITIAL_GAME.payouts,
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
        _legacyToken: string,
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
            setRevision(Number.isInteger(data.revision) ? data.revision : null);
            return poolId;
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }, [game, board]);

    // Update existing pool in Supabase
    const updatePool = useCallback(async (
        poolId: string,
        data: { game: GameState; board: BoardData }
    ): Promise<boolean> => {
        try {
            if (!revision) throw new Error('Reload this board before saving.');
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            if (!token) throw new Error('Sign in before saving.');
            const response = await fetch(`/api/pools/${poolId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ...data, revision }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to save the board.');
            setRevision(result.revision);
            return true;
        } catch (err: any) {
            console.error("Update Pool Error:", err);
            setError(err.message);
            return false;
        }
    }, [revision]);

    // Migrate guest board to Supabase
    const migrateGuestBoard = useCallback(async (
        user: any,
        guestData: { game: GameState; board: BoardData }
    ): Promise<string> => {
        try {
            // If title is missing, use a fallback that indicates error but allows debugging
            const leagueTitle = guestData.game.title?.trim();
            if (!leagueTitle) {
                console.error("Migration Error: Missing Title in Guest Data", guestData);
                throw new Error("Cannot migrate board: Missing Title");
            }

            const payload = {
                owner_id: user.id,
                title: leagueTitle,
                settings: { ...guestData.game, title: leagueTitle },
                board_data: guestData.board,
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('contests')
                .insert([payload])
                .select('id')
                .single();

            if (error) throw error;

            return data.id;
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
