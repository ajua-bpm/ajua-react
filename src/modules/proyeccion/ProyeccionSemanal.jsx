import { useState, useEffect, useMemo } from 'react';
import { useProyeccion, isoWeek, weekRange, shiftWeek, calcRow } from './useProyeccion';
import { ProductoRowDesktop, ProductoCard, ProductoModal } from './ProductoRow';
import { exportarProyeccion } from './exportExcel';

const T = { primary:'#1B5E20', danger:'#C62828', border:'#E0E0E0', mid:'#6B6B60', dark:'#1A1A18', warn:'#E65100' };
const W = '#FFFFFF';
const fmtQ = n => 'Q ' + Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2});

function SCard({ label, value, sub, color, small }) {
  return (
    <div style={{ background:W, borderRadius:10, padding:'14px 16px', flex:'1 1 150px', minWidth:0, boxShadow:'0 1px 3px rgba(0,0,0,.1)' }}>
      <div style={{ fontSize:'.7rem', fontWeight:700, color:T.mid, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize: small?'1rem':'1.1rem', fontWeight:800, color:color||T.dark }}>{fmtQ(value)}</div>
      {sub&&<div style={{ fontSize:'.73rem', color:T.mid, marginTop:2 }}>{sub}</div>}
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
  const [toast,      setToast]      = useState('');

  const { proyeccion, historial, loading, importing, productosDB, fijosSemanal,
    cargar, guardar, cerrarSemana, cargarHistorial, importarWalmart, setProyeccion } = useProyeccion();

  useEffect(() => { cargar(semana); }, [semana]); // eslint-disable-line
  useEffect(() => { if (tab === 'historial') cargarHistorial(); }, [tab]); // eslint-disable-line

  const productosMap = useMemo(() => Object.fromEntries(productosDB.map(p => [p.id, p])), [productosDB]);

  const filas = useMemo(() => (proyeccion?.productos || []).map(p => {
    const base = productosMap[p.productoId] || {};
    const m = { ...base, ...p, precioVenta: p.precioVenta??base.precioVenta??0, costo: p.costo??base.costo??0,
      descuentoPct: p.descuentoPct??base.descuentoPct??0, ivaRetPct: p.ivaRetPct??base.ivaRetPct??85.71 };
    return { ...m, ...calcRow(m) };
  }), [proyeccion, productosMap]);

  // ── Totales proyectados ─────────────────────────────────────────
  const totalContrib  = filas.reduce((s, p) => s + p.totalSemana, 0);
  const totalLbsProy  = filas.reduce((s, p) => s + p.totalLbs, 0);

  // ── P&L real (cuando hay datos de cierre) ──────────────────────
  const ingresosNetos = filas.reduce((s, p) => s + p.ingresosNetos, 0);
  const costoCompras  = filas.reduce((s, p) => s + p.costoCompras, 0) + (proyeccion?.comprasSemana || 0);
  const resultadoReal = ingresosNetos - costoCompras - fijosSemanal;
  const hayCierre     = filas.some(p => p.cajasReales > 0);

  const deficit   = fijosSemanal - totalContrib;
  const cerrada   = proyeccion?.estado === 'cerrada';
  const existingIds = (proyeccion?.productos || []).map(p => p.productoId);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleImportarWalmart = async () => {
    const n = await importarWalmart(semana);
    if (n === 0) showToast('No hay pedidos Walmart para esta semana');
    else showToast(`✅ ${n} productos importados desde Walmart`);
  };

  const addOrEdit = (form) => {
    const base = productosMap[form.productoId] || {};
    const item = {
      productoId: form.productoId, nombre: base.nombre || form.nombre,
      cajasProyectadas: form.cajasProyectadas, cajasCompradas: form.cajasCompradas ?? form.cajasProyectadas,
      lbsPorCaja: form.lbsPorCaja, frecuencia: form.frecuencia,
      ...(form.precioVenta  != null ? { precioVenta:  form.precioVenta  } : {}),
      ...(form.costo        != null ? { costo:        form.costo        } : {}),
      ...(form.descuentoPct != null ? { descuentoPct: form.descuentoPct } : {}),
      ...(form.ivaRetPct    != null ? { ivaRetPct:    form.ivaRetPct    } : {}),
    };
    setProyeccion(prev => {
      const prods = prev.productos || [];
      const idx = prods.findIndex(p => p.productoId === item.productoId);
      return { ...prev, productos: idx >= 0 ? prods.map((p,i) => i===idx ? item : p) : [...prods, item] };
    });
    setModal(null);
  };

  const removeProducto = pid => setProyeccion(prev => ({ ...prev, productos: (prev.productos||[]).filter(p => p.productoId !== pid) }));
  const handleGuardar  = async () => { setGuardando(true); try { await guardar(proyeccion); showToast('✅ Guardado'); } finally { setGuardando(false); } };
  const handleCerrar   = async () => { setGuardando(true); try { await cerrarSemana(proyeccion, reales); setCierreModo(false); showToast('🔒 Semana cerrada'); } finally { setGuardando(false); } };
  const handleExport   = () => exportarProyeccion({ proyeccion: { ...proyeccion, lunes: weekRange(semana).lunes, domingo: weekRange(semana).domingo }, productosMap, fijosSemanal, historial, allHistorialProductosMap: productosMap });
  const rng = weekRange(semana);

  return (
    <div style={{ maxWidth:980 }}>
      {/* Toast */}
      {toast && <div style={{ position:'fixed', top:16, right:16, zIndex:200, background:T.dark, color:W, padding:'10px 18px', borderRadius:8, fontSize:'.84rem', fontWeight:600, boxShadow:'0 4px 12px rgba(0,0,0,.2)' }}>{toast}</div>}

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

      {/* Cards — Proyección */}
      <div style={{ fontSize:'.7rem', fontWeight:700, color:T.mid, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📋 Proyección (contribución marginal)</div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
        <SCard label="Contribución proyectada" value={totalContrib} color="#15803d" sub={fijosSemanal>0?`${(totalContrib/fijosSemanal*100).toFixed(0)}% cubre fijos`:''} />
        <SCard label="Gastos fijos semana" value={fijosSemanal} color={T.warn} sub="mensual ÷ 4.33" />
        <SCard label={deficit<=0?'✅ Superávit margen':'🔴 Déficit margen'} value={Math.abs(deficit)} color={deficit<=0?'#15803d':T.danger} sub={deficit>0?'Faltan en contribución':'Fijos cubiertos'} />
        {totalLbsProy>0 && <SCard label="Lbs proyectadas" value={totalLbsProy} color={T.dark} sub={`${filas.length} productos`} small />}
      </div>

      {/* Cards — P&L Real */}
      {hayCierre && (
        <>
          <div style={{ fontSize:'.7rem', fontWeight:700, color:T.mid, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6, marginTop:4 }}>💰 P&L Real (compras vs ventas)</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
            <SCard label="Ingresos netos reales" value={ingresosNetos} color="#15803d" sub="lbs vendidas × neto/lb" />
            <SCard label="Costo compras semana" value={costoCompras} color={T.danger} sub="lbs compradas × costo/lb + extra" />
            <SCard label="Gastos fijos semana" value={fijosSemanal} color={T.warn} />
            <SCard label={resultadoReal>=0?'✅ Resultado real':'🔴 Resultado real'} value={Math.abs(resultadoReal)} color={resultadoReal>=0?'#15803d':T.danger} sub={resultadoReal>=0?'Semana positiva':'Pérdida esta semana'} />
          </div>
          {/* Input compras adicionales */}
          <div style={{ background:'#FFF9C4', border:'1px solid #FDE68A', borderRadius:8, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <span style={{ fontSize:'.82rem', color:'#92400E', fontWeight:600 }}>💳 Compras extra no vinculadas a producto (flete, insumos, etc.)</span>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:'.82rem', color:T.mid }}>Q</span>
              <input type="number" min="0" value={proyeccion?.comprasSemana||''} placeholder="0.00"
                onChange={e=>setProyeccion(prev=>({...prev,comprasSemana:parseFloat(e.target.value)||0}))}
                style={{ width:120, padding:'6px 8px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.86rem', textAlign:'right' }} />
            </div>
          </div>
        </>
      )}

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
              <button onClick={handleImportarWalmart} disabled={importing}
                style={{ padding:'7px 16px', background:'#1e40af', color:W, border:'none', borderRadius:6, fontWeight:700, cursor:'pointer', fontSize:'.82rem', opacity:importing?.6:1 }}>
                {importing?'Importando…':'🏪 Desde Walmart'}
              </button>
              <button onClick={()=>setModal({})} style={{ padding:'7px 16px', background:T.primary, color:W, border:'none', borderRadius:6, fontWeight:700, cursor:'pointer', fontSize:'.82rem' }}>+ Producto manual</button>
              <button onClick={handleGuardar} disabled={guardando} style={{ padding:'7px 16px', background:W, border:`1.5px solid ${T.border}`, borderRadius:6, cursor:'pointer', fontSize:'.82rem' }}>💾 {guardando?'Guardando…':'Guardar'}</button>
              <button onClick={()=>{ setReales({}); setCierreModo(true); }} style={{ padding:'7px 16px', background:'#EEF2FF', color:'#3730a3', border:'none', borderRadius:6, cursor:'pointer', fontSize:'.82rem' }}>🔒 Cerrar semana</button>
              <button onClick={handleExport} style={{ padding:'7px 16px', background:'#FFFDE7', color:'#B45309', border:'none', borderRadius:6, cursor:'pointer', fontSize:'.82rem', fontWeight:700 }}>📥 Excel</button>
            </div>
          )}
          {cerrada&&<div style={{ display:'flex', gap:8, marginBottom:14 }}>
            <button onClick={handleExport} style={{ padding:'7px 16px', background:'#FFFDE7', color:'#B45309', border:'none', borderRadius:6, cursor:'pointer', fontSize:'.82rem', fontWeight:700 }}>📥 Descargar Excel</button>
          </div>}

          {loading&&<div style={{ padding:40, textAlign:'center', color:T.mid }}>Cargando…</div>}
          {!loading&&proyeccion?.productos?.length===0&&!cerrada&&(
            <div style={{ background:'#EEF2FF', border:'1px dashed #6366f1', borderRadius:8, padding:'24px', textAlign:'center', color:'#4338ca', marginBottom:16 }}>
              <div style={{ fontWeight:700, marginBottom:6 }}>Sin productos esta semana</div>
              <div style={{ fontSize:'.84rem' }}>Presiona <b>🏪 Desde Walmart</b> para importar los pedidos automáticamente</div>
            </div>
          )}
          {!loading&&(
            <>
              <div style={{ background:W, borderRadius:10, border:`1px solid ${T.border}`, overflow:'auto', marginBottom:16 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:820 }}>
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
                        <td style={{ padding:'10px', textAlign:'right', fontWeight:700 }}>{totalLbsProy.toFixed(0)}</td>
                        <td colSpan={4} />
                        <td style={{ padding:'10px', textAlign:'right', fontWeight:800, fontSize:'1rem', color:totalContrib>fijosSemanal?'#15803d':T.danger }}>{fmtQ(totalContrib)}</td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
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
              {['Semana','Período','Contribución','Ingresos Reales','Costo Compras','Resultado Real','Cobertura','Estado'].map(h=>(
                <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'.74rem', fontWeight:700, textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {historial.map((h,i)=>{
                const hFilas = (h.productos||[]).map(p => {
                  const base=productosMap[p.productoId]||{};
                  const m={...base,...p,precioVenta:p.precioVenta??base.precioVenta??0,costo:p.costo??base.costo??0,descuentoPct:p.descuentoPct??base.descuentoPct??0,ivaRetPct:p.ivaRetPct??base.ivaRetPct??85.71};
                  return calcRow(m);
                });
                const hp  = hFilas.reduce((s,p)=>s+p.totalSemana,0);
                const ing = hFilas.reduce((s,p)=>s+p.ingresosNetos,0);
                const cmp = hFilas.reduce((s,p)=>s+p.costoCompras,0)+(h.comprasSemana||0);
                const res = ing - cmp - fijosSemanal;
                const cob = fijosSemanal>0?(hp/fijosSemanal*100):0;
                const tenReal = hFilas.some(p=>p.totalLbsReales>0);
                return (
                  <tr key={h.id} style={{ background:i%2===0?W:'#F9FAFB', borderBottom:`1px solid ${T.border}`, cursor:'pointer' }} onClick={()=>{setSemana(h.semana);setTab('proyeccion');}}>
                    <td style={{ padding:'10px 12px', fontWeight:700 }}>{h.semana}</td>
                    <td style={{ padding:'10px 12px', color:T.mid, fontSize:'.82rem' }}>{h.lunes} – {h.domingo}</td>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace' }}>{fmtQ(hp)}</td>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace', color:'#15803d' }}>{tenReal?fmtQ(ing):'—'}</td>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace', color:T.danger }}>{tenReal?fmtQ(cmp):'—'}</td>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace', fontWeight:700, color:res>=0?'#15803d':T.danger }}>{tenReal?fmtQ(res):'—'}</td>
                    <td style={{ padding:'10px 12px', color:cob>=100?'#15803d':T.danger, fontWeight:600 }}>{cob.toFixed(0)}%</td>
                    <td style={{ padding:'10px 12px' }}><span style={{ padding:'3px 10px', borderRadius:100, fontSize:'.72rem', fontWeight:700, background:h.estado==='cerrada'?'#F3F4F6':'#E8F5E9', color:h.estado==='cerrada'?T.mid:'#15803d' }}>{h.estado==='cerrada'?'🔒':'🟢'} {h.estado}</span></td>
                  </tr>
                );
              })}
              {historial.length===0&&<tr><td colSpan={8} style={{ padding:24, textAlign:'center', color:T.mid }}>Sin semanas cerradas aún.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal!==null&&<ProductoModal item={modal.item} productosDB={productosDB} existingIds={existingIds} onSave={addOrEdit} onClose={()=>setModal(null)} />}

      {cierreModo&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:W, borderRadius:12, padding:24, width:'100%', maxWidth:460, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ fontWeight:800, fontSize:'1rem', marginBottom:4, color:T.dark }}>🔒 Cerrar semana {semana}</div>
            <div style={{ fontSize:'.8rem', color:T.mid, marginBottom:16 }}>Ingresa cajas <b>vendidas</b> y cajas <b>compradas</b> por producto</div>
            {(proyeccion?.productos||[]).map(p=>(
              <div key={p.productoId} style={{ marginBottom:12, padding:'10px 12px', background:'#F9FAFB', borderRadius:6 }}>
                <div style={{ fontWeight:700, fontSize:'.86rem', color:T.dark, marginBottom:8 }}>{productosMap[p.productoId]?.nombre||p.nombre}</div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  <div>
                    <div style={{ fontSize:'.72rem', color:T.mid, fontWeight:700, marginBottom:3 }}>CAJAS VENDIDAS (real)</div>
                    <input type="number" min="0" value={reales[p.productoId]?.vendidas??''} placeholder={`Proy: ${p.cajasProyectadas}`}
                      onChange={e=>setReales(r=>({...r,[p.productoId]:{...r[p.productoId],vendidas:parseFloat(e.target.value)||0}}))}
                      style={{ width:100, padding:'6px 8px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.86rem', textAlign:'right' }} />
                  </div>
                  <div>
                    <div style={{ fontSize:'.72rem', color:T.mid, fontWeight:700, marginBottom:3 }}>CAJAS COMPRADAS</div>
                    <input type="number" min="0" value={reales[p.productoId]?.compradas??''} placeholder={`Proy: ${p.cajasCompradas||p.cajasProyectadas}`}
                      onChange={e=>setReales(r=>({...r,[p.productoId]:{...r[p.productoId],compradas:parseFloat(e.target.value)||0}}))}
                      style={{ width:100, padding:'6px 8px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.86rem', textAlign:'right' }} />
                  </div>
                </div>
              </div>
            ))}
            <div style={{ marginTop:4, marginBottom:12 }}>
              <div style={{ fontSize:'.74rem', color:T.mid, fontWeight:700, marginBottom:4 }}>COMPRAS ADICIONALES (flete, insumos, etc.) Q</div>
              <input type="number" min="0" value={proyeccion?.comprasSemana||''} placeholder="0.00"
                onChange={e=>setProyeccion(prev=>({...prev,comprasSemana:parseFloat(e.target.value)||0}))}
                style={{ width:160, padding:'7px 10px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.86rem', textAlign:'right' }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>handleCerrar()} disabled={guardando} style={{ flex:1, padding:10, background:'#3730a3', color:W, border:'none', borderRadius:6, fontWeight:700, cursor:'pointer' }}>
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
