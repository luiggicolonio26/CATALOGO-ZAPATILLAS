import { NextResponse } from 'next/server';
import { getCatalog, saveCatalog } from '@/lib/store';
import { hasFirecrawlKey, lookupOnStockX, type LookupResult } from '@/lib/firecrawl';

export const dynamic = 'force-dynamic';
// Each StockX lookup costs several seconds, so the route needs the long ceiling
// and callers still have to page through the collection in small batches.
export const maxDuration = 60;

const DEFAULT_BATCH = 4;
const MAX_BATCH = 10;

interface Opciones {
  dryRun: boolean;
  soloSinFoto: boolean;
  offset: number;
  limit: number;
}

async function ejecutar({ dryRun, soloSinFoto, offset, limit }: Opciones) {
  const items = await getCatalog();
  const pendientes = soloSinFoto ? items.filter((i) => !i.foto) : items;
  const tanda = pendientes.slice(offset, offset + limit);

  if (tanda.length === 0) {
    return {
      results: [] as LookupResult[],
      procesados: 0,
      aplicados: 0,
      totalPendientes: pendientes.length,
      siguienteOffset: offset,
      terminado: true
    };
  }

  const results = await Promise.all(tanda.map((item) => lookupOnStockX(item)));

  let aplicados = 0;
  if (!dryRun) {
    const porId = new Map(results.filter((r) => r.ok).map((r) => [r.id, r]));
    if (porId.size > 0) {
      const actualizados = items.map((item) => {
        const hit = porId.get(item.id);
        if (!hit) return item;
        aplicados += 1;
        return {
          ...item,
          foto: hit.foto ?? item.foto,
          precioReventa: hit.precioReventa ?? item.precioReventa
        };
      });
      await saveCatalog(actualizados, items);
    }
  }

  // When changes are written the matched rows leave the "sin foto" set, so the
  // window stays at 0 and only rows that failed accumulate ahead of it.
  const siguienteOffset = dryRun ? offset + tanda.length : offset + (tanda.length - aplicados);

  return {
    results,
    procesados: tanda.length,
    aplicados,
    totalPendientes: pendientes.length,
    siguienteOffset,
    terminado: offset + tanda.length >= pendientes.length
  };
}

function faltaKey() {
  return NextResponse.json(
    {
      error:
        'Falta la variable FIRECRAWL_API_KEY en Vercel. Agregala en Settings → Environment Variables y volvé a desplegar.'
    },
    { status: 400 }
  );
}

function manejarError(err: unknown) {
  console.error(err);
  const msg = err instanceof Error ? err.message : 'Error desconocido';
  return NextResponse.json({ error: `No se pudo completar la búsqueda: ${msg}` }, { status: 500 });
}

export async function POST(req: Request) {
  if (!hasFirecrawlKey()) return faltaKey();

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // an empty body is fine, defaults apply
  }

  try {
    return NextResponse.json(
      await ejecutar({
        dryRun: body.dryRun !== false,
        soloSinFoto: body.soloSinFoto !== false,
        offset: Math.max(0, Number(body.offset) || 0),
        limit: Math.min(MAX_BATCH, Math.max(1, Number(body.limit) || DEFAULT_BATCH))
      })
    );
  } catch (err) {
    return manejarError(err);
  }
}

/**
 * GET runs the same batch so the fill can be driven from outside the browser
 * (a scheduled job, or an operator paging through it) without a POST client.
 * Writing requires ?apply=1 so a bare GET stays a harmless preview.
 */
export async function GET(req: Request) {
  if (!hasFirecrawlKey()) return faltaKey();

  const params = new URL(req.url).searchParams;

  // Progress check that neither scrapes nor spends credits, so the fill can be
  // verified between batches.
  if (params.get('stats') === '1') {
    try {
      const items = await getCatalog();
      return NextResponse.json({
        total: items.length,
        conFoto: items.filter((i) => i.foto).length,
        sinFoto: items.filter((i) => !i.foto).length,
        conReventaDistinta: items.filter((i) => i.precioReventa !== i.costoRetail).length,
        muestra: items.slice(0, 3).map((i) => ({ codigo: i.codigo, foto: i.foto ? 'si' : 'no' }))
      });
    } catch (err) {
      return manejarError(err);
    }
  }

  try {
    const salida = await ejecutar({
      dryRun: params.get('apply') !== '1',
      soloSinFoto: params.get('todos') !== '1',
      offset: Math.max(0, Number(params.get('offset')) || 0),
      limit: Math.min(MAX_BATCH, Math.max(1, Number(params.get('limit')) || DEFAULT_BATCH))
    });

    // The per-row payload is long; an operator paging through the whole
    // collection only needs the tally plus whatever refused to resolve.
    if (params.get('compact') === '1') {
      const { results, ...resumen } = salida;
      return NextResponse.json({
        ...resumen,
        fallos: results.filter((r) => !r.ok).map((r) => `${r.codigo || '—'} ${r.nombre}: ${r.detalle}`)
      });
    }
    return NextResponse.json(salida);
  } catch (err) {
    return manejarError(err);
  }
}
