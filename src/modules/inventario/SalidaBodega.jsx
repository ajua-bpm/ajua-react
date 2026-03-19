import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useProductosCatalogo, useClientes } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ── Design tokens ─────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', danger: '#C62828',
  warn: '#E65100', textDark: '#1A1A18', textMid: '#6B6B60',
  border: '#E0E0E0', bgGreen: '#E8F5E9', white: '#FFFFFF',
  info: '#1565C0',
};

const card  = { background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 20, marginBottom: 20 };
const LS    = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em' };
const IS    = { padding: '9px 12px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.85rem', outline: 'none', fontFamily: 'inherit', width: '100%', marginTop: 2, color: T.textDark, background: T.white, boxSizing: 'border-box' };
const thSt  = { padding: '9px 12px', fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: T.white, background: T.primary, textAlign: 'left', whiteSpace: 'nowrap' };
const tdSt  = { padding: '8px 12px', fontSize: '.82rem', borderBottom: `1px solid ${T.border}`, color: T.textDark };

const ESTADOS = ['pendiente', 'entregado', 'rechazado', 'cancelado'];
const ESTADO_COLORS = {
  pendiente:  { bg: '#FFF3E0', c: '#E65100' },
  entregado:  { bg: '#E8F5E9', c: '#1B5E20' },
  rechazado:  { bg: '#FFEBEE', c: '#C62828' },
  cancelado:  { bg: '#EEEEEE', c: '#1A1A18' },
};

const today    = () => new Date().toISOString().slice(0, 10);
const nowTime  = () => new Date().toTimeString().slice(0, 5);
const fmtQ     = (n) => 'Q ' + (parseFloat(n) || 0).toFixed(2);

const BLANK_PROD = () => ({ _key: Math.random(), codigo: '', producto: '', cajasPedidas: 0, cajasEnviadas: 0, precioUnit: 0 });

const BLANK_FORM = () => ({
  fecha: today(), cliente: 'Walmart Guatemala', numOC: '', numEntrega: '',
  rampa: '', horaEntrega: nowTime(), numFel: '', estado: 'pendiente', obs: '',
});

function EstadoBadge({ estado }) {
  const e = ESTADO_COLORS[estado] || ESTADO_COLORS.pendiente;
  return (
    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.68rem', fontWeight: 700, background: e.bg, color: e.c }}>
      {estado || '—'}
    </span>
  );
}

