import { useState, useEffect, useMemo } from 'react';
import { useProductosMargen, useGastosFijos } from './useFinanzas';

const T = { primary:'#1B5E20', danger:'#C62828', warn:'#E65100', border:'#E0E0E0', mid:'#6B6B60', dark:'#1A1A18' };
const WHITE = '#FFFFFF';
const fmtQ  = (n,d=2) => 'Q ' + Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:d,maximumFractionDigits:d});

function isoWeek(d=new Date()) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay()||7));
  const y = dt.getUTCFullYear();
  const w = Math.ceil((((dt - new Date(Date.UTC(y,0,1)))/86400000)+1)/7);
  return `${y}-W${String(w).padStart(2,'0')}`;
}

// ── Form producto ──────────────────────────────────────────────────
function ProductoForm({ inicial, onSave, onCancel }) {
  const [f, setF] = useState(inicial || { nombre:'', costo:'', precioVenta:'', descuentoPct:'1.25', ivaRetPct:'85.71' });
  const c = (k,v) => setF(p=>({...p,[k]:v}));
  const neto  = (f.precioVenta/1.12*0.12*(f.ivaRetPct/100)) + (f.precioVenta*(f.descuentoPct/100));
  const libre = parseFloat(f.precioVenta||0) - neto - parseFloat(f.costo||0);
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'flex-end', padding:'12px 14px', background:'#FFFDE7', borderRadius:8, marginBottom:10 }}>
      <div style={{ flex:'2 1 150px' }}><label style={{ fontSize:'.72rem', fontWeight:700, color:T.mid, display:'block', marginBottom:3 }}>PRODUCTO</label>
        <input value={f.nombre} onChange={e=>c('nombre',e.target.value)} placeholder="Nombre…" style={{ padding:'7px 9px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.84rem', width:'100%', boxSizing:'border-box' }} /></div>
      <div style={{ flex:'1 1 90px' }}><label style={{ fontSize:'.72rem', fontWeight:700, color:T.mid, display:'block', marginBottom:3 }}>COSTO/LB</label>
        <input type="number" value={f.costo} onChange={e=>c('costo',e.target.value)} placeholder="0.00" style={{ padding:'7px 9px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.84rem', width:'100%', boxSizing:'border-box' }} /></div>
      <div style={{ flex:'1 1 90px' }}><label style={{ fontSize:'.72rem', fontWeight:700, color:T.mid, display:'block', marginBottom:3 }}>PV/LB</label>
        <input type="number" value={f.precioVenta} onChange={e=>c('precioVenta',e.target.value)} placeholder="0.00" style={{ padding:'7px 9px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.84rem', width:'100%', boxSizing:'border-box' }} /></div>
      <div style={{ flex:'1 1 80px' }}><label style={{ fontSize:'.72rem', fontWeight:700, color:T.mid, display:'block', marginBottom:3 }}>DESC%</label>
        <input type="number" value={f.descuentoPct} onChange={e=>c('descuentoPct',e.target.value)} style={{ padding:'7px 9px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.84rem', width:'100%', boxSizing:'border-box' }} /></div>
      <div style={{ flex:'1 1 80px' }}><label style={{ fontSize:'.72rem', fontWeight:700, color:T.mid, display:'block', marginBottom:3 }}>IVA RET%</label>
        <input type="number" value={f.ivaRetPct} onChange={e=>c('ivaRetPct',e.target.value)} style={{ padding:'7px 9px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.84rem', width:'100%', boxSizing:'border-box' }} /></div>
      <div style={{ fontSize:'.82rem', fontWeight:700, color: libre>=0?'#15803d':T.danger, minWidth:80 }}>
        LIBRE: {fmtQ(libre)}/lb
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <button onClick={()=>onSave({...f,costo:parseFloat(f.costo)||0,precioVenta:parseFloat(f.precioVenta)||0,descuentoPct:parseFloat(f.descuentoPct)||0,ivaRetPct:parseFloat(f.ivaRetPct)||0})}
          disabled={!f.nombre||!f.costo||!f.precioVenta}
          style={{ padding:'7px 16px', background:T.primary, color:WHITE, border:'none', borderRadius:5, fontWeight:700, cursor:'pointer' }}>Guardar</button>
        {onCancel&&<button onClick={onCancel} style={{ padding:'7px 12px', background:'#F5F5F5', border:'none', borderRadius:5, cursor:'pointer', color:T.mid }}>✕</button>}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────
