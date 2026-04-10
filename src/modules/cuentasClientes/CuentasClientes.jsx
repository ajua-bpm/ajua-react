// CuentasClientes.jsx — CxC: estado de cuenta por cliente (despachos locales) + Rechazos

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { storage } from '../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../hooks/useAuth';
import { useProductosCatalogo } from '../../hooks/useMainData';
import { useCuentaCliente, useClientesList } from './useCuentaCliente';
import MovimientoClienteForm from './MovimientoClienteForm';
import EstadoCuentaCliente from './EstadoCuentaCliente';
import RechazosDespacho from '../ventas/RechazosDespacho';

const T = {
  primary: '#1B5E20', danger: '#C62828', warn: '#E65100', info: '#1565C0',
  border: '#E0E0E0', textMid: '#6B6B60', textDark: '#1A1A18', bg: '#F9F9F7',
};

const fmtQ     = n => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
const fmtFecha = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const TIPO_LABEL = { despacho: 'Despacho', pago: 'Pago', nota_credito: 'Nota Crédito' };
const TIPO_COLOR = { despacho: '#1565C0', pago: '#2E7D32', nota_credito: '#C62828' };
const TIPO_BG    = { despacho: '#E3F2FD', pago: '#E8F5E9', nota_credito: '#FFEBEE' };
const TIPO_ICON  = { despacho: '🚛', pago: '💰', nota_credito: '⚠️' };

function Badge({ tipo }) {
  return (
    <span style={{ fontSize: '.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99,
      background: TIPO_BG[tipo] || T.bg, color: TIPO_COLOR[tipo] || T.textMid, whiteSpace: 'nowrap' }}>
      {TIPO_ICON[tipo]} {TIPO_LABEL[tipo] || tipo}
    </span>
  );
}

