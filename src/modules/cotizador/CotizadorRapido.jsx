import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
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

const BLANK = { producto:'', unidad:'lb', costo:'', margen:'30', precioVenta:'', notas:'' };

const calcPrecio = (costo, margen) => {
  const c = parseFloat(costo)||0;
  const m = parseFloat(margen)||0;
  return c > 0 && m < 100 ? (c / (1 - m/100)).toFixed(4) : '';
};

export default function CotizadorRapido() {
  const toast = useToast();
  const { data, loading } = useCollection('cotizadorRapido', { orderField:'producto', limit:200 });
  const { add, update, remove, saving } = useWrite('cotizadorRapido');

  const [form, setForm]       = useState({ ...BLANK });
  const [editId, setEditId]   = useState(null);
  const [quick, setQuick]     = useState({ costo:'', margen:'30', cantidad:'1' });

  // Live calc for save form
  const handleCosto = (val) => {
    const precio = calcPrecio(val, form.margen);
    setForm(p => ({ ...p, costo:val, precioVenta:precio }));
  };
  const handleMargen = (val) => {
    const precio = calcPrecio(form.costo, val);
    setForm(p => ({ ...p, margen:val, precioVenta:precio }));
  };
  const handlePrecio = (val) => {
    const c = parseFloat(form.costo)||0;
    const p = parseFloat(val)||0;
    const margen = c>0 && p>0 ? ((1-c/p)*100).toFixed(1) : form.margen;
    setForm(p2 => ({ ...p2, precioVenta:val, margen }));
  };

  const handleSave = async () => {
    if (!form.producto || !form.costo) { toast('Producto y costo son requeridos','error'); return; }
    const payload = { ...form, costo:parseFloat(form.costo)||0, margen:parseFloat(form.margen)||0, precioVenta:parseFloat(form.precioVenta)||0 };
    if (editId) { await update(editId, payload); toast('Producto actualizado'); setEditId(null); }
    else { await add(payload); toast('Producto guardado'); }
    setForm({ ...BLANK });
  };

  const startEdit = (r) => {
    setForm({ producto:r.producto||'', unidad:r.unidad||'lb', costo:String(r.costo||''), margen:String(r.margen||'30'), precioVenta:String(r.precioVenta||''), notas:r.notas||'' });
    setEditId(r.id);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return;
    await remove(id); toast('Producto eliminado');
  };

  // Quick calc values
  const qPrecio = calcPrecio(quick.costo, quick.margen);
  const qTotal  = (parseFloat(qPrecio)||0) * (parseFloat(quick.cantidad)||1);

  return (
    <div style={{ fontFamily:'inherit', maxWidth:1100 }}>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:'1.45rem', fontWeight:800, color:T.primary, margin:0 }}>Cotizador Rápido</h1>
        <p style={{ fontSize:'.83rem', color:T.textMid, marginTop:4 }}>Cálculo de precios de venta en tiempo real</p>
      </div>

      {/* ── SECCIÓN A: CALCULADORA RÁPIDA ──────────────────────────────────── */}
      <div style={{
        background:`linear-gradient(135deg,${T.primary}08 0%,${T.secondary}12 100%)`,
        border:`2px solid ${T.secondary}`,
        borderRadius:10, padding:22, marginBottom:22,
      }}>
        <div style={{ fontWeight:700, fontSize:'.92rem', color:T.primary, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ background:T.primary, color:T.white, borderRadius:4, padding:'2px 8px', fontSize:'.72rem', fontWeight:800, letterSpacing:'.06em' }}>SIN GUARDAR</span>
          Calculadora Rápida
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:14, alignItems:'flex-end', marginBottom:16 }}>
          <label style={LS}>
            Costo (Q/lb)
            <input type="number" min="0" step="0.0001" value={quick.costo} onChange={e=>setQuick(q=>({...q,costo:e.target.value}))} placeholder="0.0000"
              style={{ ...IS, border:`1.5px solid ${T.secondary}` }}/>
          </label>
          <label style={LS}>
            Margen (%)
            <input type="number" min="0" max="99" step="0.1" value={quick.margen} onChange={e=>setQuick(q=>({...q,margen:e.target.value}))} placeholder="30"
              style={{ ...IS, border:`1.5px solid ${T.secondary}` }}/>
          </label>
          <label style={LS}>
            Cantidad
            <input type="number" min="1" step="1" value={quick.cantidad} onChange={e=>setQuick(q=>({...q,cantidad:e.target.value}))} placeholder="1"
              style={{ ...IS, border:`1.5px solid ${T.secondary}` }}/>
          </label>
        </div>
        {/* Result box */}
        <div style={{
          background:T.primary, borderRadius:8, padding:'16px 24px',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:24, flexWrap:'wrap',
        }}>
          <div>
            <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'rgba(255,255,255,.7)', marginBottom:4 }}>Precio de venta</div>
            <div style={{ fontSize:'1.6rem', fontWeight:800, color:T.white, fontFamily:'inherit' }}>
              Q {parseFloat(qPrecio||0).toFixed(4)}
            </div>
          </div>
          <div style={{ width:1, height:40, background:'rgba(255,255,255,.25)' }}/>
          <div>
            <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'rgba(255,255,255,.7)', marginBottom:4 }}>Total</div>
            <div style={{ fontSize:'1.6rem', fontWeight:800, color:'#A5D6A7', fontFamily:'inherit' }}>
              Q {qTotal.toFixed(2)}
            </div>
          </div>
          <div>
            <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'rgba(255,255,255,.7)', marginBottom:4 }}>Ganancia/u</div>
            <div style={{ fontSize:'1.1rem', fontWeight:700, color:'#C8E6C9' }}>
              Q {(parseFloat(qPrecio||0) - (parseFloat(quick.costo)||0)).toFixed(4)}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN B: GUARDAR PRODUCTO ────────────────────────────────────── */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.primary, marginBottom:18, borderBottom:`2px solid ${T.primary}`, paddingBottom:8 }}>
          {editId ? 'Editar Producto' : 'Guardar Producto en Cotizador'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:14, marginBottom:14 }}>
          <label style={LS}>Producto *<input value={form.producto} onChange={e=>setForm(p=>({...p,producto:e.target.value}))} placeholder="Nombre del producto" style={IS}/></label>
          <label style={LS}>
            Unidad
            <select value={form.unidad} onChange={e=>setForm(p=>({...p,unidad:e.target.value}))} style={IS}>
              {['lb','kg','caja','unidad'].map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label style={LS}>
            Costo (Q/u)
            <input type="number" min="0" step="0.0001" value={form.costo} onChange={e=>handleCosto(e.target.value)} placeholder="0.0000" style={IS}/>
          </label>
          <label style={LS}>
            Margen (%)
            <input type="number" min="0" max="99" step="0.1" value={form.margen} onChange={e=>handleMargen(e.target.value)} placeholder="30" style={IS}/>
          </label>
          <label style={LS}>
            Precio venta (Q/u)
            <input type="number" min="0" step="0.0001" value={form.precioVenta} onChange={e=>handlePrecio(e.target.value)} placeholder="0.0000"
              style={{ ...IS, fontWeight:800, color:T.primary, fontSize:'.95rem' }}/>
          </label>
          <label style={LS}>Notas<input value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} placeholder="Opcional" style={IS}/></label>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={handleSave} disabled={saving} style={{
            padding:'11px 28px', background:saving?'#6B6B60':T.primary, color:T.white,
            border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor:saving?'not-allowed':'pointer',
          }}>
            {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Guardar Producto'}
          </button>
          {editId && (
            <button onClick={()=>{setEditId(null);setForm({...BLANK});}} style={{ padding:'11px 20px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, cursor:'pointer', color:T.textMid }}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* ── TABLA DE PRODUCTOS GUARDADOS ───────────────────────────────────── */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary, marginBottom:16 }}>
          Productos guardados ({data.length})
        </div>
        {loading ? <Skeleton rows={5}/> : (
          data.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:T.textMid, fontSize:'.9rem' }}>
              Sin productos guardados aún
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['Producto','Unidad','Costo','Margen','Precio Venta','Ganancia/u','Acciones'].map(h=>(
                      <th key={h} style={TH_S}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((r,i)=>{
                    const ganancia = (r.precioVenta||0)-(r.costo||0);
                    return (
                      <tr key={r.id}>
                        <td style={{ ...TD_S(i%2===1), fontWeight:600 }}>{r.producto}</td>
                        <td style={TD_S(i%2===1)}>{r.unidad||'lb'}</td>
                        <td style={TD_S(i%2===1)}>Q {(r.costo||0).toFixed(4)}</td>
                        <td style={{ ...TD_S(i%2===1), fontWeight:700, color:T.secondary }}>{r.margen||0}%</td>
                        <td style={{ ...TD_S(i%2===1), fontWeight:800, color:T.primary, fontSize:'.88rem' }}>Q {(r.precioVenta||0).toFixed(4)}</td>
                        <td style={{ ...TD_S(i%2===1), fontWeight:700, color:T.secondary }}>Q {ganancia.toFixed(4)}</td>
                        <td style={TD_S(i%2===1)}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={()=>startEdit(r)} style={{ padding:'3px 10px', background:T.primary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Editar</button>
                            <button onClick={()=>handleDelete(r.id)} style={{ padding:'3px 10px', background:T.danger, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
