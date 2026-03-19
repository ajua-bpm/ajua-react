import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useProductosCatalogo } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ── Apps Script URL (configure in Admin → Integraciones) ──────────
const APPS_SCRIPT_URL = ''; // Configure in Admin

// ── Design tokens ─────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', danger: '#C62828',
  warn: '#E65100', info: '#1565C0', textDark: '#1A1A18',
  textMid: '#6B6B60', border: '#E0E0E0', bgGreen: '#E8F5E9',
};
const WHITE   = '#FFFFFF';
const shadow  = '0 1px 3px rgba(0,0,0,.10)';
const card    = { background: WHITE, borderRadius: 8, boxShadow: shadow, padding: 20, marginBottom: 20 };
const thSt    = { color: WHITE, padding: '10px 14px', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'left', whiteSpace: 'nowrap' };
const tdSt    = { padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', color: T.textDark };
const LS      = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em' };
const IS      = { padding: '9px 12px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.88rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

// ── Helpers ───────────────────────────────────────────────────────
const today  = () => new Date().toISOString().slice(0, 10);
const fmt    = n  => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 });

function isoDate(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function monthEnd(d)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

const MONTH_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_ES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

// ── Estado badge configs ───────────────────────────────────────────
const ESTADO_CFG = {
  pendiente:   { bg: '#FFF3E0', c: '#E65100',  label: 'Pendiente' },
  preparando:  { bg: '#E3F2FD', c: '#1565C0',  label: 'Preparando' },
  entregado:   { bg: '#E8F5E9', c: '#2E7D32',  label: 'Entregado' },
  cancelado:   { bg: '#FFEBEE', c: '#C62828',  label: 'Cancelado' },
};

const COBRO_CFG = {
  pendiente: { bg: '#FFF3E0', c: '#E65100', label: 'Pendiente' },
  cobrado:   { bg: '#E8F5E9', c: '#2E7D32', label: 'Cobrado' },
};

function Badge({ cfg, value }) {
  const b = cfg[value] || { bg: '#F5F5F5', c: T.textMid, label: value || '—' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600, background: b.bg, color: b.c, whiteSpace: 'nowrap' }}>
      {b.label}
    </span>
  );
}

// ── Email parser ──────────────────────────────────────────────────
function parseEmailText(text) {
  const result = { numOC: '', fechaEntrega: '', totalCajas: '', descripcion: '' };

  // OC: look for "OC" or "Orden" followed by digits
  const ocMatch = text.match(/(?:OC|Orden(?:\s+de\s+Compra)?)[:\s#]*(\d+)/i);
  if (ocMatch) result.numOC = ocMatch[1];

  // Date: look for date patterns dd/mm/yyyy or yyyy-mm-dd
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dateMatch) {
    const [, a, b, c] = dateMatch;
    if (c.length === 4) result.fechaEntrega = `${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`;
    else result.fechaEntrega = `20${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`;
  }

  // Cajas: look for numbers before "caja" or "box"
  const cajasMatch = text.match(/(\d+)\s*(?:cajas?|boxes?)/i);
  if (cajasMatch) result.totalCajas = cajasMatch[1];

  // Descripcion: first non-empty, non-header line (>4 words)
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 10);
  if (lines.length > 0) result.descripcion = lines[0].slice(0, 120);

  return result;
}

