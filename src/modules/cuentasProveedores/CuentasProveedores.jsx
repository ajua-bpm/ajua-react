// CuentasProveedores.jsx — Estado de cuenta por proveedor

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useProductosCatalogo } from '../../hooks/useMainData';
import { useCuentaProveedor, useProveedoresList } from './useCuentaProveedor';
import MovimientoForm from './MovimientoForm';
import EstadoCuenta from './EstadoCuenta';

const T = {
  primary: '#1B5E20', danger: '#C62828', warn: '#E65100',
  border: '#E0E0E0', textMid: '#6B6B60', textDark: '#1A1A18',
  bg: '#F9F9F7',
};

const fmtQ = n => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
const fmtFecha = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const TIPO_LABEL = { recepcion: 'Recepción', pago: 'Pago', rechazo: 'Rechazo' };
const TIPO_COLOR = { recepcion: '#1565C0', pago: '#2E7D32', rechazo: '#C62828' };
const TIPO_BG    = { recepcion: '#E3F2FD', pago: '#E8F5E9', rechazo: '#FFEBEE' };
const TIPO_ICON  = { recepcion: '📥', pago: '💰', rechazo: '⚠️' };

function Badge({ tipo }) {
  return (
    <span style={{
      fontSize: '.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99,
      background: TIPO_BG[tipo] || T.bg, color: TIPO_COLOR[tipo] || T.textMid,
      whiteSpace: 'nowrap',
    }}>
      {TIPO_ICON[tipo]} {TIPO_LABEL[tipo] || tipo}
    </span>
  );
}

function SummaryCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10,
      padding: '14px 16px', flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.1em',
        color: T.textMid, marginBottom: 4, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, color, lineHeight: 1.2 }}>{fmtQ(value)}</div>
      {sub && <div style={{ fontSize: '.72rem', color: T.textMid, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function AuditLog({ historial }) {
  if (!historial || historial.length === 0) return null;
  return (
    <div style={{ marginTop: 10, borderTop: `1px dashed ${T.border}`, paddingTop: 8 }}>
      <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.08em', color: T.textMid, marginBottom: 6 }}>
        📋 Historial de ediciones
      </div>
      {[...historial].reverse().map((h, i) => (
        <div key={i} style={{ fontSize: '.75rem', color: T.textMid, marginBottom: 4,
          paddingLeft: 8, borderLeft: `2px solid ${T.border}` }}>
          <span style={{ color: T.textDark, fontWeight: 600 }}>{h.por || 'Usuario'}</span>
          {' · '}{h.ts ? new Date(h.ts).toLocaleString('es-GT') : '—'}
          {h.motivo && <div style={{ fontStyle: 'italic', color: T.warn }}>"{h.motivo}"</div>}
        </div>
      ))}
    </div>
  );
}

function DetailRows({ m }) {
  return (
    <div style={{ fontSize: '.82rem', color: T.textMid, lineHeight: 1.8 }}>
      {m.tipo === 'recepcion' && (<>
        {m.producto    && <div>Producto: <strong style={{ color: T.textDark }}>{m.producto}</strong></div>}
        {m.cantidad    && <div>Cantidad: <strong style={{ color: T.textDark }}>{m.cantidad} {m.unidad}</strong></div>}
        {m.precioUnit > 0 && <div>Precio/unidad: <strong style={{ color: T.textDark }}>{fmtQ(m.precioUnit)}</strong></div>}
        {m.factura     && <div>Factura: <strong style={{ color: T.textDark }}>{m.factura}</strong></div>}
      </>)}
      {m.tipo === 'pago' && (<>
        {m.metodoPago  && <div>Método: <strong style={{ color: T.textDark }}>{m.metodoPago}</strong></div>}
        {m.referencia  && <div>Referencia: <strong style={{ color: T.textDark }}>{m.referencia}</strong></div>}
      </>)}
      {m.tipo === 'rechazo' && (<>
        {m.resolucion  && <div>Resolución: <strong style={{ color: T.textDark }}>{m.resolucion}</strong></div>}
      </>)}
      {m.notas && <div style={{ fontStyle: 'italic', marginTop: 2 }}>{m.notas}</div>}
      {m.creadoEn && (
        <div style={{ marginTop: 4, fontSize: '.72rem', color: '#AEAEAE' }}>
          Creado: {new Date(m.creadoEn).toLocaleString('es-GT')}
          {m.ultimaEdicion && ` · Editado: ${new Date(m.ultimaEdicion).toLocaleString('es-GT')}`}
        </div>
      )}
      <AuditLog historial={m.historialEdiciones} />
    </div>
  );
}

function MovCard({ m, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const desc = m.descripcion || (
    m.tipo === 'recepcion' ? m.producto :
    m.tipo === 'pago'      ? `${m.metodoPago || ''} ${m.referencia || ''}`.trim() :
    m.resolucion || '—'
  ) || '—';

  return (
    <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10,
      overflow: 'hidden', marginBottom: 8 }}>
      <div onClick={() => setOpen(o => !o)} style={{
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge tipo={m.tipo} />
            <span style={{ fontSize: '.8rem', color: T.textMid }}>{fmtFecha(m.fecha)}</span>
            {m.historialEdiciones?.length > 0 && (
              <span style={{ fontSize: '.68rem', color: T.warn, fontWeight: 700 }}>
                ✏️ editado
              </span>
            )}
          </div>
          <div style={{ fontSize: '.88rem', fontWeight: 600, color: T.textDark, marginTop: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {desc}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {m.cargo > 0 && <div style={{ fontSize: '.88rem', fontWeight: 700, color: '#1565C0' }}>{fmtQ(m.cargo)}</div>}
          {m.abono > 0 && <div style={{ fontSize: '.88rem', fontWeight: 700, color: T.primary }}>−{fmtQ(m.abono)}</div>}
          <div style={{ fontSize: '.75rem', color: m.saldoAcum > 0 ? T.warn : T.primary, fontWeight: 700, marginTop: 2 }}>
            Saldo: {fmtQ(m.saldoAcum)}
          </div>
        </div>
        <span style={{ fontSize: '.8rem', color: T.textMid, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ background: T.bg, borderTop: `1px solid ${T.border}`, padding: '12px 14px' }}>
          <DetailRows m={m} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={e => { e.stopPropagation(); onEdit(m); }} style={{
              padding: '5px 14px', borderRadius: 6, border: `1px solid ${T.warn}`,
              background: '#fff', color: T.warn, fontSize: '.78rem',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              ✏️ Editar
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(m.id); }} style={{
              padding: '5px 12px', borderRadius: 6, border: `1px solid ${T.danger}`,
              background: '#fff', color: T.danger, fontSize: '.78rem',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DesktopRow({ m, i, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const desc = m.descripcion || (
    m.tipo === 'recepcion' ? m.producto :
    m.tipo === 'pago'      ? `${m.metodoPago || ''} ${m.referencia || ''}`.trim() :
    m.resolucion || '—'
  ) || '—';
  const tdSt = { padding: '10px 14px' };

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        style={{ borderBottom: open ? 'none' : `1px solid ${T.border}`,
          background: i % 2 === 0 ? '#fff' : T.bg,
          cursor: 'pointer' }}>
        <td style={{ ...tdSt, whiteSpace: 'nowrap', color: T.textMid, fontSize: '.82rem' }}>
          {fmtFecha(m.fecha)}
          {m.historialEdiciones?.length > 0 && (
            <span style={{ marginLeft: 6, fontSize: '.65rem', color: T.warn, fontWeight: 700 }}>✏️</span>
          )}
        </td>
        <td style={tdSt}><Badge tipo={m.tipo} /></td>
        <td style={{ ...tdSt, color: T.textMid, maxWidth: 220,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {desc}
        </td>
        <td style={{ ...tdSt, textAlign: 'right', fontWeight: 700,
          color: m.cargo > 0 ? '#1565C0' : T.textMid }}>
          {m.cargo > 0 ? fmtQ(m.cargo) : '—'}
        </td>
        <td style={{ ...tdSt, textAlign: 'right', fontWeight: 700,
          color: m.abono > 0 ? T.primary : T.textMid }}>
          {m.abono > 0 ? fmtQ(m.abono) : '—'}
        </td>
        <td style={{ ...tdSt, textAlign: 'right', fontWeight: 700,
          color: m.saldoAcum > 0 ? T.warn : T.primary }}>
          {fmtQ(m.saldoAcum)}
        </td>
        <td style={{ ...tdSt, textAlign: 'right' }}>
          <span style={{ fontSize: '.72rem', color: T.textMid }}>{open ? '▲' : '▼'}</span>
        </td>
      </tr>
      {open && (
        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
          <td colSpan={7} style={{ padding: '12px 20px', background: T.bg }}>
            <DetailRows m={m} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={e => { e.stopPropagation(); onEdit(m); }} style={{
                padding: '5px 14px', borderRadius: 6, border: `1px solid ${T.warn}`,
                background: '#fff', color: T.warn, fontSize: '.78rem',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                ✏️ Editar
              </button>
              <button onClick={e => { e.stopPropagation(); onDelete(m.id); }} style={{
                padding: '5px 12px', borderRadius: 6, border: `1px solid ${T.danger}`,
                background: '#fff', color: T.danger, fontSize: '.78rem',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Eliminar
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function CuentasProveedores() {
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const { proveedores, loading: loadingProv, cargar: cargarProv } = useProveedoresList();
  const { productos: catProductos } = useProductosCatalogo();

  const [provId,     setProvId]     = useState('');
  const [desde,      setDesde]      = useState('');
  const [hasta,      setHasta]      = useState('');
  const [showForm,   setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [showEstado, setShowEstado] = useState(false);

  // Filtros secundarios (client-side sobre movimientos ya cargados)
  const [filtProd,   setFiltProd]   = useState('');
  const [filtTipo,   setFiltTipo]   = useState('');   // 'recepcion'|'pago'|'rechazo'|''
  const [filtEstado, setFiltEstado] = useState('');   // 'pendiente'|'pagado'|''

  const { movimientos, resumen, loading, saving, error, cargar, agregar, actualizar, eliminar } = useCuentaProveedor(provId);

  useEffect(() => { cargarProv(); }, [cargarProv]);

  const proveedor = proveedores.find(p => p.id === provId) || null;

  // Lista de productos únicos presentes en los movimientos + catálogo
  const productosDisponibles = useMemo(() => {
    const enMovs = [...new Set(movimientos.filter(m => m.producto).map(m => m.producto))];
    const enCat  = catProductos.map(p => p.nombre);
    return [...new Set([...enMovs, ...enCat])].sort((a, b) => a.localeCompare(b));
  }, [movimientos, catProductos]);

  // Filtros client-side
  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter(m => {
      if (filtTipo   && m.tipo !== filtTipo) return false;
      if (filtProd   && (m.producto || '').toLowerCase() !== filtProd.toLowerCase()) return false;
      if (filtEstado === 'pendiente' && m.tipo === 'pago') return false;
      if (filtEstado === 'pagado'    && m.tipo !== 'pago') return false;
      return true;
    });
  }, [movimientos, filtTipo, filtProd, filtEstado]);

  // Recalcular saldoAcum sobre la lista filtrada
  const movsFiltConSaldo = useMemo(() => {
    return movimientosFiltrados.reduce((acc, m) => {
      const prev  = acc.length > 0 ? acc[acc.length - 1].saldoAcum : 0;
      const cargo = m.tipo === 'recepcion' ? Number(m.totalBruto   || 0) : 0;
      const abono = m.tipo === 'pago'      ? Number(m.monto        || 0)
                  : m.tipo === 'rechazo'   ? Number(m.valorRechazo || 0) : 0;
      acc.push({ ...m, cargo, abono, saldoAcum: prev + cargo - abono });
      return acc;
    }, []);
  }, [movimientosFiltrados]);

  const filtrosActivos = filtTipo || filtProd || filtEstado;

  const recargar = useCallback(() => {
    if (provId) cargar(desde, hasta);
  }, [provId, desde, hasta, cargar]);

  useEffect(() => { recargar(); }, [recargar]);

  const handleGuardar = async (data) => {
    const { motivoEdit, ...campos } = data;
    await agregar({ ...campos, proveedorId: provId });
    setShowForm(false);
    recargar();
  };

  const handleEditar = async (data) => {
    if (!editTarget) return;
    const { motivoEdit, ...campos } = data;
    const auditEntry = {
      por:    user?.nombre || user?.email || 'Usuario',
      motivo: motivoEdit || '',
    };
    await actualizar(editTarget.id, campos, auditEntry);
    setEditTarget(null);
    recargar();
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar este movimiento?')) return;
    await eliminar(id);
    recargar();
  };

  const noProvSelected = !provId;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* Título */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: isMobile ? '1.3rem' : '1.5rem', fontWeight: 800,
          color: T.textDark, margin: 0 }}>🏪 Cuentas Proveedores</h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, margin: '4px 0 0' }}>
          Estado de cuenta y movimientos por proveedor
        </p>
      </div>

      {/* Filtros */}
      <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10,
        padding: '16px', marginBottom: 16,
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr auto', gap: 10,
        alignItems: 'end' }}>

        <div>
          <label style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.08em', color: T.textMid, display: 'block', marginBottom: 4 }}>
            Proveedor
          </label>
          <select
            value={provId}
            onChange={e => setProvId(e.target.value)}
            style={{ width: '100%', padding: '9px 10px', border: `1.5px solid ${T.border}`,
              borderRadius: 6, fontSize: '.88rem', fontFamily: 'inherit',
              background: '#fff', color: T.textDark, outline: 'none' }}>
            <option value="">— Seleccionar proveedor —</option>
            {proveedores.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.08em', color: T.textMid, display: 'block', marginBottom: 4 }}>
            Desde
          </label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            style={{ width: '100%', padding: '9px 10px', border: `1.5px solid ${T.border}`,
              borderRadius: 6, fontSize: '.88rem', fontFamily: 'inherit',
              background: '#fff', color: T.textDark, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <div>
          <label style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.08em', color: T.textMid, display: 'block', marginBottom: 4 }}>
            Hasta
          </label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            style={{ width: '100%', padding: '9px 10px', border: `1.5px solid ${T.border}`,
              borderRadius: 6, fontSize: '.88rem', fontFamily: 'inherit',
              background: '#fff', color: T.textDark, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <button
          onClick={recargar}
          disabled={noProvSelected || loading}
          style={{ padding: '9px 16px', borderRadius: 6, border: 'none',
            background: noProvSelected ? '#BDBDBD' : T.primary,
            color: '#fff', fontWeight: 700, fontSize: '.85rem',
            cursor: noProvSelected ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            minHeight: 40 }}>
          {loading ? '...' : 'Buscar'}
        </button>
      </div>

      {/* Placeholder sin proveedor */}
      {noProvSelected && (
        <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10,
          padding: '48px 24px', textAlign: 'center', color: T.textMid }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏪</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: T.textDark, marginBottom: 6 }}>
            Selecciona un proveedor
          </div>
          <div style={{ fontSize: '.85rem' }}>
            Elige un proveedor para ver su estado de cuenta y registrar movimientos.
          </div>
          {loadingProv && <div style={{ marginTop: 12, fontSize: '.82rem' }}>Cargando proveedores...</div>}
        </div>
      )}

      {/* Contenido cuando hay proveedor */}
      {!noProvSelected && (
        <>
          {/* Header del proveedor + acciones */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: T.textDark }}>
                {proveedor?.nombre || 'Proveedor'}
              </div>
              {proveedor?.nit && (
                <div style={{ fontSize: '.8rem', color: T.textMid }}>NIT: {proveedor.nit}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowEstado(true)}
                disabled={movimientos.length === 0}
                style={{ padding: '8px 14px', borderRadius: 6,
                  border: `1.5px solid ${T.border}`, background: '#fff',
                  color: movimientos.length === 0 ? '#BDBDBD' : T.textDark,
                  fontWeight: 600, fontSize: '.82rem', cursor: movimientos.length === 0 ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit' }}>
                🖨️ Ver Estado PDF
              </button>
            </div>
          </div>

          {/* Tarjetas resumen */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <SummaryCard label="Total Comprado" value={resumen.comprado} color="#1565C0" />
            <SummaryCard label="Rechazos"        value={resumen.rechazos} color={T.danger} />
            <SummaryCard label="Total Pagado"    value={resumen.pagado}   color={T.primary} />
            <SummaryCard
              label="Saldo Pendiente"
              value={resumen.saldo}
              color={resumen.saldo > 0 ? T.warn : T.primary}
              sub={resumen.saldo > 0 ? 'Por pagar' : resumen.saldo < 0 ? 'A favor' : 'Al corriente'}
            />
          </div>

          {/* Filtros secundarios */}
          {movimientos.length > 0 && (
            <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10,
              padding: '12px 16px', marginBottom: 12 }}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '.1em', color: T.primary, marginBottom: 10 }}>
                Filtrar movimientos
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>

                {/* Producto */}
                <div>
                  <label style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '.08em', color: T.textMid, display: 'block', marginBottom: 3 }}>
                    Producto
                  </label>
                  <input
                    type="text" list="filt-prod-list"
                    placeholder="Todos los productos..."
                    value={filtProd}
                    onChange={e => setFiltProd(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', border: `1.5px solid ${filtProd ? T.primary : T.border}`,
                      borderRadius: 6, fontSize: '.85rem', fontFamily: 'inherit',
                      background: '#fff', color: T.textDark, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <datalist id="filt-prod-list">
                    {productosDisponibles.map(n => <option key={n} value={n} />)}
                  </datalist>
                </div>

                {/* Tipo */}
                <div>
                  <label style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '.08em', color: T.textMid, display: 'block', marginBottom: 3 }}>
                    Tipo
                  </label>
                  <select value={filtTipo} onChange={e => setFiltTipo(e.target.value)}
                    style={{ width: '100%', padding: '7px 8px', border: `1.5px solid ${filtTipo ? T.primary : T.border}`,
                      borderRadius: 6, fontSize: '.85rem', fontFamily: 'inherit',
                      background: '#fff', color: T.textDark, outline: 'none' }}>
                    <option value="">Todos</option>
                    <option value="recepcion">📥 Recepción</option>
                    <option value="pago">💰 Pago</option>
                    <option value="rechazo">⚠️ Rechazo</option>
                  </select>
                </div>

                {/* Estado */}
                <div>
                  <label style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '.08em', color: T.textMid, display: 'block', marginBottom: 3 }}>
                    Estado
                  </label>
                  <select value={filtEstado} onChange={e => setFiltEstado(e.target.value)}
                    style={{ width: '100%', padding: '7px 8px', border: `1.5px solid ${filtEstado ? T.primary : T.border}`,
                      borderRadius: 6, fontSize: '.85rem', fontFamily: 'inherit',
                      background: '#fff', color: T.textDark, outline: 'none' }}>
                    <option value="">Todos</option>
                    <option value="pendiente">⏳ Pendiente pago</option>
                    <option value="pagado">✅ Pagado</option>
                  </select>
                </div>

                {/* Limpiar */}
                {filtrosActivos && (
                  <button onClick={() => { setFiltProd(''); setFiltTipo(''); setFiltEstado(''); }}
                    style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${T.border}`,
                      background: '#fff', color: T.textMid, fontSize: '.8rem',
                      fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    ✕ Limpiar
                  </button>
                )}
              </div>

              {/* Chips de filtros activos */}
              {filtrosActivos && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {filtProd && (
                    <span style={{ background: '#E3F2FD', color: '#1565C0', borderRadius: 99,
                      padding: '3px 10px', fontSize: '.72rem', fontWeight: 700 }}>
                      📦 {filtProd} <button onClick={() => setFiltProd('')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                          color: '#1565C0', fontWeight: 700, padding: '0 0 0 4px', fontSize: '.72rem' }}>✕</button>
                    </span>
                  )}
                  {filtTipo && (
                    <span style={{ background: TIPO_BG[filtTipo], color: TIPO_COLOR[filtTipo], borderRadius: 99,
                      padding: '3px 10px', fontSize: '.72rem', fontWeight: 700 }}>
                      {TIPO_ICON[filtTipo]} {TIPO_LABEL[filtTipo]}
                      <button onClick={() => setFiltTipo('')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                          color: TIPO_COLOR[filtTipo], fontWeight: 700, padding: '0 0 0 4px', fontSize: '.72rem' }}>✕</button>
                    </span>
                  )}
                  {filtEstado && (
                    <span style={{ background: '#E8F5E9', color: T.primary, borderRadius: 99,
                      padding: '3px 10px', fontSize: '.72rem', fontWeight: 700 }}>
                      {filtEstado === 'pagado' ? '✅ Pagado' : '⏳ Pendiente'}
                      <button onClick={() => setFiltEstado('')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                          color: T.primary, fontWeight: 700, padding: '0 0 0 4px', fontSize: '.72rem' }}>✕</button>
                    </span>
                  )}
                  <span style={{ fontSize: '.72rem', color: T.textMid, alignSelf: 'center' }}>
                    {movsFiltConSaldo.length} de {movimientos.length} movimientos
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Movimientos */}
          <div style={{ marginBottom: 80 }}>
            <div style={{ fontWeight: 700, fontSize: '.72rem', textTransform: 'uppercase',
              letterSpacing: '.1em', color: T.primary, marginBottom: 10 }}>
              Movimientos {movsFiltConSaldo.length > 0 ? `(${movsFiltConSaldo.length}${filtrosActivos ? ` de ${movimientos.length}` : ''})` : ''}
            </div>

            {loading && (
              <div style={{ textAlign: 'center', padding: '32px', color: T.textMid }}>Cargando...</div>
            )}

            {error && (
              <div style={{ background: '#FFEBEE', border: `1px solid ${T.danger}`, borderRadius: 8,
                padding: '12px 16px', marginBottom: 12, fontSize: '.85rem', color: T.danger }}>
                ⚠️ Error: {error}
              </div>
            )}

            {!loading && !error && movimientos.length === 0 && (
              <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10,
                padding: '32px', textAlign: 'center', color: T.textMid }}>
                Sin movimientos registrados. Usa el botón + para agregar.
              </div>
            )}

            {!loading && !error && movimientos.length > 0 && movsFiltConSaldo.length === 0 && (
              <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10,
                padding: '24px', textAlign: 'center', color: T.textMid }}>
                Ningún movimiento coincide con los filtros aplicados.
              </div>
            )}

            {/* Mobile: cards */}
            {!loading && !error && isMobile && movsFiltConSaldo.map(m => (
              <MovCard key={m.id} m={m} onEdit={setEditTarget} onDelete={handleEliminar} />
            ))}

            {/* Desktop: tabla */}
            {!loading && !error && !isMobile && movsFiltConSaldo.length > 0 && (
              <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
                  <thead>
                    <tr style={{ background: T.bg, borderBottom: `2px solid ${T.border}` }}>
                      {['Fecha','Tipo','Descripción','Cargo','Abono','Saldo Acum.',''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Cargo' || h === 'Abono' || h === 'Saldo Acum.' ? 'right' : 'left',
                          fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '.08em', color: T.textMid }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movsFiltConSaldo.map((m, i) => (
                      <DesktopRow key={m.id}
                        m={m} i={i}
                        onEdit={setEditTarget}
                        onDelete={handleEliminar}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* FAB + Movimiento */}
      {!noProvSelected && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            position: 'fixed', bottom: 28, right: 24,
            width: 52, height: 52, borderRadius: '50%',
            background: T.primary, color: '#fff', border: 'none',
            fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
          }}
          title="Nuevo movimiento"
        >
          +
        </button>
      )}

      {/* Modal nuevo movimiento */}
      {showForm && (
        <MovimientoForm
          proveedorNombre={proveedor?.nombre || ''}
          movimientos={movimientos}
          onConfirm={handleGuardar}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Modal editar movimiento */}
      {editTarget && (
        <MovimientoForm
          proveedorNombre={proveedor?.nombre || ''}
          movimientos={movimientos}
          initialData={editTarget}
          onConfirm={handleEditar}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {/* Vista PDF */}
      {showEstado && (
        <EstadoCuenta
          proveedor={proveedor}
          movimientos={movimientos}
          resumen={resumen}
          desde={desde}
          hasta={hasta}
          onClose={() => setShowEstado(false)}
        />
      )}
    </div>
  );
}
