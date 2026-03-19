import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useProductosCatalogo } from '../../hooks/useMainData';
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
const fmt   = (n, dec = 2) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: dec });

// ── Constants ─────────────────────────────────────────────────────
const PAISES = [
  { value: 'Mexico',         label: 'Mexico', flag: '' },
  { value: 'El Salvador',    label: 'El Salvador', flag: '' },
  { value: 'Honduras',       label: 'Honduras', flag: '' },
  { value: 'Costa Rica',     label: 'Costa Rica', flag: '' },
  { value: 'Estados Unidos', label: 'Estados Unidos', flag: '' },
  { value: 'Otro',           label: 'Otro', flag: '' },
];

const MONEDAS = ['MXN', 'USD', 'GTQ'];

const TIPOS_OP = [
  { value: 'Contenedor completo',    label: 'Contenedor completo' },
  { value: 'Parcial con transporte', label: 'Parcial con transporte' },
  { value: 'Solo producto',          label: 'Solo producto' },
  { value: 'Frontera MX',            label: 'Frontera MX' },
];

const INCLUYE_OPTS = ['Producto', 'Transporte', 'Papeleria', 'Aduana'];

const FORMAS_PAGO = ['Transferencia', 'OSMO', 'Cash', 'Credito'];

const UNIDADES = ['lb', 'kg', 'caja', 'unidad', 'quintal', 'bulto'];

const BADGE_CFG = {
  pendiente:   { bg: '#FFF3E0', c: '#E65100',  label: 'Pendiente'   },
  en_transito: { bg: '#E3F2FD', c: '#1565C0',  label: 'En Transito' },
  entregado:   { bg: '#E8F5E9', c: '#2E7D32',  label: 'Entregado'   },
  cobrado:     { bg: '#E8F5E9', c: '#1B5E20',  label: 'Cobrado'     },
  cancelado:   { bg: '#FFEBEE', c: '#C62828',  label: 'Cancelado'   },
};

const FILTER_TABS = ['todos', 'pendiente', 'en_transito', 'entregado', 'cobrado', 'cancelado'];

const BLANK_PROD = { producto: '', cantidad: '', unidad: 'lb', precioMoneda: '' };
const BLANK = {
  fecha: today(), pais: 'Mexico', moneda: 'MXN', tc: '',
  tipoOperacion: 'Contenedor completo', placa: '', cartaPorte: '', ducaRef: '',
  incluye: ['Producto'],
  productos: [{ ...BLANK_PROD }],
  formaPago: 'Transferencia', numFel: '',
  estado: 'pendiente', obs: '', fotoUrl: '',
};

