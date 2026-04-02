// RechazoForm.jsx — Modal gestión de rechazo antes de guardar recepción
// Props: producto, totalRechazado, unidad, precioRef, onConfirm(rechazoData), onCancel

import { useState } from 'react';

const T = {
  primary:'#1B5E20', danger:'#C62828', warn:'#E65100',
  border:'#E0E0E0',  textMid:'#6B6B60', textDark:'#1A1A18',
};

const RESOLUCIONES = [
  { key:'devolucion',             icon:'📦', label:'Devolución física',      color:'#1565C0', bg:'#E3F2FD' },
  { key:'descuento',              icon:'💰', label:'Descuento en factura',    color:'#2E7D32', bg:'#E8F5E9' },
  { key:'nota_credito',           icon:'📄', label:'Nota de crédito futura',  color:T.warn,    bg:'#FFF3E0' },
  { key:'negociacion_pendiente',  icon:'🤝', label:'Negociación pendiente',   color:T.textMid, bg:'#F5F5F5' },
];

const fmtQ = n => `Q ${Number(n||0).toLocaleString('es-GT', { minimumFractionDigits:2 })}`;

export default function RechazoForm({ producto, totalRechazado, unidad, precioRef, onConfirm, onCancel }) {
  const [resolucion, setResolucion] = useState('');
  const [notas,      setNotas]      = useState('');

  const valorRechazo = (Number(precioRef) || 0) * (Number(totalRechazado) || 0);
  const res          = RESOLUCIONES.find(r => r.key === resolucion);
  const canConfirm   = !!resolucion;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({
      tieneRechazo:       true,
      resolucion,
      valorRechazo,
      notasNegociacion:   notas.trim(),
      resuelto:           resolucion !== 'negociacion_pendiente',
      fechaResolucion:    resolucion !== 'negociacion_pendiente' ? new Date().toISOString() : null,
    });
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:2000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:440,
        boxShadow:'0 8px 32px rgba(0,0,0,.25)', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:'#FFF3E0', borderBottom:`2px solid ${T.warn}`, padding:'16px 20px', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:'1.4rem' }}>⚠️</span>
          <div>
            <div style={{ fontWeight:800, fontSize:'1rem', color:T.textDark }}>Gestión de Rechazo</div>
            <div style={{ fontSize:'.82rem', color:T.textMid, marginTop:2 }}>
              {producto} — <strong>{totalRechazado} {unidad}</strong> rechazados
            </div>
          </div>
        </div>

        <div style={{ padding:'20px' }}>

          {/* Valor del rechazo */}
          <div style={{ background:'#FFEBEE', borderRadius:8, padding:'10px 14px', marginBottom:18,
            display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'.82rem', color:T.textMid, fontWeight:600 }}>Valor del rechazo:</span>
            <span style={{ fontSize:'1.1rem', fontWeight:800, color:T.danger }}>
              {valorRechazo > 0 ? fmtQ(valorRechazo) : '—'}
              {valorRechazo === 0 && <span style={{ fontSize:'.72rem', color:T.textMid }}> (sin precio ref.)</span>}
            </span>
          </div>

          {/* ¿Cómo se resuelve? */}
          <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em',
            color:T.primary, marginBottom:10 }}>¿Cómo se resuelve?</div>

          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
            {RESOLUCIONES.map(r => {
              const active = resolucion === r.key;
              return (
                <button key={r.key} onClick={() => setResolucion(r.key)} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'11px 14px',
                  borderRadius:8, border:`2px solid ${active ? r.color : T.border}`,
                  background: active ? r.bg : '#fff',
                  cursor:'pointer', textAlign:'left', fontFamily:'inherit', transition:'all .12s',
                }}>
                  <span style={{ fontSize:'1.2rem', flexShrink:0 }}>{r.icon}</span>
                  <span style={{ fontWeight: active ? 700 : 500, fontSize:'.88rem',
                    color: active ? r.color : T.textDark }}>{r.label}</span>
                  {active && <span style={{ marginLeft:'auto', fontSize:'.72rem', fontWeight:700, color:r.color }}>✓</span>}
                </button>
              );
            })}
          </div>

          {/* Notas */}
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase',
              letterSpacing:'.08em', color:T.textMid, display:'block', marginBottom:5 }}>
              Notas de negociación
            </label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              placeholder="Acuerdos, condiciones, contacto del proveedor..."
              style={{ width:'100%', padding:'9px 11px', border:`1.5px solid ${T.border}`,
                borderRadius:6, fontSize:'.85rem', fontFamily:'inherit', outline:'none',
                resize:'vertical', boxSizing:'border-box', color:T.textDark }}
            />
          </div>

          {/* Nota crédito pendiente aviso */}
          {resolucion === 'nota_credito' && (
            <div style={{ background:'#FFF3E0', borderRadius:6, padding:'8px 12px', fontSize:'.78rem',
              color:T.warn, marginBottom:14 }}>
              💡 El total neto quedará marcado como <strong>"sujeto a ajuste"</strong> hasta recibir la nota de crédito.
            </div>
          )}

          {/* Botones */}
          <div style={{ display:'flex', gap:10 }}>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              style={{ flex:1, minHeight:44, borderRadius:8, border:'none',
                background: canConfirm ? T.primary : '#BDBDBD',
                color:'#fff', fontWeight:700, fontSize:'.9rem',
                cursor: canConfirm ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>
              Confirmar y guardar entrega
            </button>
            <button onClick={onCancel} style={{ minHeight:44, padding:'0 16px', borderRadius:8,
              border:`1.5px solid ${T.border}`, background:'#fff', color:T.textMid,
              fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
