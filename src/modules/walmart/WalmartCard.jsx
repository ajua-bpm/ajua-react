// WalmartCard.jsx — card colapsable para pedido Walmart
import { useState } from 'react';

const BORDER = { pendiente:'#2563eb', preparando:'#d97706', entregado:'#16a34a', cancelado:'#dc2626' };

export default function WalmartCard({ r, onPreparando, onOpenEntregado, onFel, onDelete, expandedContent }) {
  const [open, setOpen] = useState(false);

  const estado     = r.estado || 'pendiente';
  const color      = BORDER[estado] || '#6b7280';
  const totalCajas = r.totalCajas || (r.rubros || []).reduce((s, x) => s + (x.cajas ?? x.cajasPedidas ?? 0), 0) || 0;

  // Nombre(s) del producto — sin códigos
  const nombres = r.rubros?.length
    ? r.rubros.map(rb => rb.descripcion || rb.item || '').filter(Boolean)
    : r.descripcion ? [r.descripcion] : [];

  const nombreCorto = nombres.join(' / ') || '—';

  return (
    <div style={{
      background: '#fff', borderRadius: 10,
      marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,.12)',
      borderLeft: `4px solid ${color}`,
      overflow: 'hidden',
    }}>

      {/* ── CABECERA siempre visible — toca para expandir ── */}
      <div onClick={() => setOpen(o => !o)}
        style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}>

        {/* Fila 1: fecha + hora + estado */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
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
            <span style={{ fontSize:16, color:'#9ca3af' }}>{open ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Fila 2: nombre producto (truncado) + cajas */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {nombreCorto}
          </div>
          {totalCajas > 0 && (
            <span style={{ fontSize:13, color:'#374151', fontWeight:600, flexShrink:0 }}>
              📦 {totalCajas} cajas
            </span>
          )}
        </div>
      </div>

      {/* ── EXPANDIDO ── */}
      {open && (
        <div style={{ padding:'10px 16px 14px', borderTop:'1px solid #F0F0F0' }}>

          {/* Lista de rubros con cajas individuales */}
          {r.rubros?.length > 1 && (
            <div style={{ marginBottom:10, display:'flex', flexDirection:'column', gap:4 }}>
              {r.rubros.map((rb, i) => {
                const cajas = rb.cajas ?? rb.cajasPedidas ?? 0;
                const nombre = rb.descripcion || rb.item || '—';
                return (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'5px 0', borderBottom:'1px solid #F5F5F5' }}>
                    <span style={{ color:'#1a1a1a' }}>{nombre}</span>
                    {cajas > 0 && <span style={{ color:'#374151', fontWeight:600, flexShrink:0 }}>{cajas} cj</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Nota importante */}
          {r.notaImportante && (
            <div style={{ fontSize:12, color:'#1565C0', marginBottom:10, padding:'6px 10px', background:'#E3F2FD', borderRadius:6 }}>
              📋 {r.notaImportante}
            </div>
          )}

          {/* Acciones */}
          <div style={{ display:'flex', gap:8 }}>
            {estado === 'pendiente' && (
              <button onClick={e => { e.stopPropagation(); onPreparando(); }}
                style={{ flex:1, minHeight:44, borderRadius:8, border:'none', background:'#d97706', color:'#fff', fontWeight:600, fontSize:14, cursor:'pointer' }}>
                Preparando →
              </button>
            )}
            {estado === 'preparando' && (
              <button onClick={e => { e.stopPropagation(); onOpenEntregado(); }}
                style={{ flex:1, minHeight:44, borderRadius:8, border:'none', background:'#16a34a', color:'#fff', fontWeight:600, fontSize:14, cursor:'pointer' }}>
                Entregado ✓
              </button>
            )}
            {estado === 'entregado' && (
              <button onClick={e => { e.stopPropagation(); onFel(); }}
                style={{ flex:1, minHeight:44, borderRadius:8, border:'1.5px solid #16a34a', background:'#F0FFF4', color:'#16a34a', fontWeight:600, fontSize:14, cursor:'pointer' }}>
                FEL
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{ minHeight:44, width:44, borderRadius:8, border:'none', background:'#FFEBEE', color:'#C62828', fontWeight:700, fontSize:18, cursor:'pointer' }}>
              ✕
            </button>
          </div>

          {/* Formularios de entrega / FEL */}
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
