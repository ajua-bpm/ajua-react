import { useState } from 'react';
import { useEmpleados } from '../../hooks/useMainData';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', accent: '#43A047',
  white: '#FFFFFF', bgLight: '#F5F5F5', bgCard: '#FFFFFF',
  border: '#E0E0E0', textDark: '#1A1A18', textMid: '#6B6B60',
  danger: '#C62828', warn: '#E65100',
};

const BASCULAS = [
  'Báscula 1 — Recepción',
  'Báscula 2 — Clasificación',
  'Báscula 3 — Empaque',
  'Báscula 4 — Despacho',
];

const today = () => new Date().toISOString().slice(0, 10);
const initBasculas = () => BASCULAS.map(nombre => ({ nombre, estado: 'ok', variacionGramos: '' }));

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
  };
  const m = M[type] || { bg: '#F5F5F5', c: '#6B6B60', l: type };
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function BAS() {
  const toast = useToast();
  const { empleados, loading: empLoading } = useEmpleados();
  const { data: registros, loading: histLoading } = useCollection('bas', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { add, saving } = useWrite('bas');

  const [form, setForm] = useState({ fecha: today(), responsable: '' });
  const [basculas, setBasculas] = useState(initBasculas);
  const [obs, setObs] = useState('');

  const setBascula = (i, field, value) =>
    setBasculas(prev => prev.map((b, idx) => idx !== i ? b : { ...b, [field]: value }));

  const handleSave = async () => {
    if (!form.fecha) { toast('Ingresá la fecha', 'error'); return; }
    if (!form.responsable) { toast('Seleccioná el responsable', 'error'); return; }

    const conVariacion = basculas.filter(b => b.estado === 'variacion').length;
    const resultado = conVariacion === 0 ? 'cumple' : 'no_cumple';

    try {
      await add({
        fecha: form.fecha,
        responsable: form.responsable,
        basculas: basculas.map(b => ({
          nombre: b.nombre,
          estado: b.estado,
          variacionGramos: b.estado === 'variacion' ? (Number(b.variacionGramos) || 0) : null,
        })),
        resultado,
        obs,
      });
      toast('Registro BAS guardado correctamente');
      setBasculas(initBasculas());
      setObs('');
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  const hasVariacion = basculas.some(b => b.estado === 'variacion');

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: T.textDark, maxWidth: 860, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>Básculas</h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, marginTop: 4, marginBottom: 0 }}>
          Verificación diaria de calibración de las 4 básculas
        </p>
      </div>

      <Card>
        <SectionTitle>Nuevo Registro</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
          <Lbl text="Fecha">{inp(form.fecha, v => setForm(f => ({ ...f, fecha: v })), 'date')}</Lbl>
          <Lbl text="Responsable">
            {empLoading
              ? <Skeleton height={38} />
              : sel(form.responsable, v => setForm(f => ({ ...f, responsable: v })),
                  <>
                    <option value="">— Seleccionar —</option>
                    {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}{e.cargo ? ' · ' + e.cargo : ''}</option>)}
                  </>
                )
            }
          </Lbl>
        </div>

        {/* Básculas list */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary, marginBottom: 12 }}>
            Estado de básculas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {basculas.map((b, i) => (
              <div key={b.nombre} style={{
                background: b.estado === 'variacion' ? '#FFF8F8' : T.bgLight,
                border: `1px solid ${b.estado === 'variacion' ? '#FFCDD2' : T.border}`,
                borderRadius: 8, padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: '.88rem', minWidth: 180 }}>{b.nombre}</span>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { val: 'ok', label: '✓ OK', activeColor: T.accent },
                      { val: 'variacion', label: '⚠ Variación', activeColor: T.danger },
                    ].map(({ val, label, activeColor }) => (
                      <button
                        key={val}
                        onClick={() => setBascula(i, 'estado', val)}
                        style={{
                          padding: '6px 14px', borderRadius: 6, border: '1.5px solid',
                          cursor: 'pointer', fontSize: '.8rem', fontWeight: 600,
                          fontFamily: 'inherit',
                          background: b.estado === val ? activeColor : T.white,
                          borderColor: b.estado === val ? activeColor : T.border,
                          color: b.estado === val ? T.white : T.textMid,
                          transition: 'all .15s',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {b.estado === 'variacion' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        value={b.variacionGramos}
                        onChange={e => setBascula(i, 'variacionGramos', e.target.value)}
                        placeholder="Variación"
                        style={{
                          padding: '7px 10px', border: `1.5px solid ${T.danger}`, borderRadius: 6,
                          fontSize: '.83rem', outline: 'none', width: 110, fontFamily: 'inherit',
                        }}
                      />
                      <span style={{ fontSize: '.75rem', color: T.textMid, whiteSpace: 'nowrap' }}>gramos</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Result preview */}
        <div style={{
          background: hasVariacion ? '#FFEBEE' : '#E8F5E9',
          border: `1px solid ${hasVariacion ? '#FFCDD2' : '#C8E6C9'}`,
          borderRadius: 8, padding: '10px 16px', marginBottom: 20,
          fontSize: '.83rem', fontWeight: 600,
          color: hasVariacion ? T.danger : T.secondary,
        }}>
          {hasVariacion
            ? `✗ No cumple — ${basculas.filter(b => b.estado === 'variacion').length} báscula(s) con variación detectada`
            : '✓ Cumple — Todas las básculas en óptimo estado'}
        </div>

        <Lbl text="Observaciones">
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Notas, acciones correctivas..."
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
          {saving ? 'Guardando...' : 'Guardar Registro BAS'}
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
                  {['Fecha', 'Responsable', 'OK', 'Variaciones', 'Resultado'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', color: T.white,
                      fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(registros || []).slice(0, 100).map((r, i) => {
                  const bas = r.basculas || [];
                  const okCount  = bas.filter(b => b.estado === 'ok').length;
                  const varCount = bas.filter(b => b.estado === 'variacion').length;
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? T.white : '#F9FBF9' }}>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600 }}>{r.fecha}</td>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.responsable || '—'}</td>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', textAlign: 'center', color: T.accent, fontWeight: 600 }}>{okCount}</td>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', textAlign: 'center', color: varCount > 0 ? T.danger : T.textMid, fontWeight: varCount > 0 ? 700 : 400 }}>{varCount}</td>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>
                        <Badge type={r.resultado || 'no_cumple'} />
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
