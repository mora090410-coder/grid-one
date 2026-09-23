# GridOne: user-friction brief

Date: September 23, 2026
Owner: Anthony Mora
Source: a walkthrough of getgridone.com at phone size, a read of the repo on `main` (9e73acb), and a question-and-answer session with Anthony.
Status (updated 2026-09-23): S1 to S4 are live (pushed 3c22bc6). S6 is done as the simple version: every seller gets one public link, buyers tap squares, type a name, and claim. There are no holds, claim codes, Available-first rule, or rollout allowlist. This replaces the organizer and family entry points of the earlier guest-link system (`029_guest_invites.sql`, `030_family_guest_links.sql`). Its tables and `/g/` pages stay so links already posted keep working. Migration `031_seller_links.sql` must be applied to production for seller links to work. S7 needed no change. S5 is not started.

---

## 1. The real workflow (Anthony's words, tidied)

1. The **organizer** creates the board and assigns blocks of squares to **sellers** (players or families).
2. Each **seller** gets their squares and **one link they can post** (Facebook, group text, team chat).
3. **Buyers** open that link, see what is still available *from that seller*, and pick squares.
4. The seller collects the money, outside GridOne.
5. If the seller does not sell a square, **the seller's name stays on it**. The seller owns their block.
6. The organizer needs a **fast, frictionless way to send every seller their assignment.**

The goal: this should be the iPhone moment for football squares. It should be simple enough that nobody needs instructions.

### How this differs from RunYourPool

