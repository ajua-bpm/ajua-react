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
};

const card   = { background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 20, marginBottom: 20 };
const LS     = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em' };
const IS     = { padding: '9px 12px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.85rem', outline: 'none', fontFamily: 'inherit', width: '100%', marginTop: 2, color: T.textDark, background: T.white, boxSizing: 'border-box' };
const thSt   = { padding: '9px 12px', fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: T.white, background: T.primary, textAlign: 'left', whiteSpace: 'nowrap' };
const tdSt   = { padding: '8px 12px', fontSize: '.82rem', borderBottom: `1px solid ${T.border}`, color: T.textDark };

const TIPOS_OFERTA = [
  { value: 'privada',      label: 'Cliente Privado' },
  { value: 'guatecompras', label: 'Guatecompras' },
  { value: 'walmart',      label: 'Walmart' },
  { value: 'exportacion',  label: 'Exportacion' },
  { value: 'otro',         label: 'Otro' },
];

const ESTADOS_OFERTA = [
  { value: 'borrador',   label: 'Borrador',   bg: '#F5F5F5', color: '#6B6B60' },
  { value: 'enviada',    label: 'Enviada',    bg: '#FFF3E0', color: '#E65100' },
  { value: 'ganada',     label: 'Ganada',     bg: '#E8F5E9', color: '#1B5E20' },
  { value: 'perdida',    label: 'Perdida',    bg: '#FFEBEE', color: '#C62828' },
  { value: 'cancelada',  label: 'Cancelada',  bg: '#EEEEEE', color: '#424242' },
];

const GC_CHECKLIST_DEFAULT = [
  'Bases descargadas', 'NIT activo en SAT', 'DPI representante legal',
  'Patente de comercio', 'Acreditacion BPM', 'Muestras enviadas',
];

const UNIDADES = ['lb', 'kg', 'quintal', 'caja', 'unidad', 'docena', 'bolsa', 'canasta', 'saco', 'galon'];

const today = () => new Date().toISOString().slice(0, 10);

const fmtQ = (n) => 'Q ' + (parseFloat(n) || 0).toFixed(2);

function EstadoBadge({ estado }) {
  const e = ESTADOS_OFERTA.find(x => x.value === estado) || ESTADOS_OFERTA[0];
  return (
    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.68rem', fontWeight: 700, background: e.bg, color: e.color }}>
      {e.label}
    </span>
  );
}

const BLANK_FORM = {
  fecha: today(), cliente: '', clienteNuevo: '', tipoOferta: 'privada',
  referencia: '', fechaEntrega: '', estado: 'borrador', observaciones: '',
  comisionPct: '',
};

const BLANK_PROD = () => ({ _key: Math.random(), codigo: '', producto: '', cantidad: 1, unidad: 'lb', precioUnit: 0 });
const BLANK_GASTO = () => ({ _key: Math.random(), concepto: '', monto: 0 });
const BLANK_CHK = (text) => ({ _key: Math.random(), text, done: false });

