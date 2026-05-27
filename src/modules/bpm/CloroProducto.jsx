import { useState, useMemo, Fragment } from 'react';
import { useEmpleados } from '../../hooks/useMainData';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

const T = {
  primary: '#1B5E20', secondary: '#2E7D32', accent: '#43A047',
  white: '#FFFFFF', bgLight: '#F5F5F5', border: '#E0E0E0',
  textDark: '#1A1A18', textMid: '#6B6B60',
  danger: '#C62828', warn: '#E65100', warnBg: '#FFF3E0',
  greenBg: '#E8F5E9', redBg: '#FFEBEE',
};

const PRODUCTOS_SUG = ['Repollo','Brócoli','Coliflor','Lechuga','Espinaca','Zanahoria','Apio','Otro'];
const UNIDADES_CLORO = [
  { v: 'g',  label: 'gramos (granulado)' },
  { v: 'mL', label: 'mL (líquido)' },
];

const PRODUCTOS_CLORO = [
  { id: 'naclo5',   nombre: 'Hipoclorito de sodio 5%',          conc: 5,    tipo: 'liquido' },
  { id: 'naclo6',   nombre: 'Hipoclorito de sodio 6% (doméstico)', conc: 6,  tipo: 'liquido' },
  { id: 'naclo10',  nombre: 'Hipoclorito de sodio 10%',         conc: 10,   tipo: 'liquido' },
  { id: 'naclo125', nombre: 'Hipoclorito de sodio 12.5%',       conc: 12.5, tipo: 'liquido' },
  { id: 'caclo65',  nombre: 'Hipoclorito de calcio 65% (granular)', conc: 65, tipo: 'granular' },
  { id: 'caclo70',  nombre: 'Hipoclorito de calcio 70% (granular)', conc: 70, tipo: 'granular' },
  { id: 'cloropuro', nombre: 'Cloro puro 100%',                 conc: 100,  tipo: 'granular' },
  { id: 'custom',   nombre: 'Personalizado',                    conc: 0,    tipo: 'liquido' },
];

const REC_PPM = [
  { max: 1.5,    label: 'Agua potable (NOM-127: 0.2–1.5 mg/L)', color: '#1565C0' },
  { max: 50,     label: 'Agua de proceso / cisterna baja',       color: '#1565C0' },
  { max: 200,    label: 'Lavado de frutas/verduras (BPM)',       color: '#2E7D32' },
  { max: 500,    label: 'Desinfección de superficies',           color: '#E65100' },
  { max: 10000,  label: 'Sanitización fuerte',                   color: '#C62828' },
];
const getRecomendacion = (ppm) => REC_PPM.find(r => ppm <= r.max) || REC_PPM[REC_PPM.length - 1];

const today = () => new Date().toISOString().slice(0, 10);
const nowHM = () => new Date().toTimeString().slice(0, 5);
const addHora = (hm, h) => {
  const [hh, mm] = hm.split(':').map(Number);
  const total = hh * 60 + mm + h * 60;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
};
const fmtNum = (n, d = 2) => Number.isFinite(n) ? Number(n).toFixed(d).replace(/\.?0+$/, '') : '—';

const card = { background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 22, marginBottom: 20 };
const LS = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em' };
const IS = { padding: '8px 10px', border: '1.5px solid #E0E0E0', borderRadius: 6, fontSize: '.86rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', marginTop: 2 };
const UNIDADES_PROD = ['lb', 'kg', 'caja', 'red', 'unidad'];

const blankT2Med = (hora) => ({ hora: hora || nowHM(), ppm: '', cloroAgregado: '', obs: '' });

const blankProd = () => ({
  // Metadata producto
  nombre: 'Repollo',
  nombreOtro: '',
  cantidad: '',
  unidad: 'lb',
  obs: '',
  horaInicio: nowHM(),
  // T1 agua (pre-lavado)
  t1Usado: true,
  t1Obs: '',
  // T2 cloro
  t2Usado: true,
  t2VolumenL: 10,
  t2PpmObjetivo: 200,
  t2UnidadCloro: 'g',
  t2Mediciones: [blankT2Med()],
  // T3 agua (enjuague)
  t3Usado: true,
  t3Obs: '',
  // UI
  _expanded: true,
});

// Convertir registro legacy (tanques compartidos) a formato producto
function legacyToProducto(r) {
  const isSug = PRODUCTOS_SUG.includes(r.producto || '');
  return {
    nombre:     isSug ? r.producto : 'Otro',
    nombreOtro: isSug ? '' : (r.producto || ''),
    cantidad:   r.cantidad != null ? String(r.cantidad) : '',
    unidad:     r.unidadProd || 'lb',
    obs:        r.obsProducto || '',
    horaInicio: r.horaInicio || (r.mediciones?.[0]?.hora) || nowHM(),
    t1Usado:    r.t1Usado !== false,
    t1Obs:      r.t1Obs || '',
    t2Usado:    Array.isArray(r.mediciones) && r.mediciones.length > 0,
    t2VolumenL: r.volumenL || 10,
    t2PpmObjetivo: r.ppmObjetivo || 200,
    t2UnidadCloro: r.unidadCloro || 'g',
    t2Mediciones: (r.mediciones && r.mediciones.length) ? r.mediciones.map(m => ({ ...m })) : [blankT2Med()],
    t3Usado:    r.t3Usado !== false,
    t3Obs:      r.t3Obs || '',
    _expanded:  true,
  };
}

