import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  primary:   '#1B5E20',
  secondary: '#2E7D32',
  white:     '#FFFFFF',
  border:    '#E0E0E0',
  textDark:  '#212121',
  textMid:   '#616161',
  danger:    '#C62828',
  warn:      '#E65100',
  rowAlt:    '#F9FBF9',
};
const card = {
  background: '#fff', borderRadius: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 20, marginBottom: 20,
};
const LBL = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '.06em', color: T.textMid,
};
const INP = {
  padding: '9px 12px', border: `1px solid ${T.border}`, borderRadius: 6,
  fontSize: '.83rem', outline: 'none', fontFamily: 'inherit',
  width: '100%', marginTop: 2, background: '#fff', color: T.textDark,
};

const today = () => new Date().toISOString().slice(0, 10);

const TEMAS = [
  'BPM', 'Higiene personal', 'Manejo alimentos', 'EPP',
  'Control plagas', 'Primeros auxilios', 'Seguridad industrial', 'Otro',
];

const RESULTADOS = [
  { value: 'Aprobado',     label: 'Aprobado' },
  { value: 'Pendiente',    label: 'Pendiente' },
  { value: 'Reprogramar',  label: 'Reprogramar' },
];

const INIT = () => ({
  fecha: today(), tema: '', temaOtro: '', instructor: '',
  duracion: '', resultado: 'Aprobado', participantes: [], obs: '',
});

const resultColor = (r) => {
  if (r === 'Aprobado')    return { bg: 'rgba(46,125,50,.12)',    color: '#2E7D32' };
  if (r === 'Reprogramar') return { bg: 'rgba(230,81,0,.10)',     color: '#E65100' };
  return                          { bg: 'rgba(33,33,33,.07)',     color: '#616161' };
};

