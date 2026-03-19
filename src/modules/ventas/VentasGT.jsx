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

// ── Status badge ─────────────────────────────────────────────────
const BADGE = {
  pendiente:  { bg: '#FFF3E0', c: '#E65100' },
  entregado:  { bg: '#E3F2FD', c: '#1565C0' },
  cobrado:    { bg: '#E8F5E9', c: '#1B5E20' },
  cancelado:  { bg: '#FFEBEE', c: '#C62828' },
};
const ESTADO_LABEL = {
  pendiente: 'Pendiente', entregado: 'Entregado', cobrado: 'Cobrado', cancelado: 'Cancelado',
};
function Badge({ s }) {
  const b = BADGE[s] || { bg: '#F5F5F5', c: '#6B6B60' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600, background: b.bg, color: b.c, whiteSpace: 'nowrap' }}>
      {ESTADO_LABEL[s] || s || '—'}
    </span>
  );
}

// ── Helpers ──────────────────────────────────────────────────────
const today     = () => new Date().toISOString().slice(0, 10);
const fmt       = n  => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 });
const UNIDADES  = ['lb', 'kg', 'caja', 'unidad'];
const BLANK_IT  = { producto: '', cantidad: '', unidad: 'lb', precioUnitario: '' };
const BLANK     = { fecha: today(), cliente: '', numFel: '', estado: 'pendiente', items: [{ ...BLANK_IT }], obs: '' };

const calcTotal = items =>
  items.reduce((s, it) => s + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precioUnitario) || 0), 0);

