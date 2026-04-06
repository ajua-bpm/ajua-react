import { useState, useEffect } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useAuth } from '../../hooks/useAuth';
import { db, doc, getDoc, setDoc } from '../../firebase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28', acc:'#4A9E6A', sand:'#E8DCC8', danger:'#c0392b', bg:'#F9F6EF' };

const AREAS_EMP = ['Maquila','Bodega','Transporte / Piloto','Administración','Supervisión','Limpieza','Ventas','Otro'];

const MODULOS = [
  { id:'dashboard',         label:'Dashboard' },
  { id:'tl',               label:'Limpieza Transporte' },
  { id:'dt',               label:'Despacho Transporte' },
  { id:'al',               label:'Acceso y Lavado' },
  { id:'bas',              label:'Básculas' },
  { id:'rod',              label:'Roedores' },
  { id:'limp',             label:'Limpieza Bodega' },
  { id:'vyp',              label:'Vidrio y Plástico' },
  { id:'fumigacion',       label:'Fumigación' },
  { id:'croquis',          label:'Croquis Bodega' },
  { id:'lavado-prod',      label:'Lavado Producto' },
  { id:'capacitacion',     label:'Capacitación' },
  { id:'enfermos',         label:'Empleados Enfermos' },
  { id:'visitas',          label:'Control Visitas' },
  { id:'control-personal', label:'Control Personal' },
  { id:'cloro',            label:'Control Cloro' },
  { id:'temperatura',      label:'Temperatura' },
  { id:'stock',            label:'Stock en Vivo' },
  { id:'entrada',          label:'Ingresos Bodega' },
  { id:'salida',           label:'Ventas Walmart' },
  { id:'proveedores',      label:'Proveedores' },
  { id:'walmart',          label:'Pedidos Walmart' },
  { id:'ventas-gt',        label:'Despachos GT' },
  { id:'ventas-int',       label:'Exportación' },
  { id:'gastos',           label:'Gastos Diarios' },
  { id:'anticipos',        label:'Anticipos MX' },
  { id:'cotizador-rapido', label:'Cotizador Rápido' },
  { id:'cotizador',        label:'Cotizador' },
  { id:'precios',          label:'Lista de Precios' },
  { id:'personal',         label:'Personal' },
  { id:'guatecompras',     label:'Guatecompras' },
  { id:'reportes',         label:'Reportes' },
  { id:'cuentas-proveedores', label:'Cuentas Proveedores' },
];

