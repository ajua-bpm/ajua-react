import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const T = {
  primary:   '#1B5E20',
  secondary: '#2E7D32',
  danger:    '#C62828',
  warn:      '#E65100',
  textDark:  '#1A1A18',
  textMid:   '#6B6B60',
  border:    '#E0E0E0',
  bgGreen:   '#E8F5E9',
  white:     '#FFFFFF',
  bgLight:   '#F5F5F5',
};

const card = { background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 20, marginBottom: 20 };
const TH_S = { padding: '10px 14px', fontSize: '.75rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em', color: T.white, background: T.primary, textAlign: 'left', whiteSpace: 'nowrap' };
const TD_S = (alt) => ({ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', background: alt ? '#F9FBF9' : '#fff', color: T.textDark });
const LS   = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: T.secondary };
const IS   = { padding: '9px 12px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.85rem', outline: 'none', fontFamily: 'inherit', width: '100%', marginTop: 2, color: T.textDark, background: T.white };

const today   = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);
const fmtQ    = n => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 });

const ROLES = [
  { id: 'piloto',         label: 'Piloto / Conductor' },
  { id: 'operaciones',    label: 'Operaciones / Bodega' },
  { id: 'maquila',        label: 'Maquila' },
  { id: 'resp-limpieza',  label: 'Responsable Limpieza' },
  { id: 'calidad',        label: 'Calidad / Inspección' },
  { id: 'supervisor',     label: 'Supervisor / Encargado' },
  { id: 'admin',          label: 'Administración' },
  { id: 'ventas',         label: 'Ventas / Despacho' },
];

// ─── Shared hook: merged empleados ────────────────────────────────────────────
function useMergedEmpleados() {
  const { data: empCol, loading: lCol } = useCollection('empleados', { orderField: 'nombre', limit: 200 });
  const { empleados: empMain, loading: lMain } = useEmpleados();
  const merged = useMemo(() => {
    const seen = new Set();
    const list = [];
    [...(empCol || []), ...(empMain || [])].forEach(e => {
      const key = (e.nombre || '').toLowerCase().trim();
      if (!seen.has(key) && e.nombre) { seen.add(key); list.push(e); }
    });
    return list.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }, [empCol, empMain]);
  return { all: merged, activos: merged.filter(e => e.activo !== false), loading: lCol || lMain };
}

