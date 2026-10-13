# GridOne backend security review — 13 October 2026

This is a review of the production database as it stood on 13 October 2026, checked against the code on `main`. Nothing in this review was run against the production Supabase project. The fixes are in migration `036_organizer_column_and_grant_hardening.sql`. They are not applied to production until Anthony applies that file.

A signed-in organizer can already edit their own draft. The problems below are about doing that through the database API in ways the app does not offer: changing a locked or paid field, reading another person's board, or calling a function that was meant to stay on the server.

## What an outsider can do today

Someone who is not signed in cannot read the tables. The public board, family links (`/family#…`), and seller links (`/s/…`) go through the Cloudflare functions, which use the service role. There is no public view that skips row security. Anonymous visitors are not granted access to the tables.

Someone who is signed in can only see rows the policies allow. Those policies are "this row belongs to me." A second organizer cannot read or write the first organizer's contest, private square notes, checkout, or plan. The helper `gridone_owns_contest` only answers yes or no for the signed-in user. It does not return another person's board.

## Findings

### 1. An organizer can change server-only fields on their own board — High — fixed in this PR

The policy "Organizer can update owned contests" allows any column, as long as the row belongs to the signed-in user. The app itself only uses that path to save the draft grid (`board_data`). A person with their own login can ignore the app and call the database API directly.

What they could change:

- `published_at` and `status`. Clearing those on a board that was never shared makes the delete rule pass, so the board can be deleted and the plan allowance comes back. A free account could publish boards one at a time without paying.
- The same unpublish unlocks the grid again. Names can be changed after the numbers were locked. The axis digits themselves stay locked. The published-grid trigger only looks at `board_data`, and only while `published_at` is still set.
- `is_activated` and the old `stripe_*` columns on the contest. The plan is actually counted from `board_activations`, so this part is mostly cosmetic, but those columns were never meant to be client-writable.
- On create, the same login can try to insert a row that is already published. The create screen does not do this. The database allowed it.

Already blocked before this PR, and still blocked: changing `shared_at` (the share trigger refuses the signed-in role), changing `score_test_mode` after create, and changing axis digits after they are locked.

This PR leaves the signed-in role with insert on the columns the create screen sends, update on `board_data` only, select, and delete. Delete is still limited to an unshared, unpublished draft. The service role, which the Pages Functions use, can still set publish, share, status, and Stripe fields.

### 2. An organizer can rewrite who owns a square after publish — High — fixed in this PR

`square_assignments` and `contest_participants` allow the owner to insert, update, and delete. The browser never does that. Publish and the audited rename do it from the server. A direct update can point a square at a different person with no audit row and no change to the public grid. That is who the server would call the winner.

This PR removes insert, update, and delete on those tables, and on the private assignment notes, for the signed-in role. The rename function and the publish function still run as the database owner, so they keep working.

### 3. Signed-in users are granted writes on tables they can only read — Medium — fixed in this PR

`checkout_orders`, `season_entitlements`, `board_activations`, score tables, notification tables, and the public snapshot have a select policy and no insert or update policy. Row security already rejects the write. The table grant was still there. If a policy were ever loosened, the write would go through.

The browser does not write those tables. Billing, checkout, scores, and the public board are read by the Pages Functions with the service role. The dashboard does read `board_activations` directly, to show which boards have used a plan slot, so select stays on that one table. Writes on it are revoked.

This PR also revokes select on the tables the browser does not query. See the GraphQL note below.

### 4. Seventeen tables show up in GraphQL for every signed-in user — Medium — mostly fixed

GraphQL lists a table when the signed-in role can select it. Row security still hides other people's rows, so this was not a way to open someone else's board. It did mean any account could see that checkout, plans, private notes, and the public snapshot exist, and could read their own copy of those rows without going through the app.

After this PR, select remains only where the organizer app actually reads it:

- `contests` — the dashboard and the board screen
- `contest_entries` — private payment notes
- `board_activations` — the dashboard's "this board used a slot" embed

Those three stay in the GraphQL schema on purpose. The other fourteen are no longer selectable, so they drop out of that schema. There are no views in `public`.

