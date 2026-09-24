import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    /**
     * True until the first sign-in check settles. Children render right away
     * (public pages paint without the Supabase chunk); anything that depends on
     * the user — route guards, redirects, signed-in/out labels — must wait on it.
     */
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// The auth client lives in its own chunk. Loading it here, not at module
// scope, keeps it off the homepage's critical path.
const loadSupabase = () => import('../services/supabase').then((module) => module.supabase);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Remove credentials left by the retired board-password flow.
        try {
            localStorage.removeItem('sbx_adminToken');
            localStorage.removeItem('sbx_poolId');
        } catch {
            // Blocked storage has nothing to clean up.
        }

        let active = true;
        let unsubscribe: (() => void) | null = null;

        void loadSupabase().then((supabase) => {
            if (!active) return;

            // Check active session
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (!active) return;
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
            }).catch(() => {
                if (active) setLoading(false);
            });

            // Listen for changes
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                if (!active) return;
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
            });
            unsubscribe = () => subscription.unsubscribe();
        }).catch(() => {
            // The auth chunk failed to load: public pages keep working signed out.
            if (active) setLoading(false);
        });

        return () => {
            active = false;
            unsubscribe?.();
        };
    }, []);

    const signOut = async () => {
        const supabase = await loadSupabase();
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ session, user, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