function SummaryCard({ label, value, color, sub }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 16px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.1em', color: T.textMid, marginBottom: 4, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, color, lineHeight: 1.2 }}>{fmtQ(value)}</div>
      {sub && <div style={{ fontSize: '.72rem', color: T.textMid, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function AuditLog({ historial }) {
  if (!historial?.length) return null;
  return (
    <div style={{ marginTop: 10, borderTop: `1px dashed ${T.border}`, paddingTop: 8 }}>
      <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.textMid, marginBottom: 6 }}>📋 Historial de ediciones</div>
      {[...historial].reverse().map((h, i) => (
        <div key={i} style={{ fontSize: '.75rem', color: T.textMid, marginBottom: 4, paddingLeft: 8, borderLeft: `2px solid ${T.border}` }}>
          <span style={{ color: T.textDark, fontWeight: 600 }}>{h.por || 'Usuario'}</span>
          {' · '}{h.ts ? new Date(h.ts).toLocaleString('es-GT') : '—'}
          {h.motivo && <div style={{ fontStyle: 'italic', color: T.warn }}>"{h.motivo}"</div>}
        </div>
      ))}
    </div>
  );
}

function DetailRows({ m }) {
  const prodStr = m.tipo === 'despacho' && m.productos
    ? m.productos.map(p => `${p.cantidad} ${p.unidad} ${p.producto}`).join(' · ')
    : null;
  return (
    <div style={{ fontSize: '.82rem', color: T.textMid, lineHeight: 1.8 }}>
      {m.tipo === 'despacho' && (<>
        {prodStr && <div>Productos: <strong style={{ color: T.textDark }}>{prodStr}</strong></div>}
        {m.formaPago   && <div>Forma de pago: <strong style={{ color: T.textDark }}>{m.formaPago}</strong></div>}
        {m.diasCredito > 0 && <div>Crédito: <strong style={{ color: T.warn }}>{m.diasCredito} días</strong></div>}
        {m.numFactura  && <div>Factura: <strong style={{ color: T.textDark }}>{m.numFactura}</strong></div>}
      </>)}
      {m.tipo === 'pago' && (<>
        {m.metodoPago  && <div>Método: <strong style={{ color: T.textDark }}>{m.metodoPago}</strong></div>}
        {m.referencia  && <div>Referencia: <strong style={{ color: T.textDark }}>{m.referencia}</strong></div>}
      </>)}
      {m.tipo === 'nota_credito' && (<>
        {m.motivo      && <div>Motivo: <strong style={{ color: T.textDark }}>{m.motivo}</strong></div>}
      </>)}
      {m.notas && <div style={{ fontStyle: 'italic', marginTop: 2 }}>{m.notas}</div>}
      {m.fotoUrl && (
        <div style={{ marginTop: 10 }}>
          <a href={m.fotoUrl} target="_blank" rel="noreferrer">
            <img src={m.fotoUrl} alt="Evidencia"
              style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8,
                border: `1.5px solid ${T.border}`, display: 'block', objectFit: 'cover' }} />
          </a>
          <div style={{ fontSize: '.72rem', color: T.textMid, marginTop: 3 }}>
            📷 Foto adjunta · <a href={m.fotoUrl} target="_blank" rel="noreferrer" style={{ color: T.primary }}>ver completa</a>
          </div>
        </div>
      )}
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

// ── Tarjeta para compartir por WhatsApp ──────────────────────────────
function TarjetaMovimientoCliente({ m, clienteNombre }) {
  const fmtFechaLong = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const color = TIPO_COLOR[m.tipo] || '#333';
  const bg    = TIPO_BG[m.tipo]    || '#F5F5F5';
  const prodStr = m.tipo === 'despacho' && m.productos
    ? m.productos.map(p => `${p.cantidad} ${p.unidad} ${p.producto}`).join('\n')
    : null;
  const montoVal = m.tipo === 'despacho' ? m.totalVenta : m.tipo === 'pago' ? m.monto : m.valor;
  const montoLabel = m.tipo === 'despacho' ? 'Total despacho' : m.tipo === 'pago' ? 'Monto cobrado' : 'Nota crédito';

  return (
    <div style={{ width: 360, background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,.18)', fontFamily: 'Arial, sans-serif', overflow: 'hidden', border: `2px solid ${color}` }}>
      <div style={{ background: '#1B5E20', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontWeight: 900, fontSize: '1.4rem', color: '#fff', letterSpacing: 2 }}>AJÚA</div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{ background: bg, color, fontWeight: 800, fontSize: '.75rem', padding: '3px 10px', borderRadius: 99, letterSpacing: 1 }}>
            {TIPO_LABEL[m.tipo] || m.tipo}
          </span>
        </div>
      </div>
      <div style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: '.75rem', color: '#888', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.08em' }}>Cliente</div>
        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1A1A18', marginBottom: 14 }}>{clienteNombre}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '.82rem' }}>
          <div>
            <div style={{ color: '#888', fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Fecha</div>
            <div style={{ fontWeight: 700, color: '#1A1A18' }}>{fmtFechaLong(m.fecha)}</div>
          </div>
          {m.tipo === 'despacho' && m.formaPago && (
            <div>
              <div style={{ color: '#888', fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Pago</div>
              <div style={{ fontWeight: 700, color: '#1A1A18' }}>{m.formaPago}{m.diasCredito > 0 ? ` (${m.diasCredito}d crédito)` : ''}</div>
            </div>
          )}
          {m.tipo === 'pago' && m.metodoPago && (
            <div>
              <div style={{ color: '#888', fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Método</div>
              <div style={{ fontWeight: 700, color: '#1A1A18' }}>{m.metodoPago}</div>
            </div>
          )}
          {m.tipo === 'nota_credito' && m.motivo && (
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ color: '#888', fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Motivo</div>
              <div style={{ fontWeight: 700, color: '#1A1A18' }}>{m.motivo}</div>
            </div>
          )}
        </div>
        {prodStr && (
          <div style={{ marginTop: 12, background: '#F5F5F5', borderRadius: 8, padding: '8px 12px', fontSize: '.8rem', color: '#1A1A18', whiteSpace: 'pre-line' }}>
            {prodStr}
          </div>
        )}
        {m.descripcion && <div style={{ marginTop: 8, fontSize: '.8rem', color: '#555', fontStyle: 'italic' }}>{m.descripcion}</div>}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1.5px solid #E0E0E0', textAlign: 'right' }}>
          <div style={{ fontSize: '.68rem', color: '#888', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>{montoLabel}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color }}>{fmtQ(montoVal)}</div>
        </div>
      </div>
      <div style={{ background: '#F5F5F3', padding: '8px 18px', fontSize: '.7rem', color: '#AAA', textAlign: 'center' }}>
        AGROINDUSTRIA AJÚA · agroajua@gmail.com
      </div>
    </div>
  );
}

function BtnCompartirCliente({ m, clienteNombre }) {
  const cardRef = useRef(null);
  const [generando, setGenerando] = useState(false);

  const compartir = async () => {
    if (!cardRef.current) return;
    setGenerando(true);
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `despacho_${m.tipo}_${m.fecha}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `AJÚA — ${m.tipo} ${m.fecha}` });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `despacho_${m.tipo}_${m.fecha}.png`; a.click();
          URL.revokeObjectURL(url);
        }
        setGenerando(false);
      }, 'image/png');
    } catch { setGenerando(false); }
  };

  return (
    <div>
      <div style={{ position: 'fixed', left: -9999, top: -9999, zIndex: -1 }}>
        <div ref={cardRef}><TarjetaMovimientoCliente m={m} clienteNombre={clienteNombre} /></div>
      </div>
      <button onClick={compartir} disabled={generando} style={{
        padding: '5px 14px', borderRadius: 6, border: '1.5px solid #25D366',
        background: '#fff', color: '#25D366', fontSize: '.78rem', fontWeight: 700,
        cursor: generando ? 'wait' : 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        {generando ? '⏳ Generando...' : '📲 Compartir'}
      </button>
    </div>
  );
}

function MovCard({ m, clienteNombre, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const desc = m.descripcion ||
    (m.tipo === 'despacho'     ? (m.productos || []).map(p => p.producto).filter(Boolean).join(', ')
   : m.tipo === 'pago'         ? `${m.metodoPago || ''} ${m.referencia || ''}`.trim()
   : m.motivo) || '—';

  return (
    <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge tipo={m.tipo} />
            <span style={{ fontSize: '.8rem', color: T.textMid }}>{fmtFecha(m.fecha)}</span>
            {m.historialEdiciones?.length > 0 && <span style={{ fontSize: '.68rem', color: T.warn, fontWeight: 700 }}>✏️ editado</span>}
          </div>
          <div style={{ fontSize: '.88rem', fontWeight: 600, color: T.textDark, marginTop: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {m.cargo > 0 && <div style={{ fontSize: '.88rem', fontWeight: 700, color: T.info }}>{fmtQ(m.cargo)}</div>}
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
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <BtnCompartirCliente m={m} clienteNombre={clienteNombre} />
            <button onClick={e => { e.stopPropagation(); onEdit(m); }} style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${T.warn}`, background: '#fff', color: T.warn, fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✏️ Editar</button>
            <button onClick={e => { e.stopPropagation(); onDelete(m.id); }} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${T.danger}`, background: '#fff', color: T.danger, fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Eliminar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DesktopRow({ m, i, clienteNombre, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const desc = m.descripcion ||
    (m.tipo === 'despacho'     ? (m.productos || []).map(p => p.producto).filter(Boolean).join(', ')
   : m.tipo === 'pago'         ? `${m.metodoPago || ''} ${m.referencia || ''}`.trim()
   : m.motivo) || '—';
  const tdSt = { padding: '10px 14px' };

  return (
    <>
      <tr onClick={() => setOpen(o => !o)} style={{ borderBottom: open ? 'none' : `1px solid ${T.border}`, background: i % 2 === 0 ? '#fff' : T.bg, cursor: 'pointer' }}>
        <td style={{ ...tdSt, whiteSpace: 'nowrap', color: T.textMid, fontSize: '.82rem' }}>
          {fmtFecha(m.fecha)}
          {m.historialEdiciones?.length > 0 && <span style={{ marginLeft: 6, fontSize: '.65rem', color: T.warn, fontWeight: 700 }}>✏️</span>}
        </td>
        <td style={tdSt}><Badge tipo={m.tipo} /></td>
        <td style={{ ...tdSt, color: T.textMid, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</td>
        <td style={{ ...tdSt, textAlign: 'right', fontWeight: 700, color: m.cargo > 0 ? T.info : T.textMid }}>{m.cargo > 0 ? fmtQ(m.cargo) : '—'}</td>
        <td style={{ ...tdSt, textAlign: 'right', fontWeight: 700, color: m.abono > 0 ? T.primary : T.textMid }}>{m.abono > 0 ? fmtQ(m.abono) : '—'}</td>
        <td style={{ ...tdSt, textAlign: 'right', fontWeight: 700, color: m.saldoAcum > 0 ? T.warn : T.primary }}>{fmtQ(m.saldoAcum)}</td>
        <td style={{ ...tdSt, textAlign: 'right' }}><span style={{ fontSize: '.72rem', color: T.textMid }}>{open ? '▲' : '▼'}</span></td>
      </tr>
      {open && (
        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
          <td colSpan={7} style={{ padding: '12px 20px', background: T.bg }}>
            <DetailRows m={m} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <BtnCompartirCliente m={m} clienteNombre={clienteNombre} />
              <button onClick={e => { e.stopPropagation(); onEdit(m); }} style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${T.warn}`, background: '#fff', color: T.warn, fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✏️ Editar</button>
              <button onClick={e => { e.stopPropagation(); onDelete(m.id); }} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${T.danger}`, background: '#fff', color: T.danger, fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Eliminar</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CuentasClientes() {
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h); return () => window.removeEventListener('resize', h);
  }, []);

  const { clientes, loading: loadingCli } = useClientesList();
  const { productos: catProductos } = useProductosCatalogo();

  const [clienteId,  setClienteId]  = useState('');
  const [desde,      setDesde]      = useState('');
  const [hasta,      setHasta]      = useState('');
  const [showForm,   setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [showEstado, setShowEstado] = useState(false);

  // Filtros secundarios
  const [filtTipo,   setFiltTipo]   = useState('');
  const [filtProd,   setFiltProd]   = useState('');

  const { movimientos, resumen, loading, error, cargar, agregar, actualizar, eliminar } = useCuentaCliente(clienteId);

  const cliente = clientes.find(c => c.id === clienteId) || null;

  const productosDisponibles = useMemo(() => {
    const enMovs = [...new Set(
      movimientos.flatMap(m => (m.productos || []).map(p => p.producto)).filter(Boolean)
    )];
    const enCat = catProductos.map(p => p.nombre);
    return [...new Set([...enMovs, ...enCat])].sort((a, b) => a.localeCompare(b));
  }, [movimientos, catProductos]);

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter(m => {
      if (filtTipo && m.tipo !== filtTipo) return false;
      if (filtProd && !(m.productos || []).some(p => (p.producto || '').toLowerCase() === filtProd.toLowerCase())) return false;
      return true;
    });
  }, [movimientos, filtTipo, filtProd]);

  const movsFiltConSaldo = useMemo(() => {
    return movimientosFiltrados.reduce((acc, m) => {
      const prev  = acc.length > 0 ? acc[acc.length - 1].saldoAcum : 0;
      const cargo = m.tipo === 'despacho'     ? Number(m.totalVenta || 0) : 0;
      const abono = m.tipo === 'pago'         ? Number(m.monto       || 0)
                  : m.tipo === 'nota_credito' ? Number(m.valor       || 0) : 0;
      acc.push({ ...m, cargo, abono, saldoAcum: prev + cargo - abono });
      return acc;
    }, []);
  }, [movimientosFiltrados]);

  const filtrosActivos = filtTipo || filtProd;

  const recargar = useCallback(() => { if (clienteId) cargar(desde, hasta); }, [clienteId, desde, hasta, cargar]);
  useEffect(() => { recargar(); }, [recargar]);

  const uploadFoto = useCallback(async (file, id) => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `cuentasClientes/${clienteId}/${id}_${Date.now()}.${ext}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }, [clienteId]);

  const handleGuardar = async (data) => {
    const { motivoEdit, _fotoFile, ...campos } = data;
    const docId = await agregar({ ...campos, clienteId });
    if (_fotoFile && docId) {
      const url = await uploadFoto(_fotoFile, docId);
      await actualizar(docId, { fotoUrl: url }, null);
    }
    setShowForm(false);
    recargar();
  };

  const handleEditar = async (data) => {
    if (!editTarget) return;
    const { motivoEdit, _fotoFile, ...campos } = data;
    const auditEntry = { por: user?.nombre || user?.email || 'Usuario', motivo: motivoEdit || '' };
    if (_fotoFile) {
      const url = await uploadFoto(_fotoFile, editTarget.id);
      campos.fotoUrl = url;
    }
    await actualizar(editTarget.id, campos, auditEntry);
    setEditTarget(null);
    recargar();
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar este movimiento?')) return;
    await eliminar(id);
    recargar();
  };

  const exportExcel = useCallback((movs, label) => {
    const nombre = cliente?.nombre || 'Cliente';
    const filas = movs.map(m => ({
      'Fecha':        m.fecha || '',
      'Tipo':         TIPO_LABEL[m.tipo] || m.tipo,
      'Descripción':  m.descripcion || '',
      'Productos':    (m.productos || []).map(p => `${p.cantidad} ${p.unidad} ${p.producto}`).join('; '),
      'Total Venta':  m.tipo === 'despacho'     ? (m.totalVenta || '') : '',
      'Pago Q':       m.tipo === 'pago'         ? (m.monto     || '') : '',
      'Nota Crédito Q': m.tipo === 'nota_credito' ? (m.valor   || '') : '',
      'Forma Pago':   m.formaPago  || m.metodoPago || '',
      'Factura':      m.numFactura || '',
      'Cargo Q':      m.cargo  > 0 ? m.cargo  : '',
      'Abono Q':      m.abono  > 0 ? m.abono  : '',
      'Saldo Acum Q': m.saldoAcum,
      'Notas':        m.notas || '',
    }));
    const res = movs.reduce((a, m) => {
      if (m.tipo === 'despacho')     a.despachado += Number(m.totalVenta || 0);
      if (m.tipo === 'nota_credito') a.notas      += Number(m.valor      || 0);
      if (m.tipo === 'pago')         a.cobrado    += Number(m.monto      || 0);
      return a;
    }, { despachado: 0, notas: 0, cobrado: 0 });
    filas.push({});
    filas.push({ 'Fecha': 'TOTALES', 'Cargo Q': res.despachado, 'Abono Q': res.notas + res.cobrado, 'Saldo Acum Q': res.despachado - res.notas - res.cobrado });
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CxC Cliente');
    const periodoStr = (desde || hasta) ? `_${desde || ''}_${hasta || ''}` : '';
    XLSX.writeFile(wb, `CxC_${nombre.replace(/\s+/g, '_')}${periodoStr}_${label}.xlsx`);
  }, [cliente, desde, hasta]);

  const noClienteSelected = !clienteId;
  const [mainTab, setMainTab] = useState('cxc');

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: isMobile ? '1.3rem' : '1.5rem', fontWeight: 800, color: T.textDark, margin: 0 }}>
          🛒 Cuentas Clientes
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, margin: '4px 0 0' }}>
          Estado de cuenta CxC · despachos locales · rechazos
        </p>
      </div>

      {/* Tabs principales */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `2px solid ${T.border}` }}>
        {[
          { key: 'cxc',      label: '🛒 Estado de Cuenta' },
          { key: 'rechazos', label: '⚠️ Rechazos' },
        ].map(t => (
          <button key={t.key} onClick={() => setMainTab(t.key)} style={{
            padding: '9px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '.88rem',
            fontWeight: mainTab === t.key ? 700 : 500,
            color: mainTab === t.key ? T.info : T.textMid,
            borderBottom: `3px solid ${mainTab === t.key ? T.info : 'transparent'}`,
            marginBottom: -2, transition: 'all .12s',
          }}>{t.label}</button>
        ))}
      </div>

      {mainTab === 'rechazos' && <RechazosDespacho />}

      {mainTab === 'cxc' && <>

      {/* Filtro principal */}
      <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10,
        padding: '16px', marginBottom: 16,
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.textMid, display: 'block', marginBottom: 4 }}>Cliente</label>
          <select value={clienteId} onChange={e => setClienteId(e.target.value)}
            style={{ width: '100%', padding: '9px 10px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.88rem', fontFamily: 'inherit', background: '#fff', color: T.textDark, outline: 'none' }}>
            <option value="">— Seleccionar cliente —</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.muni ? ` · ${c.muni}` : ''}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.textMid, display: 'block', marginBottom: 4 }}>Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            style={{ width: '100%', padding: '9px 10px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.88rem', fontFamily: 'inherit', background: '#fff', color: T.textDark, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.textMid, display: 'block', marginBottom: 4 }}>Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            style={{ width: '100%', padding: '9px 10px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.88rem', fontFamily: 'inherit', background: '#fff', color: T.textDark, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <button onClick={recargar} disabled={noClienteSelected || loading}
          style={{ padding: '9px 16px', borderRadius: 6, border: 'none',
            background: noClienteSelected ? '#BDBDBD' : T.info,
            color: '#fff', fontWeight: 700, fontSize: '.85rem',
            cursor: noClienteSelected ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: 40 }}>
          {loading ? '...' : 'Buscar'}
        </button>
      </div>

      {/* Placeholder */}
      {noClienteSelected && (
        <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10, padding: '48px 24px', textAlign: 'center', color: T.textMid }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🛒</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: T.textDark, marginBottom: 6 }}>Selecciona un cliente</div>
          <div style={{ fontSize: '.85rem' }}>Elige un cliente para ver su estado de cuenta y registrar despachos, pagos o notas de crédito.</div>
          {loadingCli && <div style={{ marginTop: 12, fontSize: '.82rem' }}>Cargando clientes...</div>}
        </div>
      )}

      {/* Contenido */}
      {!noClienteSelected && (<>

        {/* Header cliente + acciones */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: T.textDark }}>{cliente?.nombre || 'Cliente'}</div>
            {cliente?.muni && <div style={{ fontSize: '.8rem', color: T.textMid }}>{cliente.muni}{cliente.tel ? ` · ${cliente.tel}` : ''}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {filtrosActivos && movsFiltConSaldo.length > 0 && (<>
              <button onClick={() => setShowEstado('filtered')} style={{ padding: '8px 14px', borderRadius: 6, border: `1.5px solid ${T.warn}`, background: '#fff', color: T.warn, fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>🖨️ PDF filtrado</button>
              <button onClick={() => exportExcel(movsFiltConSaldo, 'filtrado')} style={{ padding: '8px 14px', borderRadius: 6, border: '1.5px solid #2E7D32', background: '#fff', color: '#2E7D32', fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>📊 Excel filtrado</button>
            </>)}
            <button onClick={() => setShowEstado('total')} disabled={movimientos.length === 0}
              style={{ padding: '8px 14px', borderRadius: 6, border: `1.5px solid ${T.border}`, background: '#fff', color: movimientos.length === 0 ? '#BDBDBD' : T.textDark, fontWeight: 600, fontSize: '.82rem', cursor: movimientos.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              🖨️ PDF total
            </button>
            <button onClick={() => exportExcel(movimientos, 'total')} disabled={movimientos.length === 0}
              style={{ padding: '8px 14px', borderRadius: 6, border: movimientos.length === 0 ? `1.5px solid ${T.border}` : '1.5px solid #2E7D32', background: '#fff', color: movimientos.length === 0 ? '#BDBDBD' : '#2E7D32', fontWeight: 600, fontSize: '.82rem', cursor: movimientos.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              📊 Excel total
            </button>
          </div>
        </div>

        {/* Resumen */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <SummaryCard label="Total Despachado" value={resumen.despachado} color={T.info} />
          <SummaryCard label="Notas Crédito"    value={resumen.notas}      color={T.danger} />
          <SummaryCard label="Total Cobrado"    value={resumen.cobrado}    color={T.primary} />
          <SummaryCard
            label="Saldo Pendiente"
            value={resumen.saldo}
            color={resumen.saldo > 0 ? T.warn : T.primary}
            sub={resumen.saldo > 0 ? 'Por cobrar' : resumen.saldo < 0 ? 'A favor cliente' : 'Al corriente'}
          />
        </div>

        {/* Filtros secundarios */}
        {movimientos.length > 0 && (
          <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: T.info, marginBottom: 10 }}>Filtrar movimientos</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr auto', gap: 8, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.textMid, display: 'block', marginBottom: 3 }}>Producto</label>
                <input type="text" list="filt-prod-cli-list" placeholder="Todos los productos..."
                  value={filtProd} onChange={e => setFiltProd(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', border: `1.5px solid ${filtProd ? T.info : T.border}`, borderRadius: 6, fontSize: '.85rem', fontFamily: 'inherit', background: '#fff', color: T.textDark, outline: 'none', boxSizing: 'border-box' }} />
                <datalist id="filt-prod-cli-list">
                  {productosDisponibles.map(n => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div>
                <label style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.textMid, display: 'block', marginBottom: 3 }}>Tipo</label>
                <select value={filtTipo} onChange={e => setFiltTipo(e.target.value)}
                  style={{ width: '100%', padding: '7px 8px', border: `1.5px solid ${filtTipo ? T.info : T.border}`, borderRadius: 6, fontSize: '.85rem', fontFamily: 'inherit', background: '#fff', color: T.textDark, outline: 'none' }}>
                  <option value="">Todos</option>
                  <option value="despacho">🚛 Despacho</option>
                  <option value="pago">💰 Pago</option>
                  <option value="nota_credito">⚠️ Nota Crédito</option>
                </select>
              </div>
              {filtrosActivos && (
                <button onClick={() => { setFiltProd(''); setFiltTipo(''); }}
                  style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${T.border}`, background: '#fff', color: T.textMid, fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✕ Limpiar
                </button>
              )}
            </div>
            {filtrosActivos && (
              <div style={{ marginTop: 8, fontSize: '.72rem', color: T.textMid }}>
                {movsFiltConSaldo.length} de {movimientos.length} movimientos
              </div>
            )}
          </div>
        )}

        {/* Movimientos */}
        <div style={{ marginBottom: 80 }}>
          <div style={{ fontWeight: 700, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.1em', color: T.info, marginBottom: 10 }}>
            Movimientos {movsFiltConSaldo.length > 0 ? `(${movsFiltConSaldo.length}${filtrosActivos ? ` de ${movimientos.length}` : ''})` : ''}
          </div>

          {loading && <div style={{ textAlign: 'center', padding: '32px', color: T.textMid }}>Cargando...</div>}
          {error   && <div style={{ background: '#FFEBEE', border: `1px solid ${T.danger}`, borderRadius: 8, padding: '12px 16px', marginBottom: 12, fontSize: '.85rem', color: T.danger }}>⚠️ {error}</div>}

          {!loading && !error && movimientos.length === 0 && (
            <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10, padding: '32px', textAlign: 'center', color: T.textMid }}>
              Sin movimientos. Usa el botón + para registrar un despacho o pago.
            </div>
          )}

          {!loading && !error && isMobile && movsFiltConSaldo.map(m => (
            <MovCard key={m.id} m={m} clienteNombre={cliente?.nombre || ''} onEdit={setEditTarget} onDelete={handleEliminar} />
          ))}

          {!loading && !error && !isMobile && movsFiltConSaldo.length > 0 && (
            <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
                <thead>
                  <tr style={{ background: T.bg, borderBottom: `2px solid ${T.border}` }}>
                    {['Fecha','Tipo','Descripción','Cargo','Abono','Saldo Acum.',''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: ['Cargo','Abono','Saldo Acum.'].includes(h) ? 'right' : 'left',
                        fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.textMid }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movsFiltConSaldo.map((m, i) => (
                    <DesktopRow key={m.id} m={m} i={i} clienteNombre={cliente?.nombre || ''} onEdit={setEditTarget} onDelete={handleEliminar} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>)}

      {/* FAB */}
      {!noClienteSelected && (
        <button onClick={() => setShowForm(true)} style={{
          position: 'fixed', bottom: 28, right: 24, width: 52, height: 52, borderRadius: '50%',
          background: T.info, color: '#fff', border: 'none', fontSize: '1.5rem', lineHeight: 1,
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} title="Nuevo movimiento">+</button>
      )}

      {showForm && (
        <MovimientoClienteForm
          clienteNombre={cliente?.nombre || ''}
          movimientos={movimientos}
          onConfirm={handleGuardar}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editTarget && (
        <MovimientoClienteForm
          clienteNombre={cliente?.nombre || ''}
          movimientos={movimientos}
          initialData={editTarget}
          onConfirm={handleEditar}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {showEstado && (() => {
        const esFiltrado = showEstado === 'filtered';
        const movsPdf    = esFiltrado ? movsFiltConSaldo : movimientos;
        const tituloChips = esFiltrado ? [filtProd && `📦 ${filtProd}`, filtTipo && TIPO_LABEL[filtTipo]].filter(Boolean).join(' · ') : undefined;
        return (
          <EstadoCuentaCliente
            cliente={cliente}
            movimientos={movsPdf}
            resumen={resumen}
            desde={desde}
            hasta={hasta}
            titulo={tituloChips}
            onClose={() => setShowEstado(false)}
          />
        );
      })()}

      </>}{/* /tab cxc */}
    </div>
  );
}
