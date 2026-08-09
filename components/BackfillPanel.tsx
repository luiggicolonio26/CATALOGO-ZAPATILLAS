'use client';

import { useRef, useState } from 'react';
import { formatMoney } from '@/lib/format';

interface LookupResult {
  id: string;
  nombre: string;
  codigo: string;
  ok: boolean;
  foto: string | null;
  precioReventa: number | null;
  detalle: string;
}

interface BatchResponse {
  results?: LookupResult[];
  procesados?: number;
  aplicados?: number;
  totalPendientes?: number;
  siguienteOffset?: number;
  terminado?: boolean;
  error?: string;
}

type Fase = 'idle' | 'preview' | 'corriendo' | 'fin';

async function pedirTanda(payload: Record<string, unknown>): Promise<BatchResponse> {
  const res = await fetch('/api/backfill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = (await res.json()) as BatchResponse;
  if (!res.ok) throw new Error(json.error || 'La búsqueda falló.');
  return json;
}

export default function BackfillPanel({ onDone }: { onDone: () => void }) {
  const [fase, setFase] = useState<Fase>('idle');
  const [muestra, setMuestra] = useState<LookupResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aplicados, setAplicados] = useState(0);
  const [procesados, setProcesados] = useState(0);
  const [total, setTotal] = useState(0);
  const [fallos, setFallos] = useState<LookupResult[]>([]);
  const cancelar = useRef(false);

  async function probar() {
    setError(null);
    setFase('corriendo');
    try {
      const data = await pedirTanda({ dryRun: true, limit: 3, offset: 0 });
      setMuestra(data.results ?? []);
      setTotal(data.totalPendientes ?? 0);
      setFase('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La búsqueda falló.');
      setFase('idle');
    }
  }

  async function correrTodo() {
    setError(null);
    setFase('corriendo');
    cancelar.current = false;
    let hechos = 0;
    let aplicadosTotal = 0;
    const malos: LookupResult[] = [];

    try {
      // Applied rows drop out of the pending set, so the batch window stays at 0
      // and only rows that failed accumulate ahead of it.
      let offset = 0;
      for (let vuelta = 0; vuelta < 200; vuelta++) {
        if (cancelar.current) break;
        const data = await pedirTanda({ dryRun: false, limit: 4, offset });
        const res = data.results ?? [];
        if (res.length === 0) break;

        hechos += res.length;
        aplicadosTotal += data.aplicados ?? 0;
        malos.push(...res.filter((r) => !r.ok));

        setProcesados(hechos);
        setAplicados(aplicadosTotal);
        setTotal(data.totalPendientes ?? 0);
        setFallos([...malos]);

        offset = data.siguienteOffset ?? offset + res.length;
        if (data.terminado) break;
      }
      setFase('fin');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La búsqueda falló.');
      setFase('fin');
      onDone();
    }
  }

  return (
    <div className="backfill">
      {fase === 'idle' && (
        <>
          <p className="backfill-lead">
            Busca cada par en StockX por su código y completa la foto y el precio de reventa.
            Primero probamos con 3 para que veas qué devuelve.
          </p>
          <button className="btn btn-primary" onClick={probar}>
            Probar con 3 pares
          </button>
        </>
      )}

      {fase === 'corriendo' && (
        <>
          <p className="backfill-lead mono">
            Consultando StockX… {procesados > 0 ? `${procesados} revisados, ${aplicados} completados` : ''}
          </p>
          {procesados > 0 && (
            <button className="btn btn-small" onClick={() => (cancelar.current = true)}>
              Detener
            </button>
          )}
        </>
      )}

      {fase === 'preview' && (
        <>
          <p className="backfill-lead">
            Esto encontró en los primeros 3. Si los datos están bien, seguimos con los {total} pares
            sin foto.
          </p>
          <ul className="backfill-list">
            {muestra.map((r) => (
              <li key={r.id} className={r.ok ? 'ok' : 'bad'}>
                <div className="bf-photo">
                  {r.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.foto} alt={r.nombre} referrerPolicy="no-referrer" />
                  ) : (
                    <span className="mono">sin foto</span>
                  )}
                </div>
                <div className="bf-info">
                  <strong>{r.nombre}</strong>
                  <span className="mono">{r.codigo}</span>
                  <span className="mono">
                    {r.precioReventa !== null ? `Reventa ${formatMoney(r.precioReventa)}` : 'sin precio'}
                  </span>
                  <span className="bf-detalle">{r.detalle}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="backfill-actions">
            <button className="btn" onClick={() => setFase('idle')}>
              No, cancelar
            </button>
            <button className="btn btn-primary" onClick={correrTodo}>
              Se ven bien, completar los {total}
            </button>
          </div>
        </>
      )}

      {fase === 'fin' && (
        <>
          <p className="backfill-lead">
            Listo: {aplicados} de {procesados} pares completados.
            {fallos.length > 0 ? ` ${fallos.length} no se pudieron resolver.` : ''}
          </p>
          {fallos.length > 0 && (
            <ul className="backfill-fallos">
              {fallos.slice(0, 12).map((f) => (
                <li key={f.id}>
                  <span className="mono">{f.codigo || '—'}</span> {f.nombre} — {f.detalle}
                </li>
              ))}
              {fallos.length > 12 && <li>…y {fallos.length - 12} más.</li>}
            </ul>
          )}
          <button className="btn" onClick={() => setFase('idle')}>
            Volver
          </button>
        </>
      )}

      {error && <div className="modal-error">{error}</div>}
    </div>
  );
}