export default function Capacitacion() {
  const toast = useToast();
  const { data, loading } = useCollection('cap', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { empleados, loading: empLoading } = useEmpleados();
  const { add, saving } = useWrite('cap');

  const [form, setForm] = useState(INIT());
  const [manualNombre, setManualNombre] = useState('');

  // Add participant from employee dropdown
  const addFromEmp = (nombre) => {
    if (!nombre || form.participantes.includes(nombre)) return;
    setForm(f => ({ ...f, participantes: [...f.participantes, nombre] }));
  };

  // Add manual participant
  const addManual = () => {
    const n = manualNombre.trim();
    if (!n || form.participantes.includes(n)) return;
    setForm(f => ({ ...f, participantes: [...f.participantes, n] }));
    setManualNombre('');
  };

  const removeParticipante = (n) =>
    setForm(f => ({ ...f, participantes: f.participantes.filter(x => x !== n) }));

  const handleSave = async () => {
    if (!form.fecha || !form.tema || !form.instructor) {
      toast('Fecha, tema e instructor son requeridos', 'error'); return;
    }
    const temaFinal = form.tema === 'Otro' ? (form.temaOtro || 'Otro') : form.tema;
    await add({ ...form, tema: temaFinal });
    toast('Capacitación registrada');
    setForm(INIT());
    setManualNombre('');
  };

  if (loading || empLoading) {
    return (
      <div>
        <div style={{ height: 28, background: '#E8F5E9', borderRadius: 6, width: 240, marginBottom: 8 }} />
        <div style={card}><Skeleton rows={6} /></div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: T.primary, margin: 0 }}>
          Registro de Capacitaciones
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, margin: '4px 0 0' }}>
          Control de formación y capacitación del personal
        </p>
      </div>

      {/* ── Form ── */}
      <div style={card}>
        <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
          Nueva Capacitación
        </div>

        {/* Row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 12 }}>
          <label style={LBL}>
            Fecha *
            <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} style={INP} />
          </label>
          <label style={LBL}>
            Tema *
            <select value={form.tema} onChange={e => setForm(f => ({ ...f, tema: e.target.value }))} style={INP}>
              <option value="">— Seleccionar —</option>
              {TEMAS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {form.tema === 'Otro' && (
            <label style={LBL}>
              Especificar tema
              <input value={form.temaOtro} onChange={e => setForm(f => ({ ...f, temaOtro: e.target.value }))} placeholder="Descripción del tema" style={INP} />
            </label>
          )}
          <label style={LBL}>
            Instructor *
            <input value={form.instructor} onChange={e => setForm(f => ({ ...f, instructor: e.target.value }))} placeholder="Nombre instructor" style={INP} />
          </label>
          <label style={LBL}>
            Duración (horas)
            <input type="number" min="0.5" step="0.5" value={form.duracion} onChange={e => setForm(f => ({ ...f, duracion: e.target.value }))} placeholder="2" style={INP} />
          </label>
          <label style={LBL}>
            Resultado
            <select value={form.resultado} onChange={e => setForm(f => ({ ...f, resultado: e.target.value }))} style={INP}>
              {RESULTADOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
        </div>

        {/* Participantes */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMid, marginBottom: 8 }}>
            Participantes ({form.participantes.length})
          </div>

          {/* Add controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <select
              value=""
              onChange={e => { addFromEmp(e.target.value); e.target.value = ''; }}
              style={{ ...INP, flex: '1 1 200px', width: 'auto', marginTop: 0 }}
            >
              <option value="">+ Agregar desde lista de empleados</option>
              {empleados.map(e => (
                <option key={e.nombre} value={e.nombre}>{e.nombre}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 6, flex: '1 1 200px' }}>
              <input
                value={manualNombre}
                onChange={e => setManualNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addManual()}
                placeholder="Nombre manual..."
                style={{ ...INP, flex: 1, width: 'auto', marginTop: 0 }}
              />
              <button onClick={addManual} style={{
                padding: '9px 16px', background: T.secondary, color: '#fff',
                border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '.85rem', flexShrink: 0,
              }}>+</button>
            </div>
          </div>

          {/* Chips */}
          {form.participantes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {form.participantes.map(n => (
                <span key={n} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(46,125,50,.10)', color: T.primary,
                  padding: '5px 10px 5px 12px', borderRadius: 20,
                  fontSize: '.78rem', fontWeight: 600,
                  border: '1px solid rgba(46,125,50,.25)',
                }}>
                  {n}
                  <button onClick={() => removeParticipante(n)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: T.danger, fontWeight: 700, fontSize: '1rem', lineHeight: 1,
                    padding: '0 2px', fontFamily: 'inherit',
                  }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Observaciones */}
        <label style={{ ...LBL, marginBottom: 14 }}>
          Observaciones
          <textarea value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))}
            rows={2} placeholder="Observaciones, temas cubiertos, evaluación..."
            style={{ ...INP, resize: 'vertical', lineHeight: 1.5 }} />
        </label>

        <button onClick={handleSave} disabled={saving} style={{
          padding: '11px 28px', background: saving ? T.border : T.primary,
          color: saving ? T.textMid : '#fff', border: 'none', borderRadius: 6,
          fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}>
          {saving ? 'Guardando...' : 'Guardar Capacitación'}
        </button>
      </div>

      {/* ── History ── */}
      <div style={card}>
        <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
          Historial — {data.length} registros
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.primary }}>
                {['Fecha', 'Tema', 'Instructor', 'Horas', 'Participantes', 'Resultado'].map(h => (
                  <th key={h} style={{
                    padding: '9px 14px', textAlign: 'left', color: '#fff',
                    fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 60).map((r, idx) => {
                const rc = resultColor(r.resultado);
                return (
                  <tr key={r.id} style={{ background: idx % 2 === 1 ? T.rowAlt : '#fff', borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', fontWeight: 600, color: T.textDark, whiteSpace: 'nowrap' }}>{r.fecha}</td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textDark }}>{r.tema || '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textMid }}>{r.instructor || '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textMid }}>{r.duracion ? `${r.duracion}h` : '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textMid }}>
                      {(r.participantes || []).length} persona{(r.participantes || []).length !== 1 ? 's' : ''}
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.72rem', fontWeight: 700, background: rc.bg, color: rc.color }}>
                        {r.resultado || '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: T.textMid, fontSize: '.83rem' }}>
                  Sin registros aún
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
