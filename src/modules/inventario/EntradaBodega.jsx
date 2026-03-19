import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useProductosCatalogo, useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ── Design tokens ────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', white: '#FFFFFF',
  bgLight: '#F5F5F5', border: '#E0E0E0', textDark: '#1A1A18',
  textMid: '#6B6B60', danger: '#C62828', warn: '#E65100',
};
const shadow = '0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06)';
const card   = { background: '#fff', borderRadius: 8, boxShadow: shadow, padding: 20, marginBottom: 20 };

const thSt = {
  color: T.white, padding: '10px 14px', fontSize: '.75rem',
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em',
  textAlign: 'left', whiteSpace: 'nowrap',
};
const tdSt = { padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', color: T.textDark };

const LS = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase',
  color: T.textMid, letterSpacing: '.06em',
};
const IS = {
  padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
  fontSize: '.88rem', outline: 'none', fontFamily: 'inherit',
};

const UNIDADES = ['lb', 'kg', 'caja', 'unidad', 'quintal', 'saco', 'barril'];
const today    = () => new Date().toISOString().slice(0, 10);
const nowTime  = () => new Date().toTimeString().slice(0, 5);

const BLANK = {
  fecha: today(), hora: nowTime(), producto: '', cantidad: '',
  unidad: 'lb', proveedor: '', lote: '', precioUnitario: '', responsable: '',
};

// ── Metric card ──────────────────────────────────────────────────
function MetricCard({ label, value, accent }) {
  return (
    <div style={{ ...card, marginBottom: 0, flex: '1 1 150px', borderTop: `3px solid ${accent || T.primary}` }}>
      <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMid, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: accent || T.textDark, lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export default function EntradaBodega() {
  const toast = useToast();

  const { data, loading }                = useCollection('ientradas', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { data: proveedores, loading: lp } = useCollection('proveedores', { orderField: 'nombre', limit: 200 });
  const { productos, loading: loadProd } = useProductosCatalogo();
  const { empleados, loading: loadEmp }  = useEmpleados();
  const { add, saving }                  = useWrite('ientradas');

  const [form, setForm] = useState({ ...BLANK });
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.fecha || !form.producto || !form.cantidad) {
      toast('Fecha, producto y cantidad son requeridos', 'error'); return;
    }
    await add({
      ...form,
      cantidad:       parseFloat(form.cantidad) || 0,
      precioUnitario: parseFloat(form.precioUnitario) || 0,
    });
    toast('Entrada registrada correctamente');
    setForm(f => ({ ...f, producto: '', cantidad: '', lote: '', precioUnitario: '', responsable: '' }));
  };

  const todayStr    = today();
  const entradasHoy = data.filter(r => r.fecha === todayStr).length;
  const totalUnids  = useMemo(() => data.reduce((s, r) => s + (parseFloat(r.cantidad) || 0), 0), [data]);

  const loadingAll = loading || lp || loadProd || loadEmp;

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: T.textDark }}>
          Ingresos a Bodega
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '.83rem', color: T.textMid }}>
          Registro de entradas de producto desde proveedores
        </p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <MetricCard label="Entradas hoy"   value={loadingAll ? '…' : entradasHoy} accent={T.secondary} />
        <MetricCard label="Total registros" value={loadingAll ? '…' : data.length}  accent={T.primary} />
        <MetricCard label="Total unidades"  value={loadingAll ? '…' : totalUnids.toLocaleString()} accent={T.warn} />
      </div>

      {/* Form */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.textDark, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #F0F0F0' }}>
          Nueva entrada
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 14, marginBottom: 16 }}>
          <label style={LS}>
            Fecha
            <input type="date" value={form.fecha} onChange={e => s('fecha', e.target.value)} style={IS} />
          </label>
          <label style={LS}>
            Hora
            <input type="time" value={form.hora} onChange={e => s('hora', e.target.value)} style={IS} />
          </label>
          <label style={LS}>
            Producto *
            <select value={form.producto} onChange={e => s('producto', e.target.value)} style={IS}>
              <option value="">— Seleccionar —</option>
              {productos.map(p => <option key={p.id || p.nombre} value={p.nombre}>{p.nombre}</option>)}
            </select>
          </label>
          <label style={LS}>
            Cantidad *
            <input type="number" min="0" step="0.01" value={form.cantidad}
              onChange={e => s('cantidad', e.target.value)} style={IS} />
          </label>
          <label style={LS}>
            Unidad
            <select value={form.unidad} onChange={e => s('unidad', e.target.value)} style={IS}>
              {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label style={LS}>
            Proveedor
            <select value={form.proveedor} onChange={e => s('proveedor', e.target.value)} style={IS}>
              <option value="">— Seleccionar —</option>
              {proveedores.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
            </select>
          </label>
          <label style={LS}>
            Lote / Guía
            <input value={form.lote} onChange={e => s('lote', e.target.value)} style={IS} />
          </label>
          <label style={LS}>
            Precio unitario (Q)
            <input type="number" min="0" step="0.01" value={form.precioUnitario}
              onChange={e => s('precioUnitario', e.target.value)} style={IS} />
          </label>
          <label style={LS}>
            Responsable
            <select value={form.responsable} onChange={e => s('responsable', e.target.value)} style={IS}>
              <option value="">— Seleccionar —</option>
              {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </label>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '11px 28px', background: saving ? T.border : T.primary,
            color: T.white, border: 'none', borderRadius: 6, fontWeight: 600,
            fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background .15s',
          }}
        >
          {saving ? 'Guardando…' : 'Registrar entrada'}
        </button>
      </div>

      {/* History table */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.textDark, marginBottom: 16 }}>
          Historial ({data.length})
        </div>
        {loadingAll ? (
          <Skeleton rows={8} />
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: T.textMid, fontSize: '.88rem' }}>
            Sin entradas registradas aún.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Hora', 'Producto', 'Cantidad', 'Unidad', 'Proveedor', 'Lote', 'Precio/U', 'Responsable'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 100).map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 1 ? '#F9FBF9' : '#fff' }}>
                    <td style={{ ...tdSt, fontWeight: 600 }}>{r.fecha}</td>
                    <td style={{ ...tdSt, color: T.textMid }}>{r.hora || '—'}</td>
                    <td style={tdSt}>{r.producto || '—'}</td>
                    <td style={{ ...tdSt, fontWeight: 600, color: T.secondary }}>{(r.cantidad || 0).toLocaleString()}</td>
                    <td style={{ ...tdSt, color: T.textMid }}>{r.unidad || '—'}</td>
                    <td style={tdSt}>{r.proveedor || '—'}</td>
                    <td style={{ ...tdSt, color: T.textMid }}>{r.lote || '—'}</td>
                    <td style={tdSt}>Q {(r.precioUnitario || 0).toFixed(2)}</td>
                    <td style={{ ...tdSt, color: T.textMid }}>{r.responsable || '—'}</td>
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
