-- GridOne 2026 launch schema.
--
-- This is a clean-rebuild migration. It replaces the public/private and
-- concurrency boundaries without mutating historical migration files.

DO $$
DECLARE
  contests_id_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO contests_id_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.contests'::regclass
    AND a.attname = 'id'
    AND NOT a.attisdropped;

  IF contests_id_type <> 'uuid' THEN
    RAISE EXCEPTION
      'GridOne canonical schema requires contests.id uuid; rebuild the test-only database before applying';
  END IF;
END
$$;

-- Remove the legacy policy that exposed settings, board documents, password
-- hashes, and Stripe identifiers to every anonymous request.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.contests;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.contests;
DROP POLICY IF EXISTS "Enable update for owners only" ON public.contests;
DROP POLICY IF EXISTS "Enable delete for owners only" ON public.contests;

ALTER TABLE public.contests
  DROP COLUMN IF EXISTS password_hash,
  DROP COLUMN IF EXISTS password_salt;

CREATE POLICY "Organizer can read owned contests"
  ON public.contests FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Organizer can create owned contests"
  ON public.contests FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Organizer can update owned contests"
  ON public.contests FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Organizer can delete owned draft contests"
  ON public.contests FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = owner_id
    AND status IN ('draft', 'reconciling', 'ready')
  );

CREATE OR REPLACE FUNCTION public.gridone_protect_locked_axes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.axis_locked_at IS NOT NULL
    AND (
      NEW.side_axis IS DISTINCT FROM OLD.side_axis
      OR NEW.top_axis IS DISTINCT FROM OLD.top_axis
      OR NEW.axis_locked_at IS DISTINCT FROM OLD.axis_locked_at
    )
  THEN
    RAISE EXCEPTION 'Published axis digits are locked';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_protect_locked_axes() FROM PUBLIC;

DROP TRIGGER IF EXISTS gridone_protect_locked_axes ON public.contests;
CREATE TRIGGER gridone_protect_locked_axes
  BEFORE UPDATE OF side_axis, top_axis, axis_locked_at ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.gridone_protect_locked_axes();

CREATE TABLE public.contest_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
  public_label text NOT NULL CHECK (char_length(btrim(public_label)) BETWEEN 1 AND 24),
  sort_order integer NOT NULL DEFAULT 0,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contest_participants_name_key UNIQUE (contest_id, display_name)
);

CREATE INDEX contest_participants_contest_idx
  ON public.contest_participants (contest_id, sort_order, display_name);

CREATE TABLE public.contest_sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  private_label text NOT NULL CHECK (char_length(btrim(private_label)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contest_sellers_label_key UNIQUE (contest_id, private_label)
);

CREATE TABLE public.square_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  cell_index smallint NOT NULL CHECK (cell_index BETWEEN 0 AND 99),
  participant_id uuid NOT NULL REFERENCES public.contest_participants(id) ON DELETE RESTRICT,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT square_assignments_cell_key UNIQUE (contest_id, cell_index)
);

CREATE INDEX square_assignments_participant_idx
  ON public.square_assignments (contest_id, participant_id);

CREATE TABLE public.square_assignment_private (
  assignment_id uuid PRIMARY KEY REFERENCES public.square_assignments(id) ON DELETE CASCADE,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES public.contest_sellers(id) ON DELETE SET NULL,
  payment_status text NOT NULL DEFAULT 'unknown'
    CHECK (payment_status IN ('unknown', 'unpaid', 'paid')),
  private_note text CHECK (char_length(private_note) <= 500),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX square_assignment_private_contest_idx
  ON public.square_assignment_private (contest_id, payment_status);

-- A viewer-safe, server-published read model for the narrow viewer API. It is
-- intentionally not granted to anon: direct PostgREST access would allow an
-- attacker to enumerate every published board. Realtime delivery should use a
-- server broadcast channel scoped by the unguessable share code.
CREATE TABLE public.public_board_snapshots (
  contest_id uuid PRIMARY KEY REFERENCES public.contests(id) ON DELETE CASCADE,
  share_code text NOT NULL UNIQUE
    CHECK (share_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'),
  revision bigint NOT NULL CHECK (revision > 0),
  board_title text NOT NULL,
  matchup jsonb NOT NULL CHECK (jsonb_typeof(matchup) = 'object'),
  board jsonb NOT NULL CHECK (jsonb_typeof(board) = 'object'),
  score jsonb CHECK (score IS NULL OR jsonb_typeof(score) = 'object'),
  winner_history jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(winner_history) = 'array'),
  payout_labels jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(payout_labels) = 'object'),
  published_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);

