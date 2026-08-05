'use client';

import { useMemo, useState } from 'react';
import type { Zapatilla } from '@/lib/types';
import { ESTADOS } from '@/lib/types';
import { normalizeSearch } from '@/lib/format';
import StatsBar from './StatsBar';
import SneakerCard from './SneakerCard';
import ItemModal from './ItemModal';

const ESTADO_LABELS: Record<string, string> = {
  DS: 'DS (nuevo)',
  'Usado - excelente': 'Usado - excelente',
  'Usado - bueno': 'Usado - bueno',
  'Usado - regular': 'Usado - regular'
};

type SortKey =
  | 'recientes'
  | 'nombre'
  | 'anio_desc'
  | 'anio_asc'
  | 'retail_desc'
  | 'reventa_desc'
  | 'ganancia_desc'
  | 'sin_talla'
  | 'sin_foto';

type ModalState = { mode: 'add' } | { mode: 'edit'; item: Zapatilla } | null;

function sortItems(items: Zapatilla[], key: SortKey): Zapatilla[] {
  const copy = [...items];
  switch (key) {
    case 'nombre':
      return copy.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    case 'anio_desc':
      return copy.sort((a, b) => (b.anio ?? 0) - (a.anio ?? 0));
    case 'anio_asc':
      return copy.sort((a, b) => (a.anio ?? 0) - (b.anio ?? 0));
    case 'retail_desc':
      return copy.sort((a, b) => b.costoRetail - a.costoRetail);
    case 'reventa_desc':
      return copy.sort((a, b) => b.precioReventa - a.precioReventa);
    case 'ganancia_desc':
      return copy.sort(
        (a, b) => b.precioReventa - b.costoRetail - (a.precioReventa - a.costoRetail)
      );
    case 'sin_talla':
      return copy.sort((a, b) => (a.talla ? 1 : 0) - (b.talla ? 1 : 0));
    case 'sin_foto':
      return copy.sort((a, b) => (a.foto ? 1 : 0) - (b.foto ? 1 : 0));
    case 'recientes':
    default:
      return copy.sort((a, b) => b.creadoEn - a.creadoEn);
  }
}

export default function CatalogApp({
  initialItems,
  initialError,
  persistenceMode
}: {
  initialItems: Zapatilla[];
  initialError: string | null;
  persistenceMode: 'blob' | 'local';
}) {
  const [items, setItems] = useState<Zapatilla[]>(initialItems);
  const [loadError] = useState<string | null>(initialError);
  const [search, setSearch] = useState('');
  const [marcaFiltro, setMarcaFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [orden, setOrden] = useState<SortKey>('recientes');
  const [modal, setModal] = useState<ModalState>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const marcas = useMemo(
    () => Array.from(new Set(items.map((d) => d.marca).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [items]
  );

  const filtered = useMemo(() => {
    const q = normalizeSearch(search);
    const result = items.filter((item) => {
      if (marcaFiltro && item.marca !== marcaFiltro) return false;
      if (estadoFiltro && item.estado !== estadoFiltro) return false;
      if (q) {
        const hay = normalizeSearch(`${item.nombre} ${item.codigo} ${item.marca}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return sortItems(result, orden);
  }, [items, search, marcaFiltro, estadoFiltro, orden]);

  function handleSaved(saved: Zapatilla) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx === -1) return [...prev, saved];
      const copy = [...prev];
      copy[idx] = saved;
      return copy;
    });
    setModal(null);
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setModal(null);
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="eyebrow">Catálogo personal · Sneakers &amp; Streetwear</div>
          <h1 className="display">
            MI <span>COLECCIÓN</span>
          </h1>
          <StatsBar items={items} />
        </div>
      </div>

      {loadError && (
        <div className="banner">
          <div className="banner-inner">
            <span>{loadError}</span>
          </div>
        </div>
      )}

      {!loadError && persistenceMode === 'local' && !bannerDismissed && (
        <div className="banner">
          <div className="banner-inner info">
            <span>
              Estás guardando en almacenamiento local del servidor (no se sincroniza entre
              dispositivos). Conectá Vercel Blob en el proyecto para que el catálogo se vea igual
              en todos lados.
            </span>
            <button onClick={() => setBannerDismissed(true)}>Ocultar</button>
          </div>
        </div>
      )}

      <div className="toolbar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por modelo o código..."
          aria-label="Buscar"
        />
        <select
          value={marcaFiltro}
          onChange={(e) => setMarcaFiltro(e.target.value)}
          aria-label="Filtrar por marca"
        >
          <option value="">Todas las marcas</option>
          {marcas.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ESTADO_LABELS[e]}
            </option>
          ))}
        </select>
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as SortKey)}
          aria-label="Ordenar"
        >
          <option value="recientes">Más recientes</option>
          <option value="nombre">Nombre A-Z</option>
          <option value="anio_desc">Año (nuevo→viejo)</option>
          <option value="anio_asc">Año (viejo→nuevo)</option>
          <option value="retail_desc">Retail (mayor→menor)</option>
          <option value="reventa_desc">Reventa (mayor→menor)</option>
          <option value="ganancia_desc">Ganancia (mayor→menor)</option>
          <option value="sin_talla">Sin talla primero</option>
          <option value="sin_foto">Sin foto primero</option>
        </select>
        <button className="btn btn-primary" onClick={() => setModal({ mode: 'add' })}>
          + Agregar par
        </button>
      </div>

      <div className="grid-wrap">
        <div className="grid">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="display">SIN RESULTADOS</div>
              <div>Ajustá la búsqueda o los filtros.</div>
            </div>
          ) : (
            filtered.map((item) => (
              <SneakerCard key={item.id} item={item} onOpen={() => setModal({ mode: 'edit', item })} />
            ))
          )}
        </div>
      </div>

      {modal?.mode === 'add' && (
        <ItemModal mode="add" onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {modal?.mode === 'edit' && (
        <ItemModal
          mode="edit"
          item={modal.item}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
