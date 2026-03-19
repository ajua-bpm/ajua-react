import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useClientes } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  primary:   '#1B5E20',
  secondary: '#2E7D32',
  white:     '#FFFFFF',
  bgLight:   '#F5F5F5',
  border:    '#E0E0E0',
  textDark:  '#212121',
  textMid:   '#616161',
  danger:    '#C62828',
  warn:      '#E65100',
};

const card = { background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:20, marginBottom:20 };
const TH_S = { padding:'10px 14px', fontSize:'.75rem', textTransform:'uppercase', fontWeight:700, letterSpacing:'.06em', color:T.white, background:T.primary, textAlign:'left', whiteSpace:'nowrap' };
const TD_S = (alt) => ({ padding:'9px 14px', fontSize:'.83rem', borderBottom:'1px solid #F0F0F0', background:alt?'#F9FBF9':'#fff', color:T.textDark });
const LS   = { display:'flex', flexDirection:'column', gap:5, fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.secondary };
const IS   = { padding:'9px 12px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.85rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2, color:T.textDark, background:T.white };

const today = () => new Date().toISOString().slice(0,10);

const BLANK_ITEM = { producto:'', cantidad:'', unidad:'lb', precioUnitario:'' };
const BLANK = { fecha:today(), cliente:'', pais:'Mexico', moneda:'USD', tc:'', items:[{...BLANK_ITEM}], estado:'pendiente', obs:'' };

const EST_CFG = {
  pendiente: { color:T.warn,      bg:'rgba(230,81,0,.10)',  label:'Pendiente' },
  entregado: { color:'#1565C0',   bg:'rgba(21,101,192,.10)',label:'Entregado' },
  cobrado:   { color:T.secondary, bg:'rgba(46,125,50,.12)', label:'Cobrado'   },
  cancelado: { color:T.danger,    bg:'rgba(198,40,40,.10)', label:'Cancelado' },
};

function EstadoChip({ estado }) {
  const cfg = EST_CFG[estado]||EST_CFG.pendiente;
  return <span style={{ display:'inline-block', padding:'3px 9px', borderRadius:100, fontSize:'.7rem', fontWeight:700, background:cfg.bg, color:cfg.color }}>{cfg.label}</span>;
}

export default function VentasInt() {
  const toast = useToast();
  const { data, loading } = useCollection('vintVentas', { orderField:'fecha', orderDir:'desc', limit:300 });
  const { clientes }      = useClientes();
  const { data: productos } = useCollection('iProductos', { orderField:'nombre', limit:200 });
  const { add, update, saving } = useWrite('vintVentas');

  const [form, setForm]   = useState({...BLANK, items:[{...BLANK_ITEM}]});
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState('todos');

  const setItem = (i,field,val) => setForm(f=>({...f, items:f.items.map((it,j)=>j===i?{...it,[field]:val}:it)}));
  const addItem = () => setForm(f=>({...f, items:[...f.items,{...BLANK_ITEM}]}));
  const removeItem = i => setForm(f=>({...f, items:f.items.filter((_,j)=>j!==i)}));

  const calcTotalMoneda = items => items.reduce((s,it)=>(parseFloat(it.cantidad)||0)*(parseFloat(it.precioUnitario)||0)+s, 0);
  const calcTotalGTQ    = (items,tc) => calcTotalMoneda(items) * (parseFloat(tc)||0);

  const handleSave = async () => {
    if (!form.fecha||!form.cliente) { toast('Fecha y cliente son requeridos','error'); return; }
    const totalMoneda = calcTotalMoneda(form.items);
    const totalGTQ    = calcTotalGTQ(form.items, form.tc);
    const payload = { ...form, tc:parseFloat(form.tc)||0, total:totalMoneda, totalGTQ };
    if (editId) { await update(editId,payload); toast('Exportación actualizada'); setEditId(null); }
    else { await add(payload); toast('Exportación registrada'); }
    setForm({...BLANK, items:[{...BLANK_ITEM}]});
  };

  const startEdit = r => {
    setForm({ fecha:r.fecha||today(), cliente:r.cliente||'', pais:r.pais||'Mexico',
      moneda:r.moneda||'USD', tc:String(r.tc||''), items:r.items||[{...BLANK_ITEM}],
      estado:r.estado||'pendiente', obs:r.obs||'' });
    setEditId(r.id);
  };

  const cambiarEstado = async (id,estado) => { await update(id,{estado}); toast(`Estado actualizado`); };

  if (loading) return <Skeleton rows={6}/>;

  const filtered    = filter==='todos' ? data : data.filter(r=>r.estado===filter);
  const totVentas   = data.filter(r=>r.estado!=='cancelado').reduce((s,r)=>s+(r.total||0),0);
  const totGTQ      = data.filter(r=>r.estado!=='cancelado').reduce((s,r)=>s+(r.totalGTQ||0),0);
  const moneda      = form.moneda||'USD';

  return (
    <div style={{ fontFamily:'inherit', maxWidth:1100 }}>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:'1.45rem', fontWeight:800, color:T.primary, margin:0 }}>Despachos — Exportación Internacional</h1>
        <p style={{ fontSize:'.83rem', color:T.textMid, marginTop:4 }}>Ventas y exportaciones internacionales de vegetales</p>
      </div>

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:24 }}>
        {[
          { label:'Total ventas (USD/MXN)', val:totVentas.toLocaleString('es',{minimumFractionDigits:2}), color:T.primary  },
          { label:'Equivalente GTQ',        val:`Q ${totGTQ.toLocaleString('es-GT',{minimumFractionDigits:2})}`, color:T.secondary },
          { label:'Pendientes',             val:data.filter(r=>r.estado==='pendiente').length, color:T.warn },
          { label:'Total registros',        val:data.length, color:T.textMid },
        ].map(({label,val,color})=>(
          <div key={label} style={{ ...card, marginBottom:0, padding:'16px 20px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:'1.2rem', fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.primary, marginBottom:18, borderBottom:`2px solid ${T.primary}`, paddingBottom:8 }}>
          {editId ? 'Editar Exportación' : 'Nueva Exportación'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:14, marginBottom:14 }}>
          <label style={LS}>Fecha<input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} style={IS}/></label>
          <label style={LS}>
            Cliente *
            <select value={form.cliente} onChange={e=>setForm(f=>({...f,cliente:e.target.value}))} style={IS}>
              <option value="">— Seleccionar —</option>
              {clientes.map(c=><option key={c.id||c.nombre} value={c.nombre}>{c.nombre}</option>)}
            </select>
          </label>
          <label style={LS}>País<input value={form.pais} onChange={e=>setForm(f=>({...f,pais:e.target.value}))} placeholder="Mexico" style={IS}/></label>
          <label style={LS}>
            Moneda
            <select value={form.moneda} onChange={e=>setForm(f=>({...f,moneda:e.target.value}))} style={IS}>
              {['USD','MXN','EUR'].map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label style={LS}>TC a Q<input type="number" min="0" step="0.01" value={form.tc} onChange={e=>setForm(f=>({...f,tc:e.target.value}))} placeholder="0.00" style={IS}/></label>
          <label style={LS}>
            Estado
            <select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))} style={IS}>
              {Object.entries(EST_CFG).map(([v,c])=><option key={v} value={v}>{c.label}</option>)}
            </select>
          </label>
        </div>

        {/* Items */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.secondary, marginBottom:10 }}>Productos</div>
          {form.items.map((it,i)=>(
            <div key={i} style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap', alignItems:'flex-end' }}>
              <select value={it.producto} onChange={e=>setItem(i,'producto',e.target.value)} style={{ ...IS, flex:'2 1 160px', width:'auto', marginTop:0 }}>
                <option value="">— Producto —</option>
                {(productos||[]).map(p=><option key={p.id} value={p.nombre}>{p.nombre}</option>)}
              </select>
              <input type="number" min="0" placeholder="Cant." value={it.cantidad} onChange={e=>setItem(i,'cantidad',e.target.value)} style={{ ...IS, flex:'1 1 75px', width:'auto', marginTop:0 }}/>
              <select value={it.unidad} onChange={e=>setItem(i,'unidad',e.target.value)} style={{ ...IS, flex:'1 1 68px', width:'auto', marginTop:0 }}>
                {['lb','kg','caja','unidad'].map(u=><option key={u} value={u}>{u}</option>)}
              </select>
              <input type="number" min="0" placeholder={`P/U (${moneda})`} value={it.precioUnitario} onChange={e=>setItem(i,'precioUnitario',e.target.value)} style={{ ...IS, flex:'1 1 90px', width:'auto', marginTop:0 }}/>
              <span style={{ fontSize:'.85rem', fontWeight:700, color:T.secondary, minWidth:90, paddingBottom:2 }}>
                {moneda} {((parseFloat(it.cantidad)||0)*(parseFloat(it.precioUnitario)||0)).toFixed(2)}
              </span>
              {form.items.length>1 && <button onClick={()=>removeItem(i)} style={{ padding:'7px 11px', background:T.danger, color:T.white, border:'none', borderRadius:5, cursor:'pointer', fontWeight:800 }}>×</button>}
            </div>
          ))}
          <button onClick={addItem} style={{ padding:'6px 16px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:5, fontSize:'.8rem', fontWeight:600, cursor:'pointer', color:T.textMid }}>
            + Agregar ítem
          </button>
          <div style={{ marginTop:12, textAlign:'right' }}>
            <div style={{ fontSize:'1rem', fontWeight:800, color:T.primary }}>{moneda} {calcTotalMoneda(form.items).toFixed(2)}</div>
            {form.tc && <div style={{ fontSize:'.83rem', color:T.textMid, marginTop:2 }}>≈ Q {calcTotalGTQ(form.items,form.tc).toFixed(2)} (TC {form.tc})</div>}
          </div>
        </div>

        <label style={LS}>
          Observaciones
          <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} rows={2} style={{ ...IS, resize:'vertical' }} placeholder="Notas adicionales..."/>
        </label>
        <div style={{ display:'flex', gap:10, marginTop:16 }}>
          <button onClick={handleSave} disabled={saving} style={{ padding:'11px 28px', background:saving?'#9E9E9E':T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor:saving?'not-allowed':'pointer' }}>
            {saving?'Guardando...':editId?'Actualizar':'Registrar Exportación'}
          </button>
          {editId && <button onClick={()=>{setEditId(null);setForm({...BLANK,items:[{...BLANK_ITEM}]});}} style={{ padding:'11px 20px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, cursor:'pointer', color:T.textMid }}>Cancelar</button>}
        </div>
      </div>

      {/* Filter */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14, alignItems:'center' }}>
        <span style={{ fontSize:'.78rem', color:T.textMid, fontWeight:600 }}>Filtrar:</span>
        {[['todos','Todos'],...Object.entries(EST_CFG).map(([v,c])=>[v,c.label])].map(([val,label])=>(
          <button key={val} onClick={()=>setFilter(val)} style={{
            padding:'5px 14px', borderRadius:20, fontSize:'.76rem', fontWeight:600, cursor:'pointer',
            border:`1.5px solid ${filter===val?T.primary:T.border}`,
            background:filter===val?T.primary:T.white, color:filter===val?T.white:T.textMid,
          }}>{label}</button>
        ))}
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary, marginBottom:16 }}>Historial ({filtered.length})</div>
        {filtered.length===0 ? <div style={{ textAlign:'center', padding:'40px 0', color:T.textMid }}>Sin registros para este filtro</div> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['Fecha','Cliente','País','Items','Total (moneda)','Total Q','Estado','Acciones'].map(h=><th key={h} style={TH_S}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.slice(0,80).map((r,i)=>(
                  <tr key={r.id}>
                    <td style={{ ...TD_S(i%2===1), fontWeight:600 }}>{r.fecha}</td>
                    <td style={TD_S(i%2===1)}>{r.cliente||'—'}</td>
                    <td style={TD_S(i%2===1)}>{r.pais||'—'}</td>
                    <td style={TD_S(i%2===1)}>{(r.items||[]).length}</td>
                    <td style={{ ...TD_S(i%2===1), fontWeight:700, color:T.secondary }}>{r.moneda||'USD'} {(r.total||0).toFixed(2)}</td>
                    <td style={{ ...TD_S(i%2===1), fontWeight:700, color:T.primary }}>{r.totalGTQ?`Q ${(r.totalGTQ).toFixed(2)}`:'—'}</td>
                    <td style={TD_S(i%2===1)}><EstadoChip estado={r.estado}/></td>
                    <td style={TD_S(i%2===1)}>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        <button onClick={()=>startEdit(r)} style={{ padding:'3px 9px', background:T.primary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Editar</button>
                        {r.estado==='pendiente'  && <button onClick={()=>cambiarEstado(r.id,'entregado')} style={{ padding:'3px 9px', background:'#1565C0', color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Entregar</button>}
                        {r.estado==='entregado'  && <button onClick={()=>cambiarEstado(r.id,'cobrado')}   style={{ padding:'3px 9px', background:T.secondary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Cobrar</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