### 5. The private-notes policy is wider and slower than it needs to be — Low — fixed in this PR

"Organizer can manage entries" applies to the `public` role, and it calls `auth.uid()` once per row. Anonymous users still cannot read the table, because they have no grant. The check is still "I own this contest." At today's size the extra work does not matter.

This PR limits the policy to signed-in users and uses `(select auth.uid())`, which Postgres evaluates once per statement.

### 6. `update_updated_at_column` has a changeable search path — Low — fixed in this PR

This trigger function sets `updated_at` on private square notes. It is not a privileged function. A search path that can be changed is a warning because a later object named `now` could be picked up. Signed-in users cannot create schemas here, so this is hard to abuse. The function now pins its search path to `pg_catalog, public`.

### 7. Ten privileged functions can be called without being the server — Medium — not this PR

Production still allows anonymous and signed-in callers to execute ten `SECURITY DEFINER` functions. The one that matters is the old score-lease function: with the public anon key and a board id, a caller can hold the lease and stop automatic score refresh for that board. `gridone_guest_emit` can only broadcast "please reload" on a board channel.

Pull request 16 already drops that old lease function and revokes these grants. This PR does not touch function grants, so the two migrations do not fight. The hole stays in production until 16 is merged and its migration is applied. A local Supabase reset of this branch still lets a signed-in user call the old lease and get a lock. The newer lease function refuses that same user.

`gridone_owns_contest` and the published-square rename stay callable by a signed-in organizer. Both check that the caller owns the board. Anonymous callers lose them in PR 16.

### 8. Leaked-password protection is off — Medium — not a code change

Supabase can refuse passwords that have shown up in public breaches. The toggle is off. It requires the Pro plan. Anthony turns it on in the dashboard after the project is on Pro: Authentication → Sign In / Providers → Email → Password security → enable leaked-password protection. This PR does not change auth settings.

### 9. Sixteen tables have row security and no policies — Low — left as-is

These are the family-link, seller-link, guest, Stripe event, scheduler, and similar tables. No policy means the signed-in and anonymous roles see nothing, which is what we want. The server role bypasses row security and is the only writer. Adding a policy would risk opening them. They stay service-only.

### 10. Thirty foreign keys have no index — Low — hot paths fixed, the rest left

Postgres uses an index on the referencing column when a parent row is deleted or when a join starts from that column. The tables are small today, so this is not a production incident. This PR adds indexes where a delete or a join actually happens on a busy path:

- square to participant (winner lookup, and deleting a name)
- milestone to assignment, participant, and score snapshot
- notification delivery to subscription, and subscription to participant
- current and observed score snapshot on the score-state row
- the two pending-resolution snapshot columns (live scoring)
- checkout order to contest (deleting a draft removes its checkout rows)
- Stripe event to checkout order

Left without a new index: audit "who did this" columns, `axis_locked_by`, guest-invite links (the guest flow is unused), and empty dispute tables. They can wait until those tables are large.

### 11. Four indexes have never been used — Low — not dropped

Production reported these as unused. They are not dropped. With almost no traffic, "unused" does not mean "useless."

- `contests_game_starts_at_idx` — which boards are in the live window
- `contest_entries_seller_label_idx` — seller name on private notes
- `notification_send_log_board_window_idx` — winner-email rate limit
- `guest_square_holds_expiry_idx` — old guest holds

### 12. There is no CI gate — Medium — workflow added, the block is Anthony's

`main` had no GitHub Actions workflow, so a pull request could merge with a broken typecheck or unit test. This PR adds `.github/workflows/ci.yml`. It runs on pull requests and on pushes to `main`. It runs `tsc`, unit tests, the production build, design lint, and the integration tests. The integration tests start a disposable Postgres in the runner and apply the migrations in the repo. The workflow has no secrets and does not talk to production.

GitHub will not block a merge until branch protection requires that check. That is a repository setting. Anthony has to turn it on. See below.

### 13. Deleting a draft also deletes its checkout row — Medium — not changed

`checkout_orders.contest_id` is `ON DELETE CASCADE`. Deleting a draft from the dashboard deletes the checkout record too, including one that was paid, if that ever happened. Changing that cascade is a decision about financial records, not a grant fix. It is left for Anthony. The new index only makes that delete cheaper. It does not change what gets deleted.

