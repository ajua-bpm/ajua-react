import { useState } from 'react';
import { useToast } from '../../../components/Toast';
import { useConfirmarBodega } from '../hooks/useConfirmarBodega';
import { useConductores } from '../../../hooks/useMainData';
import { today, fmt } from '../hooks/useCotizador';

const T = { primary:'#1B5E20', secondary:'#2E7D32', border:'#E0E0E0', white:'#FFFFFF', textMid:'#6B6B60', textDark:'#1A1A18' };
const IS = { padding:'8px 10px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.83rem', fontFamily:'inherit', width:'100%', color:T.textDark, background:T.white, boxSizing:'border-box', marginTop:2 };
const LS = { fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.primary };
const TH = { padding:'8px 10px', fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', color:T.white, background:T.primary, textAlign:'left' };

export default function PasoBodega({ cot, update }) {
  const { confirmar } = useConfirmarBodega();
  const { conductores } = useConductores();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fecha: today(), responsable: '', obs: '',
    cantidades: {},
  });

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setCant = (id, field, val) => setForm(p => ({
    ...p, cantidades: { ...p.cantidades, [id]: { ...(p.cantidades[id]||{}), [field]: val } }
  }));

  const alreadyDone = cot.estado === 'bodega' && !!cot.bodegaInfo;

  const handleConfirm = async () => {
    if (!form.fecha || !form.responsable.trim()) { toast('Fecha y responsable requeridos'); return; }
    if (!(cot.productos||[]).length) { toast('No hay productos en esta cotización'); return; }
    setSaving(true);
    try {
      const n = await confirmar(cot, form);
      toast(`✅ ${n} entrada${n!==1?'s':''} creadas`);
    } catch(err) { toast('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  if (alreadyDone) {
    const bi = cot.bodegaInfo;
    return (
      <div style={{ padding:20 }}>
        <div style={{ padding:'12px 16px', background:'rgba(46,125,50,.08)', border:'1px solid rgba(46,125,50,.25)', borderRadius:8, marginBottom:20 }}>
          <div style={{ fontWeight:700, color:T.secondary, marginBottom:4 }}>✅ Recepción en bodega confirmada</div>
          <div style={{ fontSize:'.82rem', color:T.textMid }}>
            <span>Fecha: {bi.fecha}</span> · <span>Responsable: {bi.responsable}</span>
            {bi.obs && <span> · {bi.obs}</span>}
          </div>
        </div>
        <h4 style={{ color:T.primary, margin:'0 0 10px' }}>Productos ingresados:</h4>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.8rem' }}>
          <thead><tr>{['Producto','Qty','Kg','Lbs','Costo tot'].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {(cot.productos||[]).map((p,i) => {
              const c = bi.cantidades?.[p.id] || {};
              return (
                <tr key={p.id} style={{ background:i%2?'#F9FBF9':T.white }}>
                  <td style={{ padding:'7px 10px', fontWeight:600, color:T.primary }}>{p.nom}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right' }}>{c.cant||p.qty}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right' }}>{fmt(c.kg||p.kgT)}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right' }}>{fmt((parseFloat(c.kg||p.kgT||0))*2.20462)}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:700, color:T.secondary }}>Q {fmt(p.costoTot)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ padding:20, maxWidth:800 }}>
      {cot.estado !== 'duca' && cot.estado !== 'bodega' && (
        <div style={{ marginBottom:16, padding:'8px 14px', background:'rgba(230,81,0,.08)', border:'1px solid rgba(230,81,0,.25)', borderRadius:6, fontSize:'.82rem', color:'#E65100' }}>
          ⚠️ Recomendado: registra primero la DUCA antes de confirmar recepción.
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        <div><label style={LS}>Fecha recepción *</label><input type="date" value={form.fecha} onChange={set('fecha')} style={IS}/></div>
        <div>
          <label style={LS}>Conductor / Responsable *</label>
          <select value={form.responsable} onChange={set('responsable')} style={IS}>
            <option value="">— Seleccionar —</option>
            {(conductores||[]).map(c => <option key={c.id} value={c.nombre||c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div style={{ gridColumn:'span 2' }}><label style={LS}>Observaciones</label><input value={form.obs} onChange={set('obs')} style={IS}/></div>
      </div>

      <h4 style={{ margin:'0 0 10px', color:T.primary }}>Confirmar cantidades recibidas:</h4>
      {(cot.productos||[]).length === 0 ? (
        <div style={{ color:T.textMid, padding:'16px 0' }}>Sin productos. Agrega en la pestaña Productos.</div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.8rem', marginBottom:20 }}>
          <thead><tr>{['Producto','Qty esperada','Qty real','Kg esperado','Kg real'].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {(cot.productos||[]).map((p,i) => (
              <tr key={p.id} style={{ background:i%2?'#F9FBF9':T.white }}>
                <td style={{ padding:'7px 10px', fontWeight:600, color:T.primary }}>{p.nom}</td>
                <td style={{ padding:'7px 10px', textAlign:'right', color:T.textMid }}>{p.qty}</td>
                <td style={{ padding:'4px 6px' }}>
                  <input type="number" value={form.cantidades[p.id]?.cant||''} onChange={e=>setCant(p.id,'cant',e.target.value)}
                    style={{ padding:'5px 8px', border:`1px solid ${T.border}`, borderRadius:4, width:80, textAlign:'right', fontSize:'.82rem', fontFamily:'inherit' }} placeholder={p.qty}/>
                </td>
                <td style={{ padding:'7px 10px', textAlign:'right', color:T.textMid }}>{fmt(p.kgT)}</td>
                <td style={{ padding:'4px 6px' }}>
                  <input type="number" value={form.cantidades[p.id]?.kg||''} onChange={e=>setCant(p.id,'kg',e.target.value)}
                    style={{ padding:'5px 8px', border:`1px solid ${T.border}`, borderRadius:4, width:90, textAlign:'right', fontSize:'.82rem', fontFamily:'inherit' }} placeholder={fmt(p.kgT)}/>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button onClick={handleConfirm} disabled={saving}
        style={{ padding:'10px 28px', background:T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, fontSize:'.9rem', cursor:'pointer', opacity:saving?.6:1, fontFamily:'inherit' }}>
        {saving ? 'Procesando…' : '🏭 Confirmar recepción en bodega'}
      </button>
    </div>
  );
}
