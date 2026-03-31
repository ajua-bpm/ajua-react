// WalmartCard.jsx — mobile card para un pedido Walmart
// Colapsada por defecto; se expande con "Ver detalles"

import { useState } from 'react';

const BORDER = { pendiente:'#2563eb', preparando:'#d97706', entregado:'#16a34a', cancelado:'#dc2626' };

export default function WalmartCard({ r, onPreparando, onOpenEntregado, onFel, onDelete, expandedContent }) {
  const [open, setOpen] = useState(false);

  const estado     = r.estado || 'pendiente';
  const color      = BORDER[estado] || '#6b7280';
  const totalCajas = r.totalCajas || (r.rubros || []).reduce((s, x) => s + (x.cajas ?? x.cajasPedidas ?? 0), 0) || 0;

  // Descripción corta para la vista colapsada
  const descCorta = r.rubros?.length
    ? r.rubros.map(rb => rb.descripcion || rb.item || '').filter(Boolean).join(' / ')
    : (r.descripcion || '—');

  // Descripción completa con item codes y cajas
  const descCompleta = r.rubros?.length
    ? r.rubros.map(rb => [rb.item && `[${rb.item}]`, rb.descripcion, rb.cajas != null && `(${rb.cajas})`].filter(Boolean).join(' ')).join(' / ')
    : (r.descripcion || '—');

  return (
    <div style={{
      background: '#fff', borderRadius: 10,
      marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,.12)',
      borderLeft: `4px solid ${color}`,
      overflow: 'hidden',
    }}>

      {/* ── CABECERA siempre visible ── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
      >
        {/* Fila 1: Fecha + hora + badge estado */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 5 }}>
          <div>
            <span style={{ fontWeight:700, fontSize:15 }}>📅 {r.fechaEntrega || r.fecha || '—'}</span>
            {r.horaEntrega && (
              <span style={{ marginLeft:8, fontSize:12, color:'#16a34a', fontWeight:700 }}>🕐 {r.horaEntrega}</span>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ background:color, color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:12, fontWeight:600, whiteSpace:'nowrap' }}>
              {estado.charAt(0).toUpperCase() + estado.slice(1)}
            </span>
            <span style={{ fontSize:18, color:'#9ca3af', lineHeight:1 }}>{open ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Descripción corta */}
        <div style={{ fontSize:13, color:'#374151', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {descCorta}
        </div>
      </div>

      {/* ── DETALLE expandible ── */}
      {open && (
        <div style={{ padding:'0 16px 14px', borderTop:'1px solid #F0F0F0' }}>

          {/* Descripción completa (si difiere de corta) */}
          {descCompleta !== descCorta && (
            <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginTop:10, marginBottom:6, lineHeight:1.4 }}>
              {descCompleta}
            </div>
          )}

          {/* Nota importante */}
          {r.notaImportante && (
            <div style={{ fontSize:12, color:'#1565C0', marginTop:descCompleta !== descCorta ? 0 : 10, marginBottom:6 }}>
              📋 {r.notaImportante}
            </div>
          )}

          {/* OC + Atlas/SAP */}
          <div style={{ display:'flex', gap:16, fontSize:13, color:'#555', marginTop: (descCompleta === descCorta && !r.notaImportante) ? 10 : 0, marginBottom:4, flexWrap:'wrap' }}>
            <span>
              <b>OC:</b> {r.numOC || '—'}
              {r.fuente === 'gmail' && (
                <span style={{ marginLeft:4, fontSize:10, background:'#E3F2FD', color:'#1565C0', borderRadius:8, padding:'1px 5px', fontWeight:700 }}>📧</span>
              )}
            </span>
            <span><b>SAP:</b> {r.numAtlas || '—'}</span>
          </div>

          {/* Rampa + Cajas */}
          <div style={{ fontSize:13, color:'#374151', marginBottom:12 }}>
            <b>Rampa:</b> {r.rampa || '—'} &nbsp;|&nbsp; <b>Cajas:</b> {totalCajas || '—'}
          </div>

          {/* Acciones */}
          <div style={{ display:'flex', gap:8 }}>
            {estado === 'pendiente' && (
              <button onClick={e => { e.stopPropagation(); onPreparando(); }} style={{ flex:1, minHeight:44, borderRadius:8, border:'none', background:'#d97706', color:'#fff', fontWeight:600, fontSize:14, cursor:'pointer' }}>
                Preparando →
              </button>
            )}
            {estado === 'preparando' && (
              <button onClick={e => { e.stopPropagation(); onOpenEntregado(); }} style={{ flex:1, minHeight:44, borderRadius:8, border:'none', background:'#16a34a', color:'#fff', fontWeight:600, fontSize:14, cursor:'pointer' }}>
                Entregado ✓
              </button>
            )}
            {estado === 'entregado' && (
              <button onClick={e => { e.stopPropagation(); onFel(); }} style={{ flex:1, minHeight:44, borderRadius:8, border:'1.5px solid #16a34a', background:'#F0FFF4', color:'#16a34a', fontWeight:600, fontSize:14, cursor:'pointer' }}>
                FEL
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ minHeight:44, width:44, borderRadius:8, border:'none', background:'#FFEBEE', color:'#C62828', fontWeight:700, fontSize:18, cursor:'pointer' }}>
              ✕
            </button>
          </div>

          {/* Contenido expandido (formularios de entrega / FEL) */}
          {expandedContent && (
            <div style={{ marginTop:12, borderTop:'1px solid #E0E0E0', paddingTop:12 }}>
              {expandedContent}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
