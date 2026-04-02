import { useState, useMemo, useRef } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';
import RechazoForm from '../comprasLocales/RechazoForm';

const T = {
  primary:'#1B5E20', secondary:'#2E7D32', accent:'#43A047',
  danger:'#C62828',  warn:'#E65100',
  textDark:'#1A1A18', textMid:'#6B6B60',
  border:'#E0E0E0', bgLight:'#F5F5F5',
  white:'#FFFFFF', bgGreen:'#E8F5E9',
};

const card = { background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:24, marginBottom:20 };
const TH   = { padding:'10px 14px', fontSize:'.72rem', textTransform:'uppercase', fontWeight:700, letterSpacing:'.06em', color:T.white, background:T.primary, textAlign:'left', whiteSpace:'nowrap' };
const TD   = (alt) => ({ padding:'9px 14px', fontSize:'.83rem', borderBottom:'1px solid #F0F0F0', background: alt ? '#F9FBF9' : '#fff', color:T.textDark });
const LS   = { display:'flex', flexDirection:'column', gap:4, fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid };
const IS   = { padding:'9px 11px', border:`1.5px solid ${T.border}`, borderRadius:5, fontSize:'.87rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:3, color:T.textDark, background:T.white };

const today = () => new Date().toISOString().slice(0, 10);
const fmtQ  = n => Number(n||0).toLocaleString('es-GT', { minimumFractionDigits:2 });
const pct   = (part, total) => total > 0 ? Math.round(part / total * 100) : 0;

const MOTIVOS = [
  { key:'tamano',       label:'Tamaño',          color:'#1565C0', bg:'#E3F2FD' },
  { key:'pudre',        label:'Pudre / Podredumbre', color:'#6A1B9A', bg:'#F3E5F5' },
  { key:'calidad',      label:'Calidad',          color:T.warn,    bg:'#FFF3E0' },
  { key:'danoMecanico', label:'Daño Mecánico',    color:T.danger,  bg:'#FFEBEE' },
  { key:'enfermedad',   label:'Enfermedad',       color:'#558B2F', bg:'#F1F8E9' },
  { key:'otro',         label:'Otro',             color:T.textMid, bg:T.bgLight },
];

const UNIDADES = ['KG','LB','Caja','Quintal','Unidad','Bandeja'];

const BLANK_RECHAZO = Object.fromEntries(MOTIVOS.map(m => [m.key, '']));
const BLANK = {
  fecha: today(), proveedor:'', producto:'', unidad:'KG',
  precioRef:'', totalRecibido:'', responsable:'', obs:'',
  ...BLANK_RECHAZO,
};

// ── Hook: carga proveedores e iProductos ────────────────────────────────────
function useProveedores() {
  const { data, loading } = useCollection('iclientes', { orderField:'nombre', limit:300 });
  // También buscar en la colección proveedores si existe
  const { data: prov2, loading: l2 } = useCollection('proveedores', { orderField:'nombre', limit:300 });
  const merged = useMemo(() => {
    const seen = new Set();
    const list = [];
    [...(data||[]), ...(prov2||[])].forEach(p => {
      const key = (p.nombre||'').toLowerCase().trim();
      if (p.nombre && !seen.has(key)) { seen.add(key); list.push(p); }
    });
    return list.sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));
  }, [data, prov2]);
  return { proveedores: merged, loading: loading || l2 };
}

