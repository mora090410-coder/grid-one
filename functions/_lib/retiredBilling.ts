/** Explicit terminal response for stale clients. Never initializes Stripe or Supabase. */
export const retiredBilling = (): Response => Response.json({
  code: 'BILLING_RETIRED',
  error: 'GridOne no longer offers checkout.',
}, {
  status: 410,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
