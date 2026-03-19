import { useState, useEffect } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', accent: '#43A047',
  white: '#FFFFFF', bgLight: '#F5F5F5', bgCard: '#FFFFFF',
  border: '#E0E0E0', textDark: '#1A1A18', textMid: '#6B6B60',
  danger: '#C62828', warn: '#E65100',
};

// ─── Fixed hours from bpm.html ────────────────────────────────────────────────
const HORAS = ['10:00', '12:00', '14:00', '16:00'];

const today = () => new Date().toISOString().slice(0, 10);
const nowHM = () => { const d = new Date(); return d.toTimeString().slice(0, 5); };

const initChecks = empleados =>
  empleados.map(e => ({
    empleadoId: e.id,
    nombre: e.nombre,
    horas: Object.fromEntries(HORAS.map(h => [h, false])),
  }));

// ─── Shared UI ────────────────────────────────────────────────────────────────
const iStyle = {
  padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
  fontSize: '.88rem', outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box',
};

const Lbl = ({ text, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <span style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary }}>{text}</span>
    {children}
  </label>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 24, marginBottom: 20, ...style }}>
    {children}
  </div>
);

const SecTitle = ({ children }) => (
  <div style={{ fontSize: '.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.secondary, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
    {children}
  </div>
);

const ResultadoBadge = ({ resultado }) => {
  const M = {
    aprobado:         { bg: '#E8F5E9', c: '#2E7D32', l: '✓ Aprobado' },
    aprobado_con_obs: { bg: '#FFF3E0', c: '#E65100', l: '⚠ Aprobado con obs.' },
    rechazado:        { bg: '#FFEBEE', c: '#C62828', l: '✗ Rechazado' },
    cumple:           { bg: '#E8F5E9', c: '#2E7D32', l: '✓ Cumple' },
    no_cumple:        { bg: '#FFEBEE', c: '#C62828', l: '✗ No cumple' },
  };
  const m = M[resultado] || { bg: '#F5F5F5', c: T.textMid, l: resultado || '—' };
  return <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600, background: m.bg, color: m.c }}>{m.l}</span>;
};

