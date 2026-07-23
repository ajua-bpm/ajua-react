import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { db, doc, deleteDoc } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { useMovimientosUnificados } from './useMovimientosUnificados';
import ModalRegistrar from './modals/ModalRegistrar';
import ModalNuevoGastoOp from './modals/ModalNuevoGastoOp';

const T = {
  bg: '#F8F3E9', paper: '#FFFFFF', ink: '#1A1A18', forest: '#1F3A2C',
  canopy: '#2D6645', ochre: '#A8835A', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)',
  ok: '#2E7D32', warn: '#B26A00', err: '#B00020', sand: '#E7DDC9',
};

const fmt = (n) => Number.isFinite(n) ? n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
const monedaSym = { GTQ: 'Q', MXN: '$', USD: '$' };
const fmtMon = (n, mon) => `${monedaSym[mon] || 'Q'} ${fmt(n)}${mon && mon !== 'GTQ' ? ' ' + mon : ''}`;

// Orígenes para el filtro
const ORIGENES = [
  { k: '', label: 'Todo' },
  { k: 'proveedor', label: 'Pagos proveedor' },
  { k: 'cliente', label: 'Ventas y cobros' },
  { k: 'empleado', label: 'Anticipos' },
  { k: 'finanzas', label: 'Gastos' },
];

