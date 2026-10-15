import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageMetadata } from '../components/seo/PageMetadata';
import { supabase } from '../services/supabase';
import { CapsuleButton, CapsuleTag, Eyebrow } from '../src/design/primitives';
import { SitePage } from '../src/features/site';
import { primaryLink, quietLink } from '../src/features/homepage/sections/cta';

const Paid: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [state, setState] = useState<
        'checking' | 'processing' | 'ready' | 'duplicate' | 'payment_review' | 'inactive' | 'payment_failed' | 'delayed' | 'error' | 'signin'
    >('checking');
    const [message, setMessage] = useState('Confirming your plan…');
    const [contestId, setContestId] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);
    const [receipt, setReceipt] = useState<{ organization: string | null; amount: number; credit: number; paidAt: string | null; season: number } | null>(null);
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
                if (result.paymentConfirmed && Number.isInteger(result.amountPaidCents)) {
                    setReceipt({ organization: result.orderOrganizationDisplayName || null, amount: result.amountPaidCents,
                        credit: result.creditCents || 0, paidAt: result.paidAt || null, season: result.seasonYear });
                }
                if (result.orderStatus === 'duplicate_paid') {
                    setState('duplicate');
                    setMessage('A second payment was received, but it did not add another plan or board allowance. It is marked for refund review.');
                    return;
                }
                if (result.orderStatus === 'awaiting_payment') {
                    setState('processing');
                    setMessage('Your payment is still processing. Do not start another checkout; GridOne will update your plan after Stripe confirms it.');
                    return;
                }
                if (result.orderStatus === 'failed' || result.orderStatus === 'expired') {
                    setState('payment_failed');
                    setMessage(
                        result.orderStatus === 'failed'
                            ? 'The payment did not complete. Your plan did not change.'
                            : 'The checkout expired before payment completed. Your plan did not change.',
                    );
                    return;
                }
                if (result.orderStatus === 'refunded' || result.orderStatus === 'disputed') {
                    if (result.entitlementStatus === 'active') {
                        setState('payment_review');
                        setMessage(
                            result.orderStatus === 'refunded'
                                ? 'This payment was refunded. Your current plan remains active.'
                                : 'This payment has a dispute under review. Your current plan remains active.',
                        );
                    } else {
                        setState('inactive');
                        setMessage('This plan is inactive. Previously published boards remain available; choose a plan again when you are ready to publish another.');
                    }
                    return;
                }
                if (result.paymentConfirmed && result.entitlementStatus === 'active') {
                    setState('ready');
                    setMessage('Payment confirmed. Return to your draft and publish when you are ready.');
                    return;
                }
                if (result.paymentConfirmed && result.entitlementStatus !== 'active') {
                    setState('inactive');
                    setMessage('Payment received, but the plan is inactive because a supporting payment was reversed or disputed. Previously shared boards remain available. Contact support before purchasing again.');
                    return;
                }
                attempt += 1;
                if (attempt >= 10) {
                    setState('delayed');
                    setMessage('Stripe confirmed your return, but the plan update is still processing. Your payment is not lost.');
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
        setReceipt(null);
        setState('checking');
        setMessage('Confirming your plan…');
        setRetryKey(key => key + 1);
    };

    const paidReturnTo = orderId ? `/paid?order=${encodeURIComponent(orderId)}` : '/paid';
    const loginUrl = `/login?returnTo=${encodeURIComponent(paidReturnTo)}`;

    return (
        <SitePage width="prose" withFooter={false} mainProps={{ 'aria-live': 'polite' }}>
            <PageMetadata
                title="Checkout status | GridOne"
                description="Confirming your GridOne 2026 plan payment."
                path="/paid"
                noIndex
            />
            <div className="flex flex-col gap-4">
                <Eyebrow>2026 plan</Eyebrow>
                <h1 className="font-display text-[40px] leading-[1.05] text-fg md:text-[52px]">
                    {state === 'ready'
                        ? 'Plan ready.'
                        : state === 'checking'
                            ? 'Finishing checkout.'
                            : state === 'processing'
                                ? 'Payment processing.'
                                : state === 'duplicate'
                                    ? 'Refund review.'
                                    : state === 'payment_review'
                                        ? 'Payment updated.'
                                    : state === 'inactive'
                                        ? 'Plan inactive.'
                                        : 'Checkout needs attention.'}
                </h1>
                <p className="font-ui text-[19px] leading-[1.5] text-fg-2">{message}</p>
                {receipt && <section aria-label="Payment receipt" className="flex flex-col gap-2 rounded-control border border-hairline p-4 font-ui text-fg">
                    <h2 className="text-lg font-semibold">GridOne payment receipt</h2>
                    {receipt.organization && <p>Organization: {receipt.organization}</p>}
                    <p>Season: {receipt.season}</p>
                    <p>Receipt: {orderId}</p>
                    {receipt.paidAt && <p>Paid: {new Date(receipt.paidAt).toLocaleDateString()}</p>}
                    {receipt.credit > 0 && <p>Game Day credit: ${(receipt.credit / 100).toFixed(2)}</p>}
                    <p>Amount paid: ${(receipt.amount / 100).toFixed(2)} USD</p>
                    <p>Software only. GridOne does not collect square money or pay winners.</p>
                </section>}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
                {state === 'checking' && <CapsuleTag>Secure verification in progress</CapsuleTag>}
                {state === 'ready' && contestId && <Link className={primaryLink} to={`/boards/${contestId}`}>Open organizer view</Link>}
                {state === 'ready' && !contestId && <Link className={primaryLink} to="/dashboard">Return to dashboard</Link>}
                {state === 'signin' && <Link className={primaryLink} to={loginUrl}>Sign in to continue</Link>}
                {(state === 'processing' || state === 'duplicate' || state === 'payment_review' || state === 'inactive' || state === 'payment_failed' || state === 'delayed' || state === 'error') && (
                    <>
                        {orderId && (state === 'processing' || state === 'delayed' || state === 'error') && (
                            <CapsuleButton variant="primary" onClick={retry}>Check again</CapsuleButton>
                        )}
                        <Link className={quietLink} to="/dashboard">Return to dashboard</Link>
                    </>
                )}
            </div>
        </SitePage>
    );
};

export default Paid;