// ── Componente de impresión ─────────────────────────────────────────────────
function ReportePrint({ rec, onClose }) {
  const rechazos = MOTIVOS.filter(m => (rec[m.key]||0) > 0);
  const totalRechazado = MOTIVOS.reduce((s,m) => s+(Number(rec[m.key])||0), 0);
  const totalAceptado  = Math.max(0, (Number(rec.totalRecibido)||0) - totalRechazado);
  const pctRechazo     = pct(totalRechazado, Number(rec.totalRecibido)||0);
  const pctAceptado    = pct(totalAceptado,  Number(rec.totalRecibido)||0);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px 16px', overflowY:'auto' }}>
      <div style={{ background:'#fff', width:'100%', maxWidth:720, borderRadius:6, overflow:'hidden' }}>

        {/* Toolbar — no se imprime */}
        <div className="no-print" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', background:T.bgLight, borderBottom:`1px solid ${T.border}` }}>
          <span style={{ fontWeight:700, color:T.primary, fontSize:'.9rem' }}>Vista previa — Reporte de Recepción</span>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => window.print()} style={{ padding:'7px 18px', background:T.primary, color:'#fff', border:'none', borderRadius:5, fontWeight:700, fontSize:'.83rem', cursor:'pointer' }}>🖨 Imprimir / PDF</button>
            <button onClick={onClose} style={{ padding:'7px 14px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:5, fontWeight:600, fontSize:'.83rem', cursor:'pointer', color:T.textMid }}>Cerrar</button>
          </div>
        </div>

        {/* Contenido imprimible */}
        <div id="reporte-recepcion" style={{ padding:'32px 40px', fontFamily:"'Inter', sans-serif" }}>

          {/* Encabezado */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28, borderBottom:`2px solid ${T.primary}`, paddingBottom:16 }}>
            <div>
              <div style={{ fontSize:'1.5rem', fontWeight:800, color:T.primary, letterSpacing:'2px', marginBottom:4 }}>AJÚA</div>
              <div style={{ fontSize:'11px', color:T.textMid, letterSpacing:'1px', textTransform:'uppercase' }}>Agroindustria AJÚA · Guatemala</div>
              <div style={{ fontSize:'11px', color:T.textMid, marginTop:2 }}>agroajua@gmail.com</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:'13px', fontWeight:700, color:T.textDark, marginBottom:2 }}>Reporte de Recepción de Producto</div>
              <div style={{ fontSize:'12px', color:T.textMid }}>Fecha: {rec.fecha}</div>
              <div style={{ fontSize:'12px', color:T.textMid, marginTop:2 }}>Folio: REC-{rec.id?.slice(-6)?.toUpperCase() || '------'}</div>
            </div>
          </div>

          {/* Datos generales */}
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:24, fontSize:'12px' }}>
            <tbody>
              {[
                ['Proveedor',          rec.proveedor   || '—'],
                ['Producto',           rec.producto    || '—'],
                ['Unidad',             rec.unidad      || '—'],
                ['Precio referencia',  rec.precioRef ? `Q ${fmtQ(rec.precioRef)} / ${rec.unidad}` : '—'],
                ['Responsable',        rec.responsable || '—'],
              ].map(([label, val]) => (
                <tr key={label}>
                  <td style={{ padding:'6px 10px', fontWeight:700, color:T.textMid, width:'35%', borderBottom:`1px solid #F0F0F0`, textTransform:'uppercase', fontSize:'10px', letterSpacing:'.05em' }}>{label}</td>
                  <td style={{ padding:'6px 10px', color:T.textDark, borderBottom:`1px solid #F0F0F0` }}>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Cantidades resumen */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
            {[
              { label:'Total Recibido', val:`${rec.totalRecibido||0} ${rec.unidad}`, color:T.textDark, border:T.primary },
              { label:'Aceptado',       val:`${totalAceptado} ${rec.unidad}  (${pctAceptado}%)`, color:T.secondary, border:T.secondary },
              { label:'Rechazado',      val:`${totalRechazado} ${rec.unidad}  (${pctRechazo}%)`, color:pctRechazo > 20 ? T.danger : T.warn, border:pctRechazo > 20 ? T.danger : T.warn },
            ].map(({ label, val, color, border }) => (
              <div key={label} style={{ border:`2px solid ${border}`, borderRadius:5, padding:'12px 14px', textAlign:'center' }}>
                <div style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:T.textMid, marginBottom:6 }}>{label}</div>
                <div style={{ fontSize:'18px', fontWeight:800, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Detalle de rechazos */}
          {rechazos.length > 0 && (
            <>
              <div style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:T.primary, marginBottom:10, borderBottom:`1px solid ${T.border}`, paddingBottom:6 }}>
                Detalle de Rechazos
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:24, fontSize:'12px' }}>
                <thead>
                  <tr style={{ background:T.primary }}>
                    {['Motivo','Cantidad','% del total recibido','% del total rechazado'].map(h => (
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#fff', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rechazos.map((m, i) => {
                    const qty = Number(rec[m.key])||0;
                    return (
                      <tr key={m.key} style={{ background: i%2===0 ? '#fff' : '#F9F9F9' }}>
                        <td style={{ padding:'8px 12px', fontWeight:600, borderBottom:`1px solid #F0F0F0` }}>{m.label}</td>
                        <td style={{ padding:'8px 12px', borderBottom:`1px solid #F0F0F0` }}>{qty} {rec.unidad}</td>
                        <td style={{ padding:'8px 12px', borderBottom:`1px solid #F0F0F0`, fontWeight:700, color:m.color }}>{pct(qty, Number(rec.totalRecibido)||0)}%</td>
                        <td style={{ padding:'8px 12px', borderBottom:`1px solid #F0F0F0`, fontWeight:700 }}>{pct(qty, totalRechazado)}%</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background:'#F0F4F0' }}>
                    <td style={{ padding:'8px 12px', fontWeight:800, color:T.primary }}>TOTAL RECHAZADO</td>
                    <td style={{ padding:'8px 12px', fontWeight:800, color:T.danger }}>{totalRechazado} {rec.unidad}</td>
                    <td style={{ padding:'8px 12px', fontWeight:800, color:T.danger }}>{pctRechazo}%</td>
                    <td style={{ padding:'8px 12px', fontWeight:800 }}>100%</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {/* Observaciones */}
          {rec.obs && (
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:T.textMid, marginBottom:6 }}>Observaciones</div>
              <div style={{ fontSize:'12px', color:T.textDark, background:T.bgLight, padding:'10px 14px', borderRadius:4, lineHeight:1.6 }}>{rec.obs}</div>
            </div>
          )}

          {/* Firmas */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:40, marginTop:40, paddingTop:20, borderTop:`1px solid ${T.border}` }}>
            {['Recibido por / Responsable AJÚA', 'Representante del Proveedor'].map(label => (
              <div key={label} style={{ textAlign:'center' }}>
                <div style={{ borderTop:`1px solid ${T.textDark}`, paddingTop:8, fontSize:'10px', color:T.textMid, letterSpacing:'.05em', textTransform:'uppercase' }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop:24, textAlign:'center', fontSize:'10px', color:T.textMid }}>
            Documento generado por Sistema AJÚA BPM · app.agroajua.com · {new Date().toLocaleDateString('es-GT')}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(#print-root) { display: none !important; }
          .no-print { display: none !important; }
          #reporte-recepcion { padding: 20px !important; }
        }
      `}</style>
    </div>
  );
}

// ── MAIN ────────────────────────────────────────────────────────────────────
export default function RecepcionProducto() {
  const toast = useToast();
  const { proveedores, loading: lProv } = useProveedores();
  const { data: prods, loading: lProd } = useCollection('iProductos', { orderField:'nombre', limit:500 });
  const { data: recepciones, loading: lRec } = useCollection('recepciones', { orderField:'fecha', orderDir:'desc', limit:300 });
  const { add, update, remove, saving } = useWrite('recepciones');

  const [form,    setForm]    = useState({ ...BLANK });
  const [editId,  setEditId]  = useState(null);
  const [printRec, setPrintRec] = useState(null);
  const [tab,     setTab]     = useState('registro');   // 'registro' | 'historial' | 'rechazos'
  const [rechazoModal, setRechazoModal] = useState(false);
  const [pendingSave,  setPendingSave]  = useState(null); // payload ready to save
  const [resolveModal, setResolveModal] = useState(null); // {id, rechazo} for pending resolutions
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Totales reactivos
  const totalRechazado = MOTIVOS.reduce((s,m) => s + (Number(form[m.key])||0), 0);
  const totalAceptado  = Math.max(0, (Number(form.totalRecibido)||0) - totalRechazado);
  const pctRechazo     = pct(totalRechazado, Number(form.totalRecibido)||0);
  const pctAceptado    = pct(totalAceptado,  Number(form.totalRecibido)||0);

  const buildPayload = () => {
    const rechazos = Object.fromEntries(MOTIVOS.map(m => [m.key, Number(form[m.key])||0]));
    // precioRealPorUnidad siempre calculado sobre lo aceptado
    const precioRef = Number(form.precioRef)||0;
    const totalAcept = Math.max(0, Number(form.totalRecibido) - totalRechazado);
    const precioRealPorUnidad = precioRef; // precio referencia es por unidad recibida; el real es sobre aceptados
    return {
      ...form,
      ...rechazos,
      totalRecibido:       Number(form.totalRecibido),
      precioRef,
      precioRealPorUnidad,
      totalRechazado,
      totalAceptado: totalAcept,
      pctRechazo,
      pctAceptado,
      creadoEn: new Date().toISOString(),
    };
  };

  const handleSave = async () => {
    if (!form.proveedor) { toast('Seleccioná un proveedor', 'error'); return; }
    if (!form.producto)  { toast('Ingresá el producto',    'error'); return; }
    if (!form.totalRecibido || Number(form.totalRecibido) <= 0) { toast('Total recibido debe ser > 0', 'error'); return; }
    if (totalRechazado > Number(form.totalRecibido)) { toast('Rechazados superan el total recibido', 'error'); return; }

    if (totalRechazado > 0) {
      // Hay rechazo — mostrar modal de gestión antes de guardar
      setPendingSave(buildPayload());
      setRechazoModal(true);
      return;
    }

    // Sin rechazo — guardar directo con rechazo: { tieneRechazo: false }
    const payload = { ...buildPayload(), rechazo: { tieneRechazo: false } };
    if (editId) {
      await update(editId, payload);
      toast('Recepción actualizada');
      setEditId(null);
    } else {
      await add(payload);
      toast('✓ Recepción registrada');
    }
    setForm({ ...BLANK });
  };

  const handleConfirmRechazo = async (rechazoData) => {
    if (!pendingSave) return;
    const totalNeto = pendingSave.totalAceptado * (pendingSave.precioRef || 0);
    const payload = {
      ...pendingSave,
      rechazo: rechazoData,
      totalNeto,
      sujetoAjuste: rechazoData.resolucion === 'nota_credito',
    };
    setRechazoModal(false);
    setPendingSave(null);
    if (editId) {
      await update(editId, payload);
      toast('Recepción actualizada con gestión de rechazo');
      setEditId(null);
    } else {
      await add(payload);
      toast('✓ Recepción registrada · rechazo gestionado');
    }
    setForm({ ...BLANK });
  };

  const handleResolve = async (recId, rec, rechazoActualizado) => {
    const totalNeto = (rec.totalAceptado || 0) * (rec.precioRef || 0);
    await update(recId, {
      rechazo: {
        ...rec.rechazo,
        ...rechazoActualizado,
        resuelto: rechazoActualizado.resolucion !== 'negociacion_pendiente',
        fechaResolucion: rechazoActualizado.resolucion !== 'negociacion_pendiente' ? new Date().toISOString() : null,
      },
      totalNeto,
      sujetoAjuste: rechazoActualizado.resolucion === 'nota_credito',
    });
    toast('✓ Rechazo actualizado');
    setResolveModal(null);
  };

  const startEdit = r => {
    setForm({
      fecha:         r.fecha         || today(),
      proveedor:     r.proveedor     || '',
      producto:      r.producto      || '',
      unidad:        r.unidad        || 'KG',
      precioRef:     String(r.precioRef || ''),
      totalRecibido: String(r.totalRecibido || ''),
      responsable:   r.responsable   || '',
      obs:           r.obs           || '',
      ...Object.fromEntries(MOTIVOS.map(m => [m.key, String(r[m.key]||'')])),
    });
    setEditId(r.id);
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  // ── Filtros historial ──
  const [fProv,  setFProv]  = useState('');
  const [fProd,  setFProd]  = useState('');
  const [fDesde, setFDesde] = useState('');
  const [fHasta, setFHasta] = useState('');
  const [soloRechPend, setSoloRechPend] = useState(false);

  const filtrado = recepciones
    .filter(r => !fProv  || r.proveedor === fProv)
    .filter(r => !fProd  || r.producto?.toLowerCase().includes(fProd.toLowerCase()))
    .filter(r => !fDesde || r.fecha >= fDesde)
    .filter(r => !fHasta || r.fecha <= fHasta);

  // ── Rechazos ──
  const todosRechazos    = recepciones.filter(r => r.rechazo?.tieneRechazo);
  const rechazoPendCount = todosRechazos.filter(r => !r.rechazo?.resuelto).length;
  const rechazosVis      = soloRechPend ? todosRechazos.filter(r => !r.rechazo?.resuelto) : todosRechazos;

  const RESOL_LABEL = {
    devolucion:           { icon:'📦', label:'Devolución física',     color:'#1565C0', bg:'#E3F2FD' },
    descuento:            { icon:'💰', label:'Descuento en factura',   color:'#2E7D32', bg:'#E8F5E9' },
    nota_credito:         { icon:'📄', label:'Nota de crédito futura', color:'#E65100', bg:'#FFF3E0' },
    negociacion_pendiente:{ icon:'🤝', label:'Negociación pendiente',  color:'#6B6B60', bg:'#F5F5F5' },
  };

  // ── Stats por motivo (historial filtrado) ──
  const statsMotivos = useMemo(() => {
    const totales = Object.fromEntries(MOTIVOS.map(m => [m.key, 0]));
    let totalRec = 0;
    filtrado.forEach(r => {
      totalRec += Number(r.totalRecibido)||0;
      MOTIVOS.forEach(m => { totales[m.key] += Number(r[m.key])||0; });
    });
    return { totales, totalRec };
  }, [filtrado]);

  if (lRec) return <Skeleton rows={6} />;

  return (
    <div style={{ maxWidth:1100, fontFamily:'inherit' }}>

      {printRec && <ReportePrint rec={printRec} onClose={() => setPrintRec(null)} />}

      {/* Modal rechazo — intercepta el save */}
      {rechazoModal && pendingSave && (
        <RechazoForm
          producto={pendingSave.producto}
          totalRechazado={pendingSave.totalRechazado}
          unidad={pendingSave.unidad}
          precioRef={pendingSave.precioRef}
          onConfirm={handleConfirmRechazo}
          onCancel={() => { setRechazoModal(false); setPendingSave(null); }}
        />
      )}

      {/* Modal resolver rechazo existente */}
      {resolveModal && (
        <RechazoForm
          producto={resolveModal.rec.producto}
          totalRechazado={resolveModal.rec.totalRechazado}
          unidad={resolveModal.rec.unidad}
          precioRef={resolveModal.rec.precioRef}
          onConfirm={rd => handleResolve(resolveModal.id, resolveModal.rec, rd)}
          onCancel={() => setResolveModal(null)}
        />
      )}

      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:'1.35rem', fontWeight:800, color:T.primary, margin:0 }}>Recepción y Control de Calidad</h1>
        <p style={{ fontSize:'.82rem', color:T.textMid, marginTop:4 }}>Registro de producto recibido · motivos de rechazo · reportes para proveedores</p>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:`2px solid ${T.border}` }}>
        {[
          { key:'registro',  label:'+ Nuevo Registro' },
          { key:'historial', label:'Historial' },
          { key:'rechazos',  label:'Rechazos', badge: rechazoPendCount > 0 ? rechazoPendCount : null },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:'10px 18px', border:'none', borderBottom: tab===t.key ? `3px solid ${T.primary}` : '3px solid transparent',
            background:'transparent', color: tab===t.key ? T.primary : T.textMid,
            fontWeight: tab===t.key ? 700 : 500, fontSize:'.85rem', cursor:'pointer',
            fontFamily:'inherit', marginBottom:-2, display:'flex', alignItems:'center', gap:6,
          }}>
            {t.label}
            {t.badge && (
              <span style={{ background:T.danger, color:'#fff', borderRadius:100, padding:'1px 7px', fontSize:'.7rem', fontWeight:700 }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Formulario ── */}
      {tab === 'registro' && (<>
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.primary, marginBottom:20, borderBottom:`2px solid ${T.primary}`, paddingBottom:10 }}>
          {editId ? '✏ Editar Recepción' : '+ Nueva Recepción de Producto'}
        </div>

        {/* Fila 1: datos generales */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:14, marginBottom:16 }}>
          <label style={LS}>Fecha<input type="date" value={form.fecha} onChange={e => setF('fecha',e.target.value)} style={IS} /></label>

          <label style={LS}>Proveedor *
            {lProv ? <div style={{ ...IS, color:T.textMid }}>Cargando...</div> : (
              <select value={form.proveedor} onChange={e => setF('proveedor',e.target.value)} style={IS}>
                <option value="">— Seleccionar —</option>
                {proveedores.map(p => <option key={p.id||p.nombre} value={p.nombre}>{p.nombre}</option>)}
                <option value="__otro">Otro / Manual</option>
              </select>
            )}
            {form.proveedor === '__otro' && (
              <input value={form._proveedorManual||''} onChange={e => setForm(f => ({ ...f, _proveedorManual:e.target.value, proveedor: e.target.value||'__otro' }))} placeholder="Nombre del proveedor" style={{ ...IS, marginTop:6 }} />
            )}
          </label>

          <label style={LS}>Producto *
            {lProd ? <div style={{ ...IS, color:T.textMid }}>Cargando...</div> : (
              <select value={form.producto} onChange={e => setF('producto',e.target.value)} style={IS}>
                <option value="">— Seleccionar —</option>
                {(prods||[]).map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                <option value="__otro">Otro / Manual</option>
              </select>
            )}
            {form.producto === '__otro' && (
              <input value={form._productoManual||''} onChange={e => setForm(f => ({ ...f, _productoManual:e.target.value, producto: e.target.value||'__otro' }))} placeholder="Nombre del producto" style={{ ...IS, marginTop:6 }} />
            )}
          </label>

          <label style={LS}>Unidad
            <select value={form.unidad} onChange={e => setF('unidad',e.target.value)} style={IS}>
              {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label style={LS}>Precio ref. (Q/{form.unidad||'KG'})<input type="number" min="0" step="0.01" value={form.precioRef} onChange={e => setF('precioRef',e.target.value)} style={IS} /></label>
          <label style={LS}>Responsable<input value={form.responsable} onChange={e => setF('responsable',e.target.value)} placeholder="Nombre quien recibe" style={IS} /></label>
        </div>

        {/* Fila 2: cantidad total + aceptado/rechazado visual */}
        <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:16, marginBottom:20 }}>
          <label style={LS}>
            Total recibido ({form.unidad}) *
            <input type="number" min="0" step="0.01" value={form.totalRecibido} onChange={e => setF('totalRecibido',e.target.value)} style={{ ...IS, fontSize:'1.1rem', fontWeight:700 }} />
          </label>

          {Number(form.totalRecibido) > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:16, background:T.bgLight, borderRadius:6, padding:'12px 16px', flexWrap:'wrap' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:2 }}>Aceptado</div>
                <div style={{ fontSize:'1.4rem', fontWeight:800, color:T.secondary }}>{totalAceptado} <span style={{ fontSize:'.75rem' }}>{form.unidad}</span></div>
                <div style={{ fontSize:'.78rem', fontWeight:700, color:T.secondary }}>{pctAceptado}%</div>
              </div>
              <div style={{ flex:1, height:10, background:'#E0E0E0', borderRadius:5, minWidth:80 }}>
                <div style={{ height:'100%', width:`${pctAceptado}%`, background:pctAceptado >= 80 ? T.accent : pctAceptado >= 60 ? T.warn : T.danger, borderRadius:5, transition:'width .3s' }} />
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:2 }}>Rechazado</div>
                <div style={{ fontSize:'1.4rem', fontWeight:800, color: pctRechazo > 20 ? T.danger : T.warn }}>{totalRechazado} <span style={{ fontSize:'.75rem' }}>{form.unidad}</span></div>
                <div style={{ fontSize:'.78rem', fontWeight:700, color: pctRechazo > 20 ? T.danger : T.warn }}>{pctRechazo}%</div>
              </div>
            </div>
          )}
        </div>

        {/* Motivos de rechazo */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:T.primary, marginBottom:12 }}>
            Motivos de Rechazo ({form.unidad})
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
            {MOTIVOS.map(m => {
              const qty = Number(form[m.key])||0;
              const p   = pct(qty, Number(form.totalRecibido)||0);
              return (
                <label key={m.key} style={LS}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:m.color }} />
                    {m.label}
                    {qty > 0 && <span style={{ marginLeft:'auto', fontWeight:700, color:m.color, fontSize:'.75rem' }}>{p}%</span>}
                  </div>
                  <input type="number" min="0" step="0.01" value={form[m.key]} onChange={e => setF(m.key, e.target.value)}
                    style={{ ...IS, borderColor: qty > 0 ? m.color : T.border }} />
                </label>
              );
            })}
          </div>
          {totalRechazado > (Number(form.totalRecibido)||0) && (
            <div style={{ marginTop:10, color:T.danger, fontSize:'.82rem', fontWeight:600 }}>
              ⚠ Los rechazos ({totalRechazado}) superan el total recibido ({form.totalRecibido||0})
            </div>
          )}
        </div>

        <label style={{ ...LS, marginBottom:14 }}>
          Observaciones
          <textarea value={form.obs} onChange={e => setF('obs',e.target.value)} rows={2} placeholder="Condiciones de llegada, temperatura, estado del transporte, etc." style={{ ...IS, resize:'vertical' }} />
        </label>

        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button onClick={handleSave} disabled={saving} style={{ padding:'11px 28px', background:saving ? '#BDBDBD' : T.primary, color:'#fff', border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor:saving ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
            {saving ? 'Guardando...' : editId ? 'Actualizar' : '💾 Registrar Recepción'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm({ ...BLANK }); }} style={{ padding:'11px 20px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, cursor:'pointer', color:T.textMid }}>Cancelar</button>}
        </div>
      </div>
      </>)}

      {/* ── TAB HISTORIAL ── */}
      {tab === 'historial' && (<>

      {/* ── Estadísticas del historial ── */}
      {filtrado.length > 0 && (
        <div style={{ ...card, background:'#F8FBF8', border:`1px solid ${T.border}` }}>
          <div style={{ fontWeight:700, fontSize:'.88rem', color:T.primary, marginBottom:14 }}>
            Resumen — {filtrado.length} recepciones {fProv ? `· ${fProv}` : ''}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:4 }}>Total recibido</div>
              <div style={{ fontSize:'1.2rem', fontWeight:800, color:T.textDark }}>{statsMotivos.totalRec.toFixed(1)}</div>
            </div>
            {MOTIVOS.map(m => {
              const qty = statsMotivos.totales[m.key];
              const p   = pct(qty, statsMotivos.totalRec);
              if (qty === 0) return null;
              return (
                <div key={m.key} style={{ textAlign:'center', background:m.bg, borderRadius:6, padding:'8px 10px' }}>
                  <div style={{ fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:m.color, marginBottom:4 }}>{m.label}</div>
                  <div style={{ fontSize:'1.1rem', fontWeight:800, color:m.color }}>{qty.toFixed(1)}</div>
                  <div style={{ fontSize:'.78rem', fontWeight:700, color:m.color }}>{p}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filtros historial ── */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:14, alignItems:'flex-end' }}>
        <label style={LS}>Proveedor
          <select value={fProv} onChange={e => setFProv(e.target.value)} style={{ ...IS, width:200 }}>
            <option value="">Todos</option>
            {[...new Set(recepciones.map(r => r.proveedor).filter(Boolean))].sort().map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label style={LS}>Producto
          <input value={fProd} onChange={e => setFProd(e.target.value)} placeholder="Buscar..." style={{ ...IS, width:160 }} />
        </label>
        <label style={LS}>Desde<input type="date" value={fDesde} onChange={e => setFDesde(e.target.value)} style={{ ...IS, width:145 }} /></label>
        <label style={LS}>Hasta<input type="date" value={fHasta} onChange={e => setFHasta(e.target.value)} style={{ ...IS, width:145 }} /></label>
        {(fProv||fProd||fDesde||fHasta) && (
          <button onClick={() => { setFProv(''); setFProd(''); setFDesde(''); setFHasta(''); }} style={{ padding:'9px 16px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, cursor:'pointer', color:T.textMid, alignSelf:'flex-end' }}>
            Limpiar
          </button>
        )}
      </div>

      {/* ── Historial ── */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary, marginBottom:16 }}>
          Historial de Recepciones ({filtrado.length})
        </div>
        {filtrado.length === 0
          ? <div style={{ textAlign:'center', padding:'40px 0', color:T.textMid }}>Sin registros</div>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['Fecha','Proveedor','Producto','Recibido','Aceptado','Rechazado','% Rechazo','Responsable',''].map(h => (
                      <th key={h} style={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrado.slice(0,150).map((r, i) => {
                    const pr = r.pctRechazo ?? pct(r.totalRechazado||0, r.totalRecibido||0);
                    const pColor = pr > 30 ? T.danger : pr > 15 ? T.warn : T.secondary;
                    return (
                      <tr key={r.id}>
                        <td style={{ ...TD(i%2===1), whiteSpace:'nowrap' }}>{r.fecha}</td>
                        <td style={{ ...TD(i%2===1), fontWeight:600 }}>{r.proveedor||'—'}</td>
                        <td style={TD(i%2===1)}>{r.producto||'—'}</td>
                        <td style={{ ...TD(i%2===1), textAlign:'right' }}>{r.totalRecibido} {r.unidad}</td>
                        <td style={{ ...TD(i%2===1), textAlign:'right', color:T.secondary, fontWeight:600 }}>{r.totalAceptado ?? '—'} {r.unidad}</td>
                        <td style={{ ...TD(i%2===1), textAlign:'right', color: (r.totalRechazado||0) > 0 ? T.warn : T.textMid }}>{r.totalRechazado||0} {r.unidad}</td>
                        <td style={{ ...TD(i%2===1), textAlign:'center' }}>
                          <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:100, fontSize:'.72rem', fontWeight:700, background: pr > 30 ? '#FFEBEE' : pr > 15 ? '#FFF3E0' : T.bgGreen, color:pColor }}>{pr}%</span>
                        </td>
                        <td style={TD(i%2===1)}>{r.responsable||'—'}</td>
                        <td style={TD(i%2===1)}>
                          <div style={{ display:'flex', gap:4 }}>
                            <button onClick={() => setPrintRec(r)} title="Ver / Imprimir" style={{ padding:'3px 9px', background:T.primary, color:'#fff', border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>🖨</button>
                            <button onClick={() => startEdit(r)} style={{ padding:'3px 9px', background:'#fff', color:T.primary, border:`1.5px solid ${T.primary}`, borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>✏</button>
                            <button onClick={() => { if (window.confirm('¿Eliminar esta recepción?')) remove(r.id); }} style={{ padding:'3px 9px', background:'#fff', color:T.danger, border:`1.5px solid ${T.danger}`, borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
      </>)}

      {/* ── TAB RECHAZOS ── */}
      {tab === 'rechazos' && (
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary }}>
              Gestión de Rechazos ({rechazosVis.length})
              {rechazoPendCount > 0 && (
                <span style={{ marginLeft:10, background:'#FFF3E0', color:T.warn, borderRadius:100, padding:'2px 10px', fontSize:'.72rem', fontWeight:700 }}>
                  {rechazoPendCount} pendiente{rechazoPendCount>1?'s':''}
                </span>
              )}
            </div>
            <button onClick={() => setSoloRechPend(p => !p)} style={{
              padding:'6px 14px', borderRadius:6, border:`1.5px solid ${soloRechPend ? T.warn : T.border}`,
              background: soloRechPend ? '#FFF3E0' : '#fff', color: soloRechPend ? T.warn : T.textMid,
              fontWeight:600, fontSize:'.78rem', cursor:'pointer', fontFamily:'inherit',
            }}>
              {soloRechPend ? '🟡 Solo pendientes' : 'Todos los rechazos'}
            </button>
          </div>

          {rechazosVis.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:T.textMid, fontSize:'.88rem' }}>
              {soloRechPend ? 'No hay rechazos pendientes de resolución.' : 'No hay rechazos registrados.'}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {rechazosVis.map(r => {
                const rec     = r.rechazo || {};
                const resol   = RESOL_LABEL[rec.resolucion] || {};
                const resuelto = rec.resuelto;
                return (
                  <div key={r.id} style={{
                    borderRadius:10, border:`1px solid ${T.border}`,
                    borderLeft:`4px solid ${resuelto ? '#2E7D32' : T.warn}`,
                    background:'#fff', padding:'14px 16px',
                  }}>
                    {/* Fila 1 */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div>
                        <span style={{ fontWeight:700, fontSize:15 }}>{r.producto}</span>
                        <span style={{ marginLeft:10, fontSize:12, color:T.textMid }}>📅 {r.fecha}</span>
                      </div>
                      <span style={{
                        padding:'2px 10px', borderRadius:100, fontSize:12, fontWeight:700,
                        background: resuelto ? '#E8F5E9' : '#FFF3E0',
                        color: resuelto ? '#2E7D32' : T.warn,
                      }}>
                        {resuelto ? '🟢 Resuelto' : '🟡 Pendiente'}
                      </span>
                    </div>

                    {/* Fila 2: datos */}
                    <div style={{ display:'flex', gap:16, fontSize:13, color:'#374151', flexWrap:'wrap', marginBottom:8 }}>
                      <span><b>Proveedor:</b> {r.proveedor || '—'}</span>
                      <span><b>Rechazado:</b> {r.totalRechazado} {r.unidad}</span>
                      {rec.valorRechazo > 0 && <span><b>Valor:</b> Q {Number(rec.valorRechazo).toLocaleString('es-GT',{minimumFractionDigits:2})}</span>}
                      {resol.label && (
                        <span style={{ background:resol.bg, color:resol.color, borderRadius:6, padding:'1px 8px', fontWeight:600 }}>
                          {resol.icon} {resol.label}
                        </span>
                      )}
                    </div>

                    {/* Notas */}
                    {rec.notasNegociacion && (
                      <div style={{ fontSize:12, color:T.textMid, marginBottom:8 }}>📝 {rec.notasNegociacion}</div>
                    )}

                    {/* Nota ajuste */}
                    {r.sujetoAjuste && (
                      <div style={{ fontSize:12, color:T.warn, marginBottom:8 }}>⚠ Total neto sujeto a ajuste por nota de crédito pendiente</div>
                    )}

                    {/* Botón resolver si pendiente */}
                    {!resuelto && (
                      <button
                        onClick={() => setResolveModal({ id:r.id, rec:r })}
                        style={{ minHeight:40, padding:'0 16px', borderRadius:7, border:`1.5px solid ${T.primary}`,
                          background:T.bgGreen, color:T.primary, fontWeight:700, fontSize:'.83rem',
                          cursor:'pointer', fontFamily:'inherit' }}>
                        Resolver →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
