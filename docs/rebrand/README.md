# Corner Square rebrand report

Visual layer only. No pricing, plan, checkout, permission, auth, schema,
migration, scoring, or deploy change. Brief: `REBRAND-BRIEF.md` in the
`gridone-brand` kit.

## Screenshots

`before/` and `after/` hold the same 14 captures (390px and 1280px):
landing, organizer workspace (full page), dashboard, public viewer
(sample board), seller link page, a board with a winner (full page), and
sign in. The organizer, seller, and winner pages use the same mocked API
responses as the Playwright suite. The dashboard mock never finishes
loading, so both of its captures show the loading state.

## What changed

1. **Head tags.** Kit favicons (ico, svg, 32, 16), apple touch icon,
   192/512 manifest icons, theme color `#13212E`, and the 1200x630 share
   card as `/og-image.png` with `og:site_name` and image size tags. The
   old icon set and `og-image.jpg` are deleted.
2. **Tokens and type.** `src/styles/tokens.css` holds the kit values
   (`--g1-*`), imported once in `src/index.css`. The existing `--g-*`
   tokens are now built from them. Dark base is brand ink; the light base
   is chalk with white cards and line edges; actions are ink (chalk on
   ink). Archivo (self-hosted variable font) replaces Geist and
   Instrument Serif; Geist Mono stays for tabular numbers.
3. **Logo.** `Logo` primitive (mark, horizontal, stacked x color,
   reversed, black, white) renders the kit SVGs from `src/assets/brand/`
   with the name GridOne. Used in the site header, both footers, the
   homepage fallback, the dashboard, and the organizer workspace.
   Server-rendered email pages and emails moved to brand colors.
4. **Board.** Open squares: kit cell fill with line edges. Claimed:
   text on surface. Winning squares (current match and published
   winners): solid gold, ink text, `gridone-winner` class. Nothing else
   on a board is gold.
5. **Square One.** `SquareOne` primitive on the full-screen loading
   state, dashboard loading, and the empty dashboard. One opacity fade,
   none under reduced motion, `aria-hidden`.
6. **Sweep.** A test blocks gold text, edges, rings, and fills outside
   winners, and misspellings of GridOne. Contrast tests cover ink on
   chalk (15.3:1), action pairs, stone on chalk and white, and ink on
   gold.

## Skipped or adapted

- **Branch.** Pushed to `claude/grid-one-rebrand-ppf1ys` (the branch this
  session is allowed to push), not `rebrand/corner-square`.
- **Google Fonts import.** Left out of `tokens.css`. Archivo is
  self-hosted instead, matching how the app already loads fonts.
- **OS dark mode block.** The kit switches on the phone's dark setting.
  The app picks light or dark per page, so those values became
  `--g1-dark-*` tokens used by the dark base.
- **`og:title`.** Kept each page's own title for search and sharing.
  `og:site_name` is "GridOne" everywhere.
- **Stacked black and white logos.** Not in the kit. Made from the
  stacked color file with only the fill colors swapped.
- **Public viewer header.** Has no logo today, so none was added; adding
  one would push the score down on phones.
- **Cardinal red.** Kept for errors and destructive confirmations only.
  The kit has no error color.
- **Live green.** Kept for an in-progress NFL game.
- **Cyrillic names.** Archivo has no Cyrillic subset, so those names fall
  back to the system font.

## Decisions — September 26

- Keep past quarter winners and the live "currently matching" square
  solid gold. The NOW label marks the live match.
- Make the "Unpaid" payment tag neutral in the square editor and range
  assignment controls. Paid stays turf green; red stays reserved for
  errors and destructive actions. Payment behavior is unchanged.
- Keep text branding in emails. It stays visible when images are blocked
  and needs no hosted logo image.

## Checks run

- `npx tsc --noEmit`: pass.
- `npm run test:unit`: 159 files, 1200 tests pass.
- `npm run build`: pass.
- `npm run design:lint`: 0 errors, 5 warnings (same count as before).
- Playwright chromium, all specs: pass. Run with the preinstalled
  Chromium, since the pinned headless shell is not installed in this
  environment. `guest-invites.spec.ts` needs `PLAYWRIGHT_PORT=5173`; it
  defaults to port 5199 for its second page, which was true before this
  work.
- `npm run test:integration`: not run (needs Docker).
