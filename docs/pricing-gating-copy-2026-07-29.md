# GridOne — Pricing, Gating & Copy Spec

**Version:** 1.0 · **Date:** 2026-07-29 · **Status:** Amendment to `docs/execution-spec-2026-07-29.md`
**Decision context:** No paying customers exist yet. The $4.99 live price has never been charged. This is the cheapest moment this change will ever be.

---

## Part A — The pricing ladder

### The tiers

| Tier | Price | Allowance | Who it's for |
|---|---|---|---|
| **Free** | $0 | **1 published board** per season | The first-timer. The curious parent. The proof. |
| **Game Day** | **$9.99** once | Up to **5 boards**, 2026 season | The regular — regular season + playoffs + Super Bowl |
| **Organization** | **$79** / season | Up to **50 boards** + org features | Booster clubs, youth leagues, schools, churches |

All tiers: building, editing, and previewing unlimited draft boards stays free. Payment gates **publishing count**, nothing else.

### Rationale (recorded so future-you doesn't relitigate it)

1. **The free published board is the growth engine, not a giveaway.** GridOne competes against free paper, not against paid pool hosts. Every published board puts the product in front of 20–100 viewers. Gating the first publish entirely — the current model — starves the only loop that compounds. One free board converts "let me try it" into "40 people at my church just used it."
2. **$9.99 is priced against effort, not against competitors.** The person who runs 2–5 boards a season has already proven they'll do work to run squares. Ten dollars against hours of paper wrangling is not a decision.
3. **$79 is priced against a budget line, not a wallet.** A booster club treasurer approves $79 without a meeting. This tier is ~16× the old ARPU for the same code, and the existing SEO cluster (booster club / church-school / youth sports articles) already targets exactly this buyer.
4. **The old $4.99/20 tier served nobody** — anyone needing 20 boards isn't price-sensitive at $4.99, and anyone needing 1 doesn't value 20. Replace it cleanly; there is no one to grandfather.

### Org-tier features at launch (keep it honest — ship only what exists or is one day of work)

- Organization name displayed on every published board ("Riverside Ravens Booster Club")
- All org boards on one dashboard
- One receipt with the org name on it (treasurers need this)
- Everything else (co-organizer seats, delegated sellers) stays on the Later list — do **not** promise it on the pricing page

---

## Part B — Gating spec

### The five gating rules

