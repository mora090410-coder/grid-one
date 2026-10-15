-- Install with paid checkout disabled; deploy matching API before reopening it.
-- v2 orders remain fulfillable. Old claim callers are deliberately blocked: they
-- cannot safely quote credit-aware orders. Never apply to production from CI.
ALTER TABLE public.checkout_orders
  ADD COLUMN billing_version smallint NOT NULL DEFAULT 2 CHECK (billing_version IN (2,3)),
  ADD COLUMN credit_source_order_id uuid REFERENCES public.checkout_orders(id) ON DELETE RESTRICT,
  ADD COLUMN credit_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN credit_consumed_at timestamptz,
  ADD CONSTRAINT checkout_credit_policy CHECK (
    (credit_cents = 0 AND credit_source_order_id IS NULL AND credit_consumed_at IS NULL)
    OR (billing_version = 3 AND target_tier = 'org' AND credit_cents = 999
      AND credit_source_order_id IS NOT NULL AND price_cents = 6901 AND currency = 'usd')
  );
CREATE UNIQUE INDEX checkout_credit_one_reservation ON public.checkout_orders(credit_source_order_id)
  WHERE credit_source_order_id IS NOT NULL AND
    (status IN ('pending','checkout_created','awaiting_payment') OR credit_consumed_at IS NOT NULL);

CREATE FUNCTION public.gridone_credit_source_valid(p_source uuid, p_owner uuid, p_season smallint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.checkout_orders o
    WHERE o.id=p_source AND o.owner_id=p_owner AND o.season_year=p_season
      AND o.target_tier='gameday' AND o.status='paid' AND o.price_cents=999 AND o.currency='usd'
      AND o.amount_refunded_cents=0 AND o.paid_at IS NOT NULL
      AND nullif(o.stripe_payment_intent_id,'') IS NOT NULL
      AND nullif(o.stripe_checkout_session_id,'') IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.stripe_events e WHERE e.checkout_order_id=o.id AND e.outcome='fulfilled')
      AND NOT EXISTS (SELECT 1 FROM public.checkout_order_disputes d WHERE d.checkout_order_id=o.id AND d.status <> 'won')
  );
