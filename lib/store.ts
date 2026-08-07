import fs from 'node:fs';
import path from 'node:path';
import { list, put } from '@vercel/blob';
import { SEED_CATALOG } from './seed-data';
import { CURRENT_DATA_VERSION, migrateCatalog } from './migrations';
import type { Zapatilla } from './types';

const CATALOG_PATHNAME = 'catalogo-zapatillas/catalog.json';
const LOCAL_FALLBACK_PATH = path.join(process.cwd(), 'data', 'catalogo.local.json');

/**
 * On-disk shape. Older catalogs were stored as a bare array with no version;
 * those read back as version 0 so pending migrations still apply to them.
 */
interface CatalogFile {
  version: number;
  items: Zapatilla[];
}

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function parseCatalogFile(raw: unknown): CatalogFile | null {
  if (Array.isArray(raw)) return { version: 0, items: raw as Zapatilla[] };
  if (raw && typeof raw === 'object' && Array.isArray((raw as CatalogFile).items)) {
    const file = raw as CatalogFile;
    return { version: Number(file.version) || 0, items: file.items };
  }
  return null;
}

function serialize(items: Zapatilla[]): string {
  return JSON.stringify({ version: CURRENT_DATA_VERSION, items } satisfies CatalogFile);
}

function readLocalFallback(): CatalogFile | null {
  try {
    return parseCatalogFile(JSON.parse(fs.readFileSync(LOCAL_FALLBACK_PATH, 'utf8')));
  } catch {
    return null;
  }
}

function writeLocalFallback(items: Zapatilla[]): void {
  fs.mkdirSync(path.dirname(LOCAL_FALLBACK_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_FALLBACK_PATH, serialize(items), 'utf8');
}

async function readFromBlob(): Promise<CatalogFile | null> {
  const { blobs } = await list({ prefix: CATALOG_PATHNAME, limit: 1 });
  const entry = blobs.find((b) => b.pathname === CATALOG_PATHNAME);
  if (!entry) return null;
  const res = await fetch(entry.url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`No se pudo leer el catálogo desde Blob (HTTP ${res.status})`);
  return parseCatalogFile(await res.json());
}

async function writeToBlob(items: Zapatilla[]): Promise<void> {
  await put(CATALOG_PATHNAME, serialize(items), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json'
  });
}

/** Whether persistence is backed by Vercel Blob (shared across devices) or a local file (this machine only). */
export function persistenceMode(): 'blob' | 'local' {
  return hasBlobToken() ? 'blob' : 'local';
}

export async function getCatalog(): Promise<Zapatilla[]> {
  if (hasBlobToken()) {
    const stored = await readFromBlob();
    // An empty catalog is treated as "never seeded" (e.g. a deploy that ran before
    // Blob was connected fell through to the local fallback and never persisted
    // anything to Blob) so it self-heals back to the starting collection instead
    // of staying stuck empty.
    if (stored && stored.items.length > 0) {
      const { items, changed } = migrateCatalog(stored.items, stored.version);
      if (changed) await writeToBlob(items);
      return items;
    }
    await writeToBlob(SEED_CATALOG);
    return SEED_CATALOG;
  }

  const stored = readLocalFallback();
  if (stored && stored.items.length > 0) {
    const { items, changed } = migrateCatalog(stored.items, stored.version);
    if (changed) {
      try {
        writeLocalFallback(items);
      } catch (err) {
        console.warn('No se pudo guardar la migración del catálogo', err);
      }
    }
    return items;
  }

  try {
    writeLocalFallback(SEED_CATALOG);
  } catch (err) {
    // The local file fallback is for `next dev`; on a read-only deployment
    // filesystem (e.g. Vercel without Blob configured) this write can't
    // succeed. Serve the seed from memory instead of failing the page.
    console.warn('No se pudo escribir el respaldo local del catálogo', err);
  }
  return SEED_CATALOG;
}

export async function saveCatalog(items: Zapatilla[]): Promise<void> {
  if (hasBlobToken()) {
    await writeToBlob(items);
  } else {
    writeLocalFallback(items);
  }
}