// ── Metric card ──────────────────────────────────────────────────
function MetricCard({ label, value, sub, accent }) {
  return (
    <div style={{ ...card, marginBottom: 0, flex: '1 1 155px', borderTop: `3px solid ${accent || T.primary}` }}>
      <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMid, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.55rem', fontWeight: 700, color: accent || T.textDark, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '.75rem', color: T.textMid, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export default function VentasGT() {
  const toast = useToast();

  const { data, loading }               = useCollection('vgtVentas', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { clientes, loading: loadCli }  = useClientes();
  const { productos, loading: loadProd } = useProductosCatalogo();
  const { add, update, saving }          = useWrite('vgtVentas');

  const [form, setForm]     = useState({ ...BLANK, items: [{ ...BLANK_IT }] });
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState('todos');

  const s  = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const si = (i, k, v) => setForm(f => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it) }));
  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, { ...BLANK_IT }] }));
  const removeItem = i  => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }));

  const handleSave = async () => {
    if (!form.fecha || !form.cliente || form.items.length === 0) {
      toast('Fecha, cliente e ítems son requeridos', 'error'); return;
    }
    const total = calcTotal(form.items);
    const payload = { ...form, total };
    if (editId) {
      await update(editId, payload);
      toast('Venta actualizada');
      setEditId(null);
    } else {
      await add(payload);
      toast('Venta GT registrada');
    }
    setForm({ ...BLANK, items: [{ ...BLANK_IT }] });
  };

  const startEdit = r => {
    setForm({
      fecha:   r.fecha || today(),
      cliente: r.cliente || '',
      numFel:  r.numFel || '',
      estado:  r.estado || 'pendiente',
      items:   r.items?.length ? r.items : [{ ...BLANK_IT }],
      obs:     r.obs || '',
    });
    setEditId(r.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => { setForm({ ...BLANK, items: [{ ...BLANK_IT }] }); setEditId(null); };

  const cambiarEstado = async (id, estado) => {
    await update(id, { estado });
    toast(`Estado actualizado → ${ESTADO_LABEL[estado]}`);
  };

  const filtered = filter === 'todos' ? data : data.filter(r => r.estado === filter);

  const totalVentas   = useMemo(() => data.filter(r => r.estado !== 'cancelado').reduce((s, r) => s + (r.total || 0), 0), [data]);
  const pendientes    = data.filter(r => r.estado === 'pendiente').length;
  const cobrado       = useMemo(() => data.filter(r => r.estado === 'cobrado').reduce((s, r) => s + (r.total || 0), 0), [data]);

  const loadingAll = loading || loadCli || loadProd;

  const FILTER_TABS = ['todos', 'pendiente', 'entregado', 'cobrado', 'cancelado'];

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: T.textDark }}>
          Despachos — Mercado Local GT
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '.83rem', color: T.textMid }}>
          Ventas y despachos en el mercado local guatemalteco
        </p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <MetricCard label="Total ventas GTQ" value={`Q ${fmt(totalVentas)}`} accent={T.secondary} />
        <MetricCard label="Pendientes"        value={pendientes} accent={T.warn} />
        <MetricCard label="Cobrado GTQ"       value={`Q ${fmt(cobrado)}`} accent={T.primary} />
      </div>

      {/* Form */}
      <div style={{ ...card, borderLeft: `4px solid ${editId ? T.warn : T.primary}` }}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.textDark, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #F0F0F0' }}>
          {editId ? 'Editar venta' : 'Nueva venta GT'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 14, marginBottom: 16 }}>
          <label style={LS}>
            Fecha
            <input type="date" value={form.fecha} onChange={e => s('fecha', e.target.value)} style={IS} />
          </label>
          <label style={LS}>
            Cliente *
            <select value={form.cliente} onChange={e => s('cliente', e.target.value)} style={IS}>
              <option value="">— Seleccionar —</option>
              {clientes.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
            </select>
          </label>
          <label style={LS}>
            Número FEL
            <input value={form.numFel} onChange={e => s('numFel', e.target.value)}
              placeholder="Factura electrónica" style={IS} />
          </label>
          <label style={LS}>
            Estado
            <select value={form.estado} onChange={e => s('estado', e.target.value)} style={IS}>
              {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>

        {/* Items */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em', marginBottom: 10 }}>
            Productos / Ítems
          </div>
          <div style={{ border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden' }}>
            {/* Items header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 1fr 90px 32px', gap: 0, background: '#F5F5F5', padding: '7px 10px', fontSize: '.72rem', fontWeight: 600, color: T.textMid, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              <span>Producto</span><span>Cantidad</span><span>Unidad</span><span>Precio/U (Q)</span><span style={{ textAlign: 'right' }}>Subtotal</span><span />
            </div>
            {form.items.map((it, i) => {
              const sub = (parseFloat(it.cantidad) || 0) * (parseFloat(it.precioUnitario) || 0);
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 1fr 90px 32px', gap: 0, padding: '6px 10px', borderTop: '1px solid #F0F0F0', alignItems: 'center' }}>
                  <select value={it.producto} onChange={e => si(i, 'producto', e.target.value)}
                    style={{ ...IS, fontSize: '.82rem', padding: '6px 8px', marginRight: 6 }}>
                    <option value="">— Producto —</option>
                    {productos.map(p => <option key={p.id || p.nombre} value={p.nombre}>{p.nombre}</option>)}
                  </select>
                  <input type="number" min="0" step="0.01" value={it.cantidad} placeholder="0"
                    onChange={e => si(i, 'cantidad', e.target.value)}
                    style={{ ...IS, fontSize: '.82rem', padding: '6px 8px', marginRight: 6 }} />
                  <select value={it.unidad} onChange={e => si(i, 'unidad', e.target.value)}
                    style={{ ...IS, fontSize: '.82rem', padding: '6px 8px', marginRight: 6 }}>
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input type="number" min="0" step="0.01" value={it.precioUnitario} placeholder="0.00"
                    onChange={e => si(i, 'precioUnitario', e.target.value)}
                    style={{ ...IS, fontSize: '.82rem', padding: '6px 8px', marginRight: 6 }} />
                  <span style={{ fontSize: '.83rem', fontWeight: 700, color: T.secondary, textAlign: 'right', paddingRight: 6 }}>
                    Q {fmt(sub)}
                  </span>
                  {form.items.length > 1 && (
                    <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: T.danger, cursor: 'pointer', fontWeight: 700, fontSize: '1rem', padding: 0 }}>×</button>
                  )}
                </div>
              );
            })}
            <div style={{ padding: '8px 10px', borderTop: '1px solid #E0E0E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
              <button onClick={addItem} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, padding: '5px 12px', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', color: T.textMid }}>
                + Agregar ítem
              </button>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: T.primary }}>
                Total: Q {fmt(calcTotal(form.items))}
              </div>
            </div>
          </div>
        </div>

        <label style={{ ...LS, marginBottom: 16 }}>
          Observaciones
          <textarea value={form.obs} onChange={e => s('obs', e.target.value)} rows={2}
            style={{ ...IS, resize: 'vertical' }} />
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '11px 24px', background: saving ? T.border : (editId ? T.warn : T.primary), color: T.white, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Guardando…' : editId ? 'Actualizar venta' : 'Registrar venta'}
          </button>
          {editId && (
            <button onClick={cancelEdit} style={{ padding: '11px 20px', background: T.bgLight, border: `1px solid ${T.border}`, borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: 'pointer', color: T.textMid }}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.textDark, marginRight: 4 }}>
            Historial ({filtered.length})
          </div>
          {FILTER_TABS.map(tab => (
            <button key={tab} onClick={() => setFilter(tab)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: '.75rem', fontWeight: 600,
              cursor: 'pointer', border: `1.5px solid ${filter === tab ? T.primary : T.border}`,
              background: filter === tab ? T.primary : T.white,
              color: filter === tab ? T.white : T.textMid,
            }}>
              {tab === 'todos' ? 'Todos' : ESTADO_LABEL[tab]}
            </button>
          ))}
        </div>

        {loadingAll ? (
          <Skeleton rows={8} />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: T.textMid, fontSize: '.88rem' }}>
            Sin ventas {filter !== 'todos' ? `con estado "${ESTADO_LABEL[filter]}"` : 'registradas'} aún.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Cliente', 'FEL', 'Ítems', 'Total', 'Estado', 'Acciones'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 1 ? '#F9FBF9' : '#fff' }}>
                    <td style={{ ...tdSt, fontWeight: 600 }}>{r.fecha}</td>
                    <td style={tdSt}>{r.cliente || '—'}</td>
                    <td style={{ ...tdSt, color: T.textMid, fontSize: '.78rem', fontFamily: 'monospace' }}>{r.numFel || '—'}</td>
                    <td style={{ ...tdSt, color: T.textMid }}>
                      {(r.items || []).length} prod.
                      <div style={{ fontSize: '.7rem', color: '#6B6B60', marginTop: 1 }}>
                        {(r.items || []).slice(0, 2).map(it => it.producto).filter(Boolean).join(', ')}
                        {(r.items || []).length > 2 ? '…' : ''}
                      </div>
                    </td>
                    <td style={{ ...tdSt, fontWeight: 700, color: T.primary }}>Q {fmt(r.total)}</td>
                    <td style={tdSt}><Badge s={r.estado} /></td>
                    <td style={tdSt}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <button onClick={() => startEdit(r)} style={{ padding: '4px 10px', background: T.secondary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Editar</button>
                        {r.estado === 'pendiente' && (
                          <button onClick={() => cambiarEstado(r.id, 'entregado')} style={{ padding: '4px 10px', background: '#1565C0', color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Entregar</button>
                        )}
                        {r.estado === 'entregado' && (
                          <button onClick={() => cambiarEstado(r.id, 'cobrado')} style={{ padding: '4px 10px', background: T.primary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Cobrar</button>
                        )}
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
