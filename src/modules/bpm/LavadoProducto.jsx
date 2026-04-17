import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary:   '#1B5E20',
  secondary: '#2E7D32',
  accent:    '#43A047',
  white:     '#FFFFFF',
  border:    '#E0E0E0',
  bgLight:   '#F5F5F5',
  bgGreen:   '#E8F5E9',
  textDark:  '#1A1A18',
  textMid:   '#6B6B60',
  danger:    '#C62828',
  warn:      '#E65100',
  rowAlt:    '#F9FBF9',
};

const card = {
  background: '#fff', borderRadius: 10,
  border: `1px solid ${T.border}`, padding: 24, marginBottom: 20,
};

const INP = {
  padding: '8px 11px', border: `1.5px solid ${T.border}`, borderRadius: 6,
  fontSize: '.85rem', outline: 'none', fontFamily: 'inherit',
  width: '100%', boxSizing: 'border-box', background: '#fff', color: T.textDark,
};

const Lbl = ({ text, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary }}>
      {text}
    </span>
    {children}
  </label>
);

const SectionTitle = ({ children }) => (
  <div style={{ fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.secondary, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
    {children}
  </div>
);

const today = () => new Date().toISOString().slice(0, 10);
const nowHM = () => { const d = new Date(); return d.toTimeString().slice(0, 5); };

// ─── Tank configuration ───────────────────────────────────────────────────────
const TANKS = [
  { key: 't1', label: 'Tanque 1' },
  { key: 't2', label: 'Tanque 2' },
  { key: 't3', label: 'Tanque 3' },
  { key: 't4', label: 'Tanque 4' },
];

const TRATAMIENTOS = [
  'Agua-Cloro 150PPM',
  'Agua-Peróxido',
  'Agua-Cera',
  'Solo Agua',
];

const initTank = () => ({
  tratamiento: 'Agua-Cloro 150PPM',
  concentracion: '',
  resultado: 'cumple',
  usado: true,
  obs: '',
});

const initForm = () => ({
  fecha: today(),
  hora: nowHM(),
  responsable: '',
  t1: initTank(),
  t2: initTank(),
  t3: initTank(),
  t4: initTank(),
  obs: '',
});

// ─── Tank Card ────────────────────────────────────────────────────────────────
function TankCard({ tankKey, label, data, onChange }) {
  const usado    = data.usado !== false; // default true para registros viejos
  const isCumple = data.resultado === 'cumple';
  const showPPM  = data.tratamiento === 'Agua-Cloro 150PPM';

  return (
    <div style={{
      border: `2px solid ${!usado ? T.border : isCumple ? T.secondary : T.danger}`,
      borderRadius: 10, padding: 18,
      background: !usado ? '#F5F5F5' : isCumple ? T.bgGreen : '#FFF8F8',
      opacity: !usado ? 0.7 : 1,
    }}>
      {/* Tank header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: '.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: T.primary }}>
          {label}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '.72rem', fontWeight: 600, color: usado ? T.secondary : T.textMid }}>
          <input
            type="checkbox"
            checked={usado}
            onChange={e => onChange(tankKey, 'usado', e.target.checked)}
            style={{ accentColor: T.primary, width: 15, height: 15 }}
          />
          {usado ? 'En uso' : 'No usado'}
        </label>
      </div>

      {!usado && (
        <div style={{ textAlign: 'center', padding: '12px 0', fontSize: '.82rem', color: T.textMid, fontStyle: 'italic' }}>
          Tanque no utilizado en esta jornada
        </div>
      )}

      {usado && <>
      {/* Tratamiento */}
      <div style={{ marginBottom: 12 }}>
        <Lbl text="Tratamiento">
          <select
            value={data.tratamiento}
            onChange={e => onChange(tankKey, 'tratamiento', e.target.value)}
            style={{ ...INP, cursor: 'pointer' }}
          >
            {TRATAMIENTOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Lbl>
      </div>

      {/* Concentración — only relevant for Cloro */}
      {showPPM && (
        <div style={{ marginBottom: 12 }}>
          <Lbl text="Concentración (PPM)">
            <input
              type="number"
              min="0"
              step="1"
              value={data.concentracion}
              onChange={e => onChange(tankKey, 'concentracion', e.target.value)}
              placeholder="150"
              style={INP}
            />
          </Lbl>
        </div>
      )}

      {/* Resultado */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary, marginBottom: 6 }}>
          Resultado
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { v: 'cumple',    l: '✓ Cumple',    bg: T.secondary, tc: T.white },
            { v: 'no_cumple', l: '✗ No Cumple', bg: T.danger,    tc: T.white },
          ].map(opt => (
            <button
              key={opt.v}
              onClick={() => onChange(tankKey, 'resultado', opt.v)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 6, border: '1.5px solid',
                cursor: 'pointer', fontWeight: 700, fontSize: '.78rem', fontFamily: 'inherit',
                transition: 'all .15s',
                background: data.resultado === opt.v ? opt.bg : T.white,
                borderColor: data.resultado === opt.v ? opt.bg : T.border,
                color: data.resultado === opt.v ? opt.tc : T.textMid,
              }}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Obs */}
      <div>
        <Lbl text="Observaciones">
          <textarea
            value={data.obs}
            onChange={e => onChange(tankKey, 'obs', e.target.value)}
            rows={2}
            placeholder={`Novedades ${label}...`}
            style={{ ...INP, resize: 'vertical', lineHeight: 1.5 }}
          />
        </Lbl>
      </div>
      </>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LavadoProducto() {
  const toast = useToast();
  const { data, loading: dataLoading } = useCollection('lavadoProd', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { empleados, loading: empLoading } = useEmpleados();
  const { add, remove, saving } = useWrite('lavadoProd');

  const [form, setForm] = useState(initForm());

  // Update a top-level form field
  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Update a field inside a tank sub-object
  const setTankField = (tankKey, field, val) =>
    setForm(f => ({ ...f, [tankKey]: { ...f[tankKey], [field]: val } }));

  const handleSave = async () => {
    if (!form.fecha || !form.responsable) {
      toast('Fecha y responsable son requeridos', 'error'); return;
    }
    try {
      await add({ ...form, creadoEn: new Date().toISOString() });
      toast('Registro de lavado guardado');
      setForm(initForm());
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  const allCumple = TANKS.every(t => form[t.key].resultado === 'cumple');

  return (
    <div style={{ maxWidth: 960, fontFamily: 'Inter, system-ui, sans-serif', color: T.textDark }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Lavado y Desinfección de Producto
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, margin: '4px 0 0' }}>
          Control de tanques de lavado — BPM Vegetal
        </p>
      </div>

      {/* Form card */}
      <div style={card}>
        <SectionTitle>Nuevo Registro</SectionTitle>

        {/* Header fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 24 }}>
          <Lbl text="Fecha *">
            <input type="date" value={form.fecha} onChange={e => setField('fecha', e.target.value)} style={INP} />
          </Lbl>
          <Lbl text="Hora">
            <input type="time" value={form.hora} onChange={e => setField('hora', e.target.value)} style={INP} />
          </Lbl>
          <Lbl text="Responsable *">
            {empLoading ? <Skeleton height={38} /> : (
              <select value={form.responsable} onChange={e => setField('responsable', e.target.value)} style={{ ...INP, cursor: 'pointer' }}>
                <option value="">— Seleccionar —</option>
                {empleados.map(e => <option key={e.nombre} value={e.nombre}>{e.nombre}</option>)}
              </select>
            )}
          </Lbl>
        </div>

        {/* Tank grid */}
        <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.secondary, marginBottom: 12 }}>
          Estado de Tanques
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}>
          {TANKS.map(t => (
            <TankCard
              key={t.key}
              tankKey={t.key}
              label={t.label}
              data={form[t.key]}
              onChange={setTankField}
            />
          ))}
        </div>

        {/* Global resultado indicator */}
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
          background: allCumple ? T.bgGreen : '#FFEBEE',
          border: `1.5px solid ${allCumple ? T.secondary : T.danger}`,
        }}>
          <span style={{ fontSize: '1.1rem' }}>{allCumple ? '✓' : '✗'}</span>
          <span style={{ fontSize: '.82rem', fontWeight: 700, color: allCumple ? T.secondary : T.danger }}>
            {allCumple ? 'Todos los tanques cumplen' : 'Uno o más tanques no cumplen'}
          </span>
        </div>

        {/* Observaciones generales */}
        <div style={{ marginBottom: 20 }}>
          <Lbl text="Observaciones generales">
            <textarea value={form.obs} onChange={e => setField('obs', e.target.value)}
              rows={2} placeholder="Observaciones generales del proceso..."
              style={{ ...INP, resize: 'vertical', lineHeight: 1.5 }} />
          </Lbl>
        </div>

        <button onClick={handleSave} disabled={saving} style={{
          padding: '11px 28px', background: saving ? '#BDBDBD' : T.primary,
          color: T.white, border: 'none', borderRadius: 6,
          fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}>
          {saving ? 'Guardando...' : 'Guardar Registro'}
        </button>
      </div>

      {/* History card */}
      <div style={card}>
        <SectionTitle>Historial</SectionTitle>
        {dataLoading ? <Skeleton height={120} /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Hora', 'Responsable', 'T1', 'T2', 'T3', 'T4', 'Obs', ''].map(h => (
                    <th key={h} style={{
                      padding: '9px 12px', textAlign: 'left', color: T.white,
                      fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase',
                      whiteSpace: 'nowrap', letterSpacing: '.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data || []).slice(0, 80).map((r, idx) => (
                  <tr key={r.id} style={{ background: idx % 2 === 1 ? T.rowAlt : '#fff' }}>
                    <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.fecha || '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', whiteSpace: 'nowrap' }}>{r.hora || '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.responsable || '—'}</td>
                    {TANKS.map(t => {
                      const tank = r[t.key] || {};
                      const ok = tank.resultado === 'cumple';
                      return (
                        <td key={t.key} style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }}>
                          <span style={{
                            padding: '2px 7px', borderRadius: 100, fontSize: '.68rem', fontWeight: 700,
                            background: ok ? T.bgGreen : '#FFEBEE',
                            color: ok ? T.secondary : T.danger,
                          }}>
                            {ok ? '✓' : '✗'}
                          </span>
                        </td>
                      );
                    })}
                    <td style={{ padding: '8px 12px', fontSize: '.75rem', borderBottom: '1px solid #F0F0F0', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.obs || '—'}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }}>
                      <button onClick={() => remove(r.id)}
                        style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: '.75rem', color: T.textMid }}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {(data || []).length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: T.textMid, fontSize: '.83rem' }}>
                      Sin registros aún
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
