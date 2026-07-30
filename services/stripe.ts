import { withRetry } from '../utils/retry';
import { supabase } from './supabase';

export const createCheckoutSession = async (
    contestId: string,
    tier: 'gameday' | 'org',
    organizationName?: string,
): Promise<void> => {
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
                body: JSON.stringify({
                    contestId,
                    tier,
                    ...(tier === 'org' ? { organizationName } : {}),
                }),
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

        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error('No checkout URL returned from server');
        }
    } catch (error: any) {
        console.error('Checkout Error:', error);
        throw error;
    }
};
