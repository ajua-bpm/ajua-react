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

const TANQUES = ['Tanque 1', 'Tanque 2', 'Tanque 3', 'Tanque 4'];
const PRODUCTOS_SUG = ['Repollo','Brócoli','Coliflor','Lechuga','Espinaca','Zanahoria','Apio','Otro'];

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

  // Form state
  const [editId, setEditId] = useState(null);
  const [fecha, setFecha]   = useState(today());
  const [producto, setProducto] = useState('Repollo');
  const [productoOtro, setProductoOtro] = useState('');
  const [tanque, setTanque] = useState('Tanque 1');
  const [volumenL, setVolumenL] = useState(10);
  const [ppmObjetivo, setPpmObjetivo] = useState(200);
  const [responsable, setResponsable] = useState('');
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
    setTanque('Tanque 1');
    setVolumenL(10); setPpmObjetivo(200);
    setResponsable('');
    setMediciones([blankMed()]);
  };

  const handleEdit = (r) => {
    setEditId(r.id);
    setFecha(r.fecha || today());
    if (PRODUCTOS_SUG.includes(r.producto)) { setProducto(r.producto); setProductoOtro(''); }
    else { setProducto('Otro'); setProductoOtro(r.producto || ''); }
    setTanque(r.tanque || 'Tanque 1');
    setVolumenL(r.volumenL || 10);
    setPpmObjetivo(r.ppmObjetivo || 200);
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
      toast('La primera medición necesita ppm y gramos de cloro agregados', 'error'); return;
    }

    const medicionesNorm = mediciones.map(m => ({
      hora: m.hora,
      ppm: parseFloat(m.ppm) || 0,
      cloroAgregado: parseFloat(m.cloroAgregado) || 0,
      obs: m.obs || '',
    }));

    const payload = {
      fecha, producto: productoFinal, tanque,
      volumenL: parseFloat(volumenL) || 0,
      ppmObjetivo: parseFloat(ppmObjetivo) || 0,
      responsable, mediciones: medicionesNorm,
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
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Control Cloro por Producto
        </h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>
          Mediciones por hora con cálculo automático de gramos a agregar para mantener el ppm objetivo.
        </p>
      </div>

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
          <label style={LS}>Tanque
            <select value={tanque} onChange={e => setTanque(e.target.value)} style={{ ...IS, cursor: 'pointer' }}>
              {TANQUES.map(t => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label style={LS}>Volumen (L)
            <input type="number" step="0.1" value={volumenL} onChange={e => setVolumenL(e.target.value)} style={IS} />
          </label>
          <label style={LS}>PPM Objetivo
            <input type="number" value={ppmObjetivo} onChange={e => setPpmObjetivo(e.target.value)} style={IS} />
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

        {/* Ratio info */}
        {ratio && (
          <div style={{ padding: '8px 14px', background: T.greenBg, borderRadius: 6, fontSize: '.8rem', color: T.secondary, marginBottom: 14, border: `1px solid ${T.accent}` }}>
            <b>Ratio aprendido:</b> {fmtNum(ratio, 4)} gramos por cada 1 ppm en este tanque ({volumenL}L).
            <span style={{ color: T.textMid, marginLeft: 8 }}>
              Para subir 50 ppm necesitás ≈ {fmtNum(ratio * 50, 2)} g.
            </span>
          </div>
        )}

        {/* Tabla de mediciones */}
        <div style={{ fontSize: '.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary, marginBottom: 8 }}>
          Mediciones · {mediciones.length}
        </div>
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ background: T.bgLight }}>
                {['#', 'Hora', 'PPM medido', 'Cloro sugerido', 'Cloro real agregado (g)', 'Observación', ''].map(h => (
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
                          // Auto-rellenar cloro sugerido si no es la primera
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
                      {isFirst ? '— inicial —' : sug == null ? '...' : sug === 0 ? 'OK, no agregar' : `${fmtNum(sug, 2)} g`}
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

        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button onClick={agregarMedicion}
            style={{ padding: '8px 16px', background: '#fff', color: T.secondary, border: `1.5px solid ${T.secondary}`,
              borderRadius: 6, fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            + Medición de próxima hora
          </button>
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
                  {['Fecha', 'Producto', 'Tanque', 'Volumen', 'Objetivo', 'Mediciones', 'Total cloro', 'Responsable', '', 'Acciones'].map(h => (
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
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: T.textDark }}>{r.producto || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0' }}>{r.tanque || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0' }}>{r.volumenL ? `${r.volumenL} L` : '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: T.secondary }}>{r.ppmObjetivo ? `${r.ppmObjetivo} ppm` : '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: T.textDark }}>{r.cantMediciones ?? (r.mediciones?.length ?? 0)}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: T.warn }}>{r.totalCloro ? `${fmtNum(r.totalCloro, 2)} g` : '—'}</td>
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
                                Detalle — {r.producto} · {r.tanque} · {r.volumenL}L · objetivo {r.ppmObjetivo} ppm
                                {r.ratioG_ppm > 0 && <span style={{ marginLeft: 8, color: T.textMid }}>ratio {fmtNum(r.ratioG_ppm, 4)} g/ppm</span>}
                              </div>
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 6 }}>
                                  <thead>
                                    <tr style={{ background: T.bgLight }}>
                                      {['#', 'Hora', 'PPM medido', 'Cloro agregado', 'Observación'].map(h => (
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
                                Total cloro usado en el turno: <b style={{ color: T.warn }}>{fmtNum(r.totalCloro, 2)} g</b>
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
    </div>
  );
}
