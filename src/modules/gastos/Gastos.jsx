import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';
import { uploadBase64 } from '../../firebase';

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

const card  = { background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 20, marginBottom: 20 };
const TH_S  = { padding: '10px 14px', fontSize: '.75rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em', color: T.white, background: T.primary, textAlign: 'left', whiteSpace: 'nowrap' };
const TD_S  = (alt) => ({ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', background: alt ? '#F9FBF9' : '#fff', color: T.textDark });
const LS    = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: T.secondary };
const IS    = { padding: '9px 12px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.85rem', outline: 'none', fontFamily: 'inherit', width: '100%', marginTop: 2, color: T.textDark, background: T.white };

const today = () => new Date().toISOString().slice(0, 10);
const fmtQ  = n => Number(n || 0).toLocaleString('es-GT', { style: 'currency', currency: 'GTQ', minimumFractionDigits: 2 });

const BLANK = {
  fecha: today(), monto: '', descripcion: '', recibo: '', metodoPago: 'Efectivo',
  pagadoPor: '', categoria: '', obs: '', fotoUrl: '',
};

// Categories from bpm.html — preserved exactly
const CATS_GROUPS = [
  { label: 'Combustible y Transporte', options: [
    { value: 'comb-camiones', label: 'Combustible Camiones' },
    { value: 'comb-vehiculos', label: 'Combustible Vehículos' },
    { value: 'flete-local', label: 'Flete / Transporte Local' },
    { value: 'renta-furgon', label: 'Renta Furgón Refrigerado' },
  ]},
  { label: 'Material de Empaque', options: [
    { value: 'emp-redes', label: 'Redes / Mallas' },
    { value: 'emp-etiquetas', label: 'Etiquetas' },
    { value: 'emp-sellos', label: 'Sellos / Stickers' },
    { value: 'emp-bolsas', label: 'Bolsas Plásticas' },
    { value: 'emp-cajas', label: 'Cajas de Cartón' },
    { value: 'emp-zuncho', label: 'Zuncho / Flejes' },
    { value: 'emp-ganchos', label: 'Ganchos / Broches' },
    { value: 'emp-pallets', label: 'Pallets' },
    { value: 'emp-otro', label: 'Otro Material Empaque' },
  ]},
  { label: 'Limpieza y Sanidad', options: [
    { value: 'limp-productos', label: 'Productos de Limpieza' },
    { value: 'limp-basura', label: 'Recolección de Basura' },
    { value: 'limp-fumig', label: 'Fumigación / Plaguicidas' },
    { value: 'limp-otro', label: 'Otro Limpieza' },
  ]},
  { label: 'Alimentación Personal', options: [
    { value: 'alim-desayuno', label: 'Desayuno' },
    { value: 'alim-almuerzo', label: 'Almuerzo' },
    { value: 'alim-cena', label: 'Cena' },
    { value: 'alim-refaccion', label: 'Refacción / Snack' },
  ]},
  { label: 'Mantenimiento y Equipo', options: [
    { value: 'mant-vehiculos', label: 'Mantenimiento Vehículos' },
    { value: 'mant-equipo-frio', label: 'Mantenimiento Equipo Frío' },
    { value: 'mant-bodega', label: 'Mantenimiento Bodega' },
    { value: 'mant-herramientas', label: 'Herramientas y Utensilios' },
    { value: 'mant-reparaciones', label: 'Reparaciones Varias' },
  ]},
  { label: 'Gastos Administrativos', options: [
    { value: 'adm-papeleria', label: 'Papelería / Útiles' },
    { value: 'adm-comunicaciones', label: 'Comunicaciones (teléfono, internet)' },
    { value: 'adm-contabilidad', label: 'Contabilidad / Legal' },
    { value: 'adm-seguros', label: 'Seguros' },
    { value: 'adm-otro', label: 'Otro Administrativo' },
  ]},
  { label: 'Servicios e Instalaciones', options: [
    { value: 'srv-agua', label: 'Agua' },
    { value: 'srv-luz', label: 'Electricidad / Luz' },
    { value: 'srv-renta', label: 'Renta Bodega / Local' },
    { value: 'srv-seguridad', label: 'Seguridad / Vigilancia' },
  ]},
  { label: 'Gastos Financieros y Bancarios', options: [
    { value: 'fin-comision', label: 'Comisión Bancaria' },
    { value: 'fin-intereses', label: 'Intereses' },
    { value: 'fin-cambio', label: 'Diferencial Cambiario' },
  ]},
  { label: 'Gastos Comerciales', options: [
    { value: 'com-comisiones', label: 'Comisiones de Ventas' },
    { value: 'com-publicidad', label: 'Publicidad / Marketing' },
    { value: 'com-muestras', label: 'Muestras / Degustaciones' },
    { value: 'com-certificaciones', label: 'Certificaciones' },
  ]},
  { label: 'Impuestos', options: [
    { value: 'imp-isr', label: 'ISR' },
    { value: 'imp-iva', label: 'IVA' },
    { value: 'imp-ret', label: 'Retenciones' },
    { value: 'imp-otro', label: 'Otro Impuesto' },
  ]},
  { label: 'Importación', options: [
    { value: 'imp-agente', label: 'Agente Aduanal' },
    { value: 'imp-descarga', label: 'Descargadores' },
    { value: 'imp-ministe', label: 'Ministerio / Sanidad' },
    { value: 'imp-aranceles', label: 'Aranceles / DAI' },
    { value: 'imp-flete-int', label: 'Flete Internacional' },
    { value: 'imp-fumig-imp', label: 'Fumigación Importación' },
    { value: 'imp-otros', label: 'Otros Gastos Importación' },
    { value: 'imp-anticipo', label: 'Anticipo a Proveedor MX' },
  ]},
  { label: 'Personal y Nómina', options: [
    { value: 'per-salario', label: 'Salario / Jornal' },
    { value: 'per-anticipo', label: 'Anticipo' },
    { value: 'per-bonif', label: 'Bonificación' },
    { value: 'per-prestamo', label: 'Préstamo a empleado' },
    { value: 'per-otro', label: 'Otro Personal' },
  ]},
];
const ALL_CATS = CATS_GROUPS.flatMap(g => g.options);

// ─── Auto-categorization for BAC Excel import ──────────────────────────────────
const autoCat = (desc) => {
  const d = (desc || '').toLowerCase();
  if (d.includes('combustible') || d.includes('gasoil') || d.includes('gasolinera') || d.includes('puma') || d.includes('texaco')) return 'comb-camiones';
  if (d.includes('salario') || d.includes('planilla') || d.includes('jornal')) return 'per-salario';
  if (d.includes('igss')) return 'imp-ret';
  if (d.includes('walmart') || d.includes('super')) return 'flete-local';
  if (d.includes('transferencia') && (d.includes('mex') || d.includes('mexico') || d.includes('méx'))) return 'imp-anticipo';
  if (d.includes('telefon') || d.includes('claro') || d.includes('tigo') || d.includes('internet')) return 'adm-comunicaciones';
  if (d.includes('luz') || d.includes('energia') || d.includes('eegsa') || d.includes('energía')) return 'srv-luz';
  if (d.includes('agua')) return 'srv-agua';
  if (d.includes('comision') || d.includes('comisión') || d.includes('mantenimiento banco')) return 'fin-comision';
  if (d.includes('seguro')) return 'adm-seguros';
  if (d.includes('renta') || d.includes('alquiler') || d.includes('arrendamiento')) return 'srv-renta';
  if (d.includes('aduanal') || d.includes('arancel') || d.includes('dai') || d.includes('aduana')) return 'imp-aranceles';
  if (d.includes('fumig')) return 'limp-fumig';
  return 'adm-otro';
};

// ─── Parse BAC Excel rows ───────────────────────────────────────────────────────
const parseBacDate = (raw) => {
  if (!raw) return '';
  const s = String(raw).trim();
  // DD/MM/YYYY
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
  // YYYY-MM-DD passthrough
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return s;
  // Excel serial date
  if (!isNaN(Number(s))) {
    const d = new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  return s;
};

// ─── Inline Edit Row Component ──────────────────────────────────────────────────
function EditRow({ r, i, empleados, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    fecha:      r.fecha      || '',
    monto:      r.monto      || '',
    descripcion:r.descripcion|| '',
    categoria:  r.categoria  || '',
    metodoPago: r.metodoPago || 'Efectivo',
    pagadoPor:  r.pagadoPor  || '',
    recibo:     r.recibo     || '',
    obs:        r.obs        || '',
  });
  const fe = (field, val) => setForm(p => ({ ...p, [field]: val }));
  const alt = i % 2 === 1;
  const bg  = alt ? '#F0F8F0' : '#E8F5E9';
  const inp = { ...IS, padding: '5px 8px', fontSize: '.78rem', marginTop: 0 };

  return (
    <tr style={{ background: bg }}>
      <td style={{ ...TD_S(alt), background: bg }}>
        <input type="date" value={form.fecha} onChange={e => fe('fecha', e.target.value)} style={{ ...inp, width: 130 }} />
      </td>
      <td style={{ ...TD_S(alt), background: bg }}>
        <select value={form.categoria} onChange={e => fe('categoria', e.target.value)} style={{ ...inp, width: 180 }}>
          <option value="">— Categoría —</option>
          {CATS_GROUPS.map(g => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
          ))}
        </select>
      </td>
      <td style={{ ...TD_S(alt), background: bg }}>
        <input value={form.descripcion} onChange={e => fe('descripcion', e.target.value)} style={{ ...inp, width: 200 }} />
      </td>
      <td style={{ ...TD_S(alt), background: bg }}>
        <input value={form.recibo} onChange={e => fe('recibo', e.target.value)} style={{ ...inp, width: 90 }} />
      </td>
      <td style={{ ...TD_S(alt), background: bg }}>
        <select value={form.metodoPago} onChange={e => fe('metodoPago', e.target.value)} style={{ ...inp, width: 110 }}>
          {['Efectivo','Cheque','Transferencia','Tarjeta','Banco BAC'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </td>
      <td style={{ ...TD_S(alt), background: bg }}>
        <select value={form.pagadoPor} onChange={e => fe('pagadoPor', e.target.value)} style={{ ...inp, width: 130 }}>
          <option value="">— Empleado —</option>
          {empleados.map(e => <option key={e.id || e.nombre} value={e.nombre}>{e.nombre}</option>)}
        </select>
      </td>
      <td style={{ ...TD_S(alt), background: bg }}>
        <input type="number" min="0" step="0.01" value={form.monto} onChange={e => fe('monto', e.target.value)} style={{ ...inp, width: 90 }} />
      </td>
      <td style={{ ...TD_S(alt), background: bg, whiteSpace: 'nowrap' }}>
        <button
          onClick={() => onSave(r.id, { ...form, monto: parseFloat(form.monto) || 0 })}
          disabled={saving}
          style={{ padding: '4px 10px', background: T.primary, color: T.white, border: 'none', borderRadius: 4, fontWeight: 700, fontSize: '.72rem', cursor: 'pointer', marginRight: 4 }}
        >
          {saving ? '...' : 'Guardar'}
        </button>
        <button
          onClick={onCancel}
          style={{ padding: '4px 10px', background: 'none', border: `1px solid ${T.border}`, color: T.textMid, borderRadius: 4, fontSize: '.72rem', cursor: 'pointer' }}
        >
          Cancelar
        </button>
      </td>
    </tr>
  );
}

// ─── BAC Import Modal ───────────────────────────────────────────────────────────
function BacImportModal({ onClose, onImport }) {
  const [rows, setRows]       = useState(null); // parsed preview rows
  const [cats, setCats]       = useState([]);   // per-row category override
  const [importing, setImporting] = useState(false);
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data     = new Uint8Array(ev.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Find rows with a date + a numeric amount
        const parsed = [];
        for (const row of rawRows) {
          if (!Array.isArray(row)) continue;
          let dateVal = '', amtVal = null, descVal = '';

          for (let ci = 0; ci < row.length; ci++) {
            const cell = row[ci];
            // Try date detection
            if (!dateVal && cell) {
              const s = String(cell).trim();
              if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s)) {
                dateVal = parseBacDate(s);
              } else if (!isNaN(Number(s)) && Number(s) > 40000 && Number(s) < 60000) {
                // Excel serial date range (2009–2064)
                dateVal = parseBacDate(s);
              }
            }
            // Numeric amount — we want debits (negative amounts = expenses)
            if (typeof cell === 'number' && cell < 0) {
              amtVal = Math.abs(cell);
            } else if (typeof cell === 'string' && /^-[\d,]+(\.\d+)?$/.test(cell.trim())) {
              amtVal = Math.abs(parseFloat(cell.replace(/,/g, '')));
            }
            // Description: longest string in row that isn't a date
            if (typeof cell === 'string' && cell.trim().length > descVal.length && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cell.trim())) {
              descVal = cell.trim();
            }
          }

          if (dateVal && amtVal !== null && amtVal > 0) {
            parsed.push({ fecha: dateVal, monto: amtVal, descBanco: descVal, categoria: autoCat(descVal) });
          }
        }

        setRows(parsed);
        setCats(parsed.map(p => p.categoria));
      } catch (err) {
        alert('Error al leer el archivo Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!rows || rows.length === 0) return;
    setImporting(true);
    const records = rows.map((r, i) => ({
      fecha:       r.fecha,
      monto:       r.monto,
      descripcion: r.descBanco,
      categoria:   cats[i] || r.categoria,
      metodoPago:  'Banco BAC',
      fuente:      'excel_bac',
      recibo:      '',
      pagadoPor:   '',
      obs:         '',
      fotoUrl:     '',
      creadoEn:    new Date().toISOString(),
    }));
    await onImport(records);
    setImporting(false);
    onClose();
  };

  const getCatLabel = val => ALL_CATS.find(c => c.value === val)?.label || val || '—';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: T.white, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.22)', width: '100%', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Modal header */}
        <div style={{ padding: '18px 24px', borderBottom: `2px solid ${T.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: T.primary }}>Importar Excel BAC</div>
            <div style={{ fontSize: '.75rem', color: T.textMid, marginTop: 2 }}>Selecciona el archivo .xlsx descargado de Banca en Línea BAC</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: T.textMid }}>×</button>
        </div>

        {/* Modal body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* File picker */}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: T.primary, color: T.white, borderRadius: 6, fontWeight: 700, fontSize: '.83rem', cursor: 'pointer', marginBottom: 20 }}>
            Seleccionar archivo Excel (.xlsx / .xls)
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
          </label>

          {/* Preview table */}
          {rows === null && (
            <div style={{ color: T.textMid, fontSize: '.85rem', marginTop: 8 }}>
              Ningún archivo seleccionado. El sistema detectará automáticamente fechas, montos negativos (débitos) y descripciones.
            </div>
          )}
          {rows !== null && rows.length === 0 && (
            <div style={{ color: T.danger, fontWeight: 700, fontSize: '.85rem' }}>
              No se encontraron filas con fecha + monto negativo en el archivo. Verifica que sea el estado de cuenta BAC.
            </div>
          )}
          {rows && rows.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: '.85rem', color: T.primary, marginBottom: 10 }}>
                Vista previa — {rows.length} transacciones encontradas
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                  <thead>
                    <tr>
                      {['Fecha', 'Descripción banco', 'Monto Q', 'Categoría'].map(h => (
                        <th key={h} style={{ ...TH_S, fontSize: '.7rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ ...TD_S(i % 2 === 1), whiteSpace: 'nowrap', fontWeight: 600 }}>{r.fecha}</td>
                        <td style={{ ...TD_S(i % 2 === 1), maxWidth: 300 }}>{r.descBanco || '—'}</td>
                        <td style={{ ...TD_S(i % 2 === 1), fontWeight: 700, color: T.danger, whiteSpace: 'nowrap' }}>{fmtQ(r.monto)}</td>
                        <td style={TD_S(i % 2 === 1)}>
                          <select
                            value={cats[i] || ''}
                            onChange={e => { const c = [...cats]; c[i] = e.target.value; setCats(c); }}
                            style={{ ...IS, padding: '4px 8px', fontSize: '.74rem', marginTop: 0, width: 200 }}
                          >
                            <option value="">— Categoría —</option>
                            {CATS_GROUPS.map(g => (
                              <optgroup key={g.label} label={g.label}>
                                {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Modal footer */}
        {rows && rows.length > 0 && (
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={handleImport}
              disabled={importing}
              style={{ padding: '10px 22px', background: importing ? T.textMid : T.primary, color: T.white, border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.85rem', cursor: importing ? 'not-allowed' : 'pointer' }}
            >
              {importing ? 'Importando...' : `Importar ${rows.length} registros`}
            </button>
            <button onClick={onClose} style={{ padding: '10px 18px', background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: '.83rem', color: T.textMid, cursor: 'pointer' }}>
              Cancelar
            </button>
            <div style={{ marginLeft: 'auto', fontSize: '.78rem', color: T.textMid }}>
              Total: {fmtQ(rows.reduce((s, r) => s + r.monto, 0))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function Gastos() {
  const toast = useToast();
  const { data, loading }   = useCollection('gastosDiarios', { orderField: 'fecha', orderDir: 'desc', limit: 400 });
  const { empleados }       = useEmpleados();
  const { add, update, saving } = useWrite('gastosDiarios');

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Form state
  const [form, setForm]           = useState({ ...BLANK });
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoFile, setFotoFile]   = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  // Filters
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [filtroCat, setFiltroCat]     = useState('');

  // Inline edit
  const [editingId, setEditingId] = useState(null);

  // BAC modal
  const [showBac, setShowBac] = useState(false);

  const f = (field, val) => setForm(p => ({ ...p, [field]: val }));

  // ── Photo handling (Feature 3) ──────────────────────────────────────────────
  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setFotoPreview(ev.target.result); // local preview
    reader.readAsDataURL(file);
    setFotoFile(file); // store file for upload
  };

  const clearFoto = () => {
    setFotoPreview(null);
    setFotoFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Save form (with Storage upload) ────────────────────────────────────────
  const handleSave = async () => {
    if (!form.fecha || !form.monto || !form.descripcion) {
      toast('Fecha, descripción y monto son requeridos', 'error'); return;
    }
    const monto = parseFloat(form.monto);
    if (isNaN(monto) || monto <= 0) { toast('Monto inválido', 'error'); return; }

    let fotoUrl = '';
    if (fotoFile && fotoPreview) {
      try {
        setUploading(true);
        fotoUrl = await uploadBase64(fotoPreview, `gastos/${Date.now()}_${fotoFile.name}`);
      } catch (err) {
        toast('Error subiendo foto: ' + err.message, 'error');
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    await add({ ...form, monto, fotoUrl, creadoEn: new Date().toISOString() });
    toast('Gasto registrado correctamente');
    setForm({ ...BLANK, fecha: form.fecha });
    clearFoto();
  };

  // ── Inline edit save ────────────────────────────────────────────────────────
  const handleEditSave = async (id, changes) => {
    if (!changes.fecha || !changes.descripcion) {
      toast('Fecha y descripción requeridos', 'error'); return;
    }
    const monto = parseFloat(changes.monto);
    if (isNaN(monto) || monto <= 0) { toast('Monto inválido', 'error'); return; }
    await update(id, { ...changes, monto, _editadoEn: new Date().toISOString() });
    toast('Gasto actualizado');
    setEditingId(null);
  };

  // ── BAC batch import ────────────────────────────────────────────────────────
  const handleBacImport = async (records) => {
    let count = 0;
    for (const rec of records) {
      await add(rec);
      count++;
    }
    toast(`${count} gastos importados desde Excel BAC`);
  };

  // ── KPI calculations ────────────────────────────────────────────────────────
  const todayStr  = today();
  const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
  const mesStr    = todayStr.slice(0, 7);
  const totalHoy  = data.filter(r => r.fecha === todayStr).reduce((s, r) => s + (r.monto || 0), 0);
  const totalSem  = data.filter(r => r.fecha >= weekStart).reduce((s, r) => s + (r.monto || 0), 0);
  const totalMes  = data.filter(r => (r.fecha || '').startsWith(mesStr)).reduce((s, r) => s + (r.monto || 0), 0);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = data.filter(r => {
    if (filtroCat && r.categoria !== filtroCat) return false;
    if (filtroDesde && r.fecha < filtroDesde) return false;
    if (filtroHasta && r.fecha > filtroHasta) return false;
    return true;
  });

  const getCatLabel = val => ALL_CATS.find(c => c.value === val)?.label || val || '—';

  const isBusy = saving || uploading;

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1100 }}>
      {/* BAC Modal */}
      {showBac && <BacImportModal onClose={() => setShowBac(false)} onImport={handleBacImport} />}

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: T.primary, margin: 0 }}>Gastos Diarios</h1>
          <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>Registro de gastos operativos — combustible, mantenimiento, servicios, importación</p>
        </div>
        <button
          onClick={() => setShowBac(true)}
          style={{ padding: '10px 18px', background: '#1565C0', color: T.white, border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.83rem', cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.18)' }}
        >
          Importar Excel BAC
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Gastos hoy',        val: fmtQ(totalHoy), color: T.danger  },
          { label: 'Gastos esta semana', val: fmtQ(totalSem), color: T.warn   },
          { label: 'Gastos este mes',    val: fmtQ(totalMes), color: T.primary },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...card, marginBottom: 0, padding: '16px 20px', borderLeft: `4px solid ${color}` }}>
            <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textMid, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.primary, marginBottom: 18, borderBottom: `2px solid ${T.primary}`, paddingBottom: 8 }}>
          Registrar Gasto
        </div>

        {/* Row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 14 }}>
          <label style={LS}>
            Fecha *
            <input type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)} style={IS} />
          </label>
          <label style={LS}>
            Monto (Q) *
            <input type="number" min="0" step="0.01" value={form.monto} onChange={e => f('monto', e.target.value)} placeholder="0.00" style={IS} />
          </label>
          <label style={LS}>
            Método de pago
            <select value={form.metodoPago} onChange={e => f('metodoPago', e.target.value)} style={IS}>
              {['Efectivo', 'Cheque', 'Transferencia', 'Tarjeta'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label style={LS}>
            No. Recibo / Factura
            <input value={form.recibo} onChange={e => f('recibo', e.target.value)} placeholder="FAC-0001" style={IS} />
          </label>
        </div>

        {/* Row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 14 }}>
          <label style={{ ...LS, gridColumn: 'span 2' }}>
            Descripción / Proveedor *
            <input value={form.descripcion} onChange={e => f('descripcion', e.target.value)} placeholder="Ej. Gasolinera Puma, reparación camión..." style={IS} />
          </label>
          <label style={LS}>
            Categoría
            <select value={form.categoria} onChange={e => f('categoria', e.target.value)} style={IS}>
              <option value="">— Seleccionar categoría —</option>
              {CATS_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label style={LS}>
            Pagado por
            <select value={form.pagadoPor} onChange={e => f('pagadoPor', e.target.value)} style={IS}>
              <option value="">— Seleccionar empleado —</option>
              {empleados.map(e => <option key={e.id || e.nombre} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </label>
        </div>

        {/* Photo (Feature 3) */}
        <div style={{ background: T.bgGreen, border: `1px solid ${T.border}`, borderRadius: 6, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: '.72rem', color: T.textMid, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Foto de Boleta / Comprobante (opcional)
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {fotoPreview ? (
              <img src={fotoPreview} alt="preview" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 6, border: `2px solid ${T.secondary}`, flexShrink: 0 }} />
            ) : (
              <div onClick={() => fileRef.current?.click()} style={{ width: 90, height: 90, background: '#F5F5F5', border: `2px dashed ${T.border}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', cursor: 'pointer', flexShrink: 0 }}>
                🧾
              </div>
            )}
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: T.primary, color: T.white, borderRadius: 5, fontWeight: 700, fontSize: '.78rem', cursor: 'pointer' }}>
                Tomar / Cargar foto
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFoto} />
              </label>
              {fotoPreview && (
                <button onClick={clearFoto} style={{ marginLeft: 8, padding: '7px 12px', background: 'none', border: `1px solid ${T.danger}`, color: T.danger, borderRadius: 5, fontSize: '.74rem', fontWeight: 700, cursor: 'pointer' }}>
                  Quitar foto
                </button>
              )}
              <div style={{ fontSize: '.68rem', color: T.textMid, marginTop: 6 }}>
                {fotoFile ? `Listo para subir: ${fotoFile.name}` : 'Toma foto de la boleta o comprobante para auditoría. Se sube a Firebase Storage.'}
              </div>
            </div>
          </div>
        </div>

        {/* Observations */}
        <label style={{ ...LS, marginBottom: 16 }}>
          Observaciones
          <textarea value={form.obs} onChange={e => f('obs', e.target.value)} rows={2} style={{ ...IS, resize: 'vertical' }} placeholder="Notas adicionales..." />
        </label>

        <button onClick={handleSave} disabled={isBusy} style={{
          padding: '11px 28px', background: isBusy ? '#6B6B60' : T.primary, color: T.white,
          border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem',
          cursor: isBusy ? 'not-allowed' : 'pointer', width: isMobile ? '100%' : 'auto', minHeight: 44,
        }}>
          {uploading ? 'Subiendo foto...' : saving ? 'Guardando...' : 'Registrar Gasto'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={LS}>
            Desde
            <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} style={{ ...IS, width: 155 }} />
          </label>
          <label style={LS}>
            Hasta
            <input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} style={{ ...IS, width: 155 }} />
          </label>
          <label style={LS}>
            Categoría
            <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={{ ...IS, width: 220 }}>
              <option value="">Todas las categorías</option>
              {CATS_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          {(filtroDesde || filtroHasta || filtroCat) && (
            <button onClick={() => { setFiltroDesde(''); setFiltroHasta(''); setFiltroCat(''); }}
              style={{ padding: '9px 16px', background: T.bgLight, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: '.8rem', color: T.textMid, cursor: 'pointer', fontWeight: 600, alignSelf: 'flex-end' }}>
              Limpiar filtros
            </button>
          )}
          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', fontWeight: 700, fontSize: '1rem', color: T.primary }}>
            Total filtrado: {fmtQ(filtered.reduce((s, r) => s + (r.monto || 0), 0))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary, marginBottom: 16 }}>
          Detalle de Gastos ({filtered.length} registros)
        </div>
        {loading ? <Skeleton rows={8} /> : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.textMid, fontSize: '.9rem' }}>
            Sin gastos para los filtros seleccionados
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.slice(0, 150).map(r => (
              <div key={r.id} style={{ background: T.white, borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.12)', borderLeft: `4px solid ${T.danger}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>📅 {r.fecha || '—'}</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: T.danger }}>{fmtQ(r.monto)}</span>
                </div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: `${T.secondary}18`, color: T.secondary }}>
                    {getCatLabel(r.categoria)}
                  </span>
                  {r.fuente === 'excel_bac' && (
                    <span style={{ marginLeft: 4, fontSize: 11, background: '#1565C020', color: '#1565C0', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>BAC</span>
                  )}
                </div>
                <div style={{ fontSize: 14, color: T.textDark, marginBottom: 4 }}>{r.descripcion || '—'}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: T.textMid, flexWrap: 'wrap', marginBottom: 6 }}>
                  {r.recibo && <span><b>Recibo:</b> {r.recibo}</span>}
                  {r.metodoPago && <span><b>Método:</b> {r.metodoPago}</span>}
                  {r.pagadoPor && <span><b>Pagado por:</b> {r.pagadoPor}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {r.fotoUrl && (
                    <a href={r.fotoUrl} target="_blank" rel="noreferrer" style={{ minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: 8, background: '#F5F5F5', border: `1px solid ${T.border}`, fontSize: 13, color: T.secondary, fontWeight: 600, textDecoration: 'none' }}>
                      🧾 Ver foto
                    </a>
                  )}
                  <button onClick={() => setEditingId(r.id)} style={{ minHeight: 44, padding: '0 14px', borderRadius: 8, border: `1px solid ${T.secondary}`, background: T.bgGreen, color: T.secondary, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    ✏️ Editar
                  </button>
                </div>
                {editingId === r.id && (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                    <EditRow r={r} i={0} empleados={empleados} onSave={handleEditSave} onCancel={() => setEditingId(null)} saving={saving} />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Fecha', 'Categoría', 'Descripción', 'Recibo', 'Método', 'Pagado por', 'Monto Q', 'Foto/Acción'].map(h => (
                    <th key={h} style={TH_S}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 150).map((r, i) =>
                  editingId === r.id ? (
                    <EditRow
                      key={r.id}
                      r={r}
                      i={i}
                      empleados={empleados}
                      onSave={handleEditSave}
                      onCancel={() => setEditingId(null)}
                      saving={saving}
                    />
                  ) : (
                    <tr key={r.id}>
                      <td style={{ ...TD_S(i % 2 === 1), fontWeight: 600, whiteSpace: 'nowrap' }}>{r.fecha || '—'}</td>
                      <td style={TD_S(i % 2 === 1)}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 100, fontSize: '.7rem', fontWeight: 700, background: `${T.secondary}18`, color: T.secondary, whiteSpace: 'nowrap' }}>
                          {getCatLabel(r.categoria)}
                        </span>
                        {r.fuente === 'excel_bac' && (
                          <span style={{ marginLeft: 4, fontSize: '.62rem', background: '#1565C020', color: '#1565C0', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>BAC</span>
                        )}
                      </td>
                      <td style={{ ...TD_S(i % 2 === 1), maxWidth: 240 }}>{r.descripcion || '—'}</td>
                      <td style={{ ...TD_S(i % 2 === 1), color: T.textMid }}>{r.recibo || '—'}</td>
                      <td style={{ ...TD_S(i % 2 === 1), color: T.textMid }}>{r.metodoPago || '—'}</td>
                      <td style={{ ...TD_S(i % 2 === 1), color: T.textMid }}>{r.pagadoPor || '—'}</td>
                      <td style={{ ...TD_S(i % 2 === 1), fontWeight: 700, color: T.danger, whiteSpace: 'nowrap' }}>{fmtQ(r.monto)}</td>
                      <td style={{ ...TD_S(i % 2 === 1), whiteSpace: 'nowrap' }}>
                        {r.fotoUrl && (
                          <a href={r.fotoUrl} target="_blank" rel="noreferrer" title="Ver foto" style={{ marginRight: 6 }}>
                            <span style={{ fontSize: '1.1rem' }}>🧾</span>
                          </a>
                        )}
                        <button
                          onClick={() => setEditingId(r.id)}
                          title="Editar registro"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.95rem', padding: '2px 4px', color: T.secondary, lineHeight: 1 }}
                        >
                          ✏️
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
