import { useMemo, useState } from 'react';
import { useMovimientosUnificados } from './useMovimientosUnificados';
import { useAuth } from '../../hooks/useAuth';

const T = {
  bg: '#F8F3E9', paper: '#FFFFFF', ink: '#1A1A18', forest: '#1F3A2C',
  canopy: '#2D6645', ochre: '#A8835A', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)',
  ok: '#2E7D32', warn: '#B26A00', err: '#B00020', sand: '#E7DDC9',
};

const fmt = (n) => Number.isFinite(n) ? n.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0';

export default function FinanzasDashboard() {
  const { getFinanzasPerms } = useAuth();
  const perms = getFinanzasPerms();

  const [periodo, setPeriodo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const { movimientos, loading } = useMovimientosUnificados();

  const kpis = useMemo(() => {
    const delMes = (movimientos || []).filter(m => (m.fecha || '').startsWith(periodo));
    let entro = 0, salio = 0, ventas = 0;
    let nEntro = 0, nSalio = 0;
    for (const m of delMes) {
      if (!m.caja) { ventas += (m.flujo === 'entra' ? m.monto : -m.monto); continue; } // ventas netas de notas crédito
      if (m.flujo === 'entra') { entro += m.monto; nEntro++; }
      else { salio += m.monto; nSalio++; }
    }
    return { entro, salio, ventas, balance: entro - salio, nEntro, nSalio };
  }, [movimientos, periodo]);

  // Desglose de salidas por origen (dónde se fue la plata)
  const salidasPorTipo = useMemo(() => {
    const delMes = (movimientos || []).filter(m => (m.fecha || '').startsWith(periodo) && m.caja && m.flujo === 'sale');
    const acc = {};
    for (const m of delMes) { acc[m.tipoLabel] = (acc[m.tipoLabel] || 0) + m.monto; }
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [movimientos, periodo]);

  const cambiarMes = (delta) => {
    const [y, m] = periodo.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setPeriodo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const mesLabel = new Date(periodo + '-01').toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: '.82rem', color: T.muted, marginBottom: 4 }}>Finanzas · Dashboard</div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.55rem', fontWeight: 600, color: T.forest }}>Dashboard · {mesLabel}</h1>
          <div style={{ fontSize: '.85rem', color: T.muted, marginTop: 3 }}>Todo el dinero del mes, consolidado · solo lectura</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => cambiarMes(-1)} style={navBtn}>◀</button>
          <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ padding: '6px 10px', border: `1px solid ${T.rule}`, borderRadius: 3, fontSize: '.85rem' }} />
          <button onClick={() => cambiarMes(1)} style={navBtn}>▶</button>
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>Consolidando movimientos…</div>}

      {!loading && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`, gap: 10, marginBottom: 18 }}>
            <Kpi lbl="Entró (caja)" val={`Q ${fmt(kpis.entro)}`} sub={`${kpis.nEntro} cobros`} color={T.canopy} />
            <Kpi lbl="Salió (caja)" val={`Q ${fmt(kpis.salio)}`} sub={`${kpis.nSalio} pagos`} color={T.err} />
            {!perms.hide_utility && (
              <Kpi lbl="Balance de caja" val={`Q ${fmt(kpis.balance)}`} sub={kpis.balance >= 0 ? 'positivo' : 'negativo'} color={kpis.balance >= 0 ? T.ok : T.err} />
            )}
            <Kpi lbl="Ventas del mes" val={`Q ${fmt(kpis.ventas)}`} sub="facturado / a cobrar" color={T.ochre} />
          </div>

          {/* Desglose de salidas */}
          {salidasPorTipo.length > 0 && (
            <div style={{ background: T.paper, border: `1px solid ${T.rule}`, padding: '14px 18px', marginBottom: 18 }}>
              <h3 style={{ fontSize: '.72rem', fontWeight: 700, color: T.muted, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>¿En qué se fue la plata?</h3>
              {salidasPorTipo.map(([tipo, monto]) => {
                const pct = kpis.salio > 0 ? (monto / kpis.salio * 100) : 0;
                return (
                  <div key={tipo} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', marginBottom: 2 }}>
                      <span>{tipo}</span>
                      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>Q {fmt(monto)} <span style={{ color: T.muted, fontWeight: 400 }}>· {pct.toFixed(0)}%</span></span>
                    </div>
                    <div style={{ height: 6, background: T.sand, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: T.ochre }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(movimientos || []).length === 0 && (
            <div style={{ padding: 40, background: T.paper, border: `1px solid ${T.rule}`, textAlign: 'center', color: T.muted }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>💸</div>
              Sin movimientos registrados aún.<br/>
              <span style={{ fontSize: '.85rem' }}>Andá a Movimientos para registrar el primer pago, cobro o venta.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ lbl, val, sub, color }) {
  return (
    <div style={{ background: T.paper, padding: '13px 15px', borderTop: `3px solid ${color}`, border: `1px solid ${T.rule}`, borderTopWidth: 3 }}>
      <div style={{ fontSize: '.64rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.muted }}>{lbl}</div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: '1.45rem', fontWeight: 600, marginTop: 3, color, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
      {sub && <div style={{ fontSize: '.72rem', color: T.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const navBtn = { padding: '6px 10px', border: `1px solid ${T.rule}`, background: 'white', cursor: 'pointer', borderRadius: 3 };