const TD = { padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', whiteSpace: 'nowrap' };

// ─── Main component ───────────────────────────────────────────────────────────
export default function AL() {
  const toast = useToast();
  const { empleados, loading: empLoading } = useEmpleados();
  const { data: registros, loading: histLoading } = useCollection('al', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { add, saving } = useWrite('al');

  const [fecha,        setFecha]        = useState(today());
  const [hora,         setHora]         = useState(nowHM());
  const [turno,        setTurno]        = useState('AM');
  const [responsable,  setResponsable]  = useState('');
  const [horasOn,      setHorasOn]      = useState(Object.fromEntries(HORAS.map(h => [h, true])));
  const [checks,       setChecks]       = useState([]);
  const [obs,          setObs]          = useState('');
  const [initialized,  setInitialized]  = useState(false);

  // Nómina state
  const [nomDesde, setNomDesde] = useState('');
  const [nomHasta, setNomHasta] = useState('');
  const [nomResult, setNomResult] = useState(null);

  // Initialize matrix once empleados load
  useEffect(() => {
    if (!empLoading && empleados.length > 0 && !initialized) {
      setChecks(initChecks(empleados));
      setInitialized(true);
    }
  }, [empLoading, empleados, initialized]);

  const toggleCell = (ei, h) =>
    setChecks(prev => prev.map((row, i) =>
      i !== ei ? row : { ...row, horas: { ...row.horas, [h]: !row.horas[h] } }
    ));

  const horasVisible = HORAS.filter(h => horasOn[h]);
  const totalPosible = checks.length * horasVisible.length;
  const totalOk = checks.reduce((s, row) => s + horasVisible.filter(h => row.horas[h]).length, 0);
  const pct = totalPosible > 0 ? Math.round(totalOk / totalPosible * 100) : 0;
  const resultado = pct >= 80 ? 'aprobado' : pct >= 60 ? 'aprobado_con_obs' : 'rechazado';

  const handleSave = async () => {
    if (!fecha)       { toast('Ingresá la fecha', 'error'); return; }
    if (!responsable) { toast('Seleccioná el responsable', 'error'); return; }
    if (checks.length === 0) { toast('No hay empleados en la matriz', 'error'); return; }
    try {
      await add({
        fecha, hora, turno, responsable,
        checks: checks.map(row => ({
          empleadoId: row.empleadoId,
          nombre: row.nombre,
          horas: Object.fromEntries(HORAS.map(h => [h, row.horas[h]])),
        })),
        totalOk, totalPosible, pct, resultado, obs,
        creadoEn: new Date().toISOString(),
      });
      toast('✓ Turno AL guardado');
      setChecks(initChecks(empleados));
      setObs('');
      setHora(nowHM());
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  // Nómina calculation
  const calcularNomina = () => {
    if (!nomDesde || !nomHasta) { toast('Ingresá el rango de fechas', 'error'); return; }
    const filtrados = (registros || []).filter(r => r.fecha >= nomDesde && r.fecha <= nomHasta);
    const diasPorEmp = {};
    filtrados.forEach(r => {
      (r.checks || []).forEach(row => {
        const tiene = HORAS.some(h => row.horas && row.horas[h]);
        if (tiene) {
          const key = row.empleadoId || row.nombre;
          if (!diasPorEmp[key]) diasPorEmp[key] = { nombre: row.nombre, dias: new Set() };
          diasPorEmp[key].dias.add(r.fecha);
        }
      });
    });
    const tabla = Object.values(diasPorEmp).map(entry => {
      const emp = empleados.find(e => e.nombre === entry.nombre);
      const sd = emp?.salarioDia || (emp?.salario ? emp.salario / 30 : 0);
      const dias = entry.dias.size;
      return { nombre: entry.nombre, dias, salarioDia: sd, total: dias * sd };
    });
    setNomResult(tabla);
  };

  return (
    <div style={{ color: T.textDark, maxWidth: 1000, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>Control de Acceso y Lavado de Manos</h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, marginTop: 4, marginBottom: 0 }}>
          Registro diario por turno — horarios fijos de lavado: {HORAS.join(' · ')}
        </p>
      </div>

      {/* ── Form ── */}
      <Card>
        <SecTitle>Configurar Turno del Día</SecTitle>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 14 }}>
          <Lbl text="Fecha">
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={iStyle} />
          </Lbl>
          <Lbl text="Turno">
            <select value={turno} onChange={e => setTurno(e.target.value)} style={{ ...iStyle, background: '#fff', cursor: 'pointer' }}>
              <option value="AM">Turno AM</option>
              <option value="PM">Turno PM</option>
              <option value="COMPLETO">Turno Completo</option>
            </select>
          </Lbl>
          <Lbl text="Responsable">
            {empLoading ? <Skeleton height={38} /> : (
              <select value={responsable} onChange={e => setResponsable(e.target.value)} style={{ ...iStyle, background: '#fff', cursor: 'pointer' }}>
                <option value="">— Seleccionar responsable —</option>
                {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}{e.cargo ? ' · ' + e.cargo : ''}</option>)}
              </select>
            )}
          </Lbl>
        </div>

        {/* Fixed hours toggles */}
        <div style={{ background: T.bgLight, border: `1px solid ${T.border}`, borderRadius: 6, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: '.6rem', color: T.textMid, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            Horarios Fijos de Lavado de Manos
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            {HORAS.map(h => (
              <label key={h} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={horasOn[h]} onChange={() => setHorasOn(prev => ({ ...prev, [h]: !prev[h] }))}
                  style={{ accentColor: T.secondary, width: 14, height: 14 }} />
                {h}
              </label>
            ))}
            <span style={{ fontSize: '.66rem', color: T.textMid, marginLeft: 8 }}>Desmarca los que no apliquen al turno</span>
          </div>
        </div>

        {/* Employee matrix */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: '.82rem' }}>Empleados del Turno</span>
              <span style={{ marginLeft: 8, padding: '2px 8px', background: '#E8F5E9', color: T.secondary, borderRadius: 100, fontSize: '.65rem', fontWeight: 700 }}>
                {checks.length} empleados
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setChecks(prev => prev.map(row => ({ ...row, horas: Object.fromEntries(HORAS.map(h => [h, horasOn[h]])) })))}
                style={{ padding: '5px 12px', border: `1.5px solid ${T.border}`, borderRadius: 4, background: '#fff', color: T.textMid, cursor: 'pointer', fontSize: '.75rem', fontFamily: 'inherit' }}>
                ✓ Todos
              </button>
              <button onClick={() => setChecks(prev => prev.map(row => ({ ...row, horas: Object.fromEntries(HORAS.map(h => [h, false])) })))}
                style={{ padding: '5px 12px', border: `1.5px solid ${T.border}`, borderRadius: 4, background: '#fff', color: T.textMid, cursor: 'pointer', fontSize: '.75rem', fontFamily: 'inherit' }}>
                ✗ Ninguno
              </button>
            </div>
          </div>

          {empLoading ? <Skeleton height={120} /> : checks.length === 0 ? (
            <p style={{ fontSize: '.83rem', color: T.textMid, padding: 20, textAlign: 'center' }}>Sin empleados activos.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.primary }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', minWidth: 160 }}>Empleado</th>
                    {HORAS.map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'center', color: horasOn[h] ? '#fff' : 'rgba(255,255,255,.4)', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {checks.map((row, ei) => (
                    <tr key={row.empleadoId} style={{ background: ei % 2 === 0 ? '#fff' : '#F9FBF9' }}>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 500 }}>{row.nombre}</td>
                      {HORAS.map(h => {
                        const checked  = row.horas[h];
                        const disabled = !horasOn[h];
                        return (
                          <td key={h} style={{ padding: '9px 14px', textAlign: 'center', borderBottom: '1px solid #F0F0F0', opacity: disabled ? 0.35 : 1 }}>
                            <button onClick={() => !disabled && toggleCell(ei, h)} disabled={disabled}
                              style={{ width: 34, height: 34, borderRadius: 6, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '.85rem', background: checked ? T.accent : '#E0E0E0', color: checked ? '#fff' : T.textMid, transition: 'all .15s' }}>
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

        {/* Score */}
        {totalPosible > 0 && (
          <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 14, border: `2px solid ${resultado === 'aprobado' ? T.accent : resultado === 'aprobado_con_obs' ? T.warn : T.danger}`, background: resultado === 'aprobado' ? '#E8F5E9' : resultado === 'aprobado_con_obs' ? '#FFF3E0' : '#FFEBEE', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: resultado === 'aprobado' ? T.accent : resultado === 'aprobado_con_obs' ? T.warn : T.danger }}>{pct}%</div>
            </div>
            <div>
              <div style={{ fontSize: '.82rem', fontWeight: 600, color: resultado === 'aprobado' ? T.secondary : resultado === 'aprobado_con_obs' ? T.warn : T.danger }}>
                {resultado === 'aprobado' ? '✓ APROBADO' : resultado === 'aprobado_con_obs' ? '⚠ APROBADO CON OBSERVACIONES' : '✗ RECHAZADO'}
              </div>
              <div style={{ fontSize: '.75rem', color: T.textMid, marginTop: 2 }}>{totalOk} / {totalPosible} lavados registrados</div>
            </div>
          </div>
        )}

        <Lbl text="Observaciones">
          <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Novedades, ausencias, incidentes..." rows={2}
            style={{ ...iStyle, resize: 'vertical' }} />
        </Lbl>

        <button onClick={handleSave} disabled={saving}
          style={{ marginTop: 16, padding: '11px 28px', background: saving ? '#BDBDBD' : T.primary, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Guardando...' : '💾 Guardar Turno'}
        </button>
      </Card>

      {/* ── Nómina desde asistencia ── */}
      <Card style={{ background: 'rgba(0,168,107,.04)', border: '1.5px solid rgba(0,168,107,.2)' }}>
        <SecTitle>Calcular Nómina desde Asistencia</SecTitle>
        <p style={{ fontSize: '.78rem', color: T.textMid, marginBottom: 14, lineHeight: 1.6 }}>
          Cuenta automáticamente los días que cada empleado apareció en el registro de acceso y calcula el pago total del período.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Lbl text="Desde">
            <input type="date" value={nomDesde} onChange={e => setNomDesde(e.target.value)} style={iStyle} />
          </Lbl>
          <Lbl text="Hasta">
            <input type="date" value={nomHasta} onChange={e => setNomHasta(e.target.value)} style={iStyle} />
          </Lbl>
        </div>
        <button onClick={calcularNomina}
          style={{ padding: '10px 22px', background: T.primary, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem', cursor: 'pointer', fontFamily: 'inherit' }}>
          👷 Ver Nómina del Período
        </button>

        {nomResult && (
          <div style={{ marginTop: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Empleado', 'Días', 'Salario/Día', 'Total'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nomResult.map((row, i) => (
                  <tr key={row.nombre} style={{ background: i % 2 === 0 ? '#fff' : '#F9FBF9' }}>
                    <td style={TD}>{row.nombre}</td>
                    <td style={{ ...TD, textAlign: 'center', fontWeight: 700, color: T.accent }}>{row.dias}</td>
                    <td style={TD}>{row.salarioDia > 0 ? `Q${Number(row.salarioDia).toFixed(2)}` : '—'}</td>
                    <td style={{ ...TD, fontWeight: 700, color: T.primary }}>{row.salarioDia > 0 ? `Q${Number(row.total).toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
                {nomResult.length > 0 && (
                  <tr style={{ background: '#E8F5E9' }}>
                    <td colSpan={3} style={{ padding: '10px 14px', fontSize: '.83rem', fontWeight: 700, textAlign: 'right', color: T.primary }}>Total del período:</td>
                    <td style={{ padding: '10px 14px', fontSize: '.9rem', fontWeight: 800, color: T.primary }}>Q{nomResult.reduce((s, r) => s + r.total, 0).toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── History ── */}
      <Card>
        <SecTitle>Historial de Turnos ({histLoading ? '…' : (registros || []).length} registros)</SecTitle>
        {histLoading ? <Skeleton height={160} /> : (registros || []).length === 0 ? (
          <p style={{ textAlign: 'center', padding: 32, color: T.textMid, fontSize: '.85rem' }}>Sin registros aún.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Turno', 'Responsable', 'Empleados', 'Lavados OK', 'Total', '%', 'Resultado'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(registros || []).slice(0, 100).map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FBF9' }}>
                    <td style={{ ...TD, fontWeight: 600 }}>{r.fecha || '—'}</td>
                    <td style={TD}>{r.turno || '—'}</td>
                    <td style={TD}>{r.responsable || '—'}</td>
                    <td style={{ ...TD, textAlign: 'center' }}>{(r.checks || []).length}</td>
                    <td style={{ ...TD, textAlign: 'center', color: T.accent, fontWeight: 600 }}>{r.totalOk ?? '—'}</td>
                    <td style={{ ...TD, textAlign: 'center' }}>{r.totalPosible ?? '—'}</td>
                    <td style={{ ...TD, fontWeight: 700, color: (r.pct || 0) >= 80 ? T.accent : (r.pct || 0) >= 60 ? T.warn : T.danger }}>
                      {r.pct != null ? `${r.pct}%` : '—'}
                    </td>
                    <td style={TD}><ResultadoBadge resultado={r.resultado} /></td>
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
