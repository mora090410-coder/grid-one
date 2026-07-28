import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response('Webhook is not configured.', { status: 503 });
  }
  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature.', { status: 400 });
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
    if (event.type !== 'checkout.session.completed') return new Response('Ignored.', { status: 200 });
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') return new Response('Payment is not complete.', { status: 400 });
    const orderId = session.metadata?.order_id;
    if (!orderId || session.client_reference_id !== orderId) return new Response('Invalid order metadata.', { status: 400 });

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
    if (lineItems.data.length !== 1) return new Response('Unexpected line items.', { status: 400 });
    const line = lineItems.data[0];
    const priceId = typeof line.price === 'string' ? line.price : line.price?.id;
    if (!priceId || priceId !== env.STRIPE_2026_PRICE_ID || line.amount_total !== 499 || line.currency !== 'usd') {
      return new Response('Checkout price mismatch.', { status: 400 });
    }

    const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin.rpc('gridone_fulfill_checkout', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_order_id: orderId,
      p_session_id: session.id,
      p_payment_intent_id: String(session.payment_intent || ''),
      p_customer_id: String(session.customer || ''),
      p_price_id: priceId,
      p_price_cents: line.amount_total,
      p_currency: line.currency,
    });
    if (error) throw error;
    return new Response('Fulfilled.', { status: 200 });
  } catch (error: any) {
    console.error('Stripe webhook failure', error);
    return new Response(error?.message || 'Webhook failure.', { status: 500 });
  }
};
