import type { Zapatilla } from './types';

const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v2/scrape';

export interface LookupResult {
  id: string;
  nombre: string;
  codigo: string;
  ok: boolean;
  /** Populated when ok; either may still be null if StockX only had one of the two. */
  foto: string | null;
  precioReventa: number | null;
  /** User-facing reason when ok is false, or a note when the match looks weak. */
  detalle: string;
}

interface FirecrawlJson {
  imagenUrl?: unknown;
  precioReventa?: unknown;
  nombreEncontrado?: unknown;
  encontrado?: unknown;
}

export function hasFirecrawlKey(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

function stockxSearchUrl(item: Zapatilla): string {
  const term = item.codigo?.trim() || `${item.marca} ${item.nombre}`;
  return `https://stockx.com/search?s=${encodeURIComponent(term)}`;
}

function toPrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const n = Number(cleaned);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

function toImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!/^https:\/\//i.test(url)) return null;
  return url;
}

/**
 * Looks one sneaker up on StockX through Firecrawl. Runs from the deployment
 * (Vercel can reach StockX; Firecrawl also handles StockX's bot protection).
 * Never throws — a failure is reported as ok:false so a bad row can't abort a batch.
 */
export async function lookupOnStockX(item: Zapatilla, signal?: AbortSignal): Promise<LookupResult> {
  const base = { id: item.id, nombre: item.nombre, codigo: item.codigo };

  try {
    const res = await fetch(FIRECRAWL_ENDPOINT, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`
      },
      body: JSON.stringify({
        url: stockxSearchUrl(item),
        formats: [
          {
            type: 'json',
            prompt:
              `Buscá en esta página de resultados de StockX el producto que corresponde a la zapatilla ` +
              `"${item.marca} ${item.nombre}" con código/SKU "${item.codigo}". ` +
              `Devolvé la URL de la imagen principal de ese producto (imagenUrl), su precio de reventa ` +
              `en dólares (precioReventa, solo el número, usá el "lowest ask" o el precio de venta más reciente), ` +
              `y el nombre del producto tal como aparece en StockX (nombreEncontrado). ` +
              `Si no encontrás un producto que claramente coincida, devolvé encontrado:false.`,
            schema: {
              type: 'object',
              properties: {
                encontrado: { type: 'boolean' },
                imagenUrl: { type: 'string' },
                precioReventa: { type: 'number' },
                nombreEncontrado: { type: 'string' }
              },
              required: ['encontrado']
            }
          }
        ],
        onlyMainContent: false,
        proxy: 'stealth',
        waitFor: 3000,
        timeout: 45000
      })
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const hint =
        res.status === 401 || res.status === 403
          ? 'API key de Firecrawl inválida o sin permisos.'
          : res.status === 402
            ? 'Te quedaste sin créditos de Firecrawl.'
            : res.status === 429
              ? 'Firecrawl pidió esperar (límite de velocidad).'
              : `Firecrawl respondió HTTP ${res.status}.`;
      return { ...base, ok: false, foto: null, precioReventa: null, detalle: `${hint} ${body.slice(0, 160)}`.trim() };
    }

    const payload = (await res.json()) as { data?: { json?: FirecrawlJson } };
    const json = payload?.data?.json;
    if (!json || json.encontrado === false) {
      return { ...base, ok: false, foto: null, precioReventa: null, detalle: 'StockX no devolvió una coincidencia clara.' };
    }

    const foto = toImageUrl(json.imagenUrl);
    const precioReventa = toPrice(json.precioReventa);
    if (!foto && precioReventa === null) {
      return { ...base, ok: false, foto: null, precioReventa: null, detalle: 'Se encontró el producto pero sin imagen ni precio usables.' };
    }

    const encontrado = typeof json.nombreEncontrado === 'string' ? json.nombreEncontrado : '';
    return {
      ...base,
      ok: true,
      foto,
      precioReventa,
      detalle: encontrado ? `StockX: ${encontrado}` : 'Encontrado en StockX.'
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...base, ok: false, foto: null, precioReventa: null, detalle: `Error consultando Firecrawl: ${msg}` };
  }
}
