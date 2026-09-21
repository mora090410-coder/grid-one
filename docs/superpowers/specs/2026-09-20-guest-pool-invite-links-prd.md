# GridOne — Guest Pool Invite Links

Date: September 20, 2026

Owner: Anthony Mora

Status: Implementation complete; Anthony subsequently authorized “Commit push deploy. I will test with Monday night football game tomorrow.” The approved release is a narrow board-allowlisted dogfood. This preserves the earlier review record below. Implementation choices, verification and release boundaries are recorded in the companion implementation plan and guest-invite operations notes.

## 1. Intended outcome

An organizer assigns Anthony ten squares and gives him one guest claim link. Anthony posts it on social media. Friends and family open the link, choose from his available squares, enter a display name, and claim without a GridOne account or app installation. After claiming, they can see Anthony's explicitly shared external payment instructions. Any payment occurs outside GridOne.

The primary task should take no more than 30 seconds on a normal mobile connection. GridOne owns square availability and claiming; it does not collect money, hold funds, initiate payments, confirm receipt, settle payment disputes, or pay winners.

Guests already have account-free viewing in GridOne. This feature adds self-service claiming, rather than removing an existing viewer signup requirement.

## 2. Approval record and scope

Anthony explicitly agreed to:

- Organizer-managed invites. The organizer creates each seller's link; sellers distribute it without new seller accounts or management permissions.
- Guest claiming and swaps end at final publication, when game numbers become public and locked. A private draft draw does not end claiming.
- Best-effort guest limits without identity verification. The product cannot guarantee unique people across browsers/devices.
- A seller-link list with counts, a reusable link, native sharing where supported, copyable text, and a prepared handoff message.
- Stable copying of an active link, with regeneration as a separate explicit action.
- Clear separation between public guest claim links and private family editing links.
- Optional seller-specific external payment instructions after a claim, with no transaction processing or automatic payment confirmation.
- Explicit entry and preview of payment contact details intended for sharing; no automatic extraction from private records.

Other design choices below are recommendations for review, not independently approved scope expansions. Section 13 identifies the remaining policy decisions. The original draft's rollout prohibition remains: nothing deploys to getgridone.com without Anthony's review and approval.

## 3. People and permissions

**Organizer:** The existing signed-in board owner. Creates, updates, disables, and regenerates invites; reviews claims; rotates lost claim credentials; explicitly releases claims within the permitted lifecycle. Existing pricing and ownership remain unchanged.

**Seller:** An organizer-designated distributor for an explicit set of squares. Receives a link from the organizer and forwards/posts it. This may be the existing responsible family, but invite scope is reviewed from explicit square IDs, never automatically inferred from an allocation label or private seller metadata. Being named as a seller does not grant a new account role or access to organizer-only data.

**Guest:** Opens a public invite, claims eligible squares, and later manages only their own claims using a private credential. No account, email, phone, password, or identity verification is required to claim.

**Private family editor:** The existing separately issued, scoped editing capability. It must remain distinct from a guest invite and must obey the new occupancy checks when touching guest-held or guest-claimed squares.

## 4. Organizer-to-seller distribution

1. The organizer designates the seller/family distributing the invite and reviews explicit permanent square numbers, including their current responsibility and occupancy.
2. The board must pass its existing save and sharing checks. Recommended v1: require the board to be explicitly shared before issuing guest links, retaining the current seasonal allowance and public-preview boundary.
3. The organizer reviews which selected squares will be offered for claiming, the public seller label, maximum squares per guest credential (default 1), optional expiry, and optional external payment instructions.
4. **Create guest link** creates a stable link. Recommended v1: one active link per seller per board, which may cover noncontiguous assigned blocks.
5. **Guest claim links** lists the seller, scoped total, claimed count, held count, available count, and **Share link**, **Copy link**, and **Manage** actions. Count definitions must distinguish guest claims from existing organizer-entered occupants.

Example handoff:

