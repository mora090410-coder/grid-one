import { withRetry } from '../utils/retry';

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
    console.log('Stripe Service v2.1 init');
    try {
        // 1. Diagnostics: Check API Health
        try {
            const health = await withRetry(
                () => fetch('/api/health'),
                {
                    retries: 2,
                    shouldRetry: (error) => {
                        if (error instanceof Error) {
                            const msg = error.message.toLowerCase();
                            return msg.includes('network') || msg.includes('timeout');
                        }
                        return false;
                    },
                }
            );
            if (!health.ok) {
                console.error('Health check failed:', health.status);
                throw new Error('API Backend appears offline. Are you using "npm run local" or deploying?');
            }
        } catch (e) {
            console.error('Health check network error:', e);
            // Don't block flow, but warn
            console.warn('Skipping health check failure, attempting checkout anyway...');
        }

        // 2. Attempt Checkout
        const response = await withRetry(
            () => fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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

        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error('No checkout URL returned from server');
        }
    } catch (error: any) {
        console.error('Checkout Error:', error);
        alert(`Payment Error:\n${error.message}\n\n(Context: ${window.location.hostname})`);
    }
};
