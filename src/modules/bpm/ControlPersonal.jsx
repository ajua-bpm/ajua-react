import { useState, useMemo, useEffect } from 'react';
import { useEmpleados } from '../../hooks/useMainData';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// Merge empleados from collection + main doc, filter active, sort alpha
function usePersonal() {
  const { data: empCol, loading: lCol } = useCollection('empleados', { orderField: 'nombre', limit: 200 });
  const { empleados: empMain, loading: lMain } = useEmpleados();
  const personal = useMemo(() => {
    const seen = new Set();
    const list = [];
    [...(empCol || []), ...(empMain || [])].forEach(e => {
      const key = (e.nombre || '').toLowerCase().trim();
      if (!seen.has(key) && e.nombre && e.activo !== false) { seen.add(key); list.push(e); }
    });
    return list.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }, [empCol, empMain]);
  return { personal, loading: lCol || lMain };
}

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
  green2:    '#E8F5E9',
};
const card = { background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 22, marginBottom: 20 };
const LS = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase',
  color: T.textMid, letterSpacing: '.06em',
};
const IS = {
  padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
  fontSize: '.88rem', outline: 'none', fontFamily: 'inherit',
  width: '100%', boxSizing: 'border-box', marginTop: 2,
};

const today = () => new Date().toISOString().slice(0, 10);
const mkRows = (personal) => personal.map(e => ({
  id:         e.id || e.nombre,
  nombre:     e.nombre,
  area:       e.area || e.cargo || '',
  trabajoHoy: false,
  cumplio:    null,   // null = not set, true = cumplió, false = no cumplió
  obs:        '',
}));