CREATE INDEX public_board_snapshots_share_lookup_idx
  ON public.public_board_snapshots (share_code)
  WHERE withdrawn_at IS NULL;

CREATE TABLE public.contest_score_state (
  contest_id uuid PRIMARY KEY REFERENCES public.contests(id) ON DELETE CASCADE,
  scoring_mode text NOT NULL DEFAULT 'automatic'
    CHECK (scoring_mode IN ('automatic', 'manual')),
  current_snapshot_id uuid,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  manual_mode_started_at timestamptz,
  manual_mode_started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  source_mode text NOT NULL CHECK (source_mode IN ('automatic', 'manual')),
  provider text NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 40),
  game_state text NOT NULL CHECK (game_state IN ('pre', 'in', 'post')),
  period smallint NOT NULL DEFAULT 0 CHECK (period BETWEEN 0 AND 5),
  side_score smallint NOT NULL CHECK (side_score BETWEEN 0 AND 255),
  top_score smallint NOT NULL CHECK (top_score BETWEEN 0 AND 255),
  quarter_scores jsonb NOT NULL CHECK (jsonb_typeof(quarter_scores) = 'object'),
  clock text CHECK (char_length(clock) <= 32),
  detail text CHECK (char_length(detail) <= 160),
  validation_status text NOT NULL
    CHECK (validation_status IN ('accepted', 'rejected')),
  rejection_reason text CHECK (char_length(rejection_reason) <= 500),
  source_name text CHECK (char_length(source_name) <= 120),
  source_url text CHECK (char_length(source_url) <= 2048),
  source_observed_at timestamptz,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  stale_after timestamptz NOT NULL,
  external_fingerprint text,
  is_current boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT score_snapshot_freshness_window CHECK (stale_after >= retrieved_at),
  CONSTRAINT score_snapshot_rejection_reason CHECK (
    validation_status = 'accepted' OR rejection_reason IS NOT NULL
  )
);

ALTER TABLE public.contest_score_state
  ADD CONSTRAINT contest_score_state_current_snapshot_fk
  FOREIGN KEY (current_snapshot_id)
  REFERENCES public.score_snapshots(id)
  ON DELETE SET NULL;

CREATE UNIQUE INDEX score_snapshots_current_key
  ON public.score_snapshots (contest_id)
  WHERE is_current;

CREATE UNIQUE INDEX score_snapshots_external_fingerprint_key
  ON public.score_snapshots (contest_id, external_fingerprint)
  WHERE external_fingerprint IS NOT NULL;

CREATE INDEX score_snapshots_contest_time_idx
  ON public.score_snapshots (contest_id, retrieved_at DESC);

CREATE TABLE public.score_provider_payloads (
  snapshot_id uuid PRIMARY KEY REFERENCES public.score_snapshots(id) ON DELETE CASCADE,
  raw_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.score_refresh_leases (
  contest_id uuid PRIMARY KEY REFERENCES public.contests(id) ON DELETE CASCADE,
  lease_token uuid NOT NULL DEFAULT gen_random_uuid(),
  locked_until timestamptz NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.milestone_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  milestone text NOT NULL CHECK (milestone IN ('Q1', 'Q2', 'Q3', 'FINAL')),
  score_snapshot_id uuid NOT NULL REFERENCES public.score_snapshots(id) ON DELETE RESTRICT,
  side_digit smallint NOT NULL CHECK (side_digit BETWEEN 0 AND 9),
  top_digit smallint NOT NULL CHECK (top_digit BETWEEN 0 AND 9),
  assignment_id uuid REFERENCES public.square_assignments(id) ON DELETE SET NULL,
  participant_id uuid REFERENCES public.contest_participants(id) ON DELETE SET NULL,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  corrected_at timestamptz,
  correction_reason text CHECK (char_length(correction_reason) <= 500),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  CONSTRAINT milestone_resolutions_key UNIQUE (contest_id, milestone)
);

CREATE TABLE public.notification_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.contest_participants(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 320),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'unsubscribed', 'bounced')),
  verification_token_hash text,
  unsubscribe_token_hash text NOT NULL,
  verification_sent_at timestamptz,
  verified_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX notification_subscriptions_identity_key
  ON public.notification_subscriptions (contest_id, participant_id, lower(email));

