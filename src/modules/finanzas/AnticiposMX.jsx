import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const T = {
  primary:   '#1B5E20',
  secondary: '#2E7D32',
  danger:    '#C62828',
  warn:      '#E65100',
  textDark:  '#1A1A18',
  textMid:   '#6B6B60',
  border:    '#E0E0E0',
  bgGreen:   '#E8F5E9',
  white:     '#FFFFFF',
  bgLight:   '#F5F5F5',
};

const card = { background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 20, marginBottom: 20 };
const TH_S = { padding: '10px 14px', fontSize: '.75rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em', color: T.white, background: T.primary, textAlign: 'left', whiteSpace: 'nowrap' };
const TD_S = (alt) => ({ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', background: alt ? '#F9FBF9' : '#fff', color: T.textDark });
const LS   = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: T.secondary };
const IS   = { padding: '9px 12px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.85rem', outline: 'none', fontFamily: 'inherit', width: '100%', marginTop: 2, color: T.textDark, background: T.white };

const today  = () => new Date().toISOString().slice(0, 10);
const fmtQ   = n => Number(n || 0).toLocaleString('es-GT', { style: 'currency', currency: 'GTQ', minimumFractionDigits: 2 });
const fmtMXN = n => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });

const ESTADO_CFG = {
  pendiente: { bg: 'rgba(230,81,0,.10)',   color: '#E65100',  label: 'Pendiente' },
  parcial:   { bg: 'rgba(21,101,192,.10)', color: '#1565C0',  label: 'Parcial'   },
  devuelto:  { bg: 'rgba(27,94,32,.10)',   color: '#1B5E20',  label: 'Devuelto'  },
};

