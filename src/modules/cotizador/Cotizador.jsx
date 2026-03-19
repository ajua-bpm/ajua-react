import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF',warn:'#e67e22' };
const today = () => new Date().toISOString().slice(0,10);

// ─── COTIZACIONES TAB ────────────────────────────────────────────────────────
const BLANK_COT_ITEM = { descripcion:'', cantidad:'', unidad:'u', precioUnitario:'' };
const BLANK_COT = { fecha:today(), cliente:'', tipo:'interno', validez:'30', items:[{...BLANK_COT_ITEM}], estado:'borrador', notas:'' };

function TabCotizaciones() {
  const toast = useToast();
  const { data, loading } = useCollection('cotizaciones', { orderField:'fecha', orderDir:'desc', limit:200 });
  const { data: clientes } = useCollection('clientes', { orderField:'nombre', limit:200 });
  const { add, update, saving } = useWrite('cotizaciones');

  const [form, setForm] = useState({...BLANK_COT, items:[{...BLANK_COT_ITEM}]});
  const [editId, setEditId] = useState(null);

  const setItem = (i,field,val) => setForm(f=>({ ...f, items:f.items.map((it,j)=>j===i?{...it,[field]:val}:it) }));
  const addItem = () => setForm(f=>({...f,items:[...f.items,{...BLANK_COT_ITEM}]}));
  const removeItem = (i) => setForm(f=>({...f,items:f.items.filter((_,j)=>j!==i)}));
  const calcTotal = (items) => items.reduce((s,it)=>(parseFloat(it.cantidad)||0)*(parseFloat(it.precioUnitario)||0)+s,0);

  const handleSave = async () => {
    if (!form.cliente) { toast('⚠ Cliente requerido','error'); return; }
    const total = calcTotal(form.items);
    if (editId) { await update(editId,{...form,total}); toast('✓ Cotización actualizada'); setEditId(null); }
    else { await add({...form,total}); toast('✓ Cotización creada'); }
    setForm({...BLANK_COT,items:[{...BLANK_COT_ITEM}]});
  };

  const startEdit = (r) => {
    setForm({fecha:r.fecha||today(),cliente:r.cliente||'',tipo:r.tipo||'interno',
      validez:r.validez||'30',items:r.items||[{...BLANK_COT_ITEM}],estado:r.estado||'borrador',notas:r.notas||''});
    setEditId(r.id);
  };

  const cambiarEstado = async (id,estado) => { await update(id,{estado}); toast(`✓ Estado actualizado`); };

  const ESTADOS = {borrador:'📝 Borrador',enviada:'📤 Enviada',aprobada:'✓ Aprobada',rechazada:'✗ Rechazada',vencida:'⏰ Vencida'};
  const EST_COLOR = {borrador:'#aaa',enviada:C.warn,aprobada:C.acc,rechazada:C.danger,vencida:'#aaa'};

  if (loading) return <LoadingSpinner/>;

  return (
    <div>
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:16}}>{editId?'Editar':'Nueva cotización'}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:16}}>
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
            Tipo
            <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              <option value="interno">Interno</option>
              <option value="terceros">Terceros</option>
            </select>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Validez (días)
            <input type="number" value={form.validez} onChange={e=>setForm(f=>({...f,validez:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
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
          <div style={{fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em',marginBottom:8}}>Ítems</div>
          {form.items.map((it,i)=>(
            <div key={i} style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap',alignItems:'flex-end'}}>
              <input placeholder="Descripción" value={it.descripcion} onChange={e=>setItem(i,'descripcion',e.target.value)}
                style={{padding:'8px 10px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.82rem',outline:'none',flex:'3 1 160px'}}/>
              <input type="number" min="0" placeholder="Cant." value={it.cantidad} onChange={e=>setItem(i,'cantidad',e.target.value)}
                style={{padding:'8px 10px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.82rem',outline:'none',flex:'1 1 70px'}}/>
              <select value={it.unidad} onChange={e=>setItem(i,'unidad',e.target.value)}
                style={{padding:'8px 10px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.82rem',outline:'none',flex:'1 1 70px'}}>
                {['u','lb','kg','caja','quintal'].map(u=><option key={u} value={u}>{u}</option>)}
              </select>
              <input type="number" min="0" placeholder="Precio u" value={it.precioUnitario} onChange={e=>setItem(i,'precioUnitario',e.target.value)}
                style={{padding:'8px 10px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.82rem',outline:'none',flex:'1 1 80px'}}/>
              <span style={{fontSize:'.82rem',fontWeight:700,color:C.acc,minWidth:70}}>
                Q {((parseFloat(it.cantidad)||0)*(parseFloat(it.precioUnitario)||0)).toFixed(2)}
              </span>
              {form.items.length>1&&<button onClick={()=>removeItem(i)} style={{padding:'6px 10px',background:C.danger,color:'#fff',border:'none',borderRadius:4,cursor:'pointer',fontWeight:700}}>×</button>}
            </div>
          ))}
          <button onClick={addItem} style={{padding:'6px 14px',background:'#f0f0f0',border:'none',borderRadius:4,fontSize:'.8rem',fontWeight:600,cursor:'pointer'}}>+ Ítem</button>
          <div style={{marginTop:10,fontSize:'1rem',fontWeight:800,color:C.green,textAlign:'right'}}>Total: Q {calcTotal(form.items).toFixed(2)}</div>
        </div>
        <textarea value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="Notas / condiciones..." rows={2}
          style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical'}}/>
        <div style={{display:'flex',gap:10,marginTop:12}}>
          <button onClick={handleSave} disabled={saving}
            style={{padding:'12px 28px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer'}}>
            {saving?'Guardando...':editId?'Actualizar':'Crear cotización'}
          </button>
          {editId&&<button onClick={()=>{setEditId(null);setForm({...BLANK_COT,items:[{...BLANK_COT_ITEM}]});}}
            style={{padding:'12px 20px',background:'#f0f0f0',border:'none',borderRadius:6,fontWeight:600,cursor:'pointer'}}>Cancelar</button>}
        </div>
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{fontWeight:700,marginBottom:12,color:C.green}}>Lista de cotizaciones ({data.length})</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Fecha','Cliente','Tipo','Ítems','Total','Validez','Estado','Acciones'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.slice(0,60).map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.fecha}</td>
                  <td style={{padding:'7px 10px'}}>{r.cliente||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.tipo||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{(r.items||[]).length}</td>
                  <td style={{padding:'7px 10px',fontWeight:700,color:C.acc}}>Q {(r.total||0).toFixed(2)}</td>
                  <td style={{padding:'7px 10px'}}>{r.validez||30}d</td>
                  <td style={{padding:'7px 10px'}}>
                    <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,
                      background:`${EST_COLOR[r.estado]||'#aaa'}20`,color:EST_COLOR[r.estado]||'#aaa'}}>
                      {ESTADOS[r.estado]||r.estado}
                    </span>
                  </td>
                  <td style={{padding:'7px 10px'}}>
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={()=>startEdit(r)} style={{padding:'3px 8px',background:C.acc,color:'#fff',border:'none',borderRadius:3,fontSize:'.7rem',cursor:'pointer'}}>Editar</button>
                      {r.estado==='borrador'&&<button onClick={()=>cambiarEstado(r.id,'enviada')} style={{padding:'3px 8px',background:C.warn,color:'#fff',border:'none',borderRadius:3,fontSize:'.7rem',cursor:'pointer'}}>Enviar</button>}
                      {r.estado==='enviada'&&<button onClick={()=>cambiarEstado(r.id,'aprobada')} style={{padding:'3px 8px',background:C.acc,color:'#fff',border:'none',borderRadius:3,fontSize:'.7rem',cursor:'pointer'}}>Aprobar</button>}
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

// ─── PRODUCTOS TAB ───────────────────────────────────────────────────────────
function TabProductos() {
  const toast = useToast();
  const { data, loading } = useCollection('iproductos', { orderField:'nombre', limit:200 });
  const { add, update, remove, saving } = useWrite('iproductos');
  const [form, setForm] = useState({ nombre:'', codigo:'', categoria:'', unidad:'lb', precioBase:'', notas:'' });
  const [editId, setEditId] = useState(null);

  const handleSave = async () => {
    if (!form.nombre) { toast('⚠ Nombre requerido','error'); return; }
    const doc = { ...form, precioBase:parseFloat(form.precioBase)||0 };
    if (editId) { await update(editId,doc); toast('✓ Actualizado'); setEditId(null); }
    else { await add(doc); toast('✓ Producto guardado'); }
    setForm({ nombre:'', codigo:'', categoria:'', unidad:'lb', precioBase:'', notas:'' });
  };

  const startEdit = (r) => {
    setForm({ nombre:r.nombre||'', codigo:r.codigo||'', categoria:r.categoria||'', unidad:r.unidad||'lb', precioBase:String(r.precioBase||''), notas:r.notas||'' });
    setEditId(r.id);
  };

  if (loading) return <LoadingSpinner/>;

  return (
    <div>
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:16}}>{editId?'Editar':'Nuevo producto'}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:12}}>
          {[['nombre','Nombre *'],['codigo','Código'],['categoria','Categoría']].map(([id,label])=>(
            <label key={id} style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              {label}<input value={form[id]} onChange={e=>setForm(f=>({...f,[id]:e.target.value}))}
                style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
            </label>
          ))}
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Unidad
            <select value={form.unidad} onChange={e=>setForm(f=>({...f,unidad:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              {['lb','kg','caja','unidad','quintal'].map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Precio base (Q)
            <input type="number" min="0" value={form.precioBase} onChange={e=>setForm(f=>({...f,precioBase:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={handleSave} disabled={saving}
            style={{padding:'11px 24px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,cursor:saving?'not-allowed':'pointer'}}>
            {saving?'Guardando...':editId?'Actualizar':'Guardar'}
          </button>
          {editId&&<button onClick={()=>{setEditId(null);setForm({nombre:'',codigo:'',categoria:'',unidad:'lb',precioBase:'',notas:''}); }}
            style={{padding:'11px 18px',background:'#f0f0f0',border:'none',borderRadius:6,fontWeight:600,cursor:'pointer'}}>Cancelar</button>}
        </div>
      </div>
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{fontWeight:700,marginBottom:12,color:C.green}}>Productos ({data.length})</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Nombre','Código','Categoría','Unidad','Precio base','Acciones'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.nombre}</td>
                  <td style={{padding:'7px 10px'}}>{r.codigo||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.categoria||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.unidad||'lb'}</td>
                  <td style={{padding:'7px 10px',fontWeight:600,color:C.acc}}>Q {(r.precioBase||0).toFixed(2)}</td>
                  <td style={{padding:'7px 10px'}}>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>startEdit(r)} style={{padding:'3px 10px',background:C.acc,color:'#fff',border:'none',borderRadius:4,fontSize:'.72rem',cursor:'pointer'}}>Editar</button>
                      <button onClick={async()=>{if(confirm('¿Eliminar?'))await remove(r.id);}} style={{padding:'3px 10px',background:C.danger,color:'#fff',border:'none',borderRadius:4,fontSize:'.72rem',cursor:'pointer'}}>Eliminar</button>
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

// ─── PRESENTACIONES TAB ──────────────────────────────────────────────────────
function TabPresentaciones() {
  const toast = useToast();
  const { data, loading } = useCollection('ipresentaciones', { orderField:'nombre', limit:200 });
  const { data: prodList } = useCollection('iproductos', { orderField:'nombre', limit:200 });
  const { add, update, remove, saving } = useWrite('ipresentaciones');
  const [form, setForm] = useState({ nombre:'', producto:'', peso:'', unidad:'lb', precio:'', codigoBarras:'' });
  const [editId, setEditId] = useState(null);

  const handleSave = async () => {
    if (!form.nombre) { toast('⚠ Nombre requerido','error'); return; }
    const doc = { ...form, peso:parseFloat(form.peso)||0, precio:parseFloat(form.precio)||0 };
    if (editId) { await update(editId,doc); toast('✓ Actualizado'); setEditId(null); }
    else { await add(doc); toast('✓ Presentación guardada'); }
    setForm({ nombre:'', producto:'', peso:'', unidad:'lb', precio:'', codigoBarras:'' });
  };

  const startEdit = (r) => {
    setForm({ nombre:r.nombre||'', producto:r.producto||'', peso:String(r.peso||''),
      unidad:r.unidad||'lb', precio:String(r.precio||''), codigoBarras:r.codigoBarras||'' });
    setEditId(r.id);
  };

  if (loading) return <LoadingSpinner/>;

  return (
    <div>
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:16}}>{editId?'Editar':'Nueva presentación'}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:12}}>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Nombre * <input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Producto
            <select value={form.producto} onChange={e=>setForm(f=>({...f,producto:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              <option value="">— Seleccionar —</option>
              {(prodList||[]).map(p=><option key={p.id} value={p.nombre}>{p.nombre}</option>)}
            </select>
          </label>
          {[['peso','Peso'],['codigoBarras','Código de barras']].map(([id,label])=>(
            <label key={id} style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              {label}<input value={form[id]} onChange={e=>setForm(f=>({...f,[id]:e.target.value}))}
                style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
            </label>
          ))}
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Unidad
            <select value={form.unidad} onChange={e=>setForm(f=>({...f,unidad:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              {['lb','kg','caja','unidad'].map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Precio (Q)
            <input type="number" min="0" value={form.precio} onChange={e=>setForm(f=>({...f,precio:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={handleSave} disabled={saving}
            style={{padding:'11px 24px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,cursor:saving?'not-allowed':'pointer'}}>
            {saving?'Guardando...':editId?'Actualizar':'Guardar'}
          </button>
          {editId&&<button onClick={()=>{setEditId(null);setForm({nombre:'',producto:'',peso:'',unidad:'lb',precio:'',codigoBarras:''}); }}
            style={{padding:'11px 18px',background:'#f0f0f0',border:'none',borderRadius:6,fontWeight:600,cursor:'pointer'}}>Cancelar</button>}
        </div>
      </div>
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{fontWeight:700,marginBottom:12,color:C.green}}>Presentaciones ({data.length})</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Nombre','Producto','Peso','Unidad','Precio','Código','Acciones'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.nombre}</td>
                  <td style={{padding:'7px 10px'}}>{r.producto||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.peso||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.unidad||'lb'}</td>
                  <td style={{padding:'7px 10px',fontWeight:600,color:C.acc}}>Q {(r.precio||0).toFixed(2)}</td>
                  <td style={{padding:'7px 10px'}}>{r.codigoBarras||'—'}</td>
                  <td style={{padding:'7px 10px'}}>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>startEdit(r)} style={{padding:'3px 10px',background:C.acc,color:'#fff',border:'none',borderRadius:4,fontSize:'.72rem',cursor:'pointer'}}>Editar</button>
                      <button onClick={async()=>{if(confirm('¿Eliminar?'))await remove(r.id);}} style={{padding:'3px 10px',background:C.danger,color:'#fff',border:'none',borderRadius:4,fontSize:'.72rem',cursor:'pointer'}}>Eliminar</button>
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

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const TABS = [
  { id:'cotizaciones', label:'📋 Cotizaciones', Component: TabCotizaciones },
  { id:'productos',    label:'🏷️ Productos',    Component: TabProductos    },
  { id:'presentaciones', label:'📦 Presentaciones', Component: TabPresentaciones },
];

export default function Cotizador() {
  const [tab, setTab] = useState('cotizaciones');
  const Active = TABS.find(t=>t.id===tab).Component;

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>📋 Cotizador</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:16}}>Cotizaciones, productos y presentaciones</p>

      <div style={{display:'flex',gap:4,marginBottom:20,borderBottom:`2px solid ${C.sand}`,paddingBottom:0}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'9px 18px',border:'none',borderRadius:'6px 6px 0 0',fontWeight:700,fontSize:'.82rem',cursor:'pointer',
            background:tab===t.id?C.green:'transparent',
            color:tab===t.id?'#fff':'#6B8070',
            borderBottom:tab===t.id?'none':'2px solid transparent',
            marginBottom:tab===t.id?'-2px':0,
          }}>{t.label}</button>
        ))}
      </div>

      <Active/>
    </div>
  );
}
