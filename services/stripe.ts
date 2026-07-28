import { withRetry } from '../utils/retry';
import { supabase } from './supabase';

/**
 * Tries to unlock a board using the organizer's season-pass allowance
 * (granted by a prior purchase). Returns needsPayment when the allowance is
 * used up (or none exists) so the caller can fall back to Stripe checkout.
 */
export const activateWithEntitlement = async (
    contestId: string,
    accessToken: string
): Promise<{ activated: boolean; needsPayment?: boolean }> => {
    const res = await fetch('/api/pools/activate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ contestId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.activated) return { activated: true };
    if (res.status === 402) return { activated: false, needsPayment: true };
    throw new Error(data.error || `Activation failed (status ${res.status})`);
};

export const createCheckoutSession = async (contestId: string): Promise<void> => {
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Sign in before checkout.');
        const response = await withRetry(
            () => fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ contestId }),
            }),
            {
                retries: 2,
                shouldRetry: (error) => {
                    if (!(error instanceof Error)) return false;
                    const msg = error.message.toLowerCase();
                    return msg.includes('network') || msg.includes('timeout');
                },
            }
        );

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Non-JSON response:', text);
            throw new Error(`Server returned invalid format (Status ${response.status}). Check console.`);
        }

        if (!response.ok) {
            // Detailed error from backend
            throw new Error(data.error || `Error ${response.status}: ${JSON.stringify(data)}`);
        }

        if (data.alreadyEntitled && data.activated) {
            window.location.href = `/?poolId=${encodeURIComponent(contestId)}&forceAdmin=true`;
        } else if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error('No checkout URL returned from server');
        }
    } catch (error: any) {
        console.error('Checkout Error:', error);
        throw error;
    }
};
