import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useClientes, useProductosCatalogo } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ── Design tokens ─────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', danger: '#C62828',
  warn: '#E65100', textDark: '#1A1A18', textMid: '#6B6B60',
  border: '#E0E0E0', bgGreen: '#E8F5E9', white: '#FFFFFF',
  bgLight: '#F5F5F5',
};
const shadow = '0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06)';
const card   = { background: '#fff', borderRadius: 8, boxShadow: shadow, padding: 20, marginBottom: 20 };
const thSt   = { color: T.white, padding: '10px 14px', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'left', whiteSpace: 'nowrap' };
const tdSt   = { padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', color: T.textDark };
const LS     = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em' };
const IS     = { padding: '9px 12px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.88rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

// ── Helpers ───────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const fmt   = n  => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 });

function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Constants ─────────────────────────────────────────────────────
const TIPOS = [
  { value: 'mercado',      label: 'Mercado / Mayorista' },
  { value: 'distribuidor', label: 'Distribuidor / Lote' },
  { value: 'restaurante',  label: 'Restaurante / Negocio' },
  { value: 'mayorista',    label: 'Mayorista especial' },
];

const FORMAS_PAGO = ['Efectivo', 'Cheque', 'Transferencia', 'Credito'];

const UNIDADES = ['lb', 'quintal', 'arroba', 'caja', 'bulto', 'unidad', 'kg', 'lote'];

const BADGE_CFG = {
  pendiente: { bg: '#FFF3E0', c: '#E65100',  label: 'Pendiente' },
  entregado: { bg: '#E3F2FD', c: '#1565C0',  label: 'Entregado' },
  cobrado:   { bg: '#E8F5E9', c: '#2E7D32',  label: 'Cobrado'   },
  cancelado: { bg: '#FFEBEE', c: '#C62828',  label: 'Cancelado' },
};

const FILTER_TABS = ['todos', 'pendiente', 'entregado', 'cobrado', 'cancelado'];

const BLANK_IT = { producto: '', cantidad: '', unidad: 'lb', precioUnit: '' };
const BLANK = {
  fecha: today(), cliente: '', tipo: 'mercado', productos: [{ ...BLANK_IT }],
  formaPago: 'Efectivo', diasCredito: '', numFel: '', estado: 'pendiente', obs: '', fotoUrl: '',
};

// ── Status badge ──────────────────────────────────────────────────
function Badge({ estado }) {
  const b = BADGE_CFG[estado] || { bg: '#F5F5F5', c: '#6B6B60', label: estado || '—' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600, background: b.bg, color: b.c, whiteSpace: 'nowrap' }}>
      {b.label}
    </span>
  );
}