// ── Badge ─────────────────────────────────────────────────────────
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
function ProductosTable({ productos, catalogo, moneda, tc, onChange }) {
  const add    = () => onChange([...productos, { ...BLANK_PROD }]);
  const remove = i  => onChange(productos.filter((_, j) => j !== i));
  const set    = (i, k, v) => onChange(productos.map((p, j) => j === i ? { ...p, [k]: v } : p));

  const tcNum = parseFloat(tc) || 0;

  const totalMoneda = productos.reduce((s, p) => s + (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioMoneda) || 0), 0);
  const totalGTQ    = moneda !== 'GTQ' && tcNum > 0 ? totalMoneda * tcNum : (moneda === 'GTQ' ? totalMoneda : 0);

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 90px 90px 110px 110px 110px 28px', background: T.bgGreen, padding: '8px 10px', fontSize: '.7rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        <span>Producto</span>
        <span>Cantidad</span>
        <span>Unidad</span>
        <span>Precio ({moneda})</span>
        <span style={{ textAlign: 'right' }}>Subtotal {moneda}</span>
        <span style={{ textAlign: 'right' }}>Subtotal GTQ</span>
        <span />
      </div>
      {productos.map((p, i) => {
        const subMoneda = (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioMoneda) || 0);
        const subGTQ    = moneda !== 'GTQ' && tcNum > 0 ? subMoneda * tcNum : (moneda === 'GTQ' ? subMoneda : 0);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 90px 90px 110px 110px 110px 28px', padding: '6px 10px', borderTop: `1px solid #F0F0F0`, alignItems: 'center', gap: 6 }}>
            <select value={p.producto} onChange={e => set(i, 'producto', e.target.value)} style={{ ...IS, fontSize: '.82rem', padding: '5px 7px' }}>
              <option value="">— Producto —</option>
              {catalogo.map(c => <option key={c.id || c.nombre} value={c.nombre}>{c.nombre}</option>)}
            </select>
            <input type="number" min="0" step="0.01" value={p.cantidad} onChange={e => set(i, 'cantidad', e.target.value)}
              placeholder="0" style={{ ...IS, fontSize: '.82rem', padding: '5px 7px' }} />
            <select value={p.unidad} onChange={e => set(i, 'unidad', e.target.value)} style={{ ...IS, fontSize: '.82rem', padding: '5px 7px' }}>
              {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input type="number" min="0" step="0.01" value={p.precioMoneda} onChange={e => set(i, 'precioMoneda', e.target.value)}
              placeholder="0.00" style={{ ...IS, fontSize: '.82rem', padding: '5px 7px' }} />
            <span style={{ fontSize: '.83rem', fontWeight: 700, color: T.secondary, textAlign: 'right', paddingRight: 4 }}>
              {moneda} {fmt(subMoneda)}
            </span>
            <span style={{ fontSize: '.83rem', color: T.textMid, textAlign: 'right', paddingRight: 4 }}>
              {subGTQ > 0 ? `Q ${fmt(subGTQ)}` : '—'}
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
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.secondary }}>
            {moneda} {fmt(totalMoneda)}
          </div>
          {totalGTQ > 0 && (
            <div style={{ fontSize: '.85rem', color: T.textMid }}>
              = Q {fmt(totalGTQ)} GTQ
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function VentasInt() {
  const toast = useToast();

  const { data, loading }              = useCollection('vintVentas', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { productos: catalogo, loading: loadProd } = useProductosCatalogo();
  const { add, update, saving }        = useWrite('vintVentas');

  const [form, setForm]     = useState({ ...BLANK, productos: [{ ...BLANK_PROD }] });
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState('todos');

  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleIncluye = val => setForm(f => ({
    ...f,
    incluye: f.incluye.includes(val) ? f.incluye.filter(x => x !== val) : [...f.incluye, val],
  }));

  // Totals
  const tcNum       = parseFloat(form.tc) || 0;
  const totalMoneda = form.productos.reduce((s, p) => s + (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioMoneda) || 0), 0);
  const totalGTQ    = form.moneda !== 'GTQ' && tcNum > 0 ? totalMoneda * tcNum : (form.moneda === 'GTQ' ? totalMoneda : 0);

  const handleFoto = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => s('fotoUrl', ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.fecha || !form.pais) { toast('Fecha y pais son requeridos', 'error'); return; }
    if (!form.productos.some(p => p.producto && p.cantidad)) { toast('Agrega al menos un producto con cantidad', 'error'); return; }
    const payload = {
      ...form,
      tc: tcNum,
      productos: form.productos.map(p => ({
        ...p,
        cantidad: parseFloat(p.cantidad) || 0,
        precioMoneda: parseFloat(p.precioMoneda) || 0,
        subtotalMoneda: (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioMoneda) || 0),
        subtotalGTQ: form.moneda !== 'GTQ' && tcNum > 0
          ? (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioMoneda) || 0) * tcNum
          : (form.moneda === 'GTQ' ? (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioMoneda) || 0) : 0),
      })),
      totalMoneda,
      totalGTQ,
      creadoEn: new Date().toISOString(),
    };
    try {
      if (editId) { await update(editId, payload); toast('Exportacion actualizada'); setEditId(null); }
      else        { await add(payload); toast('Exportacion registrada'); }
      setForm({ ...BLANK, productos: [{ ...BLANK_PROD }] });
    } catch { toast('Error al guardar', 'error'); }
  };

  const startEdit = r => {
    setForm({
      fecha:          r.fecha || today(),
      pais:           r.pais || 'Mexico',
      moneda:         r.moneda || 'MXN',
      tc:             String(r.tc || ''),
      tipoOperacion:  r.tipoOperacion || 'Contenedor completo',
      placa:          r.placa || '',
      cartaPorte:     r.cartaPorte || '',
      ducaRef:        r.ducaRef || '',
      incluye:        r.incluye || ['Producto'],
      productos:      r.productos?.length ? r.productos : [{ ...BLANK_PROD }],
      formaPago:      r.formaPago || 'Transferencia',
      numFel:         r.numFel || '',
      estado:         r.estado || 'pendiente',
      obs:            r.obs || '',
      fotoUrl:        r.fotoUrl || '',
    });
    setEditId(r.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => { setForm({ ...BLANK, productos: [{ ...BLANK_PROD }] }); setEditId(null); };

  const cambiarEstado = async (id, estado) => {
    try { await update(id, { estado }); toast(`Estado: ${BADGE_CFG[estado]?.label || estado}`); }
    catch { toast('Error al actualizar', 'error'); }
  };

  const filtered      = filter === 'todos' ? data : data.filter(r => r.estado === filter);
  const totalVentas   = useMemo(() => data.filter(r => r.estado !== 'cancelado').reduce((s, r) => s + (r.totalMoneda || r.total || 0), 0), [data]);
  const totalGTQHist  = useMemo(() => data.filter(r => r.estado !== 'cancelado').reduce((s, r) => s + (r.totalGTQ || 0), 0), [data]);
  const pendientes    = data.filter(r => r.estado === 'pendiente').length;

  const loadingAll = loading || loadProd;

  // Sym for current form moneda
  const sym = form.moneda === 'GTQ' ? 'Q' : form.moneda;

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: T.textDark }}>Despachos — Exportacion Internacional</h2>
        <p style={{ margin: '4px 0 0', fontSize: '.83rem', color: T.textMid }}>
          Centroamerica, Mexico y Estados Unidos — GTQ, MXN o USD
        </p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <MetricCard label="Total ventas (moneda)"  value={`${fmt(totalVentas)}`} accent={T.secondary} />
        <MetricCard label="Equivalente GTQ"         value={`Q ${fmt(totalGTQHist)}`} accent={T.primary} />
        <MetricCard label="Pendientes"              value={pendientes}           accent={T.warn} />
        <MetricCard label="Total registros"         value={data.length}          accent={T.textMid} />
      </div>

      {/* Form */}
      <div style={{ ...card, borderLeft: `4px solid ${editId ? T.warn : T.primary}` }}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.textDark, marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
          {editId ? 'Editar exportacion' : 'Registrar Despacho de Exportacion'}
        </div>

        {/* Row 1: fecha, pais, moneda, tc */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 16 }}>
          <label style={LS}>Fecha<input type="date" value={form.fecha} onChange={e => s('fecha', e.target.value)} style={IS} /></label>
          <label style={LS}>
            Pais destino
            <select value={form.pais} onChange={e => s('pais', e.target.value)} style={IS}>
              {PAISES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          <label style={LS}>
            Moneda
            <select value={form.moneda} onChange={e => s('moneda', e.target.value)} style={IS}>
              {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          {form.moneda !== 'GTQ' && (
            <label style={LS}>
              Tipo de cambio vs GTQ
              <input type="number" min="0" step="0.0001" value={form.tc} onChange={e => s('tc', e.target.value)}
                placeholder="Ej. 0.50" style={IS} />
            </label>
          )}
        </div>

        {/* Live conversion banner */}
        {form.moneda !== 'GTQ' && tcNum > 0 && totalMoneda > 0 && (
          <div style={{ background: T.bgGreen, border: `1px solid ${T.secondary}`, borderRadius: 6, padding: '10px 16px', marginBottom: 16, fontSize: '.85rem', fontWeight: 600, color: T.primary }}>
            Total {form.moneda} {fmt(totalMoneda)} = Q {fmt(totalGTQ)} GTQ (TC: {form.tc})
          </div>
        )}

        {/* Tipo de operacion */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em', marginBottom: 10 }}>Tipo de operacion</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TIPOS_OP.map(t => (
              <label key={t.value} style={{ cursor: 'pointer' }}>
                <input type="radio" name="vint-op" value={t.value} checked={form.tipoOperacion === t.value} onChange={() => s('tipoOperacion', t.value)} style={{ display: 'none' }} />
                <div style={{
                  padding: '8px 14px', borderRadius: 6, fontSize: '.78rem', fontWeight: 600,
                  border: `2px solid ${form.tipoOperacion === t.value ? T.primary : T.border}`,
                  background: form.tipoOperacion === t.value ? T.bgGreen : '#fff',
                  color: form.tipoOperacion === t.value ? T.primary : T.textMid,
                  cursor: 'pointer',
                }}>
                  {t.label}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Incluye checkboxes */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em', marginBottom: 8 }}>Incluye</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {INCLUYE_OPTS.map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '.83rem', fontWeight: 500 }}>
                <input type="checkbox" checked={form.incluye.includes(opt)} onChange={() => toggleIncluye(opt)} />
                {opt}
              </label>
            ))}
          </div>
        </div>

        {/* Transport fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 16 }}>
          <label style={LS}>Placa / Transportista<input value={form.placa} onChange={e => s('placa', e.target.value)} placeholder="Placa o transportista" style={IS} /></label>
          <label style={LS}>No. Carta de Porte<input value={form.cartaPorte} onChange={e => s('cartaPorte', e.target.value)} placeholder="No. carta de porte" style={IS} /></label>
          <label style={LS}>Referencia DUCA<input value={form.ducaRef} onChange={e => s('ducaRef', e.target.value)} placeholder="Ref. DUCA" style={IS} /></label>
        </div>

        {/* Products */}
        <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em', marginBottom: 10 }}>Productos exportados</div>
        <ProductosTable
          productos={form.productos}
          catalogo={catalogo}
          moneda={form.moneda}
          tc={form.tc}
          onChange={prods => s('productos', prods)}
        />

        {/* Totals display */}
        {totalMoneda > 0 && (
          <div style={{ background: '#FAFAFA', border: `1px solid ${T.border}`, borderRadius: 6, padding: '10px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: '.88rem' }}>
              <span>Total {form.moneda}: <strong style={{ color: T.secondary }}>{sym} {fmt(totalMoneda)}</strong></span>
              {totalGTQ > 0 && <span>Total GTQ: <strong style={{ color: T.primary }}>Q {fmt(totalGTQ)}</strong></span>}
              {tcNum > 0 && form.moneda !== 'GTQ' && <span style={{ color: T.textMid, fontSize: '.78rem' }}>TC: {form.tc}</span>}
            </div>
          </div>
        )}

        {/* Bottom fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 16 }}>
          <label style={LS}>
            Forma de pago
            <select value={form.formaPago} onChange={e => s('formaPago', e.target.value)} style={IS}>
              {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label style={LS}>No. FEL<input value={form.numFel} onChange={e => s('numFel', e.target.value)} placeholder="Factura electronica" style={IS} /></label>
          <label style={LS}>
            Estado
            <select value={form.estado} onChange={e => s('estado', e.target.value)} style={IS}>
              {Object.entries(BADGE_CFG).map(([v, b]) => <option key={v} value={v}>{b.label}</option>)}
            </select>
          </label>
        </div>

        {/* Photo */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em', marginBottom: 8 }}>Foto del documento (opcional)</div>
          <input type="file" accept="image/*" capture="environment" onChange={handleFoto} style={{ fontSize: '.82rem' }} />
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
            style={{ ...IS, resize: 'vertical' }} placeholder="Acuerdos, condiciones, credito..." />
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '11px 28px', background: saving ? T.border : (editId ? T.warn : T.primary), color: T.white, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Guardando…' : editId ? 'Actualizar exportacion' : 'Registrar Exportacion'}
          </button>
          {editId && (
            <button onClick={cancelEdit}
              style={{ padding: '11px 20px', background: T.bgLight, border: `1px solid ${T.border}`, borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: 'pointer', color: T.textMid }}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <span style={{ fontSize: '.78rem', color: T.textMid, fontWeight: 600 }}>Filtrar:</span>
        {FILTER_TABS.map(ft => (
          <button key={ft} onClick={() => setFilter(ft)} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: '.76rem', fontWeight: 600, cursor: 'pointer',
            border: `1.5px solid ${filter === ft ? T.primary : T.border}`,
            background: filter === ft ? T.primary : T.white,
            color: filter === ft ? T.white : T.textMid,
          }}>
            {ft === 'todos' ? 'Todos' : BADGE_CFG[ft]?.label || ft}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary, marginBottom: 16 }}>
          Historial ({filtered.length})
        </div>

        {loadingAll ? <Skeleton rows={8} /> : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: T.textMid, fontSize: '.88rem' }}>
            Sin registros para este filtro.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Pais', 'Moneda', 'Total (moneda)', 'Total GTQ', 'Estado', 'Acciones'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((r, i) => {
                  const rSym = r.moneda === 'GTQ' ? 'Q' : (r.moneda || 'MXN');
                  const tMon = r.totalMoneda || r.total || 0;
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 1 ? '#F9FBF9' : '#fff' }}>
                      <td style={{ ...tdSt, fontWeight: 600 }}>{r.fecha}</td>
                      <td style={tdSt}>{r.pais || '—'}</td>
                      <td style={{ ...tdSt, fontSize: '.78rem', color: T.textMid }}>{r.moneda || '—'}</td>
                      <td style={{ ...tdSt, fontWeight: 700, color: T.secondary }}>
                        {rSym} {fmt(tMon)}
                      </td>
                      <td style={{ ...tdSt, fontWeight: 700, color: T.primary }}>
                        {r.totalGTQ > 0 ? `Q ${fmt(r.totalGTQ)}` : '—'}
                      </td>
                      <td style={tdSt}><Badge estado={r.estado} /></td>
                      <td style={tdSt}>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <button onClick={() => startEdit(r)}
                            style={{ padding: '4px 10px', background: T.secondary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>
                            Editar
                          </button>
                          {r.estado === 'pendiente' && (
                            <button onClick={() => cambiarEstado(r.id, 'en_transito')}
                              style={{ padding: '4px 10px', background: '#1565C0', color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>
                              En transito
                            </button>
                          )}
                          {r.estado === 'en_transito' && (
                            <button onClick={() => cambiarEstado(r.id, 'entregado')}
                              style={{ padding: '4px 10px', background: T.secondary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>
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
