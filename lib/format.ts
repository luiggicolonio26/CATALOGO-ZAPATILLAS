export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('es')}`;
}

const COMBINING_DIACRITICS = new RegExp(
  '[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']',
  'g'
);

export function normalizeSearch(s: string): string {
  return s.normalize('NFD').replace(COMBINING_DIACRITICS, '').toLowerCase().trim();
}

/** Deterministic pseudo-barcode bars derived from a seed string, purely decorative. */
export function barcodeBars(seed: string): { width: number; height: number }[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const bars: { width: number; height: number }[] = [];
  for (let i = 0; i < 22; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    bars.push({ width: 1 + (h % 3), height: 40 + (h % 60) });
  }
  return bars;
}