export default function MargenProductos() {
  const { productos, ventas, loading, cargar, guardarProducto, eliminarProducto, guardarVenta, calcLibre } = useProductosMargen();
  const { data: fijosData, cargar: cargarFijos, totalMensual } = useGastosFijos();
  const [semana,    setSemana]    = useState(isoWeek());
  const [showForm,  setShowForm]  = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [lbsInput,  setLbsInput]  = useState({});   // { productoId: lbs }
  const [saving,    setSaving]    = useState(null);

  useEffect(()=>{ cargar(); cargarFijos(); },[]);// eslint-disable-line

  // Sincronizar inputs con ventas guardadas de la semana
  useEffect(()=>{
    const map = {};
    ventas.filter(v=>v.semana===semana).forEach(v=>{ map[v.productoId]=v.lbs; });
    setLbsInput(map);
  },[ventas, semana]);

  const fijosSemanal = totalMensual / 4.33;

  // Calcular contribución por producto
  const filas = useMemo(()=> productos.filter(p=>p.activo!==false).map(p=>{
    const { libre } = calcLibre(p);
    const lbs         = parseFloat(lbsInput[p.id]||0);
    const contribucion = libre * lbs;
    const pctLibre     = p.precioVenta > 0 ? (libre/p.precioVenta)*100 : 0;
    return { ...p, libre, lbs, contribucion, pctLibre };
  }), [productos, lbsInput, calcLibre]);

  const totalContrib = filas.reduce((s,f)=>s+f.contribucion,0);
  const deficit      = fijosSemanal - totalContrib;
  const pctCubierto  = fijosSemanal > 0 ? Math.min(200, (totalContrib/fijosSemanal)*100) : 0;
  const barColor     = pctCubierto>=100?'#16a34a':pctCubierto>=70?'#f59e0b':'#dc2626';

  const handleGuardarLbs = async (productoId) => {
    setSaving(productoId);
    try { await guardarVenta(semana, productoId, parseFloat(lbsInput[productoId]||0), 0); }
    finally { setSaving(null); }
  };

  return (
    <div style={{ maxWidth:860 }}>
      {/* Dashboard header */}
      <div style={{ background:WHITE, borderRadius:12, border:`1.5px solid ${deficit<=0?'#A5D6A7':'#FFCDD2'}`, padding:'18px 20px', marginBottom:16, boxShadow:'0 1px 4px rgba(0,0,0,.08)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10, marginBottom:12 }}>
          <div>
            <div style={{ fontSize:'.75rem', fontWeight:700, color:T.mid, textTransform:'uppercase', letterSpacing:'.05em' }}>Semana {semana} · Contribución vs Fijos</div>
            <div style={{ fontSize:'1.5rem', fontWeight:800, color: deficit<=0?'#15803d':T.danger, fontFamily:'monospace', marginTop:2 }}>
              {deficit<=0 ? `✅ Superávit ${fmtQ(Math.abs(deficit))}` : `🔴 Déficit ${fmtQ(deficit)}`}
            </div>
            <div style={{ fontSize:'.82rem', color:T.mid, marginTop:2 }}>Contribución: <b>{fmtQ(totalContrib)}</b> / Fijos semana: <b>{fmtQ(fijosSemanal)}</b></div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input type="week" value={semana} onChange={e=>setSemana(e.target.value)} style={{ padding:'6px 8px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.82rem' }} />
            <button onClick={()=>{cargar();cargarFijos();}} style={{ padding:'6px 12px', background:WHITE, border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.80rem', cursor:'pointer', color:T.mid }}>🔄</button>
          </div>
        </div>
        {/* Barra progreso */}
        <div style={{ background:'#F0F0F0', borderRadius:100, height:20, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:100, width:`${Math.min(100,pctCubierto)}%`, background:barColor, transition:'width .4s', display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:8 }}>
            {pctCubierto>15&&<span style={{ fontSize:'.72rem', fontWeight:700, color:WHITE }}>{pctCubierto.toFixed(0)}%</span>}
          </div>
        </div>
        {deficit>0&&<div style={{ fontSize:'.80rem', color:T.danger, marginTop:6, fontWeight:600 }}>Necesitas {fmtQ(deficit)} más en contribución esta semana</div>}
      </div>

      {/* Tabla de productos */}
      <div style={{ background:WHITE, borderRadius:10, border:`1px solid ${T.border}`, overflow:'hidden', marginBottom:16 }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr style={{ background:T.primary, color:WHITE }}>
            {['Producto','Costo/lb','PV/lb','Libre/lb','Margen%','Lbs semana','Contribución',''].map(h=>(
              <th key={h} style={{ padding:'9px 11px', textAlign:'left', fontSize:'.74rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading&&<tr><td colSpan={8} style={{ padding:20, textAlign:'center', color:T.mid }}>Cargando…</td></tr>}
            {filas.map((p,i)=>{
              const semaforo = p.pctLibre>=15?'#16a34a':p.pctLibre>=8?'#f59e0b':'#dc2626';
              const isEdit = editando===p.id;
              return isEdit ? (
                <tr key={p.id}><td colSpan={8} style={{ padding:0 }}>
                  <ProductoForm inicial={p} onSave={async d=>{await guardarProducto({...d,id:p.id});setEditando(null);}} onCancel={()=>setEditando(null)} />
                </td></tr>
              ) : (
                <tr key={p.id} style={{ background:i%2===0?WHITE:'#F9FAFB', borderBottom:`1px solid ${T.border}` }}>
                  <td style={{ padding:'10px 11px', fontWeight:700, color:T.dark }}>
                    <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:semaforo, marginRight:6 }} />
                    {p.nombre}
                  </td>
                  <td style={{ padding:'10px 11px', fontFamily:'monospace', color:T.danger }}>{fmtQ(p.costo)}</td>
                  <td style={{ padding:'10px 11px', fontFamily:'monospace', color:'#15803d' }}>{fmtQ(p.precioVenta)}</td>
                  <td style={{ padding:'10px 11px', fontFamily:'monospace', fontWeight:700, color:p.libre>=0?'#15803d':T.danger }}>{fmtQ(p.libre)}</td>
                  <td style={{ padding:'10px 11px', color:semaforo, fontWeight:700 }}>{p.pctLibre.toFixed(1)}%</td>
                  <td style={{ padding:'6px 8px', width:130 }}>
                    <div style={{ display:'flex', gap:4 }}>
                      <input type="number" value={lbsInput[p.id]||''} onChange={e=>setLbsInput(prev=>({...prev,[p.id]:e.target.value}))}
                        placeholder="0" min="0"
                        style={{ width:80, padding:'6px 7px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.84rem', textAlign:'right' }} />
                      <button onClick={()=>handleGuardarLbs(p.id)} disabled={saving===p.id}
                        style={{ padding:'6px 10px', background:saving===p.id?'#ccc':T.primary, color:WHITE, border:'none', borderRadius:5, fontWeight:700, cursor:'pointer', fontSize:'.78rem' }}>
                        {saving===p.id?'…':'✓'}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding:'10px 11px', fontFamily:'monospace', fontWeight:700, color:p.contribucion>0?'#15803d':T.mid }}>
                    {p.lbs>0?fmtQ(p.contribucion):'—'}
                  </td>
                  <td style={{ padding:'10px 8px' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={()=>setEditando(p.id)} style={{ padding:'4px 10px', background:'#EEF2FF', color:'#3730a3', border:'none', borderRadius:4, fontSize:'.74rem', cursor:'pointer' }}>✏️</button>
                      <button onClick={async()=>{if(window.confirm('¿Eliminar?'))await eliminarProducto(p.id);}} style={{ padding:'4px 8px', background:'#FFEBEE', color:T.danger, border:'none', borderRadius:4, fontSize:'.74rem', cursor:'pointer' }}>✕</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filas.length>0&&(
              <tr style={{ background:'#F1F8F1', borderTop:`2px solid #A5D6A7` }}>
                <td colSpan={5} style={{ padding:'10px 11px', fontWeight:800, color:T.dark }}>TOTAL SEMANA</td>
                <td style={{ padding:'10px 11px', fontFamily:'monospace', fontWeight:700 }}>{fmtQ(filas.reduce((s,f)=>s+f.lbs,0),0)} lbs</td>
                <td style={{ padding:'10px 11px', fontFamily:'monospace', fontWeight:800, fontSize:'1rem', color:totalContrib>fijosSemanal?'#15803d':T.danger }}>{fmtQ(totalContrib)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Agregar producto */}
      {showForm ? (
        <ProductoForm onSave={async d=>{await guardarProducto(d);setShowForm(false);}} onCancel={()=>setShowForm(false)} />
      ) : (
        <button onClick={()=>setShowForm(true)} style={{ padding:'9px 20px', background:WHITE, border:`1.5px dashed ${T.border}`, borderRadius:8, color:T.mid, fontSize:'.84rem', fontWeight:600, cursor:'pointer', width:'100%' }}>
          + Agregar producto
        </button>
      )}
    </div>
  );
}
