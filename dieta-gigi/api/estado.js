import { list, put } from '@vercel/blob';

/**
 * Estado compartido de lo que ya se le dio a Gigi hoy.
 *
 * GET  -> { fecha, hechos, actualizado }
 * POST -> { id, hecho }  marca o desmarca UNA cosa y devuelve el estado completo
 *
 * El POST manda solo el cambio, no la lista entera: si dos personas marcan a la
 * vez desde teléfonos distintos, cada una fusiona sobre lo último guardado en vez
 * de pisar lo que hizo la otra.
 */

const RUTA = 'gigi/estado-del-dia.json';

function fechaDeHoy() {
  // Amsterdam, para que el dia cambie cuando cambia alli y no en UTC
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return f.format(new Date());
}

function vacio() {
  return { fecha: fechaDeHoy(), hechos: {}, actualizado: Date.now() };
}

async function leer() {
  const { blobs } = await list({ prefix: RUTA, limit: 100 });
  const entrada = blobs.find((b) => b.pathname === RUTA);
  if (!entrada) return vacio();

  // La ruta es fija, asi que el CDN sirve copias viejas: hay que romper la cache
  // o se pierden marcas que otro acaba de hacer.
  const url = new URL(entrada.downloadUrl || entrada.url);
  url.searchParams.set('v', Date.now().toString(36));
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`No se pudo leer el estado (HTTP ${res.status})`);

  const guardado = await res.json();
  if (!guardado || typeof guardado !== 'object') return vacio();

  // Al cambiar el dia se empieza de cero: lo de ayer ya no aplica.
  if (guardado.fecha !== fechaDeHoy()) return vacio();
  return {
    fecha: guardado.fecha,
    hechos: guardado.hechos && typeof guardado.hechos === 'object' ? guardado.hechos : {},
    actualizado: Number(guardado.actualizado) || Date.now()
  };
}

async function escribir(estado) {
  await put(RUTA, JSON.stringify(estado), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 0
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Sin almacenamiento la pagina sigue funcionando sola, guardando en el
    // telefono; este codigo le dice que no intente sincronizar.
    return res.status(503).json({ error: 'sin_almacenamiento' });
  }

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await leer());
    }

    if (req.method === 'POST') {
      const cuerpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const id = typeof cuerpo.id === 'string' ? cuerpo.id.slice(0, 60) : '';
      if (!id) return res.status(400).json({ error: 'falta_id' });

      const estado = await leer();
      if (cuerpo.hecho) estado.hechos[id] = 1;
      else delete estado.hechos[id];
      estado.actualizado = Date.now();

      await escribir(estado);
      return res.status(200).json(estado);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'metodo_no_permitido' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'fallo_almacenamiento' });
  }
}
