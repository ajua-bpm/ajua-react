// RechazosDespacho.jsx — Gestión de rechazos de despachos locales
// Bultos / cliente / precio estimado / comisiones / pago-crédito / PDF

import { useState, useEffect, useMemo, useRef } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useProductosCatalogo } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import { db, collection, getDocs, query } from '../../firebase';

// ── Tokens ────────────────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', danger: '#C62828', warn: '#E65100',
  info: '#1565C0', border: '#E0E0E0', textMid: '#6B6B60',
  textDark: '#1A1A18', bg: '#F9F9F7',
};
const IS   = { padding: '8px 11px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.88rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
const LS   = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em' };
const card = { background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 20, marginBottom: 20 };

const today   = () => new Date().toISOString().slice(0, 10);
const fmtQ    = n  => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
const fmtDate = s  => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const UNIDADES   = ['caja', 'bulto', 'quintal', 'lb', 'kg', 'unidad', 'lote'];
const BLANK_PROD = { producto: '', bultos: '', unidad: 'caja', precioEst: '' };
const BLANK = {
  fecha: today(),
  proveedorId: '', proveedorNombre: '', clienteNuevo: '',
  productos: [{ ...BLANK_PROD }],
  vendedor1Nombre: '', vendedor1Pct: '',
  vendedor2Nombre: '', vendedor2Pct: '',
  formaPago: 'efectivo', diasCredito: '', estadoCobro: 'pendiente',
  obs: '',
};

// ── PDF component ──────────────────────────────────────────────────────
function PdfRechazo({ rec, onClose }) {
  const hoy = new Date().toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
  const total    = (rec.productos || []).reduce((s, p) => s + (Number(p.bultos) || 0) * (Number(p.precioEst) || 0), 0);
  const com1     = total * ((Number(rec.vendedor1Pct) || 0) / 100);
  const com2     = total * ((Number(rec.vendedor2Pct) || 0) / 100);
  const neto     = total - com1 - com2;
  const cliente  = rec.proveedorNombre || rec.clienteNuevo || '—';

  return (
    <>
      <style>{`@media print { .no-print { display:none!important; } body { background:#fff!important; } }`}</style>
      {/* Backdrop */}
      <div className="no-print" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:3000 }} />
      {/* Botones */}
      <div className="no-print" style={{ position:'fixed', top:16, right:16, display:'flex', gap:10, zIndex:3100 }}>
        <button onClick={() => window.print()} style={{ padding:'9px 18px', borderRadius:8, border:'none', background:T.primary, color:'#fff', fontWeight:700, fontSize:'.9rem', cursor:'pointer' }}>
          🖨️ Imprimir / PDF
        </button>
        <button onClick={onClose} style={{ padding:'9px 14px', borderRadius:8, border:`1.5px solid ${T.border}`, background:'#fff', color:T.textMid, fontWeight:600, fontSize:'.9rem', cursor:'pointer' }}>
          ✕ Cerrar
        </button>
      </div>
      {/* Documento */}
      <div style={{ position:'fixed', inset:0, background:'#fff', zIndex:3050, overflowY:'auto', padding:'40px 48px', fontFamily:'Georgia, serif', color:T.textDark, fontSize:'13px', lineHeight:1.6 }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, borderBottom:`3px solid ${T.warn}`, paddingBottom:14 }}>
          <div>
            <div style={{ fontFamily:'Arial', fontSize:'1.5rem', fontWeight:900, letterSpacing:3, color:T.primary }}>AJÚA</div>
            <div style={{ fontSize:'11px', color:T.textMid }}>AGROINDUSTRIA AJÚA · Guatemala</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily:'Arial', fontSize:'1.1rem', fontWeight:700 }}>LIQUIDACIÓN DE RECHAZO</div>
            <div style={{ fontSize:'11px', color:T.textMid }}>Fecha: {fmtDate(rec.fecha)}</div>
            <div style={{ fontSize:'11px', color:T.textMid }}>Emitido: {hoy}</div>
          </div>
        </div>

        {/* Cliente */}
        <div style={{ background:'#F9F9F7', border:`1px solid ${T.border}`, borderRadius:6, padding:'10px 16px', marginBottom:20, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 24px' }}>
          <div><span style={{ fontWeight:700, fontSize:'11px', color:T.textMid, textTransform:'uppercase' }}>Cliente / Comprador: </span>{cliente}</div>
          <div><span style={{ fontWeight:700, fontSize:'11px', color:T.textMid, textTransform:'uppercase' }}>Forma de pago: </span>{rec.formaPago}</div>
          {rec.diasCredito > 0 && <div><span style={{ fontWeight:700, fontSize:'11px', color:T.textMid, textTransform:'uppercase' }}>Crédito: </span>{rec.diasCredito} días</div>}
          {rec.obs && <div style={{ gridColumn:'1/-1' }}><span style={{ fontWeight:700, fontSize:'11px', color:T.textMid, textTransform:'uppercase' }}>Obs: </span>{rec.obs}</div>}
        </div>

        {/* Tabla productos */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontFamily:'Arial', fontWeight:700, fontSize:'.75rem', textTransform:'uppercase', letterSpacing:'.1em', color:T.primary, marginBottom:8 }}>Detalle de Productos</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
            <thead>
              <tr style={{ background:'#F5F5F5', borderBottom:`2px solid ${T.border}` }}>
                {['Producto','Bultos','Unidad','Precio Est.','Subtotal'].map(h => (
                  <th key={h} style={{ padding:'7px 10px', textAlign: h === 'Bultos' || h === 'Precio Est.' || h === 'Subtotal' ? 'right' : 'left', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.textMid }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rec.productos || []).map((p, i) => {
                const sub = (Number(p.bultos) || 0) * (Number(p.precioEst) || 0);
                return (
                  <tr key={i} style={{ borderBottom:`1px solid ${T.border}`, background: i%2===0?'#fff':'#FAFAFA' }}>
                    <td style={{ padding:'7px 10px' }}>{p.producto || '—'}</td>
                    <td style={{ padding:'7px 10px', textAlign:'right' }}>{p.bultos || '—'}</td>
                    <td style={{ padding:'7px 10px' }}>{p.unidad}</td>
                    <td style={{ padding:'7px 10px', textAlign:'right' }}>{fmtQ(p.precioEst)}</td>
                    <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:700 }}>{fmtQ(sub)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Resumen financiero */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:32 }}>
          <div style={{ border:`1px solid ${T.border}`, borderRadius:6, padding:'12px 16px' }}>
            <div style={{ fontWeight:700, fontSize:'11px', textTransform:'uppercase', color:T.textMid, marginBottom:8 }}>Comisiones</div>
            {rec.vendedor1Nombre && <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:4 }}><span>{rec.vendedor1Nombre} ({rec.vendedor1Pct}%)</span><strong>{fmtQ(com1)}</strong></div>}
            {rec.vendedor2Nombre && <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:4 }}><span>{rec.vendedor2Nombre} ({rec.vendedor2Pct}%)</span><strong>{fmtQ(com2)}</strong></div>}
            {!rec.vendedor1Nombre && !rec.vendedor2Nombre && <div style={{ fontSize:'12px', color:T.textMid }}>Sin comisiones registradas</div>}
          </div>
          <div style={{ border:`1px solid ${T.border}`, borderRadius:6, padding:'12px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:4 }}><span>Total estimado</span><strong>{fmtQ(total)}</strong></div>
            {(com1 + com2) > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:4, color:T.danger }}><span>− Comisiones</span><strong>−{fmtQ(com1 + com2)}</strong></div>}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'14px', fontWeight:800, borderTop:`1.5px solid ${T.textDark}`, paddingTop:6, marginTop:6, color: neto >= 0 ? T.primary : T.danger }}>
              <span>NETO A RECIBIR</span><span>{fmtQ(neto)}</span>
            </div>
          </div>
        </div>

        {/* Firmas */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:40, marginTop:48 }}>
          {['Elaborado / AJÚA', rec.vendedor1Nombre || 'Vendedor 1', cliente].map(l => (
            <div key={l} style={{ textAlign:'center' }}>
              <div style={{ borderTop:`1.5px solid ${T.textDark}`, paddingTop:8, fontSize:'11px', color:T.textMid }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Botones dentro del doc */}
        <div className="no-print" style={{ marginTop:32, display:'flex', gap:10, justifyContent:'center' }}>
          <button onClick={() => window.print()} style={{ padding:'10px 24px', borderRadius:8, border:'none', background:T.primary, color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'Arial' }}>
            🖨️ Imprimir / PDF
          </button>
          <button onClick={onClose} style={{ padding:'10px 20px', borderRadius:8, border:`1.5px solid ${T.border}`, background:'#fff', color:T.textMid, fontWeight:600, cursor:'pointer', fontFamily:'Arial' }}>
            ✕ Cerrar
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default function RechazosDespacho() {
  const toast = useToast();
  const { productos: catProductos } = useProductosCatalogo();
  const { data: rechazos, loading }  = useCollection('vgtRechazos', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { add, remove, update, saving } = useWrite('vgtRechazos');

  const [form, setForm]         = useState({ ...BLANK, productos: [{ ...BLANK_PROD }] });
  const [proveedores, setProv]  = useState([]);
  const [provSearch, setPS]     = useState('');
  const [provSugs,   setProvSugs] = useState([]);
  const [pdfTarget,  setPdf]    = useState(null);
  const [filtEstado, setFE]     = useState('');   // '' | 'pendiente' | 'liquidado'
  const [expandId,   setExp]    = useState(null);
  const provRef = useRef(null);

  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Cargar proveedores una vez
  useEffect(() => {
    getDocs(query(collection(db, 'proveedores'))).then(snap => {
      setProv(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')));
    }).catch(() => {});
  }, []);

  // Autocomplete proveedor/cliente
  useEffect(() => {
    const q = provSearch.toLowerCase();
    if (!q) { setProvSugs([]); return; }
    setProvSugs(proveedores.filter(p => (p.nombre || '').toLowerCase().includes(q)).slice(0, 6));
  }, [provSearch, proveedores]);

  const selectProv = (p) => {
    setPS(p.nombre);
    s('proveedorId', p.id);
    s('proveedorNombre', p.nombre);
    s('clienteNuevo', '');
    setProvSugs([]);
  };

  const clearProv = () => {
    setPS(''); s('proveedorId', ''); s('proveedorNombre', ''); s('clienteNuevo', '');
  };

  // Calcs
  const totalEst = useMemo(() =>
    form.productos.reduce((s, p) => s + (Number(p.bultos) || 0) * (Number(p.precioEst) || 0), 0),
  [form.productos]);
  const com1    = totalEst * ((Number(form.vendedor1Pct) || 0) / 100);
  const com2    = totalEst * ((Number(form.vendedor2Pct) || 0) / 100);
  const neto    = totalEst - com1 - com2;

  const addProd    = () => s('productos', [...form.productos, { ...BLANK_PROD }]);
  const removeProd = i => s('productos', form.productos.filter((_, j) => j !== i));
  const setProd    = (i, k, v) => s('productos', form.productos.map((p, j) => j === i ? { ...p, [k]: v } : p));

  const handleSave = async () => {
    const cliente = form.proveedorNombre || form.clienteNuevo;
    if (!form.fecha || !cliente) { toast('Fecha y cliente son requeridos', 'error'); return; }
    if (!form.productos.some(p => p.producto && p.bultos)) { toast('Agrega al menos un producto con bultos', 'error'); return; }
    const payload = {
      ...form,
      productos: form.productos.map(p => ({
        ...p, bultos: Number(p.bultos) || 0, precioEst: Number(p.precioEst) || 0,
        subtotal: (Number(p.bultos) || 0) * (Number(p.precioEst) || 0),
      })),
      totalEst: parseFloat(totalEst.toFixed(2)),
      comision1: parseFloat(com1.toFixed(2)),
      comision2: parseFloat(com2.toFixed(2)),
      neto: parseFloat(neto.toFixed(2)),
      diasCredito: parseInt(form.diasCredito) || 0,
      estadoCobro: form.formaPago === 'credito' ? (form.estadoCobro || 'pendiente') : 'na',
      creadoEn: new Date().toISOString(),
    };
    try {
      await add(payload);
      toast('Rechazo registrado');
      setForm({ ...BLANK, productos: [{ ...BLANK_PROD }] });
      setPS(''); setProvSugs([]);
    } catch { toast('Error al guardar', 'error'); }
  };

  const handleLiquidar = async (id) => {
    try { await update(id, { estadoCobro: 'liquidado', fechaLiquidacion: new Date().toISOString() }); toast('Marcado como liquidado'); }
    catch { toast('Error', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este rechazo?')) return;
    try { await remove(id); toast('Eliminado'); }
    catch { toast('Error al eliminar', 'error'); }
  };

  // Filtro historial
  const rechazosVis = useMemo(() => {
    if (!filtEstado) return rechazos;
    if (filtEstado === 'pendiente') return rechazos.filter(r => r.estadoCobro === 'pendiente');
    if (filtEstado === 'liquidado') return rechazos.filter(r => r.estadoCobro === 'liquidado' || r.estadoCobro === 'na');
    return rechazos;
  }, [rechazos, filtEstado]);

  const totalPendiente = useMemo(() => rechazos.filter(r => r.estadoCobro === 'pendiente').reduce((s, r) => s + (r.neto || 0), 0), [rechazos]);

  return (
    <div>
      {/* Métricas */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:20 }}>
        {[
          { label:'Total rechazos', value: rechazos.length, color: T.textMid },
          { label:'Pendiente cobro', value: fmtQ(totalPendiente), color: T.warn },
        ].map(m => (
          <div key={m.label} style={{ ...card, marginBottom:0, flex:'1 1 140px', borderTop:`3px solid ${m.color}`, padding:'14px 18px' }}>
            <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.textMid, marginBottom:4 }}>{m.label}</div>
            <div style={{ fontSize:'1.2rem', fontWeight:800, color:m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Formulario */}
      <div style={{ ...card, borderLeft:`4px solid ${T.warn}` }}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.textDark, marginBottom:16, paddingBottom:12, borderBottom:`1px solid ${T.border}` }}>
          Registrar Rechazo
        </div>

        {/* Fecha */}
        <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:14, marginBottom:14 }}>
          <label style={LS}>Fecha<input type="date" value={form.fecha} onChange={e => s('fecha', e.target.value)} style={IS} /></label>

          {/* Buscar proveedor o cliente nuevo */}
          <div ref={provRef} style={{ position:'relative' }}>
            <label style={LS}>
              Cliente / Comprador
              <div style={{ display:'flex', gap:8 }}>
                <div style={{ flex:1, position:'relative' }}>
                  <input
                    type="text"
                    value={provSearch}
                    onChange={e => { setPS(e.target.value); s('proveedorId', ''); s('proveedorNombre', ''); s('clienteNuevo', e.target.value); }}
                    placeholder="Buscar proveedor o escribir nuevo cliente..."
                    style={{ ...IS, borderColor: form.proveedorId ? T.primary : T.border }}
                  />
                  {form.proveedorId && (
                    <button onClick={clearProv} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                      background:'none', border:'none', cursor:'pointer', color:T.textMid, fontSize:'.9rem' }}>✕</button>
                  )}
                  {/* Sugerencias */}
                  {provSugs.length > 0 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff',
                      border:`1.5px solid ${T.primary}`, borderTop:'none', borderRadius:'0 0 6px 6px',
                      boxShadow:'0 4px 12px rgba(0,0,0,.12)', zIndex:200, maxHeight:200, overflowY:'auto' }}>
                      {provSugs.map(p => (
                        <div key={p.id} onClick={() => selectProv(p)}
                          style={{ padding:'9px 12px', cursor:'pointer', fontSize:'.88rem',
                            borderBottom:`1px solid ${T.border}` }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                          <strong>{p.nombre}</strong>
                          {p.nit && <span style={{ fontSize:'.75rem', color:T.textMid, marginLeft:8 }}>NIT: {p.nit}</span>}
                        </div>
                      ))}
                      <div onClick={() => { s('clienteNuevo', provSearch); s('proveedorId', ''); s('proveedorNombre', ''); setProvSugs([]); }}
                        style={{ padding:'9px 12px', cursor:'pointer', fontSize:'.82rem', color:T.info, fontWeight:600 }}>
                        + Usar "{provSearch}" como cliente nuevo
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {form.proveedorId && (
                <span style={{ fontSize:'.72rem', color:T.primary, fontWeight:700 }}>✓ Proveedor vinculado: {form.proveedorNombre}</span>
              )}
              {form.clienteNuevo && !form.proveedorId && (
                <span style={{ fontSize:'.72rem', color:T.info }}>Cliente nuevo: {form.clienteNuevo}</span>
              )}
            </label>
          </div>
        </div>

        {/* Productos */}
        <div style={{ fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', color:T.warn, letterSpacing:'.08em', marginBottom:8 }}>
          PRODUCTOS (precio estimado — va a mercado, editable)
        </div>
        <div style={{ border:`1px solid ${T.border}`, borderRadius:8, overflow:'hidden', marginBottom:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 80px 80px 110px 90px 28px',
            background:'#FFF3E0', padding:'8px 10px', fontSize:'.68rem', fontWeight:700,
            color:T.warn, textTransform:'uppercase', letterSpacing:'.04em' }}>
            <span>Producto</span><span>Bultos</span><span>Unidad</span><span>Precio est. Q</span><span style={{ textAlign:'right' }}>Subtotal</span><span />
          </div>
          {form.productos.map((p, i) => {
            const sub = (Number(p.bultos) || 0) * (Number(p.precioEst) || 0);
            return (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 80px 80px 110px 90px 28px',
                padding:'6px 10px', borderTop:'1px solid #F0F0F0', alignItems:'center', gap:5 }}>
                <input type="text" list="rech-prods" value={p.producto}
                  onChange={e => setProd(i, 'producto', e.target.value)}
                  placeholder="Producto..." style={{ ...IS, fontSize:'.82rem', padding:'5px 7px' }} />
                <datalist id="rech-prods">
                  {catProductos.map(c => <option key={c.id} value={c.nombre} />)}
                </datalist>
                <input type="number" min="0" value={p.bultos}
                  onChange={e => setProd(i, 'bultos', e.target.value)}
                  placeholder="0" style={{ ...IS, fontSize:'.82rem', padding:'5px 7px' }} />
                <select value={p.unidad} onChange={e => setProd(i, 'unidad', e.target.value)}
                  style={{ ...IS, fontSize:'.82rem', padding:'5px 7px' }}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <input type="number" min="0" step="0.01" value={p.precioEst}
                  onChange={e => setProd(i, 'precioEst', e.target.value)}
                  placeholder="0.00" style={{ ...IS, fontSize:'.82rem', padding:'5px 7px' }} />
                <span style={{ fontSize:'.82rem', fontWeight:700, color:T.warn, textAlign:'right', paddingRight:4 }}>
                  Q {Number(sub).toLocaleString('es-GT', { minimumFractionDigits:0 })}
                </span>
                {form.productos.length > 1 && (
                  <button onClick={() => removeProd(i)} style={{ background:'none', border:'none', color:T.danger, cursor:'pointer', fontWeight:700, fontSize:'1rem', padding:0 }}>×</button>
                )}
              </div>
            );
          })}
          <div style={{ padding:'8px 10px', borderTop:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', background:'#FAFAFA' }}>
            <button onClick={addProd} style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:4, padding:'5px 12px', fontSize:'.78rem', fontWeight:600, cursor:'pointer', color:T.textMid }}>
              + Agregar producto
            </button>
            <div style={{ fontWeight:800, fontSize:'1rem', color:T.warn }}>Total est.: {fmtQ(totalEst)}</div>
          </div>
        </div>

        {/* Comisiones */}
        <div style={{ fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', color:T.primary, letterSpacing:'.08em', marginBottom:10 }}>
          COMISIONES VENDEDORES
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12, marginBottom:14 }}>
          <div style={{ border:`1px solid ${T.border}`, borderRadius:8, padding:'12px 14px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:700, color:T.textMid, marginBottom:8 }}>Vendedor 1</div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:8 }}>
              <label style={LS}>Nombre<input value={form.vendedor1Nombre} onChange={e => s('vendedor1Nombre', e.target.value)} placeholder="Nombre vendedor" style={IS} /></label>
              <label style={LS}>% Com.<input type="number" min="0" max="100" step="0.5" value={form.vendedor1Pct} onChange={e => s('vendedor1Pct', e.target.value)} placeholder="0" style={IS} /></label>
            </div>
            {com1 > 0 && <div style={{ fontSize:'.8rem', color:T.danger, fontWeight:700, marginTop:6 }}>Comisión: {fmtQ(com1)}</div>}
          </div>
          <div style={{ border:`1px solid ${T.border}`, borderRadius:8, padding:'12px 14px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:700, color:T.textMid, marginBottom:8 }}>Vendedor 2 (opcional)</div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:8 }}>
              <label style={LS}>Nombre<input value={form.vendedor2Nombre} onChange={e => s('vendedor2Nombre', e.target.value)} placeholder="Nombre vendedor" style={IS} /></label>
              <label style={LS}>% Com.<input type="number" min="0" max="100" step="0.5" value={form.vendedor2Pct} onChange={e => s('vendedor2Pct', e.target.value)} placeholder="0" style={IS} /></label>
            </div>
            {com2 > 0 && <div style={{ fontSize:'.8rem', color:T.danger, fontWeight:700, marginTop:6 }}>Comisión: {fmtQ(com2)}</div>}
          </div>
        </div>

        {/* Resumen neto */}
        {totalEst > 0 && (
          <div style={{ background:'#FFF3E0', border:`1px solid #FFCC80`, borderRadius:8, padding:'12px 16px', marginBottom:14,
            display:'flex', gap:20, flexWrap:'wrap', fontSize:'.88rem' }}>
            <span>Total estimado: <strong style={{ color:T.warn }}>{fmtQ(totalEst)}</strong></span>
            {(com1 + com2) > 0 && <span style={{ color:T.danger }}>− Comisiones: <strong>{fmtQ(com1 + com2)}</strong></span>}
            <span style={{ fontWeight:800, color: neto >= 0 ? T.primary : T.danger }}>
              NETO: <strong>{fmtQ(neto)}</strong>
            </span>
          </div>
        )}

        {/* Pago / Crédito */}
        <div style={{ fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', color:T.primary, letterSpacing:'.08em', marginBottom:10 }}>
          PAGO / CRÉDITO
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:14, marginBottom:14 }}>
          <label style={LS}>
            Forma de pago
            <select value={form.formaPago} onChange={e => s('formaPago', e.target.value)} style={IS}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="credito">Crédito</option>
            </select>
          </label>
          {form.formaPago === 'credito' && (<>
            <label style={LS}>Días de crédito<input type="number" min="0" value={form.diasCredito} onChange={e => s('diasCredito', e.target.value)} placeholder="0" style={IS} /></label>
            <label style={LS}>
              Estado cobro
              <select value={form.estadoCobro} onChange={e => s('estadoCobro', e.target.value)} style={IS}>
                <option value="pendiente">⏳ Pendiente</option>
                <option value="liquidado">✅ Liquidado</option>
              </select>
            </label>
          </>)}
        </div>

        <label style={{ ...LS, marginBottom:16 }}>
          Observaciones
          <textarea value={form.obs} onChange={e => s('obs', e.target.value)} rows={2}
            style={{ ...IS, resize:'vertical' }} placeholder="Notas del rechazo..." />
        </label>

        <button onClick={handleSave} disabled={saving}
          style={{ padding:'11px 28px', background: saving ? '#BDBDBD' : T.warn, color:'#fff', border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Guardando...' : '⚠️ Registrar Rechazo'}
        </button>
      </div>

      {/* Historial */}
      <div style={card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:'.9rem', color:T.textDark }}>
            Historial Rechazos ({rechazosVis.length})
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {['','pendiente','liquidado'].map(v => (
              <button key={v} onClick={() => setFE(v)} style={{
                padding:'5px 12px', borderRadius:6, fontSize:'.75rem', fontWeight:700, cursor:'pointer', border:'none',
                background: filtEstado === v ? T.primary : '#F5F5F5',
                color: filtEstado === v ? '#fff' : T.textMid,
              }}>
                {v === '' ? 'Todos' : v === 'pendiente' ? '⏳ Pendiente' : '✅ Liquidado'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'32px', color:T.textMid }}>Cargando...</div>
        ) : rechazosVis.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px', color:T.textMid, fontSize:'.88rem' }}>Sin rechazos registrados.</div>
        ) : rechazosVis.map((r, i) => {
          const open    = expandId === r.id;
          const cliente = r.proveedorNombre || r.clienteNuevo || '—';
          const prodStr = (r.productos || []).map(p => `${p.producto} (${p.bultos} ${p.unidad})`).join(', ');
          const isPend  = r.estadoCobro === 'pendiente';

          return (
            <div key={r.id} style={{ border:`1px solid ${T.border}`, borderRadius:10, marginBottom:8, overflow:'hidden' }}>
              {/* Fila principal */}
              <div onClick={() => setExp(open ? null : r.id)} style={{
                padding:'11px 14px', display:'flex', alignItems:'center', gap:10,
                cursor:'pointer', background: i%2===0 ? '#fff' : T.bg,
              }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:'.78rem', color:T.textMid, whiteSpace:'nowrap' }}>{fmtDate(r.fecha)}</span>
                    <span style={{ fontWeight:700, fontSize:'.85rem', color:T.textDark }}>{cliente}</span>
                    {isPend && <span style={{ background:'#FFF3E0', color:T.warn, borderRadius:99, padding:'1px 8px', fontSize:'.68rem', fontWeight:700 }}>⏳ Pendiente</span>}
                    {r.estadoCobro === 'liquidado' && <span style={{ background:'#E8F5E9', color:T.primary, borderRadius:99, padding:'1px 8px', fontSize:'.68rem', fontWeight:700 }}>✅ Liquidado</span>}
                  </div>
                  <div style={{ fontSize:'.75rem', color:T.textMid, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{prodStr}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontWeight:800, fontSize:'.95rem', color: (r.neto || 0) >= 0 ? T.primary : T.danger }}>{fmtQ(r.neto)}</div>
                  <div style={{ fontSize:'.72rem', color:T.textMid }}>neto</div>
                </div>
                <span style={{ color:T.textMid, fontSize:'.8rem' }}>{open ? '▲' : '▼'}</span>
              </div>

              {/* Detalle expandido */}
              {open && (
                <div style={{ background:T.bg, borderTop:`1px solid ${T.border}`, padding:'14px 16px' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'6px 20px', fontSize:'.82rem', color:T.textMid, marginBottom:12 }}>
                    <div>Total est.: <strong style={{ color:T.warn }}>{fmtQ(r.totalEst)}</strong></div>
                    <div>Comisiones: <strong style={{ color:T.danger }}>{fmtQ((r.comision1 || 0) + (r.comision2 || 0))}</strong></div>
                    <div>Pago: <strong>{r.formaPago}</strong>{r.diasCredito > 0 && ` (${r.diasCredito} días)`}</div>
                    {r.vendedor1Nombre && <div>V1 {r.vendedor1Nombre}: <strong>{fmtQ(r.comision1)}</strong> ({r.vendedor1Pct}%)</div>}
                    {r.vendedor2Nombre && <div>V2 {r.vendedor2Nombre}: <strong>{fmtQ(r.comision2)}</strong> ({r.vendedor2Pct}%)</div>}
                    {r.obs && <div style={{ gridColumn:'1/-1' }}>Obs: <em>{r.obs}</em></div>}
                  </div>

                  {/* Productos detalle */}
                  <div style={{ marginBottom:12 }}>
                    {(r.productos || []).map((p, j) => (
                      <div key={j} style={{ display:'flex', gap:12, fontSize:'.8rem', padding:'4px 0', borderBottom:`1px solid ${T.border}` }}>
                        <span style={{ flex:2, fontWeight:600, color:T.textDark }}>{p.producto}</span>
                        <span style={{ flex:1 }}>{p.bultos} {p.unidad}</span>
                        <span style={{ flex:1 }}>{fmtQ(p.precioEst)}/u</span>
                        <span style={{ flex:1, fontWeight:700, color:T.warn, textAlign:'right' }}>{fmtQ(p.subtotal || (p.bultos * p.precioEst))}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button onClick={() => setPdf(r)} style={{ padding:'6px 14px', borderRadius:6, border:`1px solid ${T.primary}`, background:'#fff', color:T.primary, fontSize:'.78rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      🖨️ PDF
                    </button>
                    {isPend && (
                      <button onClick={() => handleLiquidar(r.id)} style={{ padding:'6px 14px', borderRadius:6, border:`1px solid ${T.primary}`, background:T.primary, color:'#fff', fontSize:'.78rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                        ✅ Marcar liquidado
                      </button>
                    )}
                    <button onClick={() => handleDelete(r.id)} style={{ padding:'6px 12px', borderRadius:6, border:`1px solid ${T.danger}`, background:'#fff', color:T.danger, fontSize:'.78rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* PDF modal */}
      {pdfTarget && <PdfRechazo rec={pdfTarget} onClose={() => setPdf(null)} />}
    </div>
  );
}
