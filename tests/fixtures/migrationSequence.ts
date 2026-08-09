/**
 * The integration suites assert that the migration directory has no accidental
 * gaps, which catches a migration that was written but never committed. A
 * migration deliberately deleted from history has to be declared here, or that
 * guard misreads the intentional gap as a missing file.
 */

/**
 * 004_entitlements.sql created an `entitlements` table that was superseded by
 * `season_entitlements` in 005_canonical_launch_schema.sql and read by no
 * application code. It was removed rather than left as a confusing no-op.
 */
export const REMOVED_MIGRATION_NUMBERS: ReadonlySet<number> = new Set([4]);

/** Migration numbers expected on disk, from 000 through `maxInclusive`. */
export const expectedMigrationNumbers = (maxInclusive: number): number[] =>
  Array.from({ length: maxInclusive + 1 }, (_, index) => index)
    .filter((index) => !REMOVED_MIGRATION_NUMBERS.has(index));
