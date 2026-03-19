import { useMemo, useState } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import Skeleton from '../../components/Skeleton';

// ── Design tokens ─────────────────────────────────────────────────
const T = {
  primary:   '#1B5E20',
  secondary: '#2E7D32',
  white:     '#FFFFFF',
  bgLight:   '#F5F5F5',
  border:    '#E0E0E0',
  textDark:  '#1A1A18',
  textMid:   '#6B6B60',
  danger:    '#C62828',
  warn:      '#E65100',
  info:      '#1565C0',
};
const card = { background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:20, marginBottom:20 };

// ── Helpers ───────────────────────────────────────────────────────
const fmtDate = d => {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  if (d?.toDate) return d.toDate().toISOString().slice(0, 10);
  return '';
};
const fmtN = (n, dec = 1) => (n || 0).toLocaleString('es-GT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const lbsToKg = n => ((n || 0) / 2.205).toFixed(1);

function canalBadge(canal) {
  const c = (canal || '').toLowerCase();
  if (c.includes('walmart'))          return { label: 'Walmart',  bg: '#FFEBEE', color: '#C62828' };
  if (c.includes('gt') || c.includes('local')) return { label: 'Local GT', bg: '#E8F5E9', color: '#1B5E20' };
  if (c.includes('int') || c.includes('export')) return { label: 'Export', bg: '#E3F2FD', color: '#1565C0' };
  return { label: 'Entrada', bg: '#E8F5E9', color: '#2E7D32' };
}

// ── Main ──────────────────────────────────────────────────────────
export default function StockVivo() {
  const { data: entradas, loading: loadE } = useCollection('ientradas', { orderField: 'fecha', orderDir: 'desc', limit: 2000 });
  const { data: salidas,  loading: loadS } = useCollection('isalidas',  { orderField: 'fecha', orderDir: 'desc', limit: 2000 });
  const [filtProd, setFiltProd] = useState('');

  const loading = loadE || loadS;

  // ── Per-product summary ────────────────────────────────────────
  const stockMap = useMemo(() => {
    const m = {};
    const ensure = k => {
      if (!m[k]) m[k] = { entLbs: 0, salLbs: 0, unidad: 'lb', lastDuca: '', lastDucaLbs: 0 };
    };

    for (const e of entradas) {
      const k = e.producto; if (!k) continue;
      ensure(k);
      // Migrated data has `lbs` (total pounds). Fallback to unidades/bultos/cantidad
      const lbs = Number(e.lbs) || Number(e.unidades) || Number(e.bultos) || Number(e.cantidad) || 0;
      m[k].entLbs += lbs;
      if (e.unidad) m[k].unidad = e.unidad;
      if (e.duca)   { m[k].lastDuca = e.duca; m[k].lastDucaLbs = Number(e.lbs) || 0; }
    }

    for (const s of salidas) {
      const prods = Array.isArray(s.productos)
        ? s.productos
        : s.producto ? [{ producto: s.producto, lbs: s.lbs, cajasEnviadas: s.cajasEnviadas }] : [];
      for (const item of prods) {
        const k = item.producto || item.nombre; if (!k) continue;
        ensure(k);
        const lbs = Number(item.lbs) || Number(item.totalLbs) || Number(item.cajasEnviadas) || Number(item.cantidad) || 0;
        m[k].salLbs += lbs;
      }
    }

    return m;
  }, [entradas, salidas]);

  const productos = useMemo(() =>
    Object.entries(stockMap)
      .map(([nombre, v]) => ({ nombre, ...v, stock: v.entLbs - v.salLbs }))
      .filter(p => p.entLbs > 0 || p.salLbs > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [stockMap]
  );

  // ── Movement history (expanded per product line) ───────────────
  const movements = useMemo(() => {
    const mvs = [];

    for (const e of entradas) {
      if (!e.producto) continue;
      const lbs = Number(e.lbs) || Number(e.unidades) || Number(e.bultos) || Number(e.cantidad) || 0;
      mvs.push({
        fecha:   fmtDate(e.fecha),
        tipo:    'entrada',
        canal:   'Entrada',
        producto: e.producto,
        entidad:  e.proveedor || '—',
        bultos:   Number(e.bultos) || 0,
        lbs,
        docId:   e.id,
        felAuth: e.duca || '',
      });
    }

    for (const s of salidas) {
      const prods = Array.isArray(s.productos)
        ? s.productos
        : s.producto ? [{ producto: s.producto, lbs: s.lbs, cajasEnviadas: s.cajasEnviadas }] : [];
      const canal   = s.canal || 'Walmart';
      const entidad = s.cliente || s.almacen || 'Walmart Guatemala';
      for (const item of prods) {
        const k = item.producto || item.nombre; if (!k) continue;
        const lbs = Number(item.lbs) || Number(item.totalLbs) || Number(item.cajasEnviadas) || Number(item.cantidad) || 0;
        mvs.push({
          fecha:    fmtDate(s.fecha),
          tipo:     'salida',
          canal,
          producto: k,
          entidad,
          bultos:   Number(item.cajasEnviadas) || 0,
          lbs,
          docId:    s.id,
          felAuth:  s.authSAT || s.numFel || s.numeroDTE || '',
        });
      }
    }

    // Sort oldest-first to compute running stock, then reverse for display
    mvs.sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0);
    const run = {};
    for (const mv of mvs) {
      if (!run[mv.producto]) run[mv.producto] = 0;
      run[mv.producto] += mv.tipo === 'entrada' ? mv.lbs : -mv.lbs;
      mv.stockBodega = run[mv.producto];
    }

    return mvs.reverse();
  }, [entradas, salidas]);

  const filtMvs = useMemo(() =>
    filtProd ? movements.filter(m => m.producto === filtProd) : movements,
    [movements, filtProd]
  );

  if (loading) return <div style={{ padding: 24 }}><Skeleton rows={10} /></div>;

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1100 }}>

      {/* Page header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: T.primary, margin: 0 }}>Stock en Tiempo Real</h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>
          Existencias por producto en bodega · Historial de movimientos: entradas, Walmart, Local GT, Exportación
        </p>
      </div>

      {/* Product summary cards */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary, marginBottom: 16 }}>
          Existencias en Bodega por Producto
        </div>
        {productos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: T.textMid, fontSize: '.88rem' }}>
            <div style={{ fontSize: '2rem', opacity: .3, marginBottom: 8 }}>📦</div>
            Sin movimientos registrados. Registre ingresos y salidas para ver el stock.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {productos.map(p => {
              const pct = p.entLbs > 0 ? Math.max(0, Math.min(100, (p.stock / p.entLbs) * 100)) : 0;
              const sColor = p.stock > 0 ? T.secondary : T.danger;
              const unit = p.unidad === 'lb' ? 'lbs' : (p.unidad || 'lbs');
              return (
                <div key={p.nombre} style={{ flex: '1 1 220px', minWidth: 200, background: T.bgLight, borderRadius: 8, padding: 16, border: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: '.82rem', color: T.textDark, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      {p.nombre}
                    </div>
                    <button style={{ padding: '2px 8px', background: 'rgba(46,125,50,.10)', color: T.secondary, border: '1px solid rgba(46,125,50,.25)', borderRadius: 10, fontSize: '.62rem', fontWeight: 700, cursor: 'pointer' }}>
                      Trazabilidad
                    </button>
                  </div>

                  <div style={{ fontSize: '2rem', fontWeight: 800, color: sColor, lineHeight: 1 }}>
                    {fmtN(p.stock, 0)}
                  </div>
                  <div style={{ fontSize: '.72rem', color: T.textMid, marginTop: 2, marginBottom: 10 }}>
                    {unit} en bodega{p.unidad === 'lb' ? ` · ${lbsToKg(p.stock)} kg` : ''}
                  </div>

                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ padding: '2px 7px', background: '#E8F5E9', color: T.secondary, borderRadius: 10, fontSize: '.68rem', fontWeight: 700 }}>
                      ENTRADA {fmtN(p.entLbs, 0)} {unit}
                    </span>
                    <span style={{ padding: '2px 7px', background: '#FFEBEE', color: T.danger, borderRadius: 10, fontSize: '.68rem', fontWeight: 700 }}>
                      SALIDA {fmtN(p.salLbs, 0)} {unit}
                    </span>
                  </div>

                  <div style={{ height: 5, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: sColor, borderRadius: 3 }} />
                  </div>

                  {p.lastDuca && (
                    <div style={{ marginTop: 8, fontSize: '.68rem', color: T.info, background: 'rgba(21,101,192,.07)', padding: '3px 8px', borderRadius: 6, display: 'inline-block' }}>
                      DUCA {p.lastDuca} · {fmtN(p.lastDucaLbs, 0)} lbs
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Movement history */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary }}>
            Historial de Movimientos ({filtMvs.length})
          </div>
          <select
            value={filtProd}
            onChange={e => setFiltProd(e.target.value)}
            style={{ padding: '6px 12px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.82rem', outline: 'none', fontFamily: 'inherit', color: T.textDark, background: T.white }}
          >
            <option value=''>Todos los productos</option>
            {productos.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
          </select>
        </div>

        {filtMvs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: T.textMid, fontSize: '.88rem' }}>
            Sin movimientos registrados
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Canal', 'Producto', 'Entidad / Cliente', 'Bultos / Cajas', 'Total LBS', 'Stock Bodega', 'Documento'].map(h => (
                    <th key={h} style={{ color: T.white, padding: '9px 12px', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtMvs.slice(0, 400).map((mv, i) => {
                  const badge = canalBadge(mv.canal);
                  const sColor = mv.stockBodega >= 0 ? T.secondary : T.danger;
                  return (
                    <tr key={`${mv.docId}-${mv.producto}-${i}`} style={{ background: i % 2 === 1 ? '#F9FBF9' : '#fff' }}>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', color: T.textMid, fontWeight: 600, whiteSpace: 'nowrap' }}>{mv.fecha}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '.68rem', fontWeight: 700, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600, color: T.textDark }}>{mv.producto}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', color: T.textMid }}>{mv.entidad}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', textAlign: 'right', color: T.textDark }}>
                        {mv.bultos > 0 ? mv.bultos.toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: mv.tipo === 'entrada' ? T.secondary : T.danger, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {mv.tipo === 'entrada' ? '+' : '-'}{fmtN(mv.lbs)} lbs
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: sColor, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {fmtN(mv.stockBodega)} lbs
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '.75rem', borderBottom: '1px solid #F0F0F0', color: T.info, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mv.felAuth
                          ? <span title={mv.felAuth} style={{ fontFamily: 'monospace' }}>{mv.felAuth.slice(0, 16)}{mv.felAuth.length > 16 ? '…' : ''}</span>
                          : <span style={{ color: T.border }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