// ── Main ──────────────────────────────────────────────────────────
export default function ControlPersonal() {
  const toast = useToast();
  const { personal, loading: empLoading } = usePersonal();
  const { data: historial, loading: histLoading } = useCollection('controlPersonal', {
    orderField: 'fecha', orderDir: 'desc', limit: 200,
  });
  const { add, remove, saving } = useWrite('controlPersonal');

  const [fecha,  setFecha]  = useState(today());
  const [turno,  setTurno]  = useState('AM');
  const [resp,   setResp]   = useState('');
  const [accion, setAccion] = useState('');
  const [rows,   setRows]   = useState([]);

  // Init rows whenever personal list loads
  useEffect(() => {
    if (!empLoading && personal.length > 0) setRows(mkRows(personal));
  }, [personal, empLoading]);

  const setRow = (idx, patch) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));

  const trabajaron = rows.filter(r => r.trabajoHoy);
  const aprobadas  = trabajaron.filter(r => r.cumplio === true).length;
  const rechazadas = trabajaron.filter(r => r.cumplio === false).length;
  const turnoOK    = trabajaron.length > 0 && rechazadas === 0 && aprobadas === trabajaron.length;

  const handleSave = async () => {
    if (!fecha || !resp) { toast('Complete fecha y responsable', 'error'); return; }
    if (trabajaron.length === 0) { toast('Seleccione al menos un empleado que trabajó hoy', 'error'); return; }
    const pendientes = trabajaron.filter(r => r.cumplio === null).length;
    if (pendientes > 0) { toast('Marque CUMPLIÓ o NO CUMPLIÓ para todos los que trabajaron', 'error'); return; }
    await add({
      fecha, turno, resp, accion,
      empleados: rows.map(r => ({
        nombre: r.nombre, area: r.area,
        trabajoHoy: r.trabajoHoy, cumplio: r.cumplio, obs: r.obs,
      })),
      totalTrabajaron: trabajaron.length,
      aprobadas, rechazadas,
      resultado: turnoOK ? 'APROBADO' : 'RECHAZADO',
    });
    toast('Control de personal guardado');
    setRows(mkRows(personal));
    setAccion('');
  };

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Control de Personal — Higiene
        </h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>
          Verificación diaria · Seleccionar quién trabajó y confirmar cumplimiento BPM
        </p>
      </div>

      {/* Form card */}
      <div style={card}>
        {/* Top row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 18 }}>
          <label style={LS}>
            Fecha
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={IS} />
          </label>
          <label style={LS}>
            Turno
            <select value={turno} onChange={e => setTurno(e.target.value)} style={{ ...IS, cursor: 'pointer' }}>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </label>
          <label style={LS}>
            Responsable BPM
            {empLoading ? <Skeleton height={36} /> : (
              <select value={resp} onChange={e => setResp(e.target.value)} style={{ ...IS, cursor: 'pointer' }}>
                <option value="">— Seleccionar —</option>
                {personal.map(e => (
                  <option key={e.id || e.nombre} value={e.nombre}>
                    {e.nombre}{e.cargo ? ' · ' + e.cargo : ''}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>

        {/* Score banner */}
        {trabajaron.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{
              padding: '6px 16px', borderRadius: 20, fontWeight: 800, fontSize: '.82rem',
              background: turnoOK ? T.green2 : rechazadas > 0 ? '#FFEBEE' : '#FFF3E0',
              color: turnoOK ? T.secondary : rechazadas > 0 ? T.danger : '#E65100',
            }}>
              {turnoOK ? '✅ TURNO APROBADO' : rechazadas > 0 ? '❌ TURNO RECHAZADO' : '⏳ Pendiente'}
            </div>
            <span style={{ fontSize: '.8rem', color: T.textMid }}>
              <b style={{ color: T.secondary }}>{aprobadas}</b> / {trabajaron.length} aprobados
              {rechazadas > 0 && <> · <b style={{ color: T.danger }}>{rechazadas} rechazados</b></>}
            </span>
          </div>
        )}

        {/* Section label */}
        <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary, marginBottom: 8 }}>
          👥 Personal ({rows.length}) — marcar quién trabajó hoy
        </div>

        {/* Employee rows */}
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
          {empLoading ? (
            <div style={{ padding: 16 }}><Skeleton rows={4} /></div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: T.textMid, fontSize: '.83rem' }}>
              No hay empleados activos registrados.<br />
              <span style={{ fontSize: '.75rem' }}>Agregar empleados en Personal.</span>
            </div>
          ) : rows.map((row, idx) => (
            <div key={row.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
              borderBottom: idx < rows.length - 1 ? `1px solid ${T.border}` : 'none',
              background: idx % 2 === 0 ? '#fff' : '#F9FBF9',
              flexWrap: 'wrap',
            }}>
              {/* Checkbox trabajó */}
              <input
                type="checkbox"
                checked={row.trabajoHoy}
                onChange={e => setRow(idx, {
                  trabajoHoy: e.target.checked,
                  cumplio: e.target.checked ? row.cumplio : null,
                })}
                style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0, accentColor: T.secondary }}
              />

              {/* Name + area */}
              <div style={{ flex: '1 1 160px', minWidth: 130 }}>
                <div style={{ fontWeight: 600, fontSize: '.88rem', color: row.trabajoHoy ? T.textDark : T.textMid }}>
                  {row.nombre}
                </div>
                {row.area && (
                  <div style={{ fontSize: '.7rem', color: T.textMid }}>{row.area}</div>
                )}
              </div>

              {/* Cumplió toggle */}
              {row.trabajoHoy ? (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {[true, false].map(v => (
                    <button
                      key={String(v)}
                      onClick={() => setRow(idx, { cumplio: row.cumplio === v ? null : v })}
                      style={{
                        padding: '5px 14px', borderRadius: 5, border: '1.5px solid',
                        cursor: 'pointer', fontWeight: 700, fontSize: '.75rem', fontFamily: 'inherit',
                        background: row.cumplio === v ? (v ? T.secondary : T.danger) : '#fff',
                        borderColor: row.cumplio === v ? (v ? T.secondary : T.danger) : T.border,
                        color: row.cumplio === v ? '#fff' : T.textMid,
                      }}>
                      {v ? '✓ Cumplió' : '✗ No cumplió'}
                    </button>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: '.73rem', color: T.border, flexShrink: 0, fontStyle: 'italic' }}>
                  No trabajó hoy
                </span>
              )}

              {/* Obs if no cumplió */}
              {row.trabajoHoy && row.cumplio === false && (
                <input
                  value={row.obs}
                  onChange={e => setRow(idx, { obs: e.target.value })}
                  placeholder="Anotar observación..."
                  style={{ ...IS, flex: '1 1 180px', marginTop: 0, padding: '5px 10px', fontSize: '.8rem' }}
                />
              )}

              {/* Result badge */}
              {row.trabajoHoy && row.cumplio !== null && (
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: '.68rem', fontWeight: 700, flexShrink: 0,
                  background: row.cumplio ? T.green2 : '#FFEBEE',
                  color: row.cumplio ? T.secondary : T.danger,
                }}>
                  {row.cumplio ? '✅ OK' : '❌ NO'}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Acción si hay rechazadas */}
        {rechazadas > 0 && (
          <label style={{ ...LS, marginBottom: 14 }}>
            Acción correctiva tomada
            <textarea
              value={accion}
              onChange={e => setAccion(e.target.value)}
              placeholder="Describir acción tomada..."
              rows={2}
              style={{ ...IS, resize: 'vertical' }}
            />
          </label>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 22px', background: saving ? '#BDBDBD' : T.primary,
            color: T.white, border: 'none', borderRadius: 6, fontWeight: 700,
            fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}>
          {saving ? 'Guardando...' : 'Guardar Control de Personal'}
        </button>
      </div>

      {/* Historial */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary, marginBottom: 16 }}>Historial</div>
        {histLoading ? <Skeleton rows={5} /> : (historial || []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: T.textMid, fontSize: '.85rem' }}>Sin registros</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Turno', 'Responsable', 'Trabajaron', 'Aprobadas', 'Resultado', ''].map(h => (
                    <th key={h} style={{
                      padding: '9px 12px', color: T.white, fontSize: '.7rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'left', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(historial || []).slice(0, 100).map((r, i) => {
                  const ok = r.resultado === 'APROBADO';
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FBF9' }}>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600, color: T.textMid }}>{r.fecha}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0' }}>{r.turno || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0' }}>{r.resp || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: T.textDark }}>
                        {r.totalTrabajaron ?? r.total ?? '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: T.secondary }}>
                        {(r.aprobadas ?? r.aprobados) != null
                          ? `${r.aprobadas ?? r.aprobados}${r.totalTrabajaron ? ' / ' + r.totalTrabajaron : ''}`
                          : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: '.68rem', fontWeight: 700,
                          background: ok ? T.green2 : '#FFEBEE', color: ok ? T.secondary : T.danger,
                        }}>
                          {ok ? '✅ APROBADO' : '❌ RECHAZADO'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }}>
                        <button onClick={() => remove(r.id)} style={{
                          background: 'none', border: `1px solid ${T.border}`, borderRadius: 4,
                          padding: '3px 8px', cursor: 'pointer', fontSize: '.72rem', color: T.textMid,
                        }}>✕</button>
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
