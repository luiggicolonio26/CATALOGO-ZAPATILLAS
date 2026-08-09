import fs from 'node:fs';
import path from 'node:path';
import { list, put } from '@vercel/blob';
import { SEED_CATALOG } from './seed-data';
import { CURRENT_DATA_VERSION, migrateCatalog } from './migrations';
import type { Zapatilla } from './types';

const CATALOG_PATHNAME = 'catalogo-zapatillas/catalog.json';
const BACKUP_PREFIX = 'catalogo-zapatillas/backups/';
const LOCAL_FALLBACK_PATH = path.join(process.cwd(), 'data', 'catalogo.local.json');

/**
 * On-disk shape. Older catalogs were stored as a bare array with no version;
 * those read back as version 0 so pending migrations still apply to them.
 */
interface CatalogFile {
  version: number;
  items: Zapatilla[];
}

/**
 * Reading the store has three distinct outcomes and they must not be conflated:
 * 'found' has data, 'empty' proves the store has never been written, and a
 * thrown error means we simply do not know. Seeding on anything but 'empty'
 * overwrites real data — that is what wiped the collection's photos once.
 */
type ReadOutcome = { estado: 'found'; file: CatalogFile } | { estado: 'empty' };

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

function readLocalFallback(): ReadOutcome {
  let raw: string;
  try {
    raw = fs.readFileSync(LOCAL_FALLBACK_PATH, 'utf8');
  } catch {
    return { estado: 'empty' };
  }
  const parsed = parseCatalogFile(JSON.parse(raw));
  if (!parsed) throw new Error('El respaldo local del catálogo está corrupto.');
  return { estado: 'found', file: parsed };
}

function writeLocalFallback(items: Zapatilla[]): void {
  fs.mkdirSync(path.dirname(LOCAL_FALLBACK_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_FALLBACK_PATH, serialize(items), 'utf8');
}

async function fetchJson(url: string): Promise<unknown> {
  let ultimoError = '';
  // The blob CDN can answer 403 briefly after a write; a transient miss must not
  // look like "no data", so retry before giving up and never fall through to seed.
  for (let intento = 0; intento < 3; intento++) {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) return res.json();
    ultimoError = `HTTP ${res.status}`;
    if (res.status !== 403 && res.status !== 404 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 400 * (intento + 1)));
  }
  throw new Error(`No se pudo leer el catálogo desde Blob (${ultimoError})`);
}

async function readFromBlob(): Promise<ReadOutcome> {
  const { blobs } = await list({ prefix: CATALOG_PATHNAME, limit: 100 });
  const entry = blobs.find((b) => b.pathname === CATALOG_PATHNAME);
  if (!entry) return { estado: 'empty' };

  const parsed = parseCatalogFile(await fetchJson(entry.downloadUrl || entry.url));
  if (!parsed) throw new Error('El catálogo guardado en Blob tiene un formato inesperado.');
  return { estado: 'found', file: parsed };
}

async function writeToBlob(items: Zapatilla[], pathname = CATALOG_PATHNAME): Promise<void> {
  await put(pathname, serialize(items), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json'
  });
}

/**
 * Keeps a copy of what is about to be replaced. Best effort on purpose: losing a
 * backup is not a reason to block the write the user actually asked for.
 */
async function backup(items: Zapatilla[]): Promise<void> {
  if (items.length === 0) return;
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await writeToBlob(items, `${BACKUP_PREFIX}${stamp}.json`);
  } catch (err) {
    console.warn('No se pudo guardar el respaldo previo del catálogo', err);
  }
}

/** Whether persistence is backed by Vercel Blob (shared across devices) or a local file (this machine only). */
export function persistenceMode(): 'blob' | 'local' {
  return hasBlobToken() ? 'blob' : 'local';
}

export async function getCatalog(): Promise<Zapatilla[]> {
  if (hasBlobToken()) {
    // A read failure throws out of here on purpose: callers must not receive the
    // seed and then persist it over a catalog that was merely unreadable.
    const outcome = await readFromBlob();
    if (outcome.estado === 'found' && outcome.file.items.length > 0) {
      const { items, changed } = migrateCatalog(outcome.file.items, outcome.file.version);
      if (changed) await writeToBlob(items);
      return items;
    }
    await writeToBlob(SEED_CATALOG);
    return SEED_CATALOG;
  }

  const outcome = readLocalFallback();
  if (outcome.estado === 'found' && outcome.file.items.length > 0) {
    const { items, changed } = migrateCatalog(outcome.file.items, outcome.file.version);
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
    // filesystem this write can't succeed. Serve the seed from memory instead.
    console.warn('No se pudo escribir el respaldo local del catálogo', err);
  }
  return SEED_CATALOG;
}

export async function saveCatalog(items: Zapatilla[], previos?: Zapatilla[]): Promise<void> {
  if (hasBlobToken()) {
    if (previos) await backup(previos);
    await writeToBlob(items);
  } else {
    writeLocalFallback(items);
  }
}
