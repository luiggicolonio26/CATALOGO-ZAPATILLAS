import type { Zapatilla } from './types';

/**
 * Bump this when adding a migration below. Stored catalogs remember the version
 * they were last migrated to, so each migration runs exactly once and never
 * re-applies over edits the user made afterwards.
 */
export const CURRENT_DATA_VERSION = 1;

/** Ordered migrations. Index i upgrades a catalog from version i to version i + 1. */
const MIGRATIONS: ((items: Zapatilla[]) => Zapatilla[])[] = [
  // 0 -> 1: the whole collection is US 8.5, so backfill the size that was never
  // filled in when the catalog was first imported from the spreadsheet.
  (items) => items.map((item) => ({ ...item, talla: '8.5' }))
];

export interface MigrationResult {
  items: Zapatilla[];
  changed: boolean;
}

export function migrateCatalog(items: Zapatilla[], fromVersion: number): MigrationResult {
  let current = items;
  let version = Math.max(0, Math.min(fromVersion, CURRENT_DATA_VERSION));

  while (version < CURRENT_DATA_VERSION) {
    current = MIGRATIONS[version](current);
    version += 1;
  }

  return { items: current, changed: version !== fromVersion };
}
