-- 1) Add new table: contest_entries
CREATE TABLE IF NOT EXISTS public.contest_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  cell_index int NOT NULL CHECK (cell_index >= 0 AND cell_index < 100),
  paid_status text NOT NULL DEFAULT 'unknown' CHECK (paid_status IN ('unknown', 'unpaid', 'paid')),
  notify_opt_in boolean NOT NULL DEFAULT false,
  contact_type text NULL CHECK (contact_type IN ('sms', 'email')),
  contact_value text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contest_entries_contest_id_cell_index_key UNIQUE (contest_id, cell_index)
);

-- 2) RLS: Enable RLS
ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Only allow the authenticated organizer to read/write entries for contests they own.
-- We check ownership by joining with the contests table.
CREATE POLICY "Organizer can manage entries" ON public.contest_entries
  FOR ALL
  USING (
    auth.uid() = (
      SELECT owner_id FROM public.contests WHERE id = contest_entries.contest_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT owner_id FROM public.contests WHERE id = contest_entries.contest_id
    )
  );

-- 3) Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contest_entries_modtime
    BEFORE UPDATE ON public.contest_entries
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 4) Add Stripe Activation Columns (Migration 2026-01-25)
ALTER TABLE public.contests 
ADD COLUMN IF NOT EXISTS is_activated boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS activated_at timestamptz,
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS activation_price_id text;

-- 4) Add Stripe Activation Columns (Migration 2026-01-25)
ALTER TABLE public.contests 
ADD COLUMN IF NOT EXISTS is_activated boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS activated_at timestamptz,
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS activation_price_id text;
