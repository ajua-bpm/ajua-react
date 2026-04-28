import { useState, useEffect, useMemo } from 'react';
import { useProyeccion, isoWeek, weekRange, shiftWeek, calcRow } from './useProyeccion';
import { ProductoRowDesktop, ProductoCard, ProductoModal } from './ProductoRow';
import { exportarProyeccion } from './exportExcel';

const T = { primary:'#1B5E20', danger:'#C62828', border:'#E0E0E0', mid:'#6B6B60', dark:'#1A1A18', warn:'#E65100' };
const W = '#FFFFFF';
const fmtQ = n => 'Q ' + Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2});

function SCard({ label, value, sub, color }) {
  return (
    <div style={{ background:W, borderRadius:10, padding:'14px 16px', flex:'1 1 160px', minWidth:0, boxShadow:'0 1px 3px rgba(0,0,0,.1)' }}>
      <div style={{ fontSize:'.72rem', fontWeight:700, color:T.mid, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:'1.1rem', fontWeight:800, color:color||T.dark }}>{fmtQ(value)}</div>
      {sub&&<div style={{ fontSize:'.75rem', color:T.mid, marginTop:2 }}>{sub}</div>}
    </div>
  );
}

export default function ProyeccionSemanal() {
  const [semana,     setSemana]     = useState(isoWeek());
  const [tab,        setTab]        = useState('proyeccion');
  const [modal,      setModal]      = useState(null);
  const [cierreModo, setCierreModo] = useState(false);
  const [reales,     setReales]     = useState({});
  const [guardando,  setGuardando]  = useState(false);

  const { proyeccion, historial, loading, productosDB, fijosSemanal,
    cargar, guardar, cerrarSemana, cargarHistorial, setProyeccion } = useProyeccion();

  useEffect(() => { cargar(semana); }, [semana]); // eslint-disable-line
  useEffect(() => { if (tab === 'historial') cargarHistorial(); }, [tab]); // eslint-disable-line

  const productosMap = useMemo(() => Object.fromEntries(productosDB.map(p => [p.id, p])), [productosDB]);

  const filas = useMemo(() => (proyeccion?.productos || []).map(p => {
    const base = productosMap[p.productoId] || {};
    const m = { ...base, ...p, precioVenta: p.precioVenta??base.precioVenta??0, costo: p.costo??base.costo??0,
      descuentoPct: p.descuentoPct??base.descuentoPct??0, ivaRetPct: p.ivaRetPct??base.ivaRetPct??85.71 };
    return { ...m, ...calcRow(m) };
  }), [proyeccion, productosMap]);

  const totalProy = filas.reduce((s, p) => s + p.totalSemana, 0);
  const deficit   = fijosSemanal - totalProy;
  const cerrada   = proyeccion?.estado === 'cerrada';
  const existingIds = (proyeccion?.productos || []).map(p => p.productoId);

  const addOrEdit = (form) => {
    const base = productosMap[form.productoId] || {};
    const item = { productoId: form.productoId, nombre: base.nombre || form.nombre,
      cajasProyectadas: form.cajasProyectadas, lbsPorCaja: form.lbsPorCaja, frecuencia: form.frecuencia };
    setProyeccion(prev => {
      const prods = prev.productos || [];
      const idx = prods.findIndex(p => p.productoId === item.productoId);
      return { ...prev, productos: idx >= 0 ? prods.map((p,i) => i===idx ? item : p) : [...prods, item] };
    });
    setModal(null);
  };

  const removeProducto = pid => setProyeccion(prev => ({ ...prev, productos: (prev.productos||[]).filter(p => p.productoId !== pid) }));
  const handleGuardar  = async () => { setGuardando(true); try { await guardar(proyeccion); } finally { setGuardando(false); } };
  const handleCerrar   = async () => { setGuardando(true); try { await cerrarSemana(proyeccion, reales); setCierreModo(false); } finally { setGuardando(false); } };
  const handleExport   = () => exportarProyeccion({ proyeccion: { ...proyeccion, lunes: weekRange(semana).lunes, domingo: weekRange(semana).domingo }, productosMap, fijosSemanal, historial, allHistorialProductosMap: productosMap });
  const rng = weekRange(semana);

  return (
    <div style={{ maxWidth:980 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10, marginBottom:16 }}>
        <div>
          <h1 style={{ margin:0, fontSize:'1.25rem', fontWeight:800, color:T.dark }}>📊 Proyección Semanal</h1>
          <div style={{ fontSize:'.8rem', color:T.mid, marginTop:2 }}>{rng.label}</div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <button onClick={()=>setSemana(shiftWeek(semana,-1))} style={{ padding:'6px 12px', border:`1.5px solid ${T.border}`, borderRadius:6, background:W, cursor:'pointer', fontSize:'.82rem' }}>← Anterior</button>
          <span style={{ fontSize:'.84rem', fontWeight:700, color:T.dark, padding:'0 4px' }}>{semana}</span>
          <button onClick={()=>setSemana(shiftWeek(semana,1))} style={{ padding:'6px 12px', border:`1.5px solid ${T.border}`, borderRadius:6, background:W, cursor:'pointer', fontSize:'.82rem' }}>Siguiente →</button>
          <span style={{ padding:'4px 10px', borderRadius:100, fontSize:'.74rem', fontWeight:700, background:cerrada?'#F3F4F6':'#E8F5E9', color:cerrada?T.mid:'#15803d' }}>{cerrada?'🔒 Cerrada':'🟢 Activa'}</span>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
        <SCard label="Proyectado semana" value={totalProy} color="#15803d" sub={fijosSemanal>0?`${(totalProy/fijosSemanal*100).toFixed(0)}% cubre fijos`:''} />
        <SCard label="Gastos fijos semana" value={fijosSemanal} color={T.warn} sub="mensual ÷ 4.33" />
        <SCard label={deficit<=0?'✅ Superávit':'🔴 Déficit'} value={Math.abs(deficit)} color={deficit<=0?'#15803d':T.danger} sub={deficit>0?`Faltan ${fmtQ(deficit)}`:'Gastos fijos cubiertos'} />
        {filas.length>0&&<SCard label="Lbs proyectadas" value={filas.reduce((s,p)=>s+p.totalLbs,0)} color={T.dark} sub={`${filas.length} productos`} />}
      </div>

      {deficit>0&&!cerrada&&(
        <div style={{ background:'#FFEBEE', border:'1px solid #FFCDD2', borderRadius:8, padding:'10px 16px', marginBottom:14, fontSize:'.84rem', color:T.danger, fontWeight:600 }}>
          ⚠️ Esta semana NO cubre gastos fijos. Faltan {fmtQ(deficit)} en contribución marginal.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, borderBottom:`2px solid ${T.border}`, marginBottom:16 }}>
        {[['proyeccion','📋 Proyección'],['historial','📅 Historial']].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ padding:'8px 16px', border:'none', borderBottom:`2px solid ${tab===id?T.primary:'transparent'}`, marginBottom:-2, background:'none', fontWeight:tab===id?700:500, color:tab===id?T.primary:T.mid, cursor:'pointer', fontSize:'.84rem' }}>{lbl}</button>
        ))}
      </div>

      {/* ── Tab: Proyección ── */}
      {tab==='proyeccion'&&(
        <>
          {!cerrada&&(
            <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
              <button onClick={()=>setModal({})} style={{ padding:'7px 16px', background:T.primary, color:W, border:'none', borderRadius:6, fontWeight:700, cursor:'pointer', fontSize:'.82rem' }}>+ Agregar producto</button>
              <button onClick={handleGuardar} disabled={guardando} style={{ padding:'7px 16px', background:W, border:`1.5px solid ${T.border}`, borderRadius:6, cursor:'pointer', fontSize:'.82rem' }}>💾 {guardando?'Guardando…':'Guardar'}</button>
              <button onClick={()=>{ setReales({}); setCierreModo(true); }} style={{ padding:'7px 16px', background:'#EEF2FF', color:'#3730a3', border:'none', borderRadius:6, cursor:'pointer', fontSize:'.82rem' }}>🔒 Cerrar semana</button>
              <button onClick={handleExport} style={{ padding:'7px 16px', background:'#FFFDE7', color:'#B45309', border:'none', borderRadius:6, cursor:'pointer', fontSize:'.82rem', fontWeight:700 }}>📥 Excel</button>
            </div>
          )}
          {cerrada&&<div style={{ marginBottom:14 }}><button onClick={handleExport} style={{ padding:'7px 16px', background:'#FFFDE7', color:'#B45309', border:'none', borderRadius:6, cursor:'pointer', fontSize:'.82rem', fontWeight:700 }}>📥 Descargar Excel</button></div>}

          {loading&&<div style={{ padding:40, textAlign:'center', color:T.mid }}>Cargando…</div>}
          {!loading&&(
            <>
              {/* Desktop */}
              <div style={{ background:W, borderRadius:10, border:`1px solid ${T.border}`, overflow:'auto', marginBottom:16 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:780 }}>
                  <thead><tr style={{ background:T.primary, color:W }}>
                    {['Producto','Cajas','Lb/U','Frec','Total Lbs','P.V.','Costo','Libre/lb','Margen%','Q Semana',''].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', textAlign:h==='Producto'?'left':'right', fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(proyeccion?.productos||[]).map(p=>(
                      <ProductoRowDesktop key={p.productoId} p={p} productosMap={productosMap} onEdit={item=>setModal({item})} onRemove={removeProducto} cerrada={cerrada} />
                    ))}
                    {filas.length>0&&(
                      <tr style={{ background:'#F1F8F1', borderTop:`2px solid #A5D6A7` }}>
                        <td colSpan={4} style={{ padding:'10px', fontWeight:800, color:T.dark }}>TOTAL SEMANA</td>
                        <td style={{ padding:'10px', textAlign:'right', fontWeight:700 }}>{filas.reduce((s,p)=>s+p.totalLbs,0).toFixed(0)}</td>
                        <td colSpan={4} />
                        <td style={{ padding:'10px', textAlign:'right', fontWeight:800, fontSize:'1rem', color:totalProy>fijosSemanal?'#15803d':T.danger }}>{fmtQ(totalProy)}</td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards (solo en pantallas pequeñas via CSS) */}
              <div>
                {(proyeccion?.productos||[]).map(p=>(
                  <ProductoCard key={p.productoId} p={p} productosMap={productosMap} onEdit={item=>setModal({item})} onRemove={removeProducto} cerrada={cerrada} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Tab: Historial ── */}
      {tab==='historial'&&(
        <div style={{ background:W, borderRadius:10, border:`1px solid ${T.border}`, overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
            <thead><tr style={{ background:T.primary, color:W }}>
              {['Semana','Período','Proyectado','Real','Variación','Cobertura','Estado'].map(h=>(
                <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'.74rem', fontWeight:700, textTransform:'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {historial.map((h,i)=>{
                const hp = (h.productos||[]).reduce((s,p)=>{ const base=productosMap[p.productoId]||{}; const m={...base,...p,precioVenta:p.precioVenta??base.precioVenta??0,costo:p.costo??base.costo??0,descuentoPct:p.descuentoPct??base.descuentoPct??0,ivaRetPct:p.ivaRetPct??base.ivaRetPct??85.71}; return s+calcRow(m).totalSemana; },0);
                const hr = (h.productos||[]).reduce((s,p)=>{ const base=productosMap[p.productoId]||{}; const m={...base,...p,precioVenta:p.precioVenta??base.precioVenta??0,costo:p.costo??base.costo??0,descuentoPct:p.descuentoPct??base.descuentoPct??0,ivaRetPct:p.ivaRetPct??base.ivaRetPct??85.71}; return s+calcRow(m).totalSemanaReal; },0);
                const vari=hr-hp; const cob=fijosSemanal>0?(hp/fijosSemanal*100):0;
                return (
                  <tr key={h.id} style={{ background:i%2===0?W:'#F9FAFB', borderBottom:`1px solid ${T.border}`, cursor:'pointer' }} onClick={()=>{setSemana(h.semana);setTab('proyeccion');}}>
                    <td style={{ padding:'10px 12px', fontWeight:700 }}>{h.semana}</td>
                    <td style={{ padding:'10px 12px', color:T.mid, fontSize:'.82rem' }}>{h.lunes} – {h.domingo}</td>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace' }}>{fmtQ(hp)}</td>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace' }}>{h.estado==='cerrada'?fmtQ(hr):'—'}</td>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace', fontWeight:700, color:vari>=0?'#15803d':T.danger }}>{h.estado==='cerrada'?fmtQ(vari):'—'}</td>
                    <td style={{ padding:'10px 12px', color:cob>=100?'#15803d':T.danger, fontWeight:600 }}>{cob.toFixed(0)}%</td>
                    <td style={{ padding:'10px 12px' }}><span style={{ padding:'3px 10px', borderRadius:100, fontSize:'.72rem', fontWeight:700, background:h.estado==='cerrada'?'#F3F4F6':'#E8F5E9', color:h.estado==='cerrada'?T.mid:'#15803d' }}>{h.estado==='cerrada'?'🔒 Cerrada':'🟢 Activa'}</span></td>
                  </tr>
                );
              })}
              {historial.length===0&&<tr><td colSpan={7} style={{ padding:24, textAlign:'center', color:T.mid }}>Sin semanas cerradas aún.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal producto */}
      {modal!==null&&<ProductoModal item={modal.item} productosDB={productosDB} existingIds={existingIds} onSave={addOrEdit} onClose={()=>setModal(null)} />}

      {/* Modal cierre semana */}
      {cierreModo&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:W, borderRadius:12, padding:24, width:'100%', maxWidth:420, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ fontWeight:800, fontSize:'1rem', marginBottom:4, color:T.dark }}>🔒 Cerrar semana {semana}</div>
            <div style={{ fontSize:'.8rem', color:T.mid, marginBottom:16 }}>Ingresa las cajas REALES entregadas esta semana</div>
            {(proyeccion?.productos||[]).map(p=>(
              <div key={p.productoId} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, gap:10 }}>
                <span style={{ fontSize:'.86rem', fontWeight:600, flex:1 }}>{productosMap[p.productoId]?.nombre||p.nombre}</span>
                <span style={{ fontSize:'.78rem', color:T.mid }}>Proy: {p.cajasProyectadas}</span>
                <input type="number" min="0" value={reales[p.productoId]??''} onChange={e=>setReales(r=>({...r,[p.productoId]:parseFloat(e.target.value)||0}))}
                  placeholder="0" style={{ width:80, padding:'6px 8px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.86rem', textAlign:'right' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={handleCerrar} disabled={guardando} style={{ flex:1, padding:10, background:'#3730a3', color:W, border:'none', borderRadius:6, fontWeight:700, cursor:'pointer' }}>
                {guardando?'Cerrando…':'🔒 Confirmar cierre'}
              </button>
              <button onClick={()=>setCierreModo(false)} style={{ padding:'10px 16px', background:'#F5F5F5', border:'none', borderRadius:6, cursor:'pointer', color:T.mid }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
