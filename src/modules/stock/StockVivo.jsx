import { useMemo } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import { useProductosCatalogo } from '../../hooks/useMainData';
import Skeleton from '../../components/Skeleton';

// ── Design tokens ────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', white: '#FFFFFF',
  bgLight: '#F5F5F5', border: '#E0E0E0', textDark: '#1A1A18',
  textMid: '#6B6B60', danger: '#C62828', warn: '#E65100',
};
const shadow = '0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06)';
const card = { background: '#fff', borderRadius: 8, boxShadow: shadow, padding: 20, marginBottom: 20 };

const thSt = {
  color: T.white, padding: '10px 14px', fontSize: '.75rem',
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em',
  textAlign: 'left', whiteSpace: 'nowrap',
};
const tdSt = {
  padding: '9px 14px', fontSize: '.83rem',
  borderBottom: '1px solid #F0F0F0', color: T.textDark,
};

// ── Helpers ──────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = d => {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  if (d?.toDate) return d.toDate().toISOString().slice(0, 10);
  return null;
};

function stockColor(n) {
  if (n > 10) return T.secondary;
  if (n > 0)  return T.warn;
  return T.danger;
}

// ── Summary card ─────────────────────────────────────────────────
function MetricCard({ label, value, sub, accent }) {
  return (
    <div style={{ ...card, marginBottom: 0, flex: '1 1 160px', borderTop: `3px solid ${accent || T.primary}` }}>
      <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMid, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.7rem', fontWeight: 700, color: accent || T.textDark, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '.75rem', color: T.textMid, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export default function StockVivo() {
  const { data: entradas, loading: loadE } = useCollection('ientradas', { orderField: 'fecha', orderDir: 'desc', limit: 2000 });
  const { data: salidas,  loading: loadS } = useCollection('isalidas',  { orderField: 'fecha', orderDir: 'desc', limit: 2000 });
  const { productos, loading: loadP } = useProductosCatalogo();

  const loading = loadE || loadS || loadP;
  const today   = todayStr();

  const stockMap = useMemo(() => {
    const map = {};
    for (const e of entradas) {
      const k = e.producto; if (!k) continue;
      if (!map[k]) map[k] = { entradas: 0, salidas: 0, lastDate: null, unidad: e.unidad || '' };
      map[k].entradas += Number(e.cantidad) || 0;
      const d = fmtDate(e.fecha);
      if (d && (!map[k].lastDate || d > map[k].lastDate)) map[k].lastDate = d;
    }
    for (const s of salidas) {
      const k = s.producto; if (!k) continue;
      if (!map[k]) map[k] = { entradas: 0, salidas: 0, lastDate: null, unidad: s.unidad || '' };
      map[k].salidas += Number(s.cantidad) || 0;
      const d = fmtDate(s.fecha);
      if (d && (!map[k].lastDate || d > map[k].lastDate)) map[k].lastDate = d;
    }
    return map;
  }, [entradas, salidas]);

  const rows = useMemo(() => {
    const allKeys = new Set([
      ...Object.keys(stockMap),
      ...productos.map(p => p.id || p.nombre),
    ]);
    return Array.from(allKeys)
      .map(k => {
        const prod = productos.find(p => (p.id || p.nombre) === k);
        const info = stockMap[k] || { entradas: 0, salidas: 0, lastDate: null, unidad: '' };
        return {
          key: k,
          nombre:   prod?.nombre || k,
          unidad:   prod?.unidad || info.unidad || '—',
          stock:    info.entradas - info.salidas,
          entradas: info.entradas,
          salidas:  info.salidas,
          lastDate: info.lastDate,
        };
      })
      .filter(r => r.entradas > 0 || r.salidas > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [stockMap, productos]);

  const totalBodega    = rows.reduce((s, r) => s + r.stock, 0);
  const movsHoy        = [...entradas, ...salidas].filter(m => fmtDate(m.fecha) === today).length;

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit', maxWidth: 1100 }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: T.textDark }}>
          Stock en Bodega
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '.83rem', color: T.textMid }}>
          Existencias en tiempo real — calculado de entradas y salidas registradas
        </p>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <MetricCard label="Total productos" value={loading ? '…' : rows.length} accent={T.primary} />
        <MetricCard label="Total en bodega" value={loading ? '…' : totalBodega.toLocaleString()} sub="unidades netas" accent={T.secondary} />
        <MetricCard label="Movimientos hoy" value={loading ? '…' : movsHoy} accent={movsHoy > 0 ? T.warn : T.textMid} />
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ fontWeight: 600, fontSize: '.9rem', color: T.textDark, marginBottom: 16 }}>
          Existencias por producto
        </div>
        {loading ? (
          <Skeleton rows={8} />
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 24px', color: T.textMid, fontSize: '.88rem' }}>
            <div style={{ fontSize: '2.4rem', marginBottom: 12, opacity: .3 }}>📦</div>
            Sin movimientos registrados. Registre ingresos y salidas para ver el stock.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Producto', 'Stock actual', 'Unidad', 'Entradas', 'Salidas', 'Último mov.'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key} style={{ background: i % 2 === 1 ? '#F9FBF9' : '#fff' }}>
                    <td style={{ ...tdSt, fontWeight: 600 }}>{r.nombre}</td>
                    <td style={tdSt}>
                      <span style={{ fontWeight: 700, fontSize: '.9rem', color: stockColor(r.stock) }}>
                        {r.stock.toLocaleString()}
                      </span>
                    </td>
                    <td style={{ ...tdSt, color: T.textMid }}>{r.unidad}</td>
                    <td style={tdSt}>{r.entradas.toLocaleString()}</td>
                    <td style={tdSt}>{r.salidas.toLocaleString()}</td>
                    <td style={{ ...tdSt, color: T.textMid }}>{r.lastDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
