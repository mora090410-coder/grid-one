# GridOne execution lessons

- When the user distinguishes Safari from the Codex in-app browser, treat them as separate authenticated sessions. Verify the exact project reference in the named browser before concluding that account access is blocked.
- Never emit accessibility text after entering a secret, even when the field is expected to stay masked. Validate secret fields only with internal equality/length checks and return sanitized booleans.
