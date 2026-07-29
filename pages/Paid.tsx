import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageMetadata } from '../components/seo/PageMetadata';
import { supabase } from '../services/supabase';

const Paid: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [state, setState] = useState<
        'checking' | 'processing' | 'ready' | 'duplicate' | 'payment_review' | 'inactive' | 'payment_failed' | 'delayed' | 'error' | 'signin'
    >('checking');
    const [message, setMessage] = useState('Confirming payment and activating your board…');
    const [contestId, setContestId] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);
    const orderId = searchParams.get('order');

    useEffect(() => {
        if (!orderId) {
            setState('error');
            setMessage('This payment return link is missing its checkout order.');
            return;
        }
        let cancelled = false;
        let attempt = 0;
        let transientFailures = 0;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const check = async () => {
            try {
                const { data } = await supabase.auth.getSession();
                const token = data.session?.access_token;
                if (!token) {
                    if (!cancelled) {
                        setState('signin');
                        setMessage('Sign in with the organizer account used at checkout.');
                    }
                    return;
                }
                const response = await fetch(`/api/billing/status?order=${encodeURIComponent(orderId)}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: 'no-store',
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) {
                    const error = new Error(result.error || 'Unable to verify payment.');
                    (error as Error & { retryable?: boolean }).retryable = response.status === 429 || response.status >= 500;
                    throw error;
                }
                if (cancelled) return;
                transientFailures = 0;
                setContestId(result.contestId || null);
                if (result.orderStatus === 'duplicate_paid') {
                    setState('duplicate');
                    setMessage('A second payment was received, but it did not add another season pass or board allowance. It is marked for refund review.');
                    return;
                }
                if (result.orderStatus === 'awaiting_payment') {
                    setState('processing');
                    setMessage('Your payment is still processing. Do not start another checkout; GridOne will unlock the board after Stripe confirms it.');
                    return;
                }
                if (result.orderStatus === 'failed' || result.orderStatus === 'expired') {
                    setState('payment_failed');
                    setMessage(
                        result.orderStatus === 'failed'
                            ? 'The payment did not complete. No season pass was activated.'
                            : 'The checkout expired before payment completed. No season pass was activated.',
                    );
                    return;
                }
                if (result.orderStatus === 'refunded' || result.orderStatus === 'disputed') {
                    if (result.entitlementStatus === 'active') {
                        setState('payment_review');
                        setMessage(
                            result.orderStatus === 'refunded'
                                ? 'This payment was refunded. Your current season pass remains active.'
                                : 'This payment has a dispute under review. Your current season pass remains active.',
                        );
                    } else {
                        setState('inactive');
                        setMessage('This season pass is inactive. Previously published boards remain available, but a new pass is required to unlock another board.');
                    }
                    return;
                }
                if (result.activated) {
                    setState('ready');
                    setMessage('Payment confirmed. Your board is unlocked.');
                    return;
                }
                attempt += 1;
                if (attempt >= 10) {
                    setState('delayed');
                    setMessage('Stripe confirmed your return, but activation is still processing. Your payment is not lost.');
                    return;
                }
                timeout = setTimeout(check, 2000);
            } catch (error: any) {
                if (cancelled) return;
                transientFailures += 1;
                const retryable = error?.retryable !== false;
                if (retryable && transientFailures < 3) {
                    setMessage('The confirmation service is taking longer than expected. Retrying…');
                    timeout = setTimeout(check, 2000);
                    return;
                }
                setState('error');
                setMessage(error.message || 'Unable to verify payment.');
            }
        };
        check();
        return () => {
            cancelled = true;
            if (timeout) clearTimeout(timeout);
        };
    }, [orderId, retryKey]);

    const retry = () => {
        setContestId(null);
        setState('checking');
        setMessage('Confirming payment and activating your board…');
        setRetryKey(key => key + 1);
    };

    const paidReturnTo = orderId ? `/paid?order=${encodeURIComponent(orderId)}` : '/paid';
    const loginUrl = `/login?returnTo=${encodeURIComponent(paidReturnTo)}`;

    return (
        <main className="oa-root gdh-unavailable min-h-[100dvh]" aria-live="polite">
            <PageMetadata
                title="Checkout status | GridOne"
                description="Confirming your GridOne 2026 season-pass payment and board activation."
                path="/paid"
                noIndex
            />
            <p className="gdh-kicker">2026 season pass</p>
            <h1>
                {state === 'ready'
                    ? 'Board unlocked.'
                    : state === 'checking'
                        ? 'Finishing checkout.'
                        : state === 'processing'
                            ? 'Payment processing.'
                            : state === 'duplicate'
                                ? 'Refund review.'
                                : state === 'payment_review'
                                    ? 'Payment updated.'
                                : state === 'inactive'
                                    ? 'Season pass inactive.'
                                    : 'Activation needs attention.'}
            </h1>
            <p>{message}</p>
            {state === 'checking' && <span className="oa-data">Secure verification in progress</span>}
            {state === 'ready' && contestId && <Link className="oa-btn oa-btn-primary" to={`/boards/${contestId}`}>Open organizer view</Link>}
            {state === 'signin' && <Link className="oa-btn oa-btn-primary" to={loginUrl}>Sign in to continue</Link>}
            {(state === 'processing' || state === 'duplicate' || state === 'payment_review' || state === 'inactive' || state === 'payment_failed' || state === 'delayed' || state === 'error') && (
                <div className="flex flex-wrap justify-center gap-3">
                    {orderId && (state === 'processing' || state === 'delayed' || state === 'error') && (
                        <button type="button" className="oa-btn oa-btn-primary" onClick={retry}>Check again</button>
                    )}
                    <Link className="oa-btn oa-btn-ghost" to="/dashboard">Return to dashboard</Link>
                </div>
            )}
        </main>
    );
};

export default Paid;
