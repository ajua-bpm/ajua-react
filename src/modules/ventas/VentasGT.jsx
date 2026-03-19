import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF',warn:'#e67e22' };
const today = () => new Date().toISOString().slice(0,10);

const BLANK_ITEM = { producto:'', cantidad:'', unidad:'lb', precioUnitario:'' };
const BLANK = { fecha:today(), cliente:'', items:[{ ...BLANK_ITEM }], estado:'pendiente', obs:'' };

const ESTADOS = { pendiente:'⏳ Pendiente', entregado:'🚛 Entregado', cobrado:'✓ Cobrado', cancelado:'✗ Cancelado' };
const EST_COLOR = { pendiente:C.warn, entregado:'#2980b9', cobrado:C.acc, cancelado:C.danger };

export default function VentasGT() {
  const toast = useToast();
  const { data, loading } = useCollection('vgtVentas', { orderField:'fecha', orderDir:'desc', limit:300 });
  const { data: clientes } = useCollection('clientes', { orderField:'nombre', limit:200 });
  const { data: productos } = useCollection('iProductos', { orderField:'nombre', limit:200 });
  const { add, update, saving } = useWrite('vgtVentas');

  const [form, setForm] = useState({ ...BLANK, items:[{ ...BLANK_ITEM }] });
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState('todos');

  const setItem = (i, field, val) => setForm(f => {
    const items = f.items.map((it,j)=>j===i?{...it,[field]:val}:it);
    return { ...f, items };
  });
  const addItem = () => setForm(f => ({ ...f, items:[...f.items,{ ...BLANK_ITEM }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items:f.items.filter((_,j)=>j!==i) }));

  const calcTotal = (items) => items.reduce((s,it)=>{
    const c=parseFloat(it.cantidad)||0; const p=parseFloat(it.precioUnitario)||0; return s+c*p;
  },0);

  const handleSave = async () => {
    if (!form.fecha || !form.cliente || form.items.length===0) {
      toast('⚠ Fecha, cliente e ítems requeridos','error'); return;
    }
    const total = calcTotal(form.items);
    if (editId) {
      await update(editId, { ...form, total });
      toast('✓ Venta actualizada'); setEditId(null);
    } else {
      await add({ ...form, total });
      toast('✓ Venta GT registrada');
    }
    setForm({ ...BLANK, items:[{ ...BLANK_ITEM }] });
  };

  const startEdit = (r) => {
    setForm({ fecha:r.fecha||today(), cliente:r.cliente||'', items:r.items||[{ ...BLANK_ITEM }], estado:r.estado||'pendiente', obs:r.obs||'' });
    setEditId(r.id);
  };

  const cambiarEstado = async (id, estado) => {
    await update(id, { estado });
    toast(`✓ Estado → ${ESTADOS[estado]}`);
  };

  if (loading) return <LoadingSpinner/>;

  const filtered = filter==='todos' ? data : data.filter(r=>r.estado===filter);
  const totVentas = data.filter(r=>r.estado!=='cancelado').reduce((s,r)=>s+(r.total||0),0);
  const pendientes = data.filter(r=>r.estado==='pendiente').length;

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>📤 Despachos — Locales GT</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Ventas y despachos en el mercado local guatemalteco</p>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
        {[
          {label:'Total ventas',val:`Q ${totVentas.toLocaleString('es-GT',{minimumFractionDigits:2})}`,color:C.acc},
          {label:'Pendientes',val:pendientes,color:C.warn},
          {label:'Registros',val:data.length,color:C.green},
        ].map(({label,val,color})=>(
          <div key={label} style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:16,textAlign:'center'}}>
            <div style={{fontSize:'1.4rem',fontWeight:800,color}}>{val}</div>
            <div style={{fontSize:'.75rem',color:'#6B8070',marginTop:2}}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:16}}>{editId?'Editar venta':'Nueva venta GT'}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:16}}>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Fecha <input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Cliente
            <select value={form.cliente} onChange={e=>setForm(f=>({...f,cliente:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              <option value="">— Seleccionar —</option>
              {(clientes||[]).map(c=><option key={c.id} value={c.nombre}>{c.nombre}</option>)}
            </select>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Estado
            <select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              {Object.entries(ESTADOS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em',marginBottom:8}}>Productos</div>
          {form.items.map((it,i)=>(
            <div key={i} style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap',alignItems:'flex-end'}}>
              <select value={it.producto} onChange={e=>setItem(i,'producto',e.target.value)}
                style={{padding:'8px 10px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.82rem',outline:'none',flex:'2 1 140px'}}>
                <option value="">— Producto —</option>
                {(productos||[]).map(p=><option key={p.id} value={p.nombre}>{p.nombre}</option>)}
              </select>
              <input type="number" min="0" placeholder="Cantidad" value={it.cantidad} onChange={e=>setItem(i,'cantidad',e.target.value)}
                style={{padding:'8px 10px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.82rem',outline:'none',flex:'1 1 80px'}}/>
              <select value={it.unidad} onChange={e=>setItem(i,'unidad',e.target.value)}
                style={{padding:'8px 10px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.82rem',outline:'none',flex:'1 1 70px'}}>
                {['lb','kg','caja','unidad'].map(u=><option key={u} value={u}>{u}</option>)}
              </select>
              <input type="number" min="0" placeholder="P/U (Q)" value={it.precioUnitario} onChange={e=>setItem(i,'precioUnitario',e.target.value)}
                style={{padding:'8px 10px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.82rem',outline:'none',flex:'1 1 80px'}}/>
              <span style={{fontSize:'.82rem',fontWeight:700,color:C.acc,minWidth:70}}>
                Q {((parseFloat(it.cantidad)||0)*(parseFloat(it.precioUnitario)||0)).toFixed(2)}
              </span>
              {form.items.length>1&&<button onClick={()=>removeItem(i)} style={{padding:'6px 10px',background:C.danger,color:'#fff',border:'none',borderRadius:4,cursor:'pointer',fontWeight:700}}>×</button>}
            </div>
          ))}
          <button onClick={addItem} style={{padding:'6px 14px',background:'#f0f0f0',border:'none',borderRadius:4,fontSize:'.8rem',fontWeight:600,cursor:'pointer'}}>+ Agregar ítem</button>
          <div style={{marginTop:10,fontSize:'1rem',fontWeight:800,color:C.green,textAlign:'right'}}>
            Total: Q {calcTotal(form.items).toFixed(2)}
          </div>
        </div>

        <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))}
          placeholder="Observaciones..." rows={2}
          style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical'}}/>
        <div style={{display:'flex',gap:10,marginTop:12}}>
          <button onClick={handleSave} disabled={saving}
            style={{padding:'12px 28px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer'}}>
            {saving?'Guardando...':editId?'Actualizar':'Registrar Venta'}
          </button>
          {editId&&<button onClick={()=>{setEditId(null);setForm({...BLANK,items:[{...BLANK_ITEM}]});}}
            style={{padding:'12px 20px',background:'#f0f0f0',border:'none',borderRadius:6,fontWeight:600,cursor:'pointer'}}>Cancelar</button>}
        </div>
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{fontWeight:700,color:C.green,flex:1}}>Historial ({filtered.length})</div>
          {['todos','pendiente','entregado','cobrado','cancelado'].map(s=>(
            <button key={s} onClick={()=>setFilter(s)} style={{padding:'5px 12px',borderRadius:20,fontSize:'.75rem',fontWeight:600,cursor:'pointer',
              border:`1.5px solid ${filter===s?C.acc:C.sand}`,background:filter===s?C.acc:'#fff',color:filter===s?'#fff':'#555'}}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Fecha','Cliente','Ítems','Total','Estado','Acciones'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.slice(0,60).map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.fecha}</td>
                  <td style={{padding:'7px 10px'}}>{r.cliente||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{(r.items||[]).length} prod.</td>
                  <td style={{padding:'7px 10px',fontWeight:700,color:C.acc}}>Q {(r.total||0).toFixed(2)}</td>
                  <td style={{padding:'7px 10px'}}>
                    <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,
                      background:`${EST_COLOR[r.estado]||C.warn}20`,color:EST_COLOR[r.estado]||C.warn}}>
                      {ESTADOS[r.estado]||r.estado}
                    </span>
                  </td>
                  <td style={{padding:'7px 10px'}}>
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={()=>startEdit(r)} style={{padding:'3px 8px',background:C.acc,color:'#fff',border:'none',borderRadius:3,fontSize:'.7rem',cursor:'pointer'}}>Editar</button>
                      {r.estado==='pendiente'&&<button onClick={()=>cambiarEstado(r.id,'entregado')} style={{padding:'3px 8px',background:'#2980b9',color:'#fff',border:'none',borderRadius:3,fontSize:'.7rem',cursor:'pointer'}}>Entregar</button>}
                      {r.estado==='entregado'&&<button onClick={()=>cambiarEstado(r.id,'cobrado')} style={{padding:'3px 8px',background:C.acc,color:'#fff',border:'none',borderRadius:3,fontSize:'.7rem',cursor:'pointer'}}>Cobrar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
