'use client';

import { useState } from 'react';
import { formatMoney } from '@/lib/format';
import type { Zapatilla } from '@/lib/types';
import { NoPhotoIcon } from './icons';
import Barcode from './Barcode';

export default function SneakerCard({ item, onOpen }: { item: Zapatilla; onOpen: () => void }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(item.foto) && !photoFailed;
  const diferencia = item.precioReventa - item.costoRetail;

  return (
    <button type="button" className="card" onClick={onOpen}>
      <div className="card-photo">
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.foto}
            alt={item.nombre}
            loading="lazy"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="no-photo">
            <NoPhotoIcon />
            <div className="no-photo-label">{item.foto ? 'Foto no cargó' : 'Sin foto'}</div>
          </div>
        )}
        <div className="brand-chip">{item.marca}</div>
        <div className={`size-tag ${item.talla ? '' : 'empty'}`}>
          {item.talla ? `US ${item.talla}` : 'sin talla'}
        </div>
      </div>
      <div className="card-body">
        <div className="card-name">{item.nombre}</div>
        <Barcode seed={item.codigo || item.id} />
        <div className="card-prices">
          <span className="retail">Retail {formatMoney(item.costoRetail)}</span>
          <span className={`reventa ${diferencia >= 0 ? 'good' : 'bad'}`}>
            Reventa {formatMoney(item.precioReventa)}
          </span>
        </div>
        <div className="card-meta">
          <span className="card-code mono">{item.codigo}</span>
          <span className="card-year mono">{item.anio ?? ''}</span>
        </div>
      </div>
    </button>
  );
}
