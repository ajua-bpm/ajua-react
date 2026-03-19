import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28', acc:'#4A9E6A', sand:'#E8DCC8', danger:'#c0392b', bg:'#F9F6EF', warn:'#e67e22' };
const today = () => new Date().toISOString().slice(0,10);

const UNIDADES = ['lb','kg','caja','bandeja','unidad','saco','barril'];
const MOVS = ['entrada','salida','ajuste','merma'];
const MOV_COLOR = { entrada:C.acc, salida:C.warn, ajuste:'#2980b9', merma:C.danger };

export default function StockVivo() {
  const toast = useToast();

  const { data: productos, loading: lp } = useCollection('iProductos', { orderField:'nombre', orderDir:'asc', limit:200 });
  const { data: movimientos, loading: lm } = useCollection('stockMovs', { orderField:'fecha', orderDir:'desc', limit:300 });
  const { add: addProd, saving: savProd } = useWrite('iProductos');
  const { add: addMov,  saving: savMov  } = useWrite('stockMovs');

  const [tab, setTab] = useState('stock');
  const [formProd, setFormProd] = useState({ nombre:'', unidad:'lb', stockMin:'' });
  const [formMov, setFormMov]   = useState({ fecha:today(), productoId:'', tipo:'entrada', cantidad:'', obs:'' });
  const [buscar, setBuscar] = useState('');

  // Calcular stock actual por producto
  const stockActual = {};
  for(const m of movimientos) {
    if(!m.productoId) continue;
    const qty = Number(m.cantidad)||0;
    if(!stockActual[m.productoId]) stockActual[m.productoId] = 0;
    if(m.tipo==='entrada')       stockActual[m.productoId] += qty;
    else if(m.tipo==='salida')   stockActual[m.productoId] -= qty;
    else if(m.tipo==='ajuste')   stockActual[m.productoId]  = qty;
    else if(m.tipo==='merma')    stockActual[m.productoId] -= qty;
  }

  const prodFiltrados = productos.filter(p =>
    !buscar || p.nombre?.toLowerCase().includes(buscar.toLowerCase())
  );

  const handleSaveProd = async () => {
    if(!formProd.nombre) { toast('⚠ Nombre requerido','error'); return; }
    await addProd({ ...formProd, stockMin: Number(formProd.stockMin)||0 });
    toast('✓ Producto agregado');
    setFormProd({ nombre:'', unidad:'lb', stockMin:'' });
  };

  const handleSaveMov = async () => {
    if(!formMov.productoId || !formMov.cantidad) { toast('⚠ Producto y cantidad requeridos','error'); return; }
    const prod = productos.find(p=>p.id===formMov.productoId);
    await addMov({ ...formMov, cantidad:Number(formMov.cantidad), productoNombre: prod?.nombre||'' });
    toast('✓ Movimiento registrado');
    setFormMov(f=>({...f, productoId:'', cantidad:'', obs:''}));
  };

  if(lp||lm) return <LoadingSpinner/>;

  const productosConStock = prodFiltrados.map(p => ({
    ...p,
    stock: stockActual[p.id] || 0,
    bajo: (stockActual[p.id]||0) < (Number(p.stockMin)||0),
  }));

  const bajoStock = productosConStock.filter(p=>p.bajo).length;

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>📦 Stock en Vivo</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:16}}>Inventario en tiempo real — entradas, salidas y stock mínimo</p>

      {bajoStock>0&&(
        <div style={{background:'rgba(192,57,43,.08)',border:`1px solid rgba(192,57,43,.25)`,borderRadius:8,padding:'10px 16px',marginBottom:16,fontSize:'.82rem',color:C.danger,fontWeight:600}}>
          ⚠ {bajoStock} producto{bajoStock>1?'s':''} bajo stock mínimo
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:0,marginBottom:16,border:`1px solid ${C.sand}`,borderRadius:8,overflow:'hidden',background:'#fff'}}>
        {[{id:'stock',label:'📊 Stock actual'},{id:'mov',label:'📝 Registrar movimiento'},{id:'prod',label:'⚙ Productos'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1,padding:'11px 8px',border:'none',fontWeight:700,fontSize:'.8rem',cursor:'pointer',
            background:tab===t.id?C.green:'#fff', color:tab===t.id?'#fff':'#6B8070',
          }}>{t.label}</button>
        ))}
      </div>

      {/* STOCK ACTUAL */}
      {tab==='stock'&&(
        <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
          <div style={{marginBottom:12}}>
            <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar producto..."
              style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10}}>
            {productosConStock.map(p=>(
              <div key={p.id} style={{
                border:`1.5px solid ${p.bajo?C.danger:C.sand}`,borderRadius:8,padding:'14px 12px',
                background:p.bajo?'rgba(192,57,43,.04)':'#fff',
              }}>
                <div style={{fontWeight:700,fontSize:'.85rem',color:C.green,marginBottom:4}}>{p.nombre}</div>
                <div style={{fontSize:'1.6rem',fontWeight:800,color:p.bajo?C.danger:C.acc,lineHeight:1}}>
                  {p.stock.toLocaleString()}
                </div>
                <div style={{fontSize:'.72rem',color:'#6B8070',marginTop:2}}>{p.unidad||'unid'}</div>
                {p.stockMin>0&&(
                  <div style={{fontSize:'.68rem',marginTop:4,color:p.bajo?C.danger:'#9aaa9e'}}>
                    Mín: {p.stockMin} {p.bajo?'⚠':''}
                  </div>
                )}
              </div>
            ))}
            {productosConStock.length===0&&<div style={{gridColumn:'1/-1',textAlign:'center',padding:'40px',color:'#9aaa9e'}}>Sin productos</div>}
          </div>
        </div>
      )}

      {/* REGISTRAR MOVIMIENTO */}
      {tab==='mov'&&(
        <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
          <div style={{fontWeight:700,color:C.green,marginBottom:14}}>Nuevo Movimiento</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:12}}>
            <label style={LS}>Fecha<input type="date" value={formMov.fecha} onChange={e=>setFormMov(f=>({...f,fecha:e.target.value}))} style={IS}/></label>
            <label style={LS}>Producto
              <select value={formMov.productoId} onChange={e=>setFormMov(f=>({...f,productoId:e.target.value}))} style={IS}>
                <option value="">— Seleccionar —</option>
                {productos.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            <label style={LS}>Tipo
              <select value={formMov.tipo} onChange={e=>setFormMov(f=>({...f,tipo:e.target.value}))} style={{...IS,color:MOV_COLOR[formMov.tipo],fontWeight:700}}>
                {MOVS.map(m=><option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
              </select>
            </label>
            <label style={LS}>Cantidad
              <input type="number" value={formMov.cantidad} onChange={e=>setFormMov(f=>({...f,cantidad:e.target.value}))} min="0" step="0.01" style={IS}/>
            </label>
          </div>
          <textarea value={formMov.obs} onChange={e=>setFormMov(f=>({...f,obs:e.target.value}))} placeholder="Motivo, proveedor, destino..." rows={2}
            style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical',marginBottom:12}}/>
          <button onClick={handleSaveMov} disabled={savMov} style={{padding:'12px 28px',background:savMov?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:savMov?'not-allowed':'pointer'}}>
            {savMov?'Guardando...':'Registrar Movimiento'}
          </button>

          {/* Últimos movimientos */}
          <div style={{marginTop:20,fontWeight:700,color:C.green,marginBottom:10}}>Últimos movimientos</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {movimientos.slice(0,20).map(m=>(
              <div key={m.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:C.bg,borderRadius:6,fontSize:'.8rem'}}>
                <span style={{fontWeight:700,color:MOV_COLOR[m.tipo]||'#555',minWidth:60}}>{m.tipo}</span>
                <span style={{flex:1,fontWeight:600}}>{m.productoNombre||m.productoId}</span>
                <span style={{fontWeight:700}}>{m.cantidad} {productos.find(p=>p.id===m.productoId)?.unidad||''}</span>
                <span style={{color:'#9aaa9e',fontSize:'.72rem'}}>{m.fecha}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PRODUCTOS */}
      {tab==='prod'&&(
        <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
          <div style={{fontWeight:700,color:C.green,marginBottom:14}}>Agregar Producto</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:12}}>
            <label style={LS}>Nombre *<input value={formProd.nombre} onChange={e=>setFormProd(f=>({...f,nombre:e.target.value}))} style={IS}/></label>
            <label style={LS}>Unidad
              <select value={formProd.unidad} onChange={e=>setFormProd(f=>({...f,unidad:e.target.value}))} style={IS}>
                {UNIDADES.map(u=><option key={u}>{u}</option>)}
              </select>
            </label>
            <label style={LS}>Stock mínimo
              <input type="number" value={formProd.stockMin} onChange={e=>setFormProd(f=>({...f,stockMin:e.target.value}))} min="0" style={IS}/>
            </label>
          </div>
          <button onClick={handleSaveProd} disabled={savProd} style={{padding:'10px 24px',background:savProd?'#ccc':C.acc,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.85rem',cursor:savProd?'not-allowed':'pointer'}}>
            + Agregar
          </button>

          <div style={{marginTop:20}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
              <thead><tr style={{background:C.bg}}>
                {['Nombre','Unidad','Stock mín.','Stock actual'].map(h=>(
                  <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {productos.map(p=>(
                  <tr key={p.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                    <td style={{padding:'7px 10px',fontWeight:600}}>{p.nombre}</td>
                    <td style={{padding:'7px 10px',color:'#6B8070'}}>{p.unidad}</td>
                    <td style={{padding:'7px 10px',color:'#6B8070'}}>{p.stockMin||0}</td>
                    <td style={{padding:'7px 10px',fontWeight:700,color:(stockActual[p.id]||0)<(p.stockMin||0)?C.danger:C.acc}}>
                      {stockActual[p.id]||0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const LS = { display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:'#4A9E6A',letterSpacing:'.06em' };
const IS = { padding:'9px 12px',border:'1.5px solid #E8DCC8',borderRadius:4,fontSize:'.85rem',outline:'none',fontFamily:'inherit',width:'100%',marginTop:2 };
