// CuentasProveedores.jsx — Estado de cuenta por proveedor

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { storage } from '../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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

// ── Tarjeta imprimible para compartir por WhatsApp ──────────────────
function TarjetaMovimiento({ m, proveedorNombre }) {
  const fmtFechaLong = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const tipoLabel = { recepcion: 'RECEPCIÓN', pago: 'PAGO', rechazo: 'RECHAZO' };
  const tipoColor = { recepcion: '#1565C0', pago: '#2E7D32', rechazo: '#C62828' };
  const tipoBg    = { recepcion: '#E3F2FD', pago: '#E8F5E9', rechazo: '#FFEBEE' };
  const color     = tipoColor[m.tipo] || '#333';
  const bg        = tipoBg[m.tipo]    || '#F5F5F5';

  return (
    <div style={{
      width: 360, background: '#fff', borderRadius: 16,
      boxShadow: '0 4px 24px rgba(0,0,0,.18)',
      fontFamily: 'Arial, sans-serif', overflow: 'hidden',
      border: `2px solid ${color}`,
    }}>
      {/* Header verde AJÚA */}
      <div style={{ background: '#1B5E20', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontWeight: 900, fontSize: '1.4rem', color: '#fff', letterSpacing: 2 }}>AJÚA</div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <span style={{ background: bg, color, fontWeight: 800, fontSize: '.75rem',
            padding: '3px 10px', borderRadius: 99, letterSpacing: 1 }}>
            {tipoLabel[m.tipo] || m.tipo}
          </span>
        </div>
      </div>

      {/* Cuerpo */}
      <div style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: '.75rem', color: '#888', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.08em' }}>Proveedor</div>
        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1A1A18', marginBottom: 14 }}>{proveedorNombre}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '.82rem' }}>
          <div>
            <div style={{ color: '#888', fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Fecha</div>
            <div style={{ fontWeight: 700, color: '#1A1A18' }}>{fmtFechaLong(m.fecha)}</div>
          </div>
          {m.tipo === 'recepcion' && (<>
            {m.producto && <div>
              <div style={{ color: '#888', fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Producto</div>
              <div style={{ fontWeight: 700, color: '#1A1A18' }}>{m.producto}</div>
            </div>}
            {m.cantidad > 0 && <div>
              <div style={{ color: '#888', fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Cantidad</div>
              <div style={{ fontWeight: 700, color: '#1A1A18' }}>{m.cantidad} {m.unidad}</div>
            </div>}
            {m.precioUnit > 0 && <div>
              <div style={{ color: '#888', fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Precio/unidad</div>
              <div style={{ fontWeight: 700, color: '#1A1A18' }}>{fmtQ(m.precioUnit)}</div>
            </div>}
            {m.factura && <div>
              <div style={{ color: '#888', fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Factura</div>
              <div style={{ fontWeight: 700, color: '#1A1A18' }}>{m.factura}</div>
            </div>}
          </>)}
          {m.tipo === 'pago' && (<>
            {m.metodoPago && <div>
              <div style={{ color: '#888', fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Método</div>
              <div style={{ fontWeight: 700, color: '#1A1A18' }}>{m.metodoPago}</div>
            </div>}
            {m.referencia && <div>
              <div style={{ color: '#888', fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Referencia</div>
              <div style={{ fontWeight: 700, color: '#1A1A18' }}>{m.referencia}</div>
            </div>}
          </>)}
          {m.tipo === 'rechazo' && (<>
            {m.resolucion && <div>
              <div style={{ color: '#888', fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Resolución</div>
              <div style={{ fontWeight: 700, color: '#1A1A18' }}>{m.resolucion}</div>
            </div>}
          </>)}
        </div>

        {m.descripcion && (
          <div style={{ marginTop: 10, fontSize: '.8rem', color: '#555', fontStyle: 'italic' }}>{m.descripcion}</div>
        )}
        {m.notas && (
          <div style={{ marginTop: 4, fontSize: '.78rem', color: '#888' }}>Nota: {m.notas}</div>
        )}

        {/* Monto grande */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1.5px solid #E0E0E0', textAlign: 'right' }}>
          <div style={{ fontSize: '.68rem', color: '#888', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>
            {m.tipo === 'recepcion' ? 'Total bruto' : m.tipo === 'pago' ? 'Monto pagado' : 'Valor rechazo'}
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color }}>
            {m.tipo === 'recepcion' ? fmtQ(m.totalBruto) : m.tipo === 'pago' ? fmtQ(m.monto) : fmtQ(m.valorRechazo)}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#F5F5F3', padding: '8px 18px', fontSize: '.7rem', color: '#AAA', textAlign: 'center' }}>
        AGROINDUSTRIA AJÚA · agroajua@gmail.com
      </div>
    </div>
  );
}

function BtnCompartir({ m, proveedorNombre }) {
  const cardRef = useRef(null);
  const [generando, setGenerando] = useState(false);

  const compartir = async () => {
    if (!cardRef.current) return;
    setGenerando(true);
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `recibo_${m.tipo}_${m.fecha}.png`, { type: 'image/png' });
        // Web Share API — funciona en móvil (Chrome Android, Safari iOS)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `AJÚA — ${m.tipo} ${m.fecha}` });
        } else {
          // Fallback: descargar imagen
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `recibo_${m.tipo}_${m.fecha}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
        setGenerando(false);
      }, 'image/png');
    } catch { setGenerando(false); }
  };

  return (
    <div>
      {/* Tarjeta oculta fuera de pantalla para renderizar */}
      <div style={{ position: 'fixed', left: -9999, top: -9999, zIndex: -1 }}>
        <div ref={cardRef}>
          <TarjetaMovimiento m={m} proveedorNombre={proveedorNombre} />
        </div>
      </div>
      <button
        onClick={compartir}
        disabled={generando}
        style={{
          padding: '5px 14px', borderRadius: 6,
          border: '1.5px solid #25D366',
          background: '#fff', color: '#25D366',
          fontSize: '.78rem', fontWeight: 700,
          cursor: generando ? 'wait' : 'pointer',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
        }}>
        {generando ? '⏳ Generando...' : '📲 Compartir'}
      </button>
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
        {m._qtyNeta != null && m._qtyNeta !== Number(m.cantidad || 0) && (
          <div>Cantidad neta: <strong style={{ color: T.textDark }}>{m._qtyNeta} {m.unidad}</strong>
            <span style={{ fontSize: '.72rem', color: T.textMid }}> (recibido: {m.cantidad})</span>
          </div>
        )}
        {m._neto != null && m._neto !== Number(m.totalBruto || 0) && (
          <div>Total neto: <strong style={{ color: T.primary }}>{fmtQ(m._neto)}</strong>
            <span style={{ fontSize: '.72rem', color: T.textMid }}> (bruto: {fmtQ(m.totalBruto)})</span>
          </div>
        )}
        {m._costoFinalPorUnidad != null && (
          <div>Costo final/{m.unidad || 'unidad'}: <strong style={{ color: '#1B5E20', fontSize: '.88rem' }}>{fmtQ(m._costoFinalPorUnidad)}</strong></div>
        )}
      </>)}
      {m.tipo === 'pago' && (<>
        {m.metodoPago  && <div>Método: <strong style={{ color: T.textDark }}>{m.metodoPago}</strong></div>}
        {m.referencia  && <div>Referencia: <strong style={{ color: T.textDark }}>{m.referencia}</strong></div>}
        {m.recepcionId && <div style={{ marginTop: 2 }}>Entrega: <strong style={{ color: '#1565C0' }}>#{m._parentCorrelativo || m.recepcionId.slice(-6)}</strong></div>}
      </>)}
      {m.tipo === 'rechazo' && (<>
        {(m.cantidadRechazada > 0) && <div>Cantidad rechazada: <strong style={{ color: T.danger }}>{m.cantidadRechazada} {m.unidadRechazo || 'lb'}</strong></div>}
        {m.resolucion  && <div>Resolución: <strong style={{ color: T.textDark }}>{m.resolucion}</strong></div>}
      </>)}
      {m.notas && <div style={{ fontStyle: 'italic', marginTop: 2 }}>{m.notas}</div>}
      {m.fotoUrl && (
        <div style={{ marginTop: 10 }}>
          <a href={m.fotoUrl} target="_blank" rel="noreferrer">
            <img
              src={m.fotoUrl}
              alt="Evidencia"
              style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8,
                border: `1.5px solid ${T.border}`, display: 'block', objectFit: 'cover' }}
            />
          </a>
          <div style={{ fontSize: '.72rem', color: T.textMid, marginTop: 3 }}>
            📷 Foto adjunta · <a href={m.fotoUrl} target="_blank" rel="noreferrer"
              style={{ color: T.primary }}>ver completa</a>
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

function MovCard({ m, proveedorNombre, onEdit, onDelete, onLiquidar, childCount = 0, isExpanded = false, onToggleChildren }) {
  const [open, setOpen] = useState(false);

  // Child card (rechazo/pago vinculado)
  if (m._isChild) {
    const desc = m.descripcion || (
      m.tipo === 'rechazo' ? (m.resolucion || '—') :
      m.tipo === 'pago'    ? `${m.metodoPago || ''} ${m.referencia || ''}`.trim() : '—'
    ) || '—';
    return (
      <div style={{
        marginLeft: 20, marginBottom: 4,
        borderLeft: `3px solid ${TIPO_COLOR[m.tipo] || T.border}`,
        background: '#FFF5F5', borderRadius: '0 8px 8px 0',
        padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: '.65rem', color: T.textMid, opacity: 0.5, flexShrink: 0 }}>└─</span>
        <Badge tipo={m.tipo} />
        <span style={{ flex: 1, fontSize: '.78rem', color: T.textMid,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {desc} {cantidadStr(m) !== '—' ? `· ${cantidadStr(m)}` : ''}
        </span>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {m.abono > 0 && <div style={{ fontSize: '.82rem', fontWeight: 700, color: T.danger }}>−{fmtQ(m.abono)}</div>}
          <div style={{ fontSize: '.68rem', fontWeight: 700, color: m.saldoAcum > 0 ? T.warn : T.primary }}>
            Saldo: {fmtQ(m.saldoAcum)}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(m.id); }} style={{
          background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
          padding: '2px 6px', cursor: 'pointer', fontSize: '.7rem', color: T.textMid, flexShrink: 0,
        }}>✕</button>
      </div>
    );
  }

  const pagoBase = `${m.metodoPago || ''} ${m.referencia || ''}`.trim();
  const pagoLabel = m.tipo === 'pago' && m._parentCorrelativo ? `${pagoBase} → #${m._parentCorrelativo}` : pagoBase;
  const descRaw = m.descripcion || (
    m.tipo === 'recepcion' ? m.producto :
    m.tipo === 'pago'      ? pagoLabel :
    m.resolucion || '—'
  ) || '—';
  const desc = m.tipo === 'recepcion' && m.correlativo ? `#${m.correlativo} · ${descRaw}` : descRaw;

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
              <span style={{ fontSize: '.68rem', color: T.warn, fontWeight: 700 }}>✏️ editado</span>
            )}
            {childCount > 0 && (
              <button onClick={e => { e.stopPropagation(); onToggleChildren && onToggleChildren(m.id); }} style={{
                padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                background: isExpanded ? '#E3F2FD' : '#F0F0F0',
                color: isExpanded ? '#1565C0' : T.textMid,
                fontSize: '.68rem', fontWeight: 700, fontFamily: 'inherit',
              }}>
                {isExpanded ? `▼ ${childCount} ajustes` : `▶ ${childCount} ajustes`}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.88rem', fontWeight: 600, color: T.textDark,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {desc}
            </span>
            <span style={{ fontSize: '.78rem', color: T.textMid, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {cantidadStr(m)}
            </span>
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
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <BtnCompartir m={m} proveedorNombre={proveedorNombre} />
            {m.tipo === 'recepcion' && (
              <button onClick={e => { e.stopPropagation(); onLiquidar && onLiquidar(m.id); }} style={{
                padding: '5px 14px', borderRadius: 6,
                border: `1.5px solid ${m.liquidacionId ? T.primary : '#1565C0'}`,
                background: m.liquidacionId ? T.bgGreen : '#E3F2FD',
                color: m.liquidacionId ? T.primary : '#1565C0',
                fontSize: '.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {m.liquidacionId ? '✓ Liquidación' : '📋 Liquidar'}
              </button>
            )}
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

function cantidadStr(m) {
  if (m.tipo === 'recepcion' && m.cantidad) return `${m.cantidad} ${m.unidad || ''}`;
  if (m.tipo === 'pago'      && m.monto)    return fmtQ(m.monto);
  if (m.tipo === 'rechazo') {
    if (m.cantidadRechazada > 0) return `−${m.cantidadRechazada} ${m.unidadRechazo || 'lb'}`;
    if (m.valorRechazo > 0)      return fmtQ(m.valorRechazo);
  }
  return '—';
}

function DesktopRow({ m, i, proveedorNombre, onEdit, onDelete, onLiquidar, childCount = 0, isExpanded = false, onToggleChildren }) {
  const [open, setOpen] = useState(false);

  // Child row (rechazo/pago vinculado a una recepción)
  if (m._isChild) {
    const desc = m.descripcion || (
      m.tipo === 'rechazo' ? (m.resolucion || '—') :
      m.tipo === 'pago'    ? `${m.metodoPago || ''} ${m.referencia || ''}`.trim() : '—'
    ) || '—';
    return (
      <tr style={{ background: '#FFF5F5', borderBottom: `1px solid ${T.border}` }}>
        <td style={{ padding: '5px 8px', fontSize: '.7rem', color: T.textMid, whiteSpace: 'nowrap' }}>
          <span style={{ opacity: 0.4 }}>└─</span>
        </td>
        <td style={{ padding: '5px 8px' }}><Badge tipo={m.tipo} /></td>
        <td style={{ padding: '5px 8px', fontSize: '.75rem', color: T.textMid,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</td>
        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: '.73rem', color: T.danger, whiteSpace: 'nowrap' }}>
          {cantidadStr(m)}
        </td>
        <td style={{ padding: '5px 8px', textAlign: 'right', color: T.textMid, fontSize: '.75rem' }}>—</td>
        <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, fontSize: '.78rem', color: T.danger, whiteSpace: 'nowrap' }}>
          {m.valorRechazo > 0 ? fmtQ(m.valorRechazo) : m.monto > 0 ? fmtQ(m.monto) : '—'}
        </td>
        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: '.75rem', color: T.textMid, whiteSpace: 'nowrap' }}>—</td>
        <td style={{ padding: '5px 8px', textAlign: 'right' }}>
          <button onClick={e => { e.stopPropagation(); onDelete(m.id); }}
            style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
              padding: '1px 5px', cursor: 'pointer', fontSize: '.68rem', color: T.textMid }}>✕</button>
        </td>
      </tr>
    );
  }

  const pagoBase = `${m.metodoPago || ''} ${m.referencia || ''}`.trim();
  const pagoLabel = m.tipo === 'pago' && m._parentCorrelativo ? `${pagoBase} → #${m._parentCorrelativo}` : pagoBase;
  const descRaw = m.descripcion || (
    m.tipo === 'recepcion' ? m.producto :
    m.tipo === 'pago'      ? pagoLabel :
    m.resolucion || '—'
  ) || '—';
  const desc = m.tipo === 'recepcion' && m.correlativo ? `#${m.correlativo} · ${descRaw}` : descRaw;
  const tdSt = { padding: '7px 8px' };

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
            <span style={{ marginLeft: 4, fontSize: '.65rem', color: T.warn, fontWeight: 700 }}>✏️</span>
          )}
          {childCount > 0 && (
            <button onClick={e => { e.stopPropagation(); onToggleChildren && onToggleChildren(m.id); }} style={{
              marginLeft: 6, padding: '1px 6px', borderRadius: 3, border: 'none', cursor: 'pointer',
              background: isExpanded ? '#E3F2FD' : '#F0F0F0',
              color: isExpanded ? '#1565C0' : T.textMid,
              fontSize: '.65rem', fontWeight: 700,
            }}>
              {isExpanded ? `▼ ${childCount}` : `▶ ${childCount}`}
            </button>
          )}
        </td>
        <td style={tdSt}><Badge tipo={m.tipo} /></td>
        <td style={{ ...tdSt, color: T.textMid,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {desc}
        </td>
        <td style={{ ...tdSt, textAlign: 'right', fontSize: '.78rem', color: T.textDark, whiteSpace: 'nowrap' }}>
          {cantidadStr(m)}
        </td>
        <td style={{ ...tdSt, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap',
          color: m.cargo > 0 ? '#1565C0' : T.textMid }}>
          {m.cargo > 0 ? fmtQ(m.cargo) : '—'}
        </td>
        <td style={{ ...tdSt, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap',
          color: m.abono > 0 ? T.primary : T.textMid }}>
          {m.abono > 0 ? fmtQ(m.abono) : '—'}
        </td>
        <td style={{ ...tdSt, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap',
          color: m.saldoAcum > 0 ? T.warn : T.primary }}>
          {fmtQ(m.saldoAcum)}
        </td>
        <td style={{ ...tdSt, textAlign: 'right' }}>
          <span style={{ fontSize: '.72rem', color: T.textMid }}>{open ? '▲' : '▼'}</span>
        </td>
      </tr>
      {open && (
        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
          <td colSpan={8} style={{ padding: '12px 20px', background: T.bg }}>
            <DetailRows m={m} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <BtnCompartir m={m} proveedorNombre={proveedorNombre} />
              {m.tipo === 'recepcion' && (
                <button onClick={e => { e.stopPropagation(); onLiquidar && onLiquidar(m.id); }} style={{
                  padding: '5px 14px', borderRadius: 6,
                  border: `1.5px solid ${m.liquidacionId ? T.primary : '#1565C0'}`,
                  background: m.liquidacionId ? T.bgGreen : '#E3F2FD',
                  color: m.liquidacionId ? T.primary : '#1565C0',
                  fontSize: '.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {m.liquidacionId ? '✓ Liquidación' : '📋 Liquidar'}
                </button>
              )}
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
  const navigate = useNavigate();
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
  // 'total' | 'filtered' | false
  const [showEstado, setShowEstado] = useState(false);

  // Filtros secundarios (client-side sobre movimientos ya cargados)
  const [filtProd,   setFiltProd]   = useState('');
  const [filtTipo,   setFiltTipo]   = useState('');   // 'recepcion'|'pago'|'rechazo'|''
  const [filtEstado, setFiltEstado] = useState('');   // 'pendiente'|'pagado'|''

  const { movimientos, resumen, loading, error, cargar, agregar, actualizar, eliminar } = useCuentaProveedor(provId);

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

  // Reuse cargo/abono del hook (ya tienen lógica NET); solo recalcular saldoAcum en la lista filtrada
  const movsFiltConSaldo = useMemo(() => {
    return movimientosFiltrados.reduce((acc, m) => {
      const prev = acc.length > 0 ? acc[acc.length - 1].saldoAcum : 0;
      acc.push({ ...m, saldoAcum: prev + (m.cargo || 0) - (m.abono || 0) });
      return acc;
    }, []);
  }, [movimientosFiltrados]);

  const filtrosActivos = filtTipo || filtProd || filtEstado;

  // Accordion: set de IDs de recepciones con sub-items expandidos
  const [expandedIds, setExpandedIds] = useState(new Set());
  const toggleChildren = useCallback((id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Enriquecer: recepciones con qty_neta/neto/costoFinal; pagos con referencia a su entrega
  const movsConCostoFinal = useMemo(() => {
    const rejMap  = {}; // recepcionId → { totalQty, totalMoney }
    const corrMap = {}; // recepcionId → correlativo
    movimientos.forEach(m => {
      if (m.tipo === 'recepcion') corrMap[m.id] = m.correlativo;
      if (m.tipo === 'rechazo' && m.recepcionId) {
        if (!rejMap[m.recepcionId]) rejMap[m.recepcionId] = { totalQty: 0, totalMoney: 0 };
        rejMap[m.recepcionId].totalQty   += Number(m.cantidadRechazada || 0);
        rejMap[m.recepcionId].totalMoney += Number(m.valorRechazo      || 0);
      }
    });
    return movsFiltConSaldo.map(m => {
      if (m.tipo === 'recepcion') {
        if (m.liquidacionId) {
          // Liquidada: cargo = totalBruto (ya correcto)
          const qty = Number(m.cantidad || 0);
          const neto = m.cargo || 0;
          const costoFinalPorUnidad = qty > 0 ? neto / qty : null;
          return { ...m, _qtyNeta: qty, _neto: neto, _costoFinalPorUnidad: costoFinalPorUnidad };
        }
        const rej     = rejMap[m.id] || { totalQty: 0, totalMoney: 0 };
        const qty     = Number(m.cantidad   || 0);
        const bruto   = Number(m.totalBruto || 0);
        const pu      = Number(m.precioUnit || 0) || (qty > 0 ? bruto / qty : 0);
        const qtyNeta = Math.max(0, qty - rej.totalQty);
        const neto    = Math.max(0, (pu > 0 ? qtyNeta * pu : bruto) - rej.totalMoney);
        const costoFinalPorUnidad = qtyNeta > 0 ? neto / qtyNeta : null;
        return { ...m, _qtyNeta: qtyNeta, _neto: neto, _costoFinalPorUnidad: costoFinalPorUnidad };
      }
      if (m.tipo === 'pago' && m.recepcionId) {
        return { ...m, _parentCorrelativo: corrMap[m.recepcionId] || null };
      }
      return m;
    });
  }, [movsFiltConSaldo, movimientos]);

  // Contar sub-items por padre
  const parentChildCounts = useMemo(() => {
    const counts = {};
    movsConCostoFinal.forEach(m => {
      if (m._isChild && m.recepcionId) counts[m.recepcionId] = (counts[m.recepcionId] || 0) + 1;
    });
    return counts;
  }, [movsConCostoFinal]);

  const recargar = useCallback(() => {
    if (provId) cargar(desde, hasta);
  }, [provId, desde, hasta, cargar]);

  useEffect(() => { recargar(); }, [recargar]);

  const uploadFoto = useCallback(async (file, id) => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `cuentasProveedores/${provId}/${id}_${Date.now()}.${ext}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }, [provId]);

  const handleGuardar = async (data) => {
    const { motivoEdit, _fotoFile, ...campos } = data;
    if (campos.tipo === 'recepcion') {
      const fecha = campos.fecha || new Date().toISOString().slice(0, 10);
      const [, mo, d] = fecha.split('-');
      const countOnDate = movimientos.filter(m => m.tipo === 'recepcion' && m.fecha === fecha).length + 1;
      campos.correlativo = `${d}${mo}${String(countOnDate).padStart(2, '0')}`;
    }
    const docId = await agregar({ ...campos, proveedorId: provId });
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
    const auditEntry = {
      por:    user?.nombre || user?.email || 'Usuario',
      motivo: motivoEdit || '',
    };
    if (_fotoFile) {
      const url = await uploadFoto(_fotoFile, editTarget.id);
      campos.fotoUrl = url;
    }
    await actualizar(editTarget.id, campos, auditEntry);
    setEditTarget(null);
    recargar();
  };

  const handleLiquidar = useCallback((id) => {
    navigate(`/cuentas-proveedores/liquidacion/${id}`);
  }, [navigate]);

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar este movimiento?')) return;
    await eliminar(id);
    recargar();
  };

  const exportExcel = useCallback((movs, label) => {
    const nombre = proveedor?.nombre || 'Proveedor';
    const filas = movs.map(m => ({
      'Fecha':       m.fecha || '',
      'Tipo':        m.tipo === 'recepcion' ? 'Recepción' : m.tipo === 'pago' ? 'Pago' : 'Rechazo',
      'Descripción': m.descripcion || (m.tipo === 'recepcion' ? m.producto : m.tipo === 'pago' ? `${m.metodoPago || ''} ${m.referencia || ''}`.trim() : m.resolucion) || '',
      'Producto':    m.producto || '',
      'Cantidad':    m.cantidad || '',
      'Unidad':      m.unidad  || '',
      'Precio Unit': m.precioUnit || '',
      'Factura':     m.factura   || '',
      'Método Pago': m.metodoPago || '',
      'Referencia':  m.referencia || '',
      'Cargo Q':     m.cargo  > 0 ? m.cargo  : '',
      'Abono Q':     m.abono  > 0 ? m.abono  : '',
      'Saldo Acum Q':m.saldoAcum,
      'Notas':       m.notas || '',
    }));
    // Fila de totales
    const res = movs.reduce((a, m) => {
      if (m.tipo === 'recepcion') a.comprado  += Number(m.totalBruto   || 0);
      if (m.tipo === 'rechazo')   a.rechazos  += Number(m.valorRechazo || 0);
      if (m.tipo === 'pago')      a.pagado    += Number(m.monto        || 0);
      return a;
    }, { comprado: 0, rechazos: 0, pagado: 0 });
    filas.push({});
    filas.push({ 'Fecha': 'TOTALES', 'Cargo Q': res.comprado, 'Abono Q': res.rechazos + res.pagado, 'Saldo Acum Q': res.comprado - res.rechazos - res.pagado });

    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estado de Cuenta');
    const periodoStr = (desde || hasta) ? `_${desde || ''}_${hasta || ''}` : '';
    XLSX.writeFile(wb, `CuentaProveedor_${nombre.replace(/\s+/g,'_')}${periodoStr}_${label}.xlsx`);
  }, [proveedor, desde, hasta]);

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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {filtrosActivos && movsFiltConSaldo.length > 0 && (<>
                <button
                  onClick={() => setShowEstado('filtered')}
                  style={{ padding: '8px 14px', borderRadius: 6,
                    border: `1.5px solid ${T.warn}`, background: '#fff',
                    color: T.warn, fontWeight: 700, fontSize: '.82rem',
                    cursor: 'pointer', fontFamily: 'inherit' }}>
                  🖨️ PDF filtrado
                </button>
                <button
                  onClick={() => exportExcel(movsFiltConSaldo, 'filtrado')}
                  style={{ padding: '8px 14px', borderRadius: 6,
                    border: '1.5px solid #2E7D32', background: '#fff',
                    color: '#2E7D32', fontWeight: 700, fontSize: '.82rem',
                    cursor: 'pointer', fontFamily: 'inherit' }}>
                  📊 Excel filtrado
                </button>
              </>)}
              <button
                onClick={() => setShowEstado('total')}
                disabled={movimientos.length === 0}
                style={{ padding: '8px 14px', borderRadius: 6,
                  border: `1.5px solid ${T.border}`, background: '#fff',
                  color: movimientos.length === 0 ? '#BDBDBD' : T.textDark,
                  fontWeight: 600, fontSize: '.82rem',
                  cursor: movimientos.length === 0 ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit' }}>
                🖨️ PDF total
              </button>
              <button
                onClick={() => exportExcel(movimientos, 'total')}
                disabled={movimientos.length === 0}
                style={{ padding: '8px 14px', borderRadius: 6,
                  border: movimientos.length === 0 ? `1.5px solid ${T.border}` : '1.5px solid #2E7D32',
                  background: '#fff',
                  color: movimientos.length === 0 ? '#BDBDBD' : '#2E7D32',
                  fontWeight: 600, fontSize: '.82rem',
                  cursor: movimientos.length === 0 ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit' }}>
                📊 Excel total
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

            {!loading && !error && movimientos.length > 0 && movsConCostoFinal.length === 0 && (
              <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10,
                padding: '24px', textAlign: 'center', color: T.textMid }}>
                Ningún movimiento coincide con los filtros aplicados.
              </div>
            )}

            {/* Mobile: cards */}
            {!loading && !error && isMobile && movsConCostoFinal
              .filter(m => !m._isChild || expandedIds.has(m.recepcionId))
              .map(m => (
                <MovCard key={m.id} m={m} proveedorNombre={proveedor?.nombre || ''}
                  onEdit={setEditTarget} onDelete={handleEliminar} onLiquidar={handleLiquidar}
                  childCount={parentChildCounts[m.id] || 0}
                  isExpanded={expandedIds.has(m.id)}
                  onToggleChildren={toggleChildren}
                />
              ))}

            {/* Desktop: tabla */}
            {!loading && !error && !isMobile && movsConCostoFinal.length > 0 && (
              <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.83rem', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 100 }} /> {/* Fecha */}
                    <col style={{ width: 88 }} />  {/* Tipo */}
                    <col />                         {/* Descripción — flexible */}
                    <col style={{ width: 78 }} />  {/* Cantidad */}
                    <col style={{ width: 96 }} />  {/* Cargo */}
                    <col style={{ width: 96 }} />  {/* Abono */}
                    <col style={{ width: 96 }} />  {/* Saldo */}
                    <col style={{ width: 32 }} />  {/* Acciones */}
                  </colgroup>
                  <thead>
                    <tr style={{ background: T.bg, borderBottom: `2px solid ${T.border}` }}>
                      {['Fecha','Tipo','Descripción','Cant.','Cargo','Abono','Saldo',''].map(h => (
                        <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Cargo' || h === 'Abono' || h === 'Saldo' || h === 'Cant.' ? 'right' : 'left',
                          fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '.06em', color: T.textMid, overflow: 'hidden' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movsConCostoFinal
                      .filter(m => !m._isChild || expandedIds.has(m.recepcionId))
                      .map((m, i) => (
                        <DesktopRow key={m.id}
                          m={m} i={i}
                          proveedorNombre={proveedor?.nombre || ''}
                          onEdit={setEditTarget}
                          onDelete={handleEliminar}
                          onLiquidar={handleLiquidar}
                          childCount={parentChildCounts[m.id] || 0}
                          isExpanded={expandedIds.has(m.id)}
                          onToggleChildren={toggleChildren}
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
      {showEstado && (() => {
        const esFiltrado = showEstado === 'filtered';
        const movsPdf    = esFiltrado ? movsFiltConSaldo : movimientos;
        const tituloChips = esFiltrado ? [
          filtProd  && `📦 ${filtProd}`,
          filtTipo  && TIPO_LABEL[filtTipo],
          filtEstado === 'pendiente' && '⏳ Pendiente pago',
          filtEstado === 'pagado'    && '✅ Pagado',
        ].filter(Boolean).join(' · ') : undefined;
        return (
          <EstadoCuenta
            proveedor={proveedor}
            movimientos={movsPdf}
            resumen={resumen}
            desde={desde}
            hasta={hasta}
            titulo={tituloChips}
            onClose={() => setShowEstado(false)}
          />
        );
      })()}
    </div>
  );
}
