# Family Sharing Handoff Implementation Plan

**Goal:** Let a participant create/copy a public claim link directly from their private family workspace and show buyers only that invite's actual squares.

**Authority:** Anthony explicitly approved both changes after the live walkthrough. Preserve organizer assignment/name entry. Implement and verify locally; production application of the new migration and release remain a distinct reviewed step.

**Architecture:** Existing private family capability authorizes a service-only transaction that derives scope from current assigned cells. Server signs a narrow public invite URL. Guest UI renders only offered IDs. Existing availability, claim, rate, revocation and lifecycle guards remain authoritative.

**Evidence/spec:** September21 walkthrough findings in `.work/guest-invites/walkthrough/findings.md`, and `docs/superpowers/specs/2026-09-20-guest-pool-invite-links-prd.md` with the explicitly approved revision from full-board to participant-only buyer view.

## Tasks

- [x] Database agent: migration030 adds `gridone_family_guest_link(p_board_id uuid,p_token_hash text,p_action text DEFAULT 'read')`. Lock canonical board, validate family credential/current assignment, derive exact cells. Explicit create only; stable concurrent reuse; no availability/name/payment changes; preserve owner settings and never bypass disabled/expired links. Test revoked/expired/mismatched board, scattered/variable scopes, concurrency, publication, RLS, and existing-writer compatibility with disposable Postgres.
- [x] Root: POST `/api/family/guest-link` accepts only `{action:'read'|'create'}` and bearer family token. Hash credential, resolve board identity only, enforce exact server allowlist, rate-limit keyed hashes, call RPC for transactional authorization, project narrow response and sign public URL using configured origin. Tests reject scope/identity injection, missing configuration, raw-secret leakage, denial, unsafe projection and rate-limit failures.
- [x] Family UI agent: add public-sharing card above existing editing fields. Read without creation; explicit create/copy/share, preserve edits, refresh the complete canonical family record after creation only when safe, show disabled/expired/unshared/off states clearly. Use public URL only for clipboard/share. Test clipboard fallback and native cancellation, dirty drafts, missing/disabled gate, and unchanged name editing.
- [x] Buyer UI agent: compact responsive native list of offered square buttons; actual permanent numbers preserved for arbitrary cells and10/20-sized sets; no out-of-scope names/IDs rendered. Keyboard order follows displayed sequence; maintain hold, claimed and receipt-management behavior. Update affected guest unit/browser cases and inspect phone/desktop.
- [x] Root integration: focused tests first, then typecheck/unit/integration/build/design/Chromium. Independently review capability scope and UI contracts. Update product/architecture/operations/refactor log with actual evidence; report exact release boundary.

## Shared family-sharing contract

`{boardId,title,label,cells:number[],revision,state,availableCount,maxSquares?,url?}` where state is `not_created|active|disabled|expired|locked|not_shared|scope_mismatch`. Only active state receives a signed URL. SQL returns inviteId/version instead of URL. Unknown private capability receives generic403. Gate off receives explicit404 sharing unavailable. Owner limits, payment metadata and credentials are never editable through this endpoint.

## Review focus

- Creating a link must not publish sold/manual-name squares or silently change availability.
- A private-token reissue may reuse the public link, but revoked or reassigned credentials cannot obtain/create it.
- Disabled/expired/mismatched organizer links cannot be evaded by a participant creating another.
- Family drafts survive refresh and public-link creation cannot leave a stale edit revision.
- A buyer never sees unrelated square names, including through accessibility labels; keyboard focus stays inside offered cells.

## Final local verification

- TypeScript, production build and Cloudflare Functions compilation passed.
- Unit suite: 131 files, 930 tests passed.
- Disposable PostgreSQL suite: 13 files, 97 passed, one existing skipped.
- Design lint: zero errors, five existing token warnings.
- Full Chromium: 134/136 passed; two existing animation/confirmation timing failures both passed on the unchanged frozen source in an exact focused rerun. No assertions or production behavior were changed to satisfy them.
- Phone WebKit family and guest journeys: 10/10 passed. Family 390/1440 renders and buyer phone collection inspected; axe and overflow checks passed.
- Independent endpoint/SQL review approved; orchestrator reviewed scope, inactive-state handling and stale-draft preservation.
- At completion of local verification, no new commit, push, production migration or deployment had been performed. Anthony subsequently approved “Commit push and deploy”; see the release entry in `docs/REFACTOR_LOG.md`.
