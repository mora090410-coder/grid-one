import Stripe from 'stripe';

type PagesFunction<T = any> = any;

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        if (!context.env.STRIPE_SECRET_KEY) {
            console.error('Missing STRIPE_SECRET_KEY env var');
            return new Response(JSON.stringify({ error: 'Server configuration error: STRIPE_SECRET_KEY missing' }), { status: 500 });
        }

        const stripe = new Stripe(context.env.STRIPE_SECRET_KEY, {
            apiVersion: '2025-12-15.clover', // Updated to match installed types
            httpClient: Stripe.createFetchHttpClient(),
        });
        const { contestId } = await context.request.json() as { contestId: string };

        if (!contestId) {
            return new Response(JSON.stringify({ error: 'Missing contestId' }), { status: 400 });
        }

        if (!context.env.STRIPE_PRICE_ID) {
            console.error('Missing STRIPE_PRICE_ID env var');
            return new Response(JSON.stringify({ error: 'Server configuration error: STRIPE_PRICE_ID missing' }), { status: 500 });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: context.env.STRIPE_PRICE_ID,
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${context.env.PUBLIC_SITE_URL}/paid?contestId=${contestId}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${context.env.PUBLIC_SITE_URL}/?poolId=${contestId}`, // Redirect back to pool view or admin
            metadata: {
                contestId,
            },
            allow_promotion_codes: true,
        });

        return new Response(JSON.stringify({ url: session.url }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};

interface Env {
    STRIPE_SECRET_KEY: string;
    STRIPE_PRICE_ID: string;
    PUBLIC_SITE_URL: string;
}
