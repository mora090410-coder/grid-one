-- Season-pass entitlements: one $4.99 payment grants an organizer up to
-- 20 board activations for the 2026 season instead of paying per board.
CREATE TABLE IF NOT EXISTS public.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  boards_allowance int NOT NULL DEFAULT 20,
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  price_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entitlements_owner_id_idx ON public.entitlements (owner_id);

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

-- Owners can see their own entitlements; all writes go through the
-- service-role client in the Stripe webhook (bypasses RLS).
CREATE POLICY "Owner can read own entitlements" ON public.entitlements
  FOR SELECT
  USING (auth.uid() = owner_id);
