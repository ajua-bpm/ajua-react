import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useProductosCatalogo } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';
import RechazosDespacho from './RechazosDespacho';

// ── Design tokens ─────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', danger: '#C62828',
  warn: '#E65100', info: '#1565C0', textDark: '#1A1A18', textMid: '#6B6B60',
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

// ── Constants ─────────────────────────────────────────────────────
const TIPOS = [
  { value: 'mercado',      label: 'Mercado / Mayorista',    sub: 'Por quintal o libra' },
  { value: 'distribuidor', label: 'Distribuidor / Lote',    sub: 'Carga completa o parcial' },
  { value: 'restaurante',  label: 'Restaurante / Negocio',  sub: 'Varias unidades' },
];

const FORMAS_PAGO = ['efectivo', 'transferencia', 'cheque', 'credito'];
const FORMAS_PAGO_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', cheque: 'Cheque', credito: 'Credito' };

const UNIDADES = ['lb', 'quintal', 'arroba', 'caja', 'bulto', 'unidad', 'kg', 'lote'];

const BLANK_IT = { producto: '', cantidad: '', unidad: 'lb', precioUnit: '' };
const BLANK = {
  fecha: today(), comprador: '', tel: '', tipo: 'mercado',
  docTab: 'xml', numFactura: '', fechaFactura: '', nitComprador: '',
  productos: [{ ...BLANK_IT }],
  formaPago: 'efectivo', diasCredito: '', recibo: '',
  cotId: '', cotLabel: '', obs: '', fotoUrl: '',
};

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
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 90px 90px 100px 90px 28px', padding: '6px 10px', borderTop: '1px solid #F0F0F0', alignItems: 'center', gap: 6 }}>
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
              <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: T.danger, cursor: 'pointer', fontWeight: 700, fontSize: '1rem', padding: 0 }}>x</button>
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

