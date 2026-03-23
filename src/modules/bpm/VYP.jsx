import { useState, useRef } from 'react';
import { useEmpleados } from '../../hooks/useMainData';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ── Design tokens ─────────────────────────────────────────────────
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
  info:      '#1565C0',
  green2:    '#E8F5E9',
};

const AREAS = ['Cooler 1', 'Cooler 2', 'Pre-carga', 'Maquila', 'Parqueo'];
const TIPOS    = ['Vidrio', 'Plástico', 'Ambos'];
const ACCIONES = ['Retirado', 'Reportado', 'Pendiente'];

const today = () => new Date().toISOString().slice(0, 10);

const blankArea = () => ({
  inspeccionada: false,
  hallazgo: false,
  tipo: 'Vidrio',
  desc: '',
  cantidad: '',
  accion: 'Retirado',
  foto: null,
});

// ── UI helpers ────────────────────────────────────────────────────
const inputStyle = {
  padding: '8px 11px', border: '1.5px solid #E0E0E0', borderRadius: 6,
  fontSize: '.85rem', outline: 'none', width: '100%', fontFamily: 'inherit',
  boxSizing: 'border-box', background: '#fff',
};

const Lbl = ({ text, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.07em', color: T.secondary }}>{text}</span>
    {children}
  </label>
);

function Toggle({ checked, onChange, label }) {
  return (
    <button onClick={() => onChange(!checked)}
      style={{ padding: '5px 14px', borderRadius: 20, border: '1.5px solid',
        cursor: 'pointer', fontWeight: 700, fontSize: '.75rem', fontFamily: 'inherit',
        background: checked ? T.secondary : T.white,
        borderColor: checked ? T.secondary : T.border,
        color: checked ? T.white : T.textMid }}>
      {label}
    </button>
  );
}

// ── Area inspection row ───────────────────────────────────────────
function AreaRow({ nombre, data, onChange }) {
  const fotoRef = useRef(null);

  const set = (patch) => onChange({ ...data, ...patch });

  const handleFoto = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set({ foto: ev.target.result });
    reader.readAsDataURL(file);
  };

  const areaResult = () => {
    if (!data.inspeccionada) return null;
    if (!data.hallazgo) return 'LIMPIO';
    if (data.accion === 'Pendiente') return 'PENDIENTE';
    return 'CON HALLAZGO';
  };

  const res = areaResult();
  const resBadge = {
    LIMPIO:       { label: '✅ LIMPIO',        bg: T.green2,   color: T.secondary },
    'CON HALLAZGO': { label: '⚠️ CON HALLAZGO', bg: '#FFF9C4',  color: '#F57F17' },
    PENDIENTE:    { label: '🔴 PENDIENTE',     bg: '#FFEBEE',  color: T.danger },
  };

  const badge = res ? resBadge[res] : null;

  return (
    <div style={{
      background: data.inspeccionada
        ? (res === 'LIMPIO' ? '#F1F8E9' : res === 'PENDIENTE' ? '#FFF8F8' : '#FFFDE7')
        : T.bgLight,
      border: `1.5px solid ${data.inspeccionada ? (res === 'LIMPIO' ? '#A5D6A7' : res === 'PENDIENTE' ? '#EF9A9A' : '#FDD835') : T.border}`,
      borderRadius: 8, padding: '14px 16px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        {/* Area name */}
        <div style={{ fontWeight: 700, fontSize: '.88rem', color: T.textDark, minWidth: 100 }}>
          {nombre}
        </div>

        {/* Inspected toggle */}
        <Toggle
          checked={data.inspeccionada}
          onChange={v => set({ inspeccionada: v, hallazgo: v ? data.hallazgo : false })}
          label={data.inspeccionada ? '✓ Inspeccionada' : 'Marcar inspeccionada'}
        />

        {/* Finding toggle — only if inspected */}
        {data.inspeccionada && (
          <Toggle
            checked={data.hallazgo}
            onChange={v => set({ hallazgo: v })}
            label={data.hallazgo ? '⚠ Con hallazgo' : 'Sin hallazgo'}
          />
        )}

        {/* Result badge */}
        {badge && (
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: '.72rem',
            fontWeight: 800, background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Hallazgo detail — only if hallazgo = true */}
      {data.inspeccionada && data.hallazgo && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 10 }}>
            <Lbl text="Tipo">
              <select value={data.tipo} onChange={e => set({ tipo: e.target.value })}
                style={{ ...inputStyle, cursor: 'pointer', fontSize: '.82rem', padding: '7px 10px' }}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Lbl>
            <Lbl text="Cantidad / tamaño">
              <input type="text" value={data.cantidad} onChange={e => set({ cantidad: e.target.value })}
                placeholder="Ej: 3 fragmentos pequeños"
                style={{ ...inputStyle, fontSize: '.82rem', padding: '7px 10px' }} />
            </Lbl>
            <Lbl text="Acción tomada">
              <select value={data.accion} onChange={e => set({ accion: e.target.value })}
                style={{ ...inputStyle, cursor: 'pointer', fontSize: '.82rem', padding: '7px 10px' }}>
                {ACCIONES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Lbl>
          </div>

          <div style={{ marginBottom: 10 }}>
            <Lbl text="Descripción del hallazgo">
              <textarea value={data.desc} onChange={e => set({ desc: e.target.value })}
                placeholder="Qué se encontró, posible origen, estado..."
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', fontSize: '.82rem' }} />
            </Lbl>
          </div>

          {/* Foto */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.07em', color: T.secondary }}>Foto (opcional)</span>
            <input ref={fotoRef} type="file" accept="image/*"
              onChange={handleFoto} style={{ fontSize: '.7rem' }} />
            {data.foto && (
              <>
                <img src={data.foto} alt="preview"
                  style={{ height: 56, borderRadius: 4, border: `1px solid ${T.border}`, objectFit: 'cover' }} />
                <button onClick={() => { set({ foto: null }); if (fotoRef.current) fotoRef.current.value = ''; }}
                  style={{ padding: '3px 10px', background: 'none', border: `1px solid ${T.danger}`,
                    borderRadius: 4, cursor: 'pointer', fontSize: '.72rem', color: T.danger, fontFamily: 'inherit' }}>
                  ✕ Quitar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Compute overall result ────────────────────────────────────────
function overallResult(areas) {
  const inspected = AREAS.filter(a => areas[a]?.inspeccionada);
  if (inspected.length === 0) return null;
  const hallazgos = inspected.filter(a => areas[a]?.hallazgo);
  if (hallazgos.length === 0) return 'LIMPIO';
  if (hallazgos.some(a => areas[a]?.accion === 'Pendiente')) return 'PENDIENTE';
  return 'CON HALLAZGO';
}

// ── Main ──────────────────────────────────────────────────────────
export default function VYP() {
  const toast = useToast();
  const { empleados, loading: empLoading } = useEmpleados();
  const { data: historial, loading: histLoading } = useCollection('vyp', {
    orderField: 'fecha', orderDir: 'desc', limit: 200,
  });
  const { add, remove, saving } = useWrite('vyp');

  const [fecha, setFecha] = useState(today());
  const [resp, setResp]   = useState('');
  const [obs, setObs]     = useState('');

  const initAreas = () => Object.fromEntries(AREAS.map(a => [a, blankArea()]));
  const [areas, setAreas] = useState(initAreas);

  const setArea = (nombre, data) => setAreas(prev => ({ ...prev, [nombre]: data }));

  const result = overallResult(areas);
  const resultBadges = {
    LIMPIO:         { label: '✅ LIMPIO — Sin hallazgos',          bg: T.green2,  color: T.secondary },
    'CON HALLAZGO': { label: '⚠️ CON HALLAZGO — Retirados',       bg: '#FFF9C4', color: '#F57F17' },
    PENDIENTE:      { label: '🔴 PENDIENTE — Requiere atención',   bg: '#FFEBEE', color: T.danger },
  };

  const handleSave = async () => {
    if (!fecha || !resp) { toast('Complete fecha y responsable', 'error'); return; }
    const inspCount = AREAS.filter(a => areas[a].inspeccionada).length;
    if (inspCount === 0) { toast('Marque al menos un área inspeccionada', 'error'); return; }

    // Build hallazgos array for history display
    const hallazgos = AREAS
      .filter(a => areas[a].inspeccionada && areas[a].hallazgo)
      .map(a => ({ area: a, ...areas[a] }));

    try {
      await add({ fecha, resp, obs, areas, hallazgos, resultado: result });
      toast('Inspección guardada');
      setAreas(initAreas());
      setObs('');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  // Historial filter
  const [filtRes, setFiltRes] = useState('');
  const filtHist = (historial || []).filter(r => !filtRes || r.resultado === filtRes);

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Vidrio y Plástico
        </h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>
          Inspección diaria por área · Hallazgos de contaminación · Cooler, Pre-carga, Maquila, Parqueo
        </p>
      </div>

      {/* Form card */}
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 22, marginBottom: 20 }}>
        {/* Top row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 18 }}>
          <Lbl text="Fecha">
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
          </Lbl>
          <Lbl text="Responsable">
            {empLoading ? <Skeleton height={36} /> : (
              <select value={resp} onChange={e => setResp(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">— Seleccionar —</option>
                {empleados.map(e => (
                  <option key={e.id || e.nombre} value={e.nombre}>
                    {e.nombre}{e.cargo ? ' · ' + e.cargo : ''}
                  </option>
                ))}
              </select>
            )}
          </Lbl>
        </div>

        {/* Overall result banner */}
        {result && (
          <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8,
            background: resultBadges[result].bg, color: resultBadges[result].color,
            fontWeight: 800, fontSize: '.88rem' }}>
            {resultBadges[result].label}
          </div>
        )}

        {/* Area rows */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.07em', color: T.secondary, marginBottom: 10 }}>
            Inspección por Área
          </div>
          {AREAS.map(a => (
            <AreaRow key={a} nombre={a} data={areas[a]} onChange={d => setArea(a, d)} />
          ))}
        </div>

        {/* Observaciones generales */}
        <div style={{ marginBottom: 16 }}>
          <Lbl text="Observaciones generales (opcional)">
            <textarea value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Notas adicionales sobre la inspección..."
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </Lbl>
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ padding: '10px 22px', background: saving ? '#BDBDBD' : T.primary,
            color: T.white, border: 'none', borderRadius: 6, fontWeight: 700,
            fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Guardando...' : 'Guardar Inspección'}
        </button>
      </div>

      {/* Historial */}
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary }}>
            Historial de Inspecciones ({filtHist.length})
          </div>
          <select value={filtRes} onChange={e => setFiltRes(e.target.value)}
            style={{ padding: '6px 12px', border: `1.5px solid ${T.border}`, borderRadius: 6,
              fontSize: '.82rem', outline: 'none', fontFamily: 'inherit', color: T.textDark, background: T.white }}>
            <option value="">Todos los resultados</option>
            <option value="LIMPIO">✅ LIMPIO</option>
            <option value="CON HALLAZGO">⚠️ CON HALLAZGO</option>
            <option value="PENDIENTE">🔴 PENDIENTE</option>
          </select>
        </div>

        {histLoading ? <Skeleton rows={5} /> : filtHist.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: T.textMid, fontSize: '.85rem' }}>
            Sin inspecciones registradas
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Responsable', 'Áreas', 'Hallazgos', 'Resultado', 'Foto', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', color: T.white, fontSize: '.7rem',
                      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
                      textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtHist.slice(0, 100).map((r, i) => {
                  const rb = resultBadges[r.resultado] || { label: r.resultado || '—', bg: T.bgLight, color: T.textMid };
                  const hallazgos = r.hallazgos || [];
                  const fotos = hallazgos.filter(h => h.foto);
                  const inspAreas = r.areas
                    ? AREAS.filter(a => r.areas[a]?.inspeccionada).join(', ')
                    : '—';
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FBF9' }}>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0',
                        fontWeight: 600, color: T.textMid, whiteSpace: 'nowrap' }}>{r.fecha}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0' }}>{r.resp || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.75rem', borderBottom: '1px solid #F0F0F0',
                        color: T.textMid }}>{inspAreas}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }}>
                        {hallazgos.length === 0 ? (
                          <span style={{ color: T.border, fontSize: '.72rem' }}>—</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {hallazgos.map((h, j) => (
                              <span key={j} style={{ fontSize: '.68rem', padding: '2px 7px', borderRadius: 10,
                                background: '#E3F2FD', color: T.info, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {h.area} · {h.tipo}
                                {h.accion === 'Pendiente' && <span style={{ color: T.danger }}> ⚠</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0', whiteSpace: 'nowrap' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '.68rem',
                          fontWeight: 800, background: rb.bg, color: rb.color }}>
                          {rb.label}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }}>
                        {fotos.length > 0
                          ? <img src={fotos[0].foto} alt="" style={{ height: 28, borderRadius: 3, cursor: 'pointer' }} title="Ver foto" />
                          : <span style={{ color: T.border, fontSize: '.72rem' }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }}>
                        <button onClick={() => remove(r.id)}
                          style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
                            padding: '3px 8px', cursor: 'pointer', fontSize: '.72rem', color: T.textMid }}>✕</button>
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