> Here's the link for your 10 squares on [Board name]. Share it with friends or post it on Facebook. They can choose squares and enter their name without signing up: [link]

Share invokes the device's share sheet when supported. Copy remains available with a selectable-text fallback. Opening the share sheet does not itself send a message. Repeated copying returns the same active URL. Regenerating invalidates old invite credentials and warns that previously posted copies will stop accepting guests.

Private family editing links retain their private wording and placement. They must never be included in public handoff messages, social previews, or guest-link copy actions.

## 5. Guest experience

1. Open the invite and see board identity, the explicitly public seller name, and the entire board. Seller-scoped eligible squares are highlighted; other squares remain readable but unselectable.
2. Select up to the allowed number of squares. A selection becomes held only after server acknowledgement; pending feedback must not falsely promise a reservation.
3. See a server-based 90-second hold countdown. Holds are anonymous to public viewers. Recommended organizer label before confirmation: **Guest selecting**.
4. Enter a display name, trimmed to 2–30 characters, and confirm. These limits apply to this new guest flow; existing names are not truncated or rewritten.
5. Receive a durable confirmation with permanent square numbers and a private four-word claim code. Make saving/copying the code straightforward. Do not include this credential in a social share message, payment note, analytics, or public payload.
6. Optionally open **Arrange payment with [seller]** after the claim has succeeded.

Out-of-scope, unavailable, held, and claimed squares need distinct accessible descriptions, not color alone. Preserve the existing composite-grid keyboard model, usable touch targets, and phone/desktop reading order. A timeout must preserve the entered name and explain how to select again. The detailed design must address accessible timing without allowing indefinite hold renewal.

Suggested copy:

- Heading: **Choose from Anthony's available squares**
- Hold: **Held for you — 1:12 left**
- Claim success: **Your squares are claimed. Save your claim code to manage them later.**
- Race lost: **Someone just grabbed that one — pick another.**
- Limit: **You can claim up to {n} squares with this guest pass.**
- No selectable squares because of holds: **These squares are temporarily held. Check again shortly.**
- All scoped squares claimed: **All of {seller}'s squares are claimed.**
- Finalized: **Game numbers are locked. You can still follow the board.**
- Disabled/expired: **This invite link is no longer active.**

Do not describe a just-published board as the game's final result. Do not offer account creation for cross-device claim management until account-to-claim linking actually exists; claim codes already provide the intended account-free access.

## 6. External payment instructions

Each seller's invite may display recipient details and supported external links deliberately provided for that purpose. The organizer enters the details supplied by the seller and previews exactly what guests will see. No banking credentials or connections are requested. Guest contact collection remains outside the recommended v1 scope.

Provider capabilities verified during review:

- Venmo offers shareable profile/recipient QR functionality. Only provider-supported recipient links should be accepted; do not promise undocumented amount-prefilling or payment confirmation.
- Zelle supports recipient email/US mobile details and bank-provided QR codes where available. Do not promise a universal Zelle checkout or direct-app link.
- Person-to-person Apple payments use Apple Cash through Messages. Provide suitable contact instructions; do not label this as an integrated Apple Pay checkout or promise a universal Apple Cash payment URL.

Provider eligibility must be resolved before presenting a branded method as supported for football squares. Venmo restricts entry-fee/prize activity without prior approval; Apple Cash terms prohibit wagers and other betting transactions. External links do not waive those restrictions. This PRD approves the external-instructions capability, not blanket eligibility for every named provider.

Product boundary:

- Claim completion is independent of payment.
- Following a link or returning to GridOne does not prove a payment happened.
- Existing private payment tracking remains manual and organizer-controlled.
- Payment details must be explicit public-facing seller fields, separate from private seller/contact notes. Seller email/mobile details are personal data even though guests are not asked for contact information. Return these fields only in the successful claimant's narrow response or authenticated management receipt, not the canonical public board projection, realtime events, analytics, or social previews. Any successful claimant can copy and forward them; the organizer preview must explain this. Claiming is not identity verification.
- A suggested payment reference may contain board name and square numbers, never the private claim code.
- Validate external destinations and render supplied text safely; no arbitrary executable URL schemes or embedded checkout content.

