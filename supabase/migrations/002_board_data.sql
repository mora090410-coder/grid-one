-- 5) Add Password/Auth Columns to replace KV storage
ALTER TABLE public.contests 
ADD COLUMN IF NOT EXISTS password_hash text,
ADD COLUMN IF NOT EXISTS password_salt text,
ADD COLUMN IF NOT EXISTS is_activated boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS activated_at timestamptz,
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS activation_price_id text;
