import { useState } from 'react';
import { useEmpleados } from '../../hooks/useMainData';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', accent: '#43A047',
  white: '#FFFFFF', bgLight: '#F5F5F5', bgCard: '#FFFFFF',
  border: '#E0E0E0', textDark: '#1A1A18', textMid: '#6B6B60',
  danger: '#C62828', warn: '#E65100',
};

const HORAS = ['10:00', '12:00', '14:00', '16:00'];
const today = () => new Date().toISOString().slice(0, 10);

// ─── Shared helpers ───────────────────────────────────────────────────────────
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

// ─── Badge ────────────────────────────────────────────────────────────────────
const Badge = ({ type }) => {
  const M = {
    cumple:    { bg: '#E8F5E9', c: '#2E7D32', l: '✓ Cumple' },
    no_cumple: { bg: '#FFEBEE', c: '#C62828', l: '✗ No cumple' },
    ok:        { bg: '#E8F5E9', c: '#2E7D32', l: '✓ OK' },
    novedad:   { bg: '#FFEBEE', c: '#C62828', l: '⚠ Novedad' },
  };
  const m = M[type] || { bg: '#F5F5F5', c: '#6B6B60', l: type };
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 100, fontSize: '.7rem',
      fontWeight: 600, background: m.bg, color: m.c,
    }}>{m.l}</span>
  );
};

// ─── Label wrapper ────────────────────────────────────────────────────────────
const Lbl = ({ text, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <span style={{
      fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.07em', color: T.secondary,
    }}>{text}</span>
    {children}
  </label>
);

// ─── Section card ─────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{
    background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10,
    padding: 24, marginBottom: 20, ...style,
  }}>
    {children}
  </div>
);

const SectionTitle = ({ children }) => (
  <div style={{
    fontSize: '.8rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.08em', color: T.secondary, marginBottom: 16,
    paddingBottom: 10, borderBottom: `1px solid ${T.border}`,
  }}>{children}</div>
);

// ─── Init checks per employee ─────────────────────────────────────────────────
const initChecks = (empleados) =>
  empleados.map(e => ({
    empleadoId: e.id,
    empleado: e.nombre,
    horas: { '10:00': false, '12:00': false, '14:00': false, '16:00': false },
  }));

// ─── Main component ───────────────────────────────────────────────────────────
export default function AL() {
  const toast = useToast();
  const { empleados, loading: empLoading } = useEmpleados();
  const { data: registros, loading: histLoading } = useCollection('al', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { add, saving } = useWrite('al');

  const [form, setForm] = useState({ fecha: today(), responsable: '' });
  const [checks, setChecks] = useState([]);
  const [obs, setObs] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Initialize matrix when empleados load
  if (!empLoading && empleados.length > 0 && !initialized) {
    setChecks(initChecks(empleados));
    setInitialized(true);
  }

  const toggleCell = (empIdx, hora) => {
    setChecks(prev => prev.map((row, i) =>
      i !== empIdx ? row : { ...row, horas: { ...row.horas, [hora]: !row.horas[hora] } }
    ));
  };

  const handleSave = async () => {
    if (!form.fecha) { toast('Ingresá la fecha', 'error'); return; }
    if (!form.responsable) { toast('Seleccioná el responsable', 'error'); return; }
    if (checks.length === 0) { toast('No hay empleados en la matriz', 'error'); return; }

    const totalPosible = checks.length * HORAS.length;
    const totalOk = checks.reduce((s, row) => s + HORAS.filter(h => row.horas[h]).length, 0);
    const pct = totalPosible > 0 ? Math.round(totalOk / totalPosible * 100) : 0;
    const resultado = pct >= 80 ? 'cumple' : 'no_cumple';

    try {
      await add({
        fecha: form.fecha,
        responsable: form.responsable,
        checks,
        obs,
        totalOk,
        totalPosible,
        pct,
        resultado,
      });
      toast('Registro AL guardado correctamente');
      setChecks(initChecks(empleados));
      setObs('');
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: T.textDark, maxWidth: 960, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Acceso y Lavado de Manos
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, marginTop: 4, marginBottom: 0 }}>
          Registro diario de lavado de manos por empleado · {HORAS.join(' · ')}
        </p>
      </div>

      {/* ── Form ── */}
      <Card>
        <SectionTitle>Nuevo Registro</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
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

        {/* Check matrix */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary, marginBottom: 10 }}>
            Matriz de Lavados
          </div>

          {empLoading ? (
            <Skeleton height={120} />
          ) : checks.length === 0 ? (
            <p style={{ fontSize: '.83rem', color: T.textMid }}>Sin empleados activos.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.primary }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: T.white, fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', minWidth: 160 }}>
                      Empleado
                    </th>
                    {HORAS.map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'center', color: T.white, fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {checks.map((row, ei) => (
                    <tr key={row.empleadoId} style={{ background: ei % 2 === 0 ? T.white : '#F9FBF9' }}>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 500 }}>
                        {row.empleado}
                      </td>
                      {HORAS.map(h => {
                        const checked = row.horas[h];
                        return (
                          <td key={h} style={{ padding: '9px 14px', textAlign: 'center', borderBottom: '1px solid #F0F0F0' }}>
                            <button
                              onClick={() => toggleCell(ei, h)}
                              style={{
                                width: 34, height: 34, borderRadius: 6, border: 'none',
                                cursor: 'pointer', fontWeight: 700, fontSize: '.85rem',
                                background: checked ? T.accent : '#E0E0E0',
                                color: checked ? T.white : '#6B6B60',
                                transition: 'all .15s',
                              }}
                              title={checked ? 'Marcar como pendiente' : 'Marcar como cumplido'}
                            >
                              {checked ? '✓' : '·'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Lbl text="Observaciones">
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Novedades, ausencias, incidentes..."
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
            fontWeight: 700, fontSize: '.88rem',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Guardando...' : 'Guardar Registro AL'}
        </button>
      </Card>

      {/* ── History ── */}
      <Card>
        <SectionTitle>Historial ({(registros || []).length} registros)</SectionTitle>

        {histLoading ? (
          <Skeleton height={200} />
        ) : (registros || []).length === 0 ? (
          <p style={{ textAlign: 'center', padding: 32, color: T.textMid, fontSize: '.85rem' }}>Sin registros aún.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Responsable', 'Empleados OK', 'Total', '%', 'Resultado'].map(h => (
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
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', textAlign: 'center' }}>{r.totalOk ?? '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', textAlign: 'center' }}>{r.totalPosible ?? '—'}</td>
                    <td style={{
                      padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0',
                      fontWeight: 700, color: (r.pct || 0) >= 80 ? T.accent : T.danger,
                    }}>{r.pct ?? 0}%</td>
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
