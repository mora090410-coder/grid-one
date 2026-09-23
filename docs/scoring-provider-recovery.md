# Independent NFL score recovery

ESPN remains the primary scheduled-game identity and score source. If a score fetch or validation fails, a configured API-Sports NFL feed can recover the same game. Only the date-batched cron uses the paid fallback, so viewer traffic cannot amplify paid requests. Viewer recovery retains ESPN while reading canonical scores from either provider. No database migration is required.

## Activation prerequisite

API-Sports NFL needs an account and a server-only `API_SPORTS_KEY`. Do not use a `VITE_` prefix, put it in browser code, commit it, or paste it into chat. Configure the key through the Cloudflare Pages production secret settings for `grid-one`, then deploy a revision containing this integration. Keep preview credentials separate.

The official guide lists Pro at $15/month, 7,500 requests/day and games updated every 30 seconds. Verify plan, NFL season coverage, commercial usage permissions and the actual response before activation. A three-minute date-batched cron uses at most 480 requests per UTC date queried per day; this paid feed is never requested by viewer polling. The free 100/day plan is suitable for limited validation, not continuous live service.

Official reference: https://www.api-football.com/news/post/how-to-get-started-with-api-nfl-the-complete-beginners-guide

## Behavior and safeguards

- ESPN's existing event identity is retained. The alternate feed must contain exactly one NFL game with the board's exact home/away teams and kickoff timestamp. No fuzzy team matching or nearest-date substitution.
- Quarter scores must be complete for played periods and sum to the current total. Unsupported, postponed and cancelled states cannot confirm winners.
- The source name/provider recorded on each snapshot identifies the feed actually used.
- Failed requests are deduplicated within a cron tick. A 403 from the ESPN slate goes directly to the independent provider when configured; it does not repeat denied summaries for every board.
- Both-provider failure leaves the last accepted score intact. A completely failed scheduler tick returns 503 so the scheduler records the failure. No extra winner snapshot is created from an error.
- Manual authority, generation/lease ordering, milestone confirmation and OPEN outcomes still use the existing canonical database functions.
- API-Sports does not document a per-game last-update timestamp in its games response. HTTP response-age checks reject transport responses older than 30 seconds; persistence rejects observations older than 120 seconds, but cannot prove the underlying game data is current. `sourceObservedAt` describes retrieval observation, not a provider-certified scoring-event time. Validate a real live game before enabling this source; do not describe fixture tests as a feed latency guarantee.
- A stale/offline automatic final remains visibly degraded and keeps polling until a trusted fresh final arrives.

## Production acceptance

After account approval and secure key configuration, verify a real `/games` response for the selected current-season NFL matchup from Cloudflare. Compare team orientation, kickoff, cumulative and per-quarter totals, clock, halftime/final semantics and provider display. Observe two normal scheduler readings for quarter confirmation, without manually forcing winners or sending notifications. Verify a simulated provider outage in tests and actual recovery in production. Until those checks pass, the independent feed is prepared, not proven live.

Remove `API_SPORTS_KEY` to disable independent recovery; ESPN behavior remains available. Roll back the code revision if other behavior regresses. Existing recorded scores and audit history are not rewritten.