CREATE INDEX notification_subscriptions_verified_idx
  ON public.notification_subscriptions (contest_id, participant_id)
  WHERE status = 'verified';

CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id uuid NOT NULL REFERENCES public.milestone_resolutions(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.notification_subscriptions(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error text CHECK (char_length(last_error) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_attempted_at timestamptz,
  sent_at timestamptz,
  CONSTRAINT notification_deliveries_once_key UNIQUE (resolution_id, subscription_id)
);

CREATE TABLE public.season_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_year smallint NOT NULL DEFAULT 2026 CHECK (season_year BETWEEN 2026 AND 2100),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'revoked', 'refunded')),
  boards_allowance smallint NOT NULL DEFAULT 20 CHECK (boards_allowance BETWEEN 1 AND 100),
  price_cents integer NOT NULL DEFAULT 499 CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'usd' CHECK (currency ~ '^[a-z]{3}$'),
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text UNIQUE,
  stripe_customer_id text,
  stripe_price_id text,
  purchased_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT season_entitlements_owner_season_key UNIQUE (owner_id, season_year)
);

CREATE TABLE public.board_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id uuid NOT NULL REFERENCES public.season_entitlements(id) ON DELETE RESTRICT,
  contest_id uuid NOT NULL UNIQUE REFERENCES public.contests(id) ON DELETE CASCADE,
  activated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT board_activations_entitlement_contest_key UNIQUE (entitlement_id, contest_id)
);

CREATE TABLE public.contest_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 80),
  entity_type text CHECK (char_length(entity_type) <= 80),
  entity_id uuid,
  previous_revision bigint,
  next_revision bigint,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contest_audit_events_contest_time_idx
  ON public.contest_audit_events (contest_id, created_at DESC);

-- Shared optimistic-version trigger for normalized organizer records.
CREATE OR REPLACE FUNCTION public.gridone_touch_versioned_record()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_touch_versioned_record() FROM PUBLIC;

CREATE TRIGGER gridone_touch_participant
  BEFORE UPDATE ON public.contest_participants
  FOR EACH ROW EXECUTE FUNCTION public.gridone_touch_versioned_record();

CREATE TRIGGER gridone_touch_assignment
  BEFORE UPDATE ON public.square_assignments
  FOR EACH ROW EXECUTE FUNCTION public.gridone_touch_versioned_record();

CREATE OR REPLACE FUNCTION public.gridone_validate_assignment_contest()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.contest_participants p
    WHERE p.id = NEW.participant_id
      AND p.contest_id = NEW.contest_id
  ) THEN
    RAISE EXCEPTION 'Participant does not belong to the assignment contest';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_validate_assignment_contest() FROM PUBLIC;

CREATE TRIGGER gridone_validate_assignment_contest
  BEFORE INSERT OR UPDATE OF contest_id, participant_id ON public.square_assignments
  FOR EACH ROW EXECUTE FUNCTION public.gridone_validate_assignment_contest();

CREATE OR REPLACE FUNCTION public.gridone_validate_assignment_private()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.square_assignments a
    WHERE a.id = NEW.assignment_id
      AND a.contest_id = NEW.contest_id
  ) THEN
    RAISE EXCEPTION 'Private assignment metadata does not match its contest';
  END IF;

  IF NEW.seller_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.contest_sellers s
    WHERE s.id = NEW.seller_id
      AND s.contest_id = NEW.contest_id
  ) THEN
    RAISE EXCEPTION 'Seller does not belong to the assignment contest';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_validate_assignment_private() FROM PUBLIC;

