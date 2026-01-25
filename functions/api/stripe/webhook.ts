import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

type PagesFunction<T = any> = any;

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const stripe = new Stripe(context.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-12-15.clover',
        httpClient: Stripe.createFetchHttpClient(),
    });

    const signature = context.request.headers.get('stripe-signature');

    if (!signature) {
        return new Response('Missing signature', { status: 400 });
    }

    try {
        const body = await context.request.text();
        const event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            context.env.STRIPE_WEBHOOK_SECRET
        );

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const contestId = session.metadata?.contestId;

            if (contestId) {
                // Init Supabase Admin Client
                const supabase = createClient(
                    context.env.SUPABASE_URL,
                    context.env.SUPABASE_SERVICE_ROLE_KEY
                );

                // Update Contest
                const { error } = await supabase
                    .from('contests')
                    .update({
                        is_activated: true,
                        activated_at: new Date().toISOString(),
                        stripe_checkout_session_id: session.id,
                        stripe_payment_intent_id: session.payment_intent as string,
                        stripe_customer_id: session.customer as string,
                        activation_price_id: context.env.STRIPE_PRICE_ID, // Store which price ID unlocked it
                    })
                    .eq('id', contestId);

                if (error) {
                    console.error('Failed to update contest:', error);
                    return new Response('Database update failed', { status: 500 });
                }
            }
        }

        return new Response('OK', { status: 200 });

    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
};

interface Env {
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    STRIPE_PRICE_ID: string;
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
}
