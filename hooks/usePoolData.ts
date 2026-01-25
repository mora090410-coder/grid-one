/**
 * usePoolData Hook
 * Manages pool loading, saving, and state
 */
import { useState, useCallback, useEffect } from 'react';
import { GameState, BoardData } from '../types';
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

const API_URL = `${window.location.origin}/api/pools`;

interface PoolDataState {
    game: GameState;
    board: BoardData;
    activePoolId: string | null;
    ownerId: string | null;
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
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [loadingPool, setLoadingPool] = useState(true);
    const [dataReady, setDataReady] = useState(false);
    const [error, setError] = useState<string | null>(null);


    // Load pool data from Supabase
    const loadPoolData = useCallback(async (poolId: string) => {
        setLoadingPool(true);
        setError(null);

        try {
            const { data, error } = await supabase
                .from('contests')
                .select('*')
                .eq('id', poolId)
                .single();

            if (error) throw error;
            if (!data) throw new Error('Pool not found');

            setActivePoolId(poolId);
            setOwnerId(data.owner_id);

            // Map database fields to app state
            // settings has GameState, board_data has BoardData
            // We expect settings to be GameState and board_data to be BoardData
            setGame(data.settings || INITIAL_GAME);
            setBoard(data.board_data || EMPTY_BOARD);

            setDataReady(true);
        } catch (err: any) {
            console.error("Load Pool Error:", err);
            setError(err.message);
            setDataReady(true);
        } finally {
            setLoadingPool(false);
        }
    }, []);

    // Publish new pool to Supabase
    const publishPool = useCallback(async (
        adminToken: string,
        currentData?: { game: GameState; board: BoardData }
    ): Promise<string | void> => {
        // NOTE: New creation flow uses CreateContest.tsx directly.
        // This function is kept for compatibility with BoardView's AdminPanel if needed,
        // but typically BoardView uses this for "Wizard" inside the board.
        // We should map this to Supabase insert.

        const g = currentData?.game || game;
        const b = currentData?.board || board;

        // Note: adminToken is treated as the passcode here.
        // If we are creating a new pool from BoardView wizard:

        try {
            // We need an owner_id. BoardView might not have AuthContext user if anonymous?
            // If user is not logged in, we might need anon auth or strict requirement.
            // For now, let's assume this feature requires auth or we use a fallback?
            // CreateContest.tsx handles the main flow. 
            // If this is called, we'll try to insert. 

            // To properly support this, we really should use the user from AuthContext.
            // But this hook doesn't have it.
            // For now, let's throw if we can't get session, OR check if we can get it from supabase.auth

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("You must be logged in to publish a pool.");

            const payload = {
                owner_id: user.id,
                title: g.title,
                settings: { ...g, adminPasscode: adminToken },
                board_data: b
            };

            const { data, error } = await supabase
                .from('contests')
                .insert([payload])
                .select('id')
                .single();

            if (error) throw error;

            const poolId = data.id;
            setActivePoolId(poolId);
            return poolId;
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }, [game, board]);

    // Update existing pool in Supabase
    const updatePool = useCallback(async (
        poolId: string,
        adminToken: string, // Unused in RLS if we rely on auth session, but kept for signature
        data: { game: GameState; board: BoardData }
    ): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('contests')
                .update({
                    settings: data.game,
                    board_data: data.board,
                    updated_at: new Date().toISOString()
                })
                .eq('id', poolId);

            if (error) throw error;
            return true;
        } catch (err: any) {
            console.error("Update Pool Error:", err);
            setError(err.message);
            return false;
        }
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return {
        game,
        board,
        activePoolId,
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
        clearError
    };
}

export { INITIAL_GAME, EMPTY_BOARD };
export default usePoolData;
