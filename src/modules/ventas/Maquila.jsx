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

const BLANK = { fecha:today(), cliente:'', producto:'', cantidad:'', unidad:'lb', precioMaquila:'', estado:'pendiente', obs:'' };

const EST_CFG = {
  pendiente:  { color:T.warn,      bg:'rgba(230,81,0,.10)',     label:'Pendiente',  next:'procesando' },
  procesando: { color:'#6A1B9A',   bg:'rgba(106,27,154,.10)',   label:'Procesando', next:'entregado'  },
  entregado:  { color:'#1565C0',   bg:'rgba(21,101,192,.10)',   label:'Entregado',  next:'cobrado'    },
  cobrado:    { color:T.secondary, bg:'rgba(46,125,50,.12)',    label:'Cobrado',    next:null         },
};

const NEXT_BTN_COLOR = {
  procesando: '#6A1B9A',
  entregado:  '#1565C0',
  cobrado:    T.secondary,
};
const NEXT_BTN_LABEL = { procesando:'Iniciar', entregado:'Entregar', cobrado:'Cobrar' };

function EstadoChip({ estado }) {
  const cfg = EST_CFG[estado]||EST_CFG.pendiente;
  return <span style={{ display:'inline-block', padding:'3px 9px', borderRadius:100, fontSize:'.7rem', fontWeight:700, background:cfg.bg, color:cfg.color }}>{cfg.label}</span>;
}