## What Anthony still has to do

1. **Apply the migration to production** after this pull request is accepted. The file is `supabase/migrations/036_organizer_column_and_grant_hardening.sql`. It was not applied from this review. Use the Supabase dashboard SQL editor, or `supabase db push` from a machine that is already linked to the GridOne project. Do not apply it from this agent. If pull request 16 is accepted as well, apply `035` first and then `036`. This migration does not depend on 035, so it is safe if 16 is still waiting.
2. **Turn on branch protection** so the new CI check can actually stop a merge:
   - Open `https://github.com/mora090410-coder/grid-one/settings/rules`
   - Click **New ruleset**, then **New branch ruleset**
   - Name it `Protect main`
   - Set enforcement to **Active**
   - Leave the bypass list empty if the check should apply to everyone, including admins
   - Under target branches, add a target and choose **Include default branch**
   - Enable **Require status checks to pass**
   - Click **Add checks** and choose `check`. After this workflow has run once it shows up as `CI / check`. It will not be in the list until that first run exists
   - Save
   - The older page at Settings → Branches → Add branch protection rule still works: branch name pattern `main`, enable **Require status checks to pass before merging**, and add the same check
3. **Turn on leaked-password protection** after the project is on the Pro plan. Dashboard path: Authentication → Sign In / Providers → Email → Password security. It cannot be enabled on the free plan, and it is not a migration.
4. **Apply pull request 16's migration** when that PR is accepted, so the old score-lease function is gone in production.
5. **Decide later** whether a deleted draft should keep its checkout row, and whether the four unused indexes should stay once there is real traffic.

## What was checked, and what was not

Confirmed from the production snapshot and from the migrations and the app code:

- The organizer update policy is owner-only and has no column list.
- The create and draft-save code use the signed-in user's token. Publish, share, checkout, scores, family links, and seller links use the service role.
- The browser reads `contests`, `contest_entries`, and the `board_activations` embed. It deletes unshared drafts. It does not update status, publish, or Stripe columns.
- No `public` views exist in the migrations.

Checked on a local Supabase database (`supabase db start`, then `supabase db reset --local --no-seed`). That database has the same default grants Supabase gives new tables and functions. Migration 036 applied. After it:

- A signed-in organizer can create a draft and save `board_data`. The save moved revision from 1 to 2.
- That same login cannot change status, `published_at`, `shared_at`, `is_activated`, Stripe columns, `axis_locked_at`, or `season_year`, and cannot insert an already-published row.
- That login cannot read or write checkout, plans, private square notes, square assignments, the public snapshot, seller links, or family links.
- A second organizer sees no contest, no private notes, and no activation. `gridone_owns_contest` is true only for the owner.
- The service role can read a checkout row and can take the current score-refresh lease. The signed-in role cannot call that newer lease function.
- The signed-in role can still call the old score-lease function. That is the hole pull request 16 closes.
- An unshared draft can be deleted. A published board cannot.
- The twelve new indexes exist. The private-notes policy applies only to `authenticated`.
- The signed-in role can select only `contests`, `contest_entries`, and `board_activations`. Anonymous has no table grants.

The same behavior is covered by `npm run test:integration` against disposable Postgres 17 containers (18 files, 130 passed, 1 skipped). `npx tsc --noEmit`, `npm run test:unit` (160 files, 1209 passed), `npm run build`, and `npm run design:lint` (0 errors, 5 existing warnings) also passed.

The first attempts to start local Supabase failed before any migration ran. The Realtime schema step could not open a TCP connection to Postgres on this machine's Docker network. That was a local firewall policy, not a problem in the migration. After that policy was corrected, the database started and the reset above succeeded. The full local stack (API, Auth, Studio) was not needed to apply the migration, and it was not left running.

Not done:

- This review did not connect to, migrate, or write to the production Supabase project, and it did not create a Supabase branch.
- Playwright was not run. The changes are database grants and a CI file, not a screen.
- Leaked-password protection was not toggled.
- Branch protection was not turned on.
