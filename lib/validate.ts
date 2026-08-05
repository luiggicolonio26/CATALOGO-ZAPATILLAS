import { ESTADOS, type NuevaZapatilla } from './types';

export class ValidationError extends Error {}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function numOrZero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Parses and validates a raw request body into a clean NuevaZapatilla. Throws ValidationError with a user-facing message. */
export function parseZapatillaInput(body: unknown): NuevaZapatilla {
  if (typeof body !== 'object' || body === null) {
    throw new ValidationError('Cuerpo de la solicitud inválido.');
  }
  const b = body as Record<string, unknown>;

  const marca = str(b.marca);
  const nombre = str(b.nombre);
  if (!marca) throw new ValidationError('La marca es obligatoria.');
  if (!nombre) throw new ValidationError('El modelo es obligatorio.');

  const anio = numOrNull(b.anio);
  if (anio !== null && (anio < 1900 || anio > 2100)) {
    throw new ValidationError('El año debe estar entre 1900 y 2100.');
  }

  const costoRetail = numOrZero(b.costoRetail);
  const precioReventa = numOrZero(b.precioReventa);
  if (costoRetail < 0) throw new ValidationError('El precio retail no puede ser negativo.');
  if (precioReventa < 0) throw new ValidationError('El precio de reventa no puede ser negativo.');

  const estadoRaw = str(b.estado) || 'DS';
  const estado = (ESTADOS as readonly string[]).includes(estadoRaw) ? estadoRaw : 'DS';

  return {
    codigo: str(b.codigo),
    marca,
    nombre,
    anio,
    costoRetail,
    precioReventa,
    talla: str(b.talla),
    estado,
    foto: str(b.foto),
    notas: str(b.notas)
  };
}
