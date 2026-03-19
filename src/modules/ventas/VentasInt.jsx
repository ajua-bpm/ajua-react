import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useProductosCatalogo } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

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
const fmt   = (n, dec = 2) => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: dec });

// ── Constants ─────────────────────────────────────────────────────
const PAISES = [
  { value: 'MX',   label: 'Mexico'       },
  { value: 'SV',   label: 'El Salvador'  },
  { value: 'HN',   label: 'Honduras'     },
  { value: 'CR',   label: 'Costa Rica'   },
  { value: 'NI',   label: 'Nicaragua'    },
  { value: 'BZ',   label: 'Belice'       },
  { value: 'otro', label: 'Otro'         },
];

// GTQ and MXN only, matching bpm.html
const MONEDAS = [
  { value: 'gtq', label: 'GTQ — Quetzales'     },
  { value: 'mxn', label: 'MXN — Pesos mexicanos' },
];

const TIPOS_OP = [
  { value: 'contenedor_completo', label: 'Contenedor completo',  sub: 'Carga total' },
  { value: 'parcial_transporte',  label: 'Parcial + transporte', sub: 'Carga parcial' },
  { value: 'solo_producto',       label: 'Solo producto',        sub: 'Sin transporte' },
  { value: 'frontera_mx',         label: 'Hasta frontera MX',    sub: 'Entrega frontera' },
];

const INCLUYE_OPTS = ['Producto', 'Transporte', 'Papeleria', 'Aduana'];

const BADGE_CFG = {
  pendiente:   { bg: '#FFF3E0', c: '#E65100',  label: 'Pendiente'   },
  en_transito: { bg: '#E3F2FD', c: '#1565C0',  label: 'En Transito' },
  entregado:   { bg: '#E8F5E9', c: '#2E7D32',  label: 'Entregado'   },
  cobrado:     { bg: '#E8F5E9', c: '#1B5E20',  label: 'Cobrado'     },
  cancelado:   { bg: '#FFEBEE', c: '#C62828',  label: 'Cancelado'   },
};

const FILTER_TABS = ['todos', 'pendiente', 'en_transito', 'entregado', 'cobrado', 'cancelado'];