// Si el registro ya está en formato v2 (tiene r.t1/t2/t3 objetos)
function v2ToProducto(r) {
  const isSug = PRODUCTOS_SUG.includes(r.producto || '');
  return {
    nombre:     isSug ? r.producto : 'Otro',
    nombreOtro: isSug ? '' : (r.producto || ''),
    cantidad:   r.cantidad != null ? String(r.cantidad) : '',
    unidad:     r.unidadProd || 'lb',
    obs:        r.obsProducto || '',
    horaInicio: r.horaInicio || nowHM(),
    t1Usado:    r.t1?.usado !== false,
    t1Obs:      r.t1?.obs || '',
    t2Usado:    r.t2?.usado !== false,
    t2VolumenL: r.t2?.volumenL || 10,
    t2PpmObjetivo: r.t2?.ppmObjetivo || 200,
    t2UnidadCloro: r.t2?.unidadCloro || 'g',
    t2Mediciones: (r.t2?.mediciones && r.t2.mediciones.length) ? r.t2.mediciones.map(m => ({ ...m })) : [blankT2Med()],
    t3Usado:    r.t3?.usado !== false,
    t3Obs:      r.t3?.obs || '',
    _expanded:  true,
  };
}

export default function CloroProducto() {
  const toast = useToast();
  const { empleados, loading: empLoad } = useEmpleados();
  const { data: registros, loading } = useCollection('cloroProducto', { orderField: 'fecha', orderDir: 'desc', limit: 100 });
  const { add, update, remove, saving } = useWrite('cloroProducto');

  const [tab, setTab] = useState('control');

  // Form state
  const [editId, setEditId] = useState(null);
  const [fecha, setFecha]   = useState(today());
  const [responsable, setResponsable] = useState('');
  const [productos, setProductos] = useState([blankProd()]);
  const [expandedHistId, setExpandedHistId] = useState(null);

  const setProd    = (idx, patch) => setProductos(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  const addProd    = () => setProductos(prev => {
    // colapsa todos los existentes, expande el nuevo
    const collapsed = prev.map(p => ({ ...p, _expanded: false }));
    return [...collapsed, blankProd()];
  });
  const removeProd = (idx) => setProductos(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  const toggleExpanded = (idx) => setProd(idx, { _expanded: !productos[idx]._expanded });

  // T2 mediciones helpers (por producto)
  const setT2Med = (pIdx, mIdx, patch) => {
    setProductos(prev => prev.map((p, i) => {
      if (i !== pIdx) return p;
      return { ...p, t2Mediciones: p.t2Mediciones.map((m, j) => j === mIdx ? { ...m, ...patch } : m) };
    }));
  };
  const agregarMedicion = (pIdx) => {
    setProductos(prev => prev.map((p, i) => {
      if (i !== pIdx) return p;
      const last = p.t2Mediciones[p.t2Mediciones.length - 1];
      const nuevaHora = last?.hora ? addHora(last.hora, 1) : nowHM();
      return { ...p, t2Mediciones: [...p.t2Mediciones, blankT2Med(nuevaHora)] };
    }));
  };
  const quitarMedicion = (pIdx, mIdx) => {
    setProductos(prev => prev.map((p, i) => {
      if (i !== pIdx) return p;
      if (p.t2Mediciones.length === 1) return p;
      return { ...p, t2Mediciones: p.t2Mediciones.filter((_, j) => j !== mIdx) };
    }));
  };

  // Ratio aprendido por producto (basado en 1ª medición de T2)
  const ratioForProd = (p) => {
    const m0 = p.t2Mediciones?.[0];
    if (!m0) return null;
    const g = parseFloat(m0.cloroAgregado);
    const ppm = parseFloat(m0.ppm);
    if (g > 0 && ppm > 0) return g / ppm;
    return null;
  };

  const resetForm = () => {
    setEditId(null);
    setFecha(today());
    setResponsable('');
    setProductos([blankProd()]);
  };

  const handleEdit = (r) => {
    setEditId(r.id);
    setFecha(r.fecha || today());
    setResponsable(r.responsable || '');
    // Detectar formato
    const isV2 = r.formato === 'v2' || r.t2 || r.t1;
    setProductos([isV2 ? v2ToProducto(r) : legacyToProducto(r)]);
    setExpandedHistId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validar = () => {
    if (!responsable) return 'Seleccioná responsable';
    for (let i = 0; i < productos.length; i++) {
      const p = productos[i];
      const nombre = (p.nombre === 'Otro' ? p.nombreOtro : p.nombre || '').trim();
      if (!nombre) return `Producto ${i + 1}: nombre requerido`;
      const tanquesUsados = (p.t1Usado ? 1 : 0) + (p.t2Usado ? 1 : 0) + (p.t3Usado ? 1 : 0);
      if (tanquesUsados === 0) return `Producto ${i + 1} (${nombre}): al menos un tanque (T1, T2 o T3) debe estar marcado`;
      if (p.t2Usado) {
        const m0 = p.t2Mediciones?.[0];
        if (!m0 || !m0.ppm || !m0.cloroAgregado) {
          return `Producto ${i + 1} (${nombre}): la 1ª medición de T2 necesita ppm y cloro agregado`;
        }
      }
    }
    return null;
  };

  const productoToDoc = (p) => {
    const nombre = (p.nombre === 'Otro' ? p.nombreOtro : p.nombre || '').trim();
    const mediciones = p.t2Usado
      ? p.t2Mediciones.map(m => ({
          hora: m.hora,
          ppm: parseFloat(m.ppm) || 0,
          cloroAgregado: parseFloat(m.cloroAgregado) || 0,
          obs: m.obs || '',
        }))
      : [];
    const totalCloro = mediciones.reduce((s, m) => s + (m.cloroAgregado || 0), 0);
    const ratio = ratioForProd(p) || 0;
    return {
      formato: 'v2',
      fecha,
      responsable,
      // metadata producto
      producto: nombre,
      cantidad: parseFloat(p.cantidad) || 0,
      unidadProd: p.unidad || 'lb',
      obsProducto: p.obs || '',
      horaInicio: p.horaInicio || '',
      // tanques con datos propios
      t1: { usado: !!p.t1Usado, obs: p.t1Obs || '' },
      t2: p.t2Usado ? {
        usado: true,
        volumenL: parseFloat(p.t2VolumenL) || 0,
        ppmObjetivo: parseFloat(p.t2PpmObjetivo) || 0,
        unidadCloro: p.t2UnidadCloro || 'g',
        mediciones,
        ratioG_ppm: ratio,
        totalCloro,
        cantMediciones: mediciones.length,
      } : { usado: false },
      t3: { usado: !!p.t3Usado, obs: p.t3Obs || '' },
      // Espejos para que el historial viejo siga ordenando/leyendo bien
      volumenL: p.t2Usado ? (parseFloat(p.t2VolumenL) || 0) : 0,
      ppmObjetivo: p.t2Usado ? (parseFloat(p.t2PpmObjetivo) || 0) : 0,
      unidadCloro: p.t2UnidadCloro || 'g',
      mediciones,
      ratioG_ppm: ratio,
      totalCloro,
      cantMediciones: mediciones.length,
      t1Usado: !!p.t1Usado,
      t1Obs: p.t1Obs || '',
      t3Usado: !!p.t3Usado,
      t3Obs: p.t3Obs || '',
    };
  };

  const handleSave = async () => {
    const err = validar();
    if (err) { toast(err, 'error'); return; }
    try {
      if (editId) {
        await update(editId, productoToDoc(productos[0]));
        toast('✓ Reporte actualizado');
      } else {
        for (const p of productos) await add(productoToDoc(p));
        toast(productos.length === 1 ? '✓ Reporte guardado' : `✓ ${productos.length} reportes guardados`);
      }
      resetForm();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  // Resumen badges por producto (header del card)
  const resumenProducto = (p) => {
    const nombre = (p.nombre === 'Otro' ? p.nombreOtro : p.nombre) || 'sin nombre';
    const usados = [p.t1Usado && 'T1', p.t2Usado && 'T2', p.t3Usado && 'T3'].filter(Boolean);
    const cant = parseFloat(p.cantidad);
    return {
      nombre,
      tanques: usados.length ? usados.join('·') : '—',
      cantStr: Number.isFinite(cant) && cant > 0 ? `${fmtNum(cant, 2)} ${p.unidad}` : '',
      meds: p.t2Usado ? p.t2Mediciones.length : 0,
    };
  };

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1100 }}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Control de Lavado por Producto
        </h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>
          Varios productos lavándose al mismo tiempo · cada uno con sus tanques y mediciones independientes.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: `2px solid ${T.border}` }}>
        {[
          { k: 'control', label: '💧 Control de Lavado' },
          { k: 'calc',    label: '🧮 Calculadora de Dosis' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            padding: '10px 18px', border: 'none', background: 'none',
            borderBottom: tab === t.k ? `3px solid ${T.primary}` : '3px solid transparent',
            color: tab === t.k ? T.primary : T.textMid, fontWeight: 700,
            fontSize: '.86rem', cursor: 'pointer', marginBottom: -2,
            fontFamily: 'inherit',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'calc' && <Calculadora />}

      {tab === 'control' && <>

      {/* Sesión: fecha + responsable */}
      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
          <label style={LS}>Fecha
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={IS} />
          </label>
          <label style={LS}>Responsable de la sesión
            {empLoad ? <Skeleton height={36} /> : (
              <select value={responsable} onChange={e => setResponsable(e.target.value)} style={{ ...IS, cursor: 'pointer' }}>
                <option value="">— Seleccionar —</option>
                {empleados.map(e => <option key={e.id || e.nombre} value={e.nombre}>{e.nombre}</option>)}
              </select>
            )}
          </label>
        </div>
      </div>

      {/* Productos — cada uno con sus tanques propios */}
      {productos.map((p, pIdx) => {
        const res = resumenProducto(p);
        const ratio = ratioForProd(p);
        return (
          <div key={pIdx} style={{ ...card, borderLeft: `4px solid ${T.accent}` }}>
            {/* Header del producto */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: p._expanded ? 16 : 0, cursor: 'pointer' }}
                 onClick={() => toggleExpanded(pIdx)}>
              <span style={{ fontSize: '.72rem', fontWeight: 700, color: T.secondary, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                Producto {productos.length > 1 ? `${pIdx + 1} de ${productos.length}` : ''}
              </span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: '1rem', color: T.textDark }}>
                {res.nombre}
                {res.cantStr && <span style={{ marginLeft: 8, color: T.textMid, fontWeight: 500, fontSize: '.85rem' }}>· {res.cantStr}</span>}
              </span>
              <span style={{ padding: '3px 10px', borderRadius: 4, background: T.greenBg, color: T.secondary, fontSize: '.74rem', fontWeight: 700 }}>
                {res.tanques}
              </span>
              {p.t2Usado && (
                <span style={{ padding: '3px 10px', borderRadius: 4, background: T.bgLight, color: T.textMid, fontSize: '.74rem', fontWeight: 600 }}>
                  {res.meds} medic.
                </span>
              )}
              {productos.length > 1 && !editId && (
                <button onClick={(e) => { e.stopPropagation(); removeProd(pIdx); }}
                  style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: '.72rem', color: T.danger }}>
                  ✕ Quitar
                </button>
              )}
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: T.secondary, fontWeight: 700 }}>
                {p._expanded ? '▲' : '▼'}
              </button>
            </div>

            {p._expanded && <>
              {/* Datos del producto */}
              <div style={{ padding: 12, background: '#F9FEF9', border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 14 }}>
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: T.secondary, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                  Datos del producto
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
                  <label style={LS}>Producto
                    <select value={p.nombre} onChange={e => setProd(pIdx, { nombre: e.target.value })} style={{ ...IS, cursor: 'pointer' }}>
                      {PRODUCTOS_SUG.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                  {p.nombre === 'Otro' && (
                    <label style={LS}>Especificar
                      <input value={p.nombreOtro} onChange={e => setProd(pIdx, { nombreOtro: e.target.value })} placeholder="Nombre" style={IS} />
                    </label>
                  )}
                  <label style={LS}>Cantidad
                    <input type="number" step="any" value={p.cantidad} onChange={e => setProd(pIdx, { cantidad: e.target.value })} placeholder="opcional" style={IS} />
                  </label>
                  <label style={LS}>Unidad
                    <select value={p.unidad} onChange={e => setProd(pIdx, { unidad: e.target.value })} style={{ ...IS, cursor: 'pointer' }}>
                      {UNIDADES_PROD.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </label>
                  <label style={LS}>Hora inicio lavado
                    <input type="time" value={p.horaInicio} onChange={e => setProd(pIdx, { horaInicio: e.target.value })} style={IS} />
                  </label>
                  <label style={LS}>Observación
                    <input value={p.obs} onChange={e => setProd(pIdx, { obs: e.target.value })} placeholder="opcional" style={IS} />
                  </label>
                </div>
              </div>

              {/* T1 agua */}
              <div style={{ padding: 12, border: `1.5px solid ${T.border}`, borderRadius: 8, marginBottom: 10, background: p.t1Usado ? '#F0F8FF' : T.bgLight }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: p.t1Usado ? 8 : 0 }}>
                  <input type="checkbox" checked={p.t1Usado} onChange={e => setProd(pIdx, { t1Usado: e.target.checked })}
                    style={{ width: 17, height: 17, cursor: 'pointer', accentColor: T.secondary }} />
                  <span style={{ fontWeight: 700, fontSize: '.9rem', color: T.textDark }}>Tanque 1 — Agua (pre-lavado)</span>
                  {!p.t1Usado && <span style={{ fontSize: '.74rem', color: T.textMid, fontStyle: 'italic' }}>no usado</span>}
                </div>
                {p.t1Usado && (
                  <input value={p.t1Obs} onChange={e => setProd(pIdx, { t1Obs: e.target.value })}
                    placeholder="Observación (opcional)" style={{ ...IS, marginTop: 0 }} />
                )}
              </div>

              {/* T2 cloro */}
              <div style={{ padding: 14, border: `1.5px solid ${p.t2Usado ? T.accent : T.border}`, borderRadius: 8, marginBottom: 10, background: p.t2Usado ? '#F1F8E9' : T.bgLight }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: p.t2Usado ? 12 : 0 }}>
                  <input type="checkbox" checked={p.t2Usado} onChange={e => setProd(pIdx, { t2Usado: e.target.checked })}
                    style={{ width: 17, height: 17, cursor: 'pointer', accentColor: T.secondary }} />
                  <span style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary }}>Tanque 2 — Cloro (con re-medición horaria)</span>
                  {!p.t2Usado && <span style={{ fontSize: '.74rem', color: T.textMid, fontStyle: 'italic' }}>no usado</span>}
                </div>

                {p.t2Usado && <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 10 }}>
                    <label style={LS}>Volumen agua (L)
                      <input type="number" step="0.1" value={p.t2VolumenL} onChange={e => setProd(pIdx, { t2VolumenL: e.target.value })} style={IS} />
                    </label>
                    <label style={LS}>Unidad cloro
                      <select value={p.t2UnidadCloro} onChange={e => setProd(pIdx, { t2UnidadCloro: e.target.value })} style={{ ...IS, cursor: 'pointer' }}>
                        {UNIDADES_CLORO.map(u => <option key={u.v} value={u.v}>{u.label}</option>)}
                      </select>
                    </label>
                    <label style={LS}>PPM Objetivo
                      <input type="number" value={p.t2PpmObjetivo} onChange={e => setProd(pIdx, { t2PpmObjetivo: e.target.value })} style={IS} />
                    </label>
                  </div>

                  {ratio && (
                    <div style={{ padding: '8px 14px', background: '#fff', borderRadius: 6, fontSize: '.8rem', color: T.secondary, marginBottom: 12, border: `1px solid ${T.accent}` }}>
                      <b>Ratio aprendido:</b> {fmtNum(ratio, 4)} {p.t2UnidadCloro} por cada 1 ppm ({p.t2VolumenL}L).
                      <span style={{ color: T.textMid, marginLeft: 8 }}>
                        Para subir 50 ppm: ≈ {fmtNum(ratio * 50, 2)} {p.t2UnidadCloro}.
                      </span>
                    </div>
                  )}

                  <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary, marginBottom: 8 }}>
                    Mediciones · {p.t2Mediciones.length}
                  </div>
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflowX: 'auto', background: '#fff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                      <thead>
                        <tr style={{ background: T.bgLight }}>
                          {['#', 'Hora', 'PPM medido', `Sugerido (${p.t2UnidadCloro})`, `Cloro real (${p.t2UnidadCloro})`, 'Observación', ''].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '.7rem',
                              fontWeight: 700, color: T.textMid, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {p.t2Mediciones.map((m, mIdx) => {
                          const isFirst = mIdx === 0;
                          const ppmNum = parseFloat(m.ppm);
                          const ppmStatus = !ppmNum ? '' :
                            ppmNum >= p.t2PpmObjetivo * 0.9 ? 'ok' :
                            ppmNum >= p.t2PpmObjetivo * 0.6 ? 'bajo' : 'critico';
                          let sug = null;
                          if (!isFirst && ratio) {
                            const ppmN = parseFloat(m.ppm);
                            if (Number.isFinite(ppmN)) {
                              const def = p.t2PpmObjetivo - ppmN;
                              sug = def <= 0 ? 0 : def * ratio;
                            }
                          }
                          return (
                            <tr key={mIdx} style={{ borderTop: `1px solid ${T.border}` }}>
                              <td style={{ padding: '6px 10px', fontSize: '.82rem', fontWeight: 700, color: isFirst ? T.primary : T.textMid }}>
                                {isFirst ? '1ª' : mIdx + 1}
                              </td>
                              <td style={{ padding: '4px 8px' }}>
                                <input type="time" value={m.hora} onChange={e => setT2Med(pIdx, mIdx, { hora: e.target.value })}
                                  style={{ ...IS, width: 110, marginTop: 0 }} />
                              </td>
                              <td style={{ padding: '4px 8px' }}>
                                <input type="number" step="any" value={m.ppm}
                                  onChange={e => {
                                    const patch = { ppm: e.target.value };
                                    if (!isFirst && ratio) {
                                      const v = parseFloat(e.target.value);
                                      if (Number.isFinite(v)) {
                                        const def = p.t2PpmObjetivo - v;
                                        patch.cloroAgregado = def > 0 ? fmtNum(def * ratio, 2) : '0';
                                      }
                                    }
                                    setT2Med(pIdx, mIdx, patch);
                                  }}
                                  placeholder={isFirst ? 'ej: 200' : '0'}
                                  style={{ ...IS, width: 100, marginTop: 0,
                                    background: ppmStatus === 'ok' ? T.greenBg : ppmStatus === 'bajo' ? T.warnBg : ppmStatus === 'critico' ? T.redBg : '#fff',
                                    borderColor: ppmStatus === 'ok' ? T.secondary : ppmStatus === 'bajo' ? T.warn : ppmStatus === 'critico' ? T.danger : T.border }} />
                              </td>
                              <td style={{ padding: '4px 8px', fontSize: '.84rem', fontWeight: 700,
                                color: isFirst ? T.textMid : sug == null ? T.border : sug === 0 ? T.secondary : T.warn }}>
                                {isFirst ? '— inicial —' : sug == null ? '...' : sug === 0 ? 'OK, no agregar' : `${fmtNum(sug, 2)} ${p.t2UnidadCloro}`}
                              </td>
                              <td style={{ padding: '4px 8px' }}>
                                <input type="number" step="any" value={m.cloroAgregado}
                                  onChange={e => setT2Med(pIdx, mIdx, { cloroAgregado: e.target.value })}
                                  placeholder={isFirst ? 'ej: 3' : '0'}
                                  style={{ ...IS, width: 110, marginTop: 0, fontWeight: 700 }} />
                              </td>
                              <td style={{ padding: '4px 8px' }}>
                                <input value={m.obs} onChange={e => setT2Med(pIdx, mIdx, { obs: e.target.value })}
                                  placeholder="opcional" style={{ ...IS, marginTop: 0 }} />
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                {p.t2Mediciones.length > 1 && (
                                  <button onClick={() => quitarMedicion(pIdx, mIdx)}
                                    style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
                                      padding: '3px 8px', cursor: 'pointer', fontSize: '.72rem', color: T.textMid }}>✕</button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <button onClick={() => agregarMedicion(pIdx)} style={{
                      marginTop: 12, padding: '8px 16px', background: '#fff',
                      color: T.secondary, border: `1.5px solid ${T.secondary}`, borderRadius: 6,
                      fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                    + Medición de próxima hora
                  </button>
                </>}
              </div>

              {/* T3 agua */}
              <div style={{ padding: 12, border: `1.5px solid ${T.border}`, borderRadius: 8, background: p.t3Usado ? '#F0F8FF' : T.bgLight }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: p.t3Usado ? 8 : 0 }}>
                  <input type="checkbox" checked={p.t3Usado} onChange={e => setProd(pIdx, { t3Usado: e.target.checked })}
                    style={{ width: 17, height: 17, cursor: 'pointer', accentColor: T.secondary }} />
                  <span style={{ fontWeight: 700, fontSize: '.9rem', color: T.textDark }}>Tanque 3 — Agua (enjuague)</span>
                  {!p.t3Usado && <span style={{ fontSize: '.74rem', color: T.textMid, fontStyle: 'italic' }}>no usado</span>}
                </div>
                {p.t3Usado && (
                  <input value={p.t3Obs} onChange={e => setProd(pIdx, { t3Obs: e.target.value })}
                    placeholder="Observación (opcional)" style={{ ...IS, marginTop: 0 }} />
                )}
              </div>
            </>}
          </div>
        );
      })}

      {/* Agregar otro producto */}
      {!editId && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={addProd}
            style={{ padding: '10px 20px', background: T.secondary, color: '#fff', border: 'none',
              borderRadius: 6, fontWeight: 700, fontSize: '.86rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            + Agregar otro producto al mismo tiempo
          </button>
          <span style={{ marginLeft: 10, fontSize: '.78rem', color: T.textMid, fontStyle: 'italic' }}>
            cada uno con sus propios tanques y mediciones
          </span>
        </div>
      )}

      {/* Guardar */}
      <div style={{ ...card, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: '10px 22px', background: saving ? '#BDBDBD' : editId ? T.warn : T.primary,
            color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700,
            fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Guardando...' : editId ? '✏️ Actualizar reporte' : productos.length > 1 ? `💾 Guardar ${productos.length} reportes` : '💾 Guardar reporte'}
        </button>
        {editId && (
          <button onClick={resetForm}
            style={{ padding: '10px 16px', background: '#fff', color: T.textMid,
              border: `1px solid ${T.border}`, borderRadius: 6, fontWeight: 600, fontSize: '.84rem',
              cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancelar edición
          </button>
        )}
        {editId && (
          <span style={{ fontSize: '.78rem', color: T.warn, fontStyle: 'italic' }}>
            Editando · los cambios reemplazarán el reporte actual
          </span>
        )}
      </div>

      {/* Historial */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.primary, marginBottom: 14 }}>
          Historial de reportes
        </div>
        {loading ? <Skeleton rows={5} /> : (registros || []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: T.textMid, fontSize: '.85rem' }}>Sin reportes guardados</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Producto', 'Cant.', 'Tanques', 'Volumen', 'Objetivo', 'Med.', 'Total cloro', 'Resp.', '', 'Acc.'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', color: '#fff', fontSize: '.7rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(registros || []).map((r, i) => {
                  const isExp = expandedHistId === r.id;
                  // Detect v2 vs legacy
                  const isV2 = r.formato === 'v2' || r.t2 || r.t1;
                  const t1u = isV2 ? r.t1?.usado !== false : r.t1Usado !== false;
                  const t2u = isV2 ? r.t2?.usado !== false : (Array.isArray(r.mediciones) && r.mediciones.length > 0);
                  const t3u = isV2 ? r.t3?.usado !== false : r.t3Usado !== false;
                  const tanquesBadge = [t1u && 'T1', t2u && 'T2', t3u && 'T3'].filter(Boolean).join('·') || '—';
                  const volumenL    = isV2 ? r.t2?.volumenL : r.volumenL;
                  const ppmObjetivo = isV2 ? r.t2?.ppmObjetivo : r.ppmObjetivo;
                  const mediciones  = isV2 ? (r.t2?.mediciones || []) : (r.mediciones || []);
                  const cantMed     = mediciones.length;
                  const totalCloro  = isV2 ? r.t2?.totalCloro : r.totalCloro;
                  const unidadCloro = isV2 ? r.t2?.unidadCloro : r.unidadCloro;
                  const ratio       = isV2 ? r.t2?.ratioG_ppm : r.ratioG_ppm;

                  return (
                    <Fragment key={r.id}>
                      <tr style={{ background: isExp ? '#F1F8E9' : i % 2 === 0 ? '#fff' : '#F9FBF9', cursor: 'pointer' }}
                        onClick={() => setExpandedHistId(prev => prev === r.id ? null : r.id)}>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600, color: T.textMid, whiteSpace: 'nowrap' }}>
                          {r.fecha}{r.horaInicio && <div style={{ fontSize: '.72rem', color: T.textMid }}>{r.horaInicio}</div>}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: T.textDark }}>
                          {r.producto || '—'}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', color: T.textMid }}>
                          {r.cantidad ? `${fmtNum(r.cantidad, 2)} ${r.unidadProd || 'lb'}` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '.78rem', borderBottom: '1px solid #F0F0F0' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, background: T.greenBg, color: T.secondary, fontWeight: 700 }}>{tanquesBadge}</span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0' }}>{volumenL ? `${volumenL} L` : '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: T.secondary }}>{ppmObjetivo ? `${ppmObjetivo} ppm` : '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: T.textDark }}>{cantMed || 0}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: T.warn }}>{totalCloro ? `${fmtNum(totalCloro, 2)} ${unidadCloro || 'g'}` : '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0' }}>{r.responsable || '—'}</td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0', textAlign: 'center', color: T.secondary, fontWeight: 700 }}>
                          {isExp ? '▲' : '▼'}
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => handleEdit(r)}
                              style={{ background: 'none', border: `1px solid ${T.secondary}`, borderRadius: 4,
                                padding: '3px 8px', cursor: 'pointer', fontSize: '.72rem', color: T.secondary, fontWeight: 600 }}>
                              ✏️ Editar
                            </button>
                            <button onClick={() => { if (window.confirm('¿Eliminar este reporte?')) remove(r.id); }}
                              style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
                                padding: '3px 8px', cursor: 'pointer', fontSize: '.72rem', color: T.textMid }}>✕</button>
                          </div>
                        </td>
                      </tr>
                      {isExp && (
                        <tr>
                          <td colSpan={11} style={{ padding: 0, borderBottom: '2px solid #A5D6A7' }}>
                            <div style={{ padding: '14px 18px', background: '#F9FEF9', borderLeft: `4px solid ${T.secondary}` }}>
                              <div style={{ fontWeight: 700, fontSize: '.72rem', color: T.secondary, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                                Detalle — <span style={{ color: T.textDark }}>{r.producto || 'sin producto'}</span>
                                {r.cantidad ? <span style={{ color: T.textMid, fontWeight: 400 }}> · {fmtNum(r.cantidad, 2)} {r.unidadProd || 'lb'}</span> : null}
                                {t2u && <span style={{ color: T.textMid, fontWeight: 400 }}> · {volumenL}L · objetivo {ppmObjetivo} ppm</span>}
                                {ratio > 0 && <span style={{ marginLeft: 8, color: T.textMid, fontWeight: 400 }}>ratio {fmtNum(ratio, 4)} {unidadCloro || 'g'}/ppm</span>}
                                {!isV2 && <span style={{ marginLeft: 10, padding: '2px 8px', background: T.warnBg, color: T.warn, borderRadius: 4, fontSize: '.68rem' }}>formato legacy</span>}
                              </div>
                              <div style={{ display: 'flex', gap: 14, marginBottom: 12, flexWrap: 'wrap', fontSize: '.78rem' }}>
                                <span style={{ padding: '4px 10px', borderRadius: 4, background: t1u ? '#E3F2FD' : T.bgLight, color: t1u ? '#1565C0' : T.textMid, fontWeight: 600 }}>
                                  T1 Agua: {t1u ? 'usado' : 'no usado'}{(isV2 ? r.t1?.obs : r.t1Obs) ? ` · ${isV2 ? r.t1.obs : r.t1Obs}` : ''}
                                </span>
                                <span style={{ padding: '4px 10px', borderRadius: 4, background: t2u ? T.greenBg : T.bgLight, color: t2u ? T.secondary : T.textMid, fontWeight: 600 }}>
                                  T2 Cloro: {t2u ? `${cantMed} mediciones` : 'no usado'}
                                </span>
                                <span style={{ padding: '4px 10px', borderRadius: 4, background: t3u ? '#E3F2FD' : T.bgLight, color: t3u ? '#1565C0' : T.textMid, fontWeight: 600 }}>
                                  T3 Agua: {t3u ? 'usado' : 'no usado'}{(isV2 ? r.t3?.obs : r.t3Obs) ? ` · ${isV2 ? r.t3.obs : r.t3Obs}` : ''}
                                </span>
                              </div>
                              {t2u && mediciones.length > 0 && (
                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 6 }}>
                                    <thead>
                                      <tr style={{ background: T.bgLight }}>
                                        {['#', 'Hora', 'PPM', `Cloro (${unidadCloro || 'g'})`, 'Obs.'].map(h => (
                                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: '.7rem',
                                            fontWeight: 700, color: T.textMid, textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {mediciones.map((m, mi) => {
                                        const ppmOk = m.ppm >= ppmObjetivo * 0.9;
                                        const ppmBajo = m.ppm < ppmObjetivo * 0.6;
                                        return (
                                          <tr key={mi} style={{ borderTop: `1px solid ${T.border}` }}>
                                            <td style={{ padding: '6px 10px', fontSize: '.82rem', fontWeight: 700, color: mi === 0 ? T.primary : T.textMid }}>
                                              {mi === 0 ? '1ª' : mi + 1}
                                            </td>
                                            <td style={{ padding: '6px 10px', fontSize: '.82rem' }}>{m.hora}</td>
                                            <td style={{ padding: '6px 10px', fontSize: '.82rem', fontWeight: 700,
                                              color: ppmOk ? T.secondary : ppmBajo ? T.danger : T.warn }}>{m.ppm} ppm</td>
                                            <td style={{ padding: '6px 10px', fontSize: '.82rem', fontWeight: 700, color: T.textDark }}>{fmtNum(m.cloroAgregado, 2)} {unidadCloro || 'g'}</td>
                                            <td style={{ padding: '6px 10px', fontSize: '.78rem', color: T.textMid, fontStyle: m.obs ? 'normal' : 'italic' }}>
                                              {m.obs || '—'}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {totalCloro > 0 && (
                                <div style={{ marginTop: 10, fontSize: '.82rem', color: T.textMid }}>
                                  Total cloro usado: <b style={{ color: T.warn }}>{fmtNum(totalCloro, 2)} {unidadCloro || 'g'}</b>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>}
    </div>
  );
}

// ─── Calculadora de Dosis ───────────────────────────────────────────
function Calculadora() {
  const [volumen, setVolumen]       = useState(10);
  const [ppmActual, setPpmActual]   = useState(0);
  const [ppmObjetivo, setPpmObj]    = useState('');
  const [productoId, setProductoId] = useState('naclo6');
  const [customConc, setCustomConc] = useState('');
  const [customTipo, setCustomTipo] = useState('liquido');

  const producto = PRODUCTOS_CLORO.find(p => p.id === productoId);
  const conc = productoId === 'custom' ? parseFloat(customConc) : producto?.conc;
  const tipo = productoId === 'custom' ? customTipo : producto?.tipo;

  const calc = useMemo(() => {
    const vol = parseFloat(volumen);
    const actual = parseFloat(ppmActual) || 0;
    const obj = parseFloat(ppmObjetivo);
    if (!Number.isFinite(vol) || vol <= 0) return { error: 'Ingresá volumen válido' };
    if (!Number.isFinite(obj) || obj <= 0) return null;
    if (!Number.isFinite(conc) || conc <= 0) return { error: 'Especificá concentración del producto' };

    const deficit = obj - actual;
    if (deficit <= 0) return { ok: true, mensaje: 'La concentración actual ya alcanza el objetivo. No hace falta agregar.' };

    const mgNecesarios = deficit * vol;
    const mgPorUnidad  = conc * 10;
    const cantidad     = mgNecesarios / mgPorUnidad;
    const unidad       = tipo === 'liquido' ? 'mL' : 'g';
    const rec          = getRecomendacion(obj);

    return { deficit, mgNecesarios, cantidad, unidad, rec };
  }, [volumen, ppmActual, ppmObjetivo, conc, tipo]);

  return (
    <div style={card}>
      <div style={{ marginBottom: 10, fontSize: '.85rem', color: T.textMid }}>
        Calculá cuánto cloro o hipoclorito agregar para llegar a la concentración deseada.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
        <label style={LS}>Volumen de agua (L)
          <input type="number" min="0" step="0.1" value={volumen} onChange={e => setVolumen(e.target.value)} style={IS} />
        </label>
        <label style={LS}>Concentración actual (mg/L o ppm)
          <input type="number" min="0" step="0.1" value={ppmActual} onChange={e => setPpmActual(e.target.value)} style={IS} placeholder="0 si es agua sin tratar" />
        </label>
        <label style={LS}>Concentración deseada (mg/L o ppm)
          <input type="number" min="0" step="0.1" value={ppmObjetivo} onChange={e => setPpmObj(e.target.value)} placeholder="ej: 200" style={IS} />
        </label>
        <label style={LS}>Producto
          <select value={productoId} onChange={e => setProductoId(e.target.value)} style={{ ...IS, cursor: 'pointer' }}>
            {PRODUCTOS_CLORO.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        {productoId === 'custom' && (
          <>
            <label style={LS}>Concentración del producto (% cloro activo)
              <input type="number" min="0" step="0.01" value={customConc} onChange={e => setCustomConc(e.target.value)} placeholder="ej: 8.5" style={IS} />
            </label>
            <label style={LS}>Tipo
              <select value={customTipo} onChange={e => setCustomTipo(e.target.value)} style={{ ...IS, cursor: 'pointer' }}>
                <option value="liquido">Líquido (mL)</option>
                <option value="granular">Granular (g)</option>
              </select>
            </label>
          </>
        )}
      </div>

      {parseFloat(ppmObjetivo) > 0 && (() => {
        const rec = getRecomendacion(parseFloat(ppmObjetivo));
        return (
          <div style={{ padding: '8px 14px', borderRadius: 6, background: '#fff',
            border: `1.5px solid ${rec.color}`, color: rec.color, fontSize: '.82rem', marginBottom: 14 }}>
            <b>Uso recomendado:</b> {rec.label}
          </div>
        );
      })()}

      {calc?.error && (
        <div style={{ padding: 14, borderRadius: 8, background: T.warnBg, color: T.warn, fontWeight: 600, fontSize: '.9rem' }}>
          ⚠ {calc.error}
        </div>
      )}
      {calc?.ok && (
        <div style={{ padding: 14, borderRadius: 8, background: T.greenBg, color: T.secondary, fontWeight: 600, fontSize: '.92rem' }}>
          ✓ {calc.mensaje}
        </div>
      )}
      {calc && !calc.error && !calc.ok && (
        <div style={{ padding: 22, borderRadius: 10, background: T.greenBg, border: `2px solid ${T.secondary}` }}>
          <div style={{ fontSize: '.74rem', fontWeight: 700, color: T.secondary, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            Dosis a agregar
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: 800, color: T.primary, lineHeight: 1, marginBottom: 10 }}>
            {fmtNum(calc.cantidad, 2)} <span style={{ fontSize: '1.4rem', fontWeight: 600 }}>{calc.unidad}</span>
          </div>
          <div style={{ fontSize: '.85rem', color: T.textMid, lineHeight: 1.6 }}>
            de <b style={{ color: T.textDark }}>{producto?.id === 'custom' ? `producto al ${customConc}%` : producto?.nombre}</b><br />
            para subir de <b>{ppmActual || 0} mg/L</b> a <b>{ppmObjetivo} mg/L</b> en <b>{volumen} L</b> de agua.
          </div>
          <div style={{ marginTop: 12, fontSize: '.78rem', color: T.textMid, padding: '8px 12px', background: '#fff', borderRadius: 6 }}>
            <b>Cálculo:</b> déficit {fmtNum(calc.deficit, 2)} mg/L × {volumen} L = {fmtNum(calc.mgNecesarios, 0)} mg de cloro activo.
            <br />Producto al {conc}% → {conc * 10} mg activo por {tipo === 'liquido' ? 'mL' : 'g'} → {fmtNum(calc.cantidad, 2)} {calc.unidad} necesarios.
          </div>
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <div style={{ fontSize: '.74rem', fontWeight: 700, color: T.secondary, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
          Referencia rápida — rangos típicos
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {REC_PPM.slice(0, -1).map(r => (
            <div key={r.label} style={{ padding: '8px 12px', borderRadius: 6, background: '#fff', border: `1px solid ${r.color}`, fontSize: '.78rem', color: r.color }}>
              <b>{r.label.split(' (')[0]}</b>
              {r.label.includes('(') && <div style={{ fontSize: '.72rem', color: T.textMid, marginTop: 2 }}>{r.label.match(/\((.+)\)/)?.[1]}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