Sources checked September 20, 2026:

- [Venmo personal QR codes](https://help.venmo.com/cs/articles/personal-qr-codes-on-venmo-faq-vhel316)
- [Zelle usage and QR availability](https://www.zelle.com/faq/how-to-use)
- [Apple Cash person-to-person payments](https://support.apple.com/en-euro/guide/iphone/iph385cf0980/ios)
- [Venmo transaction restrictions](https://venmo.com/legal/us-helpful-information)
- [Apple Cash terms](https://applecash.greendot.com/termsconditions/)

## 7. Lifecycle and existing workflow integration

Sharing and finalization stay separate. Guest links do not expose unshared drafts or draft axis digits, bypass entitlements, consume another allowance per invite, or change scoring authority.

| State | Guest invite behavior |
| --- | --- |
| Shared, unfinalized, active invite | Claim explicitly offered, eligible scoped squares; manage existing claims within limits. |
| Private draft numbers drawn | Same guest selling behavior; draft digits remain hidden. |
| Final publication | Atomically close guest mutations and resolve outstanding holds according to the selected policy. Active invite becomes a read-only game board. |
| Custom expiry | Stop new holds/claims and release pending holds; dead-link message. Existing claims persist. |
| Disabled invite | Stop new holds/claims and release pending holds; dead-link message. Existing claims persist. |
| Regenerated invite | Old credential stops working; existing confirmed claims and attribution persist. Limits must not reset through regeneration. |

Recommended precedence: explicit disable/expiry remains a dead-link state even after board finalization; a separate canonical public board URL can remain available. Management of existing claims after invite termination needs the policy decision in section 13.

Availability, responsible allocation, buyer display name, guest claim ownership, and private payment status are separate concepts. Neither a blank square nor a seller-name placeholder proves claimability. Invite creation must explicitly review the offer; claiming changes purchaser occupancy without changing responsibility or private payment notes.

Existing organizer/family operations cannot silently overwrite holds or claims. Stale saves preserve in-progress input. Ordinary writes receive an actionable conflict; any organizer override must be explicit and audited. Reassignment invalidates affected invite authority and holds, with an explicit disposition for confirmed claims. Legacy dynamic-axis boards require a preservation decision before inclusion; no flattening or silent substitution.

## 8. Transaction, hold, and credential design

This is a proposed architecture, not a migration specification. Integrate with existing `contests`, public projections, revisions, and square indices; do not introduce a second unrelated `pools` source of truth.

Recommended entities:

- **Invite:** board, issuing organizer, explicit public seller label/reference, immutable identity, allowed square IDs, limit, optional expiry, disabled state, and credential version/issuance metadata.
- **Guest claim group:** stable identity scoped to the invite, display name, private claim-code verifier, management-session verifier, and credential rotation/audit history.
- **Hold group and hold squares:** one authenticated guest session can hold several squares together, with a server deadline and bounded renewal policy.
- **Claim square:** claim-group identity, board/square identity, source invite, claim time, and optional release time.

One four-word code authorizes the group, not one unique code per square row. Define a sufficiently large cryptographic word list, collision handling, and bounded online guessing before implementation. Recommend hash-only server storage with organizer-assisted rotation; old codes become invalid and cannot be recovered in plaintext. Browser persistence should use a narrowly scoped management credential; storage details remain an implementation-review choice.

The original signed invite proposal is compatible with stable copying if canonical issuance metadata and signing-key/version behavior are defined. Treat a signed token as opaque to clients, not as encrypted confidential data. All current authority is resolved server-side. Do not fabricate a new credential on ordinary Copy; do not log or broadcast bearer credentials.

Required transaction properties:

- Hold acquisition itself is atomic and exclusive across guests and intersecting invites.
- Confirmation checks current invite authority, lifecycle, scope, availability, hold ownership/deadline, and cumulative claimed-plus-held limits in the transaction.
- Multi-square confirmation and swaps are all-or-nothing. A failed swap preserves original claims.
- Active claim uniqueness is enforced at the database level. Holds and existing organizer/family occupants must participate in the same occupancy rules; a claims-only index is insufficient.
- Existing data cannot be treated as free merely because it has no guest-claim row.
- Disable, expiry, regeneration, reassignment, release, and publication races have deterministic outcomes under shared locking rules.
- Expired holds are logically unavailable to their former holder and reclaimable by others based on server time, even if cleanup is delayed. Tab closure is best-effort early release; expiry is the guarantee.
- Idempotent confirmation/release/rotation requests and an authenticated receipt lookup handle lost responses without creating duplicate claims or orphaning access.

The API must authenticate early hold release, bind hold groups to the caller and invite, and authorize explicit management actions. Extend the draft API to cover claim-group reads/swaps/releases, organizer releases, code rotation, and publication conflicts. Public board reads must return a narrow projection, never raw invite/hold/claim rows containing secrets.

## 9. Realtime and degraded operation

Use server-authoritative, versioned events for holds, releases, claims, and lifecycle changes. Supabase Realtime database-originated broadcast is a candidate consistent with the current stack, subject to implementation review. No new paid transport is assumed.

Only approved public board fields may reach public channels. Hold/session credentials, guest claim codes, payment status, private contacts, and private seller attribution never belong in broadcasts. Treat events as updates to a snapshot, with gap detection and fresh snapshot recovery on reconnect. A client-supplied event cannot establish occupancy.

Connected operation targets visible changes within one second under the defined test load. Disconnected operation shows **Reconnecting…** or an appropriate offline/last-known label and polls every 15 seconds while usable. A failed request cannot leave the UI implying current availability. Snapshot recovery handles missed, duplicate, and out-of-order events. Expiry visibility must work even when no cleanup row update has happened yet.

Organizer live updates preserve unsaved local edits and identify conflicts. Existing public sales viewers must also show holds/claims if the all-viewers promise is retained; this extends beyond the new invite page. Game score refresh behavior is unchanged.

## 10. Abuse and privacy

The default limit of one is per guest credential/session within an invite, with cumulative enforcement across its held and claimed squares. It does not identify a unique human. Duplicate display names are legitimate and cannot serve as authorization. A new browser/device can evade a best-effort identity limit.

Rate-limit holds, claims, and credential-entry attempts using appropriate independent per-session, per-IP, and per-invite controls. Avoid a single low invite cap that rejects a legitimate social-media burst or all people behind a shared network. Repeated abandoned holds need bounded renewal and abuse handling. CAPTCHA remains an optional proposal, not a mandatory dependency or a new paid service commitment.

Display names can identify people. Credentials grant capabilities. The original statement that there is “nothing to leak” is removed. Social previews and telemetry must not expose claim credentials, private contact/payment data, or personal hold identity. Opening a link or a social preview fetch must never create a hold or claim.

## 11. Acceptance evidence to plan

These checks are requirements for future work; none have been run for this feature.

- Fresh guest completes tap → selection → name → claim without account creation; measure the 30-second target on representative mobile/LTE conditions, including Facebook's in-app browser.
- Two guests contending for the same square receive exactly one active hold. A separate database concurrency test proves at most one active claim and expected loser responses. Isolate rate limiting from this correctness test; test abuse limits separately.
- Scope checks reject squares outside the grant, including forged IDs and overlapping invites. Define the API mapping between permanent numbers 1–100 and internal indices 0–99.
- Multi-square confirmations/swaps are atomic; failed swaps preserve originals; repeat confirms and lost responses recover the same result.
- Organizer edits, family edits, reassignment, invite disable/regeneration/expiry, and publication races cannot overwrite occupancy or bypass limits.
- Hold expiry works without relying on browser unload or a cleanup timer. Disabled invites release holds and preserve claims.
- Connected second-viewer and organizer updates meet a stated percentile/load target; disconnect/reconnect tests prove fallback labeling and snapshot convergence.
- Claim-code management works on another device; rotation invalidates old access; unrelated guests cannot read or change each other's claims.
- Publication closes guest mutations and preserves active invite read-only viewing; private draft axes never appear.
- Payment instructions show the correct seller's deliberately shared details; opening an external destination never marks paid or initiates a GridOne transaction.
- Public projections, realtime, analytics, and social previews contain no private credentials or unintended metadata.
- Render and inspect phone and desktop, keyboard selection, screen-reader status, accessible timeout recovery, and overflow.

Production implementation will need focused tests plus the existing TypeScript, unit, build, design, browser, and real-Postgres integration gates. A prototype cannot establish database atomicity, provider eligibility, or production realtime capacity.

## 12. Delivery stages

**Current stage — PRD/design review:** This document records the agreed product direction and proposed technical corrections. No production contract files are changed by this proposal.

**Phase 0 — disconnected prototype, when Anthony authorizes prototype work:** Use simulated data for organizer link creation/copying, guest selection/hold/claim, confirmation and external-instructions presentation, returning-guest management, and the organizer claim list. Label simulated updates; connect to no live database/payment account and do not invoke a real payment flow. Review phone and desktop states. Approval of this plan-only direction does not itself authorize building the prototype.

**Implementation planning:** After the written design is reviewed, produce a bounded implementation plan covering schema/API integration, all existing writers, guest and organizer UI, realtime, tests, and rollback. Separate implementation authorization from production migration/deployment authorization.

**Phase 1 — implementation and controlled validation:** The original draft requests a feature flag, but this repository has no current flag system. A server-enforced rollout gate or isolated environment must be deliberately designed; historical analytics variants are not flags. Real-board dogfooding requires Anthony's approval of the concrete release and production-data actions.

**Phase 2 — approved release:** Follow the reviewed migration/deployment order, validate the deployed revision and rendered paths, and preserve confirmed claims, audit history, existing links, and locked game results during rollback. No commit, push, production change, real-user outreach, or rollout is authorized by this PRD alone.

## 13. Remaining policy decisions before implementation

These do not prevent review of the proposed flow, but must be settled in the implementation specification:

1. **Finalization with active holds:** Recommend warning the organizer and requiring an explicit choice to wait or finalize and cancel holds; never silently convert holds into claims.
2. **Management after invite disable/expiry:** Recommend preserving read access to the guest's own receipt through a separate management entry point, while stopping self-service mutations. Recommend keeping explicit organizer releases available before publication, independently of invite status.
3. **Offer/reassignment policy:** Specify how seller-name placeholders and pre-existing buyer names are reviewed before offering squares, and whether reassignment with confirmed guest claims is blocked or requires an explicit audited transfer.
4. **Provider eligibility:** Resolve which, if any, branded external payment methods are appropriate before a real-board rollout. Generic approved seller instructions can be prototyped without claiming provider eligibility.
5. **Rollout gate and measurable load target:** Select the actual server/environment boundary and connected-latency percentile, including expected concurrent guests. Do not silently add a flag system or paid service.

## 14. Review evidence and change boundary

Read-only review covered current product/organizer contracts, public sales polling, board routes, family access API and database locking/revocation, publication/open-square boundaries, existing private payment metadata, and historical analytics variants. A Sol subagent independently reviewed workflow conflicts and the full-PRD data/API gaps; the orchestrator consolidated the recommendations.

This task creates this proposal document only. Existing modified and untracked work remains untouched. Documentation verification checks structure, approval boundaries, internal consistency, and the resulting diff; no build, application tests, database changes, browser prototype, or live verification is claimed.
