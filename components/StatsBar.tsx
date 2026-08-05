import { formatMoney } from '@/lib/format';
import type { Zapatilla } from '@/lib/types';

export default function StatsBar({ items }: { items: Zapatilla[] }) {
  const total = items.length;
  const marcas = new Set(items.map((d) => d.marca).filter(Boolean)).size;
  const conTalla = items.filter((d) => d.talla).length;
  const conFoto = items.filter((d) => d.foto).length;
  const totalRetail = items.reduce((s, d) => s + (Number(d.costoRetail) || 0), 0);
  const totalReventa = items.reduce((s, d) => s + (Number(d.precioReventa) || 0), 0);
  const diferencia = totalReventa - totalRetail;
  const diferenciaSigno = diferencia >= 0 ? '+' : '-';

  return (
    <div className="stats-row">
      <div className="stat">
        <div className="stat-num">{total}</div>
        <div className="stat-label">Pares</div>
      </div>
      <div className="stat">
        <div className="stat-num">{marcas}</div>
        <div className="stat-label">Marcas</div>
      </div>
      <div className="stat">
        <div className="stat-num">
          {conTalla}/{total}
        </div>
        <div className="stat-label">Con talla</div>
      </div>
      <div className="stat">
        <div className="stat-num">
          {conFoto}/{total}
        </div>
        <div className="stat-label">Con foto</div>
      </div>
      <div className="stat">
        <div className="stat-num">{formatMoney(totalRetail)}</div>
        <div className="stat-label">Total retail</div>
      </div>
      <div className="stat">
        <div className="stat-num">{formatMoney(totalReventa)}</div>
        <div className="stat-label">Total reventa</div>
      </div>
      <div className="stat">
        <div className={`stat-num ${diferencia >= 0 ? 'good' : 'bad'}`}>
          {diferenciaSigno}
          {formatMoney(Math.abs(diferencia))}
        </div>
        <div className="stat-label">Ganancia estimada</div>
      </div>
    </div>
  );
}
