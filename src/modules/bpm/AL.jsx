import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green: '#1A3D28', acc: '#4A9E6A', cream: '#F5F0E4', sand: '#E8DCC8', danger: '#c0392b', bg: '#F9F6EF' };

const LAVADOS = ['10:00', '12:00', '14:00', '16:00'];
const today = () => new Date().toISOString().slice(0, 10);

function Badge({ ok }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 100,
      fontSize: '.65rem', fontWeight: 700,
      background: ok ? 'rgba(74,158,106,.15)' : 'rgba(192,57,43,.12)',
      color: ok ? C.acc : C.danger,
    }}>
      {ok ? '✓ OK' : '✗ No'}
    </span>
  );
}

export default function AL() {
  const toast = useToast();
  const { data: registros, loading, error } = useCollection('al', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { data: empList } = useCollection('empleados', { orderField: 'nombre', limit: 200 });
  const { add, saving } = useWrite('al');

  const [semanaFiltro, setSemanaFiltro] = useState('');
  const [form, setForm] = useState({
    fecha: today(),
    turno: 'mañana',
    empleados: [{ nombre: '', lavados: LAVADOS.map(h => ({ hora: h, cumplido: false })) }],
    obs: '',
  });

  // Calcular lunes de la semana de una fecha
  const getLunes = (f) => {
    const d = new Date(f + 'T00:00:00');
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d.toISOString().slice(0, 10);
  };

  const semanas = [...new Set((registros || []).map(r => getLunes(r.fecha || today())))].sort().reverse().slice(0, 8);

  const filtrados = semanaFiltro
    ? (registros || []).filter(r => getLunes(r.fecha || today()) === semanaFiltro)
    : (registros || []).slice(0, 50);

  const addEmpleado = () => {
    setForm(f => ({
      ...f,
      empleados: [...f.empleados, { nombre: '', lavados: LAVADOS.map(h => ({ hora: h, cumplido: false })) }],
    }));
  };

  const removeEmpleado = (i) => {
    setForm(f => ({ ...f, empleados: f.empleados.filter((_, idx) => idx !== i) }));
  };

  const toggleLavado = (empIdx, horaIdx) => {
    setForm(f => {
      const emps = f.empleados.map((e, ei) => {
        if (ei !== empIdx) return e;
        return { ...e, lavados: e.lavados.map((l, li) => li === horaIdx ? { ...l, cumplido: !l.cumplido } : l) };
      });
      return { ...f, empleados: emps };
    });
  };

  const handleSave = async () => {
    if (!form.fecha) { toast('⚠ Ingresá la fecha', 'error'); return; }
    if (form.empleados.some(e => !e.nombre.trim())) { toast('⚠ Ingresá el nombre de todos los empleados', 'error'); return; }

    const totalLavados = form.empleados.reduce((s, e) => s + e.lavados.filter(l => l.cumplido).length, 0);
    const totalPosible = form.empleados.length * LAVADOS.length;
    const pct = Math.round(totalLavados / totalPosible * 100);

    try {
      await add({
        fecha: form.fecha,
        turno: form.turno,
        empleados: form.empleados,
        obs: form.obs,
        totalLavados, totalPosible, pct,
      });
      toast('✓ Registro de acceso guardado');
      setForm(f => ({
        ...f,
        empleados: [{ nombre: '', lavados: LAVADOS.map(h => ({ hora: h, cumplido: false })) }],
        obs: '',
      }));
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  if (loading) return <LoadingSpinner text="Cargando registros de acceso..." />;
  if (error) return <div style={{ color: C.danger, padding: 24 }}>Error: {error}</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.green }}>🙌 Acceso y Lavado de Manos</h1>
        <p style={{ fontSize: '.82rem', color: '#6B8070', marginTop: 4 }}>
          Registro diario de lavado de manos por empleado · {LAVADOS.join(' · ')}
        </p>
      </div>

      {/* Formulario nuevo registro */}
      <div style={{ background: '#fff', border: `1px solid ${C.sand}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: '.88rem', color: C.green, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${C.sand}` }}>
          Nuevo Registro
        </div>

        {/* Fecha + turno */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <label style={labelStyle}>
            Fecha
            <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
              style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Turno
            <select value={form.turno} onChange={e => setForm(f => ({ ...f, turno: e.target.value }))} style={inputStyle}>
              <option value="mañana">Mañana</option>
              <option value="tarde">Tarde</option>
              <option value="noche">Noche</option>
            </select>
          </label>
        </div>

        {/* Empleados */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#6B8070', textTransform: 'uppercase', letterSpacing: '.06em' }}>Empleados</span>
            <button onClick={addEmpleado} style={{ ...btnSmall, background: C.green, color: '#fff' }}>+ Agregar empleado</button>
          </div>

          {form.empleados.map((emp, ei) => (
            <div key={ei} style={{ background: C.bg, border: `1px solid ${C.sand}`, borderRadius: 6, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <select
                  value={emp.nombre}
                  onChange={e => {
                    const emps = [...form.empleados];
                    emps[ei] = { ...emps[ei], nombre: e.target.value };
                    setForm(f => ({ ...f, empleados: emps }));
                  }}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="">— Seleccionar empleado —</option>
                  {(empList||[]).filter(e=>e.activo!==false).map(e=>(
                    <option key={e.id} value={e.nombre}>{e.nombre}{e.cargo?' · '+e.cargo:''}</option>
                  ))}
                </select>
                {form.empleados.length > 1 && (
                  <button onClick={() => removeEmpleado(ei)} style={{ ...btnSmall, borderColor: C.danger, color: C.danger }}>✕</button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {emp.lavados.map((lav, li) => (
                  <button
                    key={lav.hora}
                    onClick={() => toggleLavado(ei, li)}
                    style={{
                      padding: '7px 14px', borderRadius: 4, fontSize: '.78rem', fontWeight: 600,
                      cursor: 'pointer', border: '1.5px solid',
                      background: lav.cumplido ? C.acc : '#fff',
                      borderColor: lav.cumplido ? C.acc : C.sand,
                      color: lav.cumplido ? '#fff' : '#6B8070',
                      transition: 'all .15s',
                    }}
                  >
                    {lav.hora} {lav.cumplido ? '✓' : ''}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Observaciones */}
        <label style={labelStyle}>
          Observaciones
          <textarea
            value={form.obs}
            onChange={e => setForm(f => ({ ...f, obs: e.target.value }))}
            placeholder="Novedades, ausencias, incidentes..."
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </label>

        <button onClick={handleSave} disabled={saving} style={{
          marginTop: 16, padding: '12px 28px', background: saving ? '#ccc' : C.green,
          color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700,
          fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
        }}>
          {saving ? 'Guardando...' : 'Guardar Registro'}
        </button>
      </div>

      {/* Historial */}
      <div style={{ background: '#fff', border: `1px solid ${C.sand}`, borderRadius: 8, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: '.88rem', color: C.green }}>Historial ({(registros || []).length} registros)</span>
          <select value={semanaFiltro} onChange={e => setSemanaFiltro(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            <option value="">Últimos 50 registros</option>
            {semanas.map(s => <option key={s} value={s}>Semana del {s}</option>)}
          </select>
        </div>

        {filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6B8070' }}>Sin registros en este período</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem' }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  {['Fecha', 'Turno', 'Empleados', ...LAVADOS, 'Cumpl.%', 'Obs.'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#6B8070', borderBottom: `1px solid ${C.sand}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(r => {
                  const emps = r.empleados || [];
                  const countLav = (hora) => emps.filter(e => (e.lavados || []).find(l => l.hora === hora && l.cumplido)).length;
                  return (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${C.sand}` }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.fecha}</td>
                      <td style={{ padding: '8px 10px', color: '#6B8070' }}>{r.turno || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>{emps.length}</td>
                      {LAVADOS.map(h => (
                        <td key={h} style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {emps.length > 0 ? <Badge ok={countLav(h) === emps.length} /> : '—'}
                        </td>
                      ))}
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: (r.pct || 0) >= 80 ? C.acc : C.danger }}>
                        {r.pct || 0}%
                      </td>
                      <td style={{ padding: '8px 10px', color: '#6B8070', fontSize: '.72rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.obs || '—'}
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

const labelStyle = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.06em', color: '#4A9E6A', marginBottom: 12,
};
const inputStyle = {
  padding: '9px 12px', border: '1.5px solid #E8DCC8', borderRadius: 4,
  fontSize: '.88rem', outline: 'none', fontFamily: 'inherit', width: '100%',
};
const btnSmall = {
  padding: '5px 12px', borderRadius: 4, border: '1.5px solid #E8DCC8',
  background: '#fff', fontSize: '.75rem', fontWeight: 600, cursor: 'pointer',
};