1. **Gate at publish, never at build.** Unlimited drafts, full editor, full preview, on every tier including free. This already exists — it is the best funnel decision in the product. Keep it.
2. **Gate count, never capability.** A published board is a full board: live scores, scenarios, Find My Squares, winner emails, QR code — on every tier. No "pay to see who won" dark patterns, ever. The viewer experience is the marketing; degrading it degrades the loop.
3. **Server-enforced only.** The client renders state; it never decides it. Allowance lives in `season_entitlements` and is enforced by the same atomic RPC for all tiers (execution spec T1.6). Free tier = an implicit entitlement of 1, created lazily at first publish, enforced by the identical code path — not a client-side check.
4. **Never gate mid-game.** Allowance is checked at publish time only. Once a board is live, it stays live and fully functional for its season regardless of later entitlement state. (Consistent with the refund rule in T1.3: viewers never lose a board because of an organizer's billing event.)
5. **Upgrade prompts only at allowance edges.** Free organizer attempts publish #2 → Game Day offer. Game Day organizer attempts publish #6 → Organization offer. Nowhere else. No banners, no nags, no countdown timers.

### Implementation deltas (amendments to the execution spec)

| Spec item | Change |
|---|---|
| **New migration `01x_pricing_tiers.sql`** | Add `tier` (`free` \| `gameday` \| `org` \| legacy) and `board_allowance` to `season_entitlements`; free-tier lazy-create RPC; org `display_name` column |
| **T1.1 / T1.2 (webhook verification)** | The single `amount_total === 499` check becomes a server-side price map: `{price_gameday: 999, price_org: 7900}` → tier + allowance. Verification logic otherwise identical. Unknown price ID = reject, exactly as now |
| **T1.6 (atomic activation)** | Unchanged mechanically; the atomic `UPDATE ... WHERE boards_used < board_allowance` now reads the per-tier allowance |
| **Stripe (STOP-gated, product-owner action)** | Create two live prices; archive `price_1TyFoqFwSi8ogxSrY9KvKd70`. Update `wrangler.toml` price IDs |
| **`/api/billing/status`** | Returns tier, allowance, used count — the UI renders from this, decides nothing |
| **Upgrade paywall UI** | Two screens (free→GameDay, GameDay→Org), copy in Part D below |
| **Docs** | `PRODUCT.md` Commercial model section, README, FAQ, JSON-LD offers, and all `$4.99` references updated in the same commit — no stale-price window |
| **Marketing docs** | `docs/marketing/` still says $14.99 in one file (T4.3) — same sweep catches it |

### Guardrails for the agent

- One commit updates price copy everywhere; grep for `4.99`, `4\.99`, `20 boards`, `season pass` before closing.
- The Stripe dashboard changes (new prices, archive old) are **STOP** items per execution-spec §1.1 — propose, wait for approval.
- Free-tier abuse: one free published board **per account per season**, and account = verified email. Do not build device fingerprinting; a determined person making burner emails for free squares boards is doing your marketing.

---

## Part C — Copy teardown of the current landing page

**File:** `components/LandingPage.tsx` · **Verdict:** The bones are good — the scroll-driven quarters demo is genuinely persuasive and "The board watches the game" is a keeper. The problem is that spec language leaked verbatim into customer copy. It reads like the engineering requirements doc, because it is the engineering requirements doc.

### The audit

| # | What's on the page | Where | Why it hurts | Fix direction |
|---|---|---|---|---|
| 1 | **"beta"** — "automatic beta scoring," "automatic beta score checks," "AUTO BETA + MANUAL FALLBACK," "optional beta scan" | lines 46, 48, 211, 290, 296 | To an engineer, "beta" is honest scoping. To a parent, **beta means broken**. You put "this might not work" in your hero. Honesty about score provenance belongs in the product's freshness UI ("Updated 40s ago · ESPN"), not the sales pitch. | Remove "beta" from every marketing surface. The product UI keeps its provenance labels — that's where the honesty commitment in PRODUCT.md actually lives. |
| 2 | **"SYNTHETIC DEMONSTRATION DATA"** ×3, all caps, on the hero; "watch a synthetic game settle" | lines 61, 307, 321, 330 | Compliance vocabulary shouting from the top of the page. PRODUCT.md requires demo data to be *labeled* — it doesn't require it to be labeled like a lab specimen. | "Sample board" / "Sample game." Once per surface, small, sentence case. Same compliance, human words. |
| 3 | **"manual fallback" / "organizer fallback"** | 290, 296 | Failover jargon. Nobody outside an on-call rotation says fallback. | "You can always enter scores yourself." |
| 4 | **"a grounded game source"** | 320 | This is Gemini API documentation language ("Search grounding") pasted verbatim into customer copy. Meaningless to every human who will ever read it. | "GridOne checks the score and fills in each quarter's winner." |
| 5 | **"read-only"** ×6 | 53, 55, 56, 64, others | Database permission vocabulary. Six times. | Say it once, as a benefit: "Everyone sees the board. Only you can change it." |
| 6 | **"NOT A BETTING SITE"** all caps, ticker + footer | 66, 456 | Screaming a denial plants the accusation. Legally wise to state; strategically wrong to shout. | Quiet footer sentence: "GridOne tracks the board. It never touches the money — squares and payouts stay between you and your group." |
| 7 | **"introductory 2026 season pass"** | 52, 55, 255 | Pricing legalese. Nobody buys a "season pass" to a squares tracker; they buy not-doing-paper. | Plain: "Your first board is free. $9.99 covers up to 5 boards this season." |
| 8 | **"a native 10×10 board"** | 46 | "Native" is developer vocabulary (native vs. imported). The customer doesn't know there are two kinds. | "Start with a fresh board, or snap a photo of the paper one you already have." |
| 9 | **The ticker is the spec, scrolling** | 60–68 | Seven feature-requirement bullets in a broadcast costume. A real ticker carries *game events*, not entitlement rules. | Sample game events (Part D). Broadcast form, broadcast content. |
| 10 | **No person, no pain, anywhere** | whole page | The copy sells mechanisms — score checks, links, fallbacks. It never touches the Sunday reality: the "who won Q3?" texts, the photo of a wrinkled grid in the group chat, squinting at handwriting in a bar. People buy relief, not architecture. | Part D leads every section with the moment, then the mechanism. |

**Keep, unchanged:** "The board watches the game" (H1) · "Kickoff is closer than you think" (closing H2) · the scroll-scrubbed quarter demo mechanic · "Build the board now. Pay only when you're ready to share it."

### The rule going forward (add to the agent's guardrails)

> **Marketing copy never contains: beta, synthetic, fallback, read-only, grounded, native, canonical, provenance, freshness, entitlement, or any word from PRODUCT.md's system vocabulary.** Those words govern the *product*. The landing page speaks *sideline*, not server room. Test: read every sentence aloud as a booster-club parent — if it needs the spec to parse, rewrite it.

---

## Part D — Replacement copy (ready to ship)

### Hero

> *(film payoff line, small, over the final frame)* **Paper had a good run.**
>
> # The board watches the game
>
> Football squares for booster clubs, offices, and game-day crews. Build your board in minutes, share one link — and everyone watches their squares hit, live, all game.
>
> `FREE TO START / ONE LINK, NO APP / LIVE SCORES & WINNERS / YOU STAY IN CONTROL`
>
> **[ Build your board — free ]**  [ See a live board ]

### Band 2 (the scroll demo)

> ## Scores come in. Winners light up.
>
> GridOne follows the game and fills in each quarter's winner as it happens. Every score shows where it came from and when — and you can take over and enter scores yourself anytime. Scroll to watch a sample game play out.

### How it works

> **01 — Build your board.** Type names straight in, or snap a photo of the paper board you already have and fix it up. Ten minutes, start to finish.
>
> **02 — Share one link.** Text it. Post it in the group chat. Tape the QR code to the concession stand. Everyone sees the same live board — nobody needs an account or an app.
>
> **03 — Enjoy the game.** Scores update on their own. Winners light up each quarter and get an email. No more "wait, who won Q3?" texts at halftime.

### Pricing FAQ (replaces both pricing answers)

> **What does it cost?**
> Your first board is free — build it, share it, run it all game day. Running more than one? **$9.99** covers up to 5 boards for the whole season. Running squares for a club, school, or league? The **Organization** plan is $79 per season: up to 50 boards, your organization's name on every one, and one receipt for the treasurer.

### Ticker (sample game events, labeled once)

> `SAMPLE GAME` · `Q1 — RIVERA HITS ON 7–3` · `WINNER EMAILED` · `84 OF 100 SQUARES CLAIMED` · `BOARD LINK OPENED 61 TIMES` · `Q3 — OKAFOR HITS ON 1–0` · `YOUR FIRST BOARD IS FREE`

### Upgrade screens

> *(free → Game Day)* **That board's live. Want another?**
> Your free board is out there doing its thing. $9.99 unlocks up to 5 boards for the whole season — playoffs and the big game included.
>
> *(Game Day → Organization)* **Sounds like you're running this for a whole organization.**
> The Organization plan puts your club's name on every board, keeps all of them on one dashboard, and gives your treasurer one clean receipt. $79 for the season, up to 50 boards.

### Footer

> GridOne tracks the board. It never touches the money — squares and payouts stay between you and your group.
> © 2026 GridOne

---

## Part E — Sequencing

1. **Now (before launch):** Part B Stripe changes (STOP-gated) + price copy sweep. One day.
2. **With the new landing build:** Part D copy ships inside the scroll-film page — don't retrofit the old page then rebuild it.
3. **After launch:** watch one number — free boards published → viewer link opens → new organizer signups from viewer CTA. That chain is the business.

*End.*