export default function Maquila() {
  const toast = useToast();
  const { data, loading }   = useCollection('maquila', { orderField:'fecha', orderDir:'desc', limit:200 });
  const { clientes }        = useClientes();
  const { productos }       = useProductosCatalogo();
  const { add, update, saving } = useWrite('maquila');

  const [form, setForm]   = useState({ ...BLANK });
  const [editId, setEditId] = useState(null);

  const calcTotal = () => (parseFloat(form.cantidad)||0) * (parseFloat(form.precioMaquila)||0);

  const handleSave = async () => {
    if (!form.fecha||!form.cliente||!form.producto) {
      toast('Fecha, cliente y producto son requeridos','error'); return;
    }
    const total = calcTotal();
    const payload = { ...form, cantidad:parseFloat(form.cantidad)||0, precioMaquila:parseFloat(form.precioMaquila)||0, total };
    if (editId) { await update(editId,payload); toast('Registro actualizado'); setEditId(null); }
    else { await add(payload); toast('Maquila registrada'); }
    setForm({ ...BLANK });
  };

  const startEdit = r => {
    setForm({ fecha:r.fecha||today(), cliente:r.cliente||'', producto:r.producto||'',
      cantidad:String(r.cantidad||''), unidad:r.unidad||'lb', precioMaquila:String(r.precioMaquila||''),
      estado:r.estado||'pendiente', obs:r.obs||'' });
    setEditId(r.id);
  };

  const cambiarEstado = async (id,estado) => { await update(id,{estado}); toast(`Estado: ${EST_CFG[estado]?.label||estado}`); };

  if (loading) return <Skeleton rows={6}/>;

  const totalFacturado = data.filter(r=>r.estado!=='cancelado').reduce((s,r)=>s+(r.total||0),0);

  return (
    <div style={{ fontFamily:'inherit', maxWidth:1100 }}>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:'1.45rem', fontWeight:800, color:T.primary, margin:0 }}>Maquila</h1>
        <p style={{ fontSize:'.83rem', color:T.textMid, marginTop:4 }}>Registro y seguimiento de trabajos de maquila y procesamiento</p>
      </div>

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:14, marginBottom:24 }}>
        {[
          { label:'Total facturado',  val:`Q ${totalFacturado.toLocaleString('es-GT',{minimumFractionDigits:2})}`, color:T.primary   },
          { label:'En proceso',       val:data.filter(r=>r.estado==='procesando').length, color:'#6A1B9A' },
          { label:'Pendientes',       val:data.filter(r=>r.estado==='pendiente').length,  color:T.warn    },
          { label:'Total registros',  val:data.length, color:T.textMid },
        ].map(({label,val,color})=>(
          <div key={label} style={{ ...card, marginBottom:0, padding:'16px 20px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:'1.25rem', fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.primary, marginBottom:18, borderBottom:`2px solid ${T.primary}`, paddingBottom:8 }}>
          {editId ? 'Editar Maquila' : 'Registrar Maquila'}
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
          <label style={LS}>
            Producto *
            <select value={form.producto} onChange={e=>setForm(f=>({...f,producto:e.target.value}))} style={IS}>
              <option value="">— Seleccionar —</option>
              {productos.map(p=><option key={p.id||p.nombre} value={p.nombre}>{p.nombre}</option>)}
            </select>
          </label>
          <label style={LS}>Cantidad<input type="number" min="0" step="0.01" value={form.cantidad} onChange={e=>setForm(f=>({...f,cantidad:e.target.value}))} style={IS}/></label>
          <label style={LS}>
            Unidad
            <select value={form.unidad} onChange={e=>setForm(f=>({...f,unidad:e.target.value}))} style={IS}>
              {['lb','kg','caja','unidad','quintal'].map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label style={LS}>Precio maquila (Q/u)<input type="number" min="0" step="0.01" value={form.precioMaquila} onChange={e=>setForm(f=>({...f,precioMaquila:e.target.value}))} style={IS}/></label>
          <label style={LS}>
            Estado
            <select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))} style={IS}>
              {Object.entries(EST_CFG).map(([v,c])=><option key={v} value={v}>{c.label}</option>)}
            </select>
          </label>
          <div style={{ display:'flex', flexDirection:'column', gap:5, justifyContent:'flex-end' }}>
            <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.textMid }}>Total auto</div>
            <div style={{ padding:'10px 14px', background:`${T.primary}0C`, border:`1px solid ${T.primary}30`, borderRadius:6, fontSize:'1.05rem', fontWeight:800, color:T.primary }}>
              Q {calcTotal().toFixed(2)}
            </div>
          </div>
        </div>
        <label style={LS}>
          Observaciones
          <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} rows={2} style={{ ...IS, resize:'vertical' }} placeholder="Notas adicionales..."/>
        </label>
        <div style={{ display:'flex', gap:10, marginTop:16 }}>
          <button onClick={handleSave} disabled={saving} style={{ padding:'11px 28px', background:saving?'#6B6B60':T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor:saving?'not-allowed':'pointer' }}>
            {saving?'Guardando...':editId?'Actualizar':'Registrar'}
          </button>
          {editId && <button onClick={()=>{setEditId(null);setForm({...BLANK});}} style={{ padding:'11px 20px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, cursor:'pointer', color:T.textMid }}>Cancelar</button>}
        </div>
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary, marginBottom:16 }}>Historial ({data.length})</div>
        {data.length===0 ? <div style={{ textAlign:'center', padding:'40px 0', color:T.textMid }}>Sin registros de maquila</div> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Fecha','Cliente','Producto','Cantidad','P/U','Total','Estado','Acciones'].map(h=><th key={h} style={TH_S}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.slice(0,80).map((r,i)=>{
                  const cfg = EST_CFG[r.estado]||EST_CFG.pendiente;
                  const nextEst = cfg.next;
                  return (
                    <tr key={r.id}>
                      <td style={{ ...TD_S(i%2===1), fontWeight:600 }}>{r.fecha}</td>
                      <td style={TD_S(i%2===1)}>{r.cliente||'—'}</td>
                      <td style={TD_S(i%2===1)}>{r.producto||'—'}</td>
                      <td style={TD_S(i%2===1)}>{r.cantidad} {r.unidad}</td>
                      <td style={TD_S(i%2===1)}>Q {(parseFloat(r.precioMaquila)||0).toFixed(2)}</td>
                      <td style={{ ...TD_S(i%2===1), fontWeight:700, color:T.secondary }}>Q {(r.total||0).toFixed(2)}</td>
                      <td style={TD_S(i%2===1)}><EstadoChip estado={r.estado}/></td>
                      <td style={TD_S(i%2===1)}>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                          <button onClick={()=>startEdit(r)} style={{ padding:'3px 9px', background:T.primary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Editar</button>
                          {nextEst && (
                            <button onClick={()=>cambiarEstado(r.id,nextEst)} style={{ padding:'3px 9px', background:NEXT_BTN_COLOR[nextEst]||T.secondary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>
                              {NEXT_BTN_LABEL[nextEst]}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
