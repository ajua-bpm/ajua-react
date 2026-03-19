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
const DESTINOS  = ['Walmart', 'Mercado local', 'Exportación', 'Maquila', 'Merma', 'Devolución', 'Otro'];

const today   = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

const BLANK = {
  fecha: today(), hora: nowTime(), producto: '', cantidad: '',
  unidad: 'lb', destino: '', destinoOtro: '', responsable: '', obs: '',
};

// ── Destino badge ────────────────────────────────────────────────
const DEST_COLORS = {
  'Walmart':       { bg: '#E3F2FD', c: '#1565C0' },
  'Exportación':   { bg: '#F3E5F5', c: '#6A1B9A' },
  'Maquila':       { bg: '#FFF8E1', c: '#F57F17' },
  'Mercado local': { bg: '#E8F5E9', c: '#2E7D32' },
  'Merma':         { bg: '#FFEBEE', c: '#C62828' },
  'Devolución':    { bg: '#FBE9E7', c: '#BF360C' },
};
function DestBadge({ destino }) {
  const d = DEST_COLORS[destino] || { bg: '#F5F5F5', c: '#6B6B60' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600, background: d.bg, color: d.c }}>
      {destino || '—'}
    </span>
  );
}

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
export default function SalidaBodega() {
  const toast = useToast();

  const { data, loading }               = useCollection('isalidas', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { productos, loading: loadProd } = useProductosCatalogo();
  const { empleados, loading: loadEmp } = useEmpleados();
  const { add, saving }                  = useWrite('isalidas');

  const [form, setForm] = useState({ ...BLANK });
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.fecha || !form.producto || !form.cantidad || !form.destino) {
      toast('Fecha, producto, cantidad y destino son requeridos', 'error'); return;
    }
    const destinoFinal = form.destino === 'Otro' ? (form.destinoOtro || 'Otro') : form.destino;
    await add({
      fecha:       form.fecha,
      hora:        form.hora,
      producto:    form.producto,
      cantidad:    parseFloat(form.cantidad) || 0,
      unidad:      form.unidad,
      destino:     destinoFinal,
      responsable: form.responsable,
      obs:         form.obs,
    });
    toast('Salida registrada correctamente');
    setForm(f => ({ ...f, producto: '', cantidad: '', destino: '', destinoOtro: '', responsable: '', obs: '' }));
  };

  const todayStr   = today();
  const salidasHoy = data.filter(r => r.fecha === todayStr).length;
  const totalUnids = useMemo(() => data.reduce((s, r) => s + (parseFloat(r.cantidad) || 0), 0), [data]);

  const loadingAll = loading || loadProd || loadEmp;

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: T.textDark }}>
          Salidas de Bodega
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '.83rem', color: T.textMid }}>
          Registro de despachos y salidas de producto
        </p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <MetricCard label="Salidas hoy"    value={loadingAll ? '…' : salidasHoy} accent={T.danger} />
        <MetricCard label="Total registros" value={loadingAll ? '…' : data.length}  accent={T.primary} />
        <MetricCard label="Total unidades"  value={loadingAll ? '…' : totalUnids.toLocaleString()} accent={T.warn} />
      </div>

      {/* Form */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.textDark, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #F0F0F0' }}>
          Nueva salida
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
            Destino *
            <select value={form.destino} onChange={e => s('destino', e.target.value)} style={IS}>
              <option value="">— Seleccionar —</option>
              {DESTINOS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          {form.destino === 'Otro' && (
            <label style={LS}>
              Especificar destino
              <input value={form.destinoOtro} onChange={e => s('destinoOtro', e.target.value)}
                placeholder="Describe el destino" style={IS} />
            </label>
          )}
          <label style={LS}>
            Responsable
            <select value={form.responsable} onChange={e => s('responsable', e.target.value)} style={IS}>
              <option value="">— Seleccionar —</option>
              {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </label>
        </div>
        <label style={{ ...LS, marginBottom: 16 }}>
          Observaciones
          <textarea
            value={form.obs}
            onChange={e => s('obs', e.target.value)}
            rows={2}
            placeholder="Motivo, nota adicional…"
            style={{ ...IS, resize: 'vertical' }}
          />
        </label>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '11px 28px', background: saving ? T.border : T.danger,
            color: T.white, border: 'none', borderRadius: 6, fontWeight: 600,
            fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Guardando…' : 'Registrar salida'}
        </button>
      </div>

      {/* History */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.textDark, marginBottom: 16 }}>
          Historial ({data.length})
        </div>
        {loadingAll ? (
          <Skeleton rows={8} />
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: T.textMid, fontSize: '.88rem' }}>
            Sin salidas registradas aún.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Hora', 'Producto', 'Cantidad', 'Unidad', 'Destino', 'Responsable'].map(h => (
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
                    <td style={{ ...tdSt, fontWeight: 600, color: T.danger }}>{(r.cantidad || 0).toLocaleString()}</td>
                    <td style={{ ...tdSt, color: T.textMid }}>{r.unidad || '—'}</td>
                    <td style={tdSt}><DestBadge destino={r.destino} /></td>
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
