import { useState } from 'react';
import { useEmpleados } from '../../hooks/useMainData';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', accent: '#43A047',
  white: '#FFFFFF', bgLight: '#F5F5F5', bgCard: '#FFFFFF',
  border: '#E0E0E0', textDark: '#212121', textMid: '#616161',
  danger: '#C62828', warn: '#E65100',
};

const AREAS = ['Cooler 1', 'Cooler 2', 'Pre-carga', 'Bodega', 'Baños'];
const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inp = (val, onChange, type = 'text', extra = {}) => (
  <input type={type} value={val} onChange={e => onChange(e.target.value)}
    style={{
      padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
      fontSize: '.88rem', outline: 'none', width: '100%', fontFamily: 'inherit', ...extra,
    }} />
);

const sel = (val, onChange, opts) => (
  <select value={val} onChange={e => onChange(e.target.value)}
    style={{
      padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
      fontSize: '.88rem', outline: 'none', width: '100%', fontFamily: 'inherit',
      background: '#fff', cursor: 'pointer',
    }}>
    {opts}
  </select>
);

const Badge = ({ type }) => {
  const M = {
    cumple:    { bg: '#E8F5E9', c: '#2E7D32', l: '✓ Cumple' },
    no_cumple: { bg: '#FFEBEE', c: '#C62828', l: '✗ No cumple' },
    ok:        { bg: '#E8F5E9', c: '#2E7D32', l: '✓ OK' },
    no_ok:     { bg: '#FFEBEE', c: '#C62828', l: '✗ No OK' },
  };
  const m = M[type] || { bg: '#F5F5F5', c: '#616161', l: type };
  return <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600, background: m.bg, color: m.c }}>{m.l}</span>;
};

const Lbl = ({ text, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <span style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary }}>{text}</span>
    {children}
  </label>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 24, marginBottom: 20, ...style }}>
    {children}
  </div>
);

