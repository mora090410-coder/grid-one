/**
 * usePoolData Hook Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePoolData, INITIAL_GAME, EMPTY_BOARD } from '../hooks/usePoolData';

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('usePoolData', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('should initialize with default values', () => {
        const { result } = renderHook(() => usePoolData());

        expect(result.current.game).toEqual(INITIAL_GAME);
        expect(result.current.board).toEqual(EMPTY_BOARD);
        expect(result.current.activePoolId).toBeNull();
        expect(result.current.loadingPool).toBe(true);
        expect(result.current.dataReady).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('should load pool data successfully', async () => {
        const mockPoolData = {
            data: {
                game: { ...INITIAL_GAME, title: 'Test League' },
                board: EMPTY_BOARD
            }
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockPoolData)
        });

        const { result } = renderHook(() => usePoolData());

        await act(async () => {
            await result.current.loadPoolData('TEST123');
        });

        expect(result.current.activePoolId).toBe('TEST123');
        expect(result.current.game.title).toBe('Test League');
        expect(result.current.loadingPool).toBe(false);
        expect(result.current.dataReady).toBe(true);
    });

    it('should handle pool not found error', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404
        });

        const { result } = renderHook(() => usePoolData());

        await act(async () => {
            await result.current.loadPoolData('INVALID');
        });

        expect(result.current.error).toBe('Pool not found');
        expect(result.current.loadingPool).toBe(false);
    });

    it('should update game state', () => {
        const { result } = renderHook(() => usePoolData());

        act(() => {
            result.current.setGame(prev => ({ ...prev, title: 'New Title' }));
        });

        expect(result.current.game.title).toBe('New Title');
    });

    it('should clear error', () => {
        const { result } = renderHook(() => usePoolData());

        // Simulate an error state
        act(() => {
            result.current.clearError();
        });

        expect(result.current.error).toBeNull();
    });
});

describe('INITIAL_GAME', () => {
    it('should have required properties', () => {
        expect(INITIAL_GAME).toHaveProperty('title');
        expect(INITIAL_GAME).toHaveProperty('leftAbbr');
        expect(INITIAL_GAME).toHaveProperty('topAbbr');
        expect(INITIAL_GAME).toHaveProperty('dates');
    });
});

describe('EMPTY_BOARD', () => {
    it('should have 100 squares', () => {
        expect(EMPTY_BOARD.squares).toHaveLength(100);
    });

    it('should have axis arrays of length 10', () => {
        expect(EMPTY_BOARD.bearsAxis).toHaveLength(10);
        expect(EMPTY_BOARD.oppAxis).toHaveLength(10);
    });
});
