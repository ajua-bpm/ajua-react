import { useState, useRef } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
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

export default function Gastos() {
  const toast = useToast();
  const { data, loading } = useCollection('gastosDiarios', { orderField: 'fecha', orderDir: 'desc', limit: 400 });
  const { empleados } = useEmpleados();
  const { add, saving } = useWrite('gastosDiarios');

  const [form, setForm]       = useState({ ...BLANK });
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoB64, setFotoB64] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [filtroCat, setFiltroCat]     = useState('');
  const fileRef = useRef();

  const f = (field, val) => setForm(p => ({ ...p, [field]: val }));

  // Photo handling
  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setFotoPreview(ev.target.result);
      setFotoB64(ev.target.result);
    };
    reader.readAsDataURL(file);
  };
  const clearFoto = () => { setFotoPreview(null); setFotoB64(''); if (fileRef.current) fileRef.current.value = ''; };

  const handleSave = async () => {
    if (!form.fecha || !form.monto || !form.descripcion) {
      toast('Fecha, descripción y monto son requeridos', 'error'); return;
    }
    const monto = parseFloat(form.monto);
    if (isNaN(monto) || monto <= 0) { toast('Monto inválido', 'error'); return; }
    await add({ ...form, monto, fotoUrl: fotoB64, creadoEn: new Date().toISOString() });
    toast('Gasto registrado correctamente');
    setForm({ ...BLANK, fecha: form.fecha });
    clearFoto();
  };

  // KPI calculations
  const todayStr = today();
  const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
  const mesStr    = todayStr.slice(0, 7);
  const totalHoy  = data.filter(r => r.fecha === todayStr).reduce((s, r) => s + (r.monto || 0), 0);
  const totalSem  = data.filter(r => r.fecha >= weekStart).reduce((s, r) => s + (r.monto || 0), 0);
  const totalMes  = data.filter(r => (r.fecha || '').startsWith(mesStr)).reduce((s, r) => s + (r.monto || 0), 0);

  // Filtered list
  const filtered = data.filter(r => {
    if (filtroCat && r.categoria !== filtroCat) return false;
    if (filtroDesde && r.fecha < filtroDesde) return false;
    if (filtroHasta && r.fecha > filtroHasta) return false;
    return true;
  });

  const getCatLabel = val => ALL_CATS.find(c => c.value === val)?.label || val || '—';

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: T.primary, margin: 0 }}>Gastos Diarios</h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>Registro de gastos operativos — combustible, mantenimiento, servicios, importación</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Gastos hoy',       val: fmtQ(totalHoy), color: T.danger   },
          { label: 'Gastos esta semana', val: fmtQ(totalSem), color: T.warn    },
          { label: 'Gastos este mes',   val: fmtQ(totalMes), color: T.primary  },
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

        {/* Photo */}
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
                📷 Tomar / Cargar foto
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFoto} />
              </label>
              {fotoPreview && (
                <button onClick={clearFoto} style={{ marginLeft: 8, padding: '7px 12px', background: 'none', border: `1px solid ${T.danger}`, color: T.danger, borderRadius: 5, fontSize: '.74rem', fontWeight: 700, cursor: 'pointer' }}>
                  Quitar foto
                </button>
              )}
              <div style={{ fontSize: '.68rem', color: T.textMid, marginTop: 6 }}>Toma foto de la boleta o comprobante para auditoría.</div>
            </div>
          </div>
        </div>

        {/* Observations */}
        <label style={{ ...LS, marginBottom: 16 }}>
          Observaciones
          <textarea value={form.obs} onChange={e => f('obs', e.target.value)} rows={2} style={{ ...IS, resize: 'vertical' }} placeholder="Notas adicionales..." />
        </label>

        <button onClick={handleSave} disabled={saving} style={{
          padding: '11px 28px', background: saving ? '#6B6B60' : T.primary, color: T.white,
          border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem',
          cursor: saving ? 'not-allowed' : 'pointer',
        }}>
          {saving ? 'Guardando...' : 'Registrar Gasto'}
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
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Fecha', 'Categoría', 'Descripción', 'Recibo', 'Método', 'Pagado por', 'Monto Q', 'Foto'].map(h => (
                    <th key={h} style={TH_S}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 150).map((r, i) => (
                  <tr key={r.id}>
                    <td style={{ ...TD_S(i % 2 === 1), fontWeight: 600, whiteSpace: 'nowrap' }}>{r.fecha || '—'}</td>
                    <td style={TD_S(i % 2 === 1)}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 100, fontSize: '.7rem', fontWeight: 700, background: `${T.secondary}18`, color: T.secondary, whiteSpace: 'nowrap' }}>
                        {getCatLabel(r.categoria)}
                      </span>
                    </td>
                    <td style={{ ...TD_S(i % 2 === 1), maxWidth: 240 }}>{r.descripcion || '—'}</td>
                    <td style={{ ...TD_S(i % 2 === 1), color: T.textMid }}>{r.recibo || '—'}</td>
                    <td style={{ ...TD_S(i % 2 === 1), color: T.textMid }}>{r.metodoPago || '—'}</td>
                    <td style={{ ...TD_S(i % 2 === 1), color: T.textMid }}>{r.pagadoPor || '—'}</td>
                    <td style={{ ...TD_S(i % 2 === 1), fontWeight: 700, color: T.danger, whiteSpace: 'nowrap' }}>{fmtQ(r.monto)}</td>
                    <td style={TD_S(i % 2 === 1)}>
                      {r.fotoUrl ? (
                        <a href={r.fotoUrl} target="_blank" rel="noreferrer" title="Ver foto">
                          <span style={{ fontSize: '1.1rem' }}>🧾</span>
                        </a>
                      ) : <span style={{ color: T.border }}>—</span>}
                    </td>
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
