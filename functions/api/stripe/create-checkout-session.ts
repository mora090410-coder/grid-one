import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import {
  configuredPriceForTier,
  nextUpgradeTier,
  paidTierFromRequest,
  type PricingTier,
} from '../../_lib/pricingTiers';

type PagesFunction = (context: any) => Promise<Response> | Response;

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const required = ['STRIPE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
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
    const {
      contestId,
      tier: requestedTierValue,
      organizationName: organizationNameValue,
    } = await request.json() as {
      contestId?: string;
      tier?: unknown;
      organizationName?: unknown;
    };
    if (!contestId) return Response.json({ error: 'Choose the draft you want to publish.' }, { status: 400 });
    const requestedTier = paidTierFromRequest(requestedTierValue);
    if (!requestedTier) {
      return Response.json({ error: 'Choose the plan offered for this publish limit.' }, { status: 400 });
    }
    const configuredPrice = configuredPriceForTier(requestedTier, env);
    if (!configuredPrice) {
      return Response.json({ error: `${requestedTier === 'org' ? 'Organization' : 'Game Day'} checkout is not configured.` }, { status: 503 });
    }
    const organizationName = typeof organizationNameValue === 'string'
      ? organizationNameValue.trim().replace(/\s+/g, ' ')
      : '';
    if (requestedTier === 'org' && (organizationName.length < 2 || organizationName.length > 120)) {
      return Response.json({ error: 'Enter the organization name to show on its boards and receipt.' }, { status: 400 });
    }

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

    const paidSignupEnabled = String(env.PAID_SIGNUP_ENABLED || '').toLowerCase() === 'true';
    const smokeContestIds = new Set(
      String(env.CHECKOUT_SMOKE_CONTEST_IDS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
    if (!paidSignupEnabled && !smokeContestIds.has(contest.id)) {
      return Response.json({
        code: 'PAID_SIGNUP_CLOSED',
        error: 'Paid signup is not open yet.',
      }, { status: 503 });
    }

    const { data: entitlement } = await admin
      .from('season_entitlements')
      .select('id, tier, status, boards_allowance')
      .eq('owner_id', authData.user.id)
      .eq('season_year', 2026)
      .maybeSingle();
    let used = 0;
    if (entitlement?.id) {
      const { count, error: countError } = await admin
        .from('board_activations')
        .select('id', { count: 'exact', head: true })
        .eq('entitlement_id', entitlement.id);
      if (countError) throw countError;
      used = Number(count || 0);
    }
    if (!entitlement) {
      return Response.json({
        code: 'FREE_BOARD_AVAILABLE',
        error: 'Publish your first board free before choosing a paid plan.',
      }, { status: 409 });
    }
    const currentTier = (entitlement.tier || 'legacy') as PricingTier;
    const currentAllowance = Number(entitlement.boards_allowance || 0);
    const expectedTier = entitlement.status === 'active'
      ? nextUpgradeTier(currentTier)
      : currentTier === 'org'
        ? 'org'
        : 'gameday';
    if (used < currentAllowance && entitlement.status === 'active') {
      return Response.json({
        code: 'ALLOWANCE_AVAILABLE',
        error: `Your current plan still has ${currentAllowance - used} board${currentAllowance - used === 1 ? '' : 's'} available.`,
        tier: currentTier,
        used,
        allowance: currentAllowance,
      }, { status: 409 });
    }
    if (!expectedTier) {
      return Response.json({
        code: 'ORGANIZATION_LIMIT_REACHED',
        error: 'Your Organization plan has reached its 50-board season limit.',
      }, { status: 409 });
    }
    if (requestedTier !== expectedTier) {
      return Response.json({
        code: 'WRONG_UPGRADE_TIER',
        error: `The next available plan is ${expectedTier === 'org' ? 'Organization' : 'Game Day'}.`,
        offeredTier: expectedTier,
      }, { status: 409 });
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
      httpClient: Stripe.createFetchHttpClient(),
    });
    const price = await stripe.prices.retrieve(configuredPrice.priceId);
    if (
      !price.active
      || price.type !== 'one_time'
      || price.unit_amount !== configuredPrice.amountCents
      || price.currency !== 'usd'
    ) {
      return Response.json({ error: `${configuredPrice.label} is not configured at its approved one-time price.` }, { status: 503 });
    }

    const { data: existingOrders, error: ordersError } = await admin
      .from('checkout_orders')
      .select('id, contest_id, status, price_id, stripe_checkout_session_id, created_at')
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
        error: 'Your payment is still processing. We will update your plan as soon as Stripe confirms it.',
      }, { status: 409 });
    }

    let reusable: { orderId: string; sessionId: string; url: string } | null = null;
    for (const existingOrder of openOrders) {
      const sessionId = String(existingOrder.stripe_checkout_session_id || '');
      if (!sessionId) continue;
      const existingSession = await stripe.checkout.sessions.retrieve(sessionId);
      if (
        existingOrder.price_id === price.id
        && existingSession.status === 'open'
        && existingSession.url
      ) {
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
      p_target_tier: requestedTier,
      p_organization_display_name: requestedTier === 'org' ? organizationName : null,
    });
    if (claimError) throw claimError;
    const claim = Array.isArray(claimData) ? claimData[0] : claimData;
    if (claim?.already_entitled) {
      if (reusable) {
        await stripe.checkout.sessions.expire(reusable.sessionId);
        const { error: expireError } = await admin.from('checkout_orders').update({
          status: 'expired',
          terminal_at: new Date().toISOString(),
          terminal_reason: 'The current plan already covers this publish.',
          updated_at: new Date().toISOString(),
        }).eq('id', reusable.orderId);
        if (expireError) throw expireError;
      }
      return Response.json({
        code: 'SEASON_PASS_ALREADY_ACTIVE',
        error: 'Your current plan already covers this publish. Return to the board and try again.',
      }, { status: 409 });
    }
    if (claim?.order_status === 'awaiting_payment') {
      return Response.json({
        code: 'PAYMENT_PROCESSING',
        error: 'Your payment is still processing. We will update your plan as soon as Stripe confirms it.',
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
        tier: requestedTier,
        ...(requestedTier === 'org' ? { organization_name: organizationName } : {}),
      },
      payment_intent_data: {
        description: requestedTier === 'org'
          ? `GridOne Organization — ${organizationName}`
          : 'GridOne Game Day — 2026 season',
        metadata: {
          order_id: claim.order_id,
          owner_id: authData.user.id,
          season: '2026',
          tier: requestedTier,
          ...(requestedTier === 'org' ? { organization_name: organizationName } : {}),
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
