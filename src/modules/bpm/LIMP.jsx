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

const AREAS = [
  { nombre: 'Cooler 1',       emoji: '❄️', checks: ['¿Limpio?'] },
  { nombre: 'Cooler 2',       emoji: '❄️', checks: ['¿Limpio?'] },
  { nombre: 'Pre-carga',      emoji: '📦', checks: ['¿OK y despejado?'] },
  { nombre: 'Bodega general', emoji: '🏭', checks: ['¿Limpia?', '¿Ordenada?'] },
];

const today = () => new Date().toISOString().slice(0, 10);

const initAreas = () =>
  AREAS.map(a => ({
    nombre: a.nombre,
    checks: a.checks.map(texto => ({ texto, ok: null })),
  }));

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
export default function LIMP() {
  const toast = useToast();
  const { empleados, loading: empLoading } = useEmpleados();
  const { data: registros, loading: histLoading } = useCollection('limp', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { add, saving } = useWrite('limp');

  const [form, setForm] = useState({ fecha: today(), responsable: '' });
  const [areas, setAreas] = useState(initAreas);
  const [obs, setObs] = useState('');

  const setCheck = (areaIdx, checkIdx, value) => {
    setAreas(prev => prev.map((a, ai) =>
      ai !== areaIdx ? a : {
        ...a,
        checks: a.checks.map((c, ci) => ci !== checkIdx ? c : { ...c, ok: value }),
      }
    ));
  };

  // Compute totals
  const allChecks = areas.flatMap(a => a.checks);
  const totalChecks = allChecks.length;
  const checksOk = allChecks.filter(c => c.ok === true).length;
  const hasNull = allChecks.some(c => c.ok === null);
  const resultado = hasNull ? null : checksOk === totalChecks ? 'cumple' : 'no_cumple';

  const handleSave = async () => {
    if (!form.fecha) { toast('Ingresá la fecha', 'error'); return; }
    if (!form.responsable) { toast('Seleccioná el responsable', 'error'); return; }
    if (hasNull) { toast('Marcá todos los checks antes de guardar', 'error'); return; }

    try {
      await add({
        fecha: form.fecha,
        responsable: form.responsable,
        areas,
        checksOk,
        totalChecks,
        resultado,
        obs,
      });
      toast('Registro LIMP guardado correctamente');
      setAreas(initAreas());
      setObs('');
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: T.textDark, maxWidth: 860, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>Limpieza Bodega</h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, marginTop: 4, marginBottom: 0 }}>
          Inspección de limpieza y orden de todas las áreas
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

        {/* Areas checklist */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary, marginBottom: 12 }}>
            Áreas ({checksOk}/{totalChecks} checks aprobados)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {areas.map((area, ai) => {
              const areaOk = area.checks.every(c => c.ok === true);
              const areaDef = AREAS[ai];
              return (
                <div key={area.nombre} style={{
                  background: T.bgLight,
                  border: `1px solid ${area.checks.some(c => c.ok === false) ? '#FFCDD2' : area.checks.every(c => c.ok === true) ? '#C8E6C9' : T.border}`,
                  borderRadius: 10, padding: '16px 18px',
                }}>
                  {/* Area header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: '1.2rem' }}>{areaDef.emoji}</span>
                    <span style={{ fontWeight: 700, fontSize: '.9rem', color: T.textDark }}>{area.nombre}</span>
                    {!area.checks.some(c => c.ok === null) && (
                      <Badge type={areaOk ? 'cumple' : 'no_cumple'} />
                    )}
                  </div>

                  {/* Checks */}
                  {area.checks.map((check, ci) => (
                    <div key={check.texto} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 0',
                      borderBottom: ci < area.checks.length - 1 ? `1px solid ${T.border}` : 'none',
                    }}>
                      <span style={{ fontSize: '.85rem', color: T.textDark, flex: 1 }}>{check.texto}</span>
                      <div style={{ display: 'flex', gap: 6, marginLeft: 12, flexShrink: 0 }}>
                        <button
                          onClick={() => setCheck(ai, ci, true)}
                          style={{
                            width: 38, height: 34, borderRadius: 6, border: '1.5px solid',
                            cursor: 'pointer', fontWeight: 700, fontSize: '.9rem',
                            fontFamily: 'inherit', transition: 'all .15s',
                            background: check.ok === true ? T.accent : T.white,
                            borderColor: check.ok === true ? T.accent : T.border,
                            color: check.ok === true ? T.white : T.textMid,
                          }}
                          title="Cumple"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setCheck(ai, ci, false)}
                          style={{
                            width: 38, height: 34, borderRadius: 6, border: '1.5px solid',
                            cursor: 'pointer', fontWeight: 700, fontSize: '.9rem',
                            fontFamily: 'inherit', transition: 'all .15s',
                            background: check.ok === false ? T.danger : T.white,
                            borderColor: check.ok === false ? T.danger : T.border,
                            color: check.ok === false ? T.white : T.textMid,
                          }}
                          title="No cumple"
                        >
                          ✗
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Result preview */}
        {!hasNull && (
          <div style={{
            background: resultado === 'no_cumple' ? '#FFEBEE' : '#E8F5E9',
            border: `1px solid ${resultado === 'no_cumple' ? '#FFCDD2' : '#C8E6C9'}`,
            borderRadius: 8, padding: '10px 16px', marginBottom: 20,
            fontSize: '.83rem', fontWeight: 600,
            color: resultado === 'no_cumple' ? T.danger : T.secondary,
          }}>
            {resultado === 'no_cumple'
              ? `✗ No cumple — ${totalChecks - checksOk} check(s) no aprobado(s)`
              : `✓ Cumple — Todas las áreas en correcto estado`}
          </div>
        )}

        <Lbl text="Observaciones">
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Observaciones, acciones correctivas..."
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
          {saving ? 'Guardando...' : 'Guardar Registro LIMP'}
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
                  {['Fecha', 'Responsable', 'Checks OK', 'Total', 'Resultado'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', color: T.white,
                      fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(registros || []).slice(0, 100).map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? T.white : '#F9FBF9' }}>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600 }}>{r.fecha}</td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.responsable || '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', textAlign: 'center', color: T.accent, fontWeight: 600 }}>{r.checksOk ?? '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', textAlign: 'center' }}>{r.totalChecks ?? '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>
                      <Badge type={r.resultado || 'no_cumple'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
