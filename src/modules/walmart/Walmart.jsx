import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
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
  pendiente: { bg: '#FFF3E0', c: '#E65100' },
  entregado: { bg: '#E8F5E9', c: '#2E7D32' },
  cancelado: { bg: '#FFEBEE', c: '#C62828' },
};
function StateBadge({ estado }) {
  const b = BADGE[estado] || { bg: '#F5F5F5', c: '#6B6B60' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600, background: b.bg, color: b.c, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {estado || '—'}
    </span>
  );
}

// ── Helpers ──────────────────────────────────────────────────────
const fmt     = n  => Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 });
const today   = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); };

// ── Email parser ─────────────────────────────────────────────────
function parseEmail(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let fechaEntrega = '';
  const productos = [];

  for (const line of lines) {
    // Look for date patterns
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch && !fechaEntrega) fechaEntrega = dateMatch[1];

    const dateMatch2 = line.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dateMatch2 && !fechaEntrega) {
      const [, d, m, y] = dateMatch2;
      const year = y.length === 2 ? '20' + y : y;
      fechaEntrega = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // Look for lines with numbers (likely product quantities)
    const qtyMatch = line.match(/(\d+(?:\.\d+)?)\s*(lb|kg|caja|cajas|unidad|unidades|quintal|quintales)?/i);
    if (qtyMatch && line.length < 120) {
      const qty = parseFloat(qtyMatch[1]);
      if (qty > 0 && qty < 100000) {
        // Extract product name: everything before the number
        const namePart = line.replace(qtyMatch[0], '').replace(/[-–:]+/g, ' ').trim();
        if (namePart.length > 1) {
          productos.push({
            producto: namePart.slice(0, 60),
            cantidad: qty,
            unidad: (qtyMatch[2] || 'unidad').toLowerCase(),
          });
        }
      }
    }
  }

  return { fechaEntrega: fechaEntrega || today(), productos, total: 0 };
}

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