// ── Email parser widget (reusable) ────────────────────────────────
function EmailParser({ onParsed }) {
  const [open,    setOpen]    = useState(false);
  const [rawText, setRawText] = useState('');
  const [parsed,  setParsed]  = useState(null);

  const handleParse = () => {
    if (!rawText.trim()) return;
    setParsed(parseEmailText(rawText));
  };

  const handleConfirm = () => {
    if (!parsed) return;
    onParsed({ ...parsed, fuente: 'gmail', rawEmailText: rawText });
    setOpen(false);
    setRawText('');
    setParsed(null);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ padding: '7px 16px', background: '#E3F2FD', color: T.info, border: `1px solid #BBDEFB`, borderRadius: 6, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer' }}>
        {open ? '▲ Cerrar' : '📧 Importar desde email'}
      </button>

      {open && (
        <div style={{ marginTop: 10, padding: 14, background: '#F0F4FF', border: `1px solid #BBDEFB`, borderRadius: 8 }}>
          <label style={LS}>
            Pegar texto del correo de Walmart
            <textarea
              value={rawText} onChange={e => { setRawText(e.target.value); setParsed(null); }}
              rows={5} style={{ ...IS, resize: 'vertical', fontFamily: 'monospace', fontSize: '.8rem', marginTop: 4 }}
              placeholder="Pegar el contenido del correo aquí..." />
          </label>
          <button
            onClick={handleParse}
            disabled={!rawText.trim()}
            style={{ marginTop: 8, padding: '7px 18px', background: T.info, color: WHITE, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.82rem', cursor: rawText.trim() ? 'pointer' : 'not-allowed', opacity: rawText.trim() ? 1 : 0.5 }}>
            Parsear
          </button>

          {parsed && (
            <div style={{ marginTop: 12, padding: 12, background: WHITE, border: `1px solid ${T.border}`, borderRadius: 6 }}>
              <div style={{ fontWeight: 700, fontSize: '.8rem', color: T.textDark, marginBottom: 8 }}>Vista previa:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '.8rem' }}>
                <span><b>OC:</b> {parsed.numOC || <em style={{ color: T.textMid }}>no encontrado</em>}</span>
                <span><b>Fecha entrega:</b> {parsed.fechaEntrega || <em style={{ color: T.textMid }}>no encontrado</em>}</span>
                <span><b>Cajas:</b> {parsed.totalCajas || <em style={{ color: T.textMid }}>no encontrado</em>}</span>
                <span style={{ gridColumn: '1/-1' }}><b>Descripción:</b> {parsed.descripcion || <em style={{ color: T.textMid }}>no encontrado</em>}</span>
              </div>
              <button
                onClick={handleConfirm}
                style={{ marginTop: 10, padding: '7px 18px', background: T.secondary, color: WHITE, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer' }}>
                Confirmar → crear pedido
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Inline FEL form ───────────────────────────────────────────────
function FelForm({ record, onSave, onClose }) {
  const [noFactura,    setNoFactura]    = useState(record.noFactura    || record.numFel  || '');
  const [serieFel,     setSerieFel]     = useState(record.serieFel     || '');
  const [montoFactura, setMontoFactura] = useState(record.montoFactura || '');
  const [fechaFactura, setFechaFactura] = useState(record.fechaFactura || today());

  return (
    <div style={{ marginTop: 8, padding: 12, background: '#F9FBF9', border: `1px solid ${T.border}`, borderRadius: 6 }}>
      <div style={{ fontWeight: 700, fontSize: '.77rem', color: T.textMid, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>Datos FEL / Factura</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 8, marginBottom: 8 }}>
        <label style={LS}>
          No. Factura FEL
          <input value={noFactura} onChange={e => setNoFactura(e.target.value)} placeholder="Ej. 12345678" style={{ ...IS, fontSize: '.8rem', padding: '6px 8px' }} />
        </label>
        <label style={LS}>
          Serie FEL
          <input value={serieFel} onChange={e => setSerieFel(e.target.value)} placeholder="Ej. A, FACT..." style={{ ...IS, fontSize: '.8rem', padding: '6px 8px' }} />
        </label>
        <label style={LS}>
          Monto total facturado Q
          <input type="number" min="0" step="0.01" value={montoFactura} onChange={e => setMontoFactura(e.target.value)} placeholder="0.00" style={{ ...IS, fontSize: '.8rem', padding: '6px 8px' }} />
        </label>
        <label style={LS}>
          Fecha Factura
          <input type="date" value={fechaFactura} onChange={e => setFechaFactura(e.target.value)} style={{ ...IS, fontSize: '.8rem', padding: '6px 8px' }} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onSave({ noFel: noFactura, numFel: noFactura, serieFel, montoFactura: parseFloat(montoFactura) || 0, fechaFactura, estadoCobro: 'facturado' })}
          style={{ padding: '5px 14px', background: T.primary, color: WHITE, border: 'none', borderRadius: 4, fontSize: '.75rem', fontWeight: 600, cursor: 'pointer' }}>
          Guardar FEL
        </button>
        <button onClick={onClose}
          style={{ padding: '5px 14px', background: 'none', color: T.textMid, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: '.75rem', fontWeight: 600, cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
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

// ── BLANK form ────────────────────────────────────────────────────
const BLANK_FORM = {
  fechaEntrega: today(), numOC: '', numAtlas: '', descripcion: '',
  totalCajas: '', horaEntrega: '', rampa: '', estado: 'pendiente',
  productos: [], fuente: 'manual', fuente_raw: '',
};

// ═══════════════════════════════════════════════════════════════════
// TAB 1 — Pedidos
// ═══════════════════════════════════════════════════════════════════
function TabPedidos({ data, loading, add, update, remove, saving }) {
  const toast = useToast();

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [form,     setForm]     = useState({ ...BLANK_FORM });
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // List filter/search
  const [filterTab, setFilterTab] = useState('todos');
  const [search,    setSearch]    = useState('');

  // Row state
  const [felOpenId, setFelOpenId] = useState(null);

  const handleEmailParsed = (parsed) => {
    setForm(f => ({
      ...f,
      numOC:        parsed.numOC        || f.numOC,
      fechaEntrega: parsed.fechaEntrega || f.fechaEntrega,
      totalCajas:   parsed.totalCajas   || f.totalCajas,
      descripcion:  parsed.descripcion  || f.descripcion,
      fuente:       'gmail',
    }));
  };

  const handleSave = async () => {
    if (!form.fechaEntrega) { toast('Ingresa la fecha de entrega', 'error'); return; }
    try {
      await add({
        fecha:         form.fechaEntrega,
        fechaEntrega:  form.fechaEntrega,
        cliente:       'Walmart',
        numOC:         form.numOC,
        numAtlas:      form.numAtlas,
        rampa:         form.rampa,
        horaEntrega:   form.horaEntrega,
        descripcion:   form.descripcion,
        productos:     [],
        totalCajas:    parseFloat(form.totalCajas) || 0,
        total:         0,
        estado:        form.estado,
        fuente:        form.fuente,
        numFel:        '',
        montoFactura:  0,
        fechaFactura:  '',
        estadoCobro:   'pendiente',
        gmailData:     {},
        obs:           '',
        creadoEn:      new Date().toISOString(),
      });
      toast('Pedido creado');
      setForm({ ...BLANK_FORM });
      setFormOpen(false);
    } catch { toast('Error al guardar', 'error'); }
  };

  const handleEstado = async (id, estado) => {
    try {
      await update(id, { estado });
      toast(`Estado: ${ESTADO_CFG[estado]?.label || estado}`);
      if (estado === 'entregado') setFelOpenId(id);
    } catch { toast('Error al actualizar', 'error'); }
  };

  const handleFelSave = async (id, data) => {
    try {
      await update(id, { ...data, estado: 'entregado' });
      setFelOpenId(null);
      toast('FEL guardado');
    } catch { toast('Error al guardar FEL', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este pedido?')) return;
    try { await remove(id); toast('Pedido eliminado'); }
    catch { toast('Error al eliminar', 'error'); }
  };

  const FILTER_TABS = [
    { key: 'todos',      label: 'Todos' },
    { key: 'pendiente',  label: 'Pendiente' },
    { key: 'preparando', label: 'Preparando' },
    { key: 'entregado',  label: 'Entregado' },
    { key: 'cancelado',  label: 'Cancelado' },
  ];

  const filtered = useMemo(() => {
    let rows = filterTab === 'todos' ? data : data.filter(r => r.estado === filterTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        (r.numOC        || '').toLowerCase().includes(q) ||
        (r.descripcion  || '').toLowerCase().includes(q) ||
        (r.rampa        || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, filterTab, search]);

  return (
    <div>
      {/* New Pedido form toggle */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setFormOpen(o => !o)}
          style={{ padding: '9px 20px', background: formOpen ? '#F5F5F5' : T.primary, color: formOpen ? T.textMid : WHITE, border: formOpen ? `1px solid ${T.border}` : 'none', borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: 'pointer' }}>
          {formOpen ? '▲ Cerrar formulario' : '＋ Nuevo Pedido'}
        </button>
      </div>

      {formOpen && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: '.92rem', color: T.textDark, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
            Nuevo Pedido Walmart
          </div>

          <EmailParser onParsed={handleEmailParsed} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
            <label style={LS}>
              Fecha entrega *
              <input type="date" value={form.fechaEntrega} onChange={e => s('fechaEntrega', e.target.value)} style={IS} />
            </label>
            <label style={LS}>
              OC #
              <input value={form.numOC} onChange={e => s('numOC', e.target.value)} placeholder="Número OC" style={IS} />
            </label>
            <label style={LS}>
              Atlas/SAP
              <input value={form.numAtlas} onChange={e => s('numAtlas', e.target.value)} placeholder="# Atlas o SAP" style={IS} />
            </label>
            <label style={LS}>
              Descripción del pedido
              <input value={form.descripcion} onChange={e => s('descripcion', e.target.value)} placeholder="Descripción" style={IS} />
            </label>
            <label style={LS}>
              Total cajas
              <input type="number" min="0" value={form.totalCajas} onChange={e => s('totalCajas', e.target.value)} placeholder="0" style={IS} />
            </label>
            <label style={LS}>
              Hora entrega
              <input type="time" value={form.horaEntrega} onChange={e => s('horaEntrega', e.target.value)} style={IS} />
            </label>
            <label style={LS}>
              Rampa
              <input value={form.rampa} onChange={e => s('rampa', e.target.value)} placeholder="Ej. 5010" style={IS} />
            </label>
            <label style={LS}>
              Estado
              <select value={form.estado} onChange={e => s('estado', e.target.value)} style={IS}>
                {Object.entries(ESTADO_CFG).map(([v, b]) => <option key={v} value={v}>{b.label}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '10px 26px', background: saving ? T.border : T.primary, color: WHITE, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Guardando…' : 'Guardar Pedido'}
            </button>
            <button onClick={() => setFormOpen(false)}
              style={{ padding: '10px 16px', background: 'none', color: T.textMid, border: `1px solid ${T.border}`, borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* List card */}
      <div style={card}>
        {/* Filter tabs + search */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          {FILTER_TABS.map(ft => {
            const count = ft.key === 'todos' ? data.length : data.filter(r => r.estado === ft.key).length;
            return (
              <button key={ft.key} onClick={() => setFilterTab(ft.key)} style={{
                padding: '5px 14px', borderRadius: 20, fontSize: '.75rem', fontWeight: 600, cursor: 'pointer',
                border: `1.5px solid ${filterTab === ft.key ? T.primary : T.border}`,
                background: filterTab === ft.key ? T.primary : WHITE,
                color: filterTab === ft.key ? WHITE : T.textMid,
              }}>
                {ft.label} ({count})
              </button>
            );
          })}
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar OC, descripción, rampa…"
            style={{ ...IS, width: 220, marginLeft: 'auto', fontSize: '.82rem', padding: '6px 10px' }} />
        </div>

        {loading ? <Skeleton rows={6} /> : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 24px', color: T.textMid, fontSize: '.88rem' }}>Sin pedidos.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha entrega', 'OC', 'Atlas/SAP', 'Descripción', 'Cajas', 'Rampa', 'Estado', 'Acciones'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 150).map((r, i) => (
                  <>
                    <tr key={r.id} style={{ background: i % 2 === 1 ? '#F9FBF9' : WHITE }}>
                      <td style={{ ...tdSt, fontWeight: 600 }}>{r.fechaEntrega || r.fecha || '—'}</td>
                      <td style={{ ...tdSt, fontSize: '.8rem', fontFamily: 'monospace' }}>
                        {r.numOC || '—'}
                        {r.fuente === 'gmail' && (
                          <span style={{ marginLeft: 6, padding: '2px 6px', background: '#E3F2FD', color: T.info, borderRadius: 10, fontSize: '.65rem', fontWeight: 700 }}>📧 Gmail</span>
                        )}
                      </td>
                      <td style={{ ...tdSt, fontSize: '.78rem', color: T.textMid }}>{r.numAtlas || '—'}</td>
                      <td style={{ ...tdSt, maxWidth: 200 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '.82rem' }}>{r.descripcion || '—'}</div>
                      </td>
                      <td style={{ ...tdSt, fontWeight: 600 }}>{r.totalCajas || '—'}</td>
                      <td style={tdSt}>{r.rampa || '—'}</td>
                      <td style={tdSt}>
                        <Badge cfg={ESTADO_CFG} value={r.estado} />
                      </td>
                      <td style={tdSt}>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {r.estado === 'pendiente' && (
                            <button onClick={() => handleEstado(r.id, 'preparando')}
                              style={{ padding: '4px 9px', background: '#E3F2FD', color: T.info, border: 'none', borderRadius: 4, fontSize: '.7rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              Preparando →
                            </button>
                          )}
                          {r.estado === 'preparando' && (
                            <button onClick={() => handleEstado(r.id, 'entregado')}
                              style={{ padding: '4px 9px', background: T.secondary, color: WHITE, border: 'none', borderRadius: 4, fontSize: '.7rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              Entregado ✓
                            </button>
                          )}
                          {r.estado === 'entregado' && (
                            <button onClick={() => setFelOpenId(felOpenId === r.id ? null : r.id)}
                              style={{ padding: '4px 9px', background: '#E8F5E9', color: T.secondary, border: `1px solid #C8E6C9`, borderRadius: 4, fontSize: '.7rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              FEL
                            </button>
                          )}
                          <button onClick={() => handleDelete(r.id)}
                            style={{ padding: '4px 9px', background: '#FFEBEE', color: T.danger, border: 'none', borderRadius: 4, fontSize: '.7rem', fontWeight: 600, cursor: 'pointer' }}>
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                    {felOpenId === r.id && (
                      <tr key={r.id + '_fel'} style={{ background: i % 2 === 1 ? '#F9FBF9' : WHITE }}>
                        <td colSpan={8} style={{ padding: '0 14px 12px' }}>
                          <FelForm
                            record={r}
                            onSave={data => handleFelSave(r.id, data)}
                            onClose={() => setFelOpenId(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 2 — Ventas y Facturación
// ═══════════════════════════════════════════════════════════════════
function TabVentas({ data, update }) {
  const toast = useToast();
  const [felOpenId, setFelOpenId] = useState(null);

  // Show pedidos that are entregado OR already have estadoCobro set (facturado/cobrado)
  const entregados = useMemo(
    () => data.filter(r => r.estado === 'entregado' || r.estadoCobro),
    [data]
  );

  const totalEntregado = entregados.reduce((s, r) => s + (r.montoFactura || r.total || 0), 0);
  const totalCobrado   = entregados.filter(r => r.estadoCobro === 'cobrado').reduce((s, r) => s + (r.montoFactura || r.total || 0), 0);

  const handleCobrar = async (id) => {
    try { await update(id, { estadoCobro: 'cobrado' }); toast('Marcado como cobrado'); }
    catch { toast('Error al actualizar', 'error'); }
  };

  const handleFelSave = async (id, felData) => {
    try {
      await update(id, { ...felData, estadoCobro: felData.estadoCobro || 'facturado' });
      setFelOpenId(null);
      toast('FEL guardado');
    } catch { toast('Error al guardar FEL', 'error'); }
  };

  return (
    <div style={card}>
      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: '1 1 140px', padding: '16px 20px', background: WHITE, borderRadius: 8, boxShadow: shadow, borderTop: `3px solid ${T.primary}` }}>
          <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: T.textMid, marginBottom: 4 }}>Total entregado (Q)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: T.primary }}>Q {fmt(totalEntregado)}</div>
        </div>
        <div style={{ flex: '1 1 140px', padding: '16px 20px', background: WHITE, borderRadius: 8, boxShadow: shadow, borderTop: `3px solid ${T.secondary}` }}>
          <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: T.textMid, marginBottom: 4 }}>Total cobrado (Q)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: T.secondary }}>Q {fmt(totalCobrado)}</div>
        </div>
      </div>

      {entregados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 24px', color: T.textMid, fontSize: '.88rem' }}>Sin pedidos entregados.</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'OC', 'Descripción', 'Monto Factura', 'No. FEL', 'Serie FEL', 'Estado Cobro', 'Acción'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entregados.map((r, i) => (
                  <>
                    <tr key={r.id} style={{ background: i % 2 === 1 ? '#F9FBF9' : WHITE }}>
                      <td style={{ ...tdSt, fontWeight: 600 }}>{r.fechaEntrega || r.fecha || '—'}</td>
                      <td style={{ ...tdSt, fontFamily: 'monospace', fontSize: '.8rem' }}>{r.numOC || '—'}</td>
                      <td style={{ ...tdSt, maxWidth: 180 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '.82rem' }}>{r.descripcion || '—'}</div>
                      </td>
                      <td style={{ ...tdSt, fontWeight: 700, color: T.primary }}>
                        {r.montoFactura ? `Q ${fmt(r.montoFactura)}` : r.total ? `Q ${fmt(r.total)}` : '—'}
                      </td>
                      <td style={{ ...tdSt, fontFamily: 'monospace', fontSize: '.78rem' }}>{r.noFel || r.numFel || '—'}</td>
                      <td style={{ ...tdSt, fontFamily: 'monospace', fontSize: '.78rem' }}>{r.serieFel || '—'}</td>
                      <td style={tdSt}>
                        <Badge cfg={COBRO_CFG} value={r.estadoCobro || 'pendiente'} />
                      </td>
                      <td style={tdSt}>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {/* FEL button — show if not yet cobrado */}
                          {r.estadoCobro !== 'cobrado' && (
                            <button onClick={() => setFelOpenId(felOpenId === r.id ? null : r.id)}
                              style={{ padding: '4px 9px', background: '#E8F5E9', color: T.secondary, border: `1px solid #C8E6C9`, borderRadius: 4, fontSize: '.7rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              {r.noFel || r.numFel ? 'Editar FEL' : 'Cargar Factura FEL'}
                            </button>
                          )}
                          {/* Cobrado button — only show once FEL is loaded */}
                          {(r.noFel || r.numFel) && r.estadoCobro !== 'cobrado' && (
                            <button onClick={() => handleCobrar(r.id)}
                              style={{ padding: '4px 12px', background: T.secondary, color: WHITE, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              ✓ Cobrado
                            </button>
                          )}
                          {r.estadoCobro === 'cobrado' && (
                            <span style={{ padding: '4px 10px', background: '#E8F5E9', color: T.secondary, borderRadius: 4, fontSize: '.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              ✓ Cobrado
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {felOpenId === r.id && (
                      <tr key={r.id + '_fel'} style={{ background: i % 2 === 1 ? '#F9FBF9' : WHITE }}>
                        <td colSpan={8} style={{ padding: '0 14px 12px' }}>
                          <FelForm
                            record={r}
                            onSave={felData => handleFelSave(r.id, felData)}
                            onClose={() => setFelOpenId(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: T.bgGreen, fontWeight: 700 }}>
                  <td colSpan={3} style={{ ...tdSt, fontWeight: 700, color: T.primary }}>TOTALES</td>
                  <td style={{ ...tdSt, fontWeight: 700, color: T.primary }}>Q {fmt(totalEntregado)}</td>
                  <td colSpan={3} style={tdSt} />
                  <td style={{ ...tdSt, fontWeight: 700, color: T.secondary }}>Q {fmt(totalCobrado)} cobrado</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 3 — Calendario
// ═══════════════════════════════════════════════════════════════════
function TabCalendario({ data }) {
  const [refDate,  setRefDate]  = useState(new Date());
  const [selected, setSelected] = useState(null); // iso date string

  const year  = refDate.getFullYear();
  const month = refDate.getMonth();

  const prevMonth = () => setRefDate(new Date(year, month - 1, 1));
  const nextMonth = () => setRefDate(new Date(year, month + 1, 1));

  // Build calendar grid (Mon-Sun columns)
  const firstDay  = monthStart(refDate);
  const lastDay   = monthEnd(refDate);
  // Offset to Monday (0=Mon…6=Sun)
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalCells  = startOffset + lastDay.getDate();
  const rows        = Math.ceil(totalCells / 7);

  const cells = Array.from({ length: rows * 7 }, (_, idx) => {
    const dayNum = idx - startOffset + 1;
    if (dayNum < 1 || dayNum > lastDay.getDate()) return null;
    const d = new Date(year, month, dayNum);
    return isoDate(d);
  });

  const pedidosByDay = useMemo(() => {
    const map = {};
    data.forEach(r => {
      const k = r.fechaEntrega || r.fecha;
      if (!k) return;
      if (!map[k]) map[k] = [];
      map[k].push(r);
    });
    return map;
  }, [data]);

  const DAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const todayIso    = today();

  return (
    <div style={card}>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={prevMonth}
          style={{ padding: '7px 14px', background: '#F5F5F5', border: `1px solid ${T.border}`, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>
          &#9664;
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: '1.05rem', color: T.primary }}>
          {MONTH_ES[month]} {year}
        </div>
        <button onClick={nextMonth}
          style={{ padding: '7px 14px', background: '#F5F5F5', border: `1px solid ${T.border}`, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>
          &#9654;
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {DAY_HEADERS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: T.textMid, padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((iso, idx) => {
          if (!iso) return <div key={idx} style={{ minHeight: 70 }} />;
          const dayPedidos = pedidosByDay[iso] || [];
          const isToday    = iso === todayIso;
          const isSelected = iso === selected;
          return (
            <div
              key={iso}
              onClick={() => setSelected(isSelected ? null : iso)}
              style={{
                border: `1.5px solid ${isSelected ? T.primary : isToday ? T.secondary : T.border}`,
                borderRadius: 6, padding: '6px 5px', minHeight: 70,
                background: isSelected ? T.bgGreen : isToday ? '#F1F8E9' : WHITE,
                cursor: 'pointer', transition: 'background .15s',
              }}>
              <div style={{ fontSize: '.78rem', fontWeight: isToday ? 700 : 500, color: isToday ? T.primary : T.textDark, marginBottom: 4 }}>
                {new Date(iso + 'T00:00:00').getDate()}
              </div>
              {dayPedidos.map(p => {
                const cfg = ESTADO_CFG[p.estado] || ESTADO_CFG.pendiente;
                return (
                  <div key={p.id} style={{ background: cfg.bg, color: cfg.c, borderRadius: 3, padding: '2px 5px', fontSize: '.62rem', fontWeight: 600, marginBottom: 2, lineHeight: 1.3 }}>
                    {p.totalCajas ? `${p.totalCajas} caj.` : p.numOC ? `OC ${p.numOC}` : '—'}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selected && (
        <div style={{ marginTop: 20, padding: 16, background: '#F9FBF9', border: `1px solid ${T.border}`, borderRadius: 8 }}>
          <div style={{ fontWeight: 700, fontSize: '.88rem', color: T.primary, marginBottom: 12 }}>
            Pedidos — {selected}
          </div>
          {(pedidosByDay[selected] || []).length === 0 ? (
            <div style={{ color: T.textMid, fontSize: '.83rem' }}>Sin pedidos para este día.</div>
          ) : (
            (pedidosByDay[selected] || []).map(r => (
              <div key={r.id} style={{ background: WHITE, border: `1px solid ${T.border}`, borderRadius: 6, padding: '10px 14px', marginBottom: 8, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: '.83rem' }}>
                <span style={{ fontWeight: 700 }}>{r.numOC ? `OC ${r.numOC}` : '—'}</span>
                <span style={{ color: T.textMid }}>{r.descripcion || '—'}</span>
                <span style={{ fontWeight: 600 }}>{r.totalCajas ? `${r.totalCajas} cajas` : ''}</span>
                <Badge cfg={ESTADO_CFG} value={r.estado} />
              </div>
            ))
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap', fontSize: '.72rem' }}>
        {Object.entries(ESTADO_CFG).map(([k, b]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, background: b.bg, border: `1px solid ${b.c}`, borderRadius: 2, display: 'inline-block' }} />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 4 — Gmail
// ═══════════════════════════════════════════════════════════════════
function TabGmail({ data, add }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);

  const gmailPedidos = useMemo(
    () => data.filter(r => r.fuente === 'gmail').slice(0, 10),
    [data]
  );

  const handleRevisar = async () => {
    if (!APPS_SCRIPT_URL) {
      toast('URL de Apps Script no configurada', 'error');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'fetchWalmart' }) });
      const json = await res.json();
      setResult(json);
      toast('Correos revisados');
    } catch (e) {
      toast('Error al conectar con Apps Script', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailParsed = async (parsed) => {
    try {
      await add({
        fecha:        parsed.fechaEntrega || today(),
        fechaEntrega: parsed.fechaEntrega || today(),
        cliente:      'Walmart',
        numOC:        parsed.numOC        || '',
        numAtlas:     '',
        rampa:        '',
        horaEntrega:  '',
        descripcion:  parsed.descripcion  || '',
        productos:    [],
        totalCajas:   parseFloat(parsed.totalCajas) || 0,
        total:        0,
        estado:       'pendiente',
        fuente:       'gmail',
        numFel:       '',
        montoFactura: 0,
        fechaFactura: '',
        estadoCobro:  'pendiente',
        gmailData:    { subject: parsed.descripcion || '', from: '', date: parsed.fechaEntrega || '' },
        obs:          '',
        creadoEn:     new Date().toISOString(),
      });
      toast('Pedido importado desde email');
    } catch { toast('Error al importar', 'error'); }
  };

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.textDark, marginBottom: 6 }}>📧 Correos Walmart</div>
        <p style={{ fontSize: '.85rem', color: T.textMid, margin: '0 0 18px' }}>
          Revisar correos de Walmart para importar pedidos automáticamente.
        </p>

        {!APPS_SCRIPT_URL ? (
          <div style={{ padding: '12px 16px', background: '#E3F2FD', border: `1px solid #BBDEFB`, borderRadius: 8, fontSize: '.84rem', color: T.info }}>
            URL de Apps Script no configurada. Configurar en Admin → Integraciones.
          </div>
        ) : (
          <button onClick={handleRevisar} disabled={loading}
            style={{ padding: '9px 22px', background: loading ? T.border : T.info, color: WHITE, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Revisando…' : '🔄 Revisar correos'}
          </button>
        )}

        {result && (
          <div style={{ marginTop: 14, padding: 12, background: '#F0FFF4', border: `1px solid #C8E6C9`, borderRadius: 8, fontSize: '.83rem', color: T.secondary }}>
            Respuesta Apps Script: {JSON.stringify(result)}
          </div>
        )}
      </div>

      {/* Recently imported */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.88rem', color: T.textDark, marginBottom: 14 }}>
          Importados desde Gmail (últimos 10)
        </div>
        {gmailPedidos.length === 0 ? (
          <div style={{ color: T.textMid, fontSize: '.84rem' }}>Sin pedidos importados desde Gmail.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Asunto (Gmail)', 'OC', 'Estado'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gmailPedidos.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 1 ? '#F9FBF9' : WHITE }}>
                    <td style={{ ...tdSt, fontWeight: 600 }}>{r.fechaEntrega || r.fecha || '—'}</td>
                    <td style={{ ...tdSt, fontSize: '.8rem' }}>{r.gmailData?.subject || r.descripcion || '—'}</td>
                    <td style={{ ...tdSt, fontFamily: 'monospace', fontSize: '.8rem' }}>{r.numOC || '—'}</td>
                    <td style={tdSt}><Badge cfg={ESTADO_CFG} value={r.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual import */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.88rem', color: T.textDark, marginBottom: 12 }}>
          Importar manualmente desde email
        </div>
        <EmailParser onParsed={handleEmailParsed} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function Walmart() {
  const { data, loading }           = useCollection('pedidosWalmart', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { add, update, remove, saving } = useWrite('pedidosWalmart');

  const [tab, setTab] = useState('pedidos');

  const pendientes    = data.filter(r => r.estado === 'pendiente').length;
  const entregadosHoy = data.filter(r => r.estado === 'entregado' && (r.fechaEntrega || r.fecha) === today()).length;
  const totalQ        = useMemo(() => data.filter(r => r.estado !== 'cancelado').reduce((s, r) => s + (r.total || 0), 0), [data]);

  const TABS = [
    { id: 'pedidos',    label: '📦 Pedidos' },
    { id: 'ventas',     label: '💰 Ventas' },
    { id: 'calendario', label: '📅 Calendario' },
    { id: 'gmail',      label: '📧 Gmail' },
  ];

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: T.textDark }}>Pedidos Walmart</h2>
        <p style={{ margin: '4px 0 0', fontSize: '.83rem', color: T.textMid }}>
          Gestión de pedidos, facturación, calendario e integración Gmail
        </p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
        <MetricCard label="Pendientes"      value={loading ? '…' : pendientes}          accent={T.warn} />
        <MetricCard label="Entregados hoy"  value={loading ? '…' : entregadosHoy}       accent={T.secondary} />
        <MetricCard label="Valor activo Q"  value={loading ? '…' : `Q ${fmt(totalQ)}`} accent={T.primary} />
        <MetricCard label="Total registros" value={loading ? '…' : data.length}         accent={T.textMid} />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.border}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '11px 8px', border: 'none', fontWeight: 600, fontSize: '.83rem', cursor: 'pointer',
            background: tab === t.id ? T.primary : WHITE,
            color:      tab === t.id ? WHITE      : T.textMid,
            borderRight: `1px solid ${T.border}`,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pedidos'    && <TabPedidos    data={data} loading={loading} add={add} update={update} remove={remove} saving={saving} />}
      {tab === 'ventas'     && <TabVentas     data={data} update={update} />}
      {tab === 'calendario' && <TabCalendario data={data} />}
      {tab === 'gmail'      && <TabGmail      data={data} add={add} />}
    </div>
  );
}
