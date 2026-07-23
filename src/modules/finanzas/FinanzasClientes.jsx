import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCuentaCliente, useClientesList } from '../cuentasClientes/useCuentaCliente';

// Estado de cuenta de clientes (CxC) EMBEBIDO en el hub Finanzas.
// Reusa el hook useCuentaCliente (misma lógica de saldos que Cuentas Clientes).
const T = {
  bg: '#F8F3E9', paper: '#FFFFFF', ink: '#1A1A18', forest: '#1F3A2C',
  canopy: '#2D6645', ochre: '#A8835A', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)',
  ok: '#2E7D32', warn: '#B26A00', err: '#B00020', sand: '#E7DDC9', blue: '#1565C0',
};
const fmt = (n) => Number.isFinite(n) ? n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

const TIPO_LABEL = {
  despacho:     { txt: 'Venta / despacho', color: T.blue },
  pago:         { txt: 'Cobro', color: T.canopy },
  nota_credito: { txt: 'Nota de crédito', color: T.warn },
};

export default function FinanzasClientes() {
  const { clientes, loading: lc } = useClientesList();
  const [cliId, setCliId] = useState('');
  const { movimientos, resumen, loading } = useCuentaCliente(cliId);

  const cli = clientes.find(c => c.id === cliId);

  return (
    <div>
      <div style={{ fontSize: '.82rem', color: T.muted, marginBottom: 4 }}>Finanzas · Estado de cuenta clientes</div>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.55rem', fontWeight: 600, color: T.forest }}>Cuenta por cobrar — Clientes</h1>
      <div style={{ fontSize: '.85rem', color: T.muted, marginBottom: 18 }}>
        Elegí un cliente y mirá cuánto te debe. Para registrar una venta o un cobro usá <b>Movimientos → Registrar → Venta / Cobro</b>.
      </div>

      {/* Selector */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <select value={cliId} onChange={e => setCliId(e.target.value)} disabled={lc}
          style={{ padding: '9px 12px', border: `1.5px solid ${T.rule}`, borderRadius: 3, fontSize: '.9rem', minWidth: 260, background: 'white' }}>
          <option value="">{lc ? 'Cargando clientes…' : '— Seleccionar cliente —'}</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {cli && (
          <Link to="/cuentas-clientes" style={{ fontSize: '.8rem', color: T.canopy, fontWeight: 600 }}>
            Abrir en módulo completo ↗
          </Link>
        )}
      </div>

      {!cliId && (
        <div style={{ padding: 50, background: T.paper, border: `1px solid ${T.rule}`, textAlign: 'center', color: T.muted }}>
          <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>🛒</div>
          Seleccioná un cliente para ver su estado de cuenta.
        </div>
      )}

      {cliId && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
            <Kpi lbl="Vendido" val={`Q ${fmt(resumen.despachado)}`} color={T.blue} />
            <Kpi lbl="Notas crédito" val={`Q ${fmt(resumen.notas)}`} color={T.warn} />
            <Kpi lbl="Cobrado" val={`Q ${fmt(resumen.cobrado)}`} color={T.canopy} />
            <Kpi lbl="Saldo" val={`Q ${fmt(resumen.saldo)}`} color={resumen.saldo > 0 ? T.err : T.ok}
              sub={resumen.saldo > 0 ? 'Te debe' : resumen.saldo < 0 ? 'A favor' : 'Al día'} big />
          </div>

          {loading && <div style={{ padding: 30, textAlign: 'center', color: T.muted }}>Cargando movimientos…</div>}
          {!loading && movimientos.length === 0 && (
            <div style={{ padding: 40, background: T.paper, border: `1px solid ${T.rule}`, textAlign: 'center', color: T.muted }}>
              Sin movimientos para {cli?.nombre}.
            </div>
          )}
          {!loading && movimientos.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thL}>Fecha</th>
                    <th style={thL}>Movimiento</th>
                    <th style={thL}>Detalle</th>
                    <th style={thR}>Cargo</th>
                    <th style={thR}>Abono</th>
                    <th style={thR}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m, i) => {
                    const t = TIPO_LABEL[m.tipo] || { txt: m.tipo || '—', color: T.muted };
                    return (
                      <tr key={m.id} style={{ background: i % 2 ? '#FAFAF7' : T.paper }}>
                        <td style={td}>{m.fecha || '—'}</td>
                        <td style={td}><span style={{ color: t.color, fontWeight: 600, fontSize: '.8rem' }}>{t.txt}</span></td>
                        <td style={td}>{m.descripcion || m.referencia || m.concepto || '—'}</td>
                        <td style={{ ...tdNum, color: m.cargo > 0 ? T.blue : T.muted }}>{m.cargo > 0 ? fmt(m.cargo) : '—'}</td>
                        <td style={{ ...tdNum, color: m.abono > 0 ? T.canopy : T.muted }}>{m.abono > 0 ? fmt(m.abono) : '—'}</td>
                        <td style={{ ...tdNum, fontWeight: 700, color: m.saldoAcum > 0 ? T.err : T.ok }}>{fmt(m.saldoAcum)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ lbl, val, sub, color, big }) {
  return (
    <div style={{ background: T.paper, padding: '12px 14px', borderTop: `3px solid ${color}`, border: `1px solid ${T.rule}` }}>
      <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.muted }}>{lbl}</div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: big ? '1.4rem' : '1.15rem', fontWeight: 600, marginTop: 2, color, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
      {sub && <div style={{ fontSize: '.7rem', color: T.muted, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '.84rem', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.05)', minWidth: 640 };
const thBase = { background: T.forest, color: 'white', padding: '8px 10px', fontSize: '.66rem', letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 600 };
const thL = { ...thBase, textAlign: 'left' };
const thR = { ...thBase, textAlign: 'right' };
const td = { padding: '8px 10px', borderBottom: `1px solid ${T.rule}`, verticalAlign: 'top' };
const tdNum = { ...td, textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' };
