/**
 * usePoolData Hook
 * Manages pool loading, saving, and state
 */
import { useState, useCallback, useEffect } from 'react';
import { GameState, BoardData } from '../types';

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
    coverImage: ''
};

const EMPTY_BOARD: BoardData = {
    bearsAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    oppAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    squares: Array(100).fill(null).map(() => [])
};

const API_URL = `${window.location.origin}/api/pools`;

interface PoolDataState {
    game: GameState;
    board: BoardData;
    activePoolId: string | null;
    loadingPool: boolean;
    dataReady: boolean;
    error: string | null;
}

interface UsePoolDataReturn extends PoolDataState {
    setGame: React.Dispatch<React.SetStateAction<GameState>>;
    setBoard: React.Dispatch<React.SetStateAction<BoardData>>;
    setActivePoolId: React.Dispatch<React.SetStateAction<string | null>>;
    loadPoolData: (poolId: string) => Promise<void>;
    publishPool: (adminToken: string, currentData?: { game: GameState; board: BoardData }) => Promise<string | void>;
    updatePool: (poolId: string, adminToken: string, data: { game: GameState; board: BoardData }) => Promise<boolean>;
    clearError: () => void;
}

export function usePoolData(): UsePoolDataReturn {
    const [game, setGame] = useState<GameState>(INITIAL_GAME);
    const [board, setBoard] = useState<BoardData>(EMPTY_BOARD);
    const [activePoolId, setActivePoolId] = useState<string | null>(null);
    const [loadingPool, setLoadingPool] = useState(true);
    const [dataReady, setDataReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load pool data from server
    const loadPoolData = useCallback(async (poolId: string) => {
        setLoadingPool(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/${poolId}`, { method: 'GET' });
            if (!res.ok) {
                if (res.status === 404) throw new Error('Pool not found');
                throw new Error('Failed to load pool');
            }

            const poolPayload = await res.json();
            setActivePoolId(poolId);

            // Load pool data
            if (poolPayload.data) {
                setGame(poolPayload.data.game || INITIAL_GAME);
                setBoard(poolPayload.data.board || EMPTY_BOARD);
            }

            setDataReady(true);
        } catch (err: any) {
            setError(err.message);
            setDataReady(true); // Still mark ready so UI can handle error state
        } finally {
            setLoadingPool(false);
        }
    }, []);

    // Publish new pool to server
    const publishPool = useCallback(async (
        adminToken: string,
        currentData?: { game: GameState; board: BoardData }
    ): Promise<string | void> => {
        const dataToPublish = currentData || { game, board };

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify(dataToPublish)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || errData.error || 'Failed to create pool');
            }

            const { poolId } = await res.json();
            setActivePoolId(poolId);
            return poolId;
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }, [game, board]);

    // Update existing pool
    const updatePool = useCallback(async (
        poolId: string,
        adminToken: string,
        data: { game: GameState; board: BoardData }
    ): Promise<boolean> => {
        try {
            const res = await fetch(`${API_URL}/${poolId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify(data)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || errData.error || 'Failed to update');
            }

            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return {
        game,
        board,
        activePoolId,
        loadingPool,
        dataReady,
        error,
        setGame,
        setBoard,
        setActivePoolId,
        loadPoolData,
        publishPool,
        updatePool,
        clearError
    };
}

export { INITIAL_GAME, EMPTY_BOARD };
export default usePoolData;
