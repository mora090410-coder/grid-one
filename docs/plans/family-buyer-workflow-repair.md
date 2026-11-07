# Family / buyer workflow repair implementation plan

**Goal:** Repair Grok's three reported workflow failures locally, with executable regression evidence and no production writes, commit, push or deployment.

**Architecture:** Preserve family responsibility independently of buyer names. A family-scoped square is claimable only when blank AND explicitly offered as available, or carrying exactly the family's existing placeholder name and not explicitly unavailable. A blank alone never promises availability. Actual buyer names and multi-name records remain protected; availability alone cannot overwrite ownership. Keep persisted offered availability distinct from effective eligibility and explain conflicts. Preserve SQL row locks, revision checks, scoped capabilities, legacy link stability and paid-status privacy.

**Stack:** React, TypeScript, Cloudflare Functions, Supabase/PostgreSQL; Vitest, disposable Postgres and Playwright. Anton implements directly under current operating mode.

## 1. Family save lifecycle
- Reproduce availability-only editing on a blank allocated square, clearing a name, and a second edit after save in `tests/familyWorkspace.test.tsx`.
- Permit empty display names (not empty family labels) in `FamilyWorkspace.tsx` and `functions/api/family.ts`; preserve trim/80-character checks and dirty-state comparison.
- Add forward migration `039_family_seller_workflow.sql` to allow scoped family name clearing, storing a genuinely empty `squares` array; do not edit old migrations or apply anything to production.
- Test API payload validation and scoped SQL persistence; unchanged drafts, conflicts and failed saves retain existing behavior.

## 2. Seller request lifecycle
- Reproduce a never-settling flush/session/fetch and retry after failure in `tests/organizer/sellerLinksCard.test.tsx`.
- Bound the complete operation, abort network work, invalidate late results and clean up on unmount/board change. Retry sync only deliberately; never retry rotation automatically or invalidate existing links on timeout. Preserve displayed links on failed updates.
- Exercise stable Maple/River links and recovery after sequential requests.

## 3. Availability / claim agreement
- Reproduce blank-family offered inventory rejected by the current seller RPC using disposable SQL.
- Extend the existing server-side read AND claim predicates together; blank explicitly-available inventory or sole exact family placeholder is claimable, actual buyer/multiple names stay protected. A successful claim makes that cell explicitly unavailable as well as naming the buyer. Correcting a name alone does not re-offer a claimed square; the organizer or scoped family must deliberately change availability too.
- Share the equivalent pure eligibility rule across public sales presentation and organizer summaries. Preserve stored availability, expose contradictory buyer-name/offered state explicitly rather than silently promising a claim.
- Verify family A cannot expose/claim family B cells, unavailable cells stay blocked, racing buyers produce one winner, old links remain stable, and claimed state persists across reads.

## Verification and stop gates
Use vertical RED → GREEN steps, then focused unit/API/SQL and browser journeys; run full TypeScript/unit/build/design/browser/integration gates appropriate to the changes. Browser fixtures must use real application components and independent contexts, never real capability links or production accounts. SQL tests use disposable Postgres only.

Stop for any required broader permission, destructive migration, production schema application, pricing/scoring changes or unresolved eligibility ambiguity. Source inspection establishes gaps, not the exact cause of Grok's historical stalled network request. Report reproduced bugs, verified hardening, and remaining production/mobile checks separately.
