// WalmartCard.jsx — mobile card para un pedido Walmart
// Recibe expandedContent como prop para formularios de entrega/FEL

const BORDER = { pendiente:'#2563eb', preparando:'#d97706', entregado:'#16a34a', cancelado:'#dc2626' };

export default function WalmartCard({ r, onPreparando, onOpenEntregado, onFel, onDelete, expandedContent }) {
  const estado      = r.estado || 'pendiente';
  const color       = BORDER[estado] || '#6b7280';
  const totalCajas  = r.totalCajas || (r.rubros || []).reduce((s, x) => s + (x.cajas ?? x.cajasPedidas ?? 0), 0) || 0;
  const desc        = r.rubros?.length
    ? r.rubros.map(rb => [rb.item && `[${rb.item}]`, rb.descripcion, rb.cajas != null && `(${rb.cajas})`].filter(Boolean).join(' ')).join(' / ')
    : (r.descripcion || '—');

  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '14px 16px',
      marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,.12)',
      borderLeft: `4px solid ${color}`,
    }}>

      {/* Fila 1: Fecha + hora + badge estado */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <div>
          <span style={{ fontWeight:700, fontSize:15 }}>📅 {r.fechaEntrega || r.fecha || '—'}</span>
          {r.horaEntrega && <span style={{ marginLeft:8, fontSize:12, color:'#16a34a', fontWeight:700 }}>🕐 {r.horaEntrega}</span>}
        </div>
        <span style={{ background:color, color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:12, fontWeight:600, whiteSpace:'nowrap', marginLeft:8 }}>
          {estado.charAt(0).toUpperCase() + estado.slice(1)}
        </span>
      </div>

      {/* Descripción / rubros */}
      <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:4, lineHeight:1.4 }}>{desc}</div>

      {/* Nota importante */}
      {r.notaImportante && (
        <div style={{ fontSize:12, color:'#1565C0', marginBottom:4 }}>📋 {r.notaImportante}</div>
      )}

      {/* OC + Atlas/SAP */}
      <div style={{ display:'flex', gap:16, fontSize:13, color:'#555', marginBottom:4, flexWrap:'wrap' }}>
        <span>
          <b>OC:</b> {r.numOC || '—'}
          {r.fuente === 'gmail' && <span style={{ marginLeft:4, fontSize:10, background:'#E3F2FD', color:'#1565C0', borderRadius:8, padding:'1px 5px', fontWeight:700 }}>📧</span>}
        </span>
        <span><b>SAP:</b> {r.numAtlas || '—'}</span>
      </div>

      {/* Rampa + Cajas */}
      <div style={{ fontSize:13, color:'#374151', marginBottom:10 }}>
        <b>Rampa:</b> {r.rampa || '—'} &nbsp;|&nbsp; <b>Cajas:</b> {totalCajas || '—'}
      </div>

      {/* Acciones */}
      <div style={{ display:'flex', gap:8 }}>
        {estado === 'pendiente' && (
          <button onClick={onPreparando} style={{ flex:1, minHeight:44, borderRadius:8, border:'none', background:'#d97706', color:'#fff', fontWeight:600, fontSize:14, cursor:'pointer' }}>
            Preparando →
          </button>
        )}
        {estado === 'preparando' && (
          <button onClick={onOpenEntregado} style={{ flex:1, minHeight:44, borderRadius:8, border:'none', background:'#16a34a', color:'#fff', fontWeight:600, fontSize:14, cursor:'pointer' }}>
            Entregado ✓
          </button>
        )}
        {estado === 'entregado' && (
          <button onClick={onFel} style={{ flex:1, minHeight:44, borderRadius:8, border:'1.5px solid #16a34a', background:'#F0FFF4', color:'#16a34a', fontWeight:600, fontSize:14, cursor:'pointer' }}>
            FEL
          </button>
        )}
        <button onClick={onDelete} style={{ minHeight:44, width:44, borderRadius:8, border:'none', background:'#FFEBEE', color:'#C62828', fontWeight:700, fontSize:18, cursor:'pointer' }}>
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
  );
}