$$;
REVOKE ALL ON FUNCTION public.gridone_credit_source_valid(uuid,uuid,smallint) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.gridone_claim_checkout_order(
  p_owner_id uuid,p_contest_id uuid,p_season_year smallint,p_price_id text,p_price_cents integer,
  p_currency text,p_target_tier text,p_organization_display_name text DEFAULT NULL
) RETURNS TABLE(order_id uuid,order_status text,stripe_checkout_session_id text,entitlement_status text,already_entitled boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'CHECKOUT_API_VERSION_UNSUPPORTED: deploy credit-aware checkout API'; END;
$$;

CREATE FUNCTION public.gridone_claim_checkout_order_v3(
  p_owner_id uuid,p_contest_id uuid,p_season_year smallint,p_price_id text,p_price_cents integer,
  p_currency text,p_target_tier text,p_organization_display_name text DEFAULT NULL
) RETURNS TABLE(order_id uuid,order_status text,stripe_checkout_session_id text,entitlement_status text,
  already_entitled boolean,amount_cents integer,credit_cents integer,credit_source_order_id uuid,
  checkout_contest_id uuid,checkout_expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE e public.season_entitlements%ROWTYPE; o public.checkout_orders%ROWTYPE;
  source_id uuid; org_name text := nullif(regexp_replace(btrim(p_organization_display_name),'\s+',' ','g'),'');
BEGIN
  IF p_target_tier IS NULL OR p_target_tier NOT IN ('gameday','org') OR p_currency IS DISTINCT FROM 'usd'
    OR p_price_cents IS DISTINCT FROM (CASE p_target_tier WHEN 'org' THEN 7900 ELSE 999 END)
    OR nullif(btrim(p_price_id),'') IS NULL THEN RAISE EXCEPTION 'Invalid canonical checkout price'; END IF;
  IF p_target_tier='org' AND (org_name IS NULL OR char_length(org_name) NOT BETWEEN 2 AND 120)
    THEN RAISE EXCEPTION 'CHECKOUT_ORGANIZATION_NAME_REQUIRED'; END IF;
  IF p_target_tier='gameday' THEN org_name:=NULL; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_owner_id::text||':'||p_season_year::text,0));
  IF NOT EXISTS(SELECT 1 FROM public.contests c WHERE c.id=p_contest_id AND c.owner_id=p_owner_id AND c.season_year=p_season_year)
    THEN RAISE EXCEPTION 'Contest is not owned by this user for this season'; END IF;
  SELECT * INTO e FROM public.season_entitlements s WHERE s.owner_id=p_owner_id AND s.season_year=p_season_year FOR UPDATE;
  IF e.status='active' AND (e.tier='org' OR (e.tier='gameday' AND p_target_tier='gameday')) THEN
    RETURN QUERY SELECT NULL::uuid,NULL::text,NULL::text,e.status,true,0,0,NULL::uuid,NULL::uuid,NULL::timestamptz; RETURN;
  END IF;
  IF e.tier='org' AND p_target_tier='gameday' THEN RAISE EXCEPTION 'CHECKOUT_DOWNGRADE_NOT_ALLOWED'; END IF;
  -- A create response can be lost before session attachment. Stripe's default
  -- session lifetime is 24h; retain the idempotency reservation beyond that
  -- lifetime rather than freeing a potentially payable session prematurely.
  UPDATE public.checkout_orders q SET status='expired',terminal_at=now(),terminal_reason='unattached_checkout_reservation_expired'
    WHERE q.owner_id=p_owner_id AND q.season_year=p_season_year AND q.billing_version=3
      AND q.status='pending' AND q.stripe_checkout_session_id IS NULL AND q.stripe_expires_at<now();
  SELECT * INTO o FROM public.checkout_orders q WHERE q.owner_id=p_owner_id AND q.season_year=p_season_year
    AND q.status IN ('pending','checkout_created','awaiting_payment') FOR UPDATE;
  IF FOUND THEN
    IF o.billing_version<>3 OR o.target_tier IS DISTINCT FROM p_target_tier OR o.price_id<>p_price_id
      OR o.organization_display_name IS DISTINCT FROM org_name THEN RAISE EXCEPTION 'CHECKOUT_TARGET_CONFLICT'; END IF;
    IF o.credit_source_order_id IS NOT NULL AND NOT public.gridone_credit_source_valid(o.credit_source_order_id,p_owner_id,p_season_year)
      THEN RAISE EXCEPTION 'CHECKOUT_CREDIT_SOURCE_CHANGED'; END IF;
    RETURN QUERY SELECT o.id,o.status,o.stripe_checkout_session_id,e.status,false,o.price_cents,o.credit_cents,o.credit_source_order_id,o.contest_id,o.stripe_expires_at; RETURN;
  END IF;
  -- A tier/grant is never payment evidence. Credit follows the current verified
  -- source purchase, under the same lock as fulfillment/reversal/publication.
  IF p_target_tier='org' AND e.tier='gameday' AND e.status='active'
    AND public.gridone_credit_source_valid(e.source_checkout_order_id,p_owner_id,p_season_year)
    AND NOT EXISTS(SELECT 1 FROM public.checkout_orders q WHERE q.credit_source_order_id=e.source_checkout_order_id
      AND (q.credit_consumed_at IS NOT NULL OR q.status IN ('pending','checkout_created','awaiting_payment')))
    THEN source_id:=e.source_checkout_order_id; END IF;
  INSERT INTO public.checkout_orders(owner_id,contest_id,season_year,price_id,price_cents,currency,target_tier,
    organization_display_name,billing_version,credit_source_order_id,credit_cents,stripe_expires_at)
  VALUES(p_owner_id,p_contest_id,p_season_year,p_price_id,p_price_cents-CASE WHEN source_id IS NULL THEN 0 ELSE 999 END,
    'usd',p_target_tier,org_name,3,source_id,CASE WHEN source_id IS NULL THEN 0 ELSE 999 END,date_trunc('second',now())+interval '24 hours 5 minutes') RETURNING * INTO o;
  RETURN QUERY SELECT o.id,o.status,o.stripe_checkout_session_id,e.status,false,o.price_cents,o.credit_cents,o.credit_source_order_id,o.contest_id,o.stripe_expires_at;
