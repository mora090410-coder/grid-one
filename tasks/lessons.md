# GridOne execution lessons

- When handing off an authenticated browser step, do not claim a tab exists from an earlier binding. Re-list the current tabs, open or reclaim the exact tab, verify its selected URL and rendered title, make the browser visible, and only then tell the owner it is ready.
- When the user distinguishes Safari from the Codex in-app browser, treat them as separate authenticated sessions. Verify the exact project reference in the named browser before concluding that account access is blocked.
- Never emit accessibility text after entering a secret, even when the field is expected to stay masked. Validate secret fields only with internal equality/length checks and return sanitized booleans.
- Treat the organizer-owned 10×10 board as the free core object: it must remain visible, editable, and interactive without activation. Gate GridOne services—published viewer links, automatic live-score refresh, live scenarios/updates, and notifications—at explicit entitlement boundaries instead of dimming or disabling the board.
- Never combine an app-wide smooth-scroll owner with a fixed nested organizer scroller. Keep operational screens in normal document flow, scope cinematic scrolling to the landing route, and prove Page Down plus wheel behavior in WebKit at a phone-sized viewport.
- Do not assume a nested PostgREST relationship is always an array. A foreign key backed by a unique constraint is represented as a to-one object; normalize and test both `{ id }` and `[{ id }]` before using relationship shape as an authorization or lifecycle gate.
