/**
 * useAuth Hook
 * Manages admin authentication state and verification
 */
import { useState, useCallback } from 'react';

const API_URL = `${window.location.origin}/api/pools`;

interface UseAuthReturn {
    adminToken: string | null;
    isAdmin: boolean;
    isLoggingIn: boolean;
    authError: string | null;
    setAdminToken: (token: string | null) => void;
    verifyToken: (poolId: string, token: string) => Promise<boolean>;
    login: (leagueName: string, password: string) => Promise<{ success: boolean; poolId?: string; error?: string }>;
    logout: () => void;
    clearAuthError: () => void;
}

export function useAuth(): UseAuthReturn {
    const [adminToken, setAdminTokenState] = useState<string | null>(() => {
        return localStorage.getItem('sbx_adminToken');
    });
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const isAdmin = !!adminToken;

    const setAdminToken = useCallback((token: string | null) => {
        if (token) {
            localStorage.setItem('sbx_adminToken', token);
        } else {
            localStorage.removeItem('sbx_adminToken');
        }
        setAdminTokenState(token);
    }, []);

    // Verify token against server
    const verifyToken = useCallback(async (poolId: string, token: string): Promise<boolean> => {
        try {
            const res = await fetch(`${API_URL}/${poolId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                return false;
            }

            const data = await res.json();
            return data.success === true;
        } catch {
            return false;
        }
    }, []);

    // Login with league name and password
    const login = useCallback(async (
        leagueName: string,
        password: string
    ): Promise<{ success: boolean; poolId?: string; error?: string }> => {
        setIsLoggingIn(true);
        setAuthError(null);

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leagueName, password })
            });

            const data = await res.json();

            if (!res.ok) {
                setAuthError(data.message || data.error || 'Login failed');
                return { success: false, error: data.message || data.error };
            }

            if (data.success && data.poolId) {
                setAdminToken(password);
                return { success: true, poolId: data.poolId };
            }

            return { success: false, error: 'Unexpected response' };
        } catch (err: any) {
            const msg = err.message || 'Login failed';
            setAuthError(msg);
            return { success: false, error: msg };
        } finally {
            setIsLoggingIn(false);
        }
    }, [setAdminToken]);

    const logout = useCallback(() => {
        setAdminToken(null);
        localStorage.removeItem('sbx_adminToken');
        localStorage.removeItem('sbx_poolId');
    }, [setAdminToken]);

    const clearAuthError = useCallback(() => setAuthError(null), []);

    return {
        adminToken,
        isAdmin,
        isLoggingIn,
        authError,
        setAdminToken,
        verifyToken,
        login,
        logout,
        clearAuthError
    };
}

export default useAuth;
