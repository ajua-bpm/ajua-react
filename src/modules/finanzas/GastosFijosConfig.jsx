import { useState, useEffect } from 'react';
import { useGastosFijos } from './useFinanzas';

const T = { primary:'#1B5E20', danger:'#C62828', border:'#E0E0E0', mid:'#6B6B60', dark:'#1A1A18', warn:'#E65100' };
const WHITE  = '#FFFFFF';
const BANCOS = ['BAM','GYT','INDUSTRIAL'];
const FREQS  = [{ id:'mensual', label:'Mensual' }, { id:'quincenal', label:'Quincenal (×2/mes)' }];
const CATS   = ['renta_bodega','transporte_fijo','luz_servicios','empleado_fijo'];
const fmtQ   = n => 'Q ' + Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2});

const EMPTY = { concepto:'', monto:'', frecuencia:'mensual', banco:'BAM', categoria:'empleado_fijo', activo:true };

function Row({ item, onSave, onDelete }) {
  const [edit,   setEdit]   = useState(false);
  const [form,   setForm]   = useState(item);
  const [saving, setSaving] = useState(false);

  const campo = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(item.id, { ...form, monto: parseFloat(form.monto)||0 });
      setEdit(false);
    } finally { setSaving(false); }
  };

  const montoMes = item.frecuencia === 'quincenal' ? (item.monto||0)*2 : (item.monto||0);

  if (!edit) return (
    <tr style={{ borderBottom:`1px solid ${T.border}`, opacity: item.activo===false ? .5 : 1 }}>
      <td style={{ padding:'10px 12px', fontWeight:600, color:T.dark }}>{item.concepto}</td>
      <td style={{ padding:'10px 12px', textAlign:'right', fontFamily:'monospace' }}>{fmtQ(item.monto)}</td>
      <td style={{ padding:'10px 12px', color:T.mid, fontSize:'.82rem' }}>
        {item.frecuencia === 'quincenal' ? `Quincenal → ${fmtQ(montoMes)}/mes` : 'Mensual'}
      </td>
      <td style={{ padding:'10px 12px' }}>
        <span style={{ padding:'2px 8px', background:'#E8F5E9', color:'#15803d', borderRadius:100, fontSize:'.72rem', fontWeight:700 }}>{item.banco}</span>
      </td>
      <td style={{ padding:'10px 12px' }}>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={()=>setEdit(true)} style={{ padding:'5px 12px', background:'#EEF2FF', color:'#3730a3', border:'none', borderRadius:5, fontSize:'.78rem', fontWeight:600, cursor:'pointer' }}>Editar</button>
          <button onClick={()=>onDelete(item.id)} style={{ padding:'5px 10px', background:'#FFEBEE', color:T.danger, border:'none', borderRadius:5, fontSize:'.78rem', cursor:'pointer' }}>✕</button>
        </div>
      </td>
    </tr>
  );

  return (
    <tr style={{ background:'#FFFDE7', borderBottom:`1px solid ${T.border}` }}>
      <td style={{ padding:'8px 10px' }}>
        <input value={form.concepto} onChange={e=>campo('concepto',e.target.value)} placeholder="Concepto…"
          style={{ padding:'6px 8px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.84rem', width:'100%', boxSizing:'border-box' }} />
      </td>
      <td style={{ padding:'8px 10px' }}>
        <input type="number" value={form.monto} onChange={e=>campo('monto',e.target.value)} placeholder="0.00"
          style={{ padding:'6px 8px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.84rem', width:110, textAlign:'right' }} />
      </td>
      <td style={{ padding:'8px 10px' }}>
        <select value={form.frecuencia} onChange={e=>campo('frecuencia',e.target.value)}
          style={{ padding:'6px 8px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.82rem' }}>
          {FREQS.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </td>
      <td style={{ padding:'8px 10px' }}>
        <select value={form.banco} onChange={e=>campo('banco',e.target.value)}
          style={{ padding:'6px 8px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.82rem' }}>
          {BANCOS.map(b=><option key={b}>{b}</option>)}
        </select>
      </td>
      <td style={{ padding:'8px 10px' }}>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={handleSave} disabled={saving||!form.concepto}
            style={{ padding:'5px 14px', background:T.primary, color:WHITE, border:'none', borderRadius:5, fontSize:'.78rem', fontWeight:700, cursor:'pointer' }}>
            {saving?'…':'✓'}
          </button>
          <button onClick={()=>setEdit(false)} style={{ padding:'5px 10px', background:'#F5F5F5', color:T.mid, border:'none', borderRadius:5, fontSize:'.78rem', cursor:'pointer' }}>✕</button>
        </div>
      </td>
    </tr>
  );
}

