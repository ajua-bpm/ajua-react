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

const SINTOMAS = [
  'Fiebre', 'Gripe', 'Diarrea', 'Vómito', 'Dolor abdominal',
  'Tos', 'Herida manos', 'Infección cutánea', 'COVID', 'Otro',
];

const INIT = () => ({
  empleado: '', fecha: today(), sintoma: '', sintomaOtro: '',
  diasFuera: '', fechaRegreso: '', estado: 'activo', obs: '',
});

export default function EmpleadosEnfermos() {
  const toast = useToast();
  const { data, loading } = useCollection('ee', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { empleados, loading: empLoading } = useEmpleados();
  const { add, update, saving } = useWrite('ee');

  const [form, setForm] = useState(INIT());

  const handleSave = async () => {
    if (!form.empleado || !form.fecha || !form.sintoma) {
      toast('Empleado, fecha y síntoma son requeridos', 'error'); return;
    }
    const sintomaFinal = form.sintoma === 'Otro' ? (form.sintomaOtro || 'Otro') : form.sintoma;
    await add({ ...form, sintoma: sintomaFinal });
    toast('Registro guardado');
    setForm(INIT());
  };

  const marcarRegreso = async (r) => {
    await update(r.id, { estado: 'regresó', fechaRegresoReal: today() });
    toast('Empleado marcado como regresado');
  };

  if (loading || empLoading) {
    return (
      <div>
        <div style={{ height: 28, background: '#E8F5E9', borderRadius: 6, width: 260, marginBottom: 8 }} />
        <div style={card}><Skeleton rows={5} /></div>
      </div>
    );
  }

  // All records with estado='activo' (currently out sick)
  const activos = data.filter(r => r.estado === 'activo');

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: T.primary, margin: 0 }}>
          Empleados Enfermos
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, margin: '4px 0 0' }}>
          Control de ausencias por enfermedad — personal en proceso
        </p>
      </div>

      {/* ── Alert Banner ── */}
      {activos.length > 0 && (
        <div style={{
          background: 'rgba(198,40,40,.06)', border: `1.5px solid ${T.danger}`,
          borderRadius: 8, padding: '14px 18px', marginBottom: 20,
        }}>
          <div style={{ fontWeight: 700, color: T.danger, fontSize: '.88rem', marginBottom: 10 }}>
            Personal actualmente fuera por enfermedad — {activos.length} registro{activos.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {activos.map((r, i) => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0',
                borderBottom: i < activos.length - 1 ? `1px solid rgba(198,40,40,.15)` : 'none',
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: '.88rem', color: T.textDark }}>{r.empleado}</span>
                  <span style={{ fontSize: '.78rem', color: T.textMid, marginLeft: 10 }}>
                    {r.sintoma} · desde {r.fecha}
                    {r.fechaRegreso && <span> · regreso est. {r.fechaRegreso}</span>}
                  </span>
                </div>
                <button onClick={() => marcarRegreso(r)} style={{
                  padding: '6px 14px', background: T.secondary, color: '#fff',
                  border: 'none', borderRadius: 5, fontSize: '.75rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}>
                  Regresar ✓
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Form ── */}
      <div style={card}>
        <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
          Nuevo Registro
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 12, marginBottom: 12 }}>
          <label style={LBL}>
            Empleado *
            <select value={form.empleado} onChange={e => setForm(f => ({ ...f, empleado: e.target.value }))} style={INP}>
              <option value="">— Seleccionar —</option>
              {empleados.map(e => <option key={e.nombre} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </label>
          <label style={LBL}>
            Fecha inicio *
            <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} style={INP} />
          </label>
          <label style={LBL}>
            Síntoma *
            <select value={form.sintoma} onChange={e => setForm(f => ({ ...f, sintoma: e.target.value }))} style={INP}>
              <option value="">— Seleccionar —</option>
              {SINTOMAS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {form.sintoma === 'Otro' && (
            <label style={LBL}>
              Especificar
              <input value={form.sintomaOtro} onChange={e => setForm(f => ({ ...f, sintomaOtro: e.target.value }))} placeholder="Describe el síntoma" style={INP} />
            </label>
          )}
          <label style={LBL}>
            Días fuera (est.)
            <input type="number" min="1" value={form.diasFuera} onChange={e => setForm(f => ({ ...f, diasFuera: e.target.value }))} placeholder="1" style={INP} />
          </label>
          <label style={LBL}>
            Fecha regreso est.
            <input type="date" value={form.fechaRegreso} onChange={e => setForm(f => ({ ...f, fechaRegreso: e.target.value }))} style={INP} />
          </label>
        </div>

        <label style={{ ...LBL, marginBottom: 14 }}>
          Observaciones
          <textarea value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))}
            rows={2} placeholder="Detalles adicionales, indicaciones médicas..."
            style={{ ...INP, resize: 'vertical', lineHeight: 1.5 }} />
        </label>

        <button onClick={handleSave} disabled={saving} style={{
          padding: '11px 28px', background: saving ? T.border : T.primary,
          color: saving ? T.textMid : '#fff', border: 'none', borderRadius: 6,
          fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}>
          {saving ? 'Guardando...' : 'Guardar Registro'}
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
                {['Empleado', 'Fecha', 'Síntoma', 'Días', 'Regreso est.', 'Estado'].map(h => (
                  <th key={h} style={{
                    padding: '9px 14px', textAlign: 'left', color: '#fff',
                    fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 60).map((r, idx) => (
                <tr key={r.id} style={{ background: idx % 2 === 1 ? T.rowAlt : '#fff', borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', fontWeight: 600, color: T.textDark }}>{r.empleado}</td>
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textDark, whiteSpace: 'nowrap' }}>{r.fecha}</td>
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textMid }}>{r.sintoma || '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textMid }}>{r.diasFuera || '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textMid, whiteSpace: 'nowrap' }}>{r.fechaRegreso || '—'}</td>
                  <td style={{ padding: '9px 14px' }}>
                    {r.estado === 'regresó' ? (
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.72rem', fontWeight: 700, background: 'rgba(46,125,50,.12)', color: T.secondary }}>
                        Regresó
                      </span>
                    ) : (
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.72rem', fontWeight: 700, background: 'rgba(198,40,40,.10)', color: T.danger }}>
                        Fuera
                      </span>
                    )}
                  </td>
                </tr>
              ))}
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