// ── Main component ────────────────────────────────────────────────
export default function CotizadorRapido() {
  const toast = useToast();
  const { data: ofertas, loading } = useCollection('cotizadorRapido', { orderField: '_ts', orderDir: 'desc', limit: 300 });
  const { add, update, remove, saving } = useWrite('cotizadorRapido');
  const { clientes } = useClientes();
  const { productos: catProductos } = useProductosCatalogo();

  const [form, setForm]           = useState({ ...BLANK_FORM });
  const [editId, setEditId]       = useState(null);
  const [productos, setProductos] = useState([BLANK_PROD()]);
  const [gastos, setGastos]       = useState([]);
  const [checklist, setChecklist] = useState(GC_CHECKLIST_DEFAULT.map(BLANK_CHK));
  const [chkInput, setChkInput]   = useState('');
  const [filterTab, setFilterTab] = useState('todas');

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Totals ────────────────────────────────────────────────────
  const totalProductos = useMemo(
    () => productos.reduce((s, p) => s + (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnit) || 0), 0),
    [productos]
  );
  const totalGastos = useMemo(
    () => gastos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0),
    [gastos]
  );
  const comisionQ = useMemo(
    () => form.comisionPct ? (totalProductos + totalGastos) * parseFloat(form.comisionPct) / 100 : 0,
    [totalProductos, totalGastos, form.comisionPct]
  );
  const totalGeneral = totalProductos + totalGastos + comisionQ;

  // ── Productos table handlers ──────────────────────────────────
  const addProducto = () => setProductos(p => [...p, BLANK_PROD()]);
  const removeProducto = (key) => setProductos(p => p.filter(x => x._key !== key));
  const setProd = (key, field, val) => setProductos(p => p.map(x => x._key === key ? { ...x, [field]: val } : x));

  // ── Gastos handlers ───────────────────────────────────────────
  const addGasto = () => setGastos(g => [...g, BLANK_GASTO()]);
  const removeGasto = (key) => setGastos(g => g.filter(x => x._key !== key));
  const setGasto = (key, field, val) => setGastos(g => g.map(x => x._key === key ? { ...x, [field]: val } : x));

  // ── Checklist handlers ────────────────────────────────────────
  const addChkItem = () => {
    if (!chkInput.trim()) return;
    setChecklist(c => [...c, BLANK_CHK(chkInput.trim())]);
    setChkInput('');
  };
  const toggleChk = (key) => setChecklist(c => c.map(x => x._key === key ? { ...x, done: !x.done } : x));
  const removeChk = (key) => setChecklist(c => c.filter(x => x._key !== key));

  // ── Reset form ────────────────────────────────────────────────
  const resetForm = () => {
    setForm({ ...BLANK_FORM, fecha: today() });
    setProductos([BLANK_PROD()]);
    setGastos([]);
    setChecklist(GC_CHECKLIST_DEFAULT.map(BLANK_CHK));
    setChkInput('');
    setEditId(null);
  };

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    const clienteFinal = form.clienteNuevo.trim() || form.cliente;
    if (!form.fecha || !clienteFinal) { toast('Complete fecha y cliente', 'error'); return; }
    if (!productos.some(p => p.producto || p.codigo)) { toast('Agrega al menos un producto', 'error'); return; }

    const prods = productos.map(({ _key, ...p }) => ({
      ...p,
      cantidad: parseFloat(p.cantidad) || 0,
      precioUnit: parseFloat(p.precioUnit) || 0,
      subtotal: (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnit) || 0),
    }));
    const gasts = gastos.map(({ _key, ...g }) => ({ ...g, monto: parseFloat(g.monto) || 0 }));
    const chks  = checklist.map(({ _key, ...c }) => c);

    const payload = {
      fecha: form.fecha,
      cliente: clienteFinal,
      tipoOferta: form.tipoOferta,
      referencia: form.referencia,
      fechaEntrega: form.fechaEntrega,
      estado: form.estado,
      observaciones: form.observaciones,
      productos: prods,
      gastosVarios: gasts,
      comisionPct: parseFloat(form.comisionPct) || 0,
      comisionQ,
      totalProductos,
      totalGastos,
      total: totalGeneral,
      reqChecklist: chks,
      creadoEn: editId ? undefined : new Date().toISOString(),
    };
    if (!editId) delete payload.creadoEn; // will be set by useWrite _ts

    if (editId) {
      await update(editId, payload);
      toast('Oferta actualizada');
    } else {
      await add({ ...payload, creadoEn: new Date().toISOString() });
      toast('Oferta guardada');
    }
    resetForm();
  };

  // ── Edit ──────────────────────────────────────────────────────
  const startEdit = (r) => {
    setForm({
      fecha: r.fecha || today(),
      cliente: r.cliente || '',
      clienteNuevo: '',
      tipoOferta: r.tipoOferta || 'privada',
      referencia: r.referencia || '',
      fechaEntrega: r.fechaEntrega || '',
      estado: r.estado || 'borrador',
      observaciones: r.observaciones || '',
      comisionPct: r.comisionPct ? String(r.comisionPct) : '',
    });
    setProductos((r.productos || [BLANK_PROD()]).map(p => ({ ...p, _key: Math.random() })));
    setGastos((r.gastosVarios || []).map(g => ({ ...g, _key: Math.random() })));
    setChecklist((r.reqChecklist || GC_CHECKLIST_DEFAULT.map(t => ({ text: t, done: false }))).map(c => ({ ...c, _key: Math.random() })));
    setEditId(r.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminar esta oferta?')) return;
    await remove(id); toast('Oferta eliminada');
  };

  // ── Filter ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filterTab === 'todas') return ofertas;
    return ofertas.filter(r => r.estado === filterTab);
  }, [ofertas, filterTab]);

  const FILTER_TABS = ['todas', 'borrador', 'enviada', 'ganada', 'perdida', 'cancelada'];

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Cotizador Rapido
        </h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>
          Ofertas comerciales, Guatecompras, clientes privados — seguimiento y estados
        </p>
      </div>

      {/* ── FORM ─────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.primary, marginBottom: 18, borderBottom: `2px solid ${T.primary}`, paddingBottom: 8 }}>
          {editId ? 'Editando oferta' : 'Nueva oferta / cotizacion'}
        </div>

        {/* Datos basicos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', gap: 14, marginBottom: 14 }}>
          <label style={LS}>
            Fecha presentacion *
            <input type="date" value={form.fecha} onChange={e => sf('fecha', e.target.value)} style={IS} />
          </label>
          <label style={LS}>
            Cliente / Entidad *
            <select value={form.cliente} onChange={e => sf('cliente', e.target.value)} style={IS}>
              <option value="">— Seleccionar —</option>
              {clientes.map(c => <option key={c.id || c.nombre} value={c.nombre}>{c.nombre}</option>)}
              <option value="__nuevo__">+ Nuevo cliente...</option>
            </select>
          </label>
          {(form.cliente === '__nuevo__' || !form.cliente) && (
            <label style={LS}>
              Nombre cliente (nuevo)
              <input value={form.clienteNuevo} onChange={e => sf('clienteNuevo', e.target.value)}
                placeholder="Nombre del cliente o entidad publica" style={IS} />
            </label>
          )}
          <label style={LS}>
            Tipo de oferta
            <select value={form.tipoOferta} onChange={e => sf('tipoOferta', e.target.value)} style={IS}>
              {TIPOS_OFERTA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label style={LS}>
            Referencia / No. oferta
            <input value={form.referencia} onChange={e => sf('referencia', e.target.value)}
              placeholder="Ej. NOG-2026-001" style={IS} />
          </label>
          <label style={LS}>
            Fecha posible entrega
            <input type="date" value={form.fechaEntrega} onChange={e => sf('fechaEntrega', e.target.value)} style={IS} />
          </label>
          <label style={LS}>
            Estado
            <select value={form.estado} onChange={e => sf('estado', e.target.value)} style={IS}>
              {ESTADOS_OFERTA.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </label>
          <label style={LS}>
            Comision (%)
            <input type="number" min="0" max="100" step="0.1" value={form.comisionPct}
              onChange={e => sf('comisionPct', e.target.value)} placeholder="0" style={IS} />
          </label>
        </div>

        {/* Checklist Guatecompras */}
        {form.tipoOferta === 'guatecompras' && (
          <div style={{ marginBottom: 16, padding: 14, background: T.bgGreen, borderRadius: 6, border: `1px solid ${T.secondary}30` }}>
            <div style={{ fontWeight: 700, fontSize: '.82rem', color: T.primary, marginBottom: 10 }}>
              Checklist de Requisitos Guatecompras
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                value={chkInput}
                onChange={e => setChkInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addChkItem())}
                placeholder="Nuevo requisito..."
                style={{ ...IS, flex: 1 }}
              />
              <button onClick={addChkItem} style={{ padding: '9px 16px', background: T.secondary, color: T.white, border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '.82rem', whiteSpace: 'nowrap' }}>
                + Agregar
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {checklist.map(item => (
                <div key={item._key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: item.done ? '#C8E6C9' : '#fff', borderRadius: 5, border: `1px solid ${item.done ? T.secondary : T.border}` }}>
                  <input type="checkbox" checked={item.done} onChange={() => toggleChk(item._key)}
                    style={{ width: 16, height: 16, accentColor: T.primary, cursor: 'pointer' }} />
                  <span style={{ flex: 1, fontSize: '.82rem', textDecoration: item.done ? 'line-through' : 'none', color: item.done ? T.textMid : T.textDark }}>
                    {item.text}
                  </span>
                  <button onClick={() => removeChk(item._key)}
                    style={{ background: 'none', border: 'none', color: T.textMid, cursor: 'pointer', fontSize: '.9rem', padding: '0 4px', lineHeight: 1 }}>
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabla productos */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: '.88rem', color: T.primary }}>Productos de la oferta</span>
            <button onClick={addProducto} style={{ padding: '7px 14px', background: T.secondary, color: T.white, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '.78rem', fontWeight: 600 }}>
              + Agregar producto
            </button>
          </div>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead>
                <tr>
                  {['Codigo', 'Producto / Descripcion', 'Cantidad', 'Unidad', 'Precio Unit (Q)', 'Subtotal', ''].map(h => (
                    <th key={h} style={{ ...thSt, padding: '8px 10px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productos.map((p, i) => {
                  const sub = (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnit) || 0);
                  return (
                    <tr key={p._key} style={{ background: i % 2 ? '#F9FBF9' : '#fff' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <input value={p.codigo} onChange={e => setProd(p._key, 'codigo', e.target.value)}
                          placeholder="Cod." style={{ ...IS, width: 70, marginTop: 0 }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <select value={p.producto} onChange={e => setProd(p._key, 'producto', e.target.value)}
                          style={{ ...IS, minWidth: 160, marginTop: 0 }}>
                          <option value="">— Producto —</option>
                          {catProductos.map(pr => <option key={pr.id || pr.nombre} value={pr.nombre}>{pr.nombre}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="number" min="0" step="0.01" value={p.cantidad}
                          onChange={e => setProd(p._key, 'cantidad', e.target.value)}
                          style={{ ...IS, width: 80, textAlign: 'right', marginTop: 0 }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <select value={p.unidad} onChange={e => setProd(p._key, 'unidad', e.target.value)}
                          style={{ ...IS, width: 90, marginTop: 0 }}>
                          {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="number" min="0" step="0.0001" value={p.precioUnit}
                          onChange={e => setProd(p._key, 'precioUnit', e.target.value)}
                          style={{ ...IS, width: 100, textAlign: 'right', marginTop: 0 }} />
                      </td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: T.primary, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {fmtQ(sub)}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <button onClick={() => removeProducto(p._key)}
                          style={{ background: 'none', border: `1px solid ${T.danger}`, color: T.danger, borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: '.72rem' }}>
                          x
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: T.bgGreen, borderTop: `2px solid ${T.primary}` }}>
                  <td colSpan={5} style={{ padding: '10px 12px', fontWeight: 700, color: T.primary, fontSize: '.82rem' }}>TOTAL PRODUCTOS</td>
                  <td style={{ padding: '10px 10px', fontWeight: 800, fontSize: '.95rem', color: T.primary, textAlign: 'right' }}>{fmtQ(totalProductos)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Gastos varios */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: '.88rem', color: T.primary }}>Gastos varios</span>
            <button onClick={addGasto} style={{ padding: '7px 14px', background: T.secondary, color: T.white, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '.78rem', fontWeight: 600 }}>
              + Agregar gasto
            </button>
          </div>
          {gastos.length === 0 ? (
            <p style={{ fontSize: '.78rem', color: T.textMid, margin: 0 }}>Sin gastos adicionales.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {gastos.map(g => (
                <div key={g._key} style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#F9FBF9', border: `1px solid ${T.border}`, borderRadius: 6, padding: '8px 10px' }}>
                  <input value={g.concepto} onChange={e => setGasto(g._key, 'concepto', e.target.value)}
                    placeholder="Concepto del gasto" style={{ ...IS, flex: 1, marginTop: 0 }} />
                  <span style={{ fontSize: '.8rem', color: T.textMid }}>Q</span>
                  <input type="number" min="0" step="0.01" value={g.monto} onChange={e => setGasto(g._key, 'monto', e.target.value)}
                    style={{ ...IS, width: 100, textAlign: 'right', marginTop: 0 }} />
                  <button onClick={() => removeGasto(g._key)}
                    style={{ background: 'none', border: `1px solid ${T.danger}`, color: T.danger, borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: '.72rem' }}>
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumen de totales */}
        <div style={{ background: T.bgGreen, borderRadius: 6, padding: '14px 18px', marginBottom: 16, border: `1px solid ${T.secondary}40` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            <div>
              <div style={{ fontSize: '.68rem', color: T.textMid, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Subtotal productos</div>
              <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.textDark }}>{fmtQ(totalProductos)}</div>
            </div>
            <div>
              <div style={{ fontSize: '.68rem', color: T.textMid, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Subtotal gastos</div>
              <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.textDark }}>{fmtQ(totalGastos)}</div>
            </div>
            {comisionQ > 0 && (
              <div>
                <div style={{ fontSize: '.68rem', color: T.warn, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Comision ({form.comisionPct}%)</div>
                <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.warn }}>{fmtQ(comisionQ)}</div>
              </div>
            )}
            <div style={{ borderLeft: `2px solid ${T.primary}`, paddingLeft: 14 }}>
              <div style={{ fontSize: '.68rem', color: T.primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>TOTAL GENERAL</div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: T.primary }}>{fmtQ(totalGeneral)}</div>
            </div>
          </div>
        </div>

        {/* Observaciones */}
        <label style={{ ...LS, marginBottom: 16 }}>
          Observaciones
          <textarea value={form.observaciones} onChange={e => sf('observaciones', e.target.value)}
            rows={3} placeholder="Notas adicionales, condiciones especiales, compromisos..."
            style={{ ...IS, resize: 'vertical' }} />
        </label>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '11px 28px', background: saving ? T.textMid : T.primary, color: T.white,
            border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Guardando...' : editId ? 'Actualizar oferta' : 'Guardar oferta'}
          </button>
          {editId && (
            <button onClick={resetForm} style={{ padding: '11px 20px', background: '#F5F5F5', border: `1px solid ${T.border}`, borderRadius: 6, fontWeight: 600, cursor: 'pointer', color: T.textMid }}>
              Cancelar edicion
            </button>
          )}
        </div>
      </div>

      {/* ── HISTORIAL ──────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary, marginBottom: 14 }}>
          Historial de ofertas
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {FILTER_TABS.map(tab => (
            <button key={tab} onClick={() => setFilterTab(tab)} style={{
              padding: '5px 14px', borderRadius: 100, fontSize: '.75rem', fontWeight: 600,
              cursor: 'pointer', border: `1.5px solid ${filterTab === tab ? T.primary : T.border}`,
              background: filterTab === tab ? T.primary : '#fff',
              color: filterTab === tab ? T.white : T.textMid,
              textTransform: 'capitalize',
            }}>
              {tab === 'todas' ? `Todas (${ofertas.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {loading ? <Skeleton rows={6} /> : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.textMid, fontSize: '.88rem' }}>
            Sin ofertas registradas
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Fecha', 'Cliente', 'Tipo', 'Referencia', 'F. Entrega', 'Total Q', 'Estado', 'Acciones'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const tipoLbl = TIPOS_OFERTA.find(t => t.value === r.tipoOferta)?.label || r.tipoOferta || '—';
                  return (
                    <tr key={r.id} style={{ background: i % 2 ? '#F9FBF9' : '#fff' }}>
                      <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{r.fecha || '—'}</td>
                      <td style={{ ...tdSt, fontWeight: 600 }}>{r.cliente || '—'}</td>
                      <td style={{ ...tdSt, fontSize: '.72rem', color: T.textMid }}>{tipoLbl}</td>
                      <td style={{ ...tdSt, fontSize: '.75rem', color: T.textMid }}>{r.referencia || '—'}</td>
                      <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{r.fechaEntrega || '—'}</td>
                      <td style={{ ...tdSt, fontWeight: 700, color: T.primary, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {fmtQ(r.total || r.totalProductos || 0)}
                      </td>
                      <td style={tdSt}><EstadoBadge estado={r.estado} /></td>
                      <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => startEdit(r)} style={{ padding: '4px 10px', background: T.primary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.7rem', fontWeight: 600, cursor: 'pointer' }}>
                            Editar
                          </button>
                          <button onClick={() => handleDelete(r.id)} style={{ padding: '4px 10px', background: T.danger, color: T.white, border: 'none', borderRadius: 4, fontSize: '.7rem', fontWeight: 600, cursor: 'pointer' }}>
                            Eliminar
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
    </div>
  );
}
