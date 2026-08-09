import type { Zapatilla } from './types';

/**
 * Free fallback for when Firecrawl credits run out. StockX serves product shots
 * from a predictable path built out of the product title, so we can guess the
 * URL — but a guess is only used after a HEAD request proves it resolves, so a
 * wrong guess turns into "no photo" instead of a broken or mismatched image.
 */

const ACENTOS = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(ACENTOS, '')
    .replace(/['’]/g, '')
    .replace(/&/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function candidatos(item: Zapatilla): string[] {
  const nombre = item.nombre.trim();
  const conMarca = new RegExp(`^${item.marca}`, 'i').test(nombre) ? nombre : `${item.marca} ${nombre}`;

  const bases = new Set<string>();
  for (const variante of [conMarca, nombre]) {
    const s = slugify(variante);
    if (!s) continue;
    bases.add(`${s}-Product`);
    bases.add(s);
  }

  return [...bases].map(
    (b) =>
      `https://images.stockx.com/images/${b}.jpg?fit=fill&bg=FFFFFF&w=900&h=900&q=90&trim=color`
  );
}

export interface DirectoResult {
  id: string;
  nombre: string;
  codigo: string;
  ok: boolean;
  foto: string | null;
  detalle: string;
}

async function existe(url: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal, redirect: 'follow' });
    if (!res.ok) return false;
    const tipo = res.headers.get('content-type') || '';
    return tipo.startsWith('image/');
  } catch {
    return false;
  }
}

export async function buscarImagenDirecta(item: Zapatilla): Promise<DirectoResult> {
  const base = { id: item.id, nombre: item.nombre, codigo: item.codigo };
  const urls = candidatos(item);

  for (const url of urls) {
    if (await existe(url)) {
      return { ...base, ok: true, foto: url, detalle: 'Imagen de StockX verificada.' };
    }
  }

  return {
    ...base,
    ok: false,
    foto: null,
    detalle: `Ninguna URL de StockX coincidió (${urls.length} variantes probadas).`
  };
}