// Products: Producto | Bultos | Lbs/Bulto | Total LBS | Precio/lb | Total
const BLANK_PROD = { producto: '', bultos: '', lbsBulto: '', precioLb: '' };
const BLANK = {
  fecha: today(), pais: 'MX', comprador: '', moneda: 'gtq', tc: '',
  tipoOperacion: 'contenedor_completo',
  incluye: ['Producto'],
  productos: [{ ...BLANK_PROD }],
  flete: '', papeleria: '', otros: '',
  porte: '', placa: '',
  estado: 'pendiente', obs: '', fotoUrl: '',
  cotId: '', cotLabel: '',
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

// ── Products table — Bultos/Lbs/PrecioLb ─────────────────────────
function ProductosTable({ productos, catalogo, moneda, onChange }) {
  const add    = () => onChange([...productos, { ...BLANK_PROD }]);
  const remove = i  => onChange(productos.filter((_, j) => j !== i));
  const set    = (i, k, v) => onChange(productos.map((p, j) => j === i ? { ...p, [k]: v } : p));

  const monLabel = moneda === 'mxn' ? 'MXN' : 'GTQ';

  const totals = productos.reduce((acc, p) => {
    const bultos  = parseFloat(p.bultos)   || 0;
    const lbsBulto = parseFloat(p.lbsBulto) || 0;
    const totalLbs = bultos * lbsBulto;
    const total    = totalLbs * (parseFloat(p.precioLb) || 0);
    return { bultos: acc.bultos + bultos, lbs: acc.lbs + totalLbs, total: acc.total + total };
  }, { bultos: 0, lbs: 0, total: 0 });

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 70px 80px 90px 110px 100px 28px', background: T.bgGreen, padding: '8px 10px', fontSize: '.7rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        <span>Producto</span>
        <span>Bultos</span>
        <span>Lbs/Bulto</span>
        <span>Total LBS</span>
        <span>Precio/lb ({monLabel})</span>
        <span style={{ textAlign: 'right' }}>Total {monLabel}</span>
        <span />
      </div>
      {productos.map((p, i) => {
        const bultos   = parseFloat(p.bultos)   || 0;
        const lbsBulto = parseFloat(p.lbsBulto) || 0;
        const totalLbs = bultos * lbsBulto;
        const total    = totalLbs * (parseFloat(p.precioLb) || 0);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 70px 80px 90px 110px 100px 28px', padding: '6px 10px', borderTop: '1px solid #F0F0F0', alignItems: 'center', gap: 6 }}>
            <select value={p.producto} onChange={e => set(i, 'producto', e.target.value)} style={{ ...IS, fontSize: '.82rem', padding: '5px 7px' }}>
              <option value="">— Producto —</option>
              {catalogo.map(c => <option key={c.id || c.nombre} value={c.nombre}>{c.nombre}</option>)}
            </select>
            <input type="number" min="0" step="1" value={p.bultos} onChange={e => set(i, 'bultos', e.target.value)}
              placeholder="0" style={{ ...IS, fontSize: '.82rem', padding: '5px 7px' }} />
            <input type="number" min="0" step="0.01" value={p.lbsBulto} onChange={e => set(i, 'lbsBulto', e.target.value)}
              placeholder="0" style={{ ...IS, fontSize: '.82rem', padding: '5px 7px' }} />
            <span style={{ fontSize: '.82rem', fontWeight: 600, color: T.textDark, paddingLeft: 4 }}>
              {fmt(totalLbs, 1)}
            </span>
            <input type="number" min="0" step="0.0001" value={p.precioLb} onChange={e => set(i, 'precioLb', e.target.value)}
              placeholder="0.00" style={{ ...IS, fontSize: '.82rem', padding: '5px 7px' }} />
            <span style={{ fontSize: '.83rem', fontWeight: 700, color: T.secondary, textAlign: 'right', paddingRight: 4 }}>
              {fmt(total)}
            </span>
            {productos.length > 1 && (
              <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: T.danger, cursor: 'pointer', fontWeight: 700, fontSize: '1rem', padding: 0 }}>x</button>
            )}
          </div>
        );
      })}
      <div style={{ padding: '8px 10px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={add} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, padding: '5px 12px', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', color: T.textMid }}>
          + Agregar producto
        </button>
        <div style={{ display: 'flex', gap: 16, fontSize: '.83rem', fontWeight: 700 }}>
          <span>Bultos: <strong style={{ color: T.primary }}>{fmt(totals.bultos, 0)}</strong></span>
          <span>LBS: <strong style={{ color: T.primary }}>{fmt(totals.lbs, 1)}</strong></span>
          <span>Total {monLabel}: <strong style={{ color: T.secondary }}>{fmt(totals.total)}</strong></span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function VentasInt() {
  const toast = useToast();

  const { data, loading }              = useCollection('vintVentas', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { data: cotData }              = useCollection('cotizadorRapido', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { productos: catalogo, loading: loadProd } = useProductosCatalogo();
  const { add, remove, saving }        = useWrite('vintVentas');

  const [form, setForm]     = useState({ ...BLANK, productos: [{ ...BLANK_PROD }] });
  const [filter, setFilter] = useState('todos');

  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleIncluye = val => setForm(f => ({
    ...f,
    incluye: f.incluye.includes(val) ? f.incluye.filter(x => x !== val) : [...f.incluye, val],
  }));

  // Cotizaciones aceptadas
  const cotAceptadas = useMemo(() => (cotData || []).filter(c => c.estado === 'aceptada'), [cotData]);

  const cargarCotizacion = (cotId) => {
    if (!cotId) { s('cotId', ''); s('cotLabel', ''); return; }
    const cot = cotAceptadas.find(c => c.id === cotId);
    if (!cot) return;
    const prods = (cot.productos || cot.items || []).map(p => ({
      producto:  p.producto || p.nombre || '',
      bultos:    String(p.bultos || ''),
      lbsBulto:  String(p.lbsBulto || p.lbs_bulto || ''),
      precioLb:  String(p.precioLb || p.precio || ''),
    }));
    setForm(f => ({
      ...f,
      cotId,
      cotLabel: `${cot.cliente || cot.comprador || ''} — ${cot.fecha || ''}`,
      comprador: cot.cliente || cot.comprador || f.comprador,
      productos: prods.length ? prods : [{ ...BLANK_PROD }],
    }));
    toast('Cotizacion cargada');
  };

  // Totals
  const tcNum = parseFloat(form.tc) || 0;
  const prodTotals = form.productos.reduce((acc, p) => {
    const bultos   = parseFloat(p.bultos)   || 0;
    const lbsBulto = parseFloat(p.lbsBulto) || 0;
    const totalLbs = bultos * lbsBulto;
    const total    = totalLbs * (parseFloat(p.precioLb) || 0);
    return { bultos: acc.bultos + bultos, lbs: acc.lbs + totalLbs, total: acc.total + total };
  }, { bultos: 0, lbs: 0, total: 0 });

  const fleteN  = parseFloat(form.flete)     || 0;
  const papN    = parseFloat(form.papeleria) || 0;
  const otrosN  = parseFloat(form.otros)     || 0;
  const totalMoneda = prodTotals.total + fleteN + papN + otrosN;
  const totalGTQ    = form.moneda !== 'gtq' && tcNum > 0 ? totalMoneda * tcNum : (form.moneda === 'gtq' ? totalMoneda : 0);

  const monLabel = form.moneda === 'mxn' ? 'MXN' : 'GTQ';

  const handleFoto = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => s('fotoUrl', ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.fecha || !form.pais) { toast('Fecha y Pais son requeridos', 'error'); return; }
    if (!form.productos.some(p => p.producto && p.bultos)) { toast('Agrega al menos un producto con bultos', 'error'); return; }
    const payload = {
      ...form,
      tc: tcNum,
      productos: form.productos.map(p => {
        const bultos   = parseFloat(p.bultos)   || 0;
        const lbsBulto = parseFloat(p.lbsBulto) || 0;
        const totalLbs = bultos * lbsBulto;
        const total    = totalLbs * (parseFloat(p.precioLb) || 0);
        return { ...p, bultos, lbsBulto, totalLbs, precioLb: parseFloat(p.precioLb) || 0, total };
      }),
      totalBultos: prodTotals.bultos,
      totalLbs: parseFloat(prodTotals.lbs.toFixed(2)),
      totalMoneda: parseFloat(totalMoneda.toFixed(2)),
      totalGTQ: parseFloat(totalGTQ.toFixed(2)),
      creadoEn: new Date().toISOString(),
    };
    try {
      await add(payload);
      toast('Exportacion registrada');
      setForm({ ...BLANK, productos: [{ ...BLANK_PROD }] });
    } catch { toast('Error al guardar', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar este registro?')) return;
    try { await remove(id); toast('Registro eliminado'); }
    catch { toast('Error al eliminar', 'error'); }
  };

  const filtered    = filter === 'todos' ? data : data.filter(r => r.estado === filter);
  const pendientes  = data.filter(r => r.estado === 'pendiente').length;

  const loadingAll = loading || loadProd;

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: T.textDark }}>Despachos — Exportacion</h2>
        <p style={{ margin: '4px 0 0', fontSize: '.83rem', color: T.textMid }}>
          Centroamerica y Mexico sin factura FEL · GTQ o MXN · contenedor completo o parcial
        </p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <MetricCard label="Total registros" value={data.length}  accent={T.textMid} />
        <MetricCard label="Pendientes"       value={pendientes}  accent={T.warn} />
      </div>

      {/* Form */}
      <div style={{ ...card, borderLeft: `4px solid ${T.primary}` }}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.textDark, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
          Registrar Despacho de Exportacion
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

        {/* Row 1: fecha, pais, comprador */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 14 }}>
          <label style={LS}>Fecha<input type="date" value={form.fecha} onChange={e => s('fecha', e.target.value)} style={IS} /></label>
          <label style={LS}>
            Pais destino
            <select value={form.pais} onChange={e => s('pais', e.target.value)} style={IS}>
              {PAISES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          <label style={LS}>Comprador / Empresa<input value={form.comprador} onChange={e => s('comprador', e.target.value)} placeholder="Nombre del comprador" style={IS} /></label>
        </div>

        {/* Tipo de operacion */}
        <div style={{ background: `${T.bgLight}`, border: `1px solid ${T.border}`, borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: '.6rem', color: T.info, fontWeight: 700, letterSpacing: '.08em', marginBottom: 8 }}>TIPO DE OPERACION</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {TIPOS_OP.map(t => {
              const sel = form.tipoOperacion === t.value;
              return (
                <label key={t.value} style={{ cursor: 'pointer' }}>
                  <input type="radio" name="vint-op" value={t.value} checked={sel} onChange={() => s('tipoOperacion', t.value)} style={{ display: 'none' }} />
                  <div style={{
                    background: sel ? 'rgba(21,101,192,.10)' : '#fff',
                    border: `2px solid ${sel ? T.info : T.border}`,
                    borderRadius: 6, padding: '8px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '.68rem', fontWeight: 700, color: sel ? T.info : T.textDark }}>{t.label}</div>
                    <div style={{ fontSize: '.6rem', color: T.textMid, marginTop: 2 }}>{t.sub}</div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Incluye checkboxes */}
          <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '.7rem' }}>
            <div style={{ fontSize: '.62rem', fontWeight: 700, color: T.textMid, letterSpacing: '.06em', marginRight: 4, alignSelf: 'center' }}>INCLUYE:</div>
            {INCLUYE_OPTS.map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '.7rem' }}>
                <input type="checkbox" checked={form.incluye.includes(opt)} onChange={() => toggleIncluye(opt)} />
                {opt}
              </label>
            ))}
          </div>
        </div>

        {/* Precio pactado / moneda */}
        <div style={{ background: 'rgba(230,81,0,.04)', border: '1px solid rgba(230,81,0,.18)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: '.6rem', color: T.warn, fontWeight: 700, letterSpacing: '.08em', marginBottom: 8 }}>PRECIO PACTADO</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
            <label style={LS}>
              Moneda
              <select value={form.moneda} onChange={e => s('moneda', e.target.value)} style={IS}>
                {MONEDAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
            {form.moneda !== 'gtq' && (
              <label style={LS}>
                TC MXN a GTQ
                <input type="number" min="0" step="0.0001" value={form.tc} onChange={e => s('tc', e.target.value)}
                  placeholder="Ej. 0.7428" style={IS} />
              </label>
            )}
            {form.moneda !== 'gtq' && tcNum > 0 && (
              <label style={LS}>
                Equiv. GTQ
                <input value={`Q ${fmt(totalGTQ)}`} readOnly style={{ ...IS, background: T.bgGreen, color: T.primary, fontWeight: 600 }} />
              </label>
            )}
          </div>
        </div>

        {/* Products */}
        <div style={{ fontSize: '.6rem', color: T.primary, fontWeight: 700, letterSpacing: '.08em', marginBottom: 8 }}>PRODUCTOS EXPORTADOS</div>
        <ProductosTable
          productos={form.productos}
          catalogo={catalogo}
          moneda={form.moneda}
          onChange={prods => s('productos', prods)}
        />

        {/* Totals summary */}
        {totalMoneda > 0 && (
          <div style={{ background: T.bgGreen, border: `1px solid #A5D6A7`, borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: '.82rem', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>Bultos: <strong style={{ color: T.primary }}>{fmt(prodTotals.bultos, 0)}</strong></span>
            <span>LBS: <strong style={{ color: T.primary }}>{fmt(prodTotals.lbs, 1)}</strong></span>
            <span>Total {monLabel}: <strong style={{ color: T.secondary }}>{fmt(totalMoneda)}</strong></span>
            {totalGTQ > 0 && form.moneda !== 'gtq' && <span>~GTQ: <strong style={{ color: T.textMid }}>Q {fmt(totalGTQ)}</strong></span>}
          </div>
        )}

        {/* Additional charges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 14 }}>
          <label style={LS}>Flete / Transporte<input type="number" min="0" step="0.01" value={form.flete} onChange={e => s('flete', e.target.value)} placeholder="0" style={IS} /></label>
          <label style={LS}>Papeleria / Docs<input type="number" min="0" step="0.01" value={form.papeleria} onChange={e => s('papeleria', e.target.value)} placeholder="0" style={IS} /></label>
          <label style={LS}>Otros cargos<input type="number" min="0" step="0.01" value={form.otros} onChange={e => s('otros', e.target.value)} placeholder="0" style={IS} /></label>
        </div>

        {/* Transport docs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 14 }}>
          <label style={LS}>Carta de porte / No. embarque<input value={form.porte} onChange={e => s('porte', e.target.value)} placeholder="No. carta de porte" style={IS} /></label>
          <label style={LS}>Placa / Transportista<input value={form.placa} onChange={e => s('placa', e.target.value)} placeholder="Placa o transportista" style={IS} /></label>
        </div>

        {/* Photo */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em', marginBottom: 8 }}>Foto del documento (opcional)</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => toast('Camara no disponible en este contexto', 'warn')}
              style={{ padding: '6px 12px', background: '#fff', border: `1px solid ${T.border}`, borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', color: T.textMid }}>
              Fotografiar doc
            </button>
            <label style={{ padding: '6px 12px', background: '#fff', border: `1px solid ${T.border}`, borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', color: T.textMid }}>
              Cargar imagen
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFoto} />
            </label>
          </div>
          {form.fotoUrl && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={form.fotoUrl} alt="foto" style={{ height: 100, borderRadius: 6, border: `1px solid ${T.border}` }} />
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

        <button onClick={handleSave} disabled={saving}
          style={{ padding: '11px 28px', background: saving ? T.border : T.primary, color: T.white, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Guardando...' : 'Registrar Exportacion'}
        </button>
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

      {/* History table */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary, marginBottom: 16 }}>
          Historial Exportaciones ({filtered.length})
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
                  {['Fecha', 'Pais', 'Comprador', 'Operacion', 'Productos', 'LBS', 'Total', 'Moneda', '~ GTQ', 'Estado', ''].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 150).map((r, i) => {
                  const paisLabel = PAISES.find(p => p.value === r.pais)?.label || r.pais || '—';
                  const opLabel   = TIPOS_OP.find(t => t.value === r.tipoOperacion)?.label || r.tipoOperacion || '—';
                  const prodsStr  = (r.productos || []).map(p => p.producto).filter(Boolean).join(', ');
                  const lbs       = r.totalLbs != null ? r.totalLbs : (r.productos || []).reduce((s, p) => s + ((parseFloat(p.bultos)||0)*(parseFloat(p.lbsBulto)||0)), 0);
                  const tMon      = r.totalMoneda != null ? r.totalMoneda : (r.total || 0);
                  const monDisp   = r.moneda === 'mxn' ? 'MXN' : 'GTQ';
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 1 ? '#F9FBF9' : '#fff' }}>
                      <td style={{ ...tdSt, fontWeight: 600 }}>{r.fecha}</td>
                      <td style={tdSt}>{paisLabel}</td>
                      <td style={tdSt}>{r.comprador || '—'}</td>
                      <td style={{ ...tdSt, fontSize: '.75rem', color: T.textMid }}>{opLabel}</td>
                      <td style={{ ...tdSt, fontSize: '.75rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prodsStr || '—'}</td>
                      <td style={{ ...tdSt, fontSize: '.8rem' }}>{fmt(lbs, 1)}</td>
                      <td style={{ ...tdSt, fontWeight: 700, color: T.secondary }}>{fmt(tMon)}</td>
                      <td style={{ ...tdSt, fontSize: '.78rem', color: T.textMid }}>{monDisp}</td>
                      <td style={{ ...tdSt, fontSize: '.78rem', color: T.textMid }}>
                        {r.totalGTQ > 0 ? `Q ${fmt(r.totalGTQ)}` : '—'}
                      </td>
                      <td style={tdSt}><Badge estado={r.estado} /></td>
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
    </div>
  );
}
