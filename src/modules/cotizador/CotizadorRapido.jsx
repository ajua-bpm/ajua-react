import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF' };

const BLANK = { producto:'', costoPorLb:'', margen:'30', precioVenta:'', unidad:'lb', notas:'' };

export default function CotizadorRapido() {
  const toast = useToast();
  const { data, loading } = useCollection('cotizadorRapido', { orderField:'producto', limit:200 });
  const { add, update, remove, saving } = useWrite('cotizadorRapido');

  const [form, setForm] = useState({ ...BLANK });
  const [editId, setEditId] = useState(null);
  const [quickCalc, setQuickCalc] = useState({ costo:'', margen:'30', cantidad:'1' });

  const calcPrecioFromCostoMargen = (costo, margen) => {
    const c = parseFloat(costo)||0;
    const m = parseFloat(margen)||0;
    return c > 0 ? (c / (1 - m/100)).toFixed(4) : '';
  };

  const handleCostoChange = (val) => {
    const precio = calcPrecioFromCostoMargen(val, form.margen);
    setForm(f => ({ ...f, costoPorLb: val, precioVenta: precio }));
  };
  const handleMargenChange = (val) => {
    const precio = calcPrecioFromCostoMargen(form.costoPorLb, val);
    setForm(f => ({ ...f, margen: val, precioVenta: precio }));
  };
  const handlePrecioChange = (val) => {
    const c = parseFloat(form.costoPorLb)||0;
    const p = parseFloat(val)||0;
    const margen = c>0&&p>0 ? ((1-c/p)*100).toFixed(1) : form.margen;
    setForm(f => ({ ...f, precioVenta: val, margen }));
  };

  const handleSave = async () => {
    if (!form.producto || !form.costoPorLb) { toast('⚠ Producto y costo requeridos','error'); return; }
    const doc = { ...form, costoPorLb:parseFloat(form.costoPorLb)||0, margen:parseFloat(form.margen)||0, precioVenta:parseFloat(form.precioVenta)||0 };
    if (editId) { await update(editId, doc); toast('✓ Actualizado'); setEditId(null); }
    else { await add(doc); toast('✓ Producto guardado'); }
    setForm({ ...BLANK });
  };

  const startEdit = (r) => {
    setForm({ producto:r.producto||'', costoPorLb:String(r.costoPorLb||''), margen:String(r.margen||'30'),
      precioVenta:String(r.precioVenta||''), unidad:r.unidad||'lb', notas:r.notas||'' });
    setEditId(r.id);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar producto del cotizador?')) return;
    await remove(id); toast('Eliminado');
  };

  // Quick calc
  const qPrecio = calcPrecioFromCostoMargen(quickCalc.costo, quickCalc.margen);
  const qTotal = (parseFloat(qPrecio)||0) * (parseFloat(quickCalc.cantidad)||1);

  if (loading) return <LoadingSpinner/>;

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>💼 Cotizador Rápido</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Cálculo de precios de venta en tiempo real</p>

      {/* Calculadora rápida */}
      <div style={{background:'rgba(74,158,106,.08)',border:`1.5px solid ${C.acc}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:12}}>⚡ Calculadora rápida (sin guardar)</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:12,alignItems:'flex-end'}}>
          {[['costo','Costo (Q/lb)'],['margen','Margen (%)'],['cantidad','Cantidad (lb)']].map(([id,label])=>(
            <label key={id} style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              {label}
              <input type="number" min="0" value={quickCalc[id]} onChange={e=>setQuickCalc(q=>({...q,[id]:e.target.value}))}
                style={{padding:'9px 12px',border:`1.5px solid ${C.acc}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
            </label>
          ))}
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <div style={{fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:'#6B8070',letterSpacing:'.06em'}}>Precio venta</div>
            <div style={{padding:'9px 12px',background:'#fff',borderRadius:4,fontSize:'1rem',fontWeight:800,color:C.acc}}>
              Q {parseFloat(qPrecio||0).toFixed(4)}
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <div style={{fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:'#6B8070',letterSpacing:'.06em'}}>Total</div>
            <div style={{padding:'9px 12px',background:C.green,borderRadius:4,fontSize:'1rem',fontWeight:800,color:'#fff'}}>
              Q {qTotal.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Guardar producto */}
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:16}}>{editId?'Editar producto':'Guardar producto en cotizador'}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:16}}>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Producto
            <input value={form.producto} onChange={e=>setForm(f=>({...f,producto:e.target.value}))}
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
            Costo (Q/u)
            <input type="number" min="0" value={form.costoPorLb} onChange={e=>handleCostoChange(e.target.value)}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Margen (%)
            <input type="number" min="0" max="100" value={form.margen} onChange={e=>handleMargenChange(e.target.value)}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Precio venta (Q/u)
            <input type="number" min="0" value={form.precioVenta} onChange={e=>handlePrecioChange(e.target.value)}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'1rem',fontWeight:800,outline:'none',color:C.green}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Notas
            <input value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={handleSave} disabled={saving}
            style={{padding:'12px 28px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer'}}>
            {saving?'Guardando...':editId?'Actualizar':'Guardar'}
          </button>
          {editId&&<button onClick={()=>{setEditId(null);setForm({...BLANK});}}
            style={{padding:'12px 20px',background:'#f0f0f0',border:'none',borderRadius:6,fontWeight:600,cursor:'pointer'}}>Cancelar</button>}
        </div>
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{fontWeight:700,marginBottom:12,color:C.green}}>Productos guardados ({data.length})</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Producto','Unidad','Costo','Margen','Precio venta','Ganancia/u','Acciones'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.map(r=>{
                const ganancia = (r.precioVenta||0)-(r.costoPorLb||0);
                return (
                  <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                    <td style={{padding:'7px 10px',fontWeight:600}}>{r.producto}</td>
                    <td style={{padding:'7px 10px'}}>{r.unidad||'lb'}</td>
                    <td style={{padding:'7px 10px'}}>Q {(r.costoPorLb||0).toFixed(4)}</td>
                    <td style={{padding:'7px 10px',color:C.acc,fontWeight:700}}>{r.margen||0}%</td>
                    <td style={{padding:'7px 10px',fontWeight:800,color:C.green,fontSize:'.9rem'}}>Q {(r.precioVenta||0).toFixed(4)}</td>
                    <td style={{padding:'7px 10px',color:C.acc}}>Q {ganancia.toFixed(4)}</td>
                    <td style={{padding:'7px 10px'}}>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>startEdit(r)} style={{padding:'3px 10px',background:C.acc,color:'#fff',border:'none',borderRadius:4,fontSize:'.72rem',fontWeight:600,cursor:'pointer'}}>Editar</button>
                        <button onClick={()=>handleDelete(r.id)} style={{padding:'3px 10px',background:C.danger,color:'#fff',border:'none',borderRadius:4,fontSize:'.72rem',fontWeight:600,cursor:'pointer'}}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.length===0&&<div style={{textAlign:'center',padding:24,color:'#aaa'}}>Sin productos guardados</div>}
        </div>
      </div>
    </div>
  );
}