function EstadoChip({ estado }) {
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.pendiente;
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 700, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

const BLANK = {
  fecha: today(), proveedor: '', monto: '', tc: '0.5', equivalenteMXN: '',
  metodoEnvio: 'Banco', referencia: '', rubroGasto: 'Producto',
  estado: 'pendiente', notas: '',
};

function calcMXN(monto, tc) {
  const m = parseFloat(monto) || 0;
  const t = parseFloat(tc) || 0;
  if (m > 0 && t > 0) return (m / t).toFixed(2);
  return '';
}

export default function AnticiposMX() {
  const toast = useToast();
  const { data, loading } = useCollection('iAnticipo', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { add, update, saving } = useWrite('iAnticipo');

  const [form, setForm]     = useState({ ...BLANK });
  const [editId, setEditId] = useState(null);
  const [filtro, setFiltro] = useState('');

  const f = (field, val) => {
    setForm(p => {
      const next = { ...p, [field]: val };
      const m = parseFloat(field === 'monto' ? val : next.monto) || 0;
      const t = parseFloat(field === 'tc'    ? val : next.tc)    || 0;
      next.equivalenteMXN = m > 0 && t > 0 ? (m / t).toFixed(2) : '';
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.fecha || !form.proveedor || !form.monto) {
      toast('Fecha, proveedor y monto son requeridos', 'error'); return;
    }
    const payload = {
      ...form,
      monto:          parseFloat(form.monto) || 0,
      tc:             parseFloat(form.tc) || 0,
      equivalenteMXN: parseFloat(form.equivalenteMXN) || 0,
      creadoEn:       new Date().toISOString(),
    };
    if (editId) {
      await update(editId, payload); toast('Anticipo actualizado'); setEditId(null);
    } else {
      await add(payload); toast('Anticipo registrado');
    }
    setForm({ ...BLANK });
  };

  const startEdit = r => {
    setForm({
      fecha: r.fecha || today(), proveedor: r.proveedor || '', monto: String(r.monto || ''),
      tc: String(r.tc || '0.5'), equivalenteMXN: String(r.equivalenteMXN || ''),
      metodoEnvio: r.metodoEnvio || 'Banco', referencia: r.referencia || '',
      rubroGasto: r.rubroGasto || 'Producto', estado: r.estado || 'pendiente',
      notas: r.notas || '',
    });
    setEditId(r.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => { setEditId(null); setForm({ ...BLANK }); };

  const updateEstado = async (id, estado) => {
    await update(id, { estado });
    toast(`Estado actualizado: ${ESTADO_CFG[estado]?.label || estado}`);
  };

  const filtered       = filtro ? data.filter(r => r.estado === filtro) : data;
  const pendientes     = data.filter(r => r.estado === 'pendiente');
  const pendTotalQ     = pendientes.reduce((s, r) => s + (r.monto || 0), 0);
  const pendTotalMXN   = pendientes.reduce((s, r) => s + (r.equivalenteMXN || 0), 0);

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: T.primary, margin: 0 }}>Anticipos a Proveedores MX</h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>Control de anticipos enviados a México — OSMO, banco, cambista</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ ...card, marginBottom: 0, padding: '16px 20px', borderLeft: `4px solid ${T.warn}` }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textMid, marginBottom: 6 }}>Total pendiente (Q)</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: T.warn }}>{fmtQ(pendTotalQ)}</div>
        </div>
        <div style={{ ...card, marginBottom: 0, padding: '16px 20px', borderLeft: `4px solid #1565C0` }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textMid, marginBottom: 6 }}>Total pendiente (MXN)</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1565C0' }}>$ {fmtMXN(pendTotalMXN)}</div>
        </div>
        <div style={{ ...card, marginBottom: 0, padding: '16px 20px' }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textMid, marginBottom: 6 }}>Anticipos pendientes</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: T.primary }}>{pendientes.length}</div>
        </div>
      </div>

      {/* Form */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.primary, marginBottom: 18, borderBottom: `2px solid ${T.primary}`, paddingBottom: 8 }}>
          {editId ? 'Editar Anticipo' : 'Registrar Anticipo MX'}
        </div>

        {/* Live TC panel */}
        {(form.monto || form.tc) && (
          <div style={{ background: T.bgGreen, border: `1.5px solid ${T.secondary}`, borderRadius: 8, padding: '10px 16px', marginBottom: 14, fontSize: '.85rem', color: T.primary, fontWeight: 600 }}>
            Q {form.monto || '0'} ÷ TC {form.tc || '0'} = MXN {form.equivalenteMXN ? `$${fmtMXN(parseFloat(form.equivalenteMXN))}` : '—'}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 14 }}>
          <label style={LS}>
            Fecha *
            <input type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)} style={IS} />
          </label>
          <label style={LS}>
            Proveedor *
            <input value={form.proveedor} onChange={e => f('proveedor', e.target.value)} placeholder="Nombre del proveedor" style={IS} />
          </label>
          <label style={LS}>
            Monto en GTQ *
            <input type="number" min="0" step="0.01" value={form.monto} onChange={e => f('monto', e.target.value)} placeholder="0.00" style={IS} />
          </label>
          <label style={LS}>
            TC GTQ→MXN
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              <input type="number" min="0" step="0.0001" value={form.tc} onChange={e => f('tc', e.target.value)} placeholder="0.5000" style={{ ...IS, marginTop: 0, flex: 1 }} />
              <button onClick={() => toast('Actualizar manualmente el TC')} title="TC actual" style={{ padding: '0 10px', background: T.bgLight, border: `1px solid ${T.border}`, borderRadius: 5, cursor: 'pointer', fontSize: '1rem' }}>
                🔄
              </button>
            </div>
          </label>
          <label style={LS}>
            Equiv. MXN (auto)
            <input readOnly value={form.equivalenteMXN ? `$${fmtMXN(parseFloat(form.equivalenteMXN))}` : ''} style={{ ...IS, background: '#F5F5F5', color: T.primary, fontWeight: 700 }} placeholder="Auto" />
          </label>
          <label style={LS}>
            Método de envío
            <select value={form.metodoEnvio} onChange={e => f('metodoEnvio', e.target.value)} style={IS}>
              {['Banco', 'OSMO', 'Cambista', 'Western Union', 'Otro'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label style={LS}>
            Comprobante / Referencia
            <input value={form.referencia} onChange={e => f('referencia', e.target.value)} placeholder="No. transferencia, recibo..." style={IS} />
          </label>
          <label style={LS}>
            Rubro del gasto
            <select value={form.rubroGasto} onChange={e => f('rubroGasto', e.target.value)} style={IS}>
              {['Producto', 'Flete', 'Empaque', 'Agente Aduanero', 'Aranceles', 'Servicios', 'Otro'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label style={LS}>
            Estado
            <select value={form.estado} onChange={e => f('estado', e.target.value)} style={IS}>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="devuelto">Devuelto</option>
            </select>
          </label>
        </div>

        <label style={{ ...LS, marginBottom: 16 }}>
          Notas
          <textarea value={form.notas} onChange={e => f('notas', e.target.value)} rows={2} style={{ ...IS, resize: 'vertical' }} placeholder="Banco utilizado, receptor, notas adicionales..." />
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '11px 28px', background: saving ? '#6B6B60' : T.primary, color: T.white,
            border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Registrar Anticipo'}
          </button>
          {editId && (
            <button onClick={cancelEdit} style={{ padding: '11px 20px', background: T.bgLight, border: `1px solid ${T.border}`, borderRadius: 6, fontWeight: 600, cursor: 'pointer', color: T.textMid }}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '.78rem', color: T.textMid, fontWeight: 600 }}>Estado:</span>
        {[['', 'Todos'], ['pendiente', 'Pendientes'], ['parcial', 'Parciales'], ['devuelto', 'Devueltos']].map(([val, label]) => (
          <button key={val} onClick={() => setFiltro(val)} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: '.76rem', fontWeight: 600, cursor: 'pointer',
            border: `1.5px solid ${filtro === val ? T.primary : T.border}`,
            background: filtro === val ? T.primary : T.white, color: filtro === val ? T.white : T.textMid,
          }}>{label}</button>
        ))}
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary, marginBottom: 16 }}>
          Historial ({filtered.length} registros)
        </div>
        {loading ? <Skeleton rows={5} /> : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.textMid, fontSize: '.9rem' }}>
            Sin anticipos para este filtro
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Fecha', 'Proveedor', 'Monto Q', 'TC', 'Equiv MXN', 'Método', 'Rubro', 'Estado', 'Acciones', 'Notas'].map(h => (
                    <th key={h} style={TH_S}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((r, i) => (
                  <tr key={r.id}>
                    <td style={{ ...TD_S(i % 2 === 1), whiteSpace: 'nowrap', fontWeight: 600 }}>{r.fecha || '—'}</td>
                    <td style={{ ...TD_S(i % 2 === 1), fontWeight: 600 }}>{r.proveedor || '—'}</td>
                    <td style={{ ...TD_S(i % 2 === 1), fontWeight: 700, color: T.warn, whiteSpace: 'nowrap' }}>{fmtQ(r.monto)}</td>
                    <td style={{ ...TD_S(i % 2 === 1), color: T.textMid }}>{r.tc || '—'}</td>
                    <td style={{ ...TD_S(i % 2 === 1), fontWeight: 700, color: '#1565C0', whiteSpace: 'nowrap' }}>
                      {r.equivalenteMXN ? `$${fmtMXN(r.equivalenteMXN)}` : '—'}
                    </td>
                    <td style={{ ...TD_S(i % 2 === 1), color: T.textMid }}>{r.metodoEnvio || '—'}</td>
                    <td style={{ ...TD_S(i % 2 === 1), color: T.textMid }}>{r.rubroGasto || '—'}</td>
                    <td style={TD_S(i % 2 === 1)}><EstadoChip estado={r.estado} /></td>
                    <td style={TD_S(i % 2 === 1)}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button onClick={() => startEdit(r)} style={{ padding: '3px 9px', background: T.primary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>Editar</button>
                        {r.estado === 'pendiente' && (
                          <button onClick={() => updateEstado(r.id, 'parcial')} style={{ padding: '3px 9px', background: '#1565C0', color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>Parcial ↓</button>
                        )}
                        {r.estado !== 'devuelto' && (
                          <button onClick={() => updateEstado(r.id, 'devuelto')} style={{ padding: '3px 9px', background: T.secondary, color: T.white, border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>Devuelto ✓</button>
                        )}
                      </div>
                    </td>
                    <td style={{ ...TD_S(i % 2 === 1), maxWidth: 180, color: T.textMid }}>{r.notas || '—'}</td>
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
