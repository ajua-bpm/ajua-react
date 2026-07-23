import { useMemo, useState } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import { useAuth } from '../../hooks/useAuth';

const T = {
  bg: '#F8F3E9', paper: '#FFFFFF', ink: '#1A1A18', forest: '#1F3A2C',
  canopy: '#2D6645', ochre: '#A8835A', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)',
  ok: '#2E7D32', warn: '#B26A00', err: '#B00020', sand: '#E7DDC9',
};

const fmt = (n) => Number.isFinite(n) ? n.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0';
const monedaSym = { GTQ: 'Q', MXN: '$', USD: '$' };
const fmtMon = (n, mon) => `${monedaSym[mon] || 'Q'} ${fmt(n)}${mon !== 'GTQ' ? ' ' + mon : ''}`;

export default function FinanzasDashboard() {
  const { getFinanzasPerms } = useAuth();
  const perms = getFinanzasPerms();

  const [periodo, setPeriodo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: movs, loading } = useCollection('movimientos_finanzas', {
    orderField: 'fecha', orderDir: 'desc', limit: 500,
  });

  const kpis = useMemo(() => {
    const mesPrefix = periodo; // "2026-07"
    const delMes = (movs || []).filter(m => (m.fecha || '').startsWith(mesPrefix));
    let entro = 0, salio = 0, porCobrar = 0, porPagar = 0;
    let countEntro = 0, countSalio = 0;
    for (const m of delMes) {
      const monto = parseFloat(m.montoGTQ ?? m.monto) || 0;
      if (m.tipo === 'cobro' && m.estado === 'cobrado') { entro += monto; countEntro++; }
      if (m.tipo === 'cobro' && m.estado !== 'cobrado') porCobrar += monto;
      if ((m.tipo === 'pago' || m.tipo === 'gasto_op') && m.estado === 'pagado') { salio += monto; countSalio++; }
      if ((m.tipo === 'pago' || m.tipo === 'gasto_op') && m.estado !== 'pagado' && m.estado !== 'cargado') porPagar += monto;
    }
    return { entro, salio, utilidad: entro - salio, porCobrar, porPagar, countEntro, countSalio };
  }, [movs, periodo]);

  const vencimientos = useMemo(() => {
    const hoy = new Date();
    const en7 = new Date(hoy); en7.setDate(hoy.getDate() + 7);
    const en7Str = en7.toISOString().slice(0, 10);
    const hoyStr = hoy.toISOString().slice(0, 10);
    return (movs || [])
      .filter(m => m.tipo === 'pago' && m.estado !== 'pagado' && m.fecha_vencimiento && m.fecha_vencimiento >= hoyStr && m.fecha_vencimiento <= en7Str)
      .sort((a, b) => (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || ''));
  }, [movs]);

  // Mes anterior/siguiente
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
          <div style={{ fontSize: '.85rem', color: T.muted, marginTop: 3 }}>Foto general del mes · solo lectura</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => cambiarMes(-1)} style={{ padding: '6px 10px', border: `1px solid ${T.rule}`, background: 'white', cursor: 'pointer', borderRadius: 3 }}>◀</button>
          <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
            style={{ padding: '6px 10px', border: `1px solid ${T.rule}`, borderRadius: 3, fontSize: '.85rem' }} />
          <button onClick={() => cambiarMes(1)} style={{ padding: '6px 10px', border: `1px solid ${T.rule}`, background: 'white', cursor: 'pointer', borderRadius: 3 }}>▶</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${perms.hide_utility ? 4 : 5}, 1fr)`, gap: 10, marginBottom: 18 }}>
        <Kpi lbl="Entró"       val={`Q ${fmt(kpis.entro)}`}      sub={`${kpis.countEntro} movimientos`} color={T.canopy} />
        <Kpi lbl="Salió"       val={`Q ${fmt(kpis.salio)}`}      sub={`${kpis.countSalio} movimientos`} color={T.err} />
        {!perms.hide_utility && (
          <Kpi lbl="Utilidad"  val={`Q ${fmt(kpis.utilidad)}`}   sub={kpis.entro > 0 ? `margen ${(kpis.utilidad / kpis.entro * 100).toFixed(1)}%` : ''} color={T.ochre} />
        )}
        <Kpi lbl="Por cobrar"  val={`Q ${fmt(kpis.porCobrar)}`} sub="" color="#1565C0" />
        <Kpi lbl="Por pagar"   val={`Q ${fmt(kpis.porPagar)}`}  sub="" color={T.warn} />
      </div>

      {/* Vencimientos */}
      {vencimientos.length > 0 && (
        <div style={{ background: 'rgba(176,0,32,.05)', borderLeft: `3px solid ${T.err}`, padding: '12px 16px', marginBottom: 18, borderRadius: 3 }}>
          <h3 style={{ fontSize: '.78rem', fontWeight: 700, color: T.err, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            🔴 Vencen esta semana
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '6px 20px', fontSize: '.84rem' }}>
            {vencimientos.map(v => (
              <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span>{v.concepto || '—'} · <b>{fmtMon(v.monto, v.moneda || 'GTQ')}</b></span>
                <span style={{ fontSize: '.72rem', color: T.muted }}>vence {v.fecha_vencimiento}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>Cargando movimientos…</div>}

      {!loading && (movs || []).length === 0 && (
        <div style={{ padding: 40, background: T.paper, border: `1px solid ${T.rule}`, textAlign: 'center', color: T.muted }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>💸</div>
          Sin movimientos registrados aún.<br/>
          <span style={{ fontSize: '.85rem' }}>Andá a Movimientos para cargar el primer pago o cobro.</span>
        </div>
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
