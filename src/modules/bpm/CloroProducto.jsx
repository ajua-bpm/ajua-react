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

// Productos comerciales de cloro/hipoclorito — % de cloro activo
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

// Recomendaciones por rango de ppm objetivo
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

const blankMed = (hora) => ({ hora: hora || nowHM(), ppm: '', cloroAgregado: '', obs: '' });

export default function CloroProducto() {
  const toast = useToast();
  const { empleados, loading: empLoad } = useEmpleados();
  const { data: registros, loading } = useCollection('cloroProducto', { orderField: 'fecha', orderDir: 'desc', limit: 100 });
  const { add, update, remove, saving } = useWrite('cloroProducto');

  // Tab
  const [tab, setTab] = useState('control');

  // Form state
  const [editId, setEditId] = useState(null);
  const [fecha, setFecha]   = useState(today());
  const [producto, setProducto] = useState('Repollo');
  const [productoOtro, setProductoOtro] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidadProd, setUnidadProd] = useState('lb');
  const [responsable, setResponsable] = useState('');
  // Tanques de agua (lavado triple)
  const [t1Usado, setT1Usado] = useState(true);
  const [t1Obs, setT1Obs]     = useState('');
  const [t3Usado, setT3Usado] = useState(true);
  const [t3Obs, setT3Obs]     = useState('');
  // Tanque cloro
  const [volumenL, setVolumenL] = useState(10);
  const [ppmObjetivo, setPpmObjetivo] = useState(200);
  const [unidadCloro, setUnidadCloro] = useState('g');
  const [mediciones, setMediciones] = useState([blankMed()]);
  const [expandedId, setExpandedId] = useState(null);

  // Calcular ratio a partir de la primera medición
  const ratio = useMemo(() => {
    const m0 = mediciones[0];
    if (!m0) return null;
    const g = parseFloat(m0.cloroAgregado);
    const p = parseFloat(m0.ppm);
    if (g > 0 && p > 0) return g / p;
    return null;
  }, [mediciones]);

  // Para una medición posterior, calcular sugerencia de gramos
  const sugerencia = (ppmActual) => {
    if (!ratio) return null;
    const ppmNum = parseFloat(ppmActual);
    if (!Number.isFinite(ppmNum)) return null;
    const deficit = ppmObjetivo - ppmNum;
    if (deficit <= 0) return 0;
    return deficit * ratio;
  };

  const setMed = (idx, patch) =>
    setMediciones(prev => prev.map((m, i) => i === idx ? { ...m, ...patch } : m));

  const agregarMedicion = () => {
    const last = mediciones[mediciones.length - 1];
    const nuevaHora = last?.hora ? addHora(last.hora, 1) : nowHM();
    setMediciones(prev => [...prev, blankMed(nuevaHora)]);
  };

  const quitarMedicion = (idx) => {
    if (mediciones.length === 1) return;
    setMediciones(prev => prev.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    setEditId(null);
    setFecha(today());
    setProducto('Repollo'); setProductoOtro('');
    setCantidad(''); setUnidadProd('lb');
    setVolumenL(10); setPpmObjetivo(200);
    setUnidadCloro('g');
    setT1Usado(true); setT1Obs('');
    setT3Usado(true); setT3Obs('');
    setResponsable('');
    setMediciones([blankMed()]);
  };

  const handleEdit = (r) => {
    setEditId(r.id);
    setFecha(r.fecha || today());
    // Producto puede venir como string (formato actual) o desde array legacy
    const nombreProd = r.producto || r.productos?.[0]?.nombre || '';
    if (PRODUCTOS_SUG.includes(nombreProd)) { setProducto(nombreProd); setProductoOtro(''); }
    else { setProducto('Otro'); setProductoOtro(nombreProd); }
    setCantidad(r.cantidad != null ? String(r.cantidad) : (r.productos?.[0]?.cantidad ? String(r.productos[0].cantidad) : ''));
    setUnidadProd(r.unidadProd || r.productos?.[0]?.unidad || 'lb');
    setVolumenL(r.volumenL || 10);
    setPpmObjetivo(r.ppmObjetivo || 200);
    setUnidadCloro(r.unidadCloro || 'g');
    setT1Usado(r.t1Usado !== false); setT1Obs(r.t1Obs || '');
    setT3Usado(r.t3Usado !== false); setT3Obs(r.t3Obs || '');
    setResponsable(r.responsable || '');
    setMediciones(r.mediciones?.length ? r.mediciones : [blankMed()]);
    setExpandedId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    const productoFinal = producto === 'Otro' ? productoOtro.trim() : producto;
    if (!productoFinal) { toast('Especificá el producto', 'error'); return; }
    if (!responsable)    { toast('Seleccioná responsable', 'error'); return; }
    if (mediciones.length === 0 || !mediciones[0].ppm || !mediciones[0].cloroAgregado) {
      toast('La primera medición necesita ppm y cloro agregado', 'error'); return;
    }

    const medicionesNorm = mediciones.map(m => ({
      hora: m.hora,
      ppm: parseFloat(m.ppm) || 0,
      cloroAgregado: parseFloat(m.cloroAgregado) || 0,
      obs: m.obs || '',
    }));

    const payload = {
      fecha, responsable,
      producto: productoFinal,
      cantidad: parseFloat(cantidad) || 0,
      unidadProd,
      // Lavado triple
      t1Usado, t1Obs,
      t3Usado, t3Obs,
      // Tanque cloro
      volumenL: parseFloat(volumenL) || 0,
      ppmObjetivo: parseFloat(ppmObjetivo) || 0,
      unidadCloro,
      mediciones: medicionesNorm,
      ratioG_ppm: ratio || 0,
      totalCloro: medicionesNorm.reduce((s, m) => s + (m.cloroAgregado || 0), 0),
      cantMediciones: medicionesNorm.length,
    };

    try {
      if (editId) { await update(editId, payload); toast('✓ Reporte actualizado'); }
      else        { await add(payload);            toast('✓ Reporte guardado'); }
      resetForm();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1080 }}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Control de Lavado por Producto
        </h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>
          Lavado triple con mediciones por hora · Calculadora de dosis de cloro.
        </p>
      </div>

      {/* Tabs */}
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

      {/* Form encabezado */}
      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 14 }}>
          <label style={LS}>Fecha
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={IS} />
          </label>
          <label style={LS}>Producto
            <select value={producto} onChange={e => setProducto(e.target.value)} style={{ ...IS, cursor: 'pointer' }}>
              {PRODUCTOS_SUG.map(p => <option key={p}>{p}</option>)}
            </select>
          </label>
          {producto === 'Otro' && (
            <label style={LS}>Especificar
              <input value={productoOtro} onChange={e => setProductoOtro(e.target.value)} placeholder="Nombre producto" style={IS} />
            </label>
          )}
          <label style={LS}>Cantidad (opcional)
            <input type="number" step="any" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="0" style={IS} />
          </label>
          <label style={LS}>Unidad
            <select value={unidadProd} onChange={e => setUnidadProd(e.target.value)} style={{ ...IS, cursor: 'pointer' }}>
              {['lb','kg','caja','red','unidad'].map(u => <option key={u}>{u}</option>)}
            </select>
          </label>
          <label style={LS}>Responsable
            {empLoad ? <Skeleton height={36} /> : (
              <select value={responsable} onChange={e => setResponsable(e.target.value)} style={{ ...IS, cursor: 'pointer' }}>
                <option value="">— Seleccionar —</option>
                {empleados.map(e => <option key={e.id || e.nombre} value={e.nombre}>{e.nombre}</option>)}
              </select>
            )}
          </label>
        </div>

        {/* Tanque 1 — agua */}
        <div style={{ padding: 12, border: `1.5px solid ${T.border}`, borderRadius: 8, marginBottom: 12, background: t1Usado ? '#F0F8FF' : T.bgLight }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: t1Usado ? 8 : 0 }}>
            <input type="checkbox" checked={t1Usado} onChange={e => setT1Usado(e.target.checked)}
              style={{ width: 17, height: 17, cursor: 'pointer', accentColor: T.secondary }} />
            <span style={{ fontWeight: 700, fontSize: '.92rem', color: T.textDark }}>Tanque 1 — Agua (pre-lavado)</span>
            {!t1Usado && <span style={{ fontSize: '.74rem', color: T.textMid, fontStyle: 'italic' }}>no usado</span>}
          </div>
          {t1Usado && (
            <input value={t1Obs} onChange={e => setT1Obs(e.target.value)}
              placeholder="Observación (opcional)" style={{ ...IS, marginTop: 0 }} />
          )}
        </div>

        {/* Tanque 2 — Cloro */}
        <div style={{ padding: 14, border: `1.5px solid ${T.accent}`, borderRadius: 8, marginBottom: 12, background: '#F1F8E9' }}>
          <div style={{ fontWeight: 700, fontSize: '.92rem', color: T.primary, marginBottom: 10 }}>
            Tanque 2 — Cloro (con re-medición horaria)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 10 }}>
            <label style={LS}>Volumen agua (L)
              <input type="number" step="0.1" value={volumenL} onChange={e => setVolumenL(e.target.value)} style={IS} />
            </label>
            <label style={LS}>Unidad cloro
              <select value={unidadCloro} onChange={e => setUnidadCloro(e.target.value)} style={{ ...IS, cursor: 'pointer' }}>
                {UNIDADES_CLORO.map(u => <option key={u.v} value={u.v}>{u.label}</option>)}
              </select>
            </label>
            <label style={LS}>PPM Objetivo
              <input type="number" value={ppmObjetivo} onChange={e => setPpmObjetivo(e.target.value)} style={IS} />
            </label>
          </div>

          {/* Ratio info */}
          {ratio && (
            <div style={{ padding: '8px 14px', background: '#fff', borderRadius: 6, fontSize: '.8rem', color: T.secondary, marginBottom: 12, border: `1px solid ${T.accent}` }}>
              <b>Ratio aprendido:</b> {fmtNum(ratio, 4)} {unidadCloro} por cada 1 ppm ({volumenL}L).
              <span style={{ color: T.textMid, marginLeft: 8 }}>
                Para subir 50 ppm: ≈ {fmtNum(ratio * 50, 2)} {unidadCloro}.
              </span>
            </div>
          )}

          {/* Tabla de mediciones */}
          <div style={{ fontSize: '.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary, marginBottom: 8 }}>
            Mediciones · {mediciones.length}
          </div>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden', overflowX: 'auto', background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ background: T.bgLight }}>
                  {['#', 'Hora', 'PPM medido', `Cloro sugerido (${unidadCloro})`, `Cloro real agregado (${unidadCloro})`, 'Observación', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '.7rem',
                      fontWeight: 700, color: T.textMid, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mediciones.map((m, idx) => {
                  const isFirst = idx === 0;
                  const sug = !isFirst ? sugerencia(m.ppm) : null;
                  const ppmNum = parseFloat(m.ppm);
                  const ppmStatus = !ppmNum ? '' :
                    ppmNum >= ppmObjetivo * 0.9 ? 'ok' :
                    ppmNum >= ppmObjetivo * 0.6 ? 'bajo' : 'critico';

                  return (
                    <tr key={idx} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: '6px 10px', fontSize: '.82rem', fontWeight: 700, color: isFirst ? T.primary : T.textMid }}>
                        {isFirst ? '1ª' : idx + 1}
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <input type="time" value={m.hora} onChange={e => setMed(idx, { hora: e.target.value })}
                          style={{ ...IS, width: 110, marginTop: 0 }} />
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <input type="number" step="any" value={m.ppm}
                          onChange={e => {
                            const patch = { ppm: e.target.value };
                            if (!isFirst && ratio) {
                              const v = parseFloat(e.target.value);
                              if (Number.isFinite(v)) {
                                const def = ppmObjetivo - v;
                                patch.cloroAgregado = def > 0 ? fmtNum(def * ratio, 2) : '0';
                              }
                            }
                            setMed(idx, patch);
                          }}
                          placeholder={isFirst ? 'ej: 200' : '0'}
                          style={{ ...IS, width: 100, marginTop: 0,
                            background: ppmStatus === 'ok' ? T.greenBg : ppmStatus === 'bajo' ? T.warnBg : ppmStatus === 'critico' ? T.redBg : '#fff',
                            borderColor: ppmStatus === 'ok' ? T.secondary : ppmStatus === 'bajo' ? T.warn : ppmStatus === 'critico' ? T.danger : T.border }} />
                      </td>
                      <td style={{ padding: '4px 8px', fontSize: '.84rem', fontWeight: 700,
                        color: isFirst ? T.textMid : sug == null ? T.border : sug === 0 ? T.secondary : T.warn }}>
                        {isFirst ? '— inicial —' : sug == null ? '...' : sug === 0 ? 'OK, no agregar' : `${fmtNum(sug, 2)} ${unidadCloro}`}
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <input type="number" step="any" value={m.cloroAgregado}
                          onChange={e => setMed(idx, { cloroAgregado: e.target.value })}
                          placeholder={isFirst ? 'ej: 3' : '0'}
                          style={{ ...IS, width: 110, marginTop: 0, fontWeight: 700 }} />
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <input value={m.obs} onChange={e => setMed(idx, { obs: e.target.value })}
                          placeholder="opcional" style={{ ...IS, marginTop: 0 }} />
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                        {mediciones.length > 1 && (
                          <button onClick={() => quitarMedicion(idx)}
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

          <button onClick={agregarMedicion} style={{
              marginTop: 12, padding: '8px 16px', background: '#fff',
              color: T.secondary, border: `1.5px solid ${T.secondary}`, borderRadius: 6,
              fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            + Medición de próxima hora
          </button>
        </div>{/* fin Tanque 2 */}

        {/* Tanque 3 — agua final */}
        <div style={{ padding: 12, border: `1.5px solid ${T.border}`, borderRadius: 8, marginBottom: 14, background: t3Usado ? '#F0F8FF' : T.bgLight }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: t3Usado ? 8 : 0 }}>
            <input type="checkbox" checked={t3Usado} onChange={e => setT3Usado(e.target.checked)}
              style={{ width: 17, height: 17, cursor: 'pointer', accentColor: T.secondary }} />
            <span style={{ fontWeight: 700, fontSize: '.92rem', color: T.textDark }}>Tanque 3 — Agua (enjuague)</span>
            {!t3Usado && <span style={{ fontSize: '.74rem', color: T.textMid, fontStyle: 'italic' }}>no usado</span>}
          </div>
          {t3Usado && (
            <input value={t3Obs} onChange={e => setT3Obs(e.target.value)}
              placeholder="Observación (opcional)" style={{ ...IS, marginTop: 0 }} />
          )}
        </div>


        <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '10px 22px', background: saving ? '#BDBDBD' : editId ? T.warn : T.primary,
              color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700,
              fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Guardando...' : editId ? '✏️ Actualizar reporte' : '💾 Guardar reporte'}
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
            <span style={{ alignSelf: 'center', fontSize: '.78rem', color: T.warn, fontStyle: 'italic' }}>
              Editando · los cambios reemplazarán el reporte actual
            </span>
          )}
        </div>
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
                  {['Fecha', 'Producto', 'Cantidad', 'Volumen', 'Objetivo', 'Mediciones', 'Total cloro', 'Responsable', '', 'Acciones'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', color: '#fff', fontSize: '.7rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(registros || []).map((r, i) => {
                  const isExp = expandedId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr style={{ background: isExp ? '#F1F8E9' : i % 2 === 0 ? '#fff' : '#F9FBF9', cursor: 'pointer' }}
                        onClick={() => setExpandedId(prev => prev === r.id ? null : r.id)}>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600, color: T.textMid, whiteSpace: 'nowrap' }}>{r.fecha}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: T.textDark }}>
                          {r.producto || (r.productos?.map(p => p.nombre).join(', ')) || '—'}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', color: T.textMid }}>
                          {r.cantidad ? `${fmtNum(r.cantidad, 2)} ${r.unidadProd || 'lb'}` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0' }}>{r.volumenL ? `${r.volumenL} L` : '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: T.secondary }}>{r.ppmObjetivo ? `${r.ppmObjetivo} ppm` : '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: T.textDark }}>{r.cantMediciones ?? (r.mediciones?.length ?? 0)}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: T.warn }}>{r.totalCloro ? `${fmtNum(r.totalCloro, 2)} ${r.unidadCloro || 'g'}` : '—'}</td>
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
                          <td colSpan={10} style={{ padding: 0, borderBottom: '2px solid #A5D6A7' }}>
                            <div style={{ padding: '14px 18px', background: '#F9FEF9', borderLeft: `4px solid ${T.secondary}` }}>
                              <div style={{ fontWeight: 700, fontSize: '.72rem', color: T.secondary, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                                Detalle — <span style={{ color: T.textDark }}>{r.producto || r.productos?.[0]?.nombre || 'sin producto'}</span>
                                {r.cantidad ? <span style={{ color: T.textMid, fontWeight: 400 }}> · {fmtNum(r.cantidad, 2)} {r.unidadProd || 'lb'}</span> : null}
                                <span style={{ color: T.textMid, fontWeight: 400 }}> · {r.volumenL}L · objetivo {r.ppmObjetivo} ppm</span>
                                {r.ratioG_ppm > 0 && <span style={{ marginLeft: 8, color: T.textMid, fontWeight: 400 }}>ratio {fmtNum(r.ratioG_ppm, 4)} {r.unidadCloro || 'g'}/ppm</span>}
                              </div>
                              <div style={{ display: 'flex', gap: 14, marginBottom: 12, flexWrap: 'wrap', fontSize: '.78rem' }}>
                                <span style={{ padding: '4px 10px', borderRadius: 4, background: r.t1Usado === false ? T.bgLight : '#E3F2FD', color: r.t1Usado === false ? T.textMid : '#1565C0', fontWeight: 600 }}>
                                  T1 Agua: {r.t1Usado === false ? 'no usado' : 'usado'}{r.t1Obs ? ` · ${r.t1Obs}` : ''}
                                </span>
                                <span style={{ padding: '4px 10px', borderRadius: 4, background: T.greenBg, color: T.secondary, fontWeight: 600 }}>
                                  T2 Cloro: {r.cantMediciones || (r.mediciones?.length ?? 0)} mediciones
                                </span>
                                <span style={{ padding: '4px 10px', borderRadius: 4, background: r.t3Usado === false ? T.bgLight : '#E3F2FD', color: r.t3Usado === false ? T.textMid : '#1565C0', fontWeight: 600 }}>
                                  T3 Agua: {r.t3Usado === false ? 'no usado' : 'usado'}{r.t3Obs ? ` · ${r.t3Obs}` : ''}
                                </span>
                              </div>
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 6 }}>
                                  <thead>
                                    <tr style={{ background: T.bgLight }}>
                                      {['#', 'Hora', 'PPM medido', `Cloro agregado (${r.unidadCloro || 'g'})`, 'Observación'].map(h => (
                                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: '.7rem',
                                          fontWeight: 700, color: T.textMid, textTransform: 'uppercase' }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(r.mediciones || []).map((m, mi) => {
                                      const ppmOk = m.ppm >= r.ppmObjetivo * 0.9;
                                      const ppmBajo = m.ppm < r.ppmObjetivo * 0.6;
                                      return (
                                        <tr key={mi} style={{ borderTop: `1px solid ${T.border}` }}>
                                          <td style={{ padding: '6px 10px', fontSize: '.82rem', fontWeight: 700, color: mi === 0 ? T.primary : T.textMid }}>
                                            {mi === 0 ? '1ª' : mi + 1}
                                          </td>
                                          <td style={{ padding: '6px 10px', fontSize: '.82rem' }}>{m.hora}</td>
                                          <td style={{ padding: '6px 10px', fontSize: '.82rem', fontWeight: 700,
                                            color: ppmOk ? T.secondary : ppmBajo ? T.danger : T.warn }}>{m.ppm} ppm</td>
                                          <td style={{ padding: '6px 10px', fontSize: '.82rem', fontWeight: 700, color: T.textDark }}>{fmtNum(m.cloroAgregado, 2)} g</td>
                                          <td style={{ padding: '6px 10px', fontSize: '.78rem', color: T.textMid, fontStyle: m.obs ? 'normal' : 'italic' }}>
                                            {m.obs || '—'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              <div style={{ marginTop: 10, fontSize: '.82rem', color: T.textMid }}>
                                Total cloro usado en el turno: <b style={{ color: T.warn }}>{fmtNum(r.totalCloro, 2)} {r.unidadCloro || 'g'}</b>
                              </div>
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

    const mgNecesarios = deficit * vol;          // mg de cloro activo total
    const mgPorUnidad  = conc * 10;              // % × 10 = mg por mL (líquido) o mg por g (granular)
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

      {/* Recomendación rango */}
      {parseFloat(ppmObjetivo) > 0 && (() => {
        const rec = getRecomendacion(parseFloat(ppmObjetivo));
        return (
          <div style={{ padding: '8px 14px', borderRadius: 6, background: '#fff',
            border: `1.5px solid ${rec.color}`, color: rec.color, fontSize: '.82rem', marginBottom: 14 }}>
            <b>Uso recomendado:</b> {rec.label}
          </div>
        );
      })()}

      {/* Resultado */}
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

      {/* Tabla referencia rápida */}
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
