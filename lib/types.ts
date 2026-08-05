export const ESTADOS = ['DS', 'Usado - excelente', 'Usado - bueno', 'Usado - regular'] as const;
export type Estado = (typeof ESTADOS)[number];

export interface Zapatilla {
  id: string;
  codigo: string;
  marca: string;
  nombre: string;
  anio: number | null;
  costoRetail: number;
  precioReventa: number;
  talla: string;
  estado: Estado | string;
  foto: string;
  notas: string;
  creadoEn: number;
}

export type NuevaZapatilla = Omit<Zapatilla, 'id' | 'creadoEn'>;