export default function FinanzasMovimientos() {
  const { user, getFinanzasPerms } = useAuth();
  const perms = getFinanzasPerms();
  const toast = useToast();

  const { movimientos, loading, proveedores, clientes } = useMovimientosUnificados();

  const [filOrigen, setFilOrigen] = useState('');
  const [filFlujo, setFilFlujo] = useState(''); // '' | 'entra' | 'sale'
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'registrar' | 'gasto_op'

  // Modo supervisor operativo: solo gastos operativos propios
  const modoSupervisor = perms.cargar_gastos_op && !perms.cargar_pagos && !perms.cargar_cobros;

  const filtrados = useMemo(() => {
    let r = movimientos || [];
    if (modoSupervisor) {
      // Supervisor solo ve gastos operativos que él cargó
      r = r.filter(m => m._raw?.tipo === 'gasto_op' && m._raw?.creadoPor === user?.usuario);
      if (perms.historial_dias > 0) {
        const lim = new Date(); lim.setDate(lim.getDate() - perms.historial_dias);
        const limStr = lim.toISOString().slice(0, 10);
        r = r.filter(m => (m.fecha || '') >= limStr);
      }
    } else if (perms.hide_sueldos) {
      r = r.filter(m => m._origen !== 'empleado' && m._raw?.categoria !== 'sueldos');
    }
    if (filOrigen) r = r.filter(m => m._origen === filOrigen);
    if (filFlujo) r = r.filter(m => m.flujo === filFlujo);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(m => (m.concepto || '').toLowerCase().includes(q) || (m.entidad || '').toLowerCase().includes(q) || (m.tipoLabel || '').toLowerCase().includes(q));
    }
    return r;
  }, [movimientos, modoSupervisor, user, perms, filOrigen, filFlujo, search]);

  const totales = useMemo(() => {
    let entra = 0, sale = 0, ventas = 0;
    for (const m of filtrados) {
      if (!m.caja) { ventas += (m.flujo === 'entra' ? m.monto : -m.monto); continue; } // devengado neto (ventas − notas crédito)
      if (m.flujo === 'entra') entra += m.monto; else sale += m.monto;
    }
    return { entra, sale, ventas };
  }, [filtrados]);

  const exportar = () => {
    if (filtrados.length === 0) return;
    const header = ['Fecha', 'Movimiento', 'Entidad', 'Concepto', 'Entra', 'Sale', 'Estado'];
    const rows = filtrados.map(m => [
      m.fecha || '', m.tipoLabel || '', m.entidad || '', m.concepto || '',
      m.flujo === 'entra' ? m.monto : '', m.flujo === 'sale' ? m.monto : '', m.estado || '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = [12, 18, 24, 30, 12, 12, 12].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    XLSX.writeFile(wb, `movimientos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const anular = async (m) => {
    if (!window.confirm(`¿ANULAR este movimiento?\n\n${m.tipoLabel} · ${m.entidad || ''}\n${m.concepto || ''} · ${fmtMon(m.monto, m.moneda)}\n\nSe elimina de forma permanente del estado de cuenta correspondiente. No se puede deshacer.`)) return;
    try {
      await deleteDoc(doc(db, m._col, m.id));
      toast('Movimiento anulado');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  const puedeRegistrar = perms.cargar_pagos || perms.cargar_cobros;

  return (
    <div>
      <div style={{ fontSize: '.82rem', color: T.muted, marginBottom: 4 }}>Finanzas · Movimientos</div>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.55rem', fontWeight: 600, color: T.forest }}>
        {modoSupervisor ? 'Mis gastos operativos' : 'Movimientos'}
      </h1>
      <div style={{ fontSize: '.85rem', color: T.muted, marginBottom: 18 }}>
        {modoSupervisor
          ? `Últimos ${perms.historial_dias} días · Tope Q ${perms.tope_gastos_op} directo`
          : 'Todo el dinero que entra y sale, en un solo lugar. Cada registro cae en el estado de cuenta correcto.'}
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        {puedeRegistrar && (
          <button onClick={() => setModal('registrar')} style={btnBig}>+ Registrar movimiento</button>
        )}
        {perms.cargar_gastos_op && (
          <button onClick={() => setModal('gasto_op')} style={btnOchre}>+ Gasto operativo</button>
        )}
        <div style={{ flex: 1 }} />
        {perms.exportar && filtrados.length > 0 && (
          <button onClick={exportar} style={btnExport}>⬇ Excel</button>
        )}
      </div>

      {/* Resumen del filtro actual */}
      {!modoSupervisor && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <Chip label="Entró (caja)" val={`Q ${fmt(totales.entra)}`} color={T.canopy} />
          <Chip label="Salió (caja)" val={`Q ${fmt(totales.sale)}`} color={T.err} />
          {totales.ventas > 0 && <Chip label="Ventas (a cobrar)" val={`Q ${fmt(totales.ventas)}`} color={T.ochre} />}
          <Chip label="Movimientos" val={filtrados.length} color={T.muted} />
        </div>
      )}

      {/* Filtros */}
      {!modoSupervisor && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {ORIGENES.map(o => (
              <button key={o.k} onClick={() => setFilOrigen(o.k)} style={{
                padding: '5px 12px', borderRadius: 100, cursor: 'pointer', fontSize: '.78rem', fontWeight: 600,
                border: `1.5px solid ${filOrigen === o.k ? T.forest : T.rule}`,
                background: filOrigen === o.k ? T.forest : 'white', color: filOrigen === o.k ? 'white' : T.ink,
              }}>{o.label}</button>
            ))}
          </div>
          <select value={filFlujo} onChange={e => setFilFlujo(e.target.value)} style={selectStyle}>
            <option value="">Entra y sale</option>
            <option value="entra">Solo entra</option>
            <option value="sale">Solo sale</option>
          </select>
          <input type="search" placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...selectStyle, flex: '1 1 160px', minWidth: 140 }} />
        </div>
      )}

      {/* Tabla */}
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Fecha</th>
              <th style={thStyle}>Movimiento</th>
              <th style={thStyle}>Proveedor / Cliente / Empleado</th>
              <th style={thStyle}>Concepto</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Monto</th>
              <th style={thStyle}>Estado</th>
              {perms.anular && <th style={thStyle}></th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={perms.anular ? 7 : 6} style={tdCenter}>Cargando…</td></tr>}
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={perms.anular ? 7 : 6} style={tdCenter}>
                <div style={{ padding: 30, color: T.muted }}>
                  Sin movimientos.<br/>
                  <span style={{ fontSize: '.85rem' }}>Registrá el primero con el botón de arriba.</span>
                </div>
              </td></tr>
            )}
            {filtrados.map((m, i) => (
              <tr key={m._col + m.id} style={{ background: i % 2 ? '#FAFAF7' : T.paper }}>
                <td style={tdStyle}>{m.fecha || '—'}</td>
                <td style={tdStyle}>
                  <span style={{ ...badge, ...origenBadge(m._origen) }}>
                    {m.flujo === 'entra' ? '↓ ' : '↑ '}{m.tipoLabel}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontWeight: m.entidad ? 600 : 400, color: m.entidad ? T.forest : T.muted }}>{m.entidad || '—'}</td>
                <td style={tdStyle}>{m.concepto || '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: m.flujo === 'entra' ? T.canopy : T.err }}>
                  {m.flujo === 'entra' ? '+' : '−'} {fmtMon(m.monto, m.moneda)}
                </td>
                <td style={tdStyle}>{renderEstado(m.estado)}</td>
                {perms.anular && (
                  <td style={tdStyle}>
                    <button onClick={() => anular(m)} title="Anular movimiento" style={btnAnular}>✕</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal === 'registrar' && <ModalRegistrar proveedores={proveedores} clientes={clientes} onClose={() => setModal(null)} />}
      {modal === 'gasto_op' && <ModalNuevoGastoOp onClose={() => setModal(null)} perms={perms} />}
    </div>
  );
}

function Chip({ label, val, color }) {
  return (
    <div style={{ background: T.paper, border: `1px solid ${T.rule}`, borderLeft: `3px solid ${color}`, padding: '6px 14px', borderRadius: 3 }}>
      <span style={{ fontSize: '.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: T.muted }}>{label} </span>
      <span style={{ fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
    </div>
  );
}

function origenBadge(origen) {
  const map = {
    proveedor: { background: 'rgba(31,58,44,.10)', color: T.forest },
    cliente:   { background: 'rgba(45,102,69,.12)', color: T.canopy },
    empleado:  { background: 'rgba(168,131,90,.14)', color: T.ochre },
    finanzas:  { background: 'rgba(107,107,96,.12)', color: T.muted },
  };
  return map[origen] || map.finanzas;
}

function renderEstado(estado) {
  const badges = {
    pagado:     { bg: 'rgba(46,125,50,.14)', color: T.ok,   txt: 'Pagado' },
    cobrado:    { bg: 'rgba(46,125,50,.14)', color: T.ok,   txt: 'Cobrado' },
    pendiente:  { bg: 'rgba(178,106,0,.14)', color: T.warn, txt: 'Pendiente' },
    pendiente_aprobacion: { bg: 'rgba(168,131,90,.16)', color: T.ochre, txt: 'Pend. aprob.' },
    descontado: { bg: 'rgba(46,125,50,.12)', color: T.ok,   txt: 'Descontado' },
    nota:       { bg: 'rgba(168,131,90,.12)', color: T.ochre, txt: 'Nota créd.' },
  };
  const b = badges[estado] || { bg: 'rgba(107,107,96,.12)', color: T.muted, txt: estado || '—' };
  return <span style={{ padding: '2px 8px', borderRadius: 2, fontSize: '.66rem', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', background: b.bg, color: b.color }}>{b.txt}</span>;
}

const btnBig = { padding: '10px 20px', borderRadius: 3, fontWeight: 700, fontSize: '.88rem', cursor: 'pointer', border: `1.5px solid ${T.forest}`, background: T.forest, color: 'white' };
const btnOchre = { padding: '10px 16px', borderRadius: 3, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', border: `1.5px solid ${T.ochre}`, background: T.ochre, color: 'white' };
const btnExport = { padding: '8px 14px', borderRadius: 3, fontWeight: 600, fontSize: '.8rem', cursor: 'pointer', border: `1.5px solid ${T.canopy}`, background: 'white', color: T.canopy };
const selectStyle = { padding: '6px 10px', border: `1px solid ${T.rule}`, borderRadius: 3, fontSize: '.82rem', background: 'white' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '.84rem', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.05)', minWidth: 720 };
const thStyle = { background: T.forest, color: 'white', textAlign: 'left', padding: '8px 10px', fontSize: '.66rem', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 };
const tdStyle = { padding: '8px 10px', borderBottom: `1px solid ${T.rule}`, verticalAlign: 'top' };
const tdCenter = { ...tdStyle, textAlign: 'center' };
const badge = { display: 'inline-block', padding: '2px 8px', borderRadius: 2, fontSize: '.68rem', fontWeight: 700 };
const btnAnular = { padding: '2px 8px', border: `1px solid ${T.rule}`, background: 'white', borderRadius: 3, cursor: 'pointer', fontSize: '.72rem', fontWeight: 700, color: T.err };
