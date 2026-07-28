import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const required = ['STRIPE_SECRET_KEY', 'STRIPE_2026_PRICE_ID', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
    if (required.some((key) => !env[key])) {
      return Response.json({ error: 'Checkout is not configured.' }, { status: 503 });
    }
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return Response.json({ error: 'Sign in before checkout.' }, { status: 401 });
    const auth = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData } = await auth.auth.getUser(token);
    if (!authData.user) return Response.json({ error: 'Your session has expired.' }, { status: 401 });
    const { contestId } = await request.json() as { contestId?: string };
    if (!contestId) return Response.json({ error: 'Choose a board to unlock.' }, { status: 400 });

    const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: contest } = await admin
      .from('contests')
      .select('id, owner_id, season_year')
      .eq('id', contestId)
      .eq('owner_id', authData.user.id)
      .maybeSingle();
    if (!contest) return Response.json({ error: 'You do not own this board.' }, { status: 403 });

    const { data: entitlement } = await admin
      .from('season_entitlements')
      .select('id')
      .eq('owner_id', authData.user.id)
      .eq('season_year', 2026)
      .eq('status', 'active')
      .maybeSingle();
    if (entitlement) {
      const { data: activation, error } = await admin.rpc('gridone_activate_board', {
        p_contest_id: contest.id,
        p_owner_id: authData.user.id,
        p_season_year: 2026,
      });
      if (error) throw error;
      const result = activation?.[0];
      if (!result?.activated) return Response.json({ error: 'Your 20-board season allowance is used.' }, { status: 409 });
      return Response.json({ alreadyEntitled: true, activated: true, used: result.used, allowance: result.allowance });
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
      httpClient: Stripe.createFetchHttpClient(),
    });
    const price = await stripe.prices.retrieve(env.STRIPE_2026_PRICE_ID);
    if (!price.active || price.type !== 'one_time' || price.unit_amount !== 499 || price.currency !== 'usd') {
      return Response.json({ error: 'The launch price is not configured as the $4.99 one-time 2026 pass.' }, { status: 503 });
    }

    const { data: existingOrder } = await admin
      .from('checkout_orders')
      .select('id, stripe_checkout_session_id')
      .eq('owner_id', authData.user.id)
      .eq('contest_id', contest.id)
      .eq('season_year', 2026)
      .in('status', ['pending', 'checkout_created'])
      .maybeSingle();
    if (existingOrder?.stripe_checkout_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(existingOrder.stripe_checkout_session_id);
      if (existingSession.status === 'open' && existingSession.url) {
        return Response.json({ url: existingSession.url, orderId: existingOrder.id });
      }
      await admin.from('checkout_orders').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', existingOrder.id);
    }

    const order = existingOrder && !existingOrder.stripe_checkout_session_id
      ? existingOrder
      : (await admin
          .from('checkout_orders')
          .insert({
            owner_id: authData.user.id,
            contest_id: contest.id,
            season_year: 2026,
            price_id: price.id,
            price_cents: price.unit_amount,
            currency: price.currency,
          })
          .select('id')
          .single()).data;
    if (!order) throw new Error('Unable to create a checkout order.');

    const site = new URL(env.PUBLIC_SITE_URL || 'https://www.getgridone.com').origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: order.id,
      success_url: `${site}/paid?order=${order.id}`,
      cancel_url: `${site}/?poolId=${contest.id}`,
      metadata: {
        order_id: order.id,
        owner_id: authData.user.id,
        contest_id: contest.id,
        season: '2026',
      },
    }, { idempotencyKey: order.id });

    const { error: updateError } = await admin.from('checkout_orders').update({
      status: 'checkout_created',
      stripe_checkout_session_id: session.id,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    if (updateError) throw updateError;
    return Response.json({ url: session.url, orderId: order.id });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Unable to start checkout.' }, { status: 500 });
  }
};