// ── MetricCard ────────────────────────────────────────────────────
function MetricCard({ label, value, accent }) {
  return (
    <div style={{ ...card, marginBottom: 0, flex: '1 1 150px', borderTop: `3px solid ${accent || T.primary}` }}>
      <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMid, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.45rem', fontWeight: 700, color: accent || T.textDark, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

// ── Internal nav items ─────────────────────────────────────────────
const NAV_ITEMS = [
  { key: 'despachos', icon: '📦', label: 'Despachos Locales' },
  { key: 'rechazos',  icon: '⚠️', label: 'Rechazos' },
];

// ── Main component ────────────────────────────────────────────────
export default function VentasGT() {
  const toast = useToast();
  const [section, setSection] = useState('despachos');

  const { data, loading }              = useCollection('vgtVentas', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { data: cotData }              = useCollection('cotizadorRapido', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { productos: catalogo, loading: loadProd } = useProductosCatalogo();
  const { add, remove, saving }        = useWrite('vgtVentas');

  const [form, setForm]     = useState({ ...BLANK, productos: [{ ...BLANK_IT }] });

  const s  = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Cotizaciones aceptadas
  const cotAceptadas = useMemo(() => (cotData || []).filter(c => c.estado === 'aceptada'), [cotData]);

  // Calculations
  const totalBruto = form.productos.reduce((sum, p) => sum + (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnit) || 0), 0);
  // IVA: price is assumed inclusive → base = total/1.12
  const base         = totalBruto / 1.12;
  const iva          = base * 0.12;
  // Retencion 15% of IVA when total > Q2500
  const retencion    = totalBruto > 2500 ? iva * 0.15 : 0;
  const aCobrar      = totalBruto - retencion;

  const pesoTotal = form.productos.reduce((s, p) => {
    const cant = parseFloat(p.cantidad) || 0;
    const unit = p.unidad;
    if (unit === 'quintal') return s + cant * 100;
    if (unit === 'arroba')  return s + cant * 25;
    if (unit === 'kg')      return s + cant * 2.205;
    return s + cant; // lb, caja, bulto, unidad, lote treated as-is
  }, 0);

  const cargarCotizacion = (cotId) => {
    if (!cotId) { s('cotId', ''); s('cotLabel', ''); return; }
    const cot = cotAceptadas.find(c => c.id === cotId);
    if (!cot) return;
    const prods = (cot.productos || cot.items || []).map(p => ({
      producto: p.producto || p.nombre || '',
      cantidad: String(p.cantidad || p.lbs || ''),
      unidad: p.unidad || 'lb',
      precioUnit: String(p.precioUnit || p.precio || ''),
    }));
    setForm(f => ({
      ...f,
      cotId,
      cotLabel: `${cot.cliente || cot.comprador || ''} — ${cot.fecha || ''}`,
      comprador: cot.cliente || cot.comprador || f.comprador,
      productos: prods.length ? prods : [{ ...BLANK_IT }],
    }));
    toast('Cotizacion cargada');
  };

  const handleFoto = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => s('fotoUrl', ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.fecha || !form.comprador) { toast('Fecha y Comprador son requeridos', 'error'); return; }
    if (!form.productos.some(p => p.producto && p.cantidad)) { toast('Agrega al menos un producto con cantidad', 'error'); return; }
    const payload = {
      ...form,
      productos: form.productos.map(p => ({
        ...p,
        cantidad: parseFloat(p.cantidad) || 0,
        precioUnit: parseFloat(p.precioUnit) || 0,
        subtotal: (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnit) || 0),
      })),
      totalBruto,
      base: parseFloat(base.toFixed(2)),
      iva: parseFloat(iva.toFixed(2)),
      retencion: parseFloat(retencion.toFixed(2)),
      aCobrar: parseFloat(aCobrar.toFixed(2)),
      pesoTotal: parseFloat(pesoTotal.toFixed(2)),
      diasCredito: parseInt(form.diasCredito) || 0,
      creadoEn: new Date().toISOString(),
    };
    try {
      await add(payload);
      toast('Despacho local registrado');
      setForm({ ...BLANK, productos: [{ ...BLANK_IT }] });
    } catch { toast('Error al guardar', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar este registro?')) return;
    try { await remove(id); toast('Registro eliminado'); }
    catch { toast('Error al eliminar', 'error'); }
  };

  const loadingAll = loading || loadProd;

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1100 }}>
      {/* Módulo header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: T.textDark }}>Despachos — Locales Guatemala</h2>
        <p style={{ margin: '4px 0 0', fontSize: '.83rem', color: T.textMid }}>
          Mercado mayorista · distribuidores · restaurantes · rechazos
        </p>
      </div>

      {/* Internal sidebar nav */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <nav style={{ flexShrink: 0, width: 180, background: '#fff', borderRadius: 10,
          border: `1px solid ${T.border}`, padding: '8px 0', position: 'sticky', top: 70 }}>
          {NAV_ITEMS.map(n => {
            const active = section === n.key;
            return (
              <button key={n.key} onClick={() => setSection(n.key)} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                width: '100%', padding: '10px 16px', border: 'none',
                background: active ? 'rgba(27,94,32,.08)' : 'transparent',
                borderLeft: `3px solid ${active ? T.primary : 'transparent'}`,
                color: active ? T.primary : T.textMid,
                fontWeight: active ? 700 : 500, fontSize: '.85rem',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                transition: 'all .12s',
              }}>
                <span>{n.icon}</span>
                <span>{n.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {section === 'rechazos' && <RechazosDespacho />}
          {section === 'despachos' && (<>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <MetricCard label="Total registros"  value={data.length}  accent={T.textMid} />
      </div>

      {/* Form */}
      <div style={{ ...card, borderLeft: `4px solid ${T.primary}` }}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.textDark, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
          Registrar Despacho Local
        </div>

        {/* Cotizacion vinculada */}
        <div style={{ background: 'rgba(27,94,32,.05)', border: '1px solid rgba(27,94,32,.22)', borderRadius: 6, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '.7rem', color: T.primary, fontWeight: 600, whiteSpace: 'nowrap' }}>Cotizacion aceptada?</span>
          <select
            value={form.cotId}
            onChange={e => cargarCotizacion(e.target.value)}
            style={{ flex: 1, minWidth: 200, background: '#fff', border: `1px solid rgba(27,94,32,.35)`, color: T.textDark, padding: '6px 8px', borderRadius: 4, fontSize: '.72rem' }}
          >
            <option value="">— Cargar desde cotizacion aceptada —</option>
            {cotAceptadas.map(c => (
              <option key={c.id} value={c.id}>{c.cliente || c.comprador || 'Sin nombre'} — {c.fecha || ''}</option>
            ))}
          </select>
          {form.cotLabel && (
            <span style={{ fontSize: '.7rem', color: T.primary, fontWeight: 600 }}>{form.cotLabel}</span>
          )}
        </div>

        {/* Tipo selector — 3 cards */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.08em', marginBottom: 8 }}>Tipo de despacho</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {TIPOS.map(t => {
              const sel = form.tipo === t.value;
              return (
                <label key={t.value} style={{ cursor: 'pointer' }}>
                  <input type="radio" name="vgt-tipo" value={t.value} checked={sel} onChange={() => s('tipo', t.value)} style={{ display: 'none' }} />
                  <div style={{
                    background: sel ? 'rgba(27,94,32,.08)' : '#fff',
                    border: `2px solid ${sel ? T.primary : T.border}`,
                    borderRadius: 6, padding: '10px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '.72rem', fontWeight: 700, marginTop: 3, color: sel ? T.primary : T.textDark }}>{t.label}</div>
                    <div style={{ fontSize: '.6rem', color: T.textMid, marginTop: 2 }}>{t.sub}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Base fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 14 }}>
          <label style={LS}>Fecha<input type="date" value={form.fecha} onChange={e => s('fecha', e.target.value)} style={IS} /></label>
          <label style={LS}>Comprador / Negocio<input value={form.comprador} onChange={e => s('comprador', e.target.value)} placeholder="Nombre o mercado" style={IS} /></label>
          <label style={LS}>Telefono / Referencia<input value={form.tel} onChange={e => s('tel', e.target.value)} placeholder="Tel. o referencia" style={IS} /></label>
        </div>

        {/* Document section */}
        <div style={{ background: 'rgba(21,101,192,.04)', border: '1px solid rgba(21,101,192,.18)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: '.6rem', color: T.info, fontWeight: 700, letterSpacing: '.08em', marginBottom: 8 }}>DOCUMENTO DE VENTA (opcional pero recomendado)</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button
              onClick={() => s('docTab', 'xml')}
              style={{ padding: '6px 14px', borderRadius: 4, fontSize: '.68rem', fontWeight: 600, cursor: 'pointer', border: 'none',
                background: form.docTab === 'xml' ? T.primary : '#fff',
                color: form.docTab === 'xml' ? T.white : T.textMid,
                outline: form.docTab !== 'xml' ? `1px solid ${T.border}` : 'none' }}
            >
              XML FEL
            </button>
            <button
              onClick={() => s('docTab', 'manual')}
              style={{ padding: '6px 14px', borderRadius: 4, fontSize: '.68rem', fontWeight: 600, cursor: 'pointer', border: 'none',
                background: form.docTab === 'manual' ? T.primary : '#fff',
                color: form.docTab === 'manual' ? T.white : T.textMid,
                outline: form.docTab !== 'manual' ? `1px solid ${T.border}` : 'none' }}
            >
              Manual / Sin factura
            </button>
          </div>

          {form.docTab === 'xml' && (
            <div>
              <div style={{ fontSize: '.68rem', color: T.textMid, marginBottom: 8 }}>
                Carga el XML FEL — extrae productos, cantidades y precios.<br />
                Precio ya incluye IVA. Retencion 15% si total supera Q2,500.
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ padding: '6px 12px', background: T.primary, color: T.white, borderRadius: 4, cursor: 'pointer', fontSize: '.72rem', fontWeight: 600 }}>
                  Cargar XML FEL
                  <input type="file" accept=".xml" style={{ display: 'none' }} onChange={() => toast('XML: parsing no disponible en React — ingrese manualmente', 'warn')} />
                </label>
                <label style={{ padding: '6px 12px', background: '#fff', border: `1px solid ${T.border}`, color: T.textMid, borderRadius: 4, cursor: 'pointer', fontSize: '.68rem', fontWeight: 600 }}>
                  Foto factura
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFoto} />
                </label>
                {form.fotoUrl && <span style={{ fontSize: '.7rem', color: T.secondary, fontWeight: 600 }}>Foto cargada</span>}
              </div>
            </div>
          )}

          {form.docTab === 'manual' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <label style={LS}>No. Factura / Recibo<input value={form.numFactura} onChange={e => s('numFactura', e.target.value)} placeholder="Serie-No." style={IS} /></label>
              <label style={LS}>Fecha factura<input type="date" value={form.fechaFactura} onChange={e => s('fechaFactura', e.target.value)} style={IS} /></label>
              <label style={LS}>NIT comprador<input value={form.nitComprador} onChange={e => s('nitComprador', e.target.value)} placeholder="NIT o CF" style={IS} /></label>
            </div>
          )}
        </div>

        {/* Retencion warning */}
        {totalBruto > 2500 && (
          <div style={{ background: 'rgba(198,40,40,.06)', border: '1px solid rgba(198,40,40,.2)', borderRadius: 4, padding: '8px 12px', marginBottom: 10, fontSize: '.7rem' }}>
            <strong style={{ color: T.danger }}>Retencion ISR:</strong> El total supera Q2,500 — se retendra 15% del IVA al cliente.
            <span style={{ color: T.danger, fontWeight: 700, marginLeft: 8 }}>Q {fmt(retencion)}</span>
          </div>
        )}

        {/* Products */}
        <div style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', color: T.warn, letterSpacing: '.08em', marginBottom: 8 }}>PRODUCTOS Y PRECIOS</div>
        <ProductosTable
          productos={form.productos}
          catalogo={catalogo}
          onChange={prods => s('productos', prods)}
        />

        {/* Totals summary */}
        {totalBruto > 0 && (
          <div style={{ background: T.bgGreen, border: `1px solid #A5D6A7`, borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: '.82rem', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <span>Peso total: <strong style={{ color: T.primary }}>{fmt(pesoTotal)} lbs</strong></span>
            <span>Total Q: <strong style={{ color: T.primary }}>Q {fmt(totalBruto)}</strong></span>
            <span style={{ color: T.textMid }}>Base (sin IVA): <strong>Q {fmt(base)}</strong></span>
            <span style={{ color: T.warn }}>IVA 12%: <strong>Q {fmt(iva)}</strong></span>
            {retencion > 0 && <span style={{ color: T.danger }}>Retencion: <strong>Q {fmt(retencion)}</strong></span>}
            <span style={{ color: T.secondary, fontWeight: 700 }}>A cobrar: <strong>Q {fmt(aCobrar)}</strong></span>
          </div>
        )}

        {/* Payment */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 14 }}>
          <label style={LS}>
            Forma de pago
            <select value={form.formaPago} onChange={e => s('formaPago', e.target.value)} style={IS}>
              {FORMAS_PAGO.map(f => <option key={f} value={f}>{FORMAS_PAGO_LABEL[f]}</option>)}
            </select>
          </label>
          <label style={LS}>Dias de credito<input type="number" min="0" value={form.diasCredito} onChange={e => s('diasCredito', e.target.value)} placeholder="0 (contado)" style={IS} /></label>
          <label style={LS}>No. recibo / comprobante<input value={form.recibo} onChange={e => s('recibo', e.target.value)} placeholder="Recibo, transferencia #" style={IS} /></label>
        </div>

        {/* Photo preview */}
        {form.fotoUrl && (
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={form.fotoUrl} alt="foto" style={{ height: 100, borderRadius: 6, border: `1px solid ${T.border}` }} />
            <button onClick={() => s('fotoUrl', '')}
              style={{ padding: '4px 10px', background: '#FFEBEE', color: T.danger, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>
              Quitar foto
            </button>
          </div>
        )}

        <label style={{ ...LS, marginBottom: 16 }}>
          Observaciones
          <textarea value={form.obs} onChange={e => s('obs', e.target.value)} rows={2}
            style={{ ...IS, resize: 'vertical' }} placeholder="Notas de la venta..." />
        </label>

        <button onClick={handleSave} disabled={saving}
          style={{ padding: '11px 28px', background: saving ? T.border : T.primary, color: T.white, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Guardando...' : 'Registrar Despacho'}
        </button>
      </div>

      {/* History table */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.textDark, marginBottom: 16 }}>
          Historial Despachos Locales ({data.length})
        </div>

        {loadingAll ? <Skeleton rows={8} /> : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: T.textMid, fontSize: '.88rem' }}>
            Sin despachos registrados aun.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Tipo', 'Comprador', 'Productos', 'Peso lbs', 'Total Q', 'IVA Q', 'A cobrar Q', 'OC/Ref', ''].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 150).map((r, i) => {
                  const tipoLabel = TIPOS.find(t => t.value === r.tipo)?.label || r.tipo || '—';
                  const prodsStr  = (r.productos || []).map(p => `${p.producto} ${p.cantidad}${p.unidad}`).join(', ');
                  const ivaVal    = r.iva != null ? r.iva : (r.totalBruto ? r.totalBruto / 1.12 * 0.12 : 0);
                  const aCobrarV  = r.aCobrar != null ? r.aCobrar : (r.totalBruto || 0);
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 1 ? '#F9FBF9' : '#fff' }}>
                      <td style={{ ...tdSt, fontWeight: 600 }}>{r.fecha}</td>
                      <td style={{ ...tdSt, fontSize: '.78rem', color: T.textMid }}>{tipoLabel}</td>
                      <td style={tdSt}>{r.comprador || '—'}</td>
                      <td style={{ ...tdSt, fontSize: '.75rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prodsStr || '—'}</td>
                      <td style={{ ...tdSt, fontSize: '.8rem' }}>{r.pesoTotal ? fmt(r.pesoTotal) : '—'}</td>
                      <td style={{ ...tdSt, fontWeight: 700, color: T.primary }}>Q {fmt(r.totalBruto || r.total)}</td>
                      <td style={{ ...tdSt, fontSize: '.78rem', color: T.textMid }}>Q {fmt(ivaVal)}</td>
                      <td style={{ ...tdSt, fontWeight: 700, color: T.secondary }}>Q {fmt(aCobrarV)}</td>
                      <td style={{ ...tdSt, fontSize: '.75rem', color: T.textMid }}>{r.recibo || r.numFactura || '—'}</td>
                      <td style={tdSt}>
                        <button onClick={() => handleDelete(r.id)}
                          style={{ padding: '3px 8px', background: '#FFEBEE', color: T.danger, border: 'none', borderRadius: 4, fontSize: '.7rem', fontWeight: 600, cursor: 'pointer' }}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
          </>)}
        </div>{/* /content */}
      </div>{/* /flex layout */}
    </div>
  );
}
