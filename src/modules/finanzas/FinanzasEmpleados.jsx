import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useAuth } from '../../hooks/useAuth';

const T = {
  bg: '#F8F3E9', paper: '#FFFFFF', ink: '#1A1A18', forest: '#1F3A2C',
  canopy: '#2D6645', ochre: '#A8835A', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)',
  ok: '#2E7D32', warn: '#B26A00', err: '#B00020', sand: '#E7DDC9',
};

const fmt = (n) => Number.isFinite(n) ? n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

export default function FinanzasEmpleados() {
  const { getFinanzasPerms } = useAuth();
  const perms = getFinanzasPerms();

  const { empleados, loading: le } = useEmpleados();
  const { data: alRecords, loading: la } = useCollection('al', { orderField: 'fecha', orderDir: 'desc', limit: 500 });

  const [periodo, setPeriodo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const filas = useMemo(() => {
    // Registros AL del mes
    const delMes = (alRecords || []).filter(r => (r.fecha || '').startsWith(periodo));

    // Acumular por empleado: días presentes + horas extra
    const acc = {}; // empleadoId -> { dias, horasExtras }
    for (const rec of delMes) {
      for (const c of (rec.checks || [])) {
        const key = c.empleadoId || c.nombre;
        if (!acc[key]) acc[key] = { dias: 0, horasExtras: 0, nombre: c.nombre };
        acc[key].dias += 1;
        acc[key].horasExtras += parseFloat(c.horasExtras) || 0;
      }
    }

    // Cruzar con catálogo de empleados (salarios)
    return empleados.map(e => {
      const a = acc[e.id] || acc[e.nombre] || { dias: 0, horasExtras: 0 };
      const salarioDia = parseFloat(e.salarioDia) || 0;
      const salarioSemana = parseFloat(e.salarioSemana) || 0;
      const tarifaHE = parseFloat(e.tarifaHoraExtra) || 0;
      const tipoPago = e.tipoPago || 'diario';

      // Base según tipo de pago
      let base;
      if (tipoPago === 'semanal') {
        // aprox: salario semanal / 6 días laborales
        base = (salarioSemana / 6) * a.dias;
      } else {
        base = salarioDia * a.dias;
      }
      const extras = a.horasExtras * tarifaHE;
      const total = base + extras;

      return {
        id: e.id, nombre: e.nombre, area: e.area || e.cargo || '—', tipoPago,
        dias: a.dias, horasExtras: a.horasExtras,
        salarioDia, salarioSemana, tarifaHE, base, extras, total,
        sinTarifa: (salarioDia === 0 && salarioSemana === 0),
      };
    })
    .filter(f => f.dias > 0 || f.total > 0) // solo los que trabajaron
    .sort((a, b) => b.total - a.total);
  }, [empleados, alRecords, periodo]);

  const totales = useMemo(() => ({
    dias: filas.reduce((s, f) => s + f.dias, 0),
    base: filas.reduce((s, f) => s + f.base, 0),
    extras: filas.reduce((s, f) => s + f.extras, 0),
    total: filas.reduce((s, f) => s + f.total, 0),
  }), [filas]);

  const cambiarMes = (delta) => {
    const [y, m] = periodo.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setPeriodo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const mesLabel = new Date(periodo + '-01').toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
  const loading = le || la;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: '.82rem', color: T.muted, marginBottom: 4 }}>Finanzas · Empleados</div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.55rem', fontWeight: 600, color: T.forest }}>Cuentas por pagar — Personal</h1>
          <div style={{ fontSize: '.85rem', color: T.muted, marginTop: 3 }}>{mesLabel} · calculado desde <Link to="/bpm/al" style={{ color: T.canopy, fontWeight: 600 }}>Control Acceso y Lavado</Link></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => cambiarMes(-1)} style={navBtn}>◀</button>
          <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ padding: '6px 10px', border: `1px solid ${T.rule}`, borderRadius: 3, fontSize: '.85rem' }} />
          <button onClick={() => cambiarMes(1)} style={navBtn}>▶</button>
        </div>
      </div>

      <div style={{ background: 'rgba(168,131,90,.08)', padding: '10px 14px', borderRadius: 3, marginBottom: 16, fontSize: '.8rem', color: T.muted }}>
        Los días presentes y horas extra se jalan automáticamente de los turnos AL. Los salarios salen del catálogo de empleados
        (<Link to="/admin" style={{ color: T.canopy, fontWeight: 600 }}>Administración → Empleados</Link>). Para cargar el pago real usá <b>Movimientos → Nuevo pago → Sueldos</b>.
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>Cargando asistencia y salarios…</div>}

      {!loading && filas.length === 0 && (
        <div style={{ padding: 40, background: T.paper, border: `1px solid ${T.rule}`, textAlign: 'center', color: T.muted }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>👥</div>
          Sin asistencia registrada en {mesLabel}.<br/>
          <span style={{ fontSize: '.85rem' }}>Registrá turnos en Control Acceso y Lavado para ver las cuentas por pagar.</span>
        </div>
      )}

      {!loading && filas.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.84rem', background: T.paper, boxShadow: '0 1px 3px rgba(0,0,0,.05)', minWidth: 700 }}>
            <thead>
              <tr>
                <th style={thL}>Empleado</th>
                <th style={thL}>Área</th>
                <th style={thC}>Días</th>
                <th style={thC}>H. Extra</th>
                <th style={thR}>Salario base</th>
                <th style={thR}>H. Extra Q</th>
                <th style={thR}>Total a pagar</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={f.id} style={{ background: i % 2 ? '#FAFAF7' : T.paper }}>
                  <td style={{ ...td, fontWeight: 600, color: T.forest }}>
                    {f.nombre}
                    {f.sinTarifa && <span title="Sin salario configurado" style={{ marginLeft: 6, fontSize: '.7rem', color: T.warn, fontWeight: 700 }}>⚠ sin salario</span>}
                  </td>
                  <td style={{ ...td, color: T.muted }}>{f.area}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{f.dias}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{f.horasExtras > 0 ? f.horasExtras + ' h' : '—'}</td>
                  <td style={tdNum}>Q {fmt(f.base)}</td>
                  <td style={tdNum}>{f.extras > 0 ? 'Q ' + fmt(f.extras) : '—'}</td>
                  <td style={{ ...tdNum, fontWeight: 700, color: T.forest }}>Q {fmt(f.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: T.sand, fontWeight: 700 }}>
                <td style={td} colSpan={2}>TOTAL — {filas.length} empleados</td>
                <td style={{ ...td, textAlign: 'center' }}>{totales.dias}</td>
                <td style={td}></td>
                <td style={tdNum}>Q {fmt(totales.base)}</td>
                <td style={tdNum}>Q {fmt(totales.extras)}</td>
                <td style={{ ...tdNum, fontSize: '.95rem', color: T.forest }}>Q {fmt(totales.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

const navBtn = { padding: '6px 10px', border: `1px solid ${T.rule}`, background: 'white', cursor: 'pointer', borderRadius: 3 };
const thBase = { background: T.forest, color: 'white', padding: '8px 10px', fontSize: '.66rem', letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 600 };
const thL = { ...thBase, textAlign: 'left' };
const thC = { ...thBase, textAlign: 'center' };
const thR = { ...thBase, textAlign: 'right' };
const td = { padding: '8px 10px', borderBottom: `1px solid ${T.rule}` };
const tdNum = { ...td, textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' };