export default function GastosFijosConfig() {
  const { data, loading, cargar, agregar, actualizar, eliminar, totalMensual } = useGastosFijos();
  const [form,   setForm]   = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const campo = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{ cargar(); }, []); // eslint-disable-line

  const handleAgregar = async (e) => {
    e.preventDefault();
    if (!form.concepto||!form.monto) return;
    setSaving(true);
    try { await agregar({ ...form, monto: parseFloat(form.monto)||0 }); setForm(EMPTY); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este gasto fijo?')) return;
    await eliminar(id);
  };

  return (
    <div style={{ maxWidth:780 }}>
      {/* Resumen total */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:'.78rem', fontWeight:700, color:T.mid, textTransform:'uppercase', letterSpacing:'.05em' }}>Total gastos fijos / mes</div>
          <div style={{ fontSize:'1.6rem', fontWeight:800, color:T.dark, fontFamily:'monospace' }}>{fmtQ(totalMensual)}</div>
          <div style={{ fontSize:'.78rem', color:T.mid, marginTop:2 }}>Quincenales cuentan doble. Se usan en el P&L como base fija.</div>
        </div>
        <button onClick={cargar} style={{ padding:'7px 14px', background:WHITE, border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.80rem', cursor:'pointer', color:T.mid }}>🔄 Recargar</button>
      </div>

      {/* Tabla */}
      <div style={{ background:WHITE, borderRadius:10, border:`1px solid ${T.border}`, overflow:'hidden', marginBottom:20, boxShadow:'0 1px 3px rgba(0,0,0,.08)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:T.primary, color:WHITE }}>
              {['Concepto','Monto','Frecuencia','Banco',''].map(h=>(
                <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'.78rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ padding:20, textAlign:'center', color:T.mid }}>Cargando…</td></tr>}
            {!loading && data.length===0 && <tr><td colSpan={5} style={{ padding:20, textAlign:'center', color:T.mid }}>Sin gastos fijos configurados.</td></tr>}
            {data.map(item=>(
              <Row key={item.id} item={item} onSave={actualizar} onDelete={handleDelete} />
            ))}
            {/* Fila total */}
            {data.length>0 && (
              <tr style={{ background:'#F1F8F1', borderTop:`2px solid #A5D6A7` }}>
                <td style={{ padding:'10px 12px', fontWeight:800, color:T.dark }}>TOTAL MENSUAL</td>
                <td colSpan={3} />
                <td style={{ padding:'10px 12px', fontWeight:800, fontFamily:'monospace', fontSize:'1rem', color:'#15803d', textAlign:'right', paddingRight:16 }}>{fmtQ(totalMensual)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Form agregar */}
      <div style={{ background:WHITE, borderRadius:10, border:`1px solid ${T.border}`, padding:20, boxShadow:'0 1px 3px rgba(0,0,0,.08)' }}>
        <div style={{ fontWeight:700, color:T.dark, marginBottom:14 }}>+ Agregar gasto fijo</div>
        <form onSubmit={handleAgregar} style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:'2 1 180px' }}>
            <label style={{ display:'block', fontSize:'.74rem', fontWeight:700, color:T.mid, marginBottom:3, textTransform:'uppercase' }}>Concepto</label>
            <input value={form.concepto} onChange={e=>campo('concepto',e.target.value)} placeholder="Renta bodega…"
              style={{ padding:'8px 10px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.86rem', width:'100%', boxSizing:'border-box' }} />
          </div>
          <div style={{ flex:'1 1 110px' }}>
            <label style={{ display:'block', fontSize:'.74rem', fontWeight:700, color:T.mid, marginBottom:3, textTransform:'uppercase' }}>Monto (Q)</label>
            <input type="number" value={form.monto} onChange={e=>campo('monto',e.target.value)} placeholder="0.00" min="0" step="0.01"
              style={{ padding:'8px 10px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.86rem', width:'100%', boxSizing:'border-box' }} />
          </div>
          <div style={{ flex:'1 1 140px' }}>
            <label style={{ display:'block', fontSize:'.74rem', fontWeight:700, color:T.mid, marginBottom:3, textTransform:'uppercase' }}>Frecuencia</label>
            <select value={form.frecuencia} onChange={e=>campo('frecuencia',e.target.value)}
              style={{ padding:'8px 10px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.84rem', width:'100%' }}>
              {FREQS.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div style={{ flex:'1 1 110px' }}>
            <label style={{ display:'block', fontSize:'.74rem', fontWeight:700, color:T.mid, marginBottom:3, textTransform:'uppercase' }}>Banco</label>
            <select value={form.banco} onChange={e=>campo('banco',e.target.value)}
              style={{ padding:'8px 10px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.84rem', width:'100%' }}>
              {BANCOS.map(b=><option key={b}>{b}</option>)}
            </select>
          </div>
          <button type="submit" disabled={saving||!form.concepto||!form.monto}
            style={{ padding:'9px 22px', background:T.primary, color:WHITE, border:'none', borderRadius:6, fontWeight:700, fontSize:'.86rem', cursor:'pointer', minHeight:40, flexShrink:0, alignSelf:'flex-end' }}>
            {saving?'Guardando…':'Agregar'}
          </button>
        </form>
      </div>
    </div>
  );
}
