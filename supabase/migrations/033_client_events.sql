-- Client events: privacy-minimal product analytics written by POST /api/events.
-- The endpoint validates every event against the closed schema in
-- src/features/instrumentation/eventSchema.ts (enums and buckets only) before
-- inserting through the service role. This table deliberately has no IP,
-- user, user agent, board, URL or free-text columns. Browsers never read or
-- write it directly.
CREATE TABLE public.client_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (name ~ '^[a-z][a-z_]{0,63}$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND pg_column_size(payload) < 2048),
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;
-- Supabase default privileges grant new public tables to every API role; the
-- service role keeps only what the endpoint needs (append and read).
REVOKE ALL ON TABLE public.client_events FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT ON TABLE public.client_events TO service_role;
CREATE INDEX client_events_name_received_idx ON public.client_events(name, received_at);