RunYourPool lets a commissioner assign squares to guests and share one public grid. Its help center says nothing about sellers or sub-groups ([RYP NFL Squares FAQ](https://help.runyourpool.com/en/articles/9264643-nfl-squares-frequently-asked-questions)). **GridOne's edge is that every seller gets their own link and their own block.** That is how youth-sports fundraisers actually sell squares. Lead with it everywhere.

## 2. What exists today and what's missing

| Step | Today in the code | Friction |
|---|---|---|
| Organizer assigns blocks | `RangeAssignBar`: select squares, type a name, apply. Works. | Fine. |
| Send every seller their squares | `FamilyAccessCard`: pick one family from a dropdown, create a private link, copy it, repeat. The link expires in 7 days. `BoardToolsCard` has "Send seller sheet". | One seller at a time, hidden under "Family access (optional)". There's no "send everyone their link" step. |
| Seller's public link | None. The public board has a family filter, but no link opens already filtered to one seller. | The seller can't post a link that shows only their available squares. |
| Buyer picks squares | None. The sales viewer says "Contact the person who shared this board or the organizer with the square numbers you're interested in." | This is the biggest gap. Buyers have to text someone and hope. |
| Seller records buyers | The private family link lets the seller type buyer names. | Works, but the seller does it by hand. |
| Unsold squares keep the seller's name | No. An allocated square with no buyer name publishes as **OPEN**. | This goes against Anthony's rule in step 5. |
| Game day, "where are my squares" | The chosen name is already remembered per board (`localStorage` key `gridone:find-squares:{CODE}`). | Close. Your squares already show near the top, but "what score makes me win" sits lower, in a collapsed section. |

A full PRD already covers buyer self-claiming: `docs/superpowers/specs/2026-09-20-guest-pool-invite-links-prd.md`. It's correct, but heavy: 90-second holds with countdowns, four-word claim codes and seller payment fields. See S6 for a simpler first version.

## 3. Decisions from this session

1. **The sample board sells setup.** Use the Lincoln Softball board, the same as the homepage. No "Demo Player" names and no 2025 Super Bowl.
2. **Save first, pick the game later.** The organizer can save and start selling without a game. The game is required before drawing numbers. *Needs a schema change: `contests` requires a game today.*
3. **Buyers pick from the seller's link.** Replaced by the workflow above: the buyer picks, the seller collects, and the organizer doesn't approve each pick.
4. **Remember me.** A returning buyer lands on: your squares, whether you're winning, and what score would make you win.
5. **Pricing moment.** One clear line at publish. `UpgradeSheet` already does this ("$9.99 unlocks up to 5 boards for the whole season"). No change needed beyond the copy pass.
6. **Money line said once, as a plus.** "You collect the money your way. GridOne keeps the board." The full legal line stays in the FAQ, footer and Terms.
7. **Copy stops reading like a manual.** See section 5.

## 4. Slices

Every slice is RED, then GREEN, then REFACTOR. Write the failing test first, then the smallest fix, then clean up. No changes to pricing, permissions, schema, or deploy without approval.

### Build now (no schema)

**S1. The sample board is Lincoln Softball.**
- RED: a test that `/demo` renders "Lincoln Softball Booster Board" and no "Demo Player" or "Super Bowl LIX" text.
- GREEN: `components/BoardView.tsx` demo branch uses `demoBoard`/`demoGame`/`demoLive` from `src/features/homepage/demoData.ts` in place of `SAMPLE_BOARD` and the inline 2025 game.
- Later, with design: a short "watch it get built" strip on `/demo` (assign a block, send seller links, draw numbers, game day). Stills for now, not a new flow.

**S2. A returning buyer sees their answer first.**
- Found: the name is already remembered per board, and each square row already lists its next winning score. The gap was the headline.
- RED: with a remembered name, the summary headline reads "Not winning right now. Next winning score: KC Safety +2."
- GREEN: `YourSquaresSummary` and `ViewerIsland` headlines now say "You're winning right now." or "Not winning right now. Next winning score: …". `docs/phone-viewer-hierarchy.md` was updated in the same change.

**S3. Money line once.**
- RED: the homepage renders the long disclaimer at most once, in the FAQ. The footer is allowed.
- GREEN: the hero now says `MONEY_LINE` ("You collect the money your way. GridOne keeps the board."). The repeats in OrganizerSection and the pricing block are gone. The exact line stays in the FAQ, the footer and the no-JS fallback.
- Not changed: in-app cards (payouts, payments, family access, board details). `tests/moneyBoundaryConsistency.test.ts` pins the exact wording there as a legal boundary. Trimming those is Anthony's call.
- Update `tests/productionCopy.test.ts` and `tests/homepage/homepage.test.tsx` if they pin the old copy.

**S4. Copy pass.** Rewrite the lines in section 5. Plain words, short sentences, no system terms ("resolved winner records", "arithmetic score outcomes", "responsibility", "allocation", "canonical"). Keep every accessible name that tests and contracts depend on, or update the contract and test in the same change.

### Needs Anthony's approval (schema or contract change)

**S5. Save without a game.** Allow `contests` without a scheduled game. The lifecycle blocker `missing_scheduled_game` moves from save to draw. The create page's "Save and continue" works with only a name.

**S6. Seller links (the iPhone moment).** A simpler v1 of the guest PRD:
- After assigning blocks, the organizer sees **"Send seller links"**: one row per seller with square count and a **Share** button (native share sheet with the message written for them). One screen, done in under a minute for a 10-seller board.
- Each seller link is public and opens the board filtered to that seller, with their open squares highlighted.
- Buyer: tap squares, type a name, tap **Claim**. It's one atomic server write. If someone beat them to it: "Someone just grabbed 62. Pick another." **No hold timers and no claim codes in v1.** The phone remembers the buyer. The seller or organizer can fix mistakes.
- After claiming: "Pay [seller] however you usually do." Optional free-text payment note from the seller. No branded payment links in v1 (see the PRD's section 6 eligibility notes).
- The seller gets a private "my squares" view to fix names and mark paid.
- Claiming closes when numbers are locked.
- Schema: seller link table (board, seller label, square set, token hash, disabled), plus claim fields on squares. Reuse the family-link locking and revision checks already in the database.

**S7. Unsold squares keep the seller's name.** At lock, a square assigned to a seller with no buyer shows the seller's name, not OPEN. This changes the open-square contract in `docs/organizer-journey-contract.md` and the publish logic. Truly unassigned squares still publish as OPEN.

## 5. Copy: before and after

| Where | Before | After |
|---|---|---|
| Homepage, 4 places | GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners. | Once, near the top: **You collect the money your way. GridOne keeps the board.** (full line stays in FAQ and footer) |
| Sales viewer | Contact the person who shared this board or the organizer with the square numbers you're interested in. They will confirm availability and record your name. | Want a square? Text the person who sent you this link with the numbers you want. *(until S6 ships)* |
| Sales viewer | Availability is confirmed by the organizer. Payments happen outside GridOne. | (remove; covered above) |
| Sales viewer | Available · confirm with organizer | Available |
| Viewer | No resolved winner records have been published yet. | No quarter winners yet. |
| Viewer | These are arithmetic score outcomes, not odds or predictions. | Just math on the score. Not odds. |
| Viewer | Read each result across the top team's columns, then down the side team's rows. | (remove) |
| Viewer | Use the name the organizer wrote on the board. | Pick your name to see your squares. |
| Viewer details | Top axis and side axis use organizer-published digits. | (remove) |
| Homepage score | The current match can change. Quarter and final outcomes are recorded separately once confirmed. The organizer can enter a manual score when needed. | Winners lock in at the end of each quarter. |
| Homepage score | Choose your name in the shared view to see every square you hold and whether one currently matches. | Tap your name. See every square you have and if you're winning. |
| Homepage organizer | Names, open squares, and what comes next. Keep the preparation in one place, then share one link with your group. | Assign squares, share one link, draw numbers. That's it. |
| Homepage organizer | Review the remaining OPEN squares before you draw and lock the game numbers. | See what's still open before you draw numbers. |
| Homepage organizer | Share during preparation. After you publish, that same link becomes the game-day view. | Share it while you sell. On game day, the same link shows the score. |
| Homepage organizer | A private note for the organizer, not a payment through GridOne. | Only you see this. |
| Homepage FAQ | Building, editing, and previewing are free on every plan... Sharing your board's link with players counts as publishing it — but a board only counts once... | Building is always free. Your first shared board each season is free. Each board counts once, however often you share it. |
| Homepage FAQ | The organizer controls the board and can give a family a private link to update its assigned names before finalization... | You control the board. You can give a family a private link to add names to its own squares. Viewers can't edit. |
| Family view | Updating a name does not change your family's responsibility. Arrange all money with your organizer and supporters outside GridOne. | These are your squares. Add buyers' names as you sell them. |
| Family view | Names and availability appear on the shared board. Mark availability deliberately; a name alone does not say whether a square is available. | Everyone with the board link sees these names. |
| Family access card | Let a family update names on its assigned squares. Its responsibility stays the same. Anyone with its private link can make those edits; keep it separate from the public board link. | Send a family a private link so they can add their buyers' names. Don't post it publicly. |
| Draw | Open squares stay marked OPEN on the shared board. You can still assign them before kickoff. | Open squares stay open. You can still fill them before kickoff. |
| Share confirm | Share now and keep selling. Game numbers appear only after you finalize the board. Sharing uses one board from your season allowance; finalizing this same board uses no additional board. | Share now and keep selling. Numbers stay hidden until you lock them. This counts as 1 board for the season. |
| Final record | Scores, winners, OPEN outcomes, and public corrections stay visible for trust. Regular setup editing is closed; create another board for the next fundraiser or game. | This board is done. Winners and any fixes stay here for everyone to see. |
| Ready state | Ready when the board goes live / Every published board gets the full game-day experience. | Live scores start when you lock the numbers. |

Words to retire in user-facing copy: *allocation, responsibility, finalize/finalization, resolved, arithmetic, axis, canonical, authority, advisories*. Prefer: *assign, your squares, lock the numbers, winners, top/side numbers*.

## 6. Verification for the built slices

```bash
npx tsc --noEmit
npm run test:unit
npm run build
npm run design:lint
npx playwright test --project=chromium
```

Also: phone (390 px) and desktop screenshots of `/`, `/demo`, a sales board and a game-day board with a remembered name. Record results in `docs/REFACTOR_LOG.md` inside the branch.

## 7. Guardrails

- The work on `main` from about September 17 (scoring-provider recovery) is Anthony's in-progress work. This branch starts from `9e73acb` and doesn't touch it.
- No commit, push, migration, or deploy without Anthony's OK.
