// Shared control feel. Every focus-visible ring here is load-bearing: `[data-base]`
// strips the global outline, so these rings are the only focus affordance.
// The lift and press are wrapped in `motion-safe:` so they never run under
// `prefers-reduced-motion: reduce`; color, shadow, and underline states stay on.
// The transition list names `translate` and `scale`, NOT `transform`: Tailwind v4
// compiles `-translate-y-px` and `scale-[0.98]` to those independent properties,
// so a list naming `transform` transitions nothing and the lift/press snap.
const geometry = 'inline-flex items-center justify-center h-11 px-6 rounded-capsule font-ui text-[15px] transition-[background-color,color,box-shadow,translate,scale] duration-[var(--g-dur-state)] ease-[var(--g-ease-state)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-ground';

const press = 'motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98]';
const lift = 'motion-safe:hover:-translate-y-px motion-safe:focus-visible:-translate-y-px';
const primaryLift = 'motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5';

export const primaryLink = `${geometry} group bg-action text-action-text font-semibold hover:bg-action-hover hover:shadow-[0_10px_24px_-12px_var(--g-action)] ${primaryLift} ${press}`;
export const quietLink = `${geometry} bg-panel border border-hairline text-fg hover:bg-panel-hover hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] ${lift} ${press}`;
// Underline wipe: a 1px currentColor gradient grown left-to-right via background-size,
// not text-decoration. Under reduced motion the transition collapses to the reduced
// duration token, so the underline still appears on hover — state on, motion off.
// Forced-colors mode (Windows High Contrast) drops background images entirely, which
// would erase the affordance, so a real `text-decoration` underline takes over there.
export const ghostLink = 'inline-flex items-center h-11 px-2 font-ui text-[15px] text-fg-2 hover:text-fg bg-[linear-gradient(currentColor,currentColor)] bg-no-repeat bg-[length:0%_1px] bg-[position:0_calc(100%-12px)] hover:bg-[length:100%_1px] forced-colors:hover:underline transition-[background-size,color] duration-[var(--g-dur-state)] ease-[var(--g-ease-state)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action rounded-control';
