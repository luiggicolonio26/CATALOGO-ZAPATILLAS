import fs from 'node:fs';
import path from 'node:path';
import { list, put } from '@vercel/blob';
import { SEED_CATALOG } from './seed-data';
import type { Zapatilla } from './types';

const CATALOG_PATHNAME = 'catalogo-zapatillas/catalog.json';
const LOCAL_FALLBACK_PATH = path.join(process.cwd(), 'data', 'catalogo.local.json');

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function readLocalFallback(): Zapatilla[] | null {
  try {
    const raw = fs.readFileSync(LOCAL_FALLBACK_PATH, 'utf8');
    return JSON.parse(raw) as Zapatilla[];
  } catch {
    return null;
  }
}

function writeLocalFallback(items: Zapatilla[]): void {
  fs.mkdirSync(path.dirname(LOCAL_FALLBACK_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_FALLBACK_PATH, JSON.stringify(items, null, 2), 'utf8');
}

async function readFromBlob(): Promise<Zapatilla[] | null> {
  const { blobs } = await list({ prefix: CATALOG_PATHNAME, limit: 1 });
  const entry = blobs.find((b) => b.pathname === CATALOG_PATHNAME);
  if (!entry) return null;
  const res = await fetch(entry.url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`No se pudo leer el catálogo desde Blob (HTTP ${res.status})`);
  return (await res.json()) as Zapatilla[];
}

async function writeToBlob(items: Zapatilla[]): Promise<void> {
  await put(CATALOG_PATHNAME, JSON.stringify(items), {
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
    const existing = await readFromBlob();
    // An empty catalog is treated as "never seeded" (e.g. a deploy that ran before
    // Blob was connected fell through to the local fallback and never persisted
    // anything to Blob) so it self-heals back to the starting collection instead
    // of staying stuck empty.
    if (existing && existing.length > 0) return existing;
    await writeToBlob(SEED_CATALOG);
    return SEED_CATALOG;
  }

  const existing = readLocalFallback();
  if (existing && existing.length > 0) return existing;
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
