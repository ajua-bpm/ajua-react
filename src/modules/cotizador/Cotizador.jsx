import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useClientes, useProductosCatalogo } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  primary:   '#1B5E20',
  secondary: '#2E7D32',
  white:     '#FFFFFF',
  bgLight:   '#F5F5F5',
  border:    '#E0E0E0',
  textDark:  '#1A1A18',
  textMid:   '#6B6B60',
  danger:    '#C62828',
  warn:      '#E65100',
};

const card = { background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:20, marginBottom:20 };
const TH_S = { padding:'10px 14px', fontSize:'.75rem', textTransform:'uppercase', fontWeight:700, letterSpacing:'.06em', color:T.white, background:T.primary, textAlign:'left', whiteSpace:'nowrap' };
const TD_S = (alt) => ({ padding:'9px 14px', fontSize:'.83rem', borderBottom:'1px solid #F0F0F0', background:alt?'#F9FBF9':'#fff', color:T.textDark });
const LS   = { display:'flex', flexDirection:'column', gap:5, fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.secondary };
const IS   = { padding:'9px 12px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.85rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2, color:T.textDark, background:T.white };

const today = () => new Date().toISOString().slice(0,10);

// ─── ESTADO CONFIG ─────────────────────────────────────────────────────────
const EST_CFG = {
  borrador:  { color:'#6B6B60', bg:'rgba(97,97,97,.10)',    label:'Borrador'  },
  enviada:   { color:T.warn,    bg:'rgba(230,81,0,.10)',    label:'Enviada'   },
  aprobada:  { color:T.secondary,bg:'rgba(46,125,50,.12)',  label:'Aprobada'  },
  rechazada: { color:T.danger,  bg:'rgba(198,40,40,.10)',   label:'Rechazada' },
  vencida:   { color:'#6B6B60', bg:'rgba(158,158,158,.10)', label:'Vencida'   },
};

function EstadoChip({ estado }) {
  const cfg = EST_CFG[estado]||EST_CFG.borrador;
  return <span style={{ display:'inline-block', padding:'3px 9px', borderRadius:100, fontSize:'.7rem', fontWeight:700, background:cfg.bg, color:cfg.color }}>{cfg.label}</span>;
}

// ─── TAB 1: COTIZACIONES ────────────────────────────────────────────────────
const BLANK_ITEM = { descripcion:'', cantidad:'', unidad:'u', precioUnitario:'' };
const BLANK_COT  = { fecha:today(), cliente:'', tipo:'Interno', validezDias:'30', estado:'borrador', items:[{...BLANK_ITEM}], notas:'' };

function TabCotizaciones() {
  const toast = useToast();
  const { data, loading }   = useCollection('cotizadorRapido', { orderField:'fecha', orderDir:'desc', limit:200 });
  const { clientes }        = useClientes();
  const { add, update, saving } = useWrite('cotizadorRapido');

  const [form, setForm]   = useState({...BLANK_COT, items:[{...BLANK_ITEM}]});
  const [editId, setEditId] = useState(null);

  const setItem = (i,field,val) => setForm(f=>({...f, items:f.items.map((it,j)=>j===i?{...it,[field]:val}:it)}));
  const addItem = () => setForm(f=>({...f, items:[...f.items,{...BLANK_ITEM}]}));
  const removeItem = i => setForm(f=>({...f, items:f.items.filter((_,j)=>j!==i)}));
  const calcTotal = items => items.reduce((s,it)=>(parseFloat(it.cantidad)||0)*(parseFloat(it.precioUnitario)||0)+s, 0);

  const handleSave = async () => {
    if (!form.cliente) { toast('Cliente es requerido','error'); return; }
    const total = calcTotal(form.items);
    if (editId) { await update(editId,{...form,total}); toast('Cotización actualizada'); setEditId(null); }
    else { await add({...form,total}); toast('Cotización creada'); }
    setForm({...BLANK_COT,items:[{...BLANK_ITEM}]});
  };

  const startEdit = r => {
    setForm({fecha:r.fecha||today(),cliente:r.cliente||'',tipo:r.tipo||'Interno',validezDias:r.validezDias||'30',estado:r.estado||'borrador',items:r.items||[{...BLANK_ITEM}],notas:r.notas||''});
    setEditId(r.id);
  };

  const cambiarEstado = async (id,estado) => { await update(id,{estado}); toast('Estado actualizado'); };

  if (loading) return <Skeleton rows={6}/>;

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.primary, marginBottom:18, borderBottom:`2px solid ${T.primary}`, paddingBottom:8 }}>
          {editId ? 'Editar Cotización' : 'Nueva Cotización'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, marginBottom:14 }}>
          <label style={LS}>Fecha<input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} style={IS}/></label>
          <label style={LS}>
            Cliente *
            <select value={form.cliente} onChange={e=>setForm(f=>({...f,cliente:e.target.value}))} style={IS}>
              <option value="">— Seleccionar —</option>
              {clientes.map(c=><option key={c.id||c.nombre} value={c.nombre}>{c.nombre}</option>)}
            </select>
          </label>
          <label style={LS}>
            Tipo
            <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))} style={IS}>
              {['Interno','Terceros'].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={LS}>Validez (días)<input type="number" min="1" value={form.validezDias} onChange={e=>setForm(f=>({...f,validezDias:e.target.value}))} style={IS}/></label>
          <label style={LS}>
            Estado
            <select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))} style={IS}>
              {Object.entries(EST_CFG).map(([v,c])=><option key={v} value={v}>{c.label}</option>)}
            </select>
          </label>
        </div>

        {/* Items */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.secondary, marginBottom:10 }}>Items</div>
          {form.items.map((it,i)=>(
            <div key={i} style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap', alignItems:'flex-end' }}>
              <input placeholder="Descripción del item" value={it.descripcion} onChange={e=>setItem(i,'descripcion',e.target.value)}
                style={{ ...IS, flex:'3 1 180px', width:'auto', marginTop:0 }}/>
              <input type="number" min="0" placeholder="Cant." value={it.cantidad} onChange={e=>setItem(i,'cantidad',e.target.value)}
                style={{ ...IS, flex:'1 1 75px', width:'auto', marginTop:0 }}/>
              <select value={it.unidad} onChange={e=>setItem(i,'unidad',e.target.value)} style={{ ...IS, flex:'1 1 70px', width:'auto', marginTop:0 }}>
                {['u','lb','kg','caja','quintal'].map(u=><option key={u} value={u}>{u}</option>)}
              </select>
              <input type="number" min="0" placeholder="Precio u." value={it.precioUnitario} onChange={e=>setItem(i,'precioUnitario',e.target.value)}
                style={{ ...IS, flex:'1 1 90px', width:'auto', marginTop:0 }}/>
              <span style={{ fontSize:'.85rem', fontWeight:700, color:T.secondary, minWidth:80, paddingBottom:2 }}>
                Q {((parseFloat(it.cantidad)||0)*(parseFloat(it.precioUnitario)||0)).toFixed(2)}
              </span>
              {form.items.length>1 && (
                <button onClick={()=>removeItem(i)} style={{ padding:'7px 11px', background:T.danger, color:T.white, border:'none', borderRadius:5, cursor:'pointer', fontWeight:800, fontSize:'.9rem' }}>×</button>
              )}
            </div>
          ))}
          <button onClick={addItem} style={{ padding:'6px 16px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:5, fontSize:'.8rem', fontWeight:600, cursor:'pointer', color:T.textMid }}>
            + Agregar ítem
          </button>
          <div style={{ marginTop:12, textAlign:'right', fontSize:'1rem', fontWeight:800, color:T.primary }}>
            Total: Q {calcTotal(form.items).toFixed(2)}
          </div>
        </div>

        <label style={LS}>
          Notas / Condiciones
          <textarea value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} rows={2}
            style={{ ...IS, resize:'vertical' }} placeholder="Condiciones, plazos, notas..."/>
        </label>
        <div style={{ display:'flex', gap:10, marginTop:16 }}>
          <button onClick={handleSave} disabled={saving} style={{ padding:'11px 28px', background:saving?'#6B6B60':T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor:saving?'not-allowed':'pointer' }}>
            {saving?'Guardando...':editId?'Actualizar':'Crear Cotización'}
          </button>
          {editId && <button onClick={()=>{setEditId(null);setForm({...BLANK_COT,items:[{...BLANK_ITEM}]});}} style={{ padding:'11px 20px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, cursor:'pointer', color:T.textMid }}>Cancelar</button>}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary, marginBottom:16 }}>Cotizaciones ({data.length})</div>
        {data.length===0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:T.textMid }}>Sin cotizaciones registradas</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['Fecha','Cliente','Tipo','Items','Total','Validez','Estado','Acciones'].map(h=><th key={h} style={TH_S}>{h}</th>)}</tr></thead>
              <tbody>
                {data.slice(0,80).map((r,i)=>(
                  <tr key={r.id}>
                    <td style={{ ...TD_S(i%2===1), fontWeight:600 }}>{r.fecha}</td>
                    <td style={TD_S(i%2===1)}>{r.cliente||'—'}</td>
                    <td style={TD_S(i%2===1)}>{r.tipo||'—'}</td>
                    <td style={TD_S(i%2===1)}>{(r.items||[]).length}</td>
                    <td style={{ ...TD_S(i%2===1), fontWeight:700, color:T.secondary }}>Q {(r.total||0).toFixed(2)}</td>
                    <td style={TD_S(i%2===1)}>{r.validezDias||30}d</td>
                    <td style={TD_S(i%2===1)}><EstadoChip estado={r.estado}/></td>
                    <td style={TD_S(i%2===1)}>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        <button onClick={()=>startEdit(r)} style={{ padding:'3px 9px', background:T.primary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Editar</button>
                        {r.estado==='borrador' && <button onClick={()=>cambiarEstado(r.id,'enviada')} style={{ padding:'3px 9px', background:T.warn, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Enviar</button>}
                        {r.estado==='enviada'  && <button onClick={()=>cambiarEstado(r.id,'aprobada')} style={{ padding:'3px 9px', background:T.secondary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Aprobar</button>}
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

// ─── TAB 2: PRODUCTOS ───────────────────────────────────────────────────────
function TabProductos() {
  const toast = useToast();
  const { data, loading } = useCollection('iProductos', { orderField:'nombre', limit:200 });
  const { add, update, remove, saving } = useWrite('iProductos');
  const [form, setForm]   = useState({ nombre:'', codigo:'', categoria:'', unidad:'lb', precioBase:'' });
  const [editId, setEditId] = useState(null);

  const handleSave = async () => {
    if (!form.nombre) { toast('Nombre es requerido','error'); return; }
    const payload = { ...form, precioBase:parseFloat(form.precioBase)||0 };
    if (editId) { await update(editId,payload); toast('Producto actualizado'); setEditId(null); }
    else { await add(payload); toast('Producto guardado'); }
    setForm({ nombre:'', codigo:'', categoria:'', unidad:'lb', precioBase:'' });
  };

  const startEdit = r => {
    setForm({ nombre:r.nombre||'', codigo:r.codigo||'', categoria:r.categoria||'', unidad:r.unidad||'lb', precioBase:String(r.precioBase||'') });
    setEditId(r.id);
  };

  if (loading) return <Skeleton rows={5}/>;

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.primary, marginBottom:18, borderBottom:`2px solid ${T.primary}`, paddingBottom:8 }}>
          {editId ? 'Editar Producto' : 'Nuevo Producto'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:14, marginBottom:14 }}>
          <label style={LS}>Nombre *<input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} style={IS}/></label>
          <label style={LS}>Código<input value={form.codigo} onChange={e=>setForm(f=>({...f,codigo:e.target.value}))} style={IS}/></label>
          <label style={LS}>Categoría<input value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))} style={IS}/></label>
          <label style={LS}>
            Unidad
            <select value={form.unidad} onChange={e=>setForm(f=>({...f,unidad:e.target.value}))} style={IS}>
              {['lb','kg','caja','unidad','quintal'].map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label style={LS}>Precio base (Q)<input type="number" min="0" step="0.01" value={form.precioBase} onChange={e=>setForm(f=>({...f,precioBase:e.target.value}))} style={IS}/></label>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={handleSave} disabled={saving} style={{ padding:'11px 28px', background:saving?'#6B6B60':T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, cursor:saving?'not-allowed':'pointer' }}>
            {saving?'Guardando...':editId?'Actualizar':'Guardar'}
          </button>
          {editId && <button onClick={()=>{setEditId(null);setForm({nombre:'',codigo:'',categoria:'',unidad:'lb',precioBase:''}); }} style={{ padding:'11px 20px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, cursor:'pointer', color:T.textMid }}>Cancelar</button>}
        </div>
      </div>
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary, marginBottom:16 }}>Productos ({data.length})</div>
        {data.length===0 ? <div style={{ textAlign:'center', padding:'40px 0', color:T.textMid }}>Sin productos registrados</div> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['Nombre','Código','Categoría','Unidad','Precio base','Acciones'].map(h=><th key={h} style={TH_S}>{h}</th>)}</tr></thead>
              <tbody>
                {data.map((r,i)=>(
                  <tr key={r.id}>
                    <td style={{ ...TD_S(i%2===1), fontWeight:600 }}>{r.nombre}</td>
                    <td style={TD_S(i%2===1)}>{r.codigo||'—'}</td>
                    <td style={TD_S(i%2===1)}>{r.categoria||'—'}</td>
                    <td style={TD_S(i%2===1)}>{r.unidad||'lb'}</td>
                    <td style={{ ...TD_S(i%2===1), fontWeight:700, color:T.secondary }}>Q {(r.precioBase||0).toFixed(2)}</td>
                    <td style={TD_S(i%2===1)}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>startEdit(r)} style={{ padding:'3px 9px', background:T.primary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Editar</button>
                        <button onClick={async()=>{if(confirm('¿Eliminar?'))await remove(r.id);}} style={{ padding:'3px 9px', background:T.danger, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Eliminar</button>
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

// ─── TAB 3: PRESENTACIONES ──────────────────────────────────────────────────
function TabPresentaciones() {
  const toast = useToast();
  const { data, loading } = useCollection('iPresentaciones', { orderField:'nombre', limit:200 });
  const { productos }     = useProductosCatalogo();
  const { add, update, remove, saving } = useWrite('iPresentaciones');
  const [form, setForm]   = useState({ nombre:'', producto:'', peso:'', unidad:'lb', precio:'', codigoBarras:'' });
  const [editId, setEditId] = useState(null);

  const handleSave = async () => {
    if (!form.nombre) { toast('Nombre es requerido','error'); return; }
    const payload = { ...form, peso:parseFloat(form.peso)||0, precio:parseFloat(form.precio)||0 };
    if (editId) { await update(editId,payload); toast('Presentación actualizada'); setEditId(null); }
    else { await add(payload); toast('Presentación guardada'); }
    setForm({ nombre:'', producto:'', peso:'', unidad:'lb', precio:'', codigoBarras:'' });
  };

  const startEdit = r => {
    setForm({ nombre:r.nombre||'', producto:r.producto||'', peso:String(r.peso||''), unidad:r.unidad||'lb', precio:String(r.precio||''), codigoBarras:r.codigoBarras||'' });
    setEditId(r.id);
  };

  if (loading) return <Skeleton rows={5}/>;

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.primary, marginBottom:18, borderBottom:`2px solid ${T.primary}`, paddingBottom:8 }}>
          {editId ? 'Editar Presentación' : 'Nueva Presentación'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:14, marginBottom:14 }}>
          <label style={LS}>Nombre *<input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} style={IS}/></label>
          <label style={LS}>
            Producto
            <select value={form.producto} onChange={e=>setForm(f=>({...f,producto:e.target.value}))} style={IS}>
              <option value="">— Seleccionar —</option>
              {productos.map(p=><option key={p.id||p.nombre} value={p.nombre}>{p.nombre}</option>)}
            </select>
          </label>
          <label style={LS}>Peso<input type="number" min="0" step="0.01" value={form.peso} onChange={e=>setForm(f=>({...f,peso:e.target.value}))} style={IS}/></label>
          <label style={LS}>
            Unidad
            <select value={form.unidad} onChange={e=>setForm(f=>({...f,unidad:e.target.value}))} style={IS}>
              {['lb','kg','caja','unidad'].map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label style={LS}>Precio (Q)<input type="number" min="0" step="0.01" value={form.precio} onChange={e=>setForm(f=>({...f,precio:e.target.value}))} style={IS}/></label>
          <label style={LS}>Código de barras<input value={form.codigoBarras} onChange={e=>setForm(f=>({...f,codigoBarras:e.target.value}))} style={IS}/></label>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={handleSave} disabled={saving} style={{ padding:'11px 28px', background:saving?'#6B6B60':T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, cursor:saving?'not-allowed':'pointer' }}>
            {saving?'Guardando...':editId?'Actualizar':'Guardar'}
          </button>
          {editId && <button onClick={()=>{setEditId(null);setForm({nombre:'',producto:'',peso:'',unidad:'lb',precio:'',codigoBarras:''});}} style={{ padding:'11px 20px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, cursor:'pointer', color:T.textMid }}>Cancelar</button>}
        </div>
      </div>
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary, marginBottom:16 }}>Presentaciones ({data.length})</div>
        {data.length===0 ? <div style={{ textAlign:'center', padding:'40px 0', color:T.textMid }}>Sin presentaciones registradas</div> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['Nombre','Producto','Peso','Unidad','Precio','Código','Acciones'].map(h=><th key={h} style={TH_S}>{h}</th>)}</tr></thead>
              <tbody>
                {data.map((r,i)=>(
                  <tr key={r.id}>
                    <td style={{ ...TD_S(i%2===1), fontWeight:600 }}>{r.nombre}</td>
                    <td style={TD_S(i%2===1)}>{r.producto||'—'}</td>
                    <td style={TD_S(i%2===1)}>{r.peso||'—'}</td>
                    <td style={TD_S(i%2===1)}>{r.unidad||'lb'}</td>
                    <td style={{ ...TD_S(i%2===1), fontWeight:700, color:T.secondary }}>Q {(r.precio||0).toFixed(2)}</td>
                    <td style={{ ...TD_S(i%2===1), fontSize:'.78rem', color:T.textMid }}>{r.codigoBarras||'—'}</td>
                    <td style={TD_S(i%2===1)}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>startEdit(r)} style={{ padding:'3px 9px', background:T.primary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Editar</button>
                        <button onClick={async()=>{if(confirm('¿Eliminar?'))await remove(r.id);}} style={{ padding:'3px 9px', background:T.danger, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Eliminar</button>
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

// ─── MAIN ────────────────────────────────────────────────────────────────────
const TABS = [
  { id:'cotizaciones',  label:'Cotizaciones',  Component:TabCotizaciones  },
  { id:'productos',     label:'Productos',     Component:TabProductos     },
  { id:'presentaciones',label:'Presentaciones',Component:TabPresentaciones },
];

export default function Cotizador() {
  const [tab, setTab] = useState('cotizaciones');
  const Active = TABS.find(t=>t.id===tab).Component;

  return (
    <div style={{ fontFamily:'inherit', maxWidth:1100 }}>
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontSize:'1.45rem', fontWeight:800, color:T.primary, margin:0 }}>Cotizador</h1>
        <p style={{ fontSize:'.83rem', color:T.textMid, marginTop:4 }}>Cotizaciones, catálogo de productos y presentaciones</p>
      </div>

      {/* Pill tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'8px 20px', borderRadius:100, fontWeight:700, fontSize:'.83rem', cursor:'pointer',
            border:`1.5px solid ${tab===t.id?T.primary:T.border}`,
            background:tab===t.id?T.primary:T.white,
            color:tab===t.id?T.white:T.textMid,
            transition:'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      <Active/>
    </div>
  );
}
