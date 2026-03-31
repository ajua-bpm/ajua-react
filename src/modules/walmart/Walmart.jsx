import { useState, useMemo, useEffect, useRef } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useMainData, useProductosCatalogo } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';
import WalmartCard from './WalmartCard';

// ── Apps Script URL — stored in localStorage ──────────────────────
const LS_KEY = 'ajua_walmart_gas_url';
const getGasUrl = () => localStorage.getItem(LS_KEY) || '';
const setGasUrl = (url) => localStorage.setItem(LS_KEY, url.trim());

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

// ── Helpers de fecha en español ───────────────────────────────────
const MESES_ES = {
  ENERO:1,FEBRERO:2,MARZO:3,ABRIL:4,MAYO:5,JUNIO:6,
  JULIO:7,AGOSTO:8,SEPTIEMBRE:9,OCTUBRE:10,NOVIEMBRE:11,DICIEMBRE:12
};
function parseFechaEsp(str) {
  const m = (str || '').match(/(\d{1,2})\s+DE\s+([A-ZÁÉÍÓÚ]+)/i);
  if (!m) return '';
  const dia = parseInt(m[1]);
  const mes = MESES_ES[(m[2] || '').toUpperCase()];
  if (!dia || !mes) return '';
  const yr = new Date().getFullYear();
  return `${yr}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
}

// ── Walmart email parser — 3 formatos (port de bpm.html) ──────────
const KNOWN_SIZES = ['_300','_200','_100','_50','_48','_40','_36','_30','_24','_20','_18','_12','_10','_8','_6','_4'];

function splitDescCajas(str) {
  for (const sz of KNOWN_SIZES) {
    const idx = str.lastIndexOf(sz);
    if (idx < 0) continue;
    const after = str.slice(idx + sz.length).trim();
    if (/^\d+$/.test(after)) return { desc: str.slice(0, idx + sz.length).trim(), cajas: parseInt(after, 10) };
  }
  const m = str.match(/^(.*\D)\s+(\d+)\s*$/);
  return m ? { desc: m[1].trim(), cajas: parseInt(m[2], 10) } : { desc: str.trim(), cajas: 0 };
}

function matchProd(desc, productos) {
  const dn = desc.toUpperCase().replace(/\s+/g,'').replace(/UXC_\d+/,'').replace(/LB/,'');
  return (productos || []).find(p => {
    const pn = (p.nombre||'').toUpperCase().replace(/\s+/g,'');
    return pn.length > 3 && dn.length > 3 && (pn.includes(dn.slice(0,5)) || dn.includes(pn.slice(0,5)));
  });
}

function parseWalmartEmail(raw, productos) {
  // Returns { hora, rampa, dia, fechaEntrega, rubros[] }
  const result = { hora: '16:00', rampa: '', dia: '', fechaEntrega: '', rubros: [] };
  if (!raw || !raw.trim()) return result;

  const addRubro = (item, desc, cajas, hora, rampa, dia) => {
    const prod = matchProd(desc, productos);
    result.rubros.push({
      item: item || '',
      descripcion: desc || '',
      cajas: cajas || 0,
      productoId:   prod ? (prod.id || '') : '',
      productoNombre: prod ? (prod.nombre || '') : '',
    });
    if (hora  && !result.hora)         result.hora  = hora.slice(0, 5);
    if (rampa && !result.rampa)        result.rampa = rampa;
    if (dia   && !result.dia)          result.dia   = dia.replace(/\s*-\s*$/, '').trim();
    // Siempre actualizar hora/rampa/dia del PRIMER rubro (como bpm.html)
    if (result.rubros.length === 1) {
      result.hora  = (hora || '16:00').slice(0, 5);
      result.rampa = rampa || '';
      result.dia   = (dia || '').replace(/\s*-\s*$/, '').trim();
    }
  };

  // ── FORMAT A: TAB-SEPARATED ───────────────────────────────────
  // Cols: #ATLAS | #SAP | COD.PROV | NOM.PROV | Item | Descrip | Cajas | Hora | Rampa | Dia | Nota
  if (raw.includes('\t')) {
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      const cols = line.split('\t').map(c => c.trim());
      if (cols[0].includes('ATLAS') || cols[4] === 'Item' || cols[0] === '#') return;
      if (cols.length < 6) return;
      const item  = cols[4] || '';
      const desc  = cols[5] || '';
      const cajas = parseInt(cols[6], 10) || 0;
      const hora  = (cols[7] || '16:00').slice(0, 5);
      const rampa = cols[8] || '';
      const dia   = (cols[9] || '').replace(/\s*-\s*$/, '').trim();
      if (!item && !desc) return;
      addRubro(item, desc, cajas, hora, rampa, dia);
    });
  }

  // ── FORMAT B: CONCATENATED STRING (0015XXXXXXXXXX prefix) ────
  if (!result.rubros.length) {
    const dataM = raw.match(/0015\d{8}|\d{10}/);
    const data = dataM ? raw.slice(dataM.index) : raw;
    const recStarts = [];
    const recRe = /0015\d{8}/g;
    let rm;
    while ((rm = recRe.exec(data)) !== null) recStarts.push(rm.index);
    recStarts.push(data.length);
    for (let i = 0; i < recStarts.length - 1; i++) {
      let chunk = data.slice(recStarts[i], recStarts[i+1]).trim().replace(/\s*-\s*$/, '');
      const tmM = chunk.match(/(\d{2}:\d{2}:\d{2})/);
      if (!tmM) continue;
      const before = chunk.slice(0, tmM.index);
      const afterT = chunk.slice(tmM.index + tmM[1].length).trim();
      const raM = afterT.match(/^(\d{4})\s*([\s\S]*)/);
      const rampa = raM ? raM[1] : '';
      const dia   = raM ? raM[2].replace(/\s{2,}/g,' ').replace(/\s*-\s*$/,'').trim() : '';
      const pfxM = before.match(/^(\d{4})(\d{8})/);
      if (!pfxM) continue;
      const rest  = before.slice(pfxM[0].length);
      const itemM = rest.match(/(\d{5,})/);
      if (!itemM) continue;
      const item  = itemM[1];
      const { desc, cajas } = splitDescCajas(rest.slice(itemM.index + item.length));
      addRubro(item, desc, cajas, tmM[1].slice(0,5), rampa, dia);
    }
  }

  // ── FORMAT C: LINE-BY-LINE with time anchor ───────────────────
  if (!result.rubros.length) {
    raw.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
      const tmM = line.match(/(\d{2}:\d{2}:\d{2})/);
      if (!tmM) return;
      const before = line.slice(0, tmM.index).trim();
      const afterT = line.slice(tmM.index + tmM[1].length).trim();
      const raM = afterT.match(/^(\d{4,})\s*(.*)/);
      const rampa = raM ? raM[1] : '';
      const dia   = raM ? raM[2].replace(/\s*-\s*$/, '').trim() : '';
      const itemM = before.match(/(\d{5,8})\s+/);
      if (!itemM) return;
      const item  = itemM[1];
      const { desc, cajas } = splitDescCajas(before.slice(itemM.index + itemM[0].length));
      if (!desc) return;
      addRubro(item, desc, cajas, tmM[1].slice(0,5), rampa, dia);
    });
  }

  // Parsear fecha del campo dia
  if (result.dia) result.fechaEntrega = parseFechaEsp(result.dia);

  return result;
}

// ── Modal: importar pedido desde correo ───────────────────────────
function EmailImportModal({ onClose, onSaved, add, productos }) {
  const toast = useToast();
  const [raw,     setRaw]     = useState('');
  const [parsed,  setParsed]  = useState(null);
  const [rubros,  setRubros]  = useState([]);
  const [fecha,   setFecha]   = useState('');
  const [hora,    setHora]    = useState('');
  const [rampa,   setRampa]   = useState('');
  const [saving,  setSaving]  = useState(false);

  const handleParse = () => {
    const r = parseWalmartEmail(raw, productos);
    if (!r.rubros.length) { toast('No se pudo leer el pedido. Prueba copiando la tabla completa.', 'error'); return; }
    setParsed(r);
    setRubros(r.rubros.map((x, i) => ({ ...x, _id: i })));
    setFecha(r.fechaEntrega || today());
    setHora(r.hora || '16:00');
    setRampa(r.rampa || '');
  };

  const updateRubro = (idx, field, val) =>
    setRubros(prev => prev.map((r, i) => i === idx ? { ...r, [field]: field === 'cajas' ? (parseInt(val)||0) : val } : r));

  const removeRubro = (idx) => setRubros(prev => prev.filter((_, i) => i !== idx));

  const totalCajas = rubros.reduce((s, r) => s + (r.cajas || 0), 0);

  const handleGuardar = async () => {
    if (!fecha) { toast('Ingresa la fecha de entrega', 'error'); return; }
    if (!rubros.length) { toast('No hay rubros para guardar', 'error'); return; }
    setSaving(true);
    try {
      const doc = {
        fecha, fechaEntrega: fecha,
        cliente:      'Walmart',
        horaEntrega:  hora,
        rampa,
        notaImportante: parsed?.dia || '',
        descripcion:  rubros.map(r => r.descripcion).join(' / ').slice(0, 200),
        rubros:       rubros.map(({ _id, ...r }) => ({ ...r, estado:'pendiente', cajasAceptadas:null, cajasRechazadas:null })),
        totalCajas,
        total:        0,
        estado:       'pendiente',
        fuente:       'gmail',
        numOC: '', numAtlas: '', numFel: '', montoFactura: 0, fechaFactura: '',
        estadoCobro:  'pendiente',
        obs:          '',
        creadoEn:     new Date().toISOString(),
      };
      await add(doc);
      toast(`✅ ${rubros.length} rubros importados — ${parsed?.dia || ''}`);
      onSaved?.();
      onClose();
    } catch { toast('Error al guardar', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: WHITE, borderRadius: 10, maxWidth: 780, width: '100%',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.18)',
      }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:`1px solid ${T.border}` }}>
          <div>
            <div style={{ fontWeight:700, fontSize:'1rem', color:T.textDark }}>📧 Importar pedido desde correo</div>
            <div style={{ fontSize:'.75rem', color:T.textMid, marginTop:2 }}>
              Funciona con: texto plano separado por |, copia de tabla con TAB, o línea por línea.
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:T.textMid, lineHeight:1 }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Textarea */}
          <textarea
            value={raw} onChange={e => { setRaw(e.target.value); setParsed(null); setRubros([]); }}
            rows={5}
            style={{ ...IS, resize:'vertical', fontFamily:'monospace', fontSize:'.8rem', marginBottom:12 }}
            placeholder="Pega aquí el texto del correo de Walmart..." />

          <div style={{ display:'flex', gap:8, marginBottom:parsed ? 20 : 0 }}>
            <button onClick={handleParse} disabled={!raw.trim()}
              style={{ padding:'8px 22px', background: raw.trim() ? T.warn : T.border, color:WHITE, border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor:raw.trim()?'pointer':'not-allowed' }}>
              ⚡ Parsear
            </button>
            <button onClick={onClose} style={{ padding:'8px 16px', background:'none', border:`1px solid ${T.border}`, borderRadius:6, color:T.textMid, fontWeight:600, fontSize:'.88rem', cursor:'pointer' }}>
              Cancelar
            </button>
          </div>

          {parsed && (
            <>
              {/* Header editable */}
              <div style={{ background:'#F0FFF4', border:`1px solid #C8E6C9`, borderRadius:8, padding:'14px 16px', marginBottom:16 }}>
                <div style={{ fontSize:'.72rem', fontWeight:700, color:T.secondary, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>
                  📋 Datos detectados — confirma antes de guardar
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                  <label style={LS}>Fecha entrega
                    <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...IS, fontSize:'.82rem' }} />
                  </label>
                  <label style={LS}>Hora
                    <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={{ ...IS, fontSize:'.82rem' }} />
                  </label>
                  <label style={LS}>Rampa
                    <input value={rampa} onChange={e => setRampa(e.target.value)} style={{ ...IS, fontSize:'.82rem' }} />
                  </label>
                </div>
                {parsed.dia && (
                  <div style={{ marginTop:8, fontSize:'.78rem', color:T.secondary, fontWeight:600 }}>
                    📅 Día del correo: {parsed.dia}
                  </div>
                )}
              </div>

              {/* Tabla rubros editable */}
              <div style={{ overflowX:'auto', marginBottom:14 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.82rem' }}>
                  <thead>
                    <tr style={{ background:T.primary }}>
                      {['# ITEM','DESCRIPCIÓN','CAJAS','PRODUCTO INVENTARIO',''].map(h => (
                        <th key={h} style={{ ...thSt, padding:'8px 10px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rubros.map((r, i) => (
                      <tr key={r._id} style={{ background: i%2===0 ? WHITE : '#F9FBF9' }}>
                        <td style={{ padding:'5px 8px', borderBottom:`1px solid #F0F0F0` }}>
                          <input value={r.item} onChange={e => updateRubro(i,'item',e.target.value)}
                            style={{ width:90, border:`1px solid ${T.border}`, borderRadius:4, padding:'4px 6px', fontSize:'.8rem', fontFamily:'monospace' }} />
                        </td>
                        <td style={{ padding:'5px 8px', borderBottom:`1px solid #F0F0F0` }}>
                          <input value={r.descripcion} onChange={e => updateRubro(i,'descripcion',e.target.value)}
                            style={{ width:'100%', border:`1px solid ${T.border}`, borderRadius:4, padding:'4px 6px', fontSize:'.8rem', minWidth:180 }} />
                        </td>
                        <td style={{ padding:'5px 8px', borderBottom:`1px solid #F0F0F0`, textAlign:'center' }}>
                          <input type="number" min="0" value={r.cajas} onChange={e => updateRubro(i,'cajas',e.target.value)}
                            style={{ width:70, border:`1px solid ${T.border}`, borderRadius:4, padding:'4px 6px', fontSize:'.88rem', fontWeight:700, color:T.secondary, textAlign:'center' }} />
                        </td>
                        <td style={{ padding:'5px 8px', borderBottom:`1px solid #F0F0F0` }}>
                          <select value={r.productoId} onChange={e => updateRubro(i,'productoId',e.target.value)}
                            style={{ width:'100%', border:`1px solid ${T.border}`, borderRadius:4, padding:'4px 6px', fontSize:'.78rem', minWidth:140 }}>
                            <option value="">— Vincular producto —</option>
                            {(productos || []).map(p => (
                              <option key={p.id} value={p.id}>{p.nombre}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding:'5px 8px', borderBottom:`1px solid #F0F0F0`, textAlign:'center' }}>
                          <button onClick={() => removeRubro(i)}
                            style={{ background:'none', border:'none', cursor:'pointer', color:T.textMid, fontSize:'1rem', lineHeight:1 }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'#F0FFF4', fontWeight:700 }}>
                      <td colSpan={2} style={{ padding:'8px 10px', color:T.secondary }}>Total</td>
                      <td style={{ padding:'8px 10px', textAlign:'center', color:T.secondary, fontSize:'1rem' }}>{totalCajas}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Guardar */}
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={handleGuardar} disabled={saving}
                  style={{ padding:'10px 28px', background: saving ? T.border : T.secondary, color:WHITE, border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor:saving?'not-allowed':'pointer' }}>
                  {saving ? 'Guardando…' : '💾 Guardar pedido'}
                </button>
                <button onClick={() => { setParsed(null); setRubros([]); }}
                  style={{ padding:'10px 16px', background:'none', border:`1px solid ${T.border}`, borderRadius:6, color:T.textMid, fontWeight:600, fontSize:'.88rem', cursor:'pointer' }}>
                  — Volver
                </button>
              </div>
            </>
          )}
        </div>
      </div>
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
  totalCajas: '', horaEntrega: '', rampa: '', notaImportante: '',
  estado: 'pendiente', rubros: [], fuente: 'manual',
};

// ═══════════════════════════════════════════════════════════════════
// TAB 1 — Pedidos
// ═══════════════════════════════════════════════════════════════════
function TabPedidos({ data, loading, add, update, remove, saving, productos }) {
  const toast = useToast();

  const [formOpen,        setFormOpen]        = useState(false);
  const [showImportModal, setShowImportModal]  = useState(false);
  const [form,            setForm]            = useState({ ...BLANK_FORM });
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const [filterTab,       setFilterTab]       = useState('todos');
  const [search,          setSearch]          = useState('');
  const [expandedId,      setExpandedId]      = useState(null);

  const [felOpenId,       setFelOpenId]       = useState(null);
  const [entregadoOpenId, setEntregadoOpenId] = useState(null);
  const [entregadoForm,   setEntregadoForm]   = useState({ cajasEntregadas: '', tipoEntrega: 'aceptado_total', motivoRechazo: '' });
  const [entregadoPorRubro, setEntregadoPorRubro] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleSave = async () => {
    if (!form.fechaEntrega) { toast('Ingresa la fecha de entrega', 'error'); return; }
    const totalCajas = form.rubros?.length
      ? form.rubros.reduce((s, r) => s + (r.cajas || 0), 0)
      : parseFloat(form.totalCajas) || 0;
    try {
      await add({
        fecha:          form.fechaEntrega,
        fechaEntrega:   form.fechaEntrega,
        cliente:        'Walmart',
        numOC:          form.numOC,
        numAtlas:       form.numAtlas,
        rampa:          form.rampa,
        horaEntrega:    form.horaEntrega,
        notaImportante: form.notaImportante,
        descripcion:    form.descripcion,
        rubros:         form.rubros || [],
        totalCajas,
        total:          0,
        estado:         form.estado,
        fuente:         form.fuente,
        numFel: '', montoFactura: 0, fechaFactura: '',
        estadoCobro:    'pendiente',
        obs:            '',
        creadoEn:       new Date().toISOString(),
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
    } catch { toast('Error al actualizar', 'error'); }
  };

  const openEntregado = (r) => {
    if (r.rubros?.length) {
      setEntregadoPorRubro(true);
      setEntregadoForm(r.rubros.map(rb => ({
        cajasEntregadas: String(rb.cajas ?? rb.cajasPedidas ?? ''),
        tipoEntrega: 'aceptado_total',
        motivoRechazo: '',
      })));
    } else {
      setEntregadoPorRubro(false);
      setEntregadoForm({ cajasEntregadas: r.totalCajas || '', tipoEntrega: 'aceptado_total', motivoRechazo: '' });
    }
    setEntregadoOpenId(r.id);
  };

  const handleEntregadoSave = async (id, r) => {
    try {
      let payload = { estado: 'entregado', fechaEntregaReal: today() };
      if (entregadoPorRubro && Array.isArray(entregadoForm)) {
        const updRubros = (r.rubros || []).map((rb, i) => ({
          ...rb,
          cajasEntregadas: parseFloat(entregadoForm[i]?.cajasEntregadas) || 0,
          tipoEntrega:     entregadoForm[i]?.tipoEntrega || 'aceptado_total',
          motivoRechazo:   entregadoForm[i]?.motivoRechazo || '',
        }));
        payload.rubros = updRubros;
        payload.cajasEntregadas = updRubros.reduce((s, rb) => s + (rb.cajasEntregadas || 0), 0);
        const tipos = updRubros.map(rb => rb.tipoEntrega);
        payload.tipoEntrega = tipos.every(t => t === 'aceptado_total') ? 'aceptado_total' : 'aceptado_parcial';
      } else {
        payload.cajasEntregadas = parseFloat(entregadoForm.cajasEntregadas) || 0;
        payload.tipoEntrega     = entregadoForm.tipoEntrega;
        payload.motivoRechazo   = entregadoForm.motivoRechazo;
      }
      await update(id, payload);
      toast('Entrega registrada');
      setEntregadoOpenId(null);
      setFelOpenId(id);
    } catch { toast('Error al guardar', 'error'); }
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
      {/* Modal importar correo */}
      {showImportModal && (
        <EmailImportModal
          productos={productos}
          add={add}
          onClose={() => setShowImportModal(false)}
          onSaved={() => setShowImportModal(false)}
        />
      )}

      {/* Botones de acción */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <button onClick={() => setFormOpen(o => !o)}
          style={{ padding:'9px 18px', background: formOpen ? '#F5F5F5' : T.primary, color: formOpen ? T.textMid : WHITE, border: formOpen ? `1px solid ${T.border}` : 'none', borderRadius:6, fontWeight:600, fontSize:'.88rem', cursor:'pointer' }}>
          {formOpen ? '▲ Cerrar' : '＋ Nuevo Pedido'}
        </button>
        <button onClick={() => setShowImportModal(true)}
          style={{ padding:'9px 18px', background:'#E3F2FD', color:T.info, border:`1px solid #BBDEFB`, borderRadius:6, fontWeight:600, fontSize:'.88rem', cursor:'pointer' }}>
          📧 Desde correo
        </button>
      </div>

      {formOpen && (
        <div style={card}>
          <div style={{ fontWeight:700, fontSize:'.92rem', color:T.textDark, marginBottom:16, paddingBottom:10, borderBottom:`1px solid ${T.border}` }}>
            Nuevo Pedido — Manual
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12, marginBottom:14 }}>
            <label style={LS}>Fecha entrega *
              <input type="date" value={form.fechaEntrega} onChange={e => s('fechaEntrega', e.target.value)} style={IS} />
            </label>
            <label style={LS}>OC #
              <input value={form.numOC} onChange={e => s('numOC', e.target.value)} placeholder="Número OC" style={IS} />
            </label>
            <label style={LS}>Atlas/SAP
              <input value={form.numAtlas} onChange={e => s('numAtlas', e.target.value)} placeholder="# Atlas" style={IS} />
            </label>
            <label style={LS}>Hora entrega
              <input type="time" value={form.horaEntrega} onChange={e => s('horaEntrega', e.target.value)} style={IS} />
            </label>
            <label style={LS}>Rampa
              <input value={form.rampa} onChange={e => s('rampa', e.target.value)} placeholder="Ej. 5010" style={IS} />
            </label>
            <label style={LS}>Total cajas
              <input type="number" min="0" value={form.totalCajas} onChange={e => s('totalCajas', e.target.value)} placeholder="0" style={IS} />
            </label>
            <label style={LS}>Estado
              <select value={form.estado} onChange={e => s('estado', e.target.value)} style={IS}>
                {Object.entries(ESTADO_CFG).map(([v, b]) => <option key={v} value={v}>{b.label}</option>)}
              </select>
            </label>
            <label style={LS}>Nota importante
              <input value={form.notaImportante} onChange={e => s('notaImportante', e.target.value)} placeholder="Ej. JUEVES 26 DE MARZO" style={IS} />
            </label>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding:'10px 26px', background: saving ? T.border : T.primary, color:WHITE, border:'none', borderRadius:6, fontWeight:600, fontSize:'.88rem', cursor:saving?'not-allowed':'pointer' }}>
              {saving ? 'Guardando…' : 'Guardar Pedido'}
            </button>
            <button onClick={() => setFormOpen(false)}
              style={{ padding:'10px 16px', background:'none', color:T.textMid, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, fontSize:'.88rem', cursor:'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* List card */}
      <div style={card}>
        {/* Filter tabs + search */}
        <div style={{ overflowX: isMobile ? 'auto' : 'visible', paddingBottom: isMobile ? 4 : 0, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 'max-content' }}>
            {FILTER_TABS.map(ft => {
              const count = ft.key === 'todos' ? data.length : data.filter(r => r.estado === ft.key).length;
              return (
                <button key={ft.key} onClick={() => setFilterTab(ft.key)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: '.75rem', fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${filterTab === ft.key ? T.primary : T.border}`,
                  background: filterTab === ft.key ? T.primary : WHITE,
                  color: filterTab === ft.key ? WHITE : T.textMid,
                  whiteSpace: 'nowrap', minWidth: 0,
                }}>
                  {ft.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar OC, descripción, rampa…"
          style={{ ...IS, width: '100%', fontSize: '.82rem', padding: '6px 10px', marginBottom: 12 }} />

        {loading ? <Skeleton rows={6} /> : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 24px', color: T.textMid, fontSize: '.88rem' }}>Sin pedidos.</div>
        ) : isMobile ? (
          /* ── MOBILE: cards ── */
          <div>
            {filtered.slice(0, 150).map(r => {
              const entregadoContent = entregadoOpenId === r.id ? (
                r.rubros?.length > 0 ? (
                  <div>
                    <div style={{ fontWeight:700, fontSize:13, color:T.secondary, textTransform:'uppercase', marginBottom:8 }}>Confirmar entrega por producto</div>
                    {r.rubros.map((rb, ri) => {
                      const frm = Array.isArray(entregadoForm) ? (entregadoForm[ri] || {}) : {};
                      const setFrm = (k, v) => setEntregadoForm(prev => {
                        const next = [...(Array.isArray(prev) ? prev : [])];
                        next[ri] = { ...(next[ri] || {}), [k]: v };
                        return next;
                      });
                      const tipo = frm.tipoEntrega || 'aceptado_total';
                      return (
                        <div key={ri} style={{ background:'#F9FBF9', borderRadius:6, padding:'10px', marginBottom:6 }}>
                          <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>
                            {rb.item && <span style={{ fontFamily:'monospace', fontSize:11, color:T.textMid, marginRight:4 }}>{rb.item}</span>}
                            {rb.descripcion} — <b style={{ color:T.secondary }}>{rb.cajas ?? rb.cajasPedidas ?? 0} ped.</b>
                          </div>
                          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                            <input type="number" min="0" value={frm.cajasEntregadas ?? ''} onChange={e => setFrm('cajasEntregadas', e.target.value)}
                              placeholder="Entregadas" style={{ width:90, padding:'6px 8px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:14, outline:'none' }} />
                            <select value={tipo} onChange={e => setFrm('tipoEntrega', e.target.value)}
                              style={{ flex:1, padding:'6px 8px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:13, outline:'none' }}>
                              <option value="aceptado_total">✓ Total</option>
                              <option value="aceptado_parcial">~ Parcial</option>
                              <option value="rechazo">✕ Rechazo</option>
                              <option value="no_entregado">— No entregado</option>
                            </select>
                          </div>
                          {(tipo === 'rechazo' || tipo === 'aceptado_parcial') && (
                            <input value={frm.motivoRechazo || ''} onChange={e => setFrm('motivoRechazo', e.target.value)}
                              placeholder="Motivo…" style={{ width:'100%', marginTop:6, padding:'6px 8px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:13, outline:'none', boxSizing:'border-box' }} />
                          )}
                        </div>
                      );
                    })}
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <button onClick={() => handleEntregadoSave(r.id, r)} style={{ flex:1, minHeight:44, background:T.primary, color:WHITE, border:'none', borderRadius:8, fontWeight:700, fontSize:14, cursor:'pointer' }}>Confirmar entrega</button>
                      <button onClick={() => setEntregadoOpenId(null)} style={{ minHeight:44, padding:'0 16px', background:'#F5F5F5', color:T.textMid, border:`1px solid ${T.border}`, borderRadius:8, fontWeight:600, fontSize:14, cursor:'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:10 }}>
                      <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, fontWeight:600, color:T.textMid, textTransform:'uppercase' }}>
                        Cajas entregadas
                        <input type="number" min="0" value={entregadoForm.cajasEntregadas || ''} onChange={e => setEntregadoForm(f => ({ ...f, cajasEntregadas: e.target.value }))} style={{ ...IS }} />
                      </label>
                      <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, fontWeight:600, color:T.textMid, textTransform:'uppercase' }}>
                        Tipo de entrega
                        <select value={entregadoForm.tipoEntrega || 'aceptado_total'} onChange={e => setEntregadoForm(f => ({ ...f, tipoEntrega: e.target.value }))} style={{ ...IS }}>
                          <option value="aceptado_total">Aceptado total</option>
                          <option value="aceptado_parcial">Aceptado parcial</option>
                          <option value="rechazo">Rechazo</option>
                          <option value="no_entregado">No entregado</option>
                        </select>
                      </label>
                      {(entregadoForm.tipoEntrega === 'rechazo' || entregadoForm.tipoEntrega === 'aceptado_parcial') && (
                        <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, fontWeight:600, color:T.textMid, textTransform:'uppercase' }}>
                          Motivo
                          <input value={entregadoForm.motivoRechazo || ''} onChange={e => setEntregadoForm(f => ({ ...f, motivoRechazo: e.target.value }))} placeholder="Detalle motivo..." style={{ ...IS }} />
                        </label>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => handleEntregadoSave(r.id, r)} style={{ flex:1, minHeight:44, background:T.primary, color:WHITE, border:'none', borderRadius:8, fontWeight:700, fontSize:14, cursor:'pointer' }}>Confirmar entrega</button>
                      <button onClick={() => setEntregadoOpenId(null)} style={{ minHeight:44, padding:'0 16px', background:'#F5F5F5', color:T.textMid, border:`1px solid ${T.border}`, borderRadius:8, fontWeight:600, fontSize:14, cursor:'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                )
              ) : felOpenId === r.id ? (
                <FelForm record={r} onSave={data => handleFelSave(r.id, data)} onClose={() => setFelOpenId(null)} />
              ) : null;

              return (
                <WalmartCard
                  key={r.id}
                  r={r}
                  onPreparando={() => handleEstado(r.id, 'preparando')}
                  onOpenEntregado={() => openEntregado(r)}
                  onFel={() => setFelOpenId(felOpenId === r.id ? null : r.id)}
                  onDelete={() => handleDelete(r.id)}
                  expandedContent={entregadoContent}
                />
              );
            })}
          </div>
        ) : (
          /* ── DESKTOP: tabla original ── */
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
                      <td style={{ ...tdSt, fontWeight: 600 }}>
                        <div>{r.fechaEntrega || r.fecha || '—'}</div>
                        {r.horaEntrega && <div style={{ fontSize:'.72rem', color:T.secondary, fontWeight:700 }}>{r.horaEntrega}</div>}
                        {r.notaImportante && <div style={{ fontSize:'.7rem', color:T.info, marginTop:1 }}>📅 {r.notaImportante}</div>}
                      </td>
                      <td style={{ ...tdSt, fontSize: '.8rem', fontFamily: 'monospace' }}>
                        {r.numOC || '—'}
                        {r.fuente === 'gmail' && (
                          <span style={{ marginLeft: 6, padding: '2px 6px', background: '#E3F2FD', color: T.info, borderRadius: 10, fontSize: '.65rem', fontWeight: 700 }}>📧</span>
                        )}
                      </td>
                      <td style={{ ...tdSt, fontSize: '.78rem', color: T.textMid }}>{r.numAtlas || '—'}</td>
                      <td style={{ ...tdSt, maxWidth: 240 }}>
                        {r.rubros?.length > 0 ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                            {r.rubros.map((rb, ri) => (
                              <div key={ri} style={{ fontSize:'.76rem', lineHeight:1.3 }}>
                                {rb.item && <span style={{ fontFamily:'monospace', fontSize:'.68rem', color:T.textMid, marginRight:5 }}>{rb.item}</span>}
                                <span style={{ color:T.textDark }}>{rb.descripcion || '—'}</span>
                                <span style={{ fontWeight:700, color:T.secondary, marginLeft:5 }}>({rb.cajas ?? rb.cajasPedidas ?? 0})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'.82rem' }}>{r.descripcion || '—'}</div>
                        )}
                      </td>
                      <td style={{ ...tdSt, fontWeight: 600 }}>{r.totalCajas || r.rubros?.reduce((s,x)=>s+(x.cajas??x.cajasPedidas??0),0) || '—'}</td>
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
                            <button onClick={() => openEntregado(r)}
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
                    {entregadoOpenId === r.id && (
                      <tr key={r.id + '_ent'} style={{ background: '#F1F8E9' }}>
                        <td colSpan={8} style={{ padding: '12px 14px' }}>
                          {r.rubros?.length > 0 ? (
                            <div>
                              <div style={{ fontWeight:700, fontSize:'.78rem', color:T.secondary, textTransform:'uppercase', marginBottom:8 }}>Confirmar entrega por producto</div>
                              <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:10 }}>
                                <thead>
                                  <tr style={{ background:'#C8E6C9' }}>
                                    {['Item','Descripción','Pedidas','Entregadas','Tipo','Motivo'].map(h => (
                                      <th key={h} style={{ padding:'5px 8px', fontSize:'.68rem', fontWeight:700, textAlign:'left', color:T.secondary, textTransform:'uppercase' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.rubros.map((rb, ri) => {
                                    const frm = Array.isArray(entregadoForm) ? (entregadoForm[ri] || {}) : {};
                                    const setFrm = (k, v) => setEntregadoForm(prev => {
                                      const next = [...(Array.isArray(prev) ? prev : [])];
                                      next[ri] = { ...(next[ri] || {}), [k]: v };
                                      return next;
                                    });
                                    const tipo = frm.tipoEntrega || 'aceptado_total';
                                    return (
                                      <tr key={ri} style={{ background: ri%2===0 ? WHITE : '#F9FBF9' }}>
                                        <td style={{ padding:'5px 8px', fontFamily:'monospace', fontSize:'.72rem', color:T.textMid }}>{rb.item || '—'}</td>
                                        <td style={{ padding:'5px 8px', fontSize:'.78rem' }}>{rb.descripcion || '—'}</td>
                                        <td style={{ padding:'5px 8px', fontWeight:700, color:T.secondary, textAlign:'center' }}>{rb.cajas ?? rb.cajasPedidas ?? 0}</td>
                                        <td style={{ padding:'5px 8px' }}>
                                          <input type="number" min="0" value={frm.cajasEntregadas ?? ''}
                                            onChange={e => setFrm('cajasEntregadas', e.target.value)}
                                            style={{ width:70, padding:'4px 6px', border:`1.5px solid ${T.border}`, borderRadius:4, fontSize:'.82rem', outline:'none' }} />
                                        </td>
                                        <td style={{ padding:'5px 8px' }}>
                                          <select value={tipo} onChange={e => setFrm('tipoEntrega', e.target.value)}
                                            style={{ padding:'4px 6px', border:`1.5px solid ${T.border}`, borderRadius:4, fontSize:'.75rem', outline:'none' }}>
                                            <option value="aceptado_total">✓ Total</option>
                                            <option value="aceptado_parcial">~ Parcial</option>
                                            <option value="rechazo">✕ Rechazo</option>
                                            <option value="no_entregado">— No entregado</option>
                                          </select>
                                        </td>
                                        <td style={{ padding:'5px 8px' }}>
                                          {(tipo === 'rechazo' || tipo === 'aceptado_parcial') && (
                                            <input value={frm.motivoRechazo || ''} onChange={e => setFrm('motivoRechazo', e.target.value)}
                                              placeholder="Motivo…"
                                              style={{ width:130, padding:'4px 6px', border:`1.5px solid ${T.border}`, borderRadius:4, fontSize:'.75rem', outline:'none' }} />
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              <div style={{ display:'flex', gap:8 }}>
                                <button onClick={() => handleEntregadoSave(r.id, r)}
                                  style={{ padding:'9px 20px', background:T.primary, color:WHITE, border:'none', borderRadius:6, fontWeight:700, fontSize:'.82rem', cursor:'pointer' }}>
                                  Confirmar entrega
                                </button>
                                <button onClick={() => setEntregadoOpenId(null)}
                                  style={{ padding:'9px 14px', background:'none', color:T.textMid, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, fontSize:'.82rem', cursor:'pointer' }}>
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                              <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, color:T.textMid, textTransform:'uppercase' }}>
                                Cajas entregadas
                                <input type="number" min="0" value={entregadoForm.cajasEntregadas || ''}
                                  onChange={e => setEntregadoForm(f => ({ ...f, cajasEntregadas: e.target.value }))}
                                  style={{ ...IS, width: 110 }} />
                              </label>
                              <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, color:T.textMid, textTransform:'uppercase' }}>
                                Tipo de entrega
                                <select value={entregadoForm.tipoEntrega || 'aceptado_total'}
                                  onChange={e => setEntregadoForm(f => ({ ...f, tipoEntrega: e.target.value }))}
                                  style={{ ...IS, width: 190 }}>
                                  <option value="aceptado_total">Aceptado total</option>
                                  <option value="aceptado_parcial">Aceptado parcial</option>
                                  <option value="rechazo">Rechazo</option>
                                  <option value="no_entregado">No entregado</option>
                                </select>
                              </label>
                              {(entregadoForm.tipoEntrega === 'rechazo' || entregadoForm.tipoEntrega === 'aceptado_parcial') && (
                                <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, color:T.textMid, textTransform:'uppercase', flex:1 }}>
                                  Motivo
                                  <input value={entregadoForm.motivoRechazo || ''}
                                    onChange={e => setEntregadoForm(f => ({ ...f, motivoRechazo: e.target.value }))}
                                    placeholder="Detalle motivo..." style={{ ...IS, minWidth: 180 }} />
                                </label>
                              )}
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => handleEntregadoSave(r.id, r)}
                                  style={{ padding:'9px 18px', background:T.primary, color:WHITE, border:'none', borderRadius:6, fontWeight:700, fontSize:'.82rem', cursor:'pointer' }}>
                                  Confirmar entrega
                                </button>
                                <button onClick={() => setEntregadoOpenId(null)}
                                  style={{ padding:'9px 14px', background:'#F5F5F5', color:T.textMid, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, fontSize:'.82rem', cursor:'pointer' }}>
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
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

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

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
      ) : isMobile ? (
        /* ── MOBILE: cards facturación ── */
        <div>
          {entregados.map(r => (
            <div key={r.id} style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,.12)', borderLeft: `4px solid ${T.primary}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                <span style={{ fontWeight:700, fontSize:15 }}>{r.fechaEntrega || r.fecha || '—'}</span>
                <Badge cfg={COBRO_CFG} value={r.estadoCobro || 'pendiente'} />
              </div>
              <div style={{ fontSize:13, color:'#374151', marginBottom:4, lineHeight:1.4 }}>{r.descripcion || '—'}</div>
              <div style={{ display:'flex', gap:16, fontSize:13, color:'#555', marginBottom:4, flexWrap:'wrap' }}>
                <span><b>OC:</b> {r.numOC || '—'}</span>
                <span><b>Monto:</b> {r.montoFactura ? `Q ${fmt(r.montoFactura)}` : r.total ? `Q ${fmt(r.total)}` : '—'}</span>
              </div>
              {(r.noFel || r.numFel) && (
                <div style={{ fontSize:12, color:T.textMid, marginBottom:8, fontFamily:'monospace' }}>
                  FEL: {r.noFel || r.numFel} {r.serieFel ? `· Serie ${r.serieFel}` : ''}
                </div>
              )}
              <div style={{ display:'flex', gap:8 }}>
                {r.estadoCobro !== 'cobrado' && (
                  <button onClick={() => setFelOpenId(felOpenId === r.id ? null : r.id)}
                    style={{ flex:1, minHeight:44, borderRadius:8, border:'1.5px solid #16a34a', background:'#F0FFF4', color:'#16a34a', fontWeight:600, fontSize:14, cursor:'pointer' }}>
                    {r.noFel || r.numFel ? '✏️ Editar FEL' : '📄 Cargar FEL'}
                  </button>
                )}
                {(r.noFel || r.numFel) && r.estadoCobro !== 'cobrado' && (
                  <button onClick={() => handleCobrar(r.id)}
                    style={{ flex:1, minHeight:44, borderRadius:8, border:'none', background:'#16a34a', color:WHITE, fontWeight:600, fontSize:14, cursor:'pointer' }}>
                    ✓ Cobrado
                  </button>
                )}
                {r.estadoCobro === 'cobrado' && (
                  <span style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', minHeight:44, borderRadius:8, background:'#E8F5E9', color:T.secondary, fontWeight:700, fontSize:14 }}>
                    ✓ Cobrado
                  </span>
                )}
              </div>
              {felOpenId === r.id && (
                <div style={{ marginTop:12, borderTop:'1px solid #E0E0E0', paddingTop:12 }}>
                  <FelForm record={r} onSave={felData => handleFelSave(r.id, felData)} onClose={() => setFelOpenId(null)} />
                </div>
              )}
            </div>
          ))}
          <div style={{ background: T.bgGreen, borderRadius:8, padding:'12px 16px', fontWeight:700, color:T.primary, display:'flex', justifyContent:'space-between' }}>
            <span>Total entregado</span><span>Q {fmt(totalEntregado)}</span>
          </div>
          <div style={{ background:'#E8F5E9', borderRadius:8, padding:'10px 16px', fontWeight:700, color:T.secondary, display:'flex', justifyContent:'space-between', marginTop:6 }}>
            <span>Total cobrado</span><span>Q {fmt(totalCobrado)}</span>
          </div>
        </div>
      ) : (
        /* ── DESKTOP: tabla original ── */
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
                          {r.estadoCobro !== 'cobrado' && (
                            <button onClick={() => setFelOpenId(felOpenId === r.id ? null : r.id)}
                              style={{ padding: '4px 9px', background: '#E8F5E9', color: T.secondary, border: `1px solid #C8E6C9`, borderRadius: 4, fontSize: '.7rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              {r.noFel || r.numFel ? 'Editar FEL' : 'Cargar Factura FEL'}
                            </button>
                          )}
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
                    {(() => { const c = p.totalCajas || p.rubros?.reduce((s,x)=>s+(x.cajas??x.cajasPedidas??0),0) || 0; return c ? `${c} caj.` : p.numOC ? `OC ${p.numOC}` : p.descripcion?.slice(0,12) || '—'; })()}
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
                <span style={{ fontWeight: 600 }}>{(() => { const c = r.totalCajas || r.rubros?.reduce((s,x)=>s+(x.cajas??x.cajasPedidas??0),0) || 0; return c ? `${c} cajas` : ''; })()}</span>
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
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState(null);
  const [gasUrl,     setGasUrlState] = useState(getGasUrl);
  const [urlDraft,   setUrlDraft]   = useState(getGasUrl);
  const [showConfig, setShowConfig] = useState(!getGasUrl());

  const gmailPedidos = useMemo(
    () => data.filter(r => r.fuente === 'gmail').slice(0, 10),
    [data]
  );

  const handleSaveUrl = () => {
    setGasUrl(urlDraft);
    setGasUrlState(urlDraft.trim());
    setShowConfig(false);
    toast('URL guardada');
  };

  const handleRevisar = async () => {
    const url = getGasUrl();
    if (!url) { toast('Configura la URL del Apps Script primero', 'error'); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(url, { method: 'GET' });
      const json = await res.json();
      setResult(json);
      // Auto-import new pedidos found
      if (json.pedidos && Array.isArray(json.pedidos)) {
        let nuevos = 0;
        for (const p of json.pedidos) {
          // Skip if OC already exists
          const existe = data.some(r => r.numOC && r.numOC === p.numOC);
          if (existe) continue;
          await add({
            fecha:        p.fechaEntrega || today(),
            fechaEntrega: p.fechaEntrega || today(),
            cliente:      'Walmart',
            numOC:        p.numOC        || '',
            numAtlas:     '',
            rampa:        p.rampa        || '',
            horaEntrega:  p.horaEntrega  || '',
            descripcion:  p.descripcion  || p.asunto || '',
            productos:    [],
            totalCajas:   parseFloat(p.totalCajas) || 0,
            total:        0,
            estado:       'pendiente',
            fuente:       'gmail',
            numFel:       '',
            montoFactura: 0,
            fechaFactura: '',
            estadoCobro:  'pendiente',
            gmailData:    { subject: p.asunto || '', from: p.from || '', date: p.fechaEmail || '' },
            obs:          '',
            creadoEn:     new Date().toISOString(),
          });
          nuevos++;
        }
        toast(nuevos > 0 ? `${nuevos} pedido${nuevos>1?'s':''} importado${nuevos>1?'s':''}` : 'Sin pedidos nuevos en Gmail');
      } else {
        toast('Correos revisados — sin pedidos nuevos');
      }
    } catch {
      toast('Error al conectar con Apps Script. Verifica la URL.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* ── Configuración Apps Script URL ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.textDark }}>📧 Importar desde Gmail</div>
          <button onClick={() => setShowConfig(o => !o)} style={{ fontSize: '.78rem', color: T.info, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            {showConfig ? 'Ocultar config' : '⚙️ Configurar URL'}
          </button>
        </div>

        {showConfig && (
          <div style={{ marginBottom: 14, padding: 14, background: '#F0F4FF', border: `1px solid #BBDEFB`, borderRadius: 8 }}>
            <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.info, marginBottom: 8 }}>
              URL del Apps Script de Gmail
            </div>
            <div style={{ fontSize: '.75rem', color: T.textMid, marginBottom: 10, lineHeight: 1.5 }}>
              Despliega el script <code>apps-script-walmart.gs</code> en Google Apps Script y pega la URL aquí.
              Se guarda localmente en este navegador.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={urlDraft} onChange={e => setUrlDraft(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                style={{ ...IS, flex: '1 1 300px', fontSize: '.82rem' }}
              />
              <button onClick={handleSaveUrl} style={{ padding: '9px 18px', background: T.info, color: WHITE, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Guardar URL
              </button>
            </div>
          </div>
        )}

        <p style={{ fontSize: '.85rem', color: T.textMid, margin: '0 0 14px' }}>
          Conecta con Gmail para detectar correos de Walmart e importar pedidos automáticamente.
        </p>

        {!gasUrl ? (
          <div style={{ padding: '12px 16px', background: '#FFF3E0', border: `1px solid #FFB74D`, borderRadius: 8, fontSize: '.84rem', color: '#E65100' }}>
            ⚠️ Configura la URL del Apps Script (botón arriba) para usar esta función.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={handleRevisar} disabled={loading}
              style={{ padding: '9px 22px', background: loading ? T.border : T.info, color: WHITE, border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Revisando Gmail…' : '🔄 Revisar correos Walmart'}
            </button>
            <span style={{ fontSize: '.75rem', color: T.textMid }}>
              Apps Script configurado ✓
            </span>
          </div>
        )}

        {result && (
          <div style={{ marginTop: 14, padding: 12, background: '#F0FFF4', border: `1px solid #C8E6C9`, borderRadius: 8, fontSize: '.83rem', color: T.secondary }}>
            <b>Respuesta:</b> {typeof result === 'object' ? JSON.stringify(result, null, 2) : result}
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

      {/* Manual import — usar el botón "Desde correo" en la pestaña Pedidos */}
      <div style={{ ...card, background: '#F9FBF9' }}>
        <div style={{ fontSize: '.84rem', color: T.textMid }}>
          Para importar manualmente un correo, usa el botón <b>📧 Desde correo</b> en la pestaña <b>Pedidos</b>.
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function Walmart() {
  const { data: colData, loading }      = useCollection('pedidosWalmart', { orderField: 'fecha', orderDir: 'desc', limit: 500 });
  const { add, update, remove, saving } = useWrite('pedidosWalmart');
  const { data: mainData }              = useMainData();
  const { productos }                   = useProductosCatalogo();
  const toast                           = useToast();

  const [tab,        setTab]        = useState('pedidos');
  const [migrating,  setMigrating]  = useState(false);
  const [migDone,    setMigDone]    = useState(false);

  // ── Datos legacy del bpm.html ──────────────────────────────────
  const legacyRows = useMemo(() => {
    if (!mainData?.pedidosWalmart?.length) return [];
    const existingIds       = new Set(colData.map(r => r.id));
    const existingLegacyIds = new Set(colData.map(r => r.legacyId).filter(Boolean));
    const existingOCs       = new Set(colData.map(r => r.numOC).filter(Boolean));
    // Fingerprint: fecha + numOC (si existe) o fecha + cajas + primer item rubro
    const fp = r => {
      const f = r.fechaEntrega || r.fecha || '';
      if (r.numOC) return `${f}|oc|${r.numOC}`;
      const c = r.totalCajas || (r.rubros||[]).reduce((s,x)=>s+(x.cajas||x.cajasPedidas||0),0) || 0;
      const item = (r.rubros||[])[0]?.item || (r.descripcion||'').slice(0,20).replace(/\s+/g,'');
      return `${f}|${c}|${item}`;
    };
    const existingFPs = new Set(colData.map(fp));
    return (mainData.pedidosWalmart || []).filter(r => {
      if (r.id  && existingIds.has(r.id))       return false;
      if (r.id  && existingLegacyIds.has(r.id)) return false;
      if (r.numOC && existingOCs.has(r.numOC))  return false;
      if (existingFPs.has(fp(r)))               return false;
      return true;
    }).map(r => ({ ...r, _legacy: true }));
  }, [mainData, colData]);

  // ── Vista unificada: colección nueva + legacy — sin duplicados ─
  const data = useMemo(() => {
    // Deduplicar colData: si varios registros tienen el mismo legacyId, conservar solo el primero
    const dedupedCol = colData.filter((r, idx, arr) =>
      !r.legacyId || arr.findIndex(x => x.legacyId === r.legacyId) === idx
    );
    const combined = [...dedupedCol, ...legacyRows];
    combined.sort((a, b) => {
      const fa = a.fechaEntrega || a.fecha || '';
      const fb = b.fechaEntrega || b.fecha || '';
      return fb < fa ? -1 : fb > fa ? 1 : 0;
    });
    return combined;
  }, [colData, legacyRows]);

  // ── Migración: copiar legacy a la nueva colección ──────────────
  const handleMigrar = async () => {
    if (!legacyRows.length) return;
    setMigrating(true);
    try {
      for (const r of legacyRows) {
        const { _legacy, id: _id, ...rest } = r;
        await add({ ...rest, legacyId: _id || null, _migrado: true, creadoEn: rest.creadoEn || new Date().toISOString() });
      }
      setMigDone(true);
      toast(`${legacyRows.length} pedidos migrados a la nueva colección`);
    } catch {
      toast('Error durante la migración', 'error');
    } finally {
      setMigrating(false);
    }
  };

  const pendientes    = data.filter(r => r.estado === 'pendiente' || !r.estado).length;
  const entregadosHoy = data.filter(r => r.estado === 'entregado' && (r.fechaEntrega || r.fecha) === today()).length;
  const totalQ        = useMemo(() => data.filter(r => r.estado !== 'cancelado').reduce((s, r) => s + (r.total || 0), 0), [data]);

  // ── Alerta de pedidos nuevos ────────────────────────────────────
  const seenIds    = useRef(null);
  const audioRef   = useRef(null);

  useEffect(() => {
    if (loading) return;
    const currentIds = new Set(colData.map(r => r.id));
    if (seenIds.current === null) {
      // Primera carga — solo guardar IDs, no alertar
      seenIds.current = currentIds;
      return;
    }
    const nuevos = colData.filter(r =>
      !seenIds.current.has(r.id) && (r.estado === 'pendiente' || !r.estado)
    );
    if (nuevos.length > 0) {
      seenIds.current = currentIds;
      const msg = nuevos.length === 1
        ? `📦 Nuevo pedido Walmart — ${nuevos[0].fechaEntrega || nuevos[0].fecha || ''} · ${nuevos[0].numOC ? 'OC ' + nuevos[0].numOC : (nuevos[0].descripcion || '').slice(0, 60)}`
        : `📦 ${nuevos.length} pedidos nuevos de Walmart`;
      toast(msg, 'info');
      // Browser notification si tiene permiso
      if (Notification?.permission === 'granted') {
        new Notification('AJÚA — Pedido Walmart', {
          body: msg.replace('📦 ', ''),
          icon: '/favicon.svg',
          tag: 'walmart-nuevo',
        });
      }
      // Sonido beep con Web Audio API
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
      } catch { /* sin audio */ }
    } else {
      seenIds.current = currentIds;
    }
  }, [colData, loading]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* Banner migración */}
      {legacyRows.length > 0 && !migDone && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
          background: '#FFF3E0', border: '1.5px solid #FFB74D', borderRadius: 8,
          padding: '11px 16px', marginBottom: 18,
        }}>
          <span style={{ fontSize: '.84rem', fontWeight: 600, color: '#E65100' }}>
            📦 Hay {legacyRows.length} pedido{legacyRows.length > 1 ? 's' : ''} del sistema anterior (bpm.html) sin migrar.
            Se muestran aquí pero no podrás editarlos hasta migrarlos.
          </span>
          <button onClick={handleMigrar} disabled={migrating} style={{
            padding: '7px 18px', background: migrating ? T.border : '#E65100', color: WHITE,
            border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.82rem',
            cursor: migrating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
          }}>
            {migrating ? 'Migrando…' : '⬆ Migrar pedidos'}
          </button>
        </div>
      )}

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

      {tab === 'pedidos'    && <TabPedidos    data={data} loading={loading} add={add} update={update} remove={remove} saving={saving} productos={productos} />}
      {tab === 'ventas'     && <TabVentas     data={data} update={update} />}
      {tab === 'calendario' && <TabCalendario data={data} />}
      {tab === 'gmail'      && <TabGmail      data={data} add={add} />}
    </div>
  );
}
