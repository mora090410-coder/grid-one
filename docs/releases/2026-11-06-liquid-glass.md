# Liquid Glass visual release — 2026-11-06

## Authorized scope

Complete Anthony's eight visual slices, commit each separately, then push to main.
No pricing, permission, Supabase schema/RLS, Stripe, scoring logic, route or deployment
configuration changes. No application dependencies added or upgraded.

- Scoped tokens, SVG stadium background, dark glass, self-hosted Inter.
- Public board allocation states and live layout.
- Phone seller-link tile picking, claim sheet and confirmation.
- Personalized game-day winner card, square chips and noninteractive map.
- Organizer workspace, create and dashboard materials; existing flows retained.
- Accessibility/performance checks and coordinated approved visual/copy assertions.

The kickoff-draw wording was clarified with Anthony's approval: “Game numbers
appear when the organizer locks the board.” Square payments remain between people.

## Verification

- TypeScript: passed.
- Unit: 168 files / 1,316 tests passed.
- Disposable PostgreSQL integration: 158 passed, 1 existing hosted Stripe proof skipped.
- Chromium full release suite: all 189 passed, two workers, no retries.
- Targeted WebKit on built UI: all 33 passed (viewer, seller claims, quarter numbers,
  Liquid materials, focus and axe). Chromium uses native CDP reduced-transparency
  emulation; WebKit lacks that Playwright API, so its test explicitly activates
  the actual loaded CSS media rules to verify the fallback cascade. This is not
  claimed as native OS-setting emulation on WebKit.
- New Liquid browser checks: 5 passed; includes 320/390/1280 containment, one-glow
  allocation, at most six backdrop panels, no serious/critical axe findings,
  reduced-transparency solid fallback and 2px/2px focus treatment.
- Existing notch keyboard/motion/return-focus tests: 27 repeated cases passed.
- Build: passed. Design lint: passed with existing warnings; no rule suppressed.
- Production dependency audit: zero vulnerabilities. Full audit retains two
  pre-existing development-only design CLI/Zod findings; manifests unchanged.
- Whitespace and protected-scope diff checks: passed.

### Performance measurement, not a production claim

Lighthouse 13.6.0, default simulated mobile/CPU throttling, built frontend served
from a local read-only fixture server with gzip static delivery: performance 91,
accessibility 100, best practices 100; LCP 3.5s, TBT 30ms, CLS 0.
Final post-viewport-fix report: sibling `../evidence/liquid-glass/lighthouse-post-viewport-fix.json`.
The intentionally uncompressed diagnostic was 77/100/100; it is retained rather
than concealed. Gzip was added only to the local verification server, not to
application or hosting configuration. The report uses explicitly labelled local
sample data, not real buyer claims, production scores or a production performance
measurement. Lighthouse was run ephemerally outside the app; no manifest or lockfile
was changed. Physical-device and VoiceOver/NVDA checks were not performed.

## Debugging notes

- A local game-day fixture omitted its external game ID, correctly causing the
  existing live hook to mark it unsynced. Fixing the fixture—not scoring logic—
  restored the expected personalized card.
- Reduced-transparency overrides must outrank the personal winner material.
- Newly adopted create/seller UI assertions were updated to the authorized colors,
  Inter font, open-only phone tiles and “You’re on the board” copy. Claim payload,
  privacy, off-platform payment, race/lock and keyboard assertions remain.
- Notch tests now wait for fonts and scroll past the actual name selector rather
  than a fixed old-layout offset. The notch intentionally stays hidden while that
  selector overlaps it. All motion, keyboard and persistent-return checks remain.
- A deterministic RED/GREEN regression reproduced a queued IntersectionObserver
  record overwriting newer scroll geometry. The viewer now reads current geometry
  when the observer fires. This fixes only viewport return-control visibility;
  scoring logic, score snapshots and authority are untouched.
- Tests generate historical screenshot files in tracked evidence directories;
  those generated diffs are retained outside the checkout and restored before commit.

## Evidence and publication boundary

Local raw logs, screenshots, RED/GREEN records, full Lighthouse JSON and fixture
harnesses: sibling `../evidence/liquid-glass/`. Browser fixtures never post real
claims or write production data. Repository release work is performed directly
by Anton; no independent-agent review is claimed.

Cloudflare lists this project as Git-connected. Pushing main may automatically
start its existing deployment; no manual deployment or hosting change is part
of this implementation. Remote Git, hosted CI and live deployment are verified
separately after pushing; local passing tests alone do not establish those states.
