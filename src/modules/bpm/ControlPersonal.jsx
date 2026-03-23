import { useState, useMemo } from 'react';
import { useEmpleados } from '../../hooks/useMainData';
import { useCollection, useWrite } from '../../hooks/useFirestore';

// Merge empleados from collection + main doc, filter active women, sort alpha
function useMujeres() {
  const { data: empCol, loading: lCol } = useCollection('empleados', { orderField: 'nombre', limit: 200 });
  const { empleados: empMain, loading: lMain } = useEmpleados();
  const mujeres = useMemo(() => {
    const seen = new Set();
    const list = [];
    [...(empCol || []), ...(empMain || [])].forEach(e => {
      const key = (e.nombre || '').toLowerCase().trim();
      if (!seen.has(key) && e.nombre && e.activo !== false) {
        seen.add(key); list.push(e);
      }
    });
    return list
      .filter(e => (e.sexo || '').toUpperCase() === 'F')
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }, [empCol, empMain]);
  return { mujeres, loading: lCol || lMain };
}
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
  green2:    '#E8F5E9',
};

const CHECKS = [
  { id: 'aretes',    label: 'Sin aretes / joyas' },
  { id: 'anillos',   label: 'Sin anillos / pulseras' },
  { id: 'perfume',   label: 'Sin perfume / loción' },
  { id: 'unas',      label: 'Uñas cortas y sin pintura' },
  { id: 'postizas',  label: 'Sin uñas postizas' },
  { id: 'maquillaje',label: 'Sin maquillaje' },
  { id: 'cabello',   label: 'Cabello recogido y cubierto' },
];

const today = () => new Date().toISOString().slice(0, 10);

const blankChecks = () => Object.fromEntries(CHECKS.map(c => [c.id, null]));

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

function CumpleBtn({ value, onSet }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[true, false].map(v => (
        <button key={String(v)} onClick={() => onSet(value === v ? null : v)}
          style={{
            padding: '4px 11px', borderRadius: 5, border: '1.5px solid',
            cursor: 'pointer', fontWeight: 700, fontSize: '.72rem', fontFamily: 'inherit',
            background: value === v ? (v ? T.secondary : T.danger) : T.white,
            borderColor: value === v ? (v ? T.secondary : T.danger) : T.border,
            color: value === v ? T.white : T.textMid,
          }}>
          {v ? 'CUMPLE' : 'NO CUMPLE'}
        </button>
      ))}
    </div>
  );
}

function resultBadge(aprobado) {
  return aprobado
    ? { label: '✅ APROBADO', bg: T.green2, color: T.secondary }
    : { label: '❌ RECHAZADO', bg: '#FFEBEE', color: T.danger };
}

