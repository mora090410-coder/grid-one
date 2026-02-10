import { useState } from 'react';
import { useAuth } from './useAuth';
import { usePoolData } from './usePoolData';
import { GameState, BoardData } from '../types';
import { useNavigate } from 'react-router-dom';
import { withRetry } from '../utils/retry';

interface UseBoardActionsProps {
    game: GameState;
    board: BoardData;
    activePoolId: string | null;
    API_URL: string;
    setAdminToken: (token: string) => void;
    setShowAdminView: (show: boolean) => void;
}

export const useBoardActions = ({
    game,
    board,
    activePoolId,
    API_URL,
    setAdminToken,
    setShowAdminView
}: UseBoardActionsProps) => {
    const auth = useAuth();
    const navigate = useNavigate();
    const { updatePool, publishPool } = usePoolData();
    const [isJoining, setIsJoining] = useState(false);

    // Helper to check if current user is owner
    // This is a basic check; real security relies on RLS
    // We assume if we have a user and an activePoolId, we might be the owner.
    // Ideally we would check 'owner_id' from the pool data, but for this hook we use the auth context.
    const currentUser = auth.user;

    const handlePublish = async (token: string, currentData?: { game: GameState, board: BoardData, adminEmail?: string }) => {
        try {
            const g = currentData?.game || game;
            const b = currentData?.board || board;

            // CASE 1: UPDATE EXISTING POOL
            if (activePoolId) {
                // Check if user is logged in (Assumption: If logged in and editing, they are the owner)
                // A stricter check would be comparing auth.user.id === pool.owner_id passed in props
                // For now, we rely on the `updatePool` RLS to fail if they aren't the owner.
                if (currentUser) {
                    const success = await updatePool(activePoolId, { game: g, board: b });
                    if (!success) throw new Error("Failed to save changes to Supabase");
                    console.log("Changes saved to Supabase successfully");
                    return activePoolId;
                }

                // If NOT Owner (Legacy Admin with Password) -> Use API Endpoint via Fetch
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 12000);
                const payload = {
                    game: { ...g, title: g.title || "SBXPRO Pool", coverImage: g.coverImage || "" },
                    board: b,
                    adminEmail: currentData?.adminEmail
                };
                const res = await withRetry(
                    () => fetch(`${API_URL}/${activePoolId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify(payload),
                        signal: controller.signal
                    }),
                    {
                        retries: 2,
                        shouldRetry: (error) => {
                            if (!(error instanceof Error)) return false;
                            const msg = error.message.toLowerCase();
                            return msg.includes('network') || msg.includes('timeout') || msg.includes('abort');
                        },
                    }
                );
                clearTimeout(timeoutId);

                if (!res.ok) {
                    if (res.status === 401 || res.status === 403) {
                        const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
                        if (activePoolId) delete storedTokens[activePoolId];
                        localStorage.setItem('sbxpro_tokens', JSON.stringify(storedTokens));
                        setAdminToken('');
                        setShowAdminView(false);
                        throw new Error('Unauthorized: Admin Password Incorrect or Expired.');
                    }
                    const errJson = await res.json().catch(() => ({}));
                    throw new Error(errJson.message || `Server Error: ${res.status}`);
                }
                await res.json();
                return activePoolId;
            }

            // CASE 2: CREATE NEW POOL
            else {
                // If Logged In -> Create via Supabase
                if (currentUser) {
                    const newId = await publishPool(token, { game: g, board: b });
                    if (!newId) throw new Error("Creation failed");

                    // Update URL
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('poolId', newId);
                    window.history.pushState({ poolId: newId }, '', newUrl.toString());

                    return newId;
                }

                // If Guest -> Save to LocalStorage and Redirect
                else {
                    console.log("Guest Creation detected. Saving to local storage and redirecting...");

                    const guestGameStr = JSON.stringify({ ...g, adminPasscode: token });
                    localStorage.setItem('sbxpro_guest_game', guestGameStr);
                    localStorage.setItem('sbxpro_guest_board', JSON.stringify(b));

                    navigate('/login?mode=signup');
                    return;
                }
            }
        } catch (err: any) {
            const msg = err.name === 'AbortError' ? "Server timeout. Cloudflare response was delayed." : (err.message || "Unknown Network Error");
            console.error("Publish Failed:", err);
            if (msg !== 'Redirecting...') {
                alert(`Publish Failed: ${msg}`);
            }
            throw err;
        }
    };

    const handleJoinSubmit = async (joinInput: string) => {
        if (!joinInput) return;
        const targetId = joinInput.trim().toUpperCase();
        setIsJoining(true);
        try {
            const res = await withRetry(
                () => fetch(`${API_URL}/${targetId}`),
                {
                    retries: 2,
                    shouldRetry: (error) => {
                        if (!(error instanceof Error)) return false;
                        const msg = error.message.toLowerCase();
                        return msg.includes('network') || msg.includes('timeout');
                    },
                }
            );
            if (!res.ok) throw new Error("League Code not found in stadium databases.");

            const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('poolId', targetId);

            if (storedTokens[targetId]) {
                setAdminToken(storedTokens[targetId]);
            }
            window.location.href = newUrl.toString();
        } catch (err: any) {
            alert(err.message || "Verification Failed");
        } finally {
            setIsJoining(false);
        }
    };

    return {
        handlePublish,
        handleJoinSubmit,
        isJoining
    };
};
