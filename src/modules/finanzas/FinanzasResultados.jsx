import { useMemo, useState } from 'react';
import { useMovimientosUnificados } from './useMovimientosUnificados';
import { useAuth } from '../../hooks/useAuth';

const T = {
  bg: '#F8F3E9', paper: '#FFFFFF', ink: '#1A1A18', forest: '#1F3A2C',
  canopy: '#2D6645', ochre: '#A8835A', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)',
  ok: '#2E7D32', warn: '#B26A00', err: '#B00020', sand: '#E7DDC9',
};

const fmt = (n) => Number.isFinite(n) ? n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

// Mapea cada movimiento de egreso a una categoría contable
const CATS_EGRESO = [
  { k: 'proveedor_local', label: 'Proveedores locales', icon: '🌱' },
  { k: 'importacion',     label: 'Importación MX',       icon: '📦' },
  { k: 'sueldos',         label: 'Sueldos y anticipos',  icon: '👥' },
  { k: 'servicios',       label: 'Servicios',            icon: '💡' },
  { k: 'rentas',          label: 'Rentas',               icon: '🏠' },
  { k: 'impuestos',       label: 'Impuestos',            icon: '🧾' },
  { k: 'gasto_op',        label: 'Gastos operativos',    icon: '🦺' },
  { k: 'otros',           label: 'Otros',                icon: '📎' },
];

function categoriaDe(m) {
  if (m._origen === 'proveedor') return 'proveedor_local';
  if (m._origen === 'empleado') return 'sueldos';
  if (m._raw?.tipo === 'gasto_op') return 'gasto_op';
  const c = m._raw?.categoria;
  return CATS_EGRESO.some(x => x.k === c) ? c : 'otros';
}

