import { useState } from 'react';
import { calcLibreStd } from '../finanzas/useFinanzas';
import { calcRow } from './useProyeccion';

const T = { primary:'#1B5E20', danger:'#C62828', border:'#E0E0E0', mid:'#6B6B60', dark:'#1A1A18' };
const W = '#FFFFFF';
const fmtQ = (n,d=2) => 'Q ' + Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:d,maximumFractionDigits:d});

function semaforo(pct) { return pct >= 15 ? '#16a34a' : pct >= 8 ? '#f59e0b' : '#dc2626'; }

function mergeConBase(p, productosMap) {
  const base = productosMap[p.productoId] || {};
  return {
    ...base, ...p,
    precioVenta: p.precioVenta ?? base.precioVenta ?? 0,
    costo:       p.costo       ?? base.costo       ?? 0,
    descuentoPct:p.descuentoPct ?? base.descuentoPct ?? 0,
    ivaRetPct:   p.ivaRetPct   ?? base.ivaRetPct   ?? 85.71,
  };
}

// ── Fila Desktop ──────────────────────────────────────────────────
export function ProductoRowDesktop({ p, productosMap, onEdit, onRemove, cerrada }) {
  const m = mergeConBase(p, productosMap);
  const c = calcRow(m);
  const col = semaforo(c.margenPct);
  return (
    <tr style={{ borderBottom:`1px solid ${T.border}` }}>
      <td style={{ padding:'9px 10px', fontWeight:700 }}>
        <span style={{ display:'inline-block', width:9, height:9, borderRadius:'50%', background:col, marginRight:6 }} />
        {m.nombre}
      </td>
      <td style={{ padding:'9px 10px', textAlign:'right' }}>{p.cajasProyectadas}</td>
      <td style={{ padding:'9px 10px', textAlign:'right' }}>{p.lbsPorCaja}</td>
      <td style={{ padding:'9px 10px', textAlign:'right' }}>{p.frecuencia}x</td>
      <td style={{ padding:'9px 10px', textAlign:'right', fontWeight:600 }}>{c.totalLbs.toFixed(0)}</td>
      <td style={{ padding:'9px 10px', textAlign:'right', color:'#15803d' }}>{fmtQ(m.precioVenta)}</td>
      <td style={{ padding:'9px 10px', textAlign:'right', color:T.danger }}>{fmtQ(m.costo)}</td>
      <td style={{ padding:'9px 10px', textAlign:'right', fontWeight:700, color:c.libre>0?'#15803d':T.danger }}>{fmtQ(c.libre)}</td>
      <td style={{ padding:'9px 10px', textAlign:'right', color:col, fontWeight:700 }}>{c.margenPct.toFixed(1)}%</td>
      <td style={{ padding:'9px 10px', textAlign:'right', fontWeight:800, color:c.totalSemana>0?'#15803d':T.mid }}>{fmtQ(c.totalSemana)}</td>
      <td style={{ padding:'9px 10px' }}>
        {!cerrada && (
          <div style={{ display:'flex', gap:4 }}>
            <button onClick={()=>onEdit(p)} style={{ padding:'4px 9px', background:'#EEF2FF', color:'#3730a3', border:'none', borderRadius:4, fontSize:'.74rem', cursor:'pointer' }}>✏️</button>
            <button onClick={()=>onRemove(p.productoId)} style={{ padding:'4px 8px', background:'#FFEBEE', color:T.danger, border:'none', borderRadius:4, fontSize:'.74rem', cursor:'pointer' }}>✕</button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Card Mobile ───────────────────────────────────────────────────
export function ProductoCard({ p, productosMap, onEdit, onRemove, cerrada }) {
  const m = mergeConBase(p, productosMap);
  const c = calcRow(m);
  const col = semaforo(c.margenPct);
  return (
    <div style={{ background:W, border:`1px solid ${T.border}`, borderLeft:`4px solid ${col}`, borderRadius:8, padding:'12px 14px', marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <span style={{ fontWeight:700, color:T.dark }}>{m.nombre}</span>
        <span style={{ fontWeight:800, color:c.totalSemana>0?'#15803d':T.mid }}>{fmtQ(c.totalSemana)}</span>
      </div>
      <div style={{ fontSize:'.8rem', color:T.mid, marginTop:4 }}>
        {p.cajasProyectadas} cajas × {p.lbsPorCaja} lb × {p.frecuencia}x = <b>{c.totalLbs.toFixed(0)} lbs</b>
      </div>
      <div style={{ display:'flex', gap:12, fontSize:'.8rem', marginTop:4, flexWrap:'wrap' }}>
        <span>PV: <b style={{ color:'#15803d' }}>{fmtQ(m.precioVenta)}</b></span>
        <span>Costo: <b style={{ color:T.danger }}>{fmtQ(m.costo)}</b></span>
        <span>Libre: <b style={{ color:col }}>{fmtQ(c.libre)}/lb</b></span>
        <span style={{ color:col, fontWeight:700 }}>{c.margenPct.toFixed(1)}%</span>
      </div>
      {!cerrada && (
        <div style={{ display:'flex', gap:6, marginTop:10 }}>
          <button onClick={()=>onEdit(p)} style={{ flex:1, padding:'6px', background:'#EEF2FF', color:'#3730a3', border:'none', borderRadius:5, fontSize:'.8rem', cursor:'pointer', fontWeight:600 }}>✏️ Editar</button>
          <button onClick={()=>onRemove(p.productoId)} style={{ padding:'6px 12px', background:'#FFEBEE', color:T.danger, border:'none', borderRadius:5, fontSize:'.8rem', cursor:'pointer' }}>✕</button>
        </div>
      )}
    </div>
  );
}

// ── Modal Agregar / Editar ────────────────────────────────────────
export function ProductoModal({ item, productosDB, existingIds, onSave, onClose }) {
  const [f, setF] = useState(item || { productoId:'', nombre:'', cajasProyectadas:'', lbsPorCaja:'20', frecuencia:'1', precioVenta:'', costo:'', descuentoPct:'', ivaRetPct:'' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const base = productosDB.find(p => p.id === f.productoId) || {};

  // Auto-fill prices from productosDB when product changes
  const handleProductoChange = (pid) => {
    const b = productosDB.find(p => p.id === pid) || {};
    setF(p => ({ ...p, productoId: pid,
      lbsPorCaja:   b.lbsPorCaja  ? String(b.lbsPorCaja)   : p.lbsPorCaja,
      precioVenta:  b.precioVenta ? String(b.precioVenta)   : p.precioVenta,
      costo:        b.costo       ? String(b.costo)         : p.costo,
      descuentoPct: b.descuentoPct!==undefined ? String(b.descuentoPct) : p.descuentoPct,
      ivaRetPct:    b.ivaRetPct   ? String(b.ivaRetPct)     : p.ivaRetPct,
    }));
  };

  const merged = {
    ...base,
    precioVenta:  parseFloat(f.precioVenta)  || base.precioVenta  || 0,
    costo:        parseFloat(f.costo)        || base.costo        || 0,
    descuentoPct: parseFloat(f.descuentoPct) ?? base.descuentoPct ?? 0,
    ivaRetPct:    parseFloat(f.ivaRetPct)    || base.ivaRetPct    || 85.71,
    cajasProyectadas: parseFloat(f.cajasProyectadas)||0,
    lbsPorCaja:       parseFloat(f.lbsPorCaja)||0,
    frecuencia:       parseFloat(f.frecuencia)||1,
  };
  const c = (f.productoId && merged.precioVenta > 0) ? calcRow(merged) : null;
  const { libre, neto, ivaRet, descuento } = c ? calcLibreStd(merged) : {};

  const disponibles = productosDB.filter(p => !existingIds.includes(p.id) || p.id === f.productoId);

  const handleSave = () => {
    if (!f.productoId || !f.cajasProyectadas) return;
    onSave({
      productoId:   f.productoId,
      nombre:       base.nombre || f.nombre,
      cajasProyectadas: parseFloat(f.cajasProyectadas)||0,
      lbsPorCaja:   parseFloat(f.lbsPorCaja)||0,
      frecuencia:   parseFloat(f.frecuencia)||1,
      ...(f.precioVenta  ? { precioVenta:  parseFloat(f.precioVenta)  } : {}),
      ...(f.costo        ? { costo:        parseFloat(f.costo)        } : {}),
      ...(f.descuentoPct ? { descuentoPct: parseFloat(f.descuentoPct) } : {}),
      ...(f.ivaRetPct    ? { ivaRetPct:    parseFloat(f.ivaRetPct)    } : {}),
    });
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:W, borderRadius:12, padding:24, width:'100%', maxWidth:460, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ fontWeight:800, fontSize:'1rem', marginBottom:16, color:T.dark }}>{item ? 'Editar producto' : '+ Agregar producto'}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ fontSize:'.74rem', fontWeight:700, color:T.mid, display:'block', marginBottom:3 }}>PRODUCTO</label>
            <select value={f.productoId} onChange={e => handleProductoChange(e.target.value)}
              style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.86rem' }}>
              <option value="">Seleccionar…</option>
              {disponibles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            {[['cajasProyectadas','CAJAS/ENTREGA'],['lbsPorCaja','LB/CAJA'],['frecuencia','FREC./SEM']].map(([k,lbl]) => (
              <div key={k}>
                <label style={{ fontSize:'.74rem', fontWeight:700, color:T.mid, display:'block', marginBottom:3 }}>{lbl}</label>
                <input type="number" value={f[k]} onChange={e=>set(k,e.target.value)} min="0"
                  style={{ width:'100%', padding:'8px 9px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.86rem', boxSizing:'border-box' }} />
              </div>
            ))}
          </div>
          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:10 }}>
            <div style={{ fontSize:'.74rem', fontWeight:700, color:T.mid, marginBottom:6 }}>PRECIOS (Q / lb)</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
              {[['precioVenta','PV / lb','#15803d'],['costo','Costo / lb','#C62828'],['descuentoPct','Desc %',T.mid],['ivaRetPct','IVA Ret %',T.mid]].map(([k,lbl,color]) => (
                <div key={k}>
                  <label style={{ fontSize:'.72rem', fontWeight:700, color, display:'block', marginBottom:2 }}>{lbl}</label>
                  <input type="number" value={f[k]} onChange={e=>set(k,e.target.value)} min="0" step="0.01"
                    placeholder={k==='ivaRetPct'?'85.71':k==='descuentoPct'?'0':'0.00'}
                    style={{ width:'100%', padding:'7px 8px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.84rem', boxSizing:'border-box' }} />
                </div>
              ))}
            </div>
          </div>
          {c && (
            <div style={{ background:'#F1F8F1', border:'1px solid #A5D6A7', borderRadius:8, padding:'12px 14px', fontSize:'.82rem' }}>
              <div style={{ fontWeight:700, color:T.dark, marginBottom:8 }}>Desglose del cálculo</div>
              {[['Precio venta',`${fmtQ(merged.precioVenta)}/lb`],['÷ 1.12 (sin IVA)',`${fmtQ(merged.precioVenta/1.12)}/lb`],
                ['− IVA retenido 80%',`−${fmtQ(ivaRet)}/lb`],['− Descuento',`−${fmtQ(descuento)}/lb`],
                ['= Neto recibido',`${fmtQ(neto)}/lb`],['− Costo',`−${fmtQ(merged.costo)}/lb`]
              ].map(([l,v]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', borderBottom:'1px solid #C8E6C9' }}>
                  <span style={{ color:T.mid }}>{l}</span><span>{v}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0 2px', fontWeight:800 }}>
                <span>LIBRE/lb</span>
                <span style={{ color:libre>=0?'#15803d':T.danger }}>{fmtQ(libre)}/lb</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:'.9rem', color:'#15803d' }}>
                <span>Q SEMANA</span><span>{fmtQ(c.totalSemana)}</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:8, marginTop:16 }}>
          <button onClick={handleSave} disabled={!f.productoId||!f.cajasProyectadas}
            style={{ flex:1, padding:10, background:T.primary, color:W, border:'none', borderRadius:6, fontWeight:700, cursor:'pointer', opacity:(!f.productoId||!f.cajasProyectadas)?0.5:1 }}>
            Guardar
          </button>
          <button onClick={onClose} style={{ padding:'10px 16px', background:'#F5F5F5', border:'none', borderRadius:6, cursor:'pointer', color:T.mid }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