// ── MetricCard ────────────────────────────────────────────────────
function MetricCard({ label, value, accent }) {
  return (
    <div style={{ ...card, marginBottom: 0, flex: '1 1 150px', borderTop: `3px solid ${accent || T.primary}` }}>
      <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMid, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.45rem', fontWeight: 700, color: accent || T.textDark, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

// ── Products table ────────────────────────────────────────────────
function ProductosTable({ productos, catalogo, onChange }) {
  const add    = () => onChange([...productos, { ...BLANK_IT }]);
  const remove = i  => onChange(productos.filter((_, j) => j !== i));
  const set    = (i, k, v) => onChange(productos.map((p, j) => j === i ? { ...p, [k]: v } : p));

  const total = productos.reduce((s, p) => s + (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnit) || 0), 0);

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 90px 90px 100px 90px 28px', background: T.bgGreen, padding: '8px 10px', fontSize: '.7rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        <span>Producto</span><span>Cantidad</span><span>Unidad</span><span>Precio/U Q</span><span style={{ textAlign: 'right' }}>Subtotal</span><span />
      </div>
      {productos.map((p, i) => {
        const sub = (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnit) || 0);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 90px 90px 100px 90px 28px', padding: '6px 10px', borderTop: `1px solid #F0F0F0`, alignItems: 'center', gap: 6 }}>
            <select value={p.producto} onChange={e => set(i, 'producto', e.target.value)} style={{ ...IS, fontSize: '.82rem', padding: '5px 7px' }}>
              <option value="">— Producto —</option>
              {catalogo.map(c => <option key={c.id || c.nombre} value={c.nombre}>{c.nombre}</option>)}
            </select>
            <input type="number" min="0" step="0.01" value={p.cantidad} onChange={e => set(i, 'cantidad', e.target.value)}
              placeholder="0" style={{ ...IS, fontSize: '.82rem', padding: '5px 7px' }} />
            <select value={p.unidad} onChange={e => set(i, 'unidad', e.target.value)} style={{ ...IS, fontSize: '.82rem', padding: '5px 7px' }}>
              {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input type="number" min="0" step="0.01" value={p.precioUnit} onChange={e => set(i, 'precioUnit', e.target.value)}
              placeholder="0.00" style={{ ...IS, fontSize: '.82rem', padding: '5px 7px' }} />
            <span style={{ fontSize: '.83rem', fontWeight: 700, color: T.secondary, textAlign: 'right', paddingRight: 4 }}>
              Q {fmt(sub)}
            </span>
            {productos.length > 1 && (
              <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: T.danger, cursor: 'pointer', fontWeight: 700, fontSize: '1rem', padding: 0 }}>×</button>
            )}
          </div>
        );
      })}
      <div style={{ padding: '8px 10px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
        <button onClick={add} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, padding: '5px 12px', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', color: T.textMid }}>
          + Agregar producto
        </button>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: T.primary }}>Total: Q {fmt(total)}</div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function VentasGT() {
  const toast = useToast();

  const { data, loading }              = useCollection('vgtVentas', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { clientes, loading: loadCli } = useClientes();
  const { productos: catalogo, loading: loadProd } = useProductosCatalogo();
  const { add, update, saving }        = useWrite('vgtVentas');

  const [form, setForm]     = useState({ ...BLANK, productos: [{ ...BLANK_IT }] });
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState('todos');

  const s  = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // IVA calculation
  const subtotalBruto  = form.productos.reduce((sum, p) => sum + (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnit) || 0), 0);
  const base           = subtotalBruto / 1.12;
  const iva            = base * 0.12;

  // fechaVencimiento auto
  const fechaVenc = form.formaPago === 'Credito' && form.diasCredito && form.fecha
    ? addDays(form.fecha, parseInt(form.diasCredito) || 0)
    : '';

  const handleFoto = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => s('fotoUrl', ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.fecha || !form.cliente) { toast('Fecha y cliente son requeridos', 'error'); return; }
    if (!form.productos.some(p => p.producto && p.cantidad)) { toast('Agrega al menos un producto con cantidad', 'error'); return; }
    const payload = {
      ...form,
      productos: form.productos.map(p => ({
        ...p,
        cantidad: parseFloat(p.cantidad) || 0,
        precioUnit: parseFloat(p.precioUnit) || 0,
        subtotal: (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnit) || 0),
      })),
      subtotal: subtotalBruto,
      iva: parseFloat(iva.toFixed(2)),
      total: subtotalBruto,
      diasCredito: parseInt(form.diasCredito) || 0,
      fechaVencimiento: fechaVenc,
      creadoEn: new Date().toISOString(),
    };
    try {
      if (editId) { await update(editId, payload); toast('Venta actualizada'); setEditId(null); }
      else        { await add(payload); toast('Venta GT registrada'); }
      setForm({ ...BLANK, productos: [{ ...BLANK_IT }] });
    } catch { toast('Error al guardar', 'error'); }
  };

  const startEdit = r => {
    setForm({
      fecha:       r.fecha || today(),
      cliente:     r.cliente || '',
      tipo:        r.tipo || 'mercado',
      productos:   r.productos?.length ? r.productos : [{ ...BLANK_IT }],
      formaPago:   r.formaPago || 'Efectivo',
      diasCredito: r.diasCredito || '',
      numFel:      r.numFel || '',
      estado:      r.estado || 'pendiente',
      obs:         r.obs || '',
      fotoUrl:     r.fotoUrl || '',
    });
    setEditId(r.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit    = () => { setForm({ ...BLANK, productos: [{ ...BLANK_IT }] }); setEditId(null); };
  const cambiarEstado = async (id, estado) => {
    try { await update(id, { estado }); toast(`Estado: ${BADGE_CFG[estado]?.label || estado}`); }
    catch { toast('Error al actualizar', 'error'); }
  };

  const filtered = filter === 'todos' ? data : data.filter(r => r.estado === filter);

  const totalVentas = useMemo(() => data.filter(r => r.estado !== 'cancelado').reduce((s, r) => s + (r.total || 0), 0), [data]);
  const pendientes  = data.filter(r => r.estado === 'pendiente').length;
  const cobrado     = useMemo(() => data.filter(r => r.estado === 'cobrado').reduce((s, r) => s + (r.total || 0), 0), [data]);

  const loadingAll = loading || loadCli || loadProd;

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: T.textDark }}>Despachos — Mercado Local Guatemala</h2>
        <p style={{ margin: '4px 0 0', fontSize: '.83rem', color: T.textMid }}>
          Mercado mayorista, distribuidores, restaurantes y mayoristas
        </p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <MetricCard label="Total ventas GTQ" value={`Q ${fmt(totalVentas)}`} accent={T.secondary} />
        <MetricCard label="Pendientes"        value={pendientes}              accent={T.warn} />
        <MetricCard label="Cobrado GTQ"       value={`Q ${fmt(cobrado)}`}    accent={T.primary} />
        <MetricCard label="Total registros"   value={data.length}            accent={T.textMid} />
      </div>

      {/* Form */}
      <div style={{ ...card, borderLeft: `4px solid ${editId ? T.warn : T.primary}` }}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.textDark, marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
          {editId ? 'Editar venta GT' : 'Registrar Despacho Local'}
        </div>

        {/* Tipo selector */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em', marginBottom: 10 }}>Tipo de venta</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TIPOS.map(t => (
              <label key={t.value} style={{ cursor: 'pointer' }}>
                <input type="radio" name="vgt-tipo" value={t.value} checked={form.tipo === t.value} onChange={() => s('tipo', t.value)} style={{ display: 'none' }} />
                <div style={{
                  padding: '8px 14px', borderRadius: 6, fontSize: '.78rem', fontWeight: 600,
                  border: `2px solid ${form.tipo === t.value ? T.primary : T.border}`,
                  background: form.tipo === t.value ? T.bgGreen : '#fff',
                  color: form.tipo === t.value ? T.primary : T.textMid,
                  cursor: 'pointer',
                }}>
                  {t.label}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 16 }}>
          <label style={LS}>Fecha *<input type="date" value={form.fecha} onChange={e => s('fecha', e.target.value)} style={IS} /></label>
          <label style={LS}>
            Cliente *
            <select value={form.cliente} onChange={e => s('cliente', e.target.value)} style={IS}>
              <option value="">— Seleccionar —</option>
              {clientes.map(c => <option key={c.id || c.nombre} value={c.nombre}>{c.nombre}</option>)}
            </select>
          </label>
          <label style={LS}>
            Forma de pago
            <select value={form.formaPago} onChange={e => s('formaPago', e.target.value)} style={IS}>
              {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          {form.formaPago === 'Credito' && (
            <label style={LS}>Dias de credito<input type="number" min="0" value={form.diasCredito} onChange={e => s('diasCredito', e.target.value)} placeholder="0" style={IS} /></label>
          )}
          {form.formaPago === 'Credito' && fechaVenc && (
            <label style={LS}>Fecha vencimiento<input type="date" value={fechaVenc} readOnly style={{ ...IS, background: T.bgGreen, color: T.primary, fontWeight: 600 }} /></label>
          )}
          <label style={LS}>No. FEL<input value={form.numFel} onChange={e => s('numFel', e.target.value)} placeholder="Factura electronica" style={IS} /></label>
          <label style={LS}>
            Estado
            <select value={form.estado} onChange={e => s('estado', e.target.value)} style={IS}>
              {Object.entries(BADGE_CFG).map(([v, b]) => <option key={v} value={v}>{b.label}</option>)}
            </select>
          </label>
        </div>

        {/* Products */}
        <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em', marginBottom: 10 }}>Productos</div>
        <ProductosTable
          productos={form.productos}
          catalogo={catalogo}
          onChange={prods => s('productos', prods)}
        />

        {/* IVA summary */}
        {subtotalBruto > 0 && (
          <div style={{ background: T.bgGreen, border: `1px solid ${T.secondary}`, borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: '.82rem' }}>
            <span style={{ marginRight: 20 }}>Subtotal (base): <strong>Q {fmt(base)}</strong></span>
            <span style={{ marginRight: 20, color: T.warn }}>IVA 12%: <strong>Q {fmt(iva)}</strong></span>
            <span style={{ color: T.primary, fontWeight: 700 }}>Total: <strong>Q {fmt(subtotalBruto)}</strong></span>
          </div>
        )}

        {/* Photo */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em', marginBottom: 8 }}>Foto (opcional)</div>
          <input type="file" accept="image/*" capture="environment" onChange={handleFoto}
            style={{ fontSize: '.82rem' }} />
          {form.fotoUrl && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={form.fotoUrl} alt="foto" style={{ height: 80, borderRadius: 6, border: `1px solid ${T.border}` }} />
              <button onClick={() => s('fotoUrl', '')}
                style={{ padding: '4px 10px', background: '#FFEBEE', color: T.danger, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>
                Quitar
              </button>
            </div>
          )}
        </div>

        <label style={{ ...LS, marginBottom: 16 }}>
          Observaciones
          <textarea value={form.obs} onChange={e => s('obs', e.target.value)} rows={2}
            style={{ ...IS, resize: 'vertical' }} placeholder="Notas de la venta..." />
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '11px 28px', background: saving ? T.border : (editId ? T.warn : T.primary), color: T.white, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Guardando…' : editId ? 'Actualizar venta' : 'Registrar Despacho'}
          </button>
          {editId && (
            <button onClick={cancelEdit}
              style={{ padding: '11px 20px', background: T.bgLight, border: `1px solid ${T.border}`, borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: 'pointer', color: T.textMid }}>
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
          {FILTER_TABS.map(ft => (
            <button key={ft} onClick={() => setFilter(ft)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: '.75rem', fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${filter === ft ? T.primary : T.border}`,
              background: filter === ft ? T.primary : T.white,
              color: filter === ft ? T.white : T.textMid,
            }}>
              {ft === 'todos' ? 'Todos' : BADGE_CFG[ft]?.label || ft}
            </button>
          ))}
        </div>

        {loadingAll ? <Skeleton rows={8} /> : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: T.textMid, fontSize: '.88rem' }}>
            Sin ventas {filter !== 'todos' ? `con estado "${BADGE_CFG[filter]?.label}"` : 'registradas'} aun.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Cliente', 'Tipo', 'Total', 'IVA', 'FEL', 'Estado', 'Vence', 'Acciones'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((r, i) => {
                  const tipoLabel = TIPOS.find(t => t.value === r.tipo)?.label || r.tipo || '—';
                  const ivaVal = r.iva || (r.total ? r.total / 1.12 * 0.12 : 0);
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 1 ? '#F9FBF9' : '#fff' }}>
                      <td style={{ ...tdSt, fontWeight: 600 }}>{r.fecha}</td>
                      <td style={tdSt}>{r.cliente || '—'}</td>
                      <td style={{ ...tdSt, fontSize: '.78rem', color: T.textMid }}>{tipoLabel}</td>
                      <td style={{ ...tdSt, fontWeight: 700, color: T.primary }}>Q {fmt(r.total)}</td>
                      <td style={{ ...tdSt, fontSize: '.78rem', color: T.textMid }}>Q {fmt(ivaVal)}</td>
                      <td style={{ ...tdSt, fontSize: '.78rem', fontFamily: 'monospace', color: r.numFel ? T.secondary : T.textMid }}>
                        {r.numFel || <em style={{ opacity: .6 }}>—</em>}
                      </td>
                      <td style={tdSt}><Badge estado={r.estado} /></td>
                      <td style={{ ...tdSt, fontSize: '.78rem', color: r.fechaVencimiento ? T.warn : T.textMid }}>
                        {r.fechaVencimiento || '—'}
                      </td>
                      <td style={tdSt}>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <button onClick={() => startEdit(r)}
                            style={{ padding: '4px 10px', background: T.secondary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>
                            Editar
                          </button>
                          {r.estado === 'pendiente' && (
                            <button onClick={() => cambiarEstado(r.id, 'entregado')}
                              style={{ padding: '4px 10px', background: '#1565C0', color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>
                              Entregar
                            </button>
                          )}
                          {r.estado === 'entregado' && (
                            <button onClick={() => cambiarEstado(r.id, 'cobrado')}
                              style={{ padding: '4px 10px', background: T.primary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>
                              Cobrar
                            </button>
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
