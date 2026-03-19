import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF',warn:'#e67e22' };
const today = () => new Date().toISOString().slice(0,10);

const BLANK = { fecha:today(), cliente:'', producto:'', cantidad:'', unidad:'lb', precioMaquila:'', estado:'pendiente', obs:'' };
const ESTADOS = { pendiente:'⏳ Pendiente', procesando:'⚙️ Procesando', entregado:'✓ Entregado', cobrado:'💰 Cobrado' };

export default function Maquila() {
  const toast = useToast();
  const { data, loading } = useCollection('maquila', { orderField:'fecha', orderDir:'desc', limit:200 });
  const { data: clientes } = useCollection('clientes', { orderField:'nombre', limit:200 });
  const { data: productos } = useCollection('iProductos', { orderField:'nombre', limit:200 });
  const { add, update, saving } = useWrite('maquila');

  const [form, setForm] = useState({ ...BLANK });
  const [editId, setEditId] = useState(null);

  const total = () => (parseFloat(form.cantidad)||0) * (parseFloat(form.precioMaquila)||0);

  const handleSave = async () => {
    if (!form.fecha || !form.cliente || !form.producto) {
      toast('⚠ Fecha, cliente y producto requeridos','error'); return;
    }
    const t = total();
    if (editId) {
      await update(editId, { ...form, total:t }); toast('✓ Actualizado'); setEditId(null);
    } else {
      await add({ ...form, total:t }); toast('✓ Maquila registrada');
    }
    setForm({ ...BLANK });
  };

  const startEdit = (r) => {
    setForm({ fecha:r.fecha||today(), cliente:r.cliente||'', producto:r.producto||'',
      cantidad:r.cantidad||'', unidad:r.unidad||'lb', precioMaquila:r.precioMaquila||'',
      estado:r.estado||'pendiente', obs:r.obs||'' });
    setEditId(r.id);
  };

  const cambiarEstado = async (id, estado) => {
    await update(id, { estado }); toast(`✓ ${ESTADOS[estado]}`);
  };

  if (loading) return <LoadingSpinner/>;

  const totalFacturado = data.filter(r=>r.estado!=='cancelado').reduce((s,r)=>s+(r.total||0),0);

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>⚙️ Gastos Generales / Maquila</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Registro de trabajos de maquila y procesamiento</p>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
        {[
          {label:'Total facturado',val:`Q ${totalFacturado.toFixed(2)}`,color:C.acc},
          {label:'Pendientes',val:data.filter(r=>r.estado==='pendiente').length,color:C.warn},
          {label:'Total registros',val:data.length,color:C.green},
        ].map(({label,val,color})=>(
          <div key={label} style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:16,textAlign:'center'}}>
            <div style={{fontSize:'1.4rem',fontWeight:800,color}}>{val}</div>
            <div style={{fontSize:'.75rem',color:'#6B8070',marginTop:2}}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:16}}>{editId?'Editar':'Nuevo registro maquila'}</div>
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
            Producto
            <select value={form.producto} onChange={e=>setForm(f=>({...f,producto:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              <option value="">— Seleccionar —</option>
              {(productos||[]).map(p=><option key={p.id} value={p.nombre}>{p.nombre}</option>)}
            </select>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Cantidad
            <input type="number" min="0" value={form.cantidad} onChange={e=>setForm(f=>({...f,cantidad:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Unidad
            <select value={form.unidad} onChange={e=>setForm(f=>({...f,unidad:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              {['lb','kg','caja','unidad','quintal'].map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Precio maquila (Q/u)
            <input type="number" min="0" value={form.precioMaquila} onChange={e=>setForm(f=>({...f,precioMaquila:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Estado
            <select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              {Object.entries(ESTADOS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <div style={{display:'flex',flexDirection:'column',gap:4,justifyContent:'flex-end'}}>
            <div style={{fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:'#6B8070',letterSpacing:'.06em'}}>Total</div>
            <div style={{padding:'9px 12px',background:C.bg,borderRadius:4,fontSize:'1rem',fontWeight:800,color:C.acc}}>
              Q {total().toFixed(2)}
            </div>
          </div>
        </div>
        <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))}
          placeholder="Observaciones..." rows={2}
          style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical'}}/>
        <div style={{display:'flex',gap:10,marginTop:12}}>
          <button onClick={handleSave} disabled={saving}
            style={{padding:'12px 28px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer'}}>
            {saving?'Guardando...':editId?'Actualizar':'Registrar'}
          </button>
          {editId&&<button onClick={()=>{setEditId(null);setForm({...BLANK});}}
            style={{padding:'12px 20px',background:'#f0f0f0',border:'none',borderRadius:6,fontWeight:600,cursor:'pointer'}}>Cancelar</button>}
        </div>
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{fontWeight:700,marginBottom:12,color:C.green}}>Historial ({data.length})</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Fecha','Cliente','Producto','Cantidad','P/U','Total','Estado','Acción'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.slice(0,60).map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.fecha}</td>
                  <td style={{padding:'7px 10px'}}>{r.cliente||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.producto||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.cantidad} {r.unidad}</td>
                  <td style={{padding:'7px 10px'}}>Q {(parseFloat(r.precioMaquila)||0).toFixed(2)}</td>
                  <td style={{padding:'7px 10px',fontWeight:700,color:C.acc}}>Q {(r.total||0).toFixed(2)}</td>
                  <td style={{padding:'7px 10px'}}>
                    <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,
                      background:`${r.estado==='cobrado'?C.acc:C.warn}20`,color:r.estado==='cobrado'?C.acc:C.warn}}>
                      {ESTADOS[r.estado]||r.estado}
                    </span>
                  </td>
                  <td style={{padding:'7px 10px'}}>
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={()=>startEdit(r)} style={{padding:'3px 8px',background:C.acc,color:'#fff',border:'none',borderRadius:3,fontSize:'.7rem',cursor:'pointer'}}>Editar</button>
                      {r.estado==='pendiente'&&<button onClick={()=>cambiarEstado(r.id,'procesando')} style={{padding:'3px 8px',background:'#8e44ad',color:'#fff',border:'none',borderRadius:3,fontSize:'.7rem',cursor:'pointer'}}>Iniciar</button>}
                      {r.estado==='procesando'&&<button onClick={()=>cambiarEstado(r.id,'entregado')} style={{padding:'3px 8px',background:'#2980b9',color:'#fff',border:'none',borderRadius:3,fontSize:'.7rem',cursor:'pointer'}}>Entregar</button>}
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
