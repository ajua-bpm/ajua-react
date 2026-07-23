import { useMemo, useState } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import { useAuth } from '../../hooks/useAuth';

const T = {
  bg: '#F8F3E9', paper: '#FFFFFF', ink: '#1A1A18', forest: '#1F3A2C',
  canopy: '#2D6645', ochre: '#A8835A', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)',
  ok: '#2E7D32', warn: '#B26A00', err: '#B00020', sand: '#E7DDC9',
};

const fmt = (n) => Number.isFinite(n) ? n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

const CATS_EGRESO = [
  { k: 'importacion',     label: 'Importación MX',      icon: '📦' },
  { k: 'proveedor_local', label: 'Proveedores locales', icon: '🌱' },
  { k: 'servicios',       label: 'Servicios',           icon: '💡' },
  { k: 'rentas',          label: 'Rentas',              icon: '🏠' },
  { k: 'sueldos',         label: 'Sueldos',             icon: '👥' },
  { k: 'impuestos',       label: 'Impuestos',           icon: '🧾' },
  { k: 'gasto_op',        label: 'Gastos operativos',   icon: '🦺' },
  { k: 'otros',           label: 'Otros',               icon: '📎' },
];

export default function FinanzasResultados() {
  const { getFinanzasPerms } = useAuth();
  const perms = getFinanzasPerms();

  const [periodo, setPeriodo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: movs, loading } = useCollection('movimientos_finanzas', {
    orderField: 'fecha', orderDir: 'desc', limit: 1000,
  });

  const R = useMemo(() => {
    const delMes = (movs || []).filter(m => (m.fecha || '').startsWith(periodo));
    // Solo cuenta lo efectivamente movido (pagado/cobrado). Pendientes aparte.
    let ingresos = 0;
    const egresos = {};
    CATS_EGRESO.forEach(c => { egresos[c.k] = 0; });
    let pendCobrar = 0, pendPagar = 0;

    for (const m of delMes) {
      const monto = parseFloat(m.montoGTQ ?? m.monto) || 0;
      if (m.tipo === 'cobro') {
        if (m.estado === 'cobrado') ingresos += monto;
        else pendCobrar += monto;
      } else if (m.tipo === 'pago' || m.tipo === 'gasto_op') {
        const cat = m.tipo === 'gasto_op' ? 'gasto_op' : (m.categoria || 'otros');
        const dest = egresos[cat] !== undefined ? cat : 'otros';
        if (m.estado === 'pagado') egresos[dest] += monto;
        else if (m.estado !== 'cargado') pendPagar += monto;
      }
    }
    const totalEgreso = Object.values(egresos).reduce((a, b) => a + b, 0);
    const utilidad = ingresos - totalEgreso;
    const margen = ingresos > 0 ? (utilidad / ingresos * 100) : 0;
    return { ingresos, egresos, totalEgreso, utilidad, margen, pendCobrar, pendPagar, count: delMes.length };
  }, [movs, periodo]);

  const cambiarMes = (delta) => {
    const [y, m] = periodo.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setPeriodo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const mesLabel = new Date(periodo + '-01').toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });

  const pct = (v) => R.ingresos > 0 ? (v / R.ingresos * 100) : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: '.82rem', color: T.muted, marginBottom: 4 }}>Finanzas · Estado de resultados</div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.55rem', fontWeight: 600, color: T.forest }}>Estado de resultados</h1>
          <div style={{ fontSize: '.85rem', color: T.muted, marginTop: 3 }}>{mesLabel} · solo movimientos efectivos (pagado / cobrado)</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => cambiarMes(-1)} style={navBtn}>◀</button>
          <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ padding: '6px 10px', border: `1px solid ${T.rule}`, borderRadius: 3, fontSize: '.85rem' }} />
          <button onClick={() => cambiarMes(1)} style={navBtn}>▶</button>
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>Calculando…</div>}

      {!loading && R.count === 0 && (
        <div style={{ padding: 40, background: T.paper, border: `1px solid ${T.rule}`, textAlign: 'center', color: T.muted }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📈</div>
          Sin movimientos en {mesLabel}.<br/>
          <span style={{ fontSize: '.85rem' }}>Cargá pagos y cobros en Movimientos para ver el estado de resultados.</span>
        </div>
      )}

      {!loading && R.count > 0 && (
        <div style={{ maxWidth: 640 }}>
          {/* Estado de resultados en formato tabla contable */}
          <table style={{ width: '100%', borderCollapse: 'collapse', background: T.paper, boxShadow: '0 1px 3px rgba(0,0,0,.05)', fontSize: '.9rem' }}>
            <tbody>
              {/* INGRESOS */}
              <tr style={rowHead}>
                <td style={{ ...tdL, color: T.canopy }}>INGRESOS</td>
                <td style={tdR}></td>
                <td style={tdPct}></td>
              </tr>
              <tr>
                <td style={{ ...tdL, paddingLeft: 28 }}>Cobros del mes</td>
                <td style={{ ...tdR, color: T.canopy, fontWeight: 600 }}>Q {fmt(R.ingresos)}</td>
                <td style={tdPct}>100%</td>
              </tr>

              {/* EGRESOS */}
              <tr style={rowHead}>
                <td style={{ ...tdL, color: T.err }}>EGRESOS</td>
                <td style={tdR}></td>
                <td style={tdPct}></td>
              </tr>
              {CATS_EGRESO.map(c => (
                <tr key={c.k}>
                  <td style={{ ...tdL, paddingLeft: 28 }}>{c.icon} {c.label}</td>
                  <td style={{ ...tdR, color: R.egresos[c.k] > 0 ? T.ink : T.muted }}>
                    {R.egresos[c.k] > 0 ? `Q ${fmt(R.egresos[c.k])}` : '—'}
                  </td>
                  <td style={tdPct}>{R.egresos[c.k] > 0 ? pct(R.egresos[c.k]).toFixed(1) + '%' : ''}</td>
                </tr>
              ))}
              <tr style={{ borderTop: `1px solid ${T.rule}` }}>
                <td style={{ ...tdL, paddingLeft: 28, fontWeight: 600 }}>Total egresos</td>
                <td style={{ ...tdR, fontWeight: 700, color: T.err }}>Q {fmt(R.totalEgreso)}</td>
                <td style={tdPct}>{pct(R.totalEgreso).toFixed(1)}%</td>
              </tr>

              {/* UTILIDAD */}
              {!perms.hide_utility && (
                <tr style={{ background: R.utilidad >= 0 ? 'rgba(46,125,50,.08)' : 'rgba(176,0,32,.08)', borderTop: `2px solid ${T.forest}` }}>
                  <td style={{ ...tdL, fontWeight: 800, fontFamily: "'Fraunces', serif", fontSize: '1.05rem' }}>UTILIDAD NETA</td>
                  <td style={{ ...tdR, fontWeight: 800, fontSize: '1.05rem', color: R.utilidad >= 0 ? T.ok : T.err }}>Q {fmt(R.utilidad)}</td>
                  <td style={{ ...tdPct, fontWeight: 700, color: R.utilidad >= 0 ? T.ok : T.err }}>{R.margen.toFixed(1)}%</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pendientes */}
          {(R.pendCobrar > 0 || R.pendPagar > 0) && (
            <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {R.pendCobrar > 0 && (
                <div style={{ flex: 1, minWidth: 180, background: T.paper, border: `1px solid ${T.rule}`, borderLeft: `3px solid #1565C0`, padding: '10px 14px' }}>
                  <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.muted }}>Por cobrar (no incluido)</div>
                  <div style={{ fontWeight: 700, color: '#1565C0', fontSize: '1.1rem' }}>Q {fmt(R.pendCobrar)}</div>
                </div>
              )}
              {R.pendPagar > 0 && (
                <div style={{ flex: 1, minWidth: 180, background: T.paper, border: `1px solid ${T.rule}`, borderLeft: `3px solid ${T.warn}`, padding: '10px 14px' }}>
                  <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.muted }}>Por pagar (no incluido)</div>
                  <div style={{ fontWeight: 700, color: T.warn, fontSize: '1.1rem' }}>Q {fmt(R.pendPagar)}</div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: '.75rem', color: T.muted }}>
            * Solo cuenta movimientos marcados como pagado/cobrado. Los pendientes se muestran aparte y no afectan la utilidad hasta concretarse.
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn = { padding: '6px 10px', border: `1px solid ${T.rule}`, background: 'white', cursor: 'pointer', borderRadius: 3 };
const rowHead = { background: T.sand };
const tdL = { padding: '9px 14px', borderBottom: `1px solid ${T.rule}`, fontWeight: 700, letterSpacing: '.03em', fontSize: '.82rem' };
const tdR = { padding: '9px 14px', borderBottom: `1px solid ${T.rule}`, textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' };
const tdPct = { padding: '9px 14px', borderBottom: `1px solid ${T.rule}`, textAlign: 'right', width: 70, color: T.muted, fontSize: '.8rem' };
