import React, { createContext, useContext, useState, useEffect } from 'react';
import { GameState, BoardData } from '../types';

interface GuestContextType {
    guestBoard: {
        game: GameState;
        board: BoardData;
    } | null;
    setGuestBoard: (data: { game: GameState; board: BoardData } | null) => void;
    clearGuestBoard: () => void;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

const GUEST_STORAGE_KEY = 'gridone_guest_board';

export const GuestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [guestBoard, setGuestBoardState] = useState<{ game: GameState; board: BoardData } | null>(null);

    // Load from local storage on mount
    useEffect(() => {
        const stored = localStorage.getItem(GUEST_STORAGE_KEY);
        if (stored) {
            try {
                setGuestBoardState(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse guest board", e);
                localStorage.removeItem(GUEST_STORAGE_KEY);
            }
        }
    }, []);

    const setGuestBoard = (data: { game: GameState; board: BoardData } | null) => {
        setGuestBoardState(data);
        if (data) {
            localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
        } else {
            localStorage.removeItem(GUEST_STORAGE_KEY);
        }
    };

    const clearGuestBoard = () => {
        setGuestBoard(null);
    };

    return (
        <GuestContext.Provider value={{ guestBoard, setGuestBoard, clearGuestBoard }}>
            {children}
        </GuestContext.Provider>
    );
};

export const useGuest = () => {
    const context = useContext(GuestContext);
    if (!context) {
        throw new Error('useGuest must be used within a GuestProvider');
    }
    return context;
};
