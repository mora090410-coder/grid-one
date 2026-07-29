---
name: GridOne
description: Game-Day Horizon — a football-squares board moves through named phases from setup to Final.
colors:
  night: "#0E0F12"
  chyron: "#16181D"
  broadcast-white: "#EFF0F1"
  newsprint: "#DEE0E1"
  cardinal: "#8F1D2C"
  cardinal-deep: "#6E1622"
  gold: "#FFC72C"
  gold-deep: "#E0A600"
  live: "#22C55E"
---

# GridOne Design System

## Direction contract

**THESIS:** Game day is a sequence of confidence states, not a dashboard. GridOne turns setup, number draw, pregame, live quarters, and Final into named horizons whose light and hierarchy make the board's state unmistakable.

**OWN-WORLD:** Cardinal, gold, cool white, newsprint, and ink move through matte horizontal fields. A narrow horizon line marks the active phase. Controls are precise slabs with quiet key lines; data sits in tabular instrument typography.

**STORY:** The organizer moves **Fill → Reconcile → Draw → Preview → Go Live**. The viewer arrives inside the current game phase and immediately sees My Squares, who wins now, and what score makes them win next.

**FIRST VIEWPORT:** One dominant state field, one active horizon, one primary action, and the board or personal game state as the artifact—not a card grid.

**FORM:** Game-Day Horizon, selected from the stagecraft cyclorama direction. Phase changes are the composition and the motion system; light is information.

## Creative north star

A theater cyclorama makes time and atmosphere legible without adding objects. GridOne applies that discipline to a board lifecycle. The surface moves from quiet setup light through the cardinal tension of the draw, pregame stillness, active live color, and the gold-white clarity of a settled result.

This is not a gradient aesthetic. It is a **phase system**:

- Every horizon is named in text.
- Every phase has a semantic state and action.
- Color, luminance, typography, and motion change together.
- A still or reduced-motion surface remains completely understandable.

The product must feel engineered and calm at the level of leading consumer platforms: minimal decisions per screen, immediate feedback, exceptionally clear state, generous touch geometry, and no ornamental control.

## The phase sequence

### 1. Fill — working daylight

- Ground: broadcast white and newsprint.
- Cardinal appears as a thin horizon/ruler and active selection.
- The board is the dominant working surface.
- Remaining squares and assignment counts stay visible as a finite inventory.
- The primary action advances to Reconcile only when the board has meaningful data.

### 2. Reconcile — late daylight

- Ground remains light, with cardinal bands gathering at the lower horizon.
- Exceptions lead: unassigned, unpaid, duplicates, and missing participant detail.
- The surface narrows decisions rather than exposing the full editor again.
- “Ready for draw” is a factual checklist, not a celebration.

### 3. Draw — cardinal horizon

- Cardinal becomes the dominant field.
- Gold is reserved for the commit action and the revealed settled digits.
- The random draw is previewed, then explicitly committed.
- The UI explains that publication locks the result and records the draw.
- Motion is ceremonial but brief: digits resolve in place; no slot-machine treatment.

### 4. Preview — pregame dusk

- Ink/chyron becomes the field with a low cardinal horizon and cool-white content.
- The exact public phone view is the artifact.
- Draft/private status is unmistakable.
- The primary action is Unlock or Publish; secondary action returns to correction.

### 5. Go Live / Pregame — night field

- A calm ink field carries the board before kickoff.
- Cardinal marks team/board identity.
- Live green does not appear until the game is actually in progress.
- Automatic beta source and freshness are explicit even before a score exists.

### 6. Live — active horizon

- The board or personal viewer summary sits against a controlled ink-to-cardinal horizon.
- Live green is a small redundant signal paired with “LIVE.”
- Score authority states plainly that viewer updates arrive about every minute; never imply instant or realtime delivery.
- Scores and current-quarter scenarios are the highest-contrast instruments.
- The background never competes with names or numbers.

### 7. Final — day wash

- The surface resolves to broadcast white with a gold horizon.
- Completed winners and final score become stable record, not animation.
- Gold marks settled milestones; it never becomes general decoration.
- Archive and share actions are quiet and secondary.

## Palette rules

### Preserved palette

- **Cardinal `#8F1D2C`:** identity and gathering tension. It can own full fields during Draw and active game bands.
- **Cardinal deep `#6E1622`:** depth between opaque phase planes.
- **Gold `#FFC72C`:** commitment and resolved outcome.
- **Gold deep `#E0A600`:** legible gold-state text or pressed commitment.
- **Broadcast white `#EFF0F1`:** working daylight and Final clarity.
- **Newsprint `#DEE0E1`:** quiet structure and incomplete inventory.
- **Night `#0E0F12` / Chyron `#16181D`:** Pregame/Live fields and instrument slabs.
- **Live green `#22C55E`:** active game only.

### Non-negotiable meanings

- Live green never means generic success, saved, paid, valid, or positive.
- Gold never means “interesting”; it means committed or settled.
- Error uses cardinal plus explicit language and iconography, never color alone.
- Paid/unpaid cannot rely on green/red alone.
- Phase changes remain legible without color.

### Horizon rendering

Broad phase transitions may use controlled color interpolation or soft light fields, but:

