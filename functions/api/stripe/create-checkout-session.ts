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
      return Response.json({
        code: 'SEASON_PASS_ALREADY_ACTIVE',
        error: 'You already have the 2026 season pass. Use it to unlock this board without another payment.',
      }, { status: 409 });
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
      httpClient: Stripe.createFetchHttpClient(),
    });
    const price = await stripe.prices.retrieve(env.STRIPE_2026_PRICE_ID);
    if (!price.active || price.type !== 'one_time' || price.unit_amount !== 499 || price.currency !== 'usd') {
      return Response.json({ error: 'The launch price is not configured as the $4.99 one-time 2026 pass.' }, { status: 503 });
    }

    const { data: existingOrders, error: ordersError } = await admin
      .from('checkout_orders')
      .select('id, contest_id, status, stripe_checkout_session_id, created_at')
      .eq('owner_id', authData.user.id)
      .eq('season_year', 2026)
      .in('status', ['pending', 'checkout_created', 'awaiting_payment'])
      .order('created_at', { ascending: false })
      .limit(100);
    if (ordersError) throw ordersError;
    const openOrders = Array.isArray(existingOrders) ? existingOrders : [];
    if (openOrders.some(order => order.status === 'awaiting_payment')) {
      return Response.json({
        code: 'PAYMENT_PROCESSING',
        error: 'Your payment is still processing. We will unlock the board as soon as Stripe confirms it.',
      }, { status: 409 });
    }

    let reusable: { orderId: string; sessionId: string; url: string } | null = null;
    for (const existingOrder of openOrders) {
      const sessionId = String(existingOrder.stripe_checkout_session_id || '');
      if (!sessionId) continue;
      const existingSession = await stripe.checkout.sessions.retrieve(sessionId);
      if (existingSession.status === 'open' && existingSession.url) {
        if (!reusable) {
          reusable = { orderId: existingOrder.id, sessionId, url: existingSession.url };
          continue;
        }
        await stripe.checkout.sessions.expire(sessionId);
      }
      const { error: expireError } = await admin.from('checkout_orders').update({
        status: 'expired',
        terminal_at: new Date().toISOString(),
        terminal_reason: reusable
          ? 'A newer checkout session replaced this session.'
          : 'Stripe Checkout is no longer open.',
        updated_at: new Date().toISOString(),
      }).eq('id', existingOrder.id);
      if (expireError) throw expireError;
    }
    const { data: claimData, error: claimError } = await admin.rpc('gridone_claim_checkout_order', {
      p_owner_id: authData.user.id,
      p_contest_id: contest.id,
      p_season_year: 2026,
      p_price_id: price.id,
      p_price_cents: price.unit_amount,
      p_currency: price.currency,
    });
    if (claimError) throw claimError;
    const claim = Array.isArray(claimData) ? claimData[0] : claimData;
    if (claim?.already_entitled) {
      if (reusable) {
        await stripe.checkout.sessions.expire(reusable.sessionId);
        const { error: expireError } = await admin.from('checkout_orders').update({
          status: 'expired',
          terminal_at: new Date().toISOString(),
          terminal_reason: 'The owner already has an active season pass.',
          updated_at: new Date().toISOString(),
        }).eq('id', reusable.orderId);
        if (expireError) throw expireError;
      }
      return Response.json({
        code: 'SEASON_PASS_ALREADY_ACTIVE',
        error: 'You already have the 2026 season pass. Use it to unlock this board without another payment.',
      }, { status: 409 });
    }
    if (claim?.order_status === 'awaiting_payment') {
      return Response.json({
        code: 'PAYMENT_PROCESSING',
        error: 'Your payment is still processing. We will unlock the board as soon as Stripe confirms it.',
      }, { status: 409 });
    }
    if (!claim?.order_id) throw new Error('Unable to claim a checkout order.');
    if (reusable) {
      return Response.json({ url: reusable.url, orderId: reusable.orderId });
    }

    const site = new URL(env.PUBLIC_SITE_URL || 'https://www.getgridone.com').origin;
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: claim.order_id,
      success_url: `${site}/paid?order=${claim.order_id}`,
      cancel_url: `${site}/?poolId=${contest.id}`,
      metadata: {
        order_id: claim.order_id,
        owner_id: authData.user.id,
        contest_id: contest.id,
        season: '2026',
      },
      payment_intent_data: {
        metadata: {
          order_id: claim.order_id,
          owner_id: authData.user.id,
          season: '2026',
        },
      },
      expires_at: expiresAt,
    }, { idempotencyKey: claim.order_id });

    const { error: attachError } = await admin.rpc('gridone_attach_checkout_session', {
      p_order_id: claim.order_id,
      p_session_id: session.id,
      p_expires_at: new Date(expiresAt * 1000).toISOString(),
    });
    if (attachError) throw attachError;
    return Response.json({ url: session.url, orderId: claim.order_id });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Unable to start checkout.' }, { status: 500 });
  }
};
