/** Match the seller RPC's unsold predicate exactly, without inferring payment.
 * [] is the canonical blank; [family] is the existing placeholder. Any other
 * recorded name (or ambiguous array) must never be replaced through a buyer link.
 */
export const sellerSquareUnsold = (names: readonly string[] | undefined, family: string): boolean =>
  Boolean(family) && Array.isArray(names) && (names.length === 0 || (names.length === 1 && names[0] === family));