// ── Main ──────────────────────────────────────────────────────────
export default function ControlPersonal() {
  const toast = useToast();
  const { mujeres: empleados, loading: empLoading } = useMujeres();
  const { data: historial, loading: histLoading } = useCollection('controlPersonal', {
    orderField: 'fecha', orderDir: 'desc', limit: 200,
  });
  const { add, remove, saving } = useWrite('controlPersonal');

  const [fecha, setFecha]     = useState(today());
  const [turno, setTurno]     = useState('AM');
  const [resp, setResp]       = useState('');
  const [accion, setAccion]   = useState('');

  // empRows: array of { empleadoId, nombre, area, checks: {id: bool|null}, obs }
  const [empRows, setEmpRows] = useState([]);
  const [listOpen, setListOpen] = useState(true);

  // Build rows from empleados list
  const initRows = () => {
    if (empLoading || empleados.length === 0) return;
    setEmpRows(empleados.map(e => ({
      id: e.id || e.nombre,
      nombre: e.nombre,
      area: e.area || e.cargo || '',
      checks: blankChecks(),
      obs: '',
    })));
  };

  // Lazy init when empleados load
  useState(() => { /* handled below via useMemo */ });

  const rows = useMemo(() => {
    if (empRows.length === 0 && !empLoading && empleados.length > 0) {
      return empleados.map(e => ({
        id: e.id || e.nombre,
        nombre: e.nombre,
        area: e.area || e.cargo || '',
        checks: blankChecks(),
        obs: '',
      }));
    }
    return empRows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleados, empLoading, empRows]);

  const setRow = (idx, patch) =>
    setEmpRows(prev => {
      const base = prev.length ? prev : rows;
      return base.map((r, i) => i === idx ? { ...r, ...patch } : r);
    });

  const setCheck = (idx, checkId, val) =>
    setRow(idx, { checks: { ...rows[idx].checks, [checkId]: val } });

  // Per-employee computed result
  const rowResult = (row) => {
    const vals = Object.values(row.checks);
    if (vals.some(v => v === null)) return null; // incomplete
    return vals.every(v => v === true);
  };

  const aprobados = rows.filter(r => rowResult(r) === true).length;
  const rechazados = rows.filter(r => rowResult(r) === false).length;
  const total = rows.length;
  const turnoOK = total > 0 && rechazados === 0 && aprobados === total;

  const handleSave = async () => {
    if (!fecha || !resp) { toast('Complete fecha y responsable', 'error'); return; }
    if (rows.length === 0) { toast('No hay empleados cargados', 'error'); return; }
    try {
      const empleadosData = rows.map(r => ({
        nombre: r.nombre,
        area: r.area,
        checks: r.checks,
        obs: r.obs,
        aprobado: rowResult(r),
      }));
      await add({
        fecha, turno, resp, accion,
        empleados: empleadosData,
        total, aprobados, rechazados,
        resultado: turnoOK ? 'APROBADO' : 'RECHAZADO',
      });
      toast('Control de personal guardado');
      setEmpRows([]);
      setAccion('');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Control de Personal — Higiene
        </h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>
          Verificación diaria de presentación personal · Aretes, anillos, uñas, cabello
        </p>
      </div>

      {/* Form card */}
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 22, marginBottom: 20 }}>
        {/* Top row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 18 }}>
          <Lbl text="Fecha">
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
          </Lbl>
          <Lbl text="Turno">
            <select value={turno} onChange={e => setTurno(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </Lbl>
          <Lbl text="Responsable BPM">
            {empLoading ? <Skeleton height={36} /> : (
              <select value={resp} onChange={e => setResp(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
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

        {/* Score banner */}
        {rows.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ padding: '7px 16px', borderRadius: 20, background: turnoOK ? T.green2 : '#FFEBEE',
              color: turnoOK ? T.secondary : T.danger, fontWeight: 800, fontSize: '.82rem' }}>
              {turnoOK ? '✅ TURNO APROBADO' : rechazados > 0 ? '❌ TURNO RECHAZADO' : '⏳ Incompleto'}
            </div>
            <span style={{ fontSize: '.8rem', color: T.textMid }}>
              <strong style={{ color: T.secondary }}>{aprobados}</strong> / {total} aprobados
              {rechazados > 0 && <> · <strong style={{ color: T.danger }}>{rechazados} rechazados</strong></>}
            </span>
          </div>
        )}

        {/* Lista de Personal — collapsible */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setListOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, fontFamily: 'inherit', marginBottom: 10 }}>
            <span style={{ fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.07em', color: T.secondary }}>
              👥 Lista de Personal ({rows.length})
            </span>
            <span style={{ fontSize: '.7rem', color: T.textMid }}>{listOpen ? '▲ ocultar' : '▼ mostrar'}</span>
          </button>

          {listOpen && (
            empLoading ? <Skeleton rows={4} /> :
            rows.length === 0 ? (
              <div style={{ padding: '16px', background: T.bgLight, borderRadius: 6, fontSize: '.82rem', color: T.textMid }}>
                No hay empleados activos.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                  <thead>
                    <tr style={{ background: T.primary }}>
                      {['Empleado', 'Área', ...CHECKS.map(c => c.label), 'Observación', 'Resultado'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', color: T.white, fontWeight: 700, fontSize: '.65rem',
                          textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'left', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const res = rowResult(row);
                      const badge = res === null ? null : resultBadge(res);
                      const hasNoCumple = Object.values(row.checks).some(v => v === false);
                      return (
                        <tr key={row.id} style={{ background: idx % 2 === 0 ? '#fff' : '#F9FBF9',
                          borderBottom: '1px solid #F0F0F0' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: T.textDark, whiteSpace: 'nowrap' }}>
                            {row.nombre}
                          </td>
                          <td style={{ padding: '8px 10px', color: T.textMid, fontSize: '.78rem', whiteSpace: 'nowrap' }}>
                            {row.area || '—'}
                          </td>
                          {CHECKS.map(c => (
                            <td key={c.id} style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <CumpleBtn
                                value={row.checks[c.id]}
                                onSet={v => setCheck(idx, c.id, v)}
                              />
                            </td>
                          ))}
                          <td style={{ padding: '6px 10px', minWidth: 140 }}>
                            {hasNoCumple && (
                              <input
                                type="text"
                                value={row.obs}
                                onChange={e => setRow(idx, { obs: e.target.value })}
                                placeholder="Observación..."
                                style={{ ...inputStyle, fontSize: '.75rem', padding: '5px 8px' }}
                              />
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                            {badge ? (
                              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '.68rem',
                                fontWeight: 700, background: badge.bg, color: badge.color }}>
                                {badge.label}
                              </span>
                            ) : (
                              <span style={{ color: T.border, fontSize: '.72rem' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* Acción tomada si hay rechazados */}
        {rechazados > 0 && (
          <div style={{ marginBottom: 14 }}>
            <Lbl text="Acción tomada (rechazados)">
              <textarea
                value={accion}
                onChange={e => setAccion(e.target.value)}
                placeholder="Describir la acción correctiva tomada..."
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Lbl>
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{ padding: '10px 22px', background: saving ? '#BDBDBD' : T.primary,
            color: T.white, border: 'none', borderRadius: 6, fontWeight: 700,
            fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Guardando...' : 'Guardar Control de Personal'}
        </button>
      </div>

      {/* Historial */}
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 22 }}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary, marginBottom: 16 }}>
          Historial de Controles
        </div>
        {histLoading ? <Skeleton rows={5} /> : (historial || []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: T.textMid, fontSize: '.85rem' }}>
            Sin registros
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Turno', 'Responsable', 'Aprobados', 'Rechazados', 'Resultado', 'Acción', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', color: T.white, fontSize: '.7rem',
                      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
                      textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(historial || []).slice(0, 100).map((r, i) => {
                  const ok = r.resultado === 'APROBADO';
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FBF9' }}>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0',
                        fontWeight: 600, color: T.textMid }}>{r.fecha}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0' }}>{r.turno || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0' }}>{r.resp || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0',
                        fontWeight: 700, color: T.secondary }}>{r.aprobados ?? '—'} / {r.total ?? '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0',
                        fontWeight: 700, color: r.rechazados > 0 ? T.danger : T.textMid }}>{r.rechazados ?? 0}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '.68rem', fontWeight: 700,
                          background: ok ? T.green2 : '#FFEBEE', color: ok ? T.secondary : T.danger }}>
                          {ok ? '✅ APROBADO' : '❌ RECHAZADO'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '.75rem', borderBottom: '1px solid #F0F0F0',
                        color: T.textMid, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.accion || '—'}
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