END;
$$;
REVOKE ALL ON FUNCTION public.gridone_claim_checkout_order_v3(uuid,uuid,smallint,text,integer,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_claim_checkout_order_v3(uuid,uuid,smallint,text,integer,text,text,text) TO service_role;

-- Keep the proven fulfillment state machine private and wrap its entry point.
ALTER FUNCTION public.gridone_fulfill_checkout_v2(text,text,uuid,text,text,text,text,integer,text) RENAME TO gridone_fulfill_checkout_internal;
REVOKE ALL ON FUNCTION public.gridone_fulfill_checkout_internal(text,text,uuid,text,text,text,text,integer,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.gridone_fulfill_checkout_v2(
  p_event_id text,p_event_type text,p_order_id uuid,p_session_id text,p_payment_intent_id text,p_customer_id text,
  p_price_id text,p_price_cents integer,p_currency text
) RETURNS TABLE(outcome text,contest_id uuid,owner_id uuid,season_year smallint,entitlement_id uuid,
  activated boolean,used integer,allowance integer,refundable boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.checkout_orders%ROWTYPE; result record;
BEGIN
  SELECT * INTO o FROM public.checkout_orders q WHERE q.id=p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout order not found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(o.owner_id::text||':'||o.season_year::text,0));
  SELECT * INTO o FROM public.checkout_orders q WHERE q.id=p_order_id FOR UPDATE;
  IF o.price_id IS DISTINCT FROM p_price_id OR o.price_cents IS DISTINCT FROM p_price_cents OR o.currency IS DISTINCT FROM p_currency
    OR nullif(p_payment_intent_id,'') IS NULL OR nullif(p_session_id,'') IS NULL
    OR (o.stripe_payment_intent_id IS NOT NULL AND o.stripe_payment_intent_id<>p_payment_intent_id)
    OR (o.stripe_checkout_session_id IS NOT NULL AND o.stripe_checkout_session_id<>p_session_id)
    THEN RAISE EXCEPTION 'Checkout price or session does not match the order'; END IF;
  IF o.credit_source_order_id IS NOT NULL AND o.status NOT IN ('paid','refunded','disputed','duplicate_paid') AND (
    NOT public.gridone_credit_source_valid(o.credit_source_order_id,o.owner_id,o.season_year)
    OR EXISTS(SELECT 1 FROM public.checkout_orders q WHERE q.id<>o.id AND q.credit_source_order_id=o.credit_source_order_id
      AND (q.credit_consumed_at IS NOT NULL OR q.status IN ('pending','checkout_created','awaiting_payment')))
  ) THEN
    UPDATE public.checkout_orders SET status='duplicate_paid',stripe_payment_intent_id=p_payment_intent_id,
      stripe_checkout_session_id=p_session_id,paid_at=now(),refundable_at=now(),terminal_at=now(),
      terminal_reason='credit_source_invalid_or_reserved',updated_at=now() WHERE id=o.id;
  END IF;
  SELECT * INTO result FROM public.gridone_fulfill_checkout_internal(p_event_id,p_event_type,p_order_id,p_session_id,
    p_payment_intent_id,p_customer_id,p_price_id,p_price_cents,p_currency);
  IF result.outcome='fulfilled' AND o.credit_source_order_id IS NOT NULL THEN
    UPDATE public.checkout_orders SET credit_consumed_at=coalesce(credit_consumed_at,now()) WHERE id=o.id;
  END IF;
  RETURN QUERY SELECT result.outcome,result.contest_id,result.owner_id,result.season_year,result.entitlement_id,
    result.activated,result.used,result.allowance,result.refundable;
END;
$$;
REVOKE ALL ON FUNCTION public.gridone_fulfill_checkout_v2(text,text,uuid,text,text,text,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_fulfill_checkout_v2(text,text,uuid,text,text,text,text,integer,text) TO service_role;

-- Run dependency reconciliation AFTER the original reversal state machine,
-- including dispute restoration. Both payments must remain intact. Previously
-- shared boards, stable entitlement id and activation counts are never removed.
ALTER FUNCTION public.gridone_apply_entitlement_payment_event(text,text,text,text,text,text,text,integer,integer,boolean)
  RENAME TO gridone_apply_payment_event_internal;
REVOKE ALL ON FUNCTION public.gridone_apply_payment_event_internal(text,text,text,text,text,text,text,integer,integer,boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.gridone_apply_entitlement_payment_event(
  p_event_id text,p_event_type text,p_payment_intent_id text,p_charge_id text,p_dispute_id text DEFAULT NULL,
  p_dispute_status text DEFAULT NULL,p_reason text DEFAULT NULL,p_amount integer DEFAULT NULL,
  p_amount_refunded integer DEFAULT NULL,p_refunded boolean DEFAULT false
) RETURNS TABLE(outcome text,entitlement_status text,order_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result record; e public.season_entitlements%ROWTYPE; o public.checkout_orders%ROWTYPE; valid boolean;
BEGIN
  SELECT * INTO result FROM public.gridone_apply_payment_event_internal(p_event_id,p_event_type,p_payment_intent_id,
    p_charge_id,p_dispute_id,p_dispute_status,p_reason,p_amount,p_amount_refunded,p_refunded);
  SELECT s.* INTO e FROM public.season_entitlements s JOIN public.checkout_orders q ON q.id=result.order_id
    WHERE s.owner_id=q.owner_id AND s.season_year=q.season_year FOR UPDATE OF s;
  SELECT * INTO o FROM public.checkout_orders q WHERE q.id=e.source_checkout_order_id;
  IF o.credit_source_order_id IS NOT NULL THEN
    valid := public.gridone_credit_source_valid(o.credit_source_order_id,o.owner_id,o.season_year)
      AND o.status='paid' AND o.amount_refunded_cents=0
      AND NOT EXISTS(SELECT 1 FROM public.checkout_order_disputes d WHERE d.checkout_order_id=o.id AND d.status<>'won');
    IF NOT valid AND e.status='active' THEN
      UPDATE public.season_entitlements SET status='revoked',revoked_at=now(),revocation_reason='organization_credit_payment_invalid',
        revoked_by_event_id=p_event_id,updated_at=now() WHERE id=e.id;
    ELSIF valid AND e.status='revoked' AND e.revocation_reason='organization_credit_payment_invalid' THEN
      UPDATE public.season_entitlements SET status='active',revoked_at=NULL,revocation_reason=NULL,revoked_by_event_id=NULL,
        restored_at=now(),restored_by_event_id=p_event_id,updated_at=now() WHERE id=e.id;
    END IF;
    UPDATE public.entitlement_audit_events a SET next_status=s.status,
      details=a.details||jsonb_build_object('credit_dependency_checked',true)
      FROM public.season_entitlements s WHERE a.stripe_event_id=p_event_id AND s.id=e.id;
  END IF;
  RETURN QUERY SELECT result.outcome,(SELECT s.status FROM public.season_entitlements s WHERE s.id=e.id),result.order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.gridone_apply_entitlement_payment_event(text,text,text,text,text,text,text,integer,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gridone_apply_entitlement_payment_event(text,text,text,text,text,text,text,integer,integer,boolean) TO service_role;