// ─── TAB 1: EMPLEADOS ────────────────────────────────────────────────────────
function TabEmpleados() {
  const toast = useToast();
  const { data, loading } = useCollection('empleados', { orderField: 'nombre', limit: 200 });
  const { add, update, remove, saving } = useWrite('empleados');

  const BLANK_EMP = {
    nombre: '', cargo: '', dpi: '', telefono: '', salarioDia: '',
    fechaIngreso: '', activo: true, roles: [], sexo: 'M',
    numLicencia: '', tipoLicencia: '', vencLicencia: '',
  };
  const [form, setForm]       = useState({ ...BLANK_EMP });
  const [editId, setEditId]   = useState(null);
  const [search, setSearch]   = useState('');
  const [soloActivos, setSoloActivos] = useState(false);

  const esPiloto = form.roles.includes('piloto');

  const toggleRol = (rolId) => {
    setForm(f => {
      const has = f.roles.includes(rolId);
      return { ...f, roles: has ? f.roles.filter(r => r !== rolId) : [...f.roles, rolId] };
    });
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast('Nombre es requerido', 'error'); return; }
    const payload = { ...form, salarioDia: parseFloat(form.salarioDia) || 0 };
    if (editId) { await update(editId, payload); toast('Empleado actualizado'); setEditId(null); }
    else { await add(payload); toast('Empleado agregado'); }
    setForm({ ...BLANK_EMP });
  };

  const startEdit = r => {
    setForm({
      nombre: r.nombre || '', cargo: r.cargo || '', dpi: r.dpi || '',
      telefono: r.telefono || '', salarioDia: String(r.salarioDia || ''),
      fechaIngreso: r.fechaIngreso || '', activo: r.activo !== false,
      roles: Array.isArray(r.roles) ? r.roles : [], sexo: r.sexo || 'M',
      numLicencia: r.numLicencia || '', tipoLicencia: r.tipoLicencia || '',
      vencLicencia: r.vencLicencia || '',
    });
    setEditId(r.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activos  = data.filter(r => r.activo !== false);
  const filtered = data
    .filter(r => !soloActivos || r.activo !== false)
    .filter(r => !search || r.nombre?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <Skeleton rows={6} />;

  return (
    <div>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Activos',        val: activos.length,  color: T.primary   },
          { label: 'Nómina semanal est.', val: `Q ${fmtQ(activos.reduce((s, e) => s + (e.salarioDia || 0) * 6, 0))}`, color: T.secondary },
          { label: 'Total empleados', val: data.length,    color: T.textMid   },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...card, marginBottom: 0, padding: '16px 20px' }}>
            <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textMid, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.primary, marginBottom: 18, borderBottom: `2px solid ${T.primary}`, paddingBottom: 8 }}>
          {editId ? 'Editar Empleado' : 'Nuevo Empleado'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 14, marginBottom: 14 }}>
          <label style={LS}>Nombre *<input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} style={IS} /></label>
          <label style={LS}>Cargo / Puesto<input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} style={IS} /></label>
          <label style={LS}>DPI<input value={form.dpi} onChange={e => setForm(f => ({ ...f, dpi: e.target.value }))} style={IS} /></label>
          <label style={LS}>Teléfono<input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} style={IS} /></label>
          <label style={LS}>Salario/día (Q)<input type="number" min="0" step="0.01" value={form.salarioDia} onChange={e => setForm(f => ({ ...f, salarioDia: e.target.value }))} style={IS} /></label>
          <label style={LS}>Fecha ingreso<input type="date" value={form.fechaIngreso} onChange={e => setForm(f => ({ ...f, fechaIngreso: e.target.value }))} style={IS} /></label>
          <label style={LS}>Sexo
            <select value={form.sexo} onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))} style={{ ...IS, cursor: 'pointer' }}>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </label>
        </div>

        {/* Roles */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '.72rem', color: T.secondary, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Roles del empleado (seleccionar todos los que aplican)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 6 }}>
            {ROLES.map(rol => (
              <label key={rol.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgGreen, border: `1px solid ${form.roles.includes(rol.id) ? T.secondary : T.border}`, borderRadius: 5, padding: '8px 10px', cursor: 'pointer', fontSize: '.78rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={form.roles.includes(rol.id)}
                  onChange={() => toggleRol(rol.id)}
                  style={{ accentColor: T.primary }}
                />
                {rol.label}
              </label>
            ))}
          </div>
        </div>

        {/* Licencia (solo pilotos) */}
        {esPiloto && (
          <div style={{ background: T.bgGreen, border: `1px solid ${T.secondary}44`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: '.72rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
              Datos de Licencia de Conducir
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 14 }}>
              <label style={LS}>No. Licencia<input value={form.numLicencia} onChange={e => setForm(f => ({ ...f, numLicencia: e.target.value }))} placeholder="L-12345678" style={IS} /></label>
              <label style={LS}>
                Tipo de Licencia
                <select value={form.tipoLicencia} onChange={e => setForm(f => ({ ...f, tipoLicencia: e.target.value }))} style={IS}>
                  <option value="">— Seleccionar —</option>
                  <option value="A">Tipo A — Motocicletas</option>
                  <option value="B">Tipo B — Automóviles</option>
                  <option value="C">Tipo C — Camión liviano</option>
                  <option value="E">Tipo E — Transporte pesado</option>
                  <option value="M">Tipo M — Maquinaria</option>
                </select>
              </label>
              <label style={LS}>Venc. Licencia<input type="date" value={form.vencLicencia} onChange={e => setForm(f => ({ ...f, vencLicencia: e.target.value }))} style={IS} /></label>
            </div>
          </div>
        )}

        {/* Activo toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: '.78rem', fontWeight: 700, color: T.textMid, textTransform: 'uppercase', letterSpacing: '.06em' }}>Estado:</span>
          <button onClick={() => setForm(f => ({ ...f, activo: !f.activo }))} style={{
            padding: '7px 18px', borderRadius: 100, fontWeight: 700, fontSize: '.8rem', cursor: 'pointer', border: 'none',
            background: form.activo ? T.secondary : '#BDBDBD', color: T.white,
          }}>
            {form.activo ? 'Activo' : 'Inactivo'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSave} disabled={saving} style={{ padding: '11px 28px', background: saving ? '#6B6B60' : T.primary, color: T.white, border: 'none', borderRadius: 6, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Agregar Empleado'}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setForm({ ...BLANK_EMP }); }} style={{ padding: '11px 20px', background: T.bgLight, border: `1px solid ${T.border}`, borderRadius: 6, fontWeight: 600, cursor: 'pointer', color: T.textMid }}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary }}>Lista ({filtered.length})</div>
            <button onClick={() => setSoloActivos(v => !v)} style={{
              padding: '4px 14px', borderRadius: 100, fontSize: '.75rem', fontWeight: 700, cursor: 'pointer',
              border: `1.5px solid ${soloActivos ? T.secondary : T.border}`,
              background: soloActivos ? T.secondary : T.white,
              color: soloActivos ? T.white : T.textMid,
            }}>
              {soloActivos ? '✓ Solo activos' : 'Solo activos'}
            </button>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre..."
            style={{ ...IS, width: 200, marginTop: 0 }} />
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: T.textMid }}>Sin empleados</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Nombre', 'Cargo', 'DPI', 'Teléfono', 'Salario/día', 'Roles', 'Activo', 'Acciones'].map(h => <th key={h} style={TH_S}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ opacity: r.activo === false ? 0.65 : 1 }}>
                    <td style={{ ...TD_S(i % 2 === 1), fontWeight: 600 }}>{r.nombre}</td>
                    <td style={TD_S(i % 2 === 1)}>{r.cargo || '—'}</td>
                    <td style={TD_S(i % 2 === 1)}>{r.dpi || '—'}</td>
                    <td style={TD_S(i % 2 === 1)}>{r.telefono || '—'}</td>
                    <td style={{ ...TD_S(i % 2 === 1), fontWeight: 600 }}>Q {(r.salarioDia || 0).toFixed(2)}</td>
                    <td style={{ ...TD_S(i % 2 === 1), maxWidth: 180 }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(r.roles || []).map(rol => (
                          <span key={rol} style={{ padding: '2px 7px', background: `${T.primary}15`, color: T.primary, borderRadius: 100, fontSize: '.68rem', fontWeight: 700 }}>
                            {ROLES.find(rr => rr.id === rol)?.label || rol}
                          </span>
                        ))}
                        {(!r.roles || r.roles.length === 0) && <span style={{ color: T.textMid }}>—</span>}
                      </div>
                    </td>
                    <td style={TD_S(i % 2 === 1)}>
                      <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 100, fontSize: '.7rem', fontWeight: 700, background: r.activo !== false ? 'rgba(46,125,50,.12)' : 'rgba(198,40,40,.10)', color: r.activo !== false ? T.secondary : T.danger }}>
                        {r.activo !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={TD_S(i % 2 === 1)}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => startEdit(r)} style={{ padding: '3px 9px', background: T.primary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>Editar</button>
                        <button onClick={async () => { if (confirm('¿Eliminar?')) await remove(r.id); }} style={{ padding: '3px 9px', background: T.danger, color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAB 2: ASISTENCIA ───────────────────────────────────────────────────────
function TabAsistencia() {
  const toast = useToast();
  const { all: allEmpleados, activos, loading: lEmp } = useMergedEmpleados();
  const { data: asistencias, loading: lAs } = useCollection('asistencia', { orderField: 'fecha', orderDir: 'desc', limit: 600 });
  const { add, update, saving } = useWrite('asistencia');

  const [fecha, setFecha]         = useState(today());
  const [nomDesde, setNomDesde]   = useState('');
  const [nomHasta, setNomHasta]   = useState('');
  const [nomData, setNomData]     = useState(null);
  const [rows, setRows]           = useState({});    // { empId: { horaEntrada, horaSalida, estado, obs } }

  // When fecha changes, pre-fill rows from existing asistencia
  const hoyRecords = asistencias.filter(a => a.fecha === fecha);

  const getRow = (empId) => rows[empId] || (() => {
    const existing = hoyRecords.find(a => a.empleadoId === empId);
    if (existing) return { horaEntrada: existing.horaEntrada || '', horaSalida: existing.horaSalida || '', estado: existing.estado || 'pendiente', obs: existing.obs || '' };
    return { horaEntrada: '', horaSalida: '', estado: 'pendiente', obs: '' };
  })();

  const setRow = (empId, field, val) => {
    setRows(prev => ({ ...prev, [empId]: { ...getRow(empId), [field]: val } }));
  };

  const guardarDia = async () => {
    for (const emp of activos) {
      const row      = getRow(emp.id);
      const existing = hoyRecords.find(a => a.empleadoId === emp.id);
      const payload  = { empleadoId: emp.id, empleado: emp.nombre, fecha, ...row };
      if (existing) await update(existing.id, payload);
      else await add(payload);
    }
    toast(`Asistencia del ${fecha} guardada`);
    setRows({});
  };

  const calcNomina = () => {
    if (!nomDesde || !nomHasta) { toast('Selecciona rango de fechas', 'error'); return; }
    const enRango = asistencias.filter(a => a.fecha >= nomDesde && a.fecha <= nomHasta && a.estado === 'presente');
    const byEmp = {};
    enRango.forEach(a => { byEmp[a.empleado] = (byEmp[a.empleado] || 0) + 1; });
    const rows = allEmpleados.filter(e => byEmp[e.nombre]).map(e => ({
      nombre: e.nombre, dias: byEmp[e.nombre] || 0, salarioDia: e.salarioDia || 0,
      total: (byEmp[e.nombre] || 0) * (e.salarioDia || 0),
    }));
    setNomData(rows);
  };

  const EST_COLORS = { presente: T.secondary, ausente: T.danger, permiso: T.warn, pendiente: '#BDBDBD' };

  if (lEmp || lAs) return <Skeleton rows={6} />;

  return (
    <div>
      {/* Date selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <label style={LS}>
          Fecha
          <input type="date" value={fecha} onChange={e => { setFecha(e.target.value); setRows({}); }} style={{ ...IS, width: 170 }} />
        </label>
        <div style={{ background: T.bgGreen, border: `1.5px solid ${T.secondary}`, borderRadius: 8, padding: '10px 18px' }}>
          <span style={{ fontSize: '.83rem', fontWeight: 700, color: T.primary }}>
            Presentes: {hoyRecords.filter(a => a.estado === 'presente').length} / {activos.length}
          </span>
        </div>
      </div>

      {/* Attendance rows */}
      {activos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: T.textMid }}>Sin empleados activos</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {activos.map(emp => {
            const row    = getRow(emp.id);
            const estado = row.estado || 'pendiente';
            return (
              <div key={emp.id} style={{ ...card, marginBottom: 0, padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 130, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '.88rem', color: T.textDark }}>{emp.nombre}</div>
                    <div style={{ fontSize: '.74rem', color: T.textMid }}>{emp.cargo || '—'}</div>
                  </div>
                  <label style={{ ...LS, marginBottom: 0 }}>
                    Entrada
                    <input type="time" value={row.horaEntrada} onChange={e => setRow(emp.id, 'horaEntrada', e.target.value)} style={{ ...IS, width: 110, marginTop: 2 }} />
                  </label>
                  <label style={{ ...LS, marginBottom: 0 }}>
                    Salida
                    <input type="time" value={row.horaSalida} onChange={e => setRow(emp.id, 'horaSalida', e.target.value)} style={{ ...IS, width: 110, marginTop: 2 }} />
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignSelf: 'flex-end' }}>
                    {['presente', 'ausente', 'permiso'].map(e => (
                      <button key={e} onClick={() => setRow(emp.id, 'estado', e)} style={{
                        padding: '6px 12px', borderRadius: 6, fontSize: '.78rem', fontWeight: 700, cursor: 'pointer',
                        border: `1.5px solid ${estado === e ? EST_COLORS[e] : T.border}`,
                        background: estado === e ? EST_COLORS[e] : T.white,
                        color: estado === e ? T.white : T.textMid,
                        textTransform: 'capitalize',
                      }}>{e.charAt(0).toUpperCase() + e.slice(1)}</button>
                    ))}
                  </div>
                  <label style={{ ...LS, flex: 1, minWidth: 100, marginBottom: 0 }}>
                    Obs
                    <input value={row.obs} onChange={e => setRow(emp.id, 'obs', e.target.value)} style={{ ...IS, marginTop: 2 }} placeholder="Notas..." />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={guardarDia} disabled={saving} style={{
        padding: '11px 28px', background: saving ? '#6B6B60' : T.primary, color: T.white,
        border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
        marginBottom: 32,
      }}>
        {saving ? 'Guardando...' : `Guardar asistencia del ${fecha}`}
      </button>

      {/* Nomina calculator */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.primary, marginBottom: 16, borderBottom: `2px solid ${T.primary}`, paddingBottom: 8 }}>
          Cálculo de Nómina
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
          <label style={LS}>
            Desde
            <input type="date" value={nomDesde} onChange={e => setNomDesde(e.target.value)} style={{ ...IS, width: 155 }} />
          </label>
          <label style={LS}>
            Hasta
            <input type="date" value={nomHasta} onChange={e => setNomHasta(e.target.value)} style={{ ...IS, width: 155 }} />
          </label>
          <button onClick={calcNomina} style={{ padding: '10px 22px', background: T.secondary, color: T.white, border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end' }}>
            Calcular Nómina
          </button>
          {nomData && <button onClick={() => setNomData(null)} style={{ padding: '10px 16px', background: T.bgLight, border: `1px solid ${T.border}`, borderRadius: 6, fontWeight: 600, cursor: 'pointer', color: T.textMid, alignSelf: 'flex-end' }}>Limpiar</button>}
        </div>
        {nomData && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Empleado', 'Días presentes', 'Salario/día Q', 'Total Q'].map(h => <th key={h} style={TH_S}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {nomData.map((r, i) => (
                  <tr key={r.nombre}>
                    <td style={{ ...TD_S(i % 2 === 1), fontWeight: 600 }}>{r.nombre}</td>
                    <td style={TD_S(i % 2 === 1)}>{r.dias}</td>
                    <td style={TD_S(i % 2 === 1)}>Q {r.salarioDia.toFixed(2)}</td>
                    <td style={{ ...TD_S(i % 2 === 1), fontWeight: 700, color: T.primary }}>Q {fmtQ(r.total)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} style={{ padding: '10px 14px', fontWeight: 800, fontSize: '.85rem', color: T.primary, borderTop: `2px solid ${T.primary}` }}>TOTAL NÓMINA</td>
                  <td style={{ padding: '10px 14px', fontWeight: 800, fontSize: '.95rem', color: T.primary, borderTop: `2px solid ${T.primary}` }}>
                    Q {fmtQ(nomData.reduce((s, r) => s + r.total, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {nomData && nomData.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: T.textMid }}>Sin datos de asistencia en el rango seleccionado</div>
        )}
      </div>
    </div>
  );
}

// ─── TAB 3: ANTICIPOS PERSONAL ───────────────────────────────────────────────
function TabAnticipos() {
  const toast = useToast();
  const { data, loading }       = useCollection('perAnticipo', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { activos: empActivos } = useMergedEmpleados();
  const { add, update, saving } = useWrite('perAnticipo');

  const [form, setForm]     = useState({ empleado: '', fecha: today(), monto: '', concepto: '', estado: 'pendiente' });
  const [editId, setEditId] = useState(null);

  const handleSave = async () => {
    if (!form.empleado || !form.monto) { toast('Empleado y monto son requeridos', 'error'); return; }
    const payload = { ...form, monto: parseFloat(form.monto) || 0, creadoEn: new Date().toISOString() };
    if (editId) { await update(editId, payload); toast('Anticipo actualizado'); setEditId(null); }
    else { await add(payload); toast('Anticipo registrado'); }
    setForm({ empleado: '', fecha: today(), monto: '', concepto: '', estado: 'pendiente' });
  };

  const startEdit = r => {
    setForm({ empleado: r.empleado || '', fecha: r.fecha || today(), monto: String(r.monto || ''), concepto: r.concepto || '', estado: r.estado || 'pendiente' });
    setEditId(r.id);
  };

  const descontar = async (id) => { await update(id, { estado: 'descontado' }); toast('Marcado como descontado'); };

  if (loading) return <Skeleton rows={5} />;

  const totalPend = data.filter(r => r.estado === 'pendiente').reduce((s, r) => s + (r.monto || 0), 0);

  const EST_CFG = {
    pendiente:  { color: T.warn,      bg: 'rgba(230,81,0,.10)',   label: 'Pendiente'  },
    descontado: { color: T.secondary, bg: 'rgba(46,125,50,.12)',  label: 'Descontado' },
  };

  return (
    <div>
      <div style={{ ...card, marginBottom: 16, padding: '16px 20px', borderLeft: `4px solid ${T.warn}` }}>
        <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textMid, marginBottom: 6 }}>Total pendiente a descontar</div>
        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: T.warn }}>Q {fmtQ(totalPend)}</div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.primary, marginBottom: 18, borderBottom: `2px solid ${T.primary}`, paddingBottom: 8 }}>
          {editId ? 'Editar Anticipo' : 'Registrar Anticipo Personal'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 14, marginBottom: 14 }}>
          <label style={LS}>
            Empleado *
            <select value={form.empleado} onChange={e => setForm(f => ({ ...f, empleado: e.target.value }))} style={IS}>
              <option value="">— Seleccionar —</option>
              {empActivos.map(e => <option key={e.id || e.nombre} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </label>
          <label style={LS}>Fecha<input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} style={IS} /></label>
          <label style={LS}>Monto (Q) *<input type="number" min="0" step="0.01" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} style={IS} /></label>
          <label style={LS}>Concepto<input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} style={IS} /></label>
          <label style={LS}>
            Estado
            <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} style={IS}>
              <option value="pendiente">Pendiente</option>
              <option value="descontado">Descontado</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSave} disabled={saving} style={{ padding: '11px 28px', background: saving ? '#6B6B60' : T.primary, color: T.white, border: 'none', borderRadius: 6, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Registrar'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm({ empleado: '', fecha: today(), monto: '', concepto: '', estado: 'pendiente' }); }} style={{ padding: '11px 20px', background: T.bgLight, border: `1px solid ${T.border}`, borderRadius: 6, fontWeight: 600, cursor: 'pointer', color: T.textMid }}>Cancelar</button>}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary, marginBottom: 16 }}>Historial ({data.length})</div>
        {data.length === 0 ? <div style={{ textAlign: 'center', padding: '40px 0', color: T.textMid }}>Sin anticipos registrados</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Fecha', 'Empleado', 'Monto', 'Concepto', 'Estado', 'Acciones'].map(h => <th key={h} style={TH_S}>{h}</th>)}</tr></thead>
              <tbody>
                {data.slice(0, 100).map((r, i) => {
                  const cfg = EST_CFG[r.estado] || EST_CFG.pendiente;
                  return (
                    <tr key={r.id}>
                      <td style={{ ...TD_S(i % 2 === 1), whiteSpace: 'nowrap' }}>{r.fecha}</td>
                      <td style={{ ...TD_S(i % 2 === 1), fontWeight: 600 }}>{r.empleado || '—'}</td>
                      <td style={{ ...TD_S(i % 2 === 1), fontWeight: 700, color: T.warn }}>Q {(r.monto || 0).toFixed(2)}</td>
                      <td style={TD_S(i % 2 === 1)}>{r.concepto || '—'}</td>
                      <td style={TD_S(i % 2 === 1)}>
                        <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 100, fontSize: '.7rem', fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      </td>
                      <td style={TD_S(i % 2 === 1)}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => startEdit(r)} style={{ padding: '3px 9px', background: T.primary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>Editar</button>
                          {r.estado === 'pendiente' && (
                            <button onClick={() => descontar(r.id)} style={{ padding: '3px 9px', background: T.secondary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>Descontar ✓</button>
                          )}
                        </div>
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

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'empleados',  label: 'Empleados',         Component: TabEmpleados  },
  { id: 'asistencia', label: 'Asistencia',         Component: TabAsistencia },
  { id: 'anticipos',  label: 'Anticipos Personal', Component: TabAnticipos  },
];

export default function Personal() {
  const [tab, setTab] = useState('empleados');
  const Active = TABS.find(t => t.id === tab).Component;

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1100 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: T.primary, margin: 0 }}>Personal</h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>Gestión de empleados, asistencia diaria y anticipos</p>
      </div>

      {/* Pill tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 20px', borderRadius: 100, fontWeight: 700, fontSize: '.83rem', cursor: 'pointer',
            border: `1.5px solid ${tab === t.id ? T.primary : T.border}`,
            background: tab === t.id ? T.primary : T.white,
            color: tab === t.id ? T.white : T.textMid,
          }}>{t.label}</button>
        ))}
      </div>

      <Active />
    </div>
  );
}