const SectionTitle = ({ children }) => (
  <div style={{
    fontSize: '.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em',
    color: T.secondary, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${T.border}`,
  }}>{children}</div>
);

// ─── PPM indicator ────────────────────────────────────────────────────────────
function PpmIndicator({ ppm }) {
  const val = Number(ppm);
  if (!ppm || isNaN(val)) return null;
  const inRange = val >= 100 && val <= 200;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 6,
      background: inRange ? '#E8F5E9' : '#FFEBEE',
      border: `1px solid ${inRange ? '#C8E6C9' : '#FFCDD2'}`,
      fontSize: '.78rem', fontWeight: 600,
      color: inRange ? T.secondary : T.danger,
      marginTop: 6,
    }}>
      {inRange ? '✓ En rango (100–200 ppm)' : '⚠ Fuera de rango — objetivo: 150 ppm'}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Fumigacion() {
  const toast = useToast();
  const { empleados, loading: empLoading } = useEmpleados();
  const { data: registros, loading: histLoading } = useCollection('fum', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { add, saving } = useWrite('fum');

  const [form, setForm] = useState({
    fecha: today(),
    hora: nowTime(),
    responsable: '',
    area: '',
    concentracionPpm: '',
    volumenLitros: '',
    resultado: 'ok',
    obs: '',
  });

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.fecha)          { toast('Ingresá la fecha', 'error'); return; }
    if (!form.responsable)    { toast('Seleccioná el responsable', 'error'); return; }
    if (!form.area)           { toast('Seleccioná el área', 'error'); return; }
    if (!form.concentracionPpm) { toast('Ingresá la concentración en ppm', 'error'); return; }

    try {
      await add({
        fecha: form.fecha,
        hora: form.hora,
        responsable: form.responsable,
        area: form.area,
        concentracionPpm: Number(form.concentracionPpm) || 0,
        volumenLitros: Number(form.volumenLitros) || 0,
        resultado: form.resultado,
        obs: form.obs,
      });
      toast('Registro de desinfección guardado correctamente');
      setForm(f => ({
        ...f,
        area: '',
        concentracionPpm: '',
        volumenLitros: '',
        resultado: 'ok',
        obs: '',
        hora: nowTime(),
      }));
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  const ppmVal = Number(form.concentracionPpm);
  const ppmInRange = ppmVal >= 100 && ppmVal <= 200;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: T.textDark, maxWidth: 860, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Fumigación — Agua y Cloro
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, marginTop: 4, marginBottom: 0 }}>
          Registro de desinfección con agua y cloro · Concentración objetivo: 150 ppm
        </p>
      </div>

      <Card>
        <SectionTitle>Nuevo Registro</SectionTitle>

        {/* Row 1: fecha, hora */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Lbl text="Fecha">{inp(form.fecha, v => set('fecha', v), 'date')}</Lbl>
          <Lbl text="Hora">{inp(form.hora, v => set('hora', v), 'time')}</Lbl>
        </div>

        {/* Row 2: responsable, area */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Lbl text="Responsable">
            {empLoading
              ? <Skeleton height={38} />
              : sel(form.responsable, v => set('responsable', v),
                  <>
                    <option value="">— Seleccionar —</option>
                    {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}{e.cargo ? ' · ' + e.cargo : ''}</option>)}
                  </>
                )
            }
          </Lbl>
          <Lbl text="Área">
            {sel(form.area, v => set('area', v),
              <>
                <option value="">— Seleccionar área —</option>
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </>
            )}
          </Lbl>
        </div>

        {/* Row 3: concentracion, volumen */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Lbl text="Concentración (ppm)">
            {inp(form.concentracionPpm, v => set('concentracionPpm', v), 'number', { min: 0 })}
            {form.concentracionPpm && <PpmIndicator ppm={form.concentracionPpm} />}
          </Lbl>
          <Lbl text="Volumen (litros)">
            {inp(form.volumenLitros, v => set('volumenLitros', v), 'number', { min: 0 })}
          </Lbl>
        </div>

        {/* Resultado radio */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary, marginBottom: 10 }}>
            Resultado
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { val: 'ok',    label: '✓ OK',    activeColor: T.accent },
              { val: 'no_ok', label: '✗ No OK', activeColor: T.danger },
            ].map(({ val, label, activeColor }) => (
              <button
                key={val}
                onClick={() => set('resultado', val)}
                style={{
                  padding: '8px 20px', borderRadius: 6, border: '1.5px solid',
                  cursor: 'pointer', fontSize: '.85rem', fontWeight: 600,
                  fontFamily: 'inherit', transition: 'all .15s',
                  background: form.resultado === val ? activeColor : T.white,
                  borderColor: form.resultado === val ? activeColor : T.border,
                  color: form.resultado === val ? T.white : T.textMid,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Lbl text="Observaciones">
          <textarea
            value={form.obs}
            onChange={e => set('obs', e.target.value)}
            placeholder="Observaciones, condiciones del área, acciones..."
            rows={3}
            style={{
              padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
              fontSize: '.88rem', outline: 'none', width: '100%', fontFamily: 'inherit',
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </Lbl>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: 16, padding: '11px 28px',
            background: saving ? '#BDBDBD' : T.primary,
            color: T.white, border: 'none', borderRadius: 6,
            fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Guardando...' : 'Guardar Registro FUM'}
        </button>
      </Card>

      {/* History */}
      <Card>
        <SectionTitle>Historial ({(registros || []).length} registros)</SectionTitle>

        {histLoading ? (
          <Skeleton height={160} />
        ) : (registros || []).length === 0 ? (
          <p style={{ textAlign: 'center', padding: 32, color: T.textMid, fontSize: '.85rem' }}>Sin registros aún.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Hora', 'Responsable', 'Área', 'PPM', 'Resultado'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', color: T.white,
                      fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(registros || []).slice(0, 100).map((r, i) => {
                  const ppm = r.concentracionPpm;
                  const inRange = ppm >= 100 && ppm <= 200;
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? T.white : '#F9FBF9' }}>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600 }}>{r.fecha}</td>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.hora || '—'}</td>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.responsable || '—'}</td>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.area || '—'}</td>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: ppm ? (inRange ? T.accent : T.danger) : T.textMid }}>
                        {ppm ? `${ppm} ppm` : '—'}
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>
                        <Badge type={r.resultado === 'ok' ? 'ok' : 'no_ok'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
