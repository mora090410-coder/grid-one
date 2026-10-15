-- Harden the organizer API role.
--
-- Signed-in organizers legitimately insert a draft, update board_data while
-- the board is still a draft, delete an unshared draft, and read or write
-- their own contest_entries. Everything else on a contest (publish, share,
-- lock, status, activation, Stripe ids) is written by Pages Functions with
-- the service role. The previous table-level UPDATE let an organizer clear
-- published_at or status with their own JWT and then edit a locked board or
-- delete it to reclaim a plan allowance.
--
-- This migration does not change EXECUTE grants. Those are migration 035.

-- The touch trigger sets updated_at. Pin the path so a session search_path
-- cannot shadow now().
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- contest_entries: owner-only, evaluated once per statement, and only for
-- signed-in users. anon has no table grant. service_role bypasses row security.
DROP POLICY IF EXISTS "Organizer can manage entries" ON public.contest_entries;
CREATE POLICY "Organizer can manage entries"
  ON public.contest_entries
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.uid()) = (
      SELECT contests.owner_id
      FROM public.contests
      WHERE contests.id = contest_entries.contest_id
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = (
      SELECT contests.owner_id
      FROM public.contests
      WHERE contests.id = contest_entries.contest_id
    )
  );

-- Dashboard embeds board_activations(id) with the organizer JWT. Check the
-- contest the organizer can already read, so this policy does not need
-- SELECT on season_entitlements.
DROP POLICY IF EXISTS "Organizer can read own activations" ON public.board_activations;
CREATE POLICY "Organizer can read own activations"
  ON public.board_activations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.contests contest
      WHERE contest.id = board_activations.contest_id
        AND contest.owner_id = (SELECT auth.uid())
    )
  );

-- Draft create (functions/api/pools.ts) names exactly these columns.
-- score_test_mode stays insertable so a normal create can store false;
-- gridone_enforce_score_test_mode still rejects true unless the role is
-- service_role. Omitted columns keep their defaults, which means a client
-- insert cannot set status, published_at, shared_at, axis_locked_at,
-- is_activated, or the stripe_* columns.
REVOKE ALL ON TABLE public.contests FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.contests TO authenticated;
GRANT INSERT (
  owner_id,
  title,
  season_year,
  game_external_id,
  game_starts_at,
  side_team_name,
  side_team_abbr,
  top_team_name,
  top_team_abbr,
  side_axis,
  top_axis,
  payout_labels,
  payout_descriptions,
  settings,
  board_data,
  score_test_mode
) ON TABLE public.contests TO authenticated;
-- The board save that does not change the game updates only board_data,
-- with the organizer JWT (functions/api/pools/[id].ts). Published board_data
-- is still rejected by gridone_protect_published_board_data.
GRANT UPDATE (board_data) ON TABLE public.contests TO authenticated;

-- Private square notes are read and written from the organizer's browser.
REVOKE ALL ON TABLE public.contest_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contest_entries TO authenticated;

-- The dashboard embed. Writes stay with the service role.
REVOKE ALL ON TABLE public.board_activations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.board_activations TO authenticated;

-- Tables the browser does not query. Pages Functions use service_role.
-- Leaving SELECT here is what put them in the GraphQL schema for every
-- signed-in user. Row security already limited rows to the owner; revoking
-- the grant removes the table from that schema entirely.
REVOKE ALL ON TABLE
  public.checkout_orders,
  public.contest_audit_events,
  public.contest_participants,
  public.contest_score_state,
  public.contest_sellers,
  public.contest_square_edits,
  public.milestone_resolutions,
  public.notification_deliveries,
  public.notification_subscriptions,
  public.public_board_snapshots,
  public.score_snapshots,
  public.season_entitlements,
  public.square_assignment_private,
  public.square_assignments
FROM PUBLIC, anon, authenticated;

-- Service-only tables. Re-revoke in case a default privilege survived.
-- service_role is not in this list. client_events stays INSERT/SELECT for
-- service_role only, the way migration 033 left it.
REVOKE ALL ON TABLE
  public.checkout_order_disputes,
  public.client_events,
  public.entitlement_audit_events,
  public.family_board_access,
  public.guest_claim_groups,
  public.guest_invites,
  public.guest_rate_buckets,
  public.guest_square_claims,
  public.guest_square_holds,
  public.notification_send_log,
  public.pending_resolutions,
  public.scheduler_state,
  public.score_provider_payloads,
  public.score_refresh_leases,
  public.seller_links,
  public.stripe_events
FROM PUBLIC, anon, authenticated;

-- Foreign keys on paths that delete or join during a draft delete, a winner
-- lookup, a live-score refresh, or a notification send. The other unindexed
-- foreign keys are audit columns, user-delete columns, or empty guest tables.
CREATE INDEX IF NOT EXISTS square_assignments_participant_fk_idx
  ON public.square_assignments (participant_id);

CREATE INDEX IF NOT EXISTS milestone_resolutions_assignment_fk_idx
  ON public.milestone_resolutions (assignment_id);

CREATE INDEX IF NOT EXISTS milestone_resolutions_participant_fk_idx
  ON public.milestone_resolutions (participant_id);

CREATE INDEX IF NOT EXISTS milestone_resolutions_score_snapshot_fk_idx
  ON public.milestone_resolutions (score_snapshot_id);

CREATE INDEX IF NOT EXISTS notification_deliveries_subscription_fk_idx
  ON public.notification_deliveries (subscription_id);

CREATE INDEX IF NOT EXISTS notification_subscriptions_participant_fk_idx
  ON public.notification_subscriptions (participant_id);

CREATE INDEX IF NOT EXISTS contest_score_state_current_snapshot_fk_idx
  ON public.contest_score_state (current_snapshot_id);

CREATE INDEX IF NOT EXISTS contest_score_state_observed_snapshot_fk_idx
  ON public.contest_score_state (milestone_observed_snapshot_id);

CREATE INDEX IF NOT EXISTS pending_resolutions_first_snapshot_fk_idx
  ON public.pending_resolutions (first_snapshot_id);

CREATE INDEX IF NOT EXISTS pending_resolutions_latest_snapshot_fk_idx
  ON public.pending_resolutions (latest_snapshot_id);

CREATE INDEX IF NOT EXISTS checkout_orders_contest_fk_idx
  ON public.checkout_orders (contest_id);

CREATE INDEX IF NOT EXISTS stripe_events_checkout_order_fk_idx
  ON public.stripe_events (checkout_order_id);