CREATE TRIGGER gridone_validate_assignment_private
  BEFORE INSERT OR UPDATE OF assignment_id, contest_id, seller_id
  ON public.square_assignment_private
  FOR EACH ROW EXECUTE FUNCTION public.gridone_validate_assignment_private();

CREATE OR REPLACE FUNCTION public.gridone_validate_contest_children()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'public_board_snapshots' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = NEW.contest_id
        AND c.share_code = NEW.share_code
        AND c.published_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Public snapshot does not match a published contest';
    END IF;
  ELSIF TG_TABLE_NAME = 'contest_score_state' AND NEW.current_snapshot_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.score_snapshots s
      WHERE s.id = NEW.current_snapshot_id
        AND s.contest_id = NEW.contest_id
        AND s.validation_status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Current score snapshot does not belong to this contest';
    END IF;
  ELSIF TG_TABLE_NAME = 'milestone_resolutions' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.score_snapshots s
      WHERE s.id = NEW.score_snapshot_id
        AND s.contest_id = NEW.contest_id
        AND s.validation_status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Resolution score snapshot does not belong to this contest';
    END IF;

    IF NEW.assignment_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.square_assignments a
      WHERE a.id = NEW.assignment_id
        AND a.contest_id = NEW.contest_id
        AND (NEW.participant_id IS NULL OR a.participant_id = NEW.participant_id)
    ) THEN
      RAISE EXCEPTION 'Resolution assignment does not belong to this contest';
    END IF;
  ELSIF TG_TABLE_NAME = 'notification_subscriptions' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.contest_participants p
      WHERE p.id = NEW.participant_id
        AND p.contest_id = NEW.contest_id
    ) THEN
      RAISE EXCEPTION 'Notification identity does not belong to this contest';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_validate_contest_children() FROM PUBLIC;

CREATE TRIGGER gridone_validate_public_snapshot
  BEFORE INSERT OR UPDATE OF contest_id, share_code
  ON public.public_board_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.gridone_validate_contest_children();

CREATE TRIGGER gridone_validate_score_state
  BEFORE INSERT OR UPDATE OF contest_id, current_snapshot_id
  ON public.contest_score_state
  FOR EACH ROW EXECUTE FUNCTION public.gridone_validate_contest_children();

CREATE TRIGGER gridone_validate_resolution
  BEFORE INSERT OR UPDATE OF contest_id, score_snapshot_id, assignment_id, participant_id
  ON public.milestone_resolutions
  FOR EACH ROW EXECUTE FUNCTION public.gridone_validate_contest_children();

CREATE TRIGGER gridone_validate_notification_subscription
  BEFORE INSERT OR UPDATE OF contest_id, participant_id
  ON public.notification_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.gridone_validate_contest_children();

