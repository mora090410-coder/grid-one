/**
 * useAuth Hook Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../hooks/useAuth';

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useAuth', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        localStorageMock.clear();
    });

    it('should initialize with null adminToken', () => {
        const { result } = renderHook(() => useAuth());

        expect(result.current.adminToken).toBeNull();
        expect(result.current.isAdmin).toBe(false);
        expect(result.current.isLoggingIn).toBe(false);
        expect(result.current.authError).toBeNull();
    });

    it('should load adminToken from localStorage', () => {
        localStorageMock.setItem('sbx_adminToken', 'stored-token');

        const { result } = renderHook(() => useAuth());

        expect(result.current.adminToken).toBe('stored-token');
        expect(result.current.isAdmin).toBe(true);
    });

    it('should set adminToken and save to localStorage', () => {
        const { result } = renderHook(() => useAuth());

        act(() => {
            result.current.setAdminToken('new-token');
        });

        expect(result.current.adminToken).toBe('new-token');
        expect(localStorageMock.getItem('sbx_adminToken')).toBe('new-token');
    });

    it('should clear adminToken on logout', () => {
        localStorageMock.setItem('sbx_adminToken', 'stored-token');
        const { result } = renderHook(() => useAuth());

        act(() => {
            result.current.logout();
        });

        expect(result.current.adminToken).toBeNull();
        expect(localStorageMock.getItem('sbx_adminToken')).toBeNull();
    });

    it('should handle login success', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ success: true, poolId: 'ABC123' })
        });

        const { result } = renderHook(() => useAuth());

        let loginResult: any;
        await act(async () => {
            loginResult = await result.current.login('Test League', 'password123');
        });

        expect(loginResult.success).toBe(true);
        expect(loginResult.poolId).toBe('ABC123');
    });

    it('should handle login failure', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            json: () => Promise.resolve({ message: 'Invalid credentials' })
        });

        const { result } = renderHook(() => useAuth());

        let loginResult: any;
        await act(async () => {
            loginResult = await result.current.login('Test League', 'wrongpass');
        });

        expect(loginResult.success).toBe(false);
        expect(loginResult.error).toBe('Invalid credentials');
        expect(result.current.authError).toBe('Invalid credentials');
    });

    it('should clear auth error', () => {
        const { result } = renderHook(() => useAuth());

        act(() => {
            result.current.clearAuthError();
        });

        expect(result.current.authError).toBeNull();
    });
});
