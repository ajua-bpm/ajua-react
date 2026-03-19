import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useProductosCatalogo, useClientes } from '../../hooks/useMainData';
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
  textAlign: 'left', whiteSpace: 'nowrap', background: T.primary,
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
  width: '100%', boxSizing: 'border-box', marginTop: 2,
};

const today = () => new Date().toISOString().slice(0, 10);
const LBS_FACTOR = 2.20462;

const BLANK = {
  fecha: today(),
  producto: '',
  origen: '',
  productor: '',
  proveedor: '',
  bultos: '',
  kgBulto: '',
  costolb: '',
  duca: '',
  cotizacion: '',
  obs: '',
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

  const { data, loading }            = useCollection('ientradas', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { productos, loading: lp }   = useProductosCatalogo();
  const { clientes, loading: lc }    = useClientes();
  const { add, remove, saving }      = useWrite('ientradas');

  const [form, setForm] = useState({ ...BLANK });
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-calc LBS
  const lbsBrutas = useMemo(() => {
    const b = parseFloat(form.bultos) || 0;
    const k = parseFloat(form.kgBulto) || 0;
    return b * k * LBS_FACTOR;
  }, [form.bultos, form.kgBulto]);

  const handleSave = async () => {
    if (!form.fecha || !form.producto || !form.bultos) {
      toast('Fecha, producto y bultos son requeridos', 'error'); return;
    }
    await add({
      fecha:      form.fecha,
      producto:   form.producto,
      origen:     form.origen,
      productor:  form.productor,
      proveedor:  form.proveedor,
      bultos:     parseFloat(form.bultos) || 0,
      kgBulto:    parseFloat(form.kgBulto) || 0,
      lbsBrutas,
      costolb:    parseFloat(form.costolb) || 0,
      duca:       form.duca,
      cotizacion: form.cotizacion,
      obs:        form.obs,
    });
    toast('Entrada registrada correctamente');
    setForm({ ...BLANK, fecha: today() });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar este registro?')) return;
    await remove(id);
    toast('Registro eliminado');
  };

  const todayStr    = today();
  const entradasHoy = data.filter(r => r.fecha === todayStr).length;
  const totalLbs    = useMemo(() => data.reduce((s, r) => s + (parseFloat(r.lbsBrutas) || 0), 0), [data]);

  const loadingAll = loading || lp || lc;

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: T.textDark }}>
          Ingresos a Bodega
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '.83rem', color: T.textMid }}>
          Registro de entradas de producto desde proveedores / campo
        </p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <MetricCard label="Entradas hoy"   value={loadingAll ? '…' : entradasHoy}                         accent={T.secondary} />
        <MetricCard label="Total registros" value={loadingAll ? '…' : data.length}                         accent={T.primary} />
        <MetricCard label="Total LBS"       value={loadingAll ? '…' : totalLbs.toLocaleString('es-GT', { maximumFractionDigits: 0 })} accent={T.warn} />
      </div>

      {/* Form */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.textDark, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #F0F0F0' }}>
          Nueva entrada
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 14, marginBottom: 16 }}>

          {/* Row 1 */}
          <label style={LS}>
            Fecha *
            <input type="date" value={form.fecha} onChange={e => s('fecha', e.target.value)} style={IS} />
          </label>
          <label style={LS}>
            Producto *
            <select value={form.producto} onChange={e => s('producto', e.target.value)} style={IS}>
              <option value="">— Seleccionar —</option>
              {productos.map(p => <option key={p.id || p.nombre} value={p.nombre}>{p.nombre}</option>)}
            </select>
          </label>
          <label style={LS}>
            Origen / Pais
            <input value={form.origen} onChange={e => s('origen', e.target.value)}
              placeholder="Guatemala, Mexico..." style={IS} />
          </label>
          <label style={LS}>
            Productor (campo/finca)
            <input value={form.productor} onChange={e => s('productor', e.target.value)}
              placeholder="Nombre del productor" style={IS} />
          </label>
          <label style={LS}>
            Proveedor / Intermediario
            <select value={form.proveedor} onChange={e => s('proveedor', e.target.value)} style={IS}>
              <option value="">— Seleccionar —</option>
              {clientes.map(c => <option key={c.id || c.nombre} value={c.nombre}>{c.nombre}</option>)}
            </select>
          </label>

          {/* Row 2 — quantities */}
          <label style={LS}>
            Bultos / Unidades recibidas *
            <input type="number" min="0" step="1" value={form.bultos}
              onChange={e => s('bultos', e.target.value)} style={IS} />
          </label>
          <label style={LS}>
            KG bruto por bulto
            <input type="number" min="0" step="0.01" value={form.kgBulto}
              onChange={e => s('kgBulto', e.target.value)} style={IS} />
          </label>
          <label style={LS}>
            LBS brutas totales (auto)
            <input
              readOnly
              value={lbsBrutas > 0 ? lbsBrutas.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
              placeholder="Bultos × kg × 2.20462"
              style={{ ...IS, background: '#F5F5F5', color: T.secondary, fontWeight: 700, cursor: 'default' }}
            />
          </label>
          <label style={LS}>
            Costo / lb (Q)
            <input type="number" min="0" step="0.01" value={form.costolb}
              onChange={e => s('costolb', e.target.value)} style={IS} />
          </label>

          {/* Row 3 — references */}
          <label style={LS}>
            No. DUCA / Referencia
            <input value={form.duca} onChange={e => s('duca', e.target.value)}
              placeholder="No. DUCA o referencia" style={IS} />
          </label>
          <label style={LS}>
            Cotizacion vinculada
            <input value={form.cotizacion} onChange={e => s('cotizacion', e.target.value)}
              placeholder="No. de cotizacion" style={IS} />
          </label>
          <label style={{ ...LS, gridColumn: 'span 2' }}>
            Observaciones
            <textarea value={form.obs} onChange={e => s('obs', e.target.value)}
              rows={2} placeholder="Condiciones de llegada, temperatura, notas..."
              style={{ ...IS, resize: 'vertical' }} />
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
            Sin entradas registradas aun.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Fecha', 'Producto', 'Origen', 'Bultos', 'LBS brutas', 'Costo/lb', 'DUCA', 'Eliminar'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 200).map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 1 ? '#F9FBF9' : '#fff' }}>
                    <td style={{ ...tdSt, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.fecha || '—'}</td>
                    <td style={tdSt}>{r.producto || '—'}</td>
                    <td style={{ ...tdSt, color: T.textMid }}>{r.origen || '—'}</td>
                    <td style={{ ...tdSt, fontWeight: 600, color: T.secondary, textAlign: 'right' }}>
                      {(r.bultos || 0).toLocaleString()}
                    </td>
                    <td style={{ ...tdSt, fontWeight: 700, color: T.primary, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {(r.lbsBrutas || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      Q {(r.costolb || 0).toFixed(2)}
                    </td>
                    <td style={{ ...tdSt, color: T.textMid }}>{r.duca || '—'}</td>
                    <td style={{ ...tdSt, textAlign: 'center' }}>
                      <button
                        onClick={() => handleDelete(r.id)}
                        style={{
                          padding: '3px 10px', background: 'none', border: `1px solid ${T.danger}`,
                          color: T.danger, borderRadius: 4, cursor: 'pointer', fontSize: '.72rem', fontWeight: 600,
                        }}
                      >
                        x
                      </button>
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
