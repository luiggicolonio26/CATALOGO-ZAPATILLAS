import { NextResponse } from 'next/server';
import { getCatalog, saveCatalog } from '@/lib/store';
import { hasFirecrawlKey, lookupOnStockX, type LookupResult } from '@/lib/firecrawl';

export const dynamic = 'force-dynamic';
// Each StockX lookup costs several seconds, so the route needs the long ceiling
// and the client still has to page through the collection in small batches.
export const maxDuration = 60;

const DEFAULT_BATCH = 4;
const MAX_BATCH = 8;

export async function POST(req: Request) {
  if (!hasFirecrawlKey()) {
    return NextResponse.json(
      {
        error:
          'Falta la variable FIRECRAWL_API_KEY en Vercel. Agregala en Settings → Environment Variables y volvé a desplegar.'
      },
      { status: 400 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // an empty body is fine, defaults apply
  }

  const dryRun = body.dryRun !== false;
  const soloSinFoto = body.soloSinFoto !== false;
  const offset = Math.max(0, Number(body.offset) || 0);
  const limit = Math.min(MAX_BATCH, Math.max(1, Number(body.limit) || DEFAULT_BATCH));

  try {
    const items = await getCatalog();
    const pendientes = soloSinFoto ? items.filter((i) => !i.foto) : items;
    const tanda = pendientes.slice(offset, offset + limit);

    if (tanda.length === 0) {
      return NextResponse.json({
        results: [] as LookupResult[],
        procesados: 0,
        aplicados: 0,
        totalPendientes: pendientes.length,
        siguienteOffset: offset,
        terminado: true
      });
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
        await saveCatalog(actualizados);
      }
    }

    // When changes are written the matched rows leave the "sin foto" set, so the
    // client keeps requesting offset 0; a dry run has to actually advance instead.
    const siguienteOffset = dryRun ? offset + tanda.length : offset + (tanda.length - aplicados);

    return NextResponse.json({
      results,
      procesados: tanda.length,
      aplicados,
      totalPendientes: pendientes.length,
      siguienteOffset,
      terminado: offset + tanda.length >= pendientes.length
    });
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: `No se pudo completar la búsqueda: ${msg}` }, { status: 500 });
  }
}
