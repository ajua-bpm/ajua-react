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

// ── Estado badge ──────────────────────────────────────────────────
const BADGE_CFG = {
  pendiente:   { bg: '#FFF3E0', c: '#E65100', label: 'Pendiente' },
  en_curso:    { bg: '#E3F2FD', c: '#1565C0', label: 'En Curso' },
  entregado:   { bg: '#E8F5E9', c: '#2E7D32', label: 'Entregado' },
  con_rechazo: { bg: '#FFEBEE', c: '#C62828', label: 'Con Rechazo' },
  sin_stock:   { bg: '#FFEBEE', c: '#C62828', label: 'Sin Stock' },
  cerrado:     { bg: '#F5F5F5', c: '#6B6B60', label: 'Cerrado' },
};
function Badge({ estado }) {
  const b = BADGE_CFG[estado] || { bg: '#F5F5F5', c: '#6B6B60', label: estado || '—' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600, background: b.bg, color: b.c, whiteSpace: 'nowrap' }}>
      {b.label}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const fmt   = n  => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 });

// Returns Mon-Sun week range for a given Date
function weekRange(ref) {
  const d = new Date(ref);
  const day = d.getDay(); // 0=Sun
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { mon, sun };
}
function isoDate(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

const BLANK_PROD = { codigo: '', producto: '', cajasPedidas: '', precioUnit: '' };
const BLANK_FORM = {
  fecha: today(), cliente: 'Walmart Guatemala', numOC: '', numAtlas: '',
  rampa: '', horaEntrega: '16:00', productos: [{ ...BLANK_PROD }],
  numFel: '', estado: 'pendiente', motivoRechazo: '', obs: '',
};

// ── Inline FEL editor ─────────────────────────────────────────────
function FelEditor({ record, onSave }) {
  const [val, setVal] = useState(record.numFel || '');
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
      <input value={val} onChange={e => setVal(e.target.value)} placeholder="No. FEL…"
        style={{ ...IS, fontSize: '.78rem', padding: '5px 8px', width: 130 }} />
      <button onClick={() => onSave(val)}
        style={{ padding: '5px 10px', background: T.primary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>
        Guardar
      </button>
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────
function MetricCard({ label, value, accent }) {
  return (
    <div style={{ ...card, marginBottom: 0, flex: '1 1 150px', borderTop: `3px solid ${accent || T.primary}` }}>
      <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMid, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.55rem', fontWeight: 700, color: accent || T.textDark, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

// ── Products grid (form) ──────────────────────────────────────────
function ProductosGrid({ productos, catalogo, onChange }) {
  const addRow    = () => onChange([...productos, { ...BLANK_PROD }]);
  const removeRow = i  => onChange(productos.filter((_, j) => j !== i));
  const setField  = (i, k, v) => onChange(productos.map((p, j) => j === i ? { ...p, [k]: v } : p));

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '90px 2fr 110px 110px 100px 32px', background: T.bgGreen, padding: '8px 10px', fontSize: '.7rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        <span>Código</span><span>Producto</span><span>Cajas</span><span>Precio Q</span><span style={{ textAlign: 'right' }}>Subtotal</span><span />
      </div>
      {productos.map((p, i) => {
        const sub = (parseFloat(p.cajasPedidas) || 0) * (parseFloat(p.precioUnit) || 0);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 2fr 110px 110px 100px 32px', padding: '6px 10px', borderTop: `1px solid #F0F0F0`, alignItems: 'center', gap: 6 }}>
            <input value={p.codigo} onChange={e => setField(i, 'codigo', e.target.value)}
              placeholder="Cód." style={{ ...IS, fontSize: '.8rem', padding: '5px 7px' }} />
            <select value={p.producto} onChange={e => setField(i, 'producto', e.target.value)}
              style={{ ...IS, fontSize: '.8rem', padding: '5px 7px' }}>
              <option value="">— Producto —</option>
              {catalogo.map(c => <option key={c.id || c.nombre} value={c.nombre}>{c.nombre}</option>)}
            </select>
            <input type="number" min="0" value={p.cajasPedidas} onChange={e => setField(i, 'cajasPedidas', e.target.value)}
              placeholder="0" style={{ ...IS, fontSize: '.8rem', padding: '5px 7px' }} />
            <input type="number" min="0" step="0.01" value={p.precioUnit} onChange={e => setField(i, 'precioUnit', e.target.value)}
              placeholder="0.00" style={{ ...IS, fontSize: '.8rem', padding: '5px 7px' }} />
            <span style={{ fontSize: '.83rem', fontWeight: 700, color: T.secondary, textAlign: 'right', paddingRight: 4 }}>
              Q {fmt(sub)}
            </span>
            {productos.length > 1 && (
              <button onClick={() => removeRow(i)}
                style={{ background: 'none', border: 'none', color: T.danger, cursor: 'pointer', fontWeight: 700, fontSize: '1rem', padding: 0 }}>×</button>
            )}
          </div>
        );
      })}
      <div style={{ padding: '8px 10px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
        <button onClick={addRow}
          style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, padding: '5px 12px', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', color: T.textMid }}>
          + Agregar producto
        </button>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: T.primary }}>
          Total: Q {fmt(productos.reduce((s, p) => s + (parseFloat(p.cajasPedidas) || 0) * (parseFloat(p.precioUnit) || 0), 0))}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Nuevo Pedido form ────────────────────────────────────────
function TabNuevoPedido({ catalogo, onSave, saving }) {
  const [form, setForm]   = useState({ ...BLANK_FORM, productos: [{ ...BLANK_PROD }] });
  const [editId, setEditId] = useState(null);
  const toast = useToast();

  const s  = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const total = form.productos.reduce((sum, p) => sum + (parseFloat(p.cajasPedidas) || 0) * (parseFloat(p.precioUnit) || 0), 0);

  const handleSave = async () => {
    if (!form.fecha) { toast('Ingresa la fecha', 'error'); return; }
    if (!form.productos.some(p => p.producto || p.cajasPedidas)) { toast('Agrega al menos un producto', 'error'); return; }
    const payload = {
      ...form,
      total,
      productos: form.productos.map(p => ({
        ...p,
        cajasPedidas: parseFloat(p.cajasPedidas) || 0,
        precioUnit: parseFloat(p.precioUnit) || 0,
        subtotal: (parseFloat(p.cajasPedidas) || 0) * (parseFloat(p.precioUnit) || 0),
      })),
      creadoEn: new Date().toISOString(),
    };
    try {
      await onSave(payload);
      toast('Pedido guardado');
      setForm({ ...BLANK_FORM, productos: [{ ...BLANK_PROD }] });
    } catch { toast('Error al guardar', 'error'); }
  };

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.textDark, marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
        Datos del Pedido
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 16 }}>
        <label style={LS}>Fecha de entrega *<input type="date" value={form.fecha} onChange={e => s('fecha', e.target.value)} style={IS} /></label>
        <label style={LS}>Cliente<input value={form.cliente} onChange={e => s('cliente', e.target.value)} style={IS} /></label>
        <label style={LS}>Número de Orden de Compra<input value={form.numOC} onChange={e => s('numOC', e.target.value)} placeholder="No. OC" style={IS} /></label>
        <label style={LS}>No. Atlas/SAP<input value={form.numAtlas} onChange={e => s('numAtlas', e.target.value)} placeholder="# Atlas o SAP" style={IS} /></label>
        <label style={LS}>Rampa / Almacén<input value={form.rampa} onChange={e => s('rampa', e.target.value)} placeholder="Ej. 5010" style={IS} /></label>
        <label style={LS}>Hora de entrega<input type="time" value={form.horaEntrega} onChange={e => s('horaEntrega', e.target.value)} style={IS} /></label>
      </div>

      <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em', marginBottom: 10 }}>
        Productos del Pedido
      </div>
      <ProductosGrid
        productos={form.productos}
        catalogo={catalogo}
        onChange={prods => s('productos', prods)}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 16 }}>
        <label style={LS}>No. FEL<input value={form.numFel} onChange={e => s('numFel', e.target.value)} placeholder="Factura electrónica" style={IS} /></label>
        <label style={LS}>
          Estado
          <select value={form.estado} onChange={e => s('estado', e.target.value)} style={IS}>
            {Object.entries(BADGE_CFG).map(([v, b]) => <option key={v} value={v}>{b.label}</option>)}
          </select>
        </label>
        {form.estado === 'con_rechazo' && (
          <label style={LS}>Motivo de rechazo<input value={form.motivoRechazo} onChange={e => s('motivoRechazo', e.target.value)} placeholder="Describe el rechazo" style={IS} /></label>
        )}
      </div>

      <label style={{ ...LS, marginBottom: 16 }}>
        Observaciones
        <textarea value={form.obs} onChange={e => s('obs', e.target.value)} rows={2}
          style={{ ...IS, resize: 'vertical' }} placeholder="Indicaciones especiales..." />
      </label>

      <button onClick={handleSave} disabled={saving}
        style={{ padding: '11px 28px', background: saving ? T.border : T.primary, color: T.white, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Guardando…' : 'Guardar Pedido'}
      </button>
    </div>
  );
}

// ── Tab: Calendario ───────────────────────────────────────────────
function TabCalendario({ data }) {
  const [refDate, setRefDate] = useState(new Date());
  const { mon, sun } = weekRange(refDate);

  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));

  const pedidosDelDia = (iso) => data.filter(r => (r.fecha || r.fechaEntrega) === iso);

  const prevWeek = () => setRefDate(d => addDays(d, -7));
  const nextWeek = () => setRefDate(d => addDays(d, 7));
  const goToday  = () => setRefDate(new Date());

  const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <div style={card}>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={prevWeek}
          style={{ padding: '7px 14px', background: T.bgLight, border: `1px solid ${T.border}`, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
          &#9664;
        </button>
        <div style={{ fontWeight: 700, color: T.primary, fontSize: '1rem', flex: 1, textAlign: 'center' }}>
          {isoDate(mon)} — {isoDate(sun)}
        </div>
        <button onClick={nextWeek}
          style={{ padding: '7px 14px', background: T.bgLight, border: `1px solid ${T.border}`, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
          &#9654;
        </button>
        <button onClick={goToday}
          style={{ padding: '7px 14px', background: T.bgGreen, border: `1px solid ${T.secondary}`, borderRadius: 6, cursor: 'pointer', fontWeight: 600, color: T.primary }}>
          Hoy
        </button>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {days.map((d, i) => {
          const iso     = isoDate(d);
          const pedidos = pedidosDelDia(iso);
          const isToday = iso === today();
          return (
            <div key={iso} style={{ border: `1.5px solid ${isToday ? T.primary : T.border}`, borderRadius: 8, padding: 8, minHeight: 120, background: isToday ? T.bgGreen : '#fff' }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: isToday ? T.primary : T.textMid, marginBottom: 6, textTransform: 'uppercase' }}>
                {DAYS_ES[i]}<br />
                <span style={{ fontSize: '1rem', color: T.textDark }}>{d.getDate()}</span>
              </div>
              {pedidos.length === 0 && (
                <div style={{ fontSize: '.68rem', color: T.textMid, fontStyle: 'italic' }}>Sin pedidos</div>
              )}
              {pedidos.map(p => {
                const bc = BADGE_CFG[p.estado] || { bg: '#F5F5F5', c: '#6B6B60' };
                return (
                  <div key={p.id} style={{ background: bc.bg, color: bc.c, borderRadius: 4, padding: '4px 7px', fontSize: '.65rem', fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>
                    {p.numOC ? `OC ${p.numOC}` : p.cliente || 'Walmart'}<br />
                    {bc.label}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap', fontSize: '.72rem' }}>
        {Object.entries(BADGE_CFG).map(([k, b]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, background: b.bg, border: `1px solid ${b.c}`, borderRadius: 2, display: 'inline-block' }} />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Cierre del día ───────────────────────────────────────────
function TabCierre({ data }) {
  const [fecha, setFecha] = useState(today());
  const [printed, setPrinted] = useState(false);

  const pedidosDia = useMemo(() => data.filter(r => (r.fecha || r.fechaEntrega) === fecha), [data, fecha]);

  const totalCajas      = pedidosDia.reduce((s, p) => s + (p.productos || []).reduce((ps, pr) => ps + (parseFloat(pr.cajasPedidas) || 0), 0), 0);
  const totalQ          = pedidosDia.reduce((s, p) => s + (p.total || 0), 0);
  const entregados      = pedidosDia.filter(p => p.estado === 'entregado').length;
  const conRechazo      = pedidosDia.filter(p => p.estado === 'con_rechazo');
  const sinStock        = pedidosDia.filter(p => p.estado === 'sin_stock').length;

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <label style={{ ...LS, flex: '0 0 auto' }}>
          Fecha del cierre
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...IS, width: 'auto' }} />
        </label>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total pedidos', value: pedidosDia.length, accent: T.primary },
          { label: 'Total cajas', value: totalCajas, accent: T.secondary },
          { label: 'Total Q facturado', value: `Q ${fmt(totalQ)}`, accent: T.warn },
          { label: 'Entregados', value: entregados, accent: T.secondary },
          { label: 'Con rechazo', value: conRechazo.length, accent: T.danger },
          { label: 'Sin stock', value: sinStock, accent: T.danger },
        ].map(m => (
          <div key={m.label} style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', borderTop: `3px solid ${m.accent}` }}>
            <div style={{ fontSize: '.7rem', fontWeight: 600, textTransform: 'uppercase', color: T.textMid, marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: m.accent }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Rejection list */}
      {conRechazo.length > 0 && (
        <div style={{ background: '#FFEBEE', border: `1px solid #FFCDD2`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: T.danger, marginBottom: 10, fontSize: '.85rem' }}>Pedidos con rechazo</div>
          {conRechazo.map(p => (
            <div key={p.id} style={{ background: '#fff', borderRadius: 6, padding: '10px 14px', marginBottom: 8, fontSize: '.83rem' }}>
              <strong>{p.numOC ? `OC ${p.numOC}` : p.id}</strong> — {p.cliente || 'Walmart'}<br />
              <span style={{ color: T.danger, fontSize: '.78rem' }}>{p.motivoRechazo || 'Sin motivo especificado'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Pedidos list */}
      {pedidosDia.length > 0 ? (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['OC', 'Atlas/SAP', 'Rampa', 'Cajas', 'Total Q', 'Estado'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedidosDia.map((p, i) => {
                  const cajas = (p.productos || []).reduce((s, pr) => s + (parseFloat(pr.cajasPedidas) || 0), 0);
                  return (
                    <tr key={p.id} style={{ background: i % 2 === 1 ? '#F9FBF9' : '#fff' }}>
                      <td style={{ ...tdSt, fontWeight: 600 }}>{p.numOC || '—'}</td>
                      <td style={tdSt}>{p.numAtlas || '—'}</td>
                      <td style={tdSt}>{p.rampa || '—'}</td>
                      <td style={{ ...tdSt, fontWeight: 600 }}>{cajas}</td>
                      <td style={{ ...tdSt, fontWeight: 700, color: T.primary }}>Q {fmt(p.total)}</td>
                      <td style={tdSt}><Badge estado={p.estado} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => { setPrinted(true); window.print(); }}
            style={{ marginTop: 16, padding: '10px 24px', background: T.primary, color: T.white, border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '.88rem' }}>
            Generar reporte del dia
          </button>
          {printed && <span style={{ marginLeft: 12, fontSize: '.8rem', color: T.secondary }}>Reporte enviado a impresion</span>}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: T.textMid, fontSize: '.88rem' }}>
          Sin pedidos para la fecha seleccionada.
        </div>
      )}
    </div>
  );
}

// ── Tab: Lista de pedidos ─────────────────────────────────────────
function TabLista({ data, loading, update, saving }) {
  const [filterTab, setFilterTab] = useState('todos');
  const [felOpen,   setFelOpen]   = useState(null);
  const toast = useToast();

  const FILTER_TABS = [
    { key: 'todos',       label: 'Todos' },
    { key: 'pendiente',   label: 'Pendiente' },
    { key: 'en_curso',    label: 'En Curso' },
    { key: 'entregado',   label: 'Entregado' },
    { key: 'con_rechazo', label: 'Con Rechazo' },
    { key: 'sin_stock',   label: 'Sin Stock' },
    { key: 'cerrado',     label: 'Cerrado' },
  ];

  const filtered = useMemo(() => (
    filterTab === 'todos' ? data : data.filter(r => r.estado === filterTab)
  ), [data, filterTab]);

  const cambiarEstado = async (id, estado) => {
    try { await update(id, { estado }); toast(`Estado actualizado: ${BADGE_CFG[estado]?.label || estado}`); }
    catch { toast('Error al actualizar estado', 'error'); }
  };

  const guardarFel = async (id, numFel) => {
    try { await update(id, { numFel }); setFelOpen(null); toast('FEL guardado'); }
    catch { toast('Error al guardar FEL', 'error'); }
  };

  return (
    <div style={card}>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {FILTER_TABS.map(ft => {
          const count = ft.key === 'todos' ? data.length : data.filter(r => r.estado === ft.key).length;
          return (
            <button key={ft.key} onClick={() => setFilterTab(ft.key)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: '.75rem', fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${filterTab === ft.key ? T.primary : T.border}`,
              background: filterTab === ft.key ? T.primary : T.white,
              color: filterTab === ft.key ? T.white : T.textMid,
            }}>
              {ft.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? <Skeleton rows={8} /> : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: T.textMid, fontSize: '.88rem' }}>
          Sin pedidos {filterTab !== 'todos' ? `con estado "${BADGE_CFG[filterTab]?.label}"` : ''}.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.primary }}>
                {['Fecha', 'OC', 'Atlas/SAP', 'Rampa', 'Productos', 'Total', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 120).map((r, i) => {
                const prods = (r.productos || []);
                const prodText = prods.length > 0
                  ? prods.slice(0, 2).map(p => `${p.producto || '?'} x${p.cajasPedidas || ''}`).join(', ') + (prods.length > 2 ? ` +${prods.length - 2}` : '')
                  : '—';
                return (
                  <tr key={r.id} style={{ background: i % 2 === 1 ? '#F9FBF9' : '#fff' }}>
                    <td style={{ ...tdSt, fontWeight: 600 }}>{r.fecha || r.fechaEntrega || '—'}</td>
                    <td style={{ ...tdSt, fontSize: '.78rem', fontFamily: 'monospace' }}>{r.numOC || '—'}</td>
                    <td style={{ ...tdSt, fontSize: '.78rem', color: T.textMid }}>{r.numAtlas || '—'}</td>
                    <td style={tdSt}>{r.rampa || '—'}</td>
                    <td style={{ ...tdSt, maxWidth: 200 }}>
                      <div style={{ fontSize: '.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prodText}</div>
                      <div style={{ fontSize: '.68rem', color: T.textMid, marginTop: 1 }}>{prods.length} producto{prods.length !== 1 ? 's' : ''}</div>
                    </td>
                    <td style={{ ...tdSt, fontWeight: 700, color: T.primary }}>
                      {r.total > 0 ? `Q ${fmt(r.total)}` : '—'}
                    </td>
                    <td style={tdSt}>
                      <Badge estado={r.estado} />
                      {felOpen === r.id && (
                        <FelEditor record={r} onSave={val => guardarFel(r.id, val)} />
                      )}
                      {felOpen !== r.id && r.numFel && (
                        <div style={{ fontSize: '.7rem', color: T.secondary, fontFamily: 'monospace', marginTop: 3 }}>{r.numFel}</div>
                      )}
                    </td>
                    <td style={tdSt}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {r.estado === 'pendiente' && (
                          <button onClick={() => cambiarEstado(r.id, 'entregado')}
                            style={{ padding: '4px 10px', background: T.secondary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Entregar
                          </button>
                        )}
                        {r.estado !== 'cerrado' && r.estado !== 'cancelado' && (
                          <button onClick={() => cambiarEstado(r.id, 'cerrado')}
                            style={{ padding: '4px 10px', background: '#F5F5F5', color: T.textMid, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Cerrar
                          </button>
                        )}
                        <button onClick={() => setFelOpen(felOpen === r.id ? null : r.id)}
                          style={{ padding: '4px 10px', background: '#E3F2FD', color: '#1565C0', border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {felOpen === r.id ? 'Cerrar' : 'FEL'}
                        </button>
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
  );
}

// ── Main component ────────────────────────────────────────────────
export default function Walmart() {
  const { data, loading }        = useCollection('pedidosWalmart', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { add, update, saving }  = useWrite('pedidosWalmart');
  const { productos: catalogo }  = useProductosCatalogo();

  const [tab, setTab] = useState('lista');

  const pendientes      = data.filter(r => r.estado === 'pendiente').length;
  const entregadosHoy   = data.filter(r => r.estado === 'entregado' && (r.fecha || r.fechaEntrega) === today()).length;
  const totalQ          = useMemo(() => data.filter(r => r.estado !== 'cerrado').reduce((s, r) => s + (r.total || 0), 0), [data]);

  const TABS = [
    { id: 'lista',      label: 'Pedidos' },
    { id: 'calendario', label: 'Calendario' },
    { id: 'cierre',     label: 'Cierre del Dia' },
    { id: 'nuevo',      label: 'Nuevo Pedido' },
  ];

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: T.textDark }}>Pedidos Walmart</h2>
        <p style={{ margin: '4px 0 0', fontSize: '.83rem', color: T.textMid }}>
          Registro de pedidos, calendario semanal y cierre diario
        </p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <MetricCard label="Pendientes"      value={loading ? '…' : pendientes}               accent={T.warn} />
        <MetricCard label="Entregados hoy"  value={loading ? '…' : entregadosHoy}            accent={T.secondary} />
        <MetricCard label="Valor activo Q"  value={loading ? '…' : `Q ${fmt(totalQ)}`}       accent={T.primary} />
        <MetricCard label="Total registros" value={loading ? '…' : data.length}              accent={T.textMid} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.border}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '11px 8px', border: 'none', fontWeight: 600, fontSize: '.83rem', cursor: 'pointer',
            background: tab === t.id ? T.primary : T.white,
            color: tab === t.id ? T.white : T.textMid,
            borderRight: `1px solid ${T.border}`,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'lista'      && <TabLista data={data} loading={loading} update={update} saving={saving} />}
      {tab === 'calendario' && <TabCalendario data={data} />}
      {tab === 'cierre'     && <TabCierre data={data} />}
      {tab === 'nuevo'      && <TabNuevoPedido catalogo={catalogo} onSave={add} saving={saving} />}
    </div>
  );
}
