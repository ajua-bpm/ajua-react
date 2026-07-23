import { useMemo, useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import ModalNuevoPago from './modals/ModalNuevoPago';
import ModalNuevoCobro from './modals/ModalNuevoCobro';
import ModalNuevoGastoOp from './modals/ModalNuevoGastoOp';

const T = {
  bg: '#F8F3E9', paper: '#FFFFFF', ink: '#1A1A18', forest: '#1F3A2C',
  canopy: '#2D6645', ochre: '#A8835A', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)',
  ok: '#2E7D32', warn: '#B26A00', err: '#B00020', sand: '#E7DDC9',
};

const fmt = (n) => Number.isFinite(n) ? n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
const monedaSym = { GTQ: 'Q', MXN: '$', USD: '$' };
const fmtMon = (n, mon) => `${monedaSym[mon] || 'Q'} ${fmt(n)}${mon !== 'GTQ' ? ' ' + mon : ''}`;

const CAT_LABELS = {
  importacion: 'Importación MX',
  proveedor_local: 'Proveedores locales',
  servicios: 'Servicios',
  rentas: 'Rentas',
  sueldos: 'Sueldos',
  impuestos: 'Impuestos',
  otros: 'Otros',
  gasto_op: 'Gasto operativo',
  cobro: 'Cobro',
};

