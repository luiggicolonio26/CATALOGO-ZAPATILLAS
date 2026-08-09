'use client';

import { useRef, useState } from 'react';
import type { NuevaZapatilla, Zapatilla } from '@/lib/types';
import { ESTADOS } from '@/lib/types';

const ESTADO_LABELS: Record<string, string> = {
  DS: 'DS (nuevo)',
  'Usado - excelente': 'Usado - excelente',
  'Usado - bueno': 'Usado - bueno',
  'Usado - regular': 'Usado - regular'
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface FormState {
  marca: string;
  nombre: string;
  talla: string;
  estado: string;
  codigo: string;
  anio: string;
  costoRetail: string;
  precioReventa: string;
  notas: string;
  foto: string;
}

function toFormState(item?: Zapatilla): FormState {
  return {
    marca: item?.marca ?? '',
    nombre: item?.nombre ?? '',
    talla: item?.talla ?? '',
    estado: item?.estado ?? 'DS',
    codigo: item?.codigo ?? '',
    anio: item?.anio != null ? String(item.anio) : '',
    costoRetail: item?.costoRetail != null ? String(item.costoRetail) : '',
    precioReventa: item?.precioReventa != null ? String(item.precioReventa) : '',
    notas: item?.notas ?? '',
    foto: item?.foto ?? ''
  };
}

export default function ItemModal({
  mode,
  item,
  onClose,
  onSaved,
  onDeleted
}: {
  mode: 'add' | 'edit';
  item?: Zapatilla;
  onClose: () => void;
  onSaved: (item: Zapatilla) => void;
  onDeleted?: (id: string) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(item));
  const [imageTab, setImageTab] = useState<'upload' | 'url'>('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError('Formato no soportado. Usá JPG, PNG, WEBP o GIF.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('La imagen pesa más de 8MB.');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo subir la imagen.');
      update('foto', json.url as string);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
    }
  }

  function buildPayload(): NuevaZapatilla {
    return {
      marca: form.marca.trim(),
      nombre: form.nombre.trim(),
      talla: form.talla.trim(),
      estado: form.estado,
      codigo: form.codigo.trim(),
      anio: form.anio.trim() === '' ? null : Number(form.anio),
      costoRetail: form.costoRetail.trim() === '' ? 0 : Number(form.costoRetail),
      precioReventa: form.precioReventa.trim() === '' ? 0 : Number(form.precioReventa),
      notas: form.notas.trim(),
      foto: form.foto.trim()
    };
  }

  async function handleSave() {
    if (!form.marca.trim() || !form.nombre.trim()) {
      setSaveError('Al menos ingresá marca y modelo.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = buildPayload();
      const url = mode === 'edit' && item ? `/api/items/${item.id}` : '/api/items';
      const method = mode === 'edit' ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar.');
      onSaved(json.item as Zapatilla);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item || !onDeleted) return;
    setDeleting(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'No se pudo eliminar.');
      onDeleted(item.id);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo eliminar.');
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const busy = saving || uploading || deleting;

  return (
    <div
      className="overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-head">
          <div className="modal-title" id="modal-title">
            {mode === 'add' ? 'Agregar nuevo par' : item?.nombre}
          </div>
          <button className="close-x" onClick={onClose} disabled={busy} aria-label="Cerrar">
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="tabs" role="tablist">
            <div
              className={`tab ${imageTab === 'upload' ? 'active' : ''}`}
              role="tab"
              tabIndex={0}
              onClick={() => setImageTab('upload')}
              onKeyDown={(e) => e.key === 'Enter' && setImageTab('upload')}
            >
              Subir foto
            </div>
            <div
              className={`tab ${imageTab === 'url' ? 'active' : ''}`}
              role="tab"
              tabIndex={0}
              onClick={() => setImageTab('url')}
              onKeyDown={(e) => e.key === 'Enter' && setImageTab('url')}
            >
              Pegar link
            </div>
          </div>

          <div className="photo-preview">
            {uploading ? (
              <span className="uploading mono">SUBIENDO…</span>
            ) : form.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.foto} alt="Vista previa" referrerPolicy="no-referrer" />
            ) : (
              <span className="mono" style={{ color: 'var(--text-faint)', fontSize: 11 }}>
                SIN FOTO TODAVÍA
              </span>
            )}
          </div>

          {imageTab === 'upload' ? (
            <div className="field">
              <label htmlFor="f_file">Subir desde este dispositivo</label>
              <input
                ref={fileInputRef}
                id="f_file"
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={handleFileChange}
                disabled={uploading}
              />
              {uploadError && <div className="field-error">{uploadError}</div>}
            </div>
          ) : (
            <div className="field">
              <label htmlFor="f_foto">URL de la foto</label>
              <input
                type="text"
                id="f_foto"
                value={form.foto}
                onChange={(e) => update('foto', e.target.value)}
                placeholder="Pega aquí el link de la imagen"
              />
              <a
                className="helper-link"
                href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(
                  `${form.marca} ${form.nombre} ${form.codigo}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Buscar &quot;{form.nombre || 'este modelo'}&quot; en Google Imágenes →
              </a>
            </div>
          )}

          <div className="row2">
            <div className="field">
              <label htmlFor="f_marca">Marca *</label>
              <input
                type="text"
                id="f_marca"
                value={form.marca}
                onChange={(e) => update('marca', e.target.value)}
                placeholder="ej. Nike"
              />
            </div>
            <div className="field">
              <label htmlFor="f_nombre">Modelo *</label>
              <input
                type="text"
                id="f_nombre"
                value={form.nombre}
                onChange={(e) => update('nombre', e.target.value)}
                placeholder="ej. Air Jordan 4 Retro"
              />
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label htmlFor="f_talla">Talla (US)</label>
              <input
                type="text"
                id="f_talla"
                value={form.talla}
                onChange={(e) => update('talla', e.target.value)}
                placeholder="ej. 9.5"
              />
            </div>
            <div className="field">
              <label htmlFor="f_estado">Estado</label>
              <select id="f_estado" value={form.estado} onChange={(e) => update('estado', e.target.value)}>
                {ESTADOS.map((v) => (
                  <option key={v} value={v}>
                    {ESTADO_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label htmlFor="f_codigo">Código / SKU</label>
              <input
                type="text"
                id="f_codigo"
                value={form.codigo}
                onChange={(e) => update('codigo', e.target.value)}
                placeholder="ej. DH7722-001"
              />
            </div>
            <div className="field">
              <label htmlFor="f_anio">Año</label>
              <input
                type="number"
                id="f_anio"
                value={form.anio}
                onChange={(e) => update('anio', e.target.value)}
                placeholder="ej. 2026"
              />
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label htmlFor="f_costo">Precio retail ($)</label>
              <input
                type="number"
                id="f_costo"
                min="0"
                step="0.01"
                value={form.costoRetail}
                onChange={(e) => update('costoRetail', e.target.value)}
                placeholder="ej. 150"
              />
            </div>
            <div className="field">
              <label htmlFor="f_reventa">Precio de reventa ($)</label>
              <input
                type="number"
                id="f_reventa"
                min="0"
                step="0.01"
                value={form.precioReventa}
                onChange={(e) => update('precioReventa', e.target.value)}
                placeholder="ej. 220"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="f_notas">Notas</label>
            <textarea
              id="f_notas"
              value={form.notas}
              onChange={(e) => update('notas', e.target.value)}
              placeholder="Detalles, dónde lo compraste, etc."
            />
          </div>

          {saveError && <div className="modal-error">{saveError}</div>}

          <div className="modal-actions" style={mode === 'add' ? { justifyContent: 'flex-end' } : undefined}>
            {mode === 'edit' && onDeleted && (
              <>
                {confirmingDelete ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      ¿Seguro?
                    </span>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={handleDelete}
                      disabled={busy}
                    >
                      {deleting ? 'Eliminando…' : 'Sí, eliminar'}
                    </button>
                    <button
                      className="btn btn-small"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={busy}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-danger"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={busy}
                  >
                    Eliminar del catálogo
                  </button>
                )}
              </>
            )}
            <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
              {saving ? 'Guardando…' : mode === 'add' ? 'Agregar al catálogo' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