- They occupy a page-scale horizon, not individual buttons or cards.
- They use only documented palette colors and derived opacity.
- They never reduce text contrast.
- They never become glossy rainbow gradients.
- Fine grain is permitted as subtle structure; glass blur and glow are not the component language.

## Typography

Typography behaves like cues and instruments.

- **Display/cue:** a distinctive narrow grotesk with an engineered, staged presence. Archivo may remain during implementation only if its width-axis result reaches the visual bar; otherwise replace it with a more characterful production-ready variable face.
- **Body/control:** a highly legible workhorse grotesk. It must remain calm at small sizes and large-text settings.
- **Data:** Chivo Mono or an equivalent tabular mono for scores, clocks, axis digits, counts, prices, and square coordinates.

Rules:

- Scores, clocks, counts, coordinates, dates, and prices use tabular numerals.
- Cue labels are short, uppercase, and never replace explanatory text.
- Body copy is sentence case and direct.
- The smallest meaningful mobile text is 12 CSS pixels; participant cells use reduced names plus accessible full detail.
- One dominant statement per viewport. Do not build simultaneous headline competitions.

## Composition

### One horizon, one artifact, one action

Every primary surface has:

1. A named current phase.
2. One dominant artifact: board, reconciliation list, draw, public preview, personal viewer summary, or final record.
3. One primary next action.

Secondary controls recede into contextual menus or the next phase. Repeated equal-weight cards are prohibited.

### Organizer topology

The organizer experience is a persistent five-cue sequence:

`FILL — RECONCILE — DRAW — PREVIEW — GO LIVE`

- The cue strip shows current, complete, blocked, and upcoming states.
- It remains reachable without becoming a giant stepper.
- The current phase owns the page; other phases do not expose their controls early.
- Autosave, last saved time, and errors stay adjacent to the artifact.
- Dangerous correction after publication is a separate, explicit recovery path.

### Viewer topology

Phone-first order:

1. Matchup, period, score authority, and freshness.
2. My Squares / Find My Squares.
3. Current winner and personalized next-score scenarios.
4. Full board.
5. Completed winners and published board details.

Desktop may place personal summary and full board side by side, but reading order remains the same.

### Full board

- The 10×10 board is a navigable instrument, not a shrunk poster.
- Mobile uses an explicit pan/zoom viewport, sticky axes, reset control, and orientation cue.
- Cells expose privacy-reduced display text by default.
- Tap, focus, or search reveals the full organizer-entered display name.
- Winning state uses gold plus a milestone label and accessible description.

## Components

### Phase cue strip

- Named phase, status, concise blocker/next fact.
- Current phase uses the active horizon line.
- Completed phases use text/icon state, never generic green.

### Primary action

- One per phase.
- Opaque gold on ink for commitment or cardinal/white when progressing without commitment.
- Minimum 44×44 CSS pixels.
- Label describes the outcome: “Review assignments,” “Commit number draw,” “Publish viewer link.”

### Instrument slab

- Opaque night or broadcast-white plane.
- One-pixel key line or phase edge.
- Used for score, clock, source, freshness, and compact control clusters.
- Not repeated into a card grid.

### Dialog

- True semantic dialog with title, description, initial focus, focus containment, Escape, and focus return.
- High-stakes dialogs name what changes and what remains recoverable.
- Never use browser `alert` or `confirm` for product actions.

### Status

Every async surface supports:

- Idle
- Working
- Succeeded with durable result
- Failed with human explanation and recovery
- Stale when prior data remains visible

Status text and recovery stay near the affected object.

## Motion

Motion is stage cueing:

- Phase changes raise or lower the horizon and change luminance.
- Scores roll or crossfade within fixed tabular width.
- Winning squares receive one decisive gold wipe.
- Number draw resolves with controlled sequential timing and a final lock.
- The landing may scrub through the full game-day light sequence.
- Organizer tasks never wait for decorative motion.

Reduced motion:

- Uses discrete named phase cuts.
- Keeps every score, winner, source, and sequence state visible.
- Removes scrub dependency, parallax, cursor effects, and spatial drift.

## Accessibility and performance

- WCAG AA contrast at actual rendered size.
- 44×44 minimum targets and visible focus on every interactive control.
- Complete keyboard equivalence for board, scenarios, dialogs, and navigation.
- No critical meaning by color or motion alone.
- Live-region announcements are reserved for material score/milestone changes, not every poll.
- The game-day viewer must remain useful on a constrained mobile connection.
- Phase light is CSS/SVG first; no WebGL requirement.
- Large marketing motion loads outside the critical viewer path.

## Imagery

GridOne should rarely need photography. The product artifact is the board.

- Use full-fidelity synthetic boards labeled as demonstrations.
- Real screenshots become proof only after real product state exists.
- Do not add stadium stock photography, football clip art, team trademarks, trophy icons, or AI-generated crowds.
- Fine atmospheric grain and horizon light may be authored as lightweight procedural assets.

## Absolute bans

- Generic dashboard card grids
- Glassmorphism, floating translucent panels, glow as structure
- Decorative sports imagery and betting visual language
- Green for generic success
- Gold as general emphasis
- Hidden score source/freshness
- Hover-only meaning
- Tiny full-name cells as the primary mobile solution
- Invented payout, customer, performance, or fundraising claims
- UI vocabulary that drifts among board/pool/contest/player/guest