export default function FinanzasMovimientos() {
  const { user, getFinanzasPerms } = useAuth();
  const perms = getFinanzasPerms();
  const toast = useToast();

  const { data: movs, loading } = useCollection('movimientos_finanzas', {
    orderField: 'fecha', orderDir: 'desc', limit: 500,
  });
  const { update } = useWrite('movimientos_finanzas');

  const [filCat, setFilCat] = useState('');
  const [filEstado, setFilEstado] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);

  // Modo supervisor = solo puede cargar gastos operativos
  const modoSupervisor = perms.cargar_gastos_op && !perms.cargar_pagos && !perms.cargar_cobros;

  const filtrados = useMemo(() => {
    let r = movs || [];
    // Supervisor solo ve SUS gastos operativos + últimos N días
    if (modoSupervisor) {
      r = r.filter(m => m.tipo === 'gasto_op' && m.creadoPor === user?.usuario);
      if (perms.historial_dias > 0) {
        const limite = new Date();
        limite.setDate(limite.getDate() - perms.historial_dias);
        const limiteStr = limite.toISOString().slice(0, 10);
        r = r.filter(m => (m.fecha || '') >= limiteStr);
      }
    } else {
      // Ocultar sueldos si no tiene permiso
      if (perms.hide_sueldos) r = r.filter(m => m.categoria !== 'sueldos');
    }
    if (filCat) r = r.filter(m => m.categoria === filCat || (filCat === 'gasto_op' && m.tipo === 'gasto_op'));
    if (filEstado) r = r.filter(m => m.estado === filEstado);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(m => (m.concepto || '').toLowerCase().includes(q) || (m.proveedor || '').toLowerCase().includes(q));
    }
    return r;
  }, [movs, modoSupervisor, user, perms, filCat, filEstado, search]);

  const marcarPagado = async (mov) => {
    try {
      await update(mov.id, { estado: mov.tipo === 'cobro' ? 'cobrado' : 'pagado', pagadoEn: new Date().toISOString(), pagadoPor: user?.usuario });
      toast('✓ Marcado como ' + (mov.tipo === 'cobro' ? 'cobrado' : 'pagado'));
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  return (
    <div>
      <div style={{ fontSize: '.82rem', color: T.muted, marginBottom: 4 }}>Finanzas · Movimientos</div>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.55rem', fontWeight: 600, color: T.forest }}>
        {modoSupervisor ? 'Mis gastos operativos' : 'Movimientos'}
      </h1>
      <div style={{ fontSize: '.85rem', color: T.muted, marginBottom: 20 }}>
        {modoSupervisor
          ? `Últimos ${perms.historial_dias} días · Solo tus gastos · Tope Q ${perms.tope_gastos_op} directo`
          : 'Cargar, editar y marcar como pagado/cobrado'}
      </div>

      {/* Botones de acción según permisos */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        {perms.cargar_pagos && (
          <button className="btn" onClick={() => setModal('pago')} style={btnPrimary}>+ Nuevo pago</button>
        )}
        {perms.cargar_cobros && (
          <button className="btn" onClick={() => setModal('cobro')} style={btnPrimary}>+ Nuevo cobro</button>
        )}
        {perms.cargar_gastos_op && (
          <button className="btn" onClick={() => setModal('gasto_op')} style={btnOchre}>+ Nuevo gasto operativo</button>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <span style={{ fontSize: '.68rem', fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '.1em' }}>Filtrar:</span>
        <select value={filCat} onChange={e => setFilCat(e.target.value)} style={selectStyle}>
          <option value="">Todas las categorías</option>
          {Object.entries(CAT_LABELS).filter(([k]) => modoSupervisor ? k === 'gasto_op' : k !== 'gasto_op').map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filEstado} onChange={e => setFilEstado(e.target.value)} style={selectStyle}>
          <option value="">Todos los estados</option>
          <option value="pagado">Pagado</option>
          <option value="cobrado">Cobrado</option>
          <option value="pendiente">Pendiente</option>
          <option value="pendiente_aprobacion">Pendiente aprobación</option>
        </select>
        <input type="search" placeholder="Buscar concepto o proveedor…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...selectStyle, flex: '1 1 200px', minWidth: 180 }} />
      </div>

      {/* Tabla */}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Fecha</th>
            <th style={thStyle}>Categoría</th>
            <th style={thStyle}>Concepto</th>
            {!modoSupervisor && <th style={thStyle}>Proveedor / Cliente</th>}
            <th style={{ ...thStyle, textAlign: 'right' }}>Monto</th>
            <th style={thStyle}>Forma</th>
            <th style={thStyle}>Estado</th>
            <th style={thStyle}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={modoSupervisor ? 7 : 8} style={tdCenter}>Cargando…</td></tr>
          )}
          {!loading && filtrados.length === 0 && (
            <tr><td colSpan={modoSupervisor ? 7 : 8} style={tdCenter}>
              <div style={{ padding: 30, color: T.muted }}>
                Sin movimientos.<br/>
                <span style={{ fontSize: '.85rem' }}>Cargá el primero con los botones de arriba.</span>
              </div>
            </td></tr>
          )}
          {filtrados.map((m, i) => (
            <tr key={m.id} style={{ background: i % 2 ? '#FAFAF7' : T.paper }}>
              <td style={tdStyle}>{m.fecha || '—'}</td>
              <td style={tdStyle}>
                <span style={badgeCat}>{CAT_LABELS[m.categoria] || m.tipo || '—'}</span>
                {m.subcategoria && <div style={{ fontSize: '.72rem', color: T.muted, marginTop: 2 }}>{m.subcategoria}</div>}
              </td>
              <td style={tdStyle}>{m.concepto || '—'}</td>
              {!modoSupervisor && <td style={tdStyle}>{m.proveedor || m.cliente || '—'}</td>}
              <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
                {fmtMon(parseFloat(m.monto) || 0, m.moneda || 'GTQ')}
              </td>
              <td style={tdStyle}>{m.forma_pago || '—'}</td>
              <td style={tdStyle}>{renderEstado(m)}</td>
              <td style={tdStyle}>
                {(m.estado === 'pendiente' || m.estado === 'pendiente_aprobacion') && perms.marcar_pagado && (
                  <button onClick={() => marcarPagado(m)} style={btnMiniOk}>
                    Marcar {m.tipo === 'cobro' ? 'cobrado' : 'pagado'}
                  </button>
                )}
                {(m.estado === 'pagado' || m.estado === 'cobrado' || m.estado === 'cargado') && (
                  <button style={btnMini}>Ver</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal === 'pago' && <ModalNuevoPago onClose={() => setModal(null)} />}
      {modal === 'cobro' && <ModalNuevoCobro onClose={() => setModal(null)} />}
      {modal === 'gasto_op' && <ModalNuevoGastoOp onClose={() => setModal(null)} perms={perms} />}
    </div>
  );
}

function renderEstado(m) {
  const badges = {
    pagado:     { bg: 'rgba(46,125,50,.14)',  color: T.ok,    txt: 'Pagado' },
    cobrado:    { bg: 'rgba(46,125,50,.14)',  color: T.ok,    txt: 'Cobrado' },
    cargado:    { bg: 'rgba(46,125,50,.14)',  color: T.ok,    txt: 'Cargado' },
    pendiente:  { bg: 'rgba(178,106,0,.14)',  color: T.warn,  txt: 'Pendiente' },
    vencido:    { bg: 'rgba(176,0,32,.14)',   color: T.err,   txt: 'Vencido' },
    pendiente_aprobacion: { bg: 'rgba(168,131,90,.16)', color: T.ochre, txt: 'Pend. aprobación' },
  };
  const b = badges[m.estado] || badges.pendiente;
  return <span style={{ padding: '2px 8px', borderRadius: 2, fontSize: '.66rem', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', background: b.bg, color: b.color }}>{b.txt}</span>;
}

const btnPrimary = { padding: '9px 16px', borderRadius: 3, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', border: `1.5px solid ${T.forest}`, background: T.forest, color: 'white' };
const btnOchre = { ...btnPrimary, background: T.ochre, borderColor: T.ochre };
const btnMini = { padding: '3px 8px', border: `1px solid ${T.rule}`, background: 'white', borderRadius: 3, cursor: 'pointer', fontSize: '.72rem', fontWeight: 600, color: T.forest };
const btnMiniOk = { ...btnMini, borderColor: T.canopy, color: T.canopy };
const selectStyle = { padding: '6px 10px', border: `1px solid ${T.rule}`, borderRadius: 3, fontSize: '.82rem', background: 'white' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '.84rem', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.05)' };
const thStyle = { background: T.forest, color: 'white', textAlign: 'left', padding: '8px 10px', fontSize: '.66rem', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 };
const tdStyle = { padding: '8px 10px', borderBottom: `1px solid ${T.rule}`, verticalAlign: 'top' };
const tdCenter = { ...tdStyle, textAlign: 'center' };
const badgeCat = { display: 'inline-block', padding: '2px 6px', borderRadius: 2, fontSize: '.66rem', fontWeight: 600, background: 'rgba(168,131,90,.12)', color: T.ochre };
