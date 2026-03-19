import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF' };
const today = () => new Date().toISOString().slice(0,10);

export default function EntradaBodega() {
  const toast = useToast();
  const { data, loading } = useCollection('ientradas', { orderField:'fecha', orderDir:'desc', limit:300 });
  const { data: proveedores } = useCollection('proveedores', { orderField:'nombre', limit:200 });
  const { data: productos } = useCollection('iProductos', { orderField:'nombre', limit:200 });
  const { add, saving } = useWrite('ientradas');

  const [form, setForm] = useState({
    fecha: today(), hora: '', producto: '', cantidad: '',
    unidad: 'lb', proveedor: '', lote: '', precio: '',
    responsable: '', obs: '',
  });

  const handleSave = async () => {
    if (!form.fecha || !form.producto || !form.cantidad) {
      toast('⚠ Fecha, producto y cantidad requeridos', 'error'); return;
    }
    await add({ ...form, cantidad: parseFloat(form.cantidad)||0, precio: parseFloat(form.precio)||0 });
    toast('✓ Entrada registrada');
    setForm(f => ({ ...f, producto:'', cantidad:'', lote:'', precio:'', responsable:'', obs:'' }));
  };

  if (loading) return <LoadingSpinner/>;

  const total = data.reduce((s,r)=>s+(parseFloat(r.cantidad)||0),0);

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>📥 Ingresos a Bodega</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Registro de entradas de producto a bodega</p>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:20}}>
        {[
          { label:'Entradas hoy', val: data.filter(r=>r.fecha===today()).length, color:C.acc },
          { label:'Total registros', val: data.length, color:C.green },
          { label:'Total unidades (lb)', val: total.toLocaleString(), color:'#2980b9' },
        ].map(({label,val,color})=>(
          <div key={label} style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:16,textAlign:'center'}}>
            <div style={{fontSize:'1.6rem',fontWeight:800,color}}>{val}</div>
            <div style={{fontSize:'.75rem',color:'#6B8070',marginTop:2}}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:16}}>Nueva Entrada</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:16}}>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Fecha
            <input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Hora
            <input type="time" value={form.hora} onChange={e=>setForm(f=>({...f,hora:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
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
              {['lb','kg','caja','unidad','quintal','tonelada'].map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Proveedor
            <select value={form.proveedor} onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              <option value="">— Seleccionar —</option>
              {(proveedores||[]).map(p=><option key={p.id} value={p.nombre}>{p.nombre}</option>)}
            </select>
          </label>
          {[['lote','Lote / Guía'],['precio','Precio unitario (Q)'],['responsable','Responsable']].map(([id,label])=>(
            <label key={id} style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              {label}
              <input value={form[id]} onChange={e=>setForm(f=>({...f,[id]:e.target.value}))}
                style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
            </label>
          ))}
        </div>
        <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))}
          placeholder="Observaciones..." rows={2}
          style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical'}}/>
        <button onClick={handleSave} disabled={saving}
          style={{marginTop:12,padding:'12px 28px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer'}}>
          {saving?'Guardando...':'Registrar Entrada'}
        </button>
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{fontWeight:700,marginBottom:12,color:C.green}}>Historial ({data.length})</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Fecha','Producto','Cantidad','Unidad','Proveedor','Lote','Precio','Responsable'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.slice(0,60).map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.fecha}</td>
                  <td style={{padding:'7px 10px'}}>{r.producto||'—'}</td>
                  <td style={{padding:'7px 10px',fontWeight:600,color:C.acc}}>{r.cantidad?.toLocaleString()}</td>
                  <td style={{padding:'7px 10px'}}>{r.unidad||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.proveedor||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.lote||'—'}</td>
                  <td style={{padding:'7px 10px'}}>Q {(r.precio||0).toFixed(2)}</td>
                  <td style={{padding:'7px 10px'}}>{r.responsable||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