-- Atomic entitlement consumption. Service code must authenticate the caller and
-- pass that verified owner UUID; the row locks prevent two simultaneous board
-- activations from consuming the same final allowance.
CREATE OR REPLACE FUNCTION public.gridone_activate_board(
  p_contest_id uuid,
  p_owner_id uuid,
  p_season_year smallint DEFAULT 2026
)
RETURNS TABLE (activated boolean, used integer, allowance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  entitlement public.season_entitlements%ROWTYPE;
  used_count integer;
BEGIN
  SELECT *
    INTO entitlement
  FROM public.season_entitlements e
  WHERE e.owner_id = p_owner_id
    AND e.season_year = p_season_year
    AND e.status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.contests c
    WHERE c.id = p_contest_id
      AND c.owner_id = p_owner_id
      AND c.season_year = p_season_year
  ) THEN
    RAISE EXCEPTION 'Contest is not owned by the entitlement holder';
  END IF;

  SELECT count(*)::integer
    INTO used_count
  FROM public.board_activations ba
  WHERE ba.entitlement_id = entitlement.id;

  IF EXISTS (
    SELECT 1 FROM public.board_activations ba
    WHERE ba.contest_id = p_contest_id
  ) THEN
    RETURN QUERY SELECT true, used_count, entitlement.boards_allowance::integer;
    RETURN;
  END IF;

  IF used_count >= entitlement.boards_allowance THEN
    RETURN QUERY SELECT false, used_count, entitlement.boards_allowance::integer;
    RETURN;
  END IF;

  INSERT INTO public.board_activations (entitlement_id, contest_id)
  VALUES (entitlement.id, p_contest_id);

  RETURN QUERY
    SELECT true, used_count + 1, entitlement.boards_allowance::integer;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_activate_board(uuid, uuid, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gridone_activate_board(uuid, uuid, smallint) TO service_role;

-- Canonical-score promotion is serialized per board. Automatic results cannot
-- replace manual authority, rejected results cannot become current, and an
-- older retrieval can never replace a newer snapshot.
CREATE OR REPLACE FUNCTION public.gridone_promote_score_snapshot(
  p_contest_id uuid,
  p_snapshot_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  next_snapshot public.score_snapshots%ROWTYPE;
  current_snapshot public.score_snapshots%ROWTYPE;
  state_row public.contest_score_state%ROWTYPE;
BEGIN
  INSERT INTO public.contest_score_state (contest_id)
  VALUES (p_contest_id)
  ON CONFLICT (contest_id) DO NOTHING;

  SELECT * INTO state_row
  FROM public.contest_score_state
  WHERE contest_id = p_contest_id
  FOR UPDATE;

  SELECT * INTO next_snapshot
  FROM public.score_snapshots
  WHERE id = p_snapshot_id
    AND contest_id = p_contest_id;

  IF NOT FOUND OR next_snapshot.validation_status <> 'accepted' THEN
    RETURN false;
  END IF;

  IF state_row.scoring_mode = 'manual'
    AND next_snapshot.source_mode = 'automatic'
  THEN
    RETURN false;
  END IF;

  IF state_row.current_snapshot_id IS NOT NULL THEN
    SELECT * INTO current_snapshot
    FROM public.score_snapshots
    WHERE id = state_row.current_snapshot_id;

    IF current_snapshot.retrieved_at > next_snapshot.retrieved_at THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE public.score_snapshots
    SET is_current = false
  WHERE contest_id = p_contest_id
    AND is_current;

  UPDATE public.score_snapshots
    SET is_current = true
  WHERE id = p_snapshot_id;

  UPDATE public.contest_score_state
    SET current_snapshot_id = p_snapshot_id,
        revision = revision + 1,
        updated_at = now()
  WHERE contest_id = p_contest_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.gridone_promote_score_snapshot(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gridone_promote_score_snapshot(uuid, uuid) TO service_role;

-- RLS: authenticated organizers see only their own normalized records. The
-- viewer sees only public_board_snapshots. System-only tables have no client
-- policies and are reachable only with the service role.
ALTER TABLE public.contest_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_assignment_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_board_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_score_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_provider_payloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_refresh_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_audit_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.gridone_owns_contest(p_contest_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contests c
    WHERE c.id = p_contest_id
      AND c.owner_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.gridone_owns_contest(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gridone_owns_contest(uuid) TO authenticated;

CREATE POLICY "Organizer can read owned public snapshot"
  ON public.public_board_snapshots FOR SELECT
  TO authenticated
  USING (public.gridone_owns_contest(contest_id));

CREATE POLICY "Organizer can manage participants"
  ON public.contest_participants FOR ALL TO authenticated
  USING (public.gridone_owns_contest(contest_id))
  WITH CHECK (public.gridone_owns_contest(contest_id));

CREATE POLICY "Organizer can manage sellers"
  ON public.contest_sellers FOR ALL TO authenticated
  USING (public.gridone_owns_contest(contest_id))
  WITH CHECK (public.gridone_owns_contest(contest_id));

CREATE POLICY "Organizer can manage assignments"
  ON public.square_assignments FOR ALL TO authenticated
  USING (public.gridone_owns_contest(contest_id))
  WITH CHECK (public.gridone_owns_contest(contest_id));

CREATE POLICY "Organizer can manage assignment private data"
  ON public.square_assignment_private FOR ALL TO authenticated
  USING (public.gridone_owns_contest(contest_id))
  WITH CHECK (public.gridone_owns_contest(contest_id));

CREATE POLICY "Organizer can read score state"
  ON public.contest_score_state FOR SELECT TO authenticated
  USING (public.gridone_owns_contest(contest_id));

CREATE POLICY "Organizer can read accepted score snapshots"
  ON public.score_snapshots FOR SELECT TO authenticated
  USING (
    validation_status = 'accepted'
    AND public.gridone_owns_contest(contest_id)
  );

CREATE POLICY "Organizer can read milestone resolutions"
  ON public.milestone_resolutions FOR SELECT TO authenticated
  USING (public.gridone_owns_contest(contest_id));

CREATE POLICY "Organizer can read notification subscriptions"
  ON public.notification_subscriptions FOR SELECT TO authenticated
  USING (public.gridone_owns_contest(contest_id));

CREATE POLICY "Organizer can read notification deliveries"
  ON public.notification_deliveries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.milestone_resolutions r
      WHERE r.id = notification_deliveries.resolution_id
        AND public.gridone_owns_contest(r.contest_id)
    )
  );

CREATE POLICY "Organizer can read own season entitlement"
  ON public.season_entitlements FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Organizer can read own activations"
  ON public.board_activations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.season_entitlements e
      WHERE e.id = board_activations.entitlement_id
        AND e.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Organizer can read contest audit"
  ON public.contest_audit_events FOR SELECT TO authenticated
  USING (public.gridone_owns_contest(contest_id));

-- The old contest_entries table remains only so historical application code can
-- migrate cleanly. Its policy is owner-only; no viewer contact data is public.
ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;

-- Be explicit about API-role privileges. RLS still applies after these grants.
REVOKE ALL ON TABLE public.contests FROM anon;
REVOKE ALL ON TABLE public.contest_entries FROM anon;
REVOKE ALL ON TABLE public.contest_participants FROM anon;
REVOKE ALL ON TABLE public.contest_sellers FROM anon;
REVOKE ALL ON TABLE public.square_assignments FROM anon;
REVOKE ALL ON TABLE public.square_assignment_private FROM anon;
REVOKE ALL ON TABLE public.public_board_snapshots FROM anon;
REVOKE ALL ON TABLE public.contest_score_state FROM anon;
REVOKE ALL ON TABLE public.score_snapshots FROM anon;
REVOKE ALL ON TABLE public.score_provider_payloads FROM anon, authenticated;
REVOKE ALL ON TABLE public.score_refresh_leases FROM anon, authenticated;
REVOKE ALL ON TABLE public.milestone_resolutions FROM anon;
REVOKE ALL ON TABLE public.notification_subscriptions FROM anon;
REVOKE ALL ON TABLE public.notification_deliveries FROM anon;
REVOKE ALL ON TABLE public.season_entitlements FROM anon;
REVOKE ALL ON TABLE public.board_activations FROM anon;
REVOKE ALL ON TABLE public.contest_audit_events FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contest_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contest_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contest_sellers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.square_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.square_assignment_private TO authenticated;
GRANT SELECT ON TABLE public.public_board_snapshots TO authenticated;
GRANT SELECT ON TABLE public.contest_score_state TO authenticated;
GRANT SELECT ON TABLE public.score_snapshots TO authenticated;
GRANT SELECT ON TABLE public.milestone_resolutions TO authenticated;
GRANT SELECT ON TABLE public.notification_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.notification_deliveries TO authenticated;
GRANT SELECT ON TABLE public.season_entitlements TO authenticated;
GRANT SELECT ON TABLE public.board_activations TO authenticated;
GRANT SELECT ON TABLE public.contest_audit_events TO authenticated;

GRANT ALL ON TABLE
  public.contests,
  public.contest_entries,
  public.contest_participants,
  public.contest_sellers,
  public.square_assignments,
  public.square_assignment_private,
  public.public_board_snapshots,
  public.contest_score_state,
  public.score_snapshots,
  public.score_provider_payloads,
  public.score_refresh_leases,
  public.milestone_resolutions,
  public.notification_subscriptions,
  public.notification_deliveries,
  public.season_entitlements,
  public.board_activations,
  public.contest_audit_events
TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.contest_audit_events_id_seq TO service_role;