// ── Inline FEL editor ─────────────────────────────────────────────
function FelEditor({ record, onSave }) {
  const [val, setVal] = useState(record.numFel || '');
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="No. FEL…"
        style={{ ...IS, fontSize: '.78rem', padding: '5px 8px', width: 130 }}
      />
      <button
        onClick={() => onSave(val)}
        style={{ padding: '5px 10px', background: T.primary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}
      >
        Guardar
      </button>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export default function Walmart() {
  const toast = useToast();

  const { data, loading }   = useCollection('pedidosWalmart', { orderField: 'fechaEntrega', orderDir: 'desc', limit: 300 });
  const { update, add, saving } = useWrite('pedidosWalmart');

  const [tab, setTab]         = useState('lista');
  const [filterTab, setFilterTab] = useState('todos');
  const [felOpen, setFelOpen] = useState(null);   // id of row with open FEL editor
  const [emailText, setEmailText] = useState('');
  const [parsed, setParsed]   = useState(null);
  const [importSaving, setImportSaving] = useState(false);

  // Handlers
  const cambiarEstado = async (id, estado) => {
    await update(id, { estado });
    toast(`Estado → ${estado}`);
  };

  const guardarFel = async (id, numFel) => {
    await update(id, { numFel });
    setFelOpen(null);
    toast('FEL guardado');
  };

  const handleParsear = () => {
    if (!emailText.trim()) { toast('Pega el contenido del correo primero', 'error'); return; }
    const result = parseEmail(emailText);
    setParsed(result);
    toast(result.productos.length > 0 ? `${result.productos.length} producto(s) detectado(s)` : 'Revisa el contenido — no se detectaron productos');
  };

  const handleConfirmarImport = async () => {
    if (!parsed) return;
    setImportSaving(true);
    try {
      await add({
        fechaEntrega: parsed.fechaEntrega,
        fechaPedido:  today(),
        productos:    parsed.productos,
        total:        parsed.total,
        estado:       'pendiente',
        fuente:       'gmail',
        numFel:       '',
      });
      toast('Pedido importado correctamente');
      setEmailText('');
      setParsed(null);
      setTab('lista');
    } catch (e) {
      toast('Error al guardar', 'error');
    } finally {
      setImportSaving(false);
    }
  };

  // Filter data
  const filtered = useMemo(() => {
    if (filterTab === 'todos') return data;
    return data.filter(r => r.estado === filterTab);
  }, [data, filterTab]);

  // Metrics
  const pendientesCount = data.filter(r => r.estado === 'pendiente').length;
  const entregadosSemana = data.filter(r => r.estado === 'entregado' && (r.fechaEntrega || '') >= weekAgo()).length;
  const totalValor = useMemo(() => data.filter(r => r.estado !== 'cancelado').reduce((s, r) => {
    if (r.total) return s + r.total;
    const prods = r.productos || r.rubros || [];
    return s + prods.reduce((ps, p) => ps + ((p.cantidad || p.cajas || 0) * (p.precioUnitario || 0)), 0);
  }, 0), [data]);

  const FILTER_TABS = ['todos', 'pendiente', 'entregado', 'cancelado'];

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: T.textDark }}>
          Pedidos Walmart
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '.83rem', color: T.textMid }}>
          Seguimiento de pedidos y entregas a Walmart Guatemala
        </p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <MetricCard label="Pendientes"       value={loading ? '…' : pendientesCount} accent={T.warn} />
        <MetricCard label="Entregados / semana" value={loading ? '…' : entregadosSemana} accent={T.secondary} />
        <MetricCard label="Valor total GTQ"  value={loading ? '…' : `Q ${fmt(totalValor)}`} accent={T.primary} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.border}` }}>
        {[
          { id: 'lista',   label: 'Lista de pedidos' },
          { id: 'importar', label: 'Importar desde email' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '11px 8px', border: 'none', fontWeight: 600,
            fontSize: '.83rem', cursor: 'pointer',
            background: tab === t.id ? T.primary : T.white,
            color: tab === t.id ? T.white : T.textMid,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Lista de pedidos ── */}
      {tab === 'lista' && (
        <div style={card}>
          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {FILTER_TABS.map(ft => (
              <button key={ft} onClick={() => setFilterTab(ft)} style={{
                padding: '5px 14px', borderRadius: 20, fontSize: '.75rem', fontWeight: 600,
                cursor: 'pointer', border: `1.5px solid ${filterTab === ft ? T.primary : T.border}`,
                background: filterTab === ft ? T.primary : T.white,
                color: filterTab === ft ? T.white : T.textMid,
              }}>
                {ft === 'todos' ? `Todos (${data.length})` : `${ft.charAt(0).toUpperCase() + ft.slice(1)} (${data.filter(r => r.estado === ft).length})`}
              </button>
            ))}
          </div>

          {loading ? (
            <Skeleton rows={8} />
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: T.textMid, fontSize: '.88rem' }}>
              Sin pedidos {filterTab !== 'todos' ? `con estado "${filterTab}"` : ''}.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.primary }}>
                    {['F. Entrega', 'F. Pedido', 'Productos', 'Total', 'FEL', 'Estado', 'Origen', 'Acciones'].map(h => (
                      <th key={h} style={thSt}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map((r, i) => {
                    const prods = r.productos || r.rubros || [];
                    const total = r.total || prods.reduce((s, p) => s + ((p.cantidad || p.cajas || 0) * (p.precioUnitario || 0)), 0);
                    const prodText = prods.length > 0
                      ? prods.slice(0, 2).map(p => `${p.producto || p.nombre || '?'} ${p.cantidad || p.cajas || ''}${p.unidad ? ' ' + p.unidad : ''}`).join(' · ') + (prods.length > 2 ? ` +${prods.length - 2}` : '')
                      : r.producto || '—';
                    return (
                      <tr key={r.id} style={{ background: i % 2 === 1 ? '#F9FBF9' : '#fff' }}>
                        <td style={{ ...tdSt, fontWeight: 600 }}>{r.fechaEntrega || '—'}</td>
                        <td style={{ ...tdSt, color: T.textMid, fontSize: '.78rem' }}>{r.fechaPedido || r._ts?.slice?.(0, 10) || '—'}</td>
                        <td style={{ ...tdSt, maxWidth: 200 }}>
                          <div style={{ fontSize: '.82rem', color: T.textDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {prodText}
                          </div>
                          <div style={{ fontSize: '.7rem', color: T.textMid, marginTop: 1 }}>{prods.length} producto{prods.length !== 1 ? 's' : ''}</div>
                        </td>
                        <td style={{ ...tdSt, fontWeight: 700, color: T.primary }}>
                          {total > 0 ? `Q ${fmt(total)}` : '—'}
                        </td>
                        <td style={tdSt}>
                          {felOpen === r.id ? (
                            <FelEditor record={r} onSave={val => guardarFel(r.id, val)} />
                          ) : (
                            <span style={{ fontSize: '.78rem', color: r.numFel ? T.secondary : T.textMid, fontFamily: r.numFel ? 'monospace' : 'inherit' }}>
                              {r.numFel || <em style={{ opacity: .6 }}>Sin FEL</em>}
                            </span>
                          )}
                        </td>
                        <td style={tdSt}><StateBadge estado={r.estado} /></td>
                        <td style={tdSt}>
                          {r.fuente === 'gmail' && (
                            <span style={{ padding: '2px 7px', borderRadius: 4, background: '#E8EAF6', color: '#3949AB', fontSize: '.68rem', fontWeight: 600 }}>
                              Email
                            </span>
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
                            <button
                              onClick={() => setFelOpen(felOpen === r.id ? null : r.id)}
                              style={{ padding: '4px 10px', background: '#E3F2FD', color: '#1565C0', border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              FEL
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
      )}

      {/* ── Importar desde email ── */}
      {tab === 'importar' && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.textDark, marginBottom: 6 }}>
            Parsear correo de Walmart
          </div>
          <p style={{ fontSize: '.83rem', color: T.textMid, margin: '0 0 16px' }}>
            Pega el contenido del correo de pedido de Walmart. El sistema intentará extraer fecha de entrega y productos.
          </p>
          <label style={{ ...LS, marginBottom: 14 }}>
            Contenido del correo
            <textarea
              value={emailText}
              onChange={e => setEmailText(e.target.value)}
              rows={10}
              placeholder="Pega aquí el texto del correo de Walmart…"
              style={{ ...IS, resize: 'vertical', fontFamily: 'monospace', fontSize: '.8rem', lineHeight: 1.5 }}
            />
          </label>
          <button
            onClick={handleParsear}
            style={{ padding: '11px 24px', background: T.primary, color: T.white, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: 'pointer', marginBottom: 20 }}
          >
            Parsear contenido
          </button>

          {/* Preview */}
          {parsed && (
            <div style={{ border: `1.5px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: '#F5F5F5', padding: '12px 16px', fontWeight: 700, fontSize: '.83rem', color: T.textDark, borderBottom: `1px solid ${T.border}` }}>
                Vista previa del pedido detectado
              </div>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={LS}>
                  Fecha de entrega detectada
                  <input
                    type="date"
                    value={parsed.fechaEntrega}
                    onChange={e => setParsed(p => ({ ...p, fechaEntrega: e.target.value }))}
                    style={{ ...IS, maxWidth: 200 }}
                  />
                </label>

                {parsed.productos.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em', marginBottom: 8 }}>
                      Productos detectados ({parsed.productos.length})
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.83rem' }}>
                      <thead>
                        <tr style={{ background: T.primary }}>
                          {['Producto', 'Cantidad', 'Unidad'].map(h => <th key={h} style={thSt}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.productos.map((p, i) => (
                          <tr key={i} style={{ background: i % 2 === 1 ? '#F9FBF9' : '#fff' }}>
                            <td style={tdSt}>{p.producto}</td>
                            <td style={{ ...tdSt, fontWeight: 600 }}>{p.cantidad}</td>
                            <td style={{ ...tdSt, color: T.textMid }}>{p.unidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ color: T.warn, fontSize: '.83rem', padding: '12px', background: '#FFF8E1', borderRadius: 6 }}>
                    No se detectaron productos automáticamente. Verifica el formato del correo.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                  <button
                    onClick={handleConfirmarImport}
                    disabled={importSaving}
                    style={{ padding: '11px 24px', background: importSaving ? T.border : T.secondary, color: T.white, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: importSaving ? 'not-allowed' : 'pointer' }}
                  >
                    {importSaving ? 'Guardando…' : 'Confirmar e importar'}
                  </button>
                  <button
                    onClick={() => setParsed(null)}
                    style={{ padding: '11px 18px', background: T.bgLight, border: `1px solid ${T.border}`, borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: 'pointer', color: T.textMid }}
                  >
                    Descartar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
