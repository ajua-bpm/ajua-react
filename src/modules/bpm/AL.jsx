import { useState, useEffect } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', accent: '#43A047',
  white: '#FFFFFF', bgLight: '#F5F5F5',
  border: '#E0E0E0', textDark: '#1A1A18', textMid: '#6B6B60',
  danger: '#C62828', warn: '#E65100',
};

const HORAS = ['10:00', '12:00', '14:00', '16:00'];
const HORA_LABELS = { '10:00': '10:00 am', '12:00': '12:00 pm', '14:00': '14:00 pm', '16:00': '16:00 pm' };

const today  = () => new Date().toISOString().slice(0, 10);
const nowHM  = () => new Date().toTimeString().slice(0, 5);

const iStyle = {
  padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
  fontSize: '.88rem', outline: 'none', width: '100%', fontFamily: 'inherit',
  boxSizing: 'border-box', background: '#fff', color: T.textDark,
};
const Lbl = ({ text, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <span style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textMid }}>{text}</span>
    {children}
  </label>
);
const Card = ({ children, style = {} }) => (
  <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 24, marginBottom: 20, ...style }}>
    {children}
  </div>
);
const SecTitle = ({ children }) => (
  <div style={{ fontSize: '.85rem', fontWeight: 700, color: T.textDark, marginBottom: 18, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
    {children}
  </div>
);

const initChecks = (empleados) =>
  empleados.map(e => ({
    empleadoId: e.id,
    nombre: e.nombre,
    area: e.area || e.cargo || '',
    selected: false,
    horas: Object.fromEntries(HORAS.map(h => [h, false])),
    horasExtras: 0,
  }));

// ─── Main component ───────────────────────────────────────────────────────────
export default function AL() {
  const toast = useToast();
  const { empleados, loading: empLoading } = useEmpleados();
  const { data: registros, loading: histLoading } = useCollection('al', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { add, update, remove, saving } = useWrite('al');

  const [fecha,       setFecha]       = useState(today());
  const [turno,       setTurno]       = useState('COMPLETO');
  const [hi,          setHi]          = useState('07:00');
  const [hs,          setHs]          = useState('17:00');
  const [checks,      setChecks]      = useState([]);
  const [obs,         setObs]         = useState('');
  const [initialized, setInitialized] = useState(false);
  const [listOpen,    setListOpen]    = useState(true);

  // Horas Extras
  const [heDate,   setHeDate]   = useState(today());
  const [heEdits,  setHeEdits]  = useState({});
  const [heSaving, setHeSaving] = useState(false);

  useEffect(() => {
    if (!empLoading && empleados.length > 0 && !initialized) {
      const sorted = [...empleados].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
      setChecks(initChecks(sorted));
      setInitialized(true);
    }
  }, [empLoading, empleados, initialized]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ── Employee selection — auto-marca las 4 horas al seleccionar ───
  const toggleSelect = (id) =>
    setChecks(prev => prev.map(r => r.empleadoId !== id ? r : {
      ...r,
      selected: !r.selected,
      horas: Object.fromEntries(HORAS.map(h => [h, !r.selected])),
    }));

  const selectAll  = () => setChecks(prev => prev.map(r => ({ ...r, selected: true })));
  const selectNone = () => setChecks(prev => prev.map(r => ({ ...r, selected: false })));

  // ── Lavado cell toggle (only selected employees) ─────────────────
  const toggleCell = (id, h) =>
    setChecks(prev => prev.map(r =>
      r.empleadoId !== id ? r : { ...r, horas: { ...r.horas, [h]: !r.horas[h] } }
    ));

  const setHE = (id, val) =>
    setChecks(prev => prev.map(r =>
      r.empleadoId !== id ? r : { ...r, horasExtras: Math.max(0, parseFloat(val) || 0) }
    ));

  const selectedChecks  = checks.filter(r => r.selected);
  const numSelected     = selectedChecks.length;
  const horasVisible    = HORAS;
  const horasOn         = Object.fromEntries(HORAS.map(h => [h, true]));
  const totalPosible    = numSelected * horasVisible.length;
  const totalOk         = selectedChecks.reduce((s, r) => s + horasVisible.filter(h => r.horas[h]).length, 0);
  const pct             = totalPosible > 0 ? Math.round(totalOk / totalPosible * 100) : 0;
  const resultado       = pct >= 80 ? 'aprobado' : pct >= 60 ? 'aprobado_con_obs' : 'rechazado';


  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!fecha)          { toast('Ingresá la fecha', 'error'); return; }
    if (numSelected < 1) { toast('Seleccioná al menos un empleado', 'error'); return; }
    try {
      await add({
        fecha, turno, hi, hs,
        checks: selectedChecks.map(r => ({
          empleadoId: r.empleadoId,
          nombre: r.nombre,
          horas: Object.fromEntries(HORAS.map(h => [h, r.horas[h]])),
          horasExtras: r.horasExtras || 0,
        })),
        totalOk, totalPosible, pct, resultado, obs,
        creadoEn: new Date().toISOString(),
      });
      toast('✓ Turno AL guardado');
      setChecks(initChecks(empleados));
      setObs('');
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }
  };

  // ── Horas Extras ─────────────────────────────────────────────────
  const heRecord = (registros || []).find(r => r.fecha === heDate);

  useEffect(() => {
    if (heRecord) {
      const edits = {};
      heRecord.checks.forEach(c => { edits[c.empleadoId || c.nombre] = c.horasExtras || 0; });
      setHeEdits(edits);
    } else {
      setHeEdits({});
    }
  }, [heRecord?.id, heDate]); // eslint-disable-line

  const guardarHE = async () => {
    if (!heRecord) { toast('Sin registro AL para esa fecha', 'error'); return; }
    setHeSaving(true);
    try {
      const checksActualizados = heRecord.checks.map(c => ({
        ...c,
        horasExtras: parseFloat(heEdits[c.empleadoId || c.nombre] ?? 0) || 0,
      }));
      await update(heRecord.id, { checks: checksActualizados });
      toast('✓ Horas extras guardadas');
    } catch(e) { toast('Error: ' + e.message, 'error'); }
    setHeSaving(false);
  };

  const TD = { padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', whiteSpace: 'nowrap' };

  return (
    <div style={{ color: T.textDark, maxWidth: 1000, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>Control de Acceso y Lavado de Manos</h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, marginTop: 4, marginBottom: 0 }}>
          Registro diario por turno — horarios fijos de lavado: {HORAS.join(' · ')}
        </p>
      </div>

      {/* ── Turno config ── */}
      <Card>
        <SecTitle>Configurar Turno del Día</SecTitle>

        {/* Row 1: Fecha / Turno / Hora Ingreso / Hora Salida */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 18 }}>
          <Lbl text="Fecha">
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={iStyle} />
          </Lbl>
          <Lbl text="Turno">
            <select value={turno} onChange={e => setTurno(e.target.value)} style={{ ...iStyle, cursor: 'pointer' }}>
              <option value="AM">Turno AM</option>
              <option value="PM">Turno PM</option>
              <option value="COMPLETO">Turno Completo</option>
            </select>
          </Lbl>
          <Lbl text="Hora Ingreso (Turno)">
            <input type="time" value={hi} onChange={e => setHi(e.target.value)} style={iStyle} />
          </Lbl>
          <Lbl text="Hora Salida (Turno)">
            <input type="time" value={hs} onChange={e => setHs(e.target.value)} style={iStyle} />
          </Lbl>
        </div>

        {/* Employee selection header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: '.88rem', color: T.textDark }}>Empleados del Turno</span>
            <span style={{ padding: '2px 10px', background: numSelected > 0 ? '#E8F5E9' : T.bgLight, color: numSelected > 0 ? T.secondary : T.textMid, borderRadius: 100, fontSize: '.7rem', fontWeight: 700, border: `1px solid ${numSelected > 0 ? '#A5D6A7' : T.border}` }}>
              {numSelected} seleccionados
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={selectAll}
              style={{ padding: '5px 14px', border: `1.5px solid ${T.border}`, borderRadius: 4, background: '#fff', color: T.textMid, cursor: 'pointer', fontSize: '.78rem', fontFamily: 'inherit', fontWeight: 600 }}>
              ✓ Todos
            </button>
            <button onClick={selectNone}
              style={{ padding: '5px 14px', border: `1.5px solid ${T.border}`, borderRadius: 4, background: '#fff', color: T.textMid, cursor: 'pointer', fontSize: '.78rem', fontFamily: 'inherit', fontWeight: 600 }}>
              ✗ Ninguno
            </button>
          </div>
        </div>

        {/* Lista de Personal collapsible */}
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, overflow: 'hidden', marginBottom: 18 }}>
          <button onClick={() => setListOpen(o => !o)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: T.bgLight, border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontWeight: 700, fontSize: '.8rem', color: T.textDark,
          }}>
            <span>👥 Lista de Personal</span>
            <span style={{ fontSize: '.75rem' }}>{listOpen ? '▲' : '▼'}</span>
          </button>

          {listOpen && (
            empLoading ? <div style={{ padding: 20 }}><Skeleton rows={5} /></div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F0F4F0' }}>
                    <th style={{ width: 44, padding: '8px 14px', textAlign: 'center', borderBottom: `1px solid ${T.border}` }}>
                      <input type="checkbox"
                        checked={checks.length > 0 && checks.every(r => r.selected)}
                        onChange={e => e.target.checked ? selectAll() : selectNone()}
                        style={{ accentColor: T.secondary, width: 14, height: 14 }} />
                    </th>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMid, borderBottom: `1px solid ${T.border}` }}>Empleado</th>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMid, borderBottom: `1px solid ${T.border}`, width: 160 }}>Área</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((row, i) => (
                    <tr key={row.empleadoId} style={{ background: row.selected ? '#F1F8E9' : (i % 2 === 0 ? '#fff' : '#FAFAFA') }}>
                      <td style={{ padding: '9px 14px', textAlign: 'center', borderBottom: '1px solid #F0F0F0' }}>
                        <input type="checkbox" checked={row.selected}
                          onChange={() => toggleSelect(row.empleadoId)}
                          style={{ accentColor: T.secondary, width: 15, height: 15, cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: '.85rem', fontWeight: 600, color: T.textDark, borderBottom: '1px solid #F0F0F0', textTransform: 'uppercase', letterSpacing: '.02em' }}>
                        {row.nombre}
                      </td>
                      <td style={{ padding: '9px 14px', borderBottom: '1px solid #F0F0F0' }}>
                        {row.area ? (
                          <span style={{ padding: '3px 10px', background: '#E8F5E9', color: T.secondary, borderRadius: 100, fontSize: '.7rem', fontWeight: 600 }}>
                            {row.area}
                          </span>
                        ) : (
                          <span style={{ padding: '3px 10px', background: '#EEEEEE', color: T.textMid, borderRadius: 100, fontSize: '.7rem' }}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* Lavado matrix — only selected employees */}
        {numSelected > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary, marginBottom: 10 }}>
              Registro de Lavado de Manos — {numSelected} empleado{numSelected !== 1 ? 's' : ''} seleccionado{numSelected !== 1 ? 's' : ''}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.primary }}>
                    <th style={{ padding: '9px 14px', textAlign: 'left', color: '#fff', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', minWidth: 170 }}>Empleado</th>
                    {HORAS.map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'center', color: horasOn[h] ? '#fff' : 'rgba(255,255,255,.35)', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        {HORA_LABELS[h]}
                      </th>
                    ))}
                    <th style={{ padding: '9px 14px', textAlign: 'center', color: '#fff', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', background: '#E65100' }}>HE hrs</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedChecks.map((row, ei) => (
                    <tr key={row.empleadoId} style={{ background: ei % 2 === 0 ? '#fff' : '#F9FBF9' }}>
                      <td style={{ padding: '9px 14px', fontSize: '.85rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600, textTransform: 'uppercase' }}>{row.nombre}</td>
                      {HORAS.map(h => {
                        const checked  = row.horas[h];
                        const disabled = !horasOn[h];
                        return (
                          <td key={h} style={{ padding: '9px 14px', textAlign: 'center', borderBottom: '1px solid #F0F0F0', opacity: disabled ? 0.3 : 1 }}>
                            <button onClick={() => !disabled && toggleCell(row.empleadoId, h)} disabled={disabled}
                              style={{ width: 34, height: 34, borderRadius: 6, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '.85rem', background: checked ? T.accent : '#E0E0E0', color: checked ? '#fff' : T.textMid, transition: 'all .15s' }}>
                              {checked ? '✓' : '·'}
                            </button>
                          </td>
                        );
                      })}
                      <td style={{ padding: '9px 10px', textAlign: 'center', borderBottom: '1px solid #F0F0F0' }}>
                        <input type="number" min="0" max="12" step="0.5"
                          value={row.horasExtras || ''}
                          onChange={e => setHE(row.empleadoId, e.target.value)}
                          placeholder="0"
                          style={{ width: 52, padding: '5px 6px', border: '1.5px solid #FFCC80', borderRadius: 5,
                            fontSize: '.82rem', textAlign: 'center', background: '#FFF3E0', fontFamily: 'inherit' }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Score */}
        {totalPosible > 0 && (
          <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, border: `2px solid ${resultado === 'aprobado' ? T.accent : resultado === 'aprobado_con_obs' ? T.warn : T.danger}`, background: resultado === 'aprobado' ? '#E8F5E9' : resultado === 'aprobado_con_obs' ? '#FFF3E0' : '#FFEBEE', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: resultado === 'aprobado' ? T.accent : resultado === 'aprobado_con_obs' ? T.warn : T.danger }}>{pct}%</div>
            <div>
              <div style={{ fontSize: '.82rem', fontWeight: 700, color: resultado === 'aprobado' ? T.secondary : resultado === 'aprobado_con_obs' ? T.warn : T.danger }}>
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
          style={{ marginTop: 16, padding: '11px 28px', minHeight: 44, background: saving ? '#BDBDBD' : T.primary, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', width: isMobile ? '100%' : 'auto' }}>
          {saving ? 'Guardando...' : '💾 Guardar Turno'}
        </button>
      </Card>

      {/* ── Horas Extras ── */}
      <Card style={{ background: 'rgba(230,81,0,.03)', border: '1.5px solid rgba(230,81,0,.2)' }}>
        <SecTitle>⏰ Agregar Horas Extras</SecTitle>
        <p style={{ fontSize: '.78rem', color: T.textMid, marginBottom: 14, lineHeight: 1.6 }}>
          Seleccioná la fecha del turno ya guardado para agregar o editar las horas extras de cada empleado.
        </p>
        <div style={{ marginBottom: 14 }}>
          <Lbl text="Fecha del turno">
            <input type="date" value={heDate} onChange={e => setHeDate(e.target.value)} style={{ ...iStyle, width: 180 }} />
          </Lbl>
        </div>
        {heDate && !heRecord && (
          <div style={{ padding: '10px 14px', background: '#F5F5F5', borderRadius: 6, fontSize: '.82rem', color: T.textMid }}>
            Sin registro AL guardado para el {heDate}.
          </div>
        )}
        {heRecord && (
          <>
            <div style={{ overflowX: 'auto', marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.warn }}>
                    <th style={{ padding: '9px 14px', textAlign: 'left', color: '#fff', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Empleado</th>
                    <th style={{ padding: '9px 14px', textAlign: 'left', color: '#fff', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Horas Extras</th>
                  </tr>
                </thead>
                <tbody>
                  {heRecord.checks.map((c, i) => {
                    const key = c.empleadoId || c.nombre;
                    return (
                      <tr key={key} style={{ background: i % 2 === 0 ? '#fff' : '#FFF8F5' }}>
                        <td style={{ padding: '9px 14px', fontWeight: 600, fontSize: '.85rem' }}>{c.nombre}</td>
                        <td style={{ padding: '9px 14px' }}>
                          <input type="number" min="0" max="12" step="0.5"
                            value={heEdits[key] ?? 0}
                            onChange={e => setHeEdits(prev => ({ ...prev, [key]: e.target.value }))}
                            style={{ width: 80, padding: '6px 8px', border: '1.5px solid #FFCC80', borderRadius: 5,
                              fontSize: '.85rem', textAlign: 'center', background: '#FFF3E0', fontFamily: 'inherit' }} />
                          <span style={{ marginLeft: 6, fontSize: '.78rem', color: T.textMid }}>hrs</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button onClick={guardarHE} disabled={heSaving}
              style={{ padding: '10px 22px', background: heSaving ? '#BDBDBD' : T.warn, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem', cursor: heSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {heSaving ? 'Guardando…' : '💾 Guardar Horas Extras'}
            </button>
          </>
        )}
      </Card>


      {/* ── Historial ── */}
      <Card>
        <SecTitle>Historial de Turnos ({histLoading ? '…' : (registros || []).length} registros)</SecTitle>
        {histLoading ? <Skeleton rows={6} /> : (registros || []).length === 0 ? (
          <p style={{ textAlign: 'center', padding: 32, color: T.textMid, fontSize: '.85rem' }}>Sin registros aún.</p>
        ) : isMobile ? (
          <div>
            {(registros || []).slice(0, 100).map(r => {
              const totalEmp   = (r.checks || []).length;
              const totalCompl = (r.checks || []).filter(row => row.horas && Object.values(row.horas).every(v => v)).length;
              const pctComp    = totalEmp > 0 ? Math.round(totalCompl / totalEmp * 100) : 0;
              const compColor  = pctComp >= 100 ? T.accent : pctComp >= 75 ? T.warn : T.danger;
              const compBg     = pctComp >= 100 ? '#E8F5E9' : pctComp >= 75 ? '#FFF3E0' : '#FFEBEE';
              return (
                <div key={r.id} style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 2px rgba(0,0,0,.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: T.textDark }}>{r.fecha || '—'}</span>
                      <span style={{ padding: '2px 9px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: r.turno === 'AM' ? '#E3F2FD' : r.turno === 'PM' ? '#EDE7F6' : '#E8F5E9', color: r.turno === 'AM' ? '#1565C0' : r.turno === 'PM' ? '#4527A0' : T.secondary }}>
                        {r.turno || '—'}
                      </span>
                    </div>
                    <button onClick={() => { if (window.confirm('¿Eliminar este registro?')) remove(r.id); }}
                      style={{ padding: '3px 10px', borderRadius: 5, border: `1.5px solid ${T.danger}`, background: '#fff', color: T.danger, cursor: 'pointer', fontSize: '.75rem', fontWeight: 700, fontFamily: 'inherit' }}>
                      ✕
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: T.textMid }}>{r.hi || r.hora || '—'} – {r.hs || '—'}</span>
                    <span style={{ padding: '2px 9px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: '#E8F5E9', color: T.secondary }}>
                      {totalEmp} personas
                    </span>
                    <span style={{ padding: '2px 9px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: compBg, color: compColor }}>
                      {totalCompl}/{totalEmp} · {pctComp}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Turno', 'H. Ingreso', 'H. Salida', 'Empleados', 'Lavados', ''].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#fff', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(registros || []).slice(0, 100).map((r, i) => {
                  const totalEmp      = (r.checks || []).length;
                  const totalCompl    = (r.checks || []).filter(row => row.horas && Object.values(row.horas).every(v => v)).length;
                  const pctComp       = totalEmp > 0 ? Math.round(totalCompl / totalEmp * 100) : 0;
                  const compColor     = pctComp >= 100 ? T.accent : pctComp >= 75 ? T.warn : T.danger;
                  const compBg        = pctComp >= 100 ? '#E8F5E9' : pctComp >= 75 ? '#FFF3E0' : '#FFEBEE';
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FBF9' }}>
                      <td style={{ ...TD, fontWeight: 600 }}>{r.fecha || '—'}</td>
                      <td style={TD}>
                        <span style={{ padding: '2px 9px', borderRadius: 100, fontSize: '.7rem', fontWeight: 700, background: r.turno === 'AM' ? '#E3F2FD' : r.turno === 'PM' ? '#EDE7F6' : '#E8F5E9', color: r.turno === 'AM' ? '#1565C0' : r.turno === 'PM' ? '#4527A0' : T.secondary }}>
                          {r.turno || '—'}
                        </span>
                      </td>
                      <td style={TD}>{r.hi || r.hora || '—'}</td>
                      <td style={TD}>{r.hs || '—'}</td>
                      <td style={TD}>
                        <span style={{ padding: '2px 9px', borderRadius: 100, fontSize: '.7rem', fontWeight: 700, background: '#E8F5E9', color: T.secondary }}>
                          {totalEmp} personas
                        </span>
                      </td>
                      <td style={TD}>
                        <span style={{ padding: '2px 9px', borderRadius: 100, fontSize: '.7rem', fontWeight: 700, background: compBg, color: compColor }}>
                          {totalCompl}/{totalEmp} · {pctComp}%
                        </span>
                      </td>
                      <td style={TD}>
                        <button onClick={() => { if (window.confirm('¿Eliminar este registro?')) remove(r.id); }}
                          style={{ padding: '3px 10px', borderRadius: 5, border: `1.5px solid ${T.danger}`, background: '#fff', color: T.danger, cursor: 'pointer', fontSize: '.75rem', fontWeight: 700, fontFamily: 'inherit' }}>
                          ✕
                        </button>
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