export default function FinanzasResultados() {
  const { getFinanzasPerms } = useAuth();
  const perms = getFinanzasPerms();

  const [periodo, setPeriodo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const { movimientos, loading } = useMovimientosUnificados();

  const R = useMemo(() => {
    const delMes = (movimientos || []).filter(m => (m.fecha || '').startsWith(periodo));
    let ingresos = 0;   // cobros efectivos (caja entra)
    let ventas = 0;     // facturado (devengado)
    const egresos = {};
    CATS_EGRESO.forEach(c => { egresos[c.k] = 0; });

    for (const m of delMes) {
      if (!m.caja) { ventas += (m.flujo === 'entra' ? m.monto : -m.monto); continue; } // ventas netas de notas crédito
      if (m.flujo === 'entra') ingresos += m.monto;
      else egresos[categoriaDe(m)] += m.monto;
    }
    const totalEgreso = Object.values(egresos).reduce((a, b) => a + b, 0);
    return { ingresos, ventas, egresos, totalEgreso, utilidad: ingresos - totalEgreso };
  }, [movimientos, periodo]);

  const cambiarMes = (delta) => {
    const [y, m] = periodo.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setPeriodo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const mesLabel = new Date(periodo + '-01').toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
  // % sobre ingresos cobrados. Si no hubo cobros, no hay base → mostramos '—' en vez de cifras absurdas.
  const pct = (v) => R.ingresos > 0 ? (v / R.ingresos * 100).toFixed(1) + '%' : '—';
  const hayDatos = R.ingresos > 0 || R.ventas > 0 || R.totalEgreso > 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: '.82rem', color: T.muted, marginBottom: 4 }}>Finanzas · Estado de resultados</div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.55rem', fontWeight: 600, color: T.forest }}>Estado de resultados</h1>
          <div style={{ fontSize: '.85rem', color: T.muted, marginTop: 3 }}>{mesLabel} · base caja (cobrado − pagado)</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => cambiarMes(-1)} style={navBtn}>◀</button>
          <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ padding: '6px 10px', border: `1px solid ${T.rule}`, borderRadius: 3, fontSize: '.85rem' }} />
          <button onClick={() => cambiarMes(1)} style={navBtn}>▶</button>
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>Calculando…</div>}

      {!loading && !hayDatos && (
        <div style={{ padding: 40, background: T.paper, border: `1px solid ${T.rule}`, textAlign: 'center', color: T.muted }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📈</div>
          Sin movimientos en {mesLabel}.
        </div>
      )}

      {!loading && hayDatos && (
        <div style={{ maxWidth: 640 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: T.paper, boxShadow: '0 1px 3px rgba(0,0,0,.05)', fontSize: '.9rem' }}>
            <tbody>
              <tr style={{ background: T.sand }}>
                <td style={{ ...tdL, color: T.canopy }}>INGRESOS (cobrado)</td><td style={tdR}></td><td style={tdPct}></td>
              </tr>
              <tr>
                <td style={{ ...tdL, paddingLeft: 28 }}>Cobros del mes</td>
                <td style={{ ...tdR, color: T.canopy, fontWeight: 600 }}>Q {fmt(R.ingresos)}</td>
                <td style={tdPct}>100%</td>
              </tr>

              <tr style={{ background: T.sand }}>
                <td style={{ ...tdL, color: T.err }}>EGRESOS</td><td style={tdR}></td><td style={tdPct}></td>
              </tr>
              {CATS_EGRESO.map(c => (
                <tr key={c.k}>
                  <td style={{ ...tdL, paddingLeft: 28 }}>{c.icon} {c.label}</td>
                  <td style={{ ...tdR, color: R.egresos[c.k] > 0 ? T.ink : T.muted }}>{R.egresos[c.k] > 0 ? `Q ${fmt(R.egresos[c.k])}` : '—'}</td>
                  <td style={tdPct}>{R.egresos[c.k] > 0 ? pct(R.egresos[c.k]) : ''}</td>
                </tr>
              ))}
              <tr style={{ borderTop: `1px solid ${T.rule}` }}>
                <td style={{ ...tdL, paddingLeft: 28, fontWeight: 600 }}>Total egresos</td>
                <td style={{ ...tdR, fontWeight: 700, color: T.err }}>Q {fmt(R.totalEgreso)}</td>
                <td style={tdPct}>{pct(R.totalEgreso)}</td>
              </tr>

              {!perms.hide_utility && (
                <tr style={{ background: R.utilidad >= 0 ? 'rgba(46,125,50,.08)' : 'rgba(176,0,32,.08)', borderTop: `2px solid ${T.forest}` }}>
                  <td style={{ ...tdL, fontWeight: 800, fontFamily: "'Fraunces', serif", fontSize: '1.05rem' }}>RESULTADO DE CAJA</td>
                  <td style={{ ...tdR, fontWeight: 800, fontSize: '1.05rem', color: R.utilidad >= 0 ? T.ok : T.err }}>Q {fmt(R.utilidad)}</td>
                  <td style={{ ...tdPct, fontWeight: 700, color: R.utilidad >= 0 ? T.ok : T.err }}>{pct(R.utilidad)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {R.ventas > 0 && (
            <div style={{ marginTop: 14, background: T.paper, border: `1px solid ${T.rule}`, borderLeft: `3px solid ${T.ochre}`, padding: '10px 14px' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.muted }}>Ventas facturadas del mes (aún no cobradas todas)</div>
              <div style={{ fontWeight: 700, color: T.ochre, fontSize: '1.1rem' }}>Q {fmt(R.ventas)}</div>
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: '.75rem', color: T.muted }}>
            * Base caja: cuenta lo efectivamente cobrado y pagado en el mes. Las ventas facturadas se muestran aparte
            porque pueden cobrarse en otro período. Cuando conectemos bancos, esto cuadra solo.
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn = { padding: '6px 10px', border: `1px solid ${T.rule}`, background: 'white', cursor: 'pointer', borderRadius: 3 };
const tdL = { padding: '9px 14px', borderBottom: `1px solid ${T.rule}`, fontWeight: 700, letterSpacing: '.03em', fontSize: '.82rem' };
const tdR = { padding: '9px 14px', borderBottom: `1px solid ${T.rule}`, textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' };
const tdPct = { padding: '9px 14px', borderBottom: `1px solid ${T.rule}`, textAlign: 'right', width: 70, color: T.muted, fontSize: '.8rem' };