const LS = { display:'flex',flexDirection:'column',gap:3,fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',color:'#4A9E6A',letterSpacing:'.06em' };
const IS = { padding:'8px 10px',border:'1.5px solid #E8DCC8',borderRadius:4,fontSize:'.83rem',outline:'none',fontFamily:'inherit',width:'100%',marginTop:2 };

// ─── Generic CRUD table ────────────────────────────────────────────────────────
function CrudTable({ saving, onAdd, form, setForm, fields, data, cols, row, onDelete }) {
  return (
    <div>
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:16}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:10}}>
          {fields.map(({id,label,type='text'})=>(
            <label key={id} style={LS}>
              {label}
              <input type={type} value={form[id]||''} onChange={e=>setForm(f=>({...f,[id]:e.target.value}))} style={IS}/>
            </label>
          ))}
        </div>
        <button onClick={onAdd} disabled={saving} style={{padding:'10px 24px',background:saving?'#ccc':C.acc,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.85rem',cursor:saving?'not-allowed':'pointer'}}>
          + Agregar
        </button>
      </div>
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {[...cols,''].map((h,i)=>(
                <th key={i} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  {row(r).map((v,i)=><td key={i} style={{padding:'7px 10px',fontWeight:i===0?600:400,color:i===0?C.green:'#6B8070'}}>{v}</td>)}
                  <td style={{padding:'7px 10px'}}>
                    <button onClick={()=>onDelete(r.id)} style={{padding:'3px 10px',background:'rgba(192,57,43,.1)',color:C.danger,border:`1px solid ${C.danger}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✕</button>
                  </td>
                </tr>
              ))}
              {data.length===0&&<tr><td colSpan={cols.length+1} style={{textAlign:'center',padding:'30px',color:'#9aaa9e'}}>Sin registros</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Proveedores ──────────────────────────────────────────────────────────
function TabProveedores() {
  const toast = useToast();
  const { data, loading } = useCollection('proveedores', { orderField:'nombre', limit:300 });
  const { add, update, remove, saving } = useWrite('proveedores');

  const BLANK = { nombre:'', contacto:'', telefono:'', nit:'', productos:'', obs:'' };
  const [form, setForm]     = useState({...BLANK});
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast('Nombre requerido','error'); return; }
    if (editId) { await update(editId, form); toast('✓ Proveedor actualizado'); }
    else        { await add(form);            toast('✓ Proveedor agregado'); }
    setForm({...BLANK}); setEditId(null);
  };

  const filtered = data.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.nombre||'').toLowerCase().includes(q)
        || (r.contacto||'').toLowerCase().includes(q)
        || (r.productos||'').toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:16,borderLeft:`4px solid ${editId?'#E65100':C.acc}`}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:12}}>{editId?'Editar proveedor':'Nuevo proveedor'}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:10}}>
          <label style={LS}>Nombre *<input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} style={IS}/></label>
          <label style={LS}>NIT<input value={form.nit||''} onChange={e=>setForm(f=>({...f,nit:e.target.value}))} style={IS}/></label>
          <label style={LS}>Contacto<input value={form.contacto} onChange={e=>setForm(f=>({...f,contacto:e.target.value}))} style={IS}/></label>
          <label style={LS}>Teléfono<input value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))} style={IS}/></label>
          <label style={LS}>Productos que provee<input value={form.productos} onChange={e=>setForm(f=>({...f,productos:e.target.value}))} style={IS}/></label>
        </div>
        <label style={{...LS,marginBottom:12}}>Observaciones
          <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} rows={2} style={{...IS,resize:'vertical'}}/>
        </label>
        <div style={{display:'flex',gap:10}}>
          <button onClick={handleSave} disabled={saving} style={{padding:'10px 24px',background:saving?'#ccc':(editId?'#E65100':C.acc),color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.85rem',cursor:saving?'not-allowed':'pointer'}}>
            {saving?'Guardando…':editId?'Actualizar':'+ Agregar'}
          </button>
          {editId&&<button onClick={()=>{setForm({...BLANK});setEditId(null);}} style={{padding:'10px 18px',background:'transparent',border:`1px solid ${C.sand}`,borderRadius:6,fontWeight:600,fontSize:'.85rem',cursor:'pointer',color:'#6B8070'}}>Cancelar</button>}
        </div>
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,gap:10,flexWrap:'wrap'}}>
          <div style={{fontWeight:700,color:C.green}}>Proveedores ({filtered.length}{search?` de ${data.length}`:''})</div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar…" style={{...IS,width:220,marginTop:0}}/>
        </div>
        {loading?<LoadingSpinner/>:(
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
              <thead><tr style={{background:C.bg}}>
                {['Nombre','NIT','Contacto','Teléfono','Productos',''].map(h=>(
                  <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(r=>(
                  <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                    <td style={{padding:'7px 10px',fontWeight:600,color:C.green}}>{r.nombre}</td>
                    <td style={{padding:'7px 10px',color:'#6B8070',fontFamily:'monospace'}}>{r.nit||'—'}</td>
                    <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.contacto||'—'}</td>
                    <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.telefono||'—'}</td>
                    <td style={{padding:'7px 10px',color:'#6B8070',fontSize:'.75rem',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.productos||'—'}</td>
                    <td style={{padding:'7px 10px'}}>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>{setForm({nombre:r.nombre||'',nit:r.nit||'',contacto:r.contacto||'',telefono:r.telefono||'',productos:r.productos||'',obs:r.obs||''});setEditId(r.id);}} style={{padding:'3px 10px',background:'rgba(74,158,106,.1)',color:C.green,border:`1px solid ${C.acc}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✏</button>
                        <button onClick={async()=>{if(!window.confirm('¿Eliminar?'))return;await remove(r.id);toast('Eliminado');}} style={{padding:'3px 10px',background:'rgba(192,57,43,.1)',color:C.danger,border:`1px solid ${C.danger}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length===0&&<tr><td colSpan={6} style={{textAlign:'center',padding:'30px',color:'#9aaa9e'}}>Sin proveedores</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Productos (iProductos + iPresentaciones) ─────────────────────────────
function TabProductos() {
  const toast = useToast();
  const { data: productos,     loading: lp  } = useCollection('iProductos',     { orderField:'nombre', limit:200 });
  const { data: presentaciones,loading: lpr } = useCollection('iPresentaciones', { orderField:'codigo', limit:300 });
  const { add: addProd, update: updProd, remove: delProd, saving: savProd } = useWrite('iProductos');
  const { add: addPres, update: updPres, remove: delPres, saving: savPres } = useWrite('iPresentaciones');

  const [sub, setSub] = useState('productos');

  const BLANK_P  = { codigo:'', nombre:'', categoria:'', activo:true };
  const BLANK_PR = { codigo:'', productoId:'', descripcion:'', unidad:'caja', precioBase:'', activo:true };
  const [formP,  setFormP ] = useState({...BLANK_P});
  const [formPr, setFormPr] = useState({...BLANK_PR});
  const [editP,  setEditP ] = useState(null);
  const [editPr, setEditPr] = useState(null);

  const prodMap = Object.fromEntries(productos.map(p=>[p.id,p]));

  const handleSaveProd = async () => {
    if (!formP.nombre.trim()) { toast('Nombre requerido','error'); return; }
    if (editP) { await updProd(editP, formP); toast('✓ Producto actualizado'); setEditP(null); }
    else       { await addProd(formP);        toast('✓ Producto agregado'); }
    setFormP({...BLANK_P});
  };

  const handleSavePres = async () => {
    if (!formPr.descripcion.trim()||!formPr.productoId) { toast('Producto y descripción requeridos','error'); return; }
    const data = {...formPr, precioBase: parseFloat(formPr.precioBase)||0};
    if (editPr) { await updPres(editPr, data); toast('✓ Presentación actualizada'); setEditPr(null); }
    else        { await addPres(data);          toast('✓ Presentación agregada'); }
    setFormPr({...BLANK_PR});
  };

  const SUB_TABS = [{key:'productos',label:`Productos (${productos.length})`},{key:'presentaciones',label:`Presentaciones (${presentaciones.length})`}];

  return (
    <div>
      <div style={{display:'flex',gap:0,marginBottom:16,border:`1px solid ${C.sand}`,borderRadius:6,overflow:'hidden',background:'#fff',width:'fit-content'}}>
        {SUB_TABS.map(t=>(
          <button key={t.key} onClick={()=>setSub(t.key)} style={{padding:'8px 18px',border:'none',fontWeight:700,fontSize:'.75rem',cursor:'pointer',background:sub===t.key?C.green:'#fff',color:sub===t.key?'#fff':'#6B8070'}}>
            {t.label}
          </button>
        ))}
      </div>

      {sub==='productos'&&(
        <div>
          <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:16,borderLeft:`4px solid ${editP?'#E65100':C.acc}`}}>
            <div style={{fontWeight:700,color:C.green,marginBottom:12}}>{editP?'Editar producto':'Nuevo producto'}</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:10}}>
              <label style={LS}>Código<input value={formP.codigo} onChange={e=>setFormP(f=>({...f,codigo:e.target.value}))} style={IS}/></label>
              <label style={LS}>Nombre *<input value={formP.nombre} onChange={e=>setFormP(f=>({...f,nombre:e.target.value}))} style={IS}/></label>
              <label style={LS}>Categoría<input value={formP.categoria} onChange={e=>setFormP(f=>({...f,categoria:e.target.value}))} style={IS}/></label>
              <label style={LS}>Estado
                <select value={formP.activo?'1':'0'} onChange={e=>setFormP(f=>({...f,activo:e.target.value==='1'}))} style={IS}>
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
              </label>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={handleSaveProd} disabled={savProd} style={{padding:'10px 24px',background:savProd?'#ccc':(editP?'#E65100':C.acc),color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.85rem',cursor:savProd?'not-allowed':'pointer'}}>
                {savProd?'Guardando…':editP?'Actualizar':'+ Agregar'}
              </button>
              {editP&&<button onClick={()=>{setFormP({...BLANK_P});setEditP(null);}} style={{padding:'10px 18px',background:'transparent',border:`1px solid ${C.sand}`,borderRadius:6,fontWeight:600,fontSize:'.85rem',cursor:'pointer',color:'#6B8070'}}>Cancelar</button>}
            </div>
          </div>
          <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
            {lp?<LoadingSpinner/>:(
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
                <thead><tr style={{background:C.bg}}>
                  {['Código','Nombre','Categoría','Estado',''].map(h=><th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {productos.map(p=>(
                    <tr key={p.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                      <td style={{padding:'7px 10px',fontFamily:'monospace',color:'#6B8070'}}>{p.codigo||'—'}</td>
                      <td style={{padding:'7px 10px',fontWeight:600,color:C.green}}>{p.nombre}</td>
                      <td style={{padding:'7px 10px',color:'#6B8070'}}>{p.categoria||'—'}</td>
                      <td style={{padding:'7px 10px'}}>
                        <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,background:p.activo!==false?'rgba(74,158,106,.15)':'rgba(192,57,43,.1)',color:p.activo!==false?C.acc:C.danger}}>
                          {p.activo!==false?'Activo':'Inactivo'}
                        </span>
                      </td>
                      <td style={{padding:'7px 10px'}}>
                        <div style={{display:'flex',gap:6}}>
                          <button onClick={()=>{setFormP({codigo:p.codigo||'',nombre:p.nombre||'',categoria:p.categoria||'',activo:p.activo!==false});setEditP(p.id);}} style={{padding:'3px 10px',background:'rgba(74,158,106,.1)',color:C.green,border:`1px solid ${C.acc}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✏</button>
                          <button onClick={async()=>{if(!window.confirm('¿Eliminar?'))return;await delProd(p.id);toast('Eliminado');}} style={{padding:'3px 10px',background:'rgba(192,57,43,.1)',color:C.danger,border:`1px solid ${C.danger}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {productos.length===0&&<tr><td colSpan={5} style={{textAlign:'center',padding:'30px',color:'#9aaa9e'}}>Sin productos</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {sub==='presentaciones'&&(
        <div>
          <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:16,borderLeft:`4px solid ${editPr?'#E65100':C.acc}`}}>
            <div style={{fontWeight:700,color:C.green,marginBottom:12}}>{editPr?'Editar presentación':'Nueva presentación'}</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:10}}>
              <label style={LS}>Código<input value={formPr.codigo} onChange={e=>setFormPr(f=>({...f,codigo:e.target.value}))} style={IS}/></label>
              <label style={LS}>Producto *
                <select value={formPr.productoId} onChange={e=>setFormPr(f=>({...f,productoId:e.target.value}))} style={IS}>
                  <option value="">— Seleccionar —</option>
                  {productos.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </label>
              <label style={LS}>Descripción *<input value={formPr.descripcion} onChange={e=>setFormPr(f=>({...f,descripcion:e.target.value}))} style={IS}/></label>
              <label style={LS}>Unidad<input value={formPr.unidad} onChange={e=>setFormPr(f=>({...f,unidad:e.target.value}))} style={IS}/></label>
              <label style={LS}>Precio base (Q)<input type="number" min="0" step="0.01" value={formPr.precioBase} onChange={e=>setFormPr(f=>({...f,precioBase:e.target.value}))} style={IS}/></label>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={handleSavePres} disabled={savPres} style={{padding:'10px 24px',background:savPres?'#ccc':(editPr?'#E65100':C.acc),color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.85rem',cursor:savPres?'not-allowed':'pointer'}}>
                {savPres?'Guardando…':editPr?'Actualizar':'+ Agregar'}
              </button>
              {editPr&&<button onClick={()=>{setFormPr({...BLANK_PR});setEditPr(null);}} style={{padding:'10px 18px',background:'transparent',border:`1px solid ${C.sand}`,borderRadius:6,fontWeight:600,fontSize:'.85rem',cursor:'pointer',color:'#6B8070'}}>Cancelar</button>}
            </div>
          </div>
          <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
            {lpr?<LoadingSpinner/>:(
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
                <thead><tr style={{background:C.bg}}>
                  {['Código','Producto','Descripción','Unidad','Precio Base',''].map(h=><th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {presentaciones.map(p=>(
                    <tr key={p.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                      <td style={{padding:'7px 10px',fontFamily:'monospace',color:'#6B8070'}}>{p.codigo||'—'}</td>
                      <td style={{padding:'7px 10px',fontWeight:600,color:C.green}}>{prodMap[p.productoId]?.nombre||p.producto||'—'}</td>
                      <td style={{padding:'7px 10px',color:'#6B8070'}}>{p.descripcion||p.nombre||'—'}</td>
                      <td style={{padding:'7px 10px',color:'#6B8070'}}>{p.unidad||'—'}</td>
                      <td style={{padding:'7px 10px',fontWeight:600,color:C.green}}>Q {Number(p.precioBase||0).toFixed(2)}</td>
                      <td style={{padding:'7px 10px'}}>
                        <div style={{display:'flex',gap:6}}>
                          <button onClick={()=>{setFormPr({codigo:p.codigo||'',productoId:p.productoId||'',descripcion:p.descripcion||p.nombre||'',unidad:p.unidad||'caja',precioBase:String(p.precioBase||''),activo:p.activo!==false});setEditPr(p.id);}} style={{padding:'3px 10px',background:'rgba(74,158,106,.1)',color:C.green,border:`1px solid ${C.acc}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✏</button>
                          <button onClick={async()=>{if(!window.confirm('¿Eliminar?'))return;await delPres(p.id);toast('Eliminado');}} style={{padding:'3px 10px',background:'rgba(192,57,43,.1)',color:C.danger,border:`1px solid ${C.danger}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {presentaciones.length===0&&<tr><td colSpan={6} style={{textAlign:'center',padding:'30px',color:'#9aaa9e'}}>Sin presentaciones</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Camiones / Vehículos ─────────────────────────────────────────────────
function TabCamiones() {
  const toast = useToast();
  const { data, loading } = useCollection('vehiculos', { orderField:'placa', limit:100 });
  const { add, update, remove, saving } = useWrite('vehiculos');

  const BLANK = { placa:'', marca:'', modelo:'', tipo:'camión', capacidad:'', estado:'activo', obs:'' };
  const [form, setForm]     = useState({...BLANK});
  const [editId, setEditId] = useState(null);

  const handleSave = async () => {
    if (!form.placa.trim()) { toast('Placa requerida','error'); return; }
    if (editId) { await update(editId, form); toast('✓ Vehículo actualizado'); }
    else        { await add(form);            toast('✓ Vehículo agregado'); }
    setForm({...BLANK}); setEditId(null);
  };

  return (
    <div>
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:16,borderLeft:`4px solid ${editId?'#E65100':C.acc}`}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:12}}>{editId?'Editar vehículo':'Nuevo vehículo'}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:10}}>
          <label style={LS}>Placa *<input value={form.placa} onChange={e=>setForm(f=>({...f,placa:e.target.value.toUpperCase()}))} style={IS}/></label>
          <label style={LS}>Marca<input value={form.marca} onChange={e=>setForm(f=>({...f,marca:e.target.value}))} style={IS}/></label>
          <label style={LS}>Modelo<input value={form.modelo} onChange={e=>setForm(f=>({...f,modelo:e.target.value}))} style={IS}/></label>
          <label style={LS}>Tipo
            <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))} style={IS}>
              {['camión','panel','pick-up','motocicleta','otro'].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={LS}>Capacidad (qq/lb)<input value={form.capacidad} onChange={e=>setForm(f=>({...f,capacidad:e.target.value}))} style={IS}/></label>
          <label style={LS}>Estado
            <select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))} style={IS}>
              <option value="activo">Activo</option>
              <option value="mantenimiento">En mantenimiento</option>
              <option value="baja">De baja</option>
            </select>
          </label>
        </div>
        <label style={{...LS,marginBottom:12}}>Observaciones
          <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} rows={2} style={{...IS,resize:'vertical'}}/>
        </label>
        <div style={{display:'flex',gap:10}}>
          <button onClick={handleSave} disabled={saving} style={{padding:'10px 24px',background:saving?'#ccc':(editId?'#E65100':C.acc),color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.85rem',cursor:saving?'not-allowed':'pointer'}}>
            {saving?'Guardando…':editId?'Actualizar':'+ Agregar'}
          </button>
          {editId&&<button onClick={()=>{setForm({...BLANK});setEditId(null);}} style={{padding:'10px 18px',background:'transparent',border:`1px solid ${C.sand}`,borderRadius:6,fontWeight:600,fontSize:'.85rem',cursor:'pointer',color:'#6B8070'}}>Cancelar</button>}
        </div>
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:14}}>Flota ({data.length})</div>
        {loading?<LoadingSpinner/>:(
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Placa','Marca','Modelo','Tipo','Capacidad','Estado',''].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:700,fontFamily:'monospace',color:C.green}}>{r.placa}</td>
                  <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.marca||'—'}</td>
                  <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.modelo||'—'}</td>
                  <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.tipo||'—'}</td>
                  <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.capacidad||'—'}</td>
                  <td style={{padding:'7px 10px'}}>
                    <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,
                      background:r.estado==='activo'?'rgba(74,158,106,.15)':r.estado==='mantenimiento'?'rgba(230,81,0,.1)':'rgba(192,57,43,.1)',
                      color:r.estado==='activo'?C.acc:r.estado==='mantenimiento'?'#E65100':C.danger}}>
                      {r.estado||'activo'}
                    </span>
                  </td>
                  <td style={{padding:'7px 10px'}}>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>{setForm({placa:r.placa||'',marca:r.marca||'',modelo:r.modelo||'',tipo:r.tipo||'camión',capacidad:r.capacidad||'',estado:r.estado||'activo',obs:r.obs||''});setEditId(r.id);}} style={{padding:'3px 10px',background:'rgba(74,158,106,.1)',color:C.green,border:`1px solid ${C.acc}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✏</button>
                      <button onClick={async()=>{if(!window.confirm('¿Eliminar?'))return;await remove(r.id);toast('Eliminado');}} style={{padding:'3px 10px',background:'rgba(192,57,43,.1)',color:C.danger,border:`1px solid ${C.danger}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:'30px',color:'#9aaa9e'}}>Sin vehículos registrados</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Admin() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('conductores');

  const { data: conductores, loading: lc  } = useCollection('conductores', { orderField:'nombre', limit:200 });
  const { data: clientes,   loading: lcl  } = useCollection('clientes',    { orderField:'nombre', limit:200 });
  const { data: empleados,  loading: le   } = useCollection('empleados',   { orderField:'nombre', limit:200 });

  const { add: addCond, remove: removeCond, saving: savCond } = useWrite('conductores');
  const { add: addCli,  remove: removeCli,  saving: savCli  } = useWrite('clientes');
  const { add: addEmp,  remove: removeEmp,  saving: savEmp  } = useWrite('empleados');

  const [formCond, setFormCond] = useState({ nombre:'', lic:'', tel:'', obs:'' });
  const [formCli,  setFormCli ] = useState({ nombre:'', rtu:'', tel:'', dir:'', muni:'', obs:'' });
  const [formEmp,  setFormEmp ] = useState({ nombre:'', cargo:'', tel:'', dpi:'', sexo:'', area:'', estado:'activo' });
  const [editingEmp, setEditingEmp] = useState(null);

  // Usuarios (ajua_bpm/main)
  const [usuarios,  setUsuarios ] = useState([]);
  const [loadingU,  setLoadingU ] = useState(false);
  const [formU,     setFormU    ] = useState({ nombre:'', usuario:'', pass:'', rol:'operario' });
  const [savingU,   setSavingU  ] = useState(false);
  const [editingU,  setEditingU ] = useState(null);

  useEffect(() => { cargarUsuarios(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cargarUsuarios = async () => {
    setLoadingU(true);
    try {
      const snap = await getDoc(doc(db,'ajua_bpm','main'));
      setUsuarios(snap.exists() ? (snap.data().usuarios||[]) : []);
    } catch(e) { toast('Error cargando usuarios: '+e.message,'error'); }
    setLoadingU(false);
  };

  const handleSaveU = async () => {
    if(!formU.nombre||!formU.usuario||!formU.pass) { toast('⚠ Nombre, usuario y clave requeridos','error'); return; }
    setSavingU(true);
    try {
      const snap = await getDoc(doc(db,'ajua_bpm','main'));
      const prev = snap.exists() ? snap.data() : {};
      const lista = prev.usuarios||[];
      if(lista.find(u=>u.usuario===formU.usuario)) { toast('⚠ Usuario ya existe','error'); setSavingU(false); return; }
      const nuevo = { ...formU, id:'u_'+Date.now() };
      await setDoc(doc(db,'ajua_bpm','main'), {...prev, usuarios:[...lista, nuevo]});
      setUsuarios([...lista, nuevo]);
      setFormU({ nombre:'', usuario:'', pass:'', rol:'operario' });
      toast('✓ Usuario agregado');
    } catch(e) { toast('Error: '+e.message,'error'); }
    setSavingU(false);
  };

  const uKey = u => u.id || u._key || u.nombre;

  const handleDelU = async (u) => {
    if(!window.confirm(`¿Eliminar usuario "${u.nombre}"?`)) return;
    setSavingU(true);
    try {
      const snap = await getDoc(doc(db,'ajua_bpm','main'));
      const prev = snap.exists() ? snap.data() : {};
      const nuevos = (prev.usuarios||[]).filter(x => uKey(x) !== uKey(u));
      await setDoc(doc(db,'ajua_bpm','main'), {...prev, usuarios:nuevos});
      setUsuarios(nuevos);
      toast('Usuario eliminado');
    } catch(e) { toast('Error: '+e.message,'error'); }
    setSavingU(false);
  };

  const handleUpdateU = async () => {
    if(!editingU.usuario) { toast('⚠ El campo usuario es requerido','error'); return; }
    if(!editingU.rol)     { toast('⚠ Seleccioná un rol','error'); return; }
    setSavingU(true);
    try {
      const snap = await getDoc(doc(db,'ajua_bpm','main'));
      const prev = snap.exists() ? snap.data() : {};
      const lista = prev.usuarios||[];
      const duplicado = lista.find(x => x.usuario === editingU.usuario && uKey(x) !== uKey(editingU));
      if(duplicado) { toast('⚠ Ese nombre de usuario ya está en uso','error'); setSavingU(false); return; }
      const nuevos = lista.map(u => {
        if(uKey(u) !== uKey(editingU)) return u;
        const updated = {
          ...u,
          nombre:  editingU.nombre,
          usuario: editingU.usuario,
          rol:     editingU.rol,
          modulos: editingU.modulos || [],
          id:      u.id || 'u_' + Date.now(),
        };
        if(editingU.pass && editingU.pass.trim()) updated.pass = editingU.pass.trim();
        return updated;
      });
      await setDoc(doc(db,'ajua_bpm','main'), {...prev, usuarios:nuevos});
      setUsuarios(nuevos);
      setEditingU(null);
      toast('✓ Usuario actualizado');
    } catch(e) { toast('Error: '+e.message,'error'); }
    setSavingU(false);
  };

  if(lc||lcl||le) return <LoadingSpinner/>;

  const TABS = [
    { key:'conductores', label:`Conductores (${conductores.length})` },
    { key:'clientes',    label:`Clientes (${clientes.length})` },
    { key:'empleados',   label:`Empleados (${empleados.length})` },
    { key:'proveedores', label:'Proveedores' },
    { key:'camiones',    label:'Camiones' },
    { key:'productos',   label:'Productos' },
    { key:'usuarios',    label:'Usuarios' },
  ];

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>⚙️ Administración</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:16}}>Gestión de conductores, clientes, empleados, proveedores, camiones, productos y usuarios</p>

      <div style={{background:'rgba(74,158,106,.08)',border:`1px solid rgba(74,158,106,.2)`,borderRadius:8,padding:'10px 16px',marginBottom:16,fontSize:'.82rem',color:'#2d6e47'}}>
        Sesión: <strong>{user?.nombre}</strong> · Rol: <strong>{user?.rol}</strong>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:0,marginBottom:20,border:`1px solid ${C.sand}`,borderRadius:8,overflow:'hidden',background:'#fff',flexWrap:'wrap'}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>{ setTab(t.key); if(t.key==='usuarios') cargarUsuarios(); }} style={{
            flex:1,minWidth:100,padding:'11px 6px',border:'none',fontWeight:700,fontSize:'.73rem',cursor:'pointer',
            background:tab===t.key?C.green:'#fff', color:tab===t.key?'#fff':'#6B8070',
          }}>{t.label}</button>
        ))}
      </div>

      {tab==='conductores'&&<CrudTable
        saving={savCond} onAdd={async()=>{ if(!formCond.nombre){toast('⚠ Nombre requerido','error');return;} await addCond(formCond); toast('✓ Conductor agregado'); setFormCond({nombre:'',lic:'',tel:'',obs:''}); }}
        form={formCond} setForm={setFormCond}
        fields={[{id:'nombre',label:'Nombre *'},{id:'lic',label:'Licencia'},{id:'tel',label:'Teléfono'},{id:'obs',label:'Obs.'}]}
        data={conductores} cols={['Nombre','Licencia','Teléfono']}
        row={r=>[r.nombre,r.lic||'—',r.tel||'—']}
        onDelete={async id=>{ if(!window.confirm('¿Eliminar conductor?'))return; await removeCond(id); toast('Eliminado'); }}
      />}

      {tab==='clientes'&&<CrudTable
        saving={savCli} onAdd={async()=>{ if(!formCli.nombre){toast('⚠ Nombre requerido','error');return;} await addCli(formCli); toast('✓ Cliente agregado'); setFormCli({nombre:'',rtu:'',tel:'',dir:'',muni:'',obs:''}); }}
        form={formCli} setForm={setFormCli}
        fields={[{id:'nombre',label:'Nombre *'},{id:'rtu',label:'RTU'},{id:'tel',label:'Teléfono'},{id:'dir',label:'Dirección'},{id:'muni',label:'Municipio'}]}
        data={clientes} cols={['Nombre','RTU','Municipio','Teléfono']}
        row={r=>[r.nombre,r.rtu||'—',r.muni||'—',r.tel||'—']}
        onDelete={async id=>{ if(!window.confirm('¿Eliminar cliente?'))return; await removeCli(id); toast('Eliminado'); }}
      />}

      {tab==='empleados'&&(
        <div>
          {editingEmp && (
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
              <div style={{background:'#fff',borderRadius:10,padding:28,width:'100%',maxWidth:500,boxShadow:'0 8px 32px rgba(0,0,0,.18)',maxHeight:'90vh',overflowY:'auto'}}>
                <div style={{fontWeight:700,color:C.green,marginBottom:18,fontSize:'1rem'}}>Editar Empleado</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  <label style={{...LS,gridColumn:'1/-1'}}>Nombre *<input value={editingEmp.nombre||''} onChange={e=>setEditingEmp(u=>({...u,nombre:e.target.value}))} style={IS}/></label>
                  <label style={LS}>Cargo<input value={editingEmp.cargo||''} onChange={e=>setEditingEmp(u=>({...u,cargo:e.target.value}))} style={IS}/></label>
                  <label style={LS}>Área de trabajo<select value={editingEmp.area||''} onChange={e=>setEditingEmp(u=>({...u,area:e.target.value}))} style={IS}><option value="">— Seleccionar —</option>{AREAS_EMP.map(a=><option key={a} value={a}>{a}</option>)}</select></label>
                  <label style={LS}>DPI<input value={editingEmp.dpi||''} onChange={e=>setEditingEmp(u=>({...u,dpi:e.target.value}))} style={IS}/></label>
                  <label style={LS}>Teléfono<input value={editingEmp.tel||''} onChange={e=>setEditingEmp(u=>({...u,tel:e.target.value}))} style={IS}/></label>
                  <label style={LS}>Sexo
                    <select value={editingEmp.sexo||''} onChange={e=>setEditingEmp(u=>({...u,sexo:e.target.value}))} style={IS}>
                      <option value="">— Sin especificar —</option>
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                    </select>
                  </label>
                  <label style={LS}>Estado
                    <select value={editingEmp.estado||'activo'} onChange={e=>setEditingEmp(u=>({...u,estado:e.target.value}))} style={IS}>
                      <option value="activo">✓ Activo</option>
                      <option value="inactivo">✗ Inactivo</option>
                    </select>
                  </label>
                </div>
                <div style={{display:'flex',gap:10,marginTop:10}}>
                  <button onClick={async()=>{
                    if(!editingEmp.nombre){toast('⚠ Nombre requerido','error');return;}
                    try {
                      const {db: fdb, doc: fdoc, setDoc: fsetDoc} = await import('../../firebase');
                      await fsetDoc(fdoc(fdb,'empleados',editingEmp.id), {...editingEmp});
                      toast('✓ Empleado actualizado');
                      setEditingEmp(null);
                    } catch(e){ toast('Error: '+e.message,'error'); }
                  }} style={{flex:1,padding:'10px',background:C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.85rem',cursor:'pointer'}}>
                    Guardar
                  </button>
                  <button onClick={()=>setEditingEmp(null)} style={{padding:'10px 18px',background:'transparent',border:`1px solid ${C.sand}`,borderRadius:6,fontWeight:600,fontSize:'.85rem',cursor:'pointer',color:'#6B8070'}}>Cancelar</button>
                </div>
              </div>
            </div>
          )}

          <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:16}}>
            <div style={{fontWeight:700,color:C.green,marginBottom:12}}>Agregar Empleado</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:10}}>
              <label style={LS}>Nombre *<input value={formEmp.nombre} onChange={e=>setFormEmp(f=>({...f,nombre:e.target.value}))} style={IS}/></label>
              <label style={LS}>Cargo<input value={formEmp.cargo} onChange={e=>setFormEmp(f=>({...f,cargo:e.target.value}))} style={IS}/></label>
              <label style={LS}>Área<select value={formEmp.area} onChange={e=>setFormEmp(f=>({...f,area:e.target.value}))} style={IS}><option value="">— Seleccionar —</option>{AREAS_EMP.map(a=><option key={a} value={a}>{a}</option>)}</select></label>
              <label style={LS}>DPI<input value={formEmp.dpi} onChange={e=>setFormEmp(f=>({...f,dpi:e.target.value}))} style={IS}/></label>
              <label style={LS}>Teléfono<input value={formEmp.tel} onChange={e=>setFormEmp(f=>({...f,tel:e.target.value}))} style={IS}/></label>
              <label style={LS}>Sexo
                <select value={formEmp.sexo} onChange={e=>setFormEmp(f=>({...f,sexo:e.target.value}))} style={IS}>
                  <option value="">— —</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </label>
              <label style={LS}>Estado
                <select value={formEmp.estado} onChange={e=>setFormEmp(f=>({...f,estado:e.target.value}))} style={IS}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </label>
            </div>
            <button onClick={async()=>{ if(!formEmp.nombre){toast('⚠ Nombre requerido','error');return;} await addEmp(formEmp); toast('✓ Empleado agregado'); setFormEmp({nombre:'',cargo:'',tel:'',dpi:'',sexo:'',area:'',estado:'activo'}); }} disabled={savEmp}
              style={{padding:'10px 24px',background:savEmp?'#ccc':C.acc,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.85rem',cursor:savEmp?'not-allowed':'pointer'}}>
              + Agregar
            </button>
          </div>

          <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
              <thead><tr style={{background:C.bg}}>
                {['Nombre','Cargo','Área','DPI','Tel','Sexo','Estado',''].map(h=>(
                  <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {empleados.map(r=>(
                  <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                    <td style={{padding:'7px 10px',fontWeight:600,color:C.green,whiteSpace:'nowrap'}}>{r.nombre}</td>
                    <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.cargo||'—'}</td>
                    <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.area||'—'}</td>
                    <td style={{padding:'7px 10px',color:'#6B8070',fontFamily:'monospace'}}>{r.dpi||'—'}</td>
                    <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.tel||'—'}</td>
                    <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.sexo||'—'}</td>
                    <td style={{padding:'7px 10px'}}>
                      <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,background:(r.estado||r.activo)!=='inactivo'&&r.activo!==false?'rgba(74,158,106,.15)':'rgba(192,57,43,.1)',color:(r.estado||r.activo)!=='inactivo'&&r.activo!==false?C.acc:C.danger}}>
                        {(r.estado==='inactivo'||r.activo===false)?'Inactivo':'Activo'}
                      </span>
                    </td>
                    <td style={{padding:'7px 10px'}}>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>setEditingEmp({...r})} style={{padding:'3px 10px',background:'rgba(74,158,106,.1)',color:C.green,border:`1px solid ${C.acc}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✏</button>
                        <button onClick={async()=>{ if(!window.confirm('¿Eliminar?'))return; await removeEmp(r.id); toast('Eliminado'); }}
                          style={{padding:'3px 10px',background:'rgba(192,57,43,.1)',color:C.danger,border:`1px solid ${C.danger}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {empleados.length===0&&<tr><td colSpan={8} style={{textAlign:'center',padding:'30px',color:'#9aaa9e'}}>Sin empleados</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==='proveedores'&&<TabProveedores/>}
      {tab==='camiones'   &&<TabCamiones/>}
      {tab==='productos'  &&<TabProductos/>}

      {tab==='usuarios'&&(
        <div>
          <div style={{background:'rgba(230,126,34,.08)',border:`1px solid rgba(230,126,34,.3)`,borderRadius:6,padding:'10px 14px',marginBottom:14,fontSize:'.8rem',color:'#c05000'}}>
            ⚠ Los usuarios se guardan en <code>ajua_bpm/main</code> — compatibles con bpm.html
          </div>
          <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:16}}>
            <div style={{fontWeight:700,color:C.green,marginBottom:12}}>Agregar Usuario</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:10}}>
              <label style={LS}>Nombre *<input value={formU.nombre} onChange={e=>setFormU(f=>({...f,nombre:e.target.value}))} style={IS}/></label>
              <label style={LS}>Usuario *<input value={formU.usuario} onChange={e=>setFormU(f=>({...f,usuario:e.target.value}))} style={IS}/></label>
              <label style={LS}>Contraseña *<input type="password" value={formU.pass} onChange={e=>setFormU(f=>({...f,pass:e.target.value}))} style={IS}/></label>
              <label style={LS}>Rol
                <select value={formU.rol} onChange={e=>setFormU(f=>({...f,rol:e.target.value}))} style={IS}>
                  <option value="operario">Operario</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </label>
            </div>
            <button onClick={handleSaveU} disabled={savingU} style={{padding:'10px 24px',background:savingU?'#ccc':C.acc,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.85rem',cursor:savingU?'not-allowed':'pointer'}}>
              + Agregar
            </button>
          </div>

          {editingU && (
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
              <div style={{background:'#fff',borderRadius:10,padding:28,width:'100%',maxWidth:520,boxShadow:'0 8px 32px rgba(0,0,0,.18)',maxHeight:'90vh',overflowY:'auto'}}>
                <div style={{fontWeight:700,color:C.green,marginBottom:16,fontSize:'1rem'}}>Editar usuario</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                  <label style={LS}>Nombre *<input value={editingU.nombre||''} onChange={e=>setEditingU(u=>({...u,nombre:e.target.value}))} style={IS}/></label>
                  <label style={LS}>Usuario (login) *<input value={editingU.usuario||''} onChange={e=>setEditingU(u=>({...u,usuario:e.target.value}))} style={IS} autoComplete="off"/></label>
                </div>
                <label style={{...LS,marginBottom:12}}>Rol
                  <select value={editingU.rol} onChange={e=>setEditingU(u=>({...u,rol:e.target.value}))} style={IS}>
                    <option value="operario">Operario</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </label>
                <label style={{...LS,marginBottom:16}}>Nueva contraseña <span style={{fontWeight:400,textTransform:'none',letterSpacing:0}}>(vacío = no cambiar)</span>
                  <input type="password" value={editingU.pass||''} onChange={e=>setEditingU(u=>({...u,pass:e.target.value}))} placeholder="••••••••" style={IS}/>
                </label>
                {editingU.rol !== 'admin' && editingU.rol !== 'superadmin' && (
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'#E65100',marginBottom:8}}>
                      Módulos permitidos
                    </div>
                    <div style={{display:'flex',gap:6,marginBottom:8}}>
                      <button type="button" onClick={()=>setEditingU(u=>({...u,modulos:MODULOS.map(m=>m.id)}))} style={{padding:'3px 10px',background:'rgba(74,158,106,.1)',color:C.acc,border:`1px solid ${C.acc}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✓ Todos</button>
                      <button type="button" onClick={()=>setEditingU(u=>({...u,modulos:['dashboard']}))} style={{padding:'3px 10px',background:'rgba(192,57,43,.1)',color:C.danger,border:`1px solid ${C.danger}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✗ Ninguno</button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:5}}>
                      {MODULOS.map(m=>{
                        const mods = editingU.modulos||[];
                        const on = mods.includes(m.id);
                        return (
                          <label key={m.id} style={{display:'flex',alignItems:'center',gap:7,padding:'6px 9px',borderRadius:4,border:`1px solid ${on?C.acc:C.sand}`,background:on?'rgba(74,158,106,.08)':'transparent',cursor:'pointer',fontSize:'.75rem',fontWeight:on?600:400,color:on?C.green:'#6B8070'}}>
                            <input type="checkbox" checked={on} onChange={e=>{
                              const next = e.target.checked ? [...mods,m.id] : mods.filter(x=>x!==m.id);
                              setEditingU(u=>({...u,modulos:next}));
                            }} style={{accentColor:C.acc}}/>
                            {m.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                {(editingU.rol === 'admin' || editingU.rol === 'superadmin') && (
                  <div style={{padding:'8px 12px',background:'rgba(74,158,106,.08)',border:`1px solid rgba(74,158,106,.2)`,borderRadius:6,fontSize:'.78rem',color:C.acc,marginBottom:16}}>
                    ✓ Admin y Superadmin tienen acceso a todos los módulos automáticamente.
                  </div>
                )}
                <div style={{display:'flex',gap:10}}>
                  <button onClick={handleUpdateU} disabled={savingU} style={{flex:1,padding:'10px',background:savingU?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.85rem',cursor:savingU?'not-allowed':'pointer'}}>
                    {savingU ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  <button onClick={()=>setEditingU(null)} style={{padding:'10px 18px',background:'transparent',border:`1px solid ${C.sand}`,borderRadius:6,fontWeight:600,fontSize:'.85rem',cursor:'pointer',color:'#6B8070'}}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
            {loadingU ? <LoadingSpinner/> : (
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
                <thead><tr style={{background:C.bg}}>
                  {['Nombre','Usuario','Rol',''].map(h=>(
                    <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {usuarios.map(u=>(
                    <tr key={u.id||u.usuario} style={{borderBottom:`1px solid ${C.sand}`}}>
                      <td style={{padding:'7px 10px',fontWeight:600,color:C.green}}>{u.nombre}</td>
                      <td style={{padding:'7px 10px',fontFamily:'monospace',color:'#6B8070'}}>{u.usuario}</td>
                      <td style={{padding:'7px 10px'}}>
                        <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,background:'rgba(74,158,106,.1)',color:C.acc}}>{u.rol||'operario'}</span>
                      </td>
                      <td style={{padding:'7px 10px'}}>
                        <div style={{display:'flex',gap:6}}>
                          <button onClick={()=>setEditingU({...u,pass:''})} style={{padding:'3px 10px',background:'rgba(74,158,106,.1)',color:C.green,border:`1px solid ${C.acc}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✏ Editar</button>
                          <button onClick={()=>handleDelU(u)} style={{padding:'3px 10px',background:'rgba(192,57,43,.1)',color:C.danger,border:`1px solid ${C.danger}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {usuarios.length===0&&<tr><td colSpan={4} style={{textAlign:'center',padding:'30px',color:'#9aaa9e'}}>Sin usuarios cargados</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
