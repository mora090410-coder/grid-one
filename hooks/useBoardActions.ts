import { GameState, BoardData } from '../types';
import { useAuth } from './useAuth';

interface UseBoardActionsProps {
    game: GameState;
    board: BoardData;
    activePoolId: string | null;
    updatePool: (id: string, data: { game: GameState; board: BoardData }) => Promise<boolean>;
    publishPool: (data: { game: GameState; board: BoardData }) => Promise<string | void>;
}

export const useBoardActions = ({
    game,
    board,
    activePoolId,
    updatePool,
    publishPool,
}: UseBoardActionsProps) => {
    const { user } = useAuth();

    const handlePublish = async (
        currentData?: { game: GameState; board: BoardData },
    ) => {
        if (!user) throw new Error('Sign in with the organizer account before saving.');
        const data = {
            game: currentData?.game || game,
            board: currentData?.board || board,
        };
        if (activePoolId) {
            const saved = await updatePool(activePoolId, data);
            if (!saved) throw new Error('The board could not be saved.');
            return activePoolId;
        }
        const id = await publishPool(data);
        if (!id) throw new Error('The board could not be created.');
        return id;
    };

    return { handlePublish };
};