// ── OC Text Parser ────────────────────────────────────────────────
function parseOCText(text) {
  const result = { numOC: '', fechaEntrega: '', productos: [] };
  if (!text) return result;

  // OC number: OC-XXXXXXX, OC XXXXXXX, or "orden de compra" NNNN
  const ocMatch = text.match(/\bOC[-\s]?(\w{5,10})\b/i) || text.match(/orden\s+de\s+compra[:\s#]+([A-Z0-9-]{4,12})/i);
  if (ocMatch) result.numOC = ocMatch[1] || ocMatch[0];

  // Fecha entrega
  const fechaMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (fechaMatch) {
    const [, d, m, y] = fechaMatch;
    const yy = y.length === 2 ? '20' + y : y;
    result.fechaEntrega = `${yy}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // Products: lines that have a number followed by text (basic heuristic)
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  lines.forEach(line => {
    // Look for pattern: qty + product name  OR  product name + qty
    const m1 = line.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
    const m2 = line.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:cajas?|unidades?|lbs?)?$/i);
    if (m1) {
      const qty = parseFloat(m1[1].replace(',', '.')) || 0;
      const name = m1[2].trim();
      if (qty > 0 && name.length > 2) {
        result.productos.push({ _key: Math.random(), codigo: '', producto: name, cajasPedidas: qty, cajasEnviadas: qty, precioUnit: 0 });
      }
    } else if (m2) {
      const name = m2[1].trim();
      const qty = parseFloat(m2[2].replace(',', '.')) || 0;
      if (qty > 0 && name.length > 2) {
        result.productos.push({ _key: Math.random(), codigo: '', producto: name, cajasPedidas: qty, cajasEnviadas: qty, precioUnit: 0 });
      }
    }
  });

  return result;
}

// ── Main component ────────────────────────────────────────────────
export default function SalidaBodega() {
  const toast = useToast();
  const { data: salidas, loading }   = useCollection('isalidas', { orderField: '_ts', orderDir: 'desc', limit: 300 });
  const { productos: catProd }       = useProductosCatalogo();
  const { clientes }                 = useClientes();
  const { add, saving }              = useWrite('isalidas');

  const [activeTab, setActiveTab]     = useState('registrar');
  const [form, setForm]               = useState(BLANK_FORM());
  const [productos, setProductos]     = useState([BLANK_PROD()]);
  const [ocText, setOcText]           = useState('');
  const [parsedPreview, setParsedPreview] = useState(null);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Products ──────────────────────────────────────────────────
  const addProd   = () => setProductos(p => [...p, BLANK_PROD()]);
  const removeProd = (key) => setProductos(p => p.filter(x => x._key !== key));
  const setProd   = (key, field, val) => setProductos(p => p.map(x => x._key === key ? { ...x, [field]: val } : x));

  // ── Fiscal breakdown ──────────────────────────────────────────
  const { subtotalConIva, netoBase, iva, retencion, totalACobrar, totalCajas } = useMemo(() => {
    const subtotalConIva = productos.reduce((s, p) => {
      return s + (parseFloat(p.cajasEnviadas) || 0) * (parseFloat(p.precioUnit) || 0);
    }, 0);
    const totalCajas = productos.reduce((s, p) => s + (parseFloat(p.cajasEnviadas) || 0), 0);
    const netoBase   = subtotalConIva / 1.12;
    const iva        = netoBase * 0.12;
    const retencion  = iva * 0.80;
    const totalACobrar = subtotalConIva - retencion;
    return { subtotalConIva, netoBase, iva, retencion, totalACobrar, totalCajas };
  }, [productos]);

  // ── OC Parser ─────────────────────────────────────────────────
  const handleParsearOC = () => {
    const parsed = parseOCText(ocText);
    setParsedPreview(parsed);
  };

  const handleConfirmarOC = () => {
    if (!parsedPreview) return;
    if (parsedPreview.numOC) sf('numOC', parsedPreview.numOC);
    if (parsedPreview.fechaEntrega) sf('fecha', parsedPreview.fechaEntrega);
    if (parsedPreview.productos.length > 0) {
      setProductos(parsedPreview.productos);
    }
    setParsedPreview(null);
    setOcText('');
    toast('OC aplicada al formulario');
  };

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.fecha || !form.numOC) { toast('Fecha y numero de OC son requeridos', 'error'); return; }
    if (!productos.some(p => p.producto)) { toast('Agrega al menos un producto', 'error'); return; }

    const prods = productos.map(({ _key, ...p }) => ({
      ...p,
      cajasPedidas: parseFloat(p.cajasPedidas) || 0,
      cajasEnviadas: parseFloat(p.cajasEnviadas) || 0,
      precioUnit: parseFloat(p.precioUnit) || 0,
      subtotal: (parseFloat(p.cajasEnviadas) || 0) * (parseFloat(p.precioUnit) || 0),
    }));

    await add({
      fecha:       form.fecha,
      cliente:     form.cliente,
      numOC:       form.numOC,
      numEntrega:  form.numEntrega,
      rampa:       form.rampa,
      horaEntrega: form.horaEntrega,
      productos:   prods,
      numFel:      form.numFel,
      subtotal:    netoBase,
      iva,
      retencion,
      total:       subtotalConIva,
      totalACobrar,
      totalCajas,
      estado:      form.estado,
      obs:         form.obs,
      creadoEn:    new Date().toISOString(),
    });

    toast('Venta registrada correctamente');
    setForm(BLANK_FORM());
    setProductos([BLANK_PROD()]);
    setOcText('');
    setParsedPreview(null);
  };

  // ── Tab styles ────────────────────────────────────────────────
  const tabBtn = (key) => ({
    padding: '9px 20px', fontWeight: 600, fontSize: '.82rem', cursor: 'pointer',
    border: 'none', borderBottom: `3px solid ${activeTab === key ? T.primary : 'transparent'}`,
    background: 'transparent', color: activeTab === key ? T.primary : T.textMid,
    transition: 'all .15s',
  });

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Ventas Walmart
        </h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>
          Registro de despachos Walmart. IVA + retencion 80% calculados automaticamente.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `2px solid ${T.border}`, marginBottom: 20 }}>
        <button style={tabBtn('registrar')} onClick={() => setActiveTab('registrar')}>Registrar Salida</button>
        <button style={tabBtn('historial')} onClick={() => setActiveTab('historial')}>
          Historial ({salidas.length})
        </button>
      </div>

      {/* ── TAB: REGISTRAR ──────────────────────────────────── */}
      {activeTab === 'registrar' && (
        <>
          {/* OC Parser */}
          <div style={{ ...card, borderTop: `3px solid ${T.info}` }}>
            <div style={{ fontWeight: 700, fontSize: '.88rem', color: T.info, marginBottom: 12 }}>
              Parser de OC Walmart (opcional)
            </div>
            <p style={{ fontSize: '.78rem', color: T.textMid, marginBottom: 10, marginTop: 0 }}>
              Pega el texto del correo o OC de Walmart. El sistema extraera: numero de OC, fecha y productos.
            </p>
            <textarea
              value={ocText}
              onChange={e => setOcText(e.target.value)}
              rows={5}
              placeholder="Pegar texto del correo / OC de Walmart aqui..."
              style={{ ...IS, resize: 'vertical', fontFamily: 'monospace', fontSize: '.8rem' }}
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button onClick={handleParsearOC} disabled={!ocText.trim()} style={{
                padding: '9px 18px', background: T.info, color: T.white, border: 'none',
                borderRadius: 6, cursor: ocText.trim() ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '.82rem',
              }}>
                Parsear OC
              </button>
              {parsedPreview && (
                <button onClick={() => setParsedPreview(null)} style={{ padding: '9px 14px', background: '#F5F5F5', border: `1px solid ${T.border}`, borderRadius: 6, cursor: 'pointer', fontSize: '.82rem', color: T.textMid }}>
                  Descartar
                </button>
              )}
            </div>

            {/* Parsed preview */}
            {parsedPreview && (
              <div style={{ marginTop: 14, padding: 14, background: '#E3F2FD', borderRadius: 6, border: `1px solid ${T.info}40` }}>
                <div style={{ fontWeight: 700, fontSize: '.82rem', color: T.info, marginBottom: 10 }}>Vista previa del parsing</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: '.65rem', color: T.textMid, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>No. OC</div>
                    <div style={{ fontWeight: 700 }}>{parsedPreview.numOC || '(no detectado)'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '.65rem', color: T.textMid, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Fecha entrega</div>
                    <div style={{ fontWeight: 700 }}>{parsedPreview.fechaEntrega || '(no detectada)'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '.65rem', color: T.textMid, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Productos detectados</div>
                    <div style={{ fontWeight: 700 }}>{parsedPreview.productos.length}</div>
                  </div>
                </div>
                {parsedPreview.productos.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                      <thead>
                        <tr style={{ background: T.info }}>
                          <th style={{ ...thSt, padding: '6px 10px' }}>Producto</th>
                          <th style={{ ...thSt, padding: '6px 10px' }}>Cajas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedPreview.productos.map(p => (
                          <tr key={p._key} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td style={{ padding: '6px 10px' }}>{p.producto}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{p.cajasPedidas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button onClick={handleConfirmarOC} style={{
                  marginTop: 12, padding: '9px 20px', background: T.secondary, color: T.white,
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '.82rem',
                }}>
                  Confirmar y aplicar al formulario
                </button>
              </div>
            )}
          </div>

          {/* Datos de la venta */}
          <div style={{ ...card, borderTop: `3px solid ${T.warn}` }}>
            <div style={{ fontWeight: 700, fontSize: '.88rem', color: T.warn, marginBottom: 14 }}>
              Datos de la venta — verificar
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 14, marginBottom: 14 }}>
              <label style={LS}>
                Fecha
                <input type="date" value={form.fecha} onChange={e => sf('fecha', e.target.value)} style={IS} />
              </label>
              <label style={LS}>
                Cliente
                <select value={form.cliente} onChange={e => sf('cliente', e.target.value)} style={IS}>
                  <option value="Walmart Guatemala">Walmart Guatemala</option>
                  {clientes.filter(c => c.nombre !== 'Walmart Guatemala').map(c => (
                    <option key={c.id || c.nombre} value={c.nombre}>{c.nombre}</option>
                  ))}
                </select>
              </label>
              <label style={LS}>
                Orden de compra (OC) *
                <input value={form.numOC} onChange={e => sf('numOC', e.target.value)}
                  placeholder="Numero de OC" style={IS} />
              </label>
              <label style={LS}>
                No. Entrega / Albaran
                <input value={form.numEntrega} onChange={e => sf('numEntrega', e.target.value)}
                  placeholder="No. de entrega" style={IS} />
              </label>
              <label style={LS}>
                Rampa / Almacen destino
                <input value={form.rampa} onChange={e => sf('rampa', e.target.value)}
                  placeholder="Rampa o almacen" style={IS} />
              </label>
              <label style={LS}>
                Hora de entrega
                <input type="time" value={form.horaEntrega} onChange={e => sf('horaEntrega', e.target.value)} style={IS} />
              </label>
              <label style={LS}>
                No. FEL / Autorizacion SAT
                <input value={form.numFel} onChange={e => sf('numFel', e.target.value)}
                  placeholder="No. autorizacion SAT" style={IS} />
              </label>
              <label style={LS}>
                Estado
                <select value={form.estado} onChange={e => sf('estado', e.target.value)} style={IS}>
                  {ESTADOS.map(est => <option key={est} value={est}>{est}</option>)}
                </select>
              </label>
            </div>
          </div>

          {/* Productos */}
          <div style={{ ...card, borderTop: `3px solid ${T.info}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '.88rem', color: T.info }}>Productos</div>
                <div style={{ fontSize: '.72rem', color: T.textMid, marginTop: 2 }}>
                  Precio con IVA incluido — el sistema extrae IVA y calcula retencion 80%
                </div>
              </div>
              <button onClick={addProd} style={{ padding: '8px 16px', background: T.secondary, color: T.white, border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '.78rem' }}>
                + Linea
              </button>
            </div>

            <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr>
                    {['Codigo', 'Producto', 'Cajas Pedidas', 'Cajas Enviadas', 'Precio Unit (con IVA)', 'Subtotal', ''].map(h => (
                      <th key={h} style={{ ...thSt, padding: '8px 10px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p, i) => {
                    const sub = (parseFloat(p.cajasEnviadas) || 0) * (parseFloat(p.precioUnit) || 0);
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
                            {catProd.map(pr => <option key={pr.id || pr.nombre} value={pr.nombre}>{pr.nombre}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="number" min="0" step="1" value={p.cajasPedidas}
                            onChange={e => setProd(p._key, 'cajasPedidas', e.target.value)}
                            style={{ ...IS, width: 80, textAlign: 'right', marginTop: 0 }} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="number" min="0" step="1" value={p.cajasEnviadas}
                            onChange={e => setProd(p._key, 'cajasEnviadas', e.target.value)}
                            style={{ ...IS, width: 80, textAlign: 'right', marginTop: 0, border: `1.5px solid ${T.secondary}` }} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="number" min="0" step="0.01" value={p.precioUnit}
                            onChange={e => setProd(p._key, 'precioUnit', e.target.value)}
                            style={{ ...IS, width: 110, textAlign: 'right', marginTop: 0 }} />
                        </td>
                        <td style={{ padding: '6px 10px', fontWeight: 700, color: T.primary, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {fmtQ(sub)}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <button onClick={() => removeProd(p._key)}
                            style={{ background: 'none', border: `1px solid ${T.danger}`, color: T.danger, borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: '.72rem' }}>
                            x
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Fiscal breakdown */}
            {subtotalConIva > 0 && (
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                <FiscalCard label="Cajas totales"   value={totalCajas.toLocaleString()} color={T.textMid} />
                <FiscalCard label="Neto extraido"   value={fmtQ(netoBase)}              color={T.textDark} />
                <FiscalCard label="IVA 12%"         value={fmtQ(iva)}                   color={T.textMid} />
                <FiscalCard label="Retencion Walmart 80%" value={'-' + fmtQ(retencion)} color={T.danger} isRed />
                <FiscalCard label="A cobrar"        value={fmtQ(totalACobrar)}           color={T.info} isBig />
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div style={card}>
            <label style={LS}>
              Observaciones
              <textarea value={form.obs} onChange={e => sf('obs', e.target.value)}
                rows={2} placeholder="Condiciones de entrega, temperatura, notas..."
                style={{ ...IS, resize: 'vertical' }} />
            </label>
            <div style={{ marginTop: 14 }}>
              <button onClick={handleSave} disabled={saving} style={{
                padding: '11px 28px', background: saving ? T.textMid : T.primary,
                color: T.white, border: 'none', borderRadius: 6, fontWeight: 700,
                fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'Registrando...' : 'Registrar venta'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── TAB: HISTORIAL ──────────────────────────────────── */}
      {activeTab === 'historial' && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary, marginBottom: 16 }}>
            Historial ventas Walmart ({salidas.length})
          </div>
          {loading ? <Skeleton rows={8} /> : salidas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: T.textMid, fontSize: '.88rem' }}>
              Sin ventas registradas
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Fecha', 'OC', 'Cliente', 'Productos', 'Total (con IVA)', 'A cobrar', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={thSt}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {salidas.slice(0, 100).map((r, i) => {
                    const prodNames = (r.productos || []).map(p => p.producto).filter(Boolean).join(', ');
                    return (
                      <tr key={r.id} style={{ background: i % 2 ? '#F9FBF9' : '#fff' }}>
                        <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{r.fecha || '—'}</td>
                        <td style={{ ...tdSt, fontWeight: 600 }}>{r.numOC || '—'}</td>
                        <td style={{ ...tdSt, fontSize: '.78rem' }}>{r.cliente || '—'}</td>
                        <td style={{ ...tdSt, fontSize: '.75rem', color: T.textMid, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prodNames || `${(r.productos || []).length} item(s)`}
                        </td>
                        <td style={{ ...tdSt, fontWeight: 700, color: T.primary, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {fmtQ(r.total || r.subtotalConIva || 0)}
                        </td>
                        <td style={{ ...tdSt, fontWeight: 700, color: T.info, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {fmtQ(r.totalACobrar || 0)}
                        </td>
                        <td style={tdSt}><EstadoBadge estado={r.estado} /></td>
                        <td style={tdSt}>
                          <button onClick={() => { setActiveTab('registrar'); }} title="Ver"
                            style={{ padding: '4px 10px', background: T.primary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.7rem', fontWeight: 600, cursor: 'pointer' }}>
                            Ver
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
      )}
    </div>
  );
}

// ── Fiscal card component ─────────────────────────────────────────
function FiscalCard({ label, value, color, isRed, isBig }) {
  return (
    <div style={{
      background: isRed ? '#FFEBEE' : isBig ? '#E3F2FD' : '#F5F5F5',
      border: `1px solid ${isRed ? '#FFCDD2' : isBig ? '#BBDEFB' : '#E0E0E0'}`,
      borderRadius: 6, padding: '10px 12px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMid, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontWeight: isBig ? 800 : 700, fontSize: isBig ? '.95rem' : '.82rem', color }}>
        {value}
      </div>
    </div>
  );
}
