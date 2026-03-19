import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useProductosCatalogo } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ── Design tokens ─────────────────────────────────────────────────
const T = {
  primary:  '#1B5E20',
  secondary:'#2E7D32',
  danger:   '#C62828',
  warn:     '#E65100',
  info:     '#1565C0',
  textDark: '#1A1A18',
  textMid:  '#6B6B60',
  border:   '#E0E0E0',
  white:    '#FFFFFF',
  bgGreen:  '#E8F5E9',
};

// ── Shared style objects ──────────────────────────────────────────
const card = {
  background: '#fff',
  borderRadius: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,.10)',
  padding: 20,
  marginBottom: 20,
};

const LS = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: '.72rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  color: T.textMid,
  letterSpacing: '.06em',
};

const IS = {
  padding: '9px 12px',
  border: `1.5px solid ${T.border}`,
  borderRadius: 6,
  fontSize: '.85rem',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  marginTop: 2,
  color: T.textDark,
  background: T.white,
  boxSizing: 'border-box',
};

const IS_RO = {
  ...IS,
  background: '#F5F5F5',
  color: T.textMid,
  cursor: 'default',
};

const thSt = {
  padding: '9px 12px',
  fontSize: '.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: T.white,
  background: T.primary,
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const tdSt = {
  padding: '8px 12px',
  fontSize: '.82rem',
  borderBottom: `1px solid ${T.border}`,
  color: T.textDark,
};

// ── Helpers ───────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const fmtQ  = (n) => 'Q ' + (parseFloat(n) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const newKey = () => Math.random().toString(36).slice(2);

// ── Blank product line ────────────────────────────────────────────
const BLANK_LINEA = () => ({
  _key:         newKey(),
  producto:     '',
  descripcion:  '',
  cajas:        '',
  lbsCaja:      '',
  totalLbs:     0,
  precioConIva: '',
  totalConIva:  0,
});

// ── Blank form ────────────────────────────────────────────────────
const BLANK_FORM = () => ({
  fecha:      today(),
  numOC:      '',
  numEntrega: '',
  authSAT:    '',
  serieFel:   '',
  numeroDTE:  '',
  almacen:    '',
  obs:        '',
});

// ── Document tab types ────────────────────────────────────────────
const DOC_TABS = [
  { key: 'ediwin',  label: 'PDF Ediwin'    },
  { key: 'albaran', label: 'Albarán físico' },
  { key: 'xml',     label: 'XML FEL'        },
];

// ── XML FEL parser — Guatemala SAT DTE ────────────────────────────
// Real DTE structure:
//   <dte:NumeroAutorizacion Numero="1703823744" Serie="5835D9BC">UUID</dte:NumeroAutorizacion>
//   <dte:DatosGenerales FechaHoraEmision="2026-03-19T07:44:44-06:00" .../>
//   <dte:Emisor NITEmisor="119397315" ...>
//   <dte:Receptor IDReceptor="31244017" NombreReceptor="..."/>
//   <dte:Item><dte:Cantidad>143</dte:Cantidad><dte:Descripcion>...</dte:Descripcion>...
function parseXML(text) {
  // Text content of a tag (with optional namespace prefix)
  const tagText = (...names) => {
    for (const n of names) {
      const m = text.match(new RegExp(`<(?:[^:>\\s]+:)?${n}(?:\\s[^>]*)?>([^<]+)<\\/`, 'i'));
      if (m) return m[1].trim();
    }
    return '';
  };
  // Attribute value from a specific tag
  const tagAttr = (tagName, attrName) => {
    const m = text.match(new RegExp(`<(?:[^:>\\s]+:)?${tagName}[^>]*\\s${attrName}=["']([^"']+)["']`, 'i'));
    return m ? m[1].trim() : '';
  };

  const authSAT   = tagText('NumeroAutorizacion', 'NúmeroAutorizacion');
  const serieFel  = tagAttr('NumeroAutorizacion', 'Serie');
  const numeroDTE = tagAttr('NumeroAutorizacion', 'Numero');
  const nit       = tagAttr('Emisor', 'NITEmisor') || tagAttr('Receptor', 'IDReceptor');
  const receptor  = tagAttr('Receptor', 'NombreReceptor');
  const granTotal = tagText('GranTotal');
  const fechaHora = tagAttr('DatosGenerales', 'FechaHoraEmision');
  const fecha     = fechaHora ? fechaHora.slice(0, 10) : '';

  // Parse each <Item> block into {descripcion, cantidad, precioUnitario, total}
  const items = [];
  const itemRe = /<(?:[^:>\s]+:)?Item[^>]*>([\s\S]*?)<\/(?:[^:>\s]+:)?Item>/gi;
  let m;
  while ((m = itemRe.exec(text)) !== null) {
    const block = m[1];
    const tv = (...ns) => {
      for (const n of ns) {
        const x = block.match(new RegExp(`<(?:[^:>\\s]+:)?${n}[^>]*>([^<]+)<\\/`, 'i'));
        if (x) return x[1].trim();
      }
      return '';
    };
    const desc = tv('Descripcion');
    if (desc) items.push({
      descripcion:   desc,
      cantidad:      tv('Cantidad'),
      precioUnitario: tv('PrecioUnitario'),
      total:         tv('Total'),
    });
  }

  return { authSAT, serieFel, numeroDTE, nit, receptor, granTotal, fecha, items };
}

// ── Main component ────────────────────────────────────────────────
export default function SalidaBodega() {
  const toast                       = useToast();
  const { data: salidas, loading }  = useCollection('isalidas', { orderField: '_ts', orderDir: 'desc', limit: 300 });
  const { productos: catProd }      = useProductosCatalogo();
  const { add, remove, saving }     = useWrite('isalidas');

  // ── Main tabs: Registrar | Historial ──────────────────────────
  const [mainTab, setMainTab]       = useState('registrar');

  // ── Document sub-tabs ─────────────────────────────────────────
  const [docTab, setDocTab]         = useState('ediwin');

  // ── File states ───────────────────────────────────────────────
  const [ediwinFile, setEdiwinFile] = useState(null);
  const [albanFile,  setAlbanFile]  = useState(null);
  const [xmlFile,    setXmlFile]    = useState(null);
  const [xmlParsed,  setXmlParsed]  = useState(null);

  // ── Form & lines ─────────────────────────────────────────────
  const [form,   setForm]   = useState(BLANK_FORM());
  const [lineas, setLineas] = useState([BLANK_LINEA()]);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Line operations ───────────────────────────────────────────
  const addLinea    = () => setLineas(ls => [...ls, BLANK_LINEA()]);
  const removeLinea = (key) => setLineas(ls => ls.filter(l => l._key !== key));

  const setLinea = (key, field, raw) => {
    setLineas(ls => ls.map(l => {
      if (l._key !== key) return l;
      const next = { ...l, [field]: raw };
      const cajas       = parseFloat(next.cajas)        || 0;
      const lbsCaja     = parseFloat(next.lbsCaja)      || 0;
      const precioConIva= parseFloat(next.precioConIva) || 0;
      next.totalLbs     = cajas * lbsCaja;
      next.totalConIva  = cajas * precioConIva;
      return next;
    }));
  };

  // ── Financial summary ─────────────────────────────────────────
  const summary = useMemo(() => {
    const totalCajas = lineas.reduce((s, l) => s + (parseFloat(l.cajas) || 0), 0);
    const totalLbs   = lineas.reduce((s, l) => s + (l.totalLbs || 0), 0);
    const conIva     = lineas.reduce((s, l) => s + (l.totalConIva || 0), 0);
    const neto       = conIva / 1.12;
    const iva        = conIva - neto;
    const retencion  = iva * 0.80;
    const aCobrar    = conIva - retencion;
    return { totalCajas, totalLbs, conIva, neto, iva, retencion, aCobrar };
  }, [lineas]);

  // ── XML file handler ──────────────────────────────────────────
  const handleXmlFile = (file) => {
    if (!file) return;
    setXmlFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = parseXML(text);
      setXmlParsed(parsed);
      // Auto-fill header fields
      if (parsed.authSAT)   sf('authSAT',   parsed.authSAT);
      if (parsed.serieFel)  sf('serieFel',  parsed.serieFel);
      if (parsed.numeroDTE) sf('numeroDTE', parsed.numeroDTE);
      if (parsed.fecha)     sf('fecha',     parsed.fecha);
      // Auto-populate product lines from XML Items
      if (parsed.items && parsed.items.length > 0) {
        setLineas(parsed.items.map(item => {
          const cajas        = parseFloat(item.cantidad)       || 0;
          const precioConIva = parseFloat(item.precioUnitario) || 0;
          const totalConIva  = cajas * precioConIva;
          return {
            _key:         newKey(),
            producto:     '',               // user selects from catalog
            descripcion:  item.descripcion,
            cajas:        item.cantidad,
            lbsCaja:      '',
            totalLbs:     0,
            precioConIva: item.precioUnitario,
            totalConIva,
          };
        }));
      }
    };
    reader.readAsText(file);
  };

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.fecha) {
      toast('La fecha es requerida', 'error'); return;
    }
    const validLines = lineas.filter(l => l.producto && (parseFloat(l.cajas) || 0) > 0);
    if (validLines.length === 0) {
      toast('Agrega al menos una línea con producto y cajas > 0', 'error'); return;
    }

    const lineasClean = validLines.map(({ _key, ...l }) => ({
      producto:     l.producto,
      descripcion:  l.descripcion,
      cajas:        parseFloat(l.cajas)        || 0,
      lbsCaja:      parseFloat(l.lbsCaja)      || 0,
      totalLbs:     l.totalLbs,
      precioConIva: parseFloat(l.precioConIva) || 0,
      totalConIva:  l.totalConIva,
    }));

    try {
      await add({
        fecha:      form.fecha,
        cliente:    'Walmart Guatemala',
        nit:        '1926272',
        numOC:      form.numOC,
        numEntrega: form.numEntrega,
        authSAT:    form.authSAT,
        serieFel:   form.serieFel,
        numeroDTE:  form.numeroDTE,
        almacen:    form.almacen,
        lineas:     lineasClean,
        // productos = same data, field name StockVivo and bpm.html use
        productos:  lineasClean.map(l => ({
          producto:      l.producto || l.descripcion,
          cajasEnviadas: l.cajas,
          lbs:           l.totalLbs,
          precioConIva:  l.precioConIva,
          totalConIva:   l.totalConIva,
        })),
        totalCajas: summary.totalCajas,
        totalLbs:   summary.totalLbs,
        neto:       summary.neto,
        iva:        summary.iva,
        conIva:     summary.conIva,
        retencion:  summary.retencion,
        aCobrar:    summary.aCobrar,
        obs:        form.obs,
      });
      toast('Venta registrada correctamente');
      setForm(BLANK_FORM());
      setLineas([BLANK_LINEA()]);
      setEdiwinFile(null);
      setAlbanFile(null);
      setXmlFile(null);
      setXmlParsed(null);
    } catch (err) {
      toast('Error al guardar: ' + err.message, 'error');
    }
  };

  // ── Tab button styles ─────────────────────────────────────────
  const mainTabBtn = (key) => ({
    padding: '9px 22px',
    fontWeight: 600,
    fontSize: '.83rem',
    cursor: 'pointer',
    border: 'none',
    borderBottom: `3px solid ${mainTab === key ? T.primary : 'transparent'}`,
    background: 'transparent',
    color: mainTab === key ? T.primary : T.textMid,
    transition: 'all .15s',
  });

  const docTabBtn = (key) => ({
    padding: '7px 16px',
    fontWeight: 600,
    fontSize: '.78rem',
    cursor: 'pointer',
    border: `1.5px solid ${docTab === key ? T.info : T.border}`,
    borderRadius: 6,
    background: docTab === key ? '#E3F2FD' : '#F9F9F9',
    color: docTab === key ? T.info : T.textMid,
    transition: 'all .15s',
  });

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1100 }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Ventas Walmart
        </h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4, marginBottom: 0 }}>
          Registro de despachos Walmart — IVA 12% y retención 80% calculados automáticamente.
        </p>
      </div>

      {/* ── Main tabs ──────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: `2px solid ${T.border}`, marginBottom: 20 }}>
        <button style={mainTabBtn('registrar')} onClick={() => setMainTab('registrar')}>
          Registrar Venta
        </button>
        <button style={mainTabBtn('historial')} onClick={() => setMainTab('historial')}>
          Historial ({loading ? '…' : salidas.length})
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB: REGISTRAR
         ══════════════════════════════════════════════════════ */}
      {mainTab === 'registrar' && (
        <>
          {/* ── Section 1: Documento de venta ────────────── */}
          <div style={{ ...card, borderTop: `3px solid ${T.info}` }}>
            <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.info, marginBottom: 4 }}>
              1 — Documento de venta
            </div>
            <p style={{ fontSize: '.76rem', color: T.textMid, marginTop: 0, marginBottom: 14 }}>
              Adjunta el documento de respaldo. El sistema no extrae datos automáticamente — verifica los campos en la sección 2.
            </p>

            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {DOC_TABS.map(t => (
                <button key={t.key} style={docTabBtn(t.key)} onClick={() => setDocTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* PDF Ediwin */}
            {docTab === 'ediwin' && (
              <div>
                <label style={{ ...LS, cursor: 'pointer' }}>
                  Cargar PDF Ediwin
                  <div style={{
                    marginTop: 6,
                    border: `2px dashed ${ediwinFile ? T.info : T.border}`,
                    borderRadius: 8,
                    padding: '18px 14px',
                    textAlign: 'center',
                    background: ediwinFile ? '#E3F2FD' : '#FAFAFA',
                    cursor: 'pointer',
                    transition: 'all .15s',
                  }}>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      style={{ display: 'none' }}
                      id="input-ediwin"
                      onChange={e => setEdiwinFile(e.target.files[0] || null)}
                    />
                    <label htmlFor="input-ediwin" style={{ cursor: 'pointer' }}>
                      {ediwinFile ? (
                        <span style={{ fontSize: '.82rem', color: T.info, fontWeight: 600 }}>
                          {ediwinFile.name}
                        </span>
                      ) : (
                        <span style={{ fontSize: '.82rem', color: T.textMid }}>
                          Haz clic para seleccionar PDF o imagen
                        </span>
                      )}
                    </label>
                  </div>
                </label>
                <div style={{
                  marginTop: 10, padding: '10px 14px',
                  background: '#FFF8E1',
                  border: `1px solid #FFE082`,
                  borderRadius: 6,
                  fontSize: '.76rem',
                  color: '#5D4037',
                  lineHeight: 1.5,
                }}>
                  <strong>Precio con IVA</strong> — ingresa el precio TAL COMO aparece en el Ediwin (ya incluye IVA).
                  El sistema extrae el neto, el IVA y calcula la retención Walmart (80% del IVA).
                  Verifica y completa los datos manualmente en la sección 2.
                </div>
              </div>
            )}

            {/* Albarán físico */}
            {docTab === 'albaran' && (
              <div>
                <label style={{ ...LS, cursor: 'pointer' }}>
                  Foto del albarán físico
                  <div style={{
                    marginTop: 6,
                    border: `2px dashed ${albanFile ? T.secondary : T.border}`,
                    borderRadius: 8,
                    padding: '18px 14px',
                    textAlign: 'center',
                    background: albanFile ? '#E8F5E9' : '#FAFAFA',
                    cursor: 'pointer',
                    transition: 'all .15s',
                  }}>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      id="input-albaran"
                      onChange={e => setAlbanFile(e.target.files[0] || null)}
                    />
                    <label htmlFor="input-albaran" style={{ cursor: 'pointer' }}>
                      {albanFile ? (
                        <span style={{ fontSize: '.82rem', color: T.secondary, fontWeight: 600 }}>
                          {albanFile.name}
                        </span>
                      ) : (
                        <span style={{ fontSize: '.82rem', color: T.textMid }}>
                          Haz clic para tomar foto o seleccionar imagen
                        </span>
                      )}
                    </label>
                  </div>
                </label>
              </div>
            )}

            {/* XML FEL */}
            {docTab === 'xml' && (
              <div>
                <label style={{ ...LS, cursor: 'pointer' }}>
                  Archivo XML FEL
                  <div style={{
                    marginTop: 6,
                    border: `2px dashed ${xmlFile ? T.secondary : T.border}`,
                    borderRadius: 8,
                    padding: '18px 14px',
                    textAlign: 'center',
                    background: xmlFile ? '#E8F5E9' : '#FAFAFA',
                    cursor: 'pointer',
                    transition: 'all .15s',
                  }}>
                    <input
                      type="file"
                      accept=".xml"
                      style={{ display: 'none' }}
                      id="input-xml"
                      onChange={e => {
                        const f = e.target.files[0] || null;
                        handleXmlFile(f);
                      }}
                    />
                    <label htmlFor="input-xml" style={{ cursor: 'pointer' }}>
                      {xmlFile ? (
                        <span style={{ fontSize: '.82rem', color: T.secondary, fontWeight: 600 }}>
                          {xmlFile.name}
                        </span>
                      ) : (
                        <span style={{ fontSize: '.82rem', color: T.textMid }}>
                          Haz clic para seleccionar XML FEL
                        </span>
                      )}
                    </label>
                  </div>
                </label>

                {/* Parsed XML preview */}
                {xmlParsed && (
                  <div style={{
                    marginTop: 12, padding: '12px 14px',
                    background: '#E8F5E9',
                    border: `1px solid #A5D6A7`,
                    borderRadius: 6,
                  }}>
                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: T.primary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      Datos extraídos del XML
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                      {[
                        ['No. Autorización SAT', xmlParsed.authSAT],
                        ['Serie FEL',            xmlParsed.serieFel],
                        ['Número DTE',            xmlParsed.numeroDTE],
                      ].map(([lbl, val]) => val ? (
                        <div key={lbl}>
                          <div style={{ fontSize: '.62rem', color: T.textMid, fontWeight: 600, textTransform: 'uppercase' }}>{lbl}</div>
                          <div style={{ fontSize: '.8rem', fontWeight: 700, color: T.primary }}>{val}</div>
                        </div>
                      ) : null)}
                    </div>
                    <div style={{ fontSize: '.72rem', color: T.textMid, marginTop: 8 }}>
                      Aplicado automáticamente a los campos de la sección 2 — verifica y ajusta si es necesario.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Section 2: Datos de la venta ─────────────── */}
          <div style={{ ...card, borderTop: `3px solid ${T.warn}` }}>
            <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.warn, marginBottom: 14 }}>
              2 — Datos de la venta — verificar
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>

              {/* Cliente — fixed */}
              <label style={LS}>
                Cliente
                <div style={{ ...IS_RO, display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <span style={{
                    background: '#E8F5E9',
                    color: T.secondary,
                    border: `1px solid #A5D6A7`,
                    borderRadius: 100,
                    padding: '2px 10px',
                    fontSize: '.72rem',
                    fontWeight: 700,
                  }}>
                    Walmart Guatemala
                  </span>
                </div>
              </label>

              {/* NIT — readonly */}
              <label style={LS}>
                NIT Walmart
                <input readOnly value="1926272" style={IS_RO} />
              </label>

              {/* Fecha */}
              <label style={LS}>
                Fecha *
                <input
                  type="date"
                  value={form.fecha}
                  onChange={e => sf('fecha', e.target.value)}
                  style={IS}
                />
              </label>

              {/* OC */}
              <label style={LS}>
                Orden de Compra (OC)
                <input
                  value={form.numOC}
                  onChange={e => sf('numOC', e.target.value)}
                  placeholder="Auto desde Ediwin"
                  style={IS}
                />
              </label>

              {/* No. Entrega */}
              <label style={LS}>
                No. Entrega / Albarán
                <input
                  value={form.numEntrega}
                  onChange={e => sf('numEntrega', e.target.value)}
                  placeholder="Auto desde Ediwin"
                  style={IS}
                />
              </label>

              {/* Auth SAT */}
              <label style={LS}>
                No. Autorización SAT
                <input
                  value={form.authSAT}
                  onChange={e => sf('authSAT', e.target.value)}
                  placeholder="Auto desde Ediwin"
                  style={IS}
                />
              </label>

              {/* Serie FEL */}
              <label style={LS}>
                Serie FEL
                <input
                  value={form.serieFel}
                  onChange={e => sf('serieFel', e.target.value)}
                  placeholder="Serie FEL"
                  style={IS}
                />
              </label>

              {/* Número DTE */}
              <label style={LS}>
                Número DTE
                <input
                  value={form.numeroDTE}
                  onChange={e => sf('numeroDTE', e.target.value)}
                  placeholder="Número DTE"
                  style={IS}
                />
              </label>

              {/* Planta / Almacén */}
              <label style={LS}>
                Planta / Almacén
                <input
                  value={form.almacen}
                  onChange={e => sf('almacen', e.target.value)}
                  placeholder="Planta o almacén destino"
                  style={IS}
                />
              </label>

            </div>
          </div>

          {/* ── Section 3: Productos ──────────────────────── */}
          <div style={{ ...card, borderTop: `3px solid ${T.secondary}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary }}>
                  3 — Productos
                </div>
                <div style={{ fontSize: '.72rem', color: T.textMid, marginTop: 3 }}>
                  Ingresa el precio CON IVA tal como aparece en el Ediwin — el sistema calcula neto e IVA.
                </div>
              </div>
              <button
                onClick={addLinea}
                style={{
                  padding: '8px 18px',
                  background: T.secondary,
                  color: T.white,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '.8rem',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                + Agregar Línea
              </button>
            </div>

            {/* Product lines table */}
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead>
                  <tr>
                    {[
                      'Producto',
                      'Descripción',
                      'Cajas / Bultos',
                      'LBS por caja',
                      'Total LBS',
                      'Precio c/IVA',
                      'Total c/IVA',
                      '',
                    ].map(h => (
                      <th key={h} style={{ ...thSt, padding: '8px 10px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => (
                    <ProductRow
                      key={l._key}
                      linea={l}
                      index={i}
                      catProd={catProd}
                      onChange={(field, val) => setLinea(l._key, field, val)}
                      onRemove={() => removeLinea(l._key)}
                      canRemove={lineas.length > 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial summary */}
            {summary.conIva > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 10,
                }}>
                  <SummaryCard
                    label="Cajas total"
                    value={summary.totalCajas.toLocaleString('es-GT')}
                    color={T.textMid}
                  />
                  <SummaryCard
                    label="Neto extraído"
                    value={fmtQ(summary.neto)}
                    color={T.textDark}
                  />
                  <SummaryCard
                    label="IVA 12%"
                    value={fmtQ(summary.iva)}
                    color={T.textMid}
                  />
                  <SummaryCard
                    label="Con IVA"
                    value={fmtQ(summary.conIva)}
                    color={T.textDark}
                  />
                  <SummaryCard
                    label="Retención Walmart 80% IVA"
                    value={'– ' + fmtQ(summary.retencion)}
                    color={T.danger}
                    bg="#FFEBEE"
                    bdr="#FFCDD2"
                  />
                  {/* A COBRAR — highlighted */}
                  <div style={{
                    background: '#E3F2FD',
                    border: `2px solid ${T.info}`,
                    borderRadius: 8,
                    padding: '12px 14px',
                    textAlign: 'center',
                    gridColumn: 'span 1',
                  }}>
                    <div style={{ fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.info, marginBottom: 6 }}>
                      A COBRAR
                    </div>
                    <div style={{ fontWeight: 900, fontSize: '1.15rem', color: T.info, letterSpacing: '-.01em' }}>
                      {fmtQ(summary.aCobrar)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Observaciones + Save ──────────────────────── */}
          <div style={card}>
            <label style={LS}>
              Observaciones
              <textarea
                value={form.obs}
                onChange={e => sf('obs', e.target.value)}
                rows={2}
                placeholder="Condiciones de entrega, temperatura, notas..."
                style={{ ...IS, resize: 'vertical' }}
              />
            </label>
            <div style={{ marginTop: 16 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '11px 32px',
                  background: saving ? T.textMid : T.primary,
                  color: T.white,
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: '.9rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'background .15s',
                }}
              >
                {saving ? 'Registrando…' : 'Registrar venta'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: HISTORIAL
         ══════════════════════════════════════════════════════ */}
      {mainTab === 'historial' && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary, marginBottom: 16 }}>
            Historial Ventas Walmart ({salidas.length})
          </div>

          {loading ? (
            <Skeleton rows={8} />
          ) : salidas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '52px 0', color: T.textMid, fontSize: '.88rem' }}>
              Sin ventas registradas.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr>
                    {[
                      'Fecha', 'Cliente', 'Productos', 'LBS',
                      'Neto Q', 'IVA Q', 'Con IVA', 'Ret. Q', 'A cobrar Q',
                      'OC', 'Auth SAT', 'Eliminar',
                    ].map(h => (
                      <th key={h} style={thSt}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {salidas.map((r, i) => {
                    const prodList = (r.lineas || r.productos || [])
                      .map(l => l.producto || l.nombre)
                      .filter(Boolean)
                      .join(', ');
                    return (
                      <tr key={r.id} style={{ background: i % 2 ? '#F9FBF9' : '#fff' }}>
                        <td style={{ ...tdSt, whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {r.fecha || '—'}
                        </td>
                        <td style={{ ...tdSt, fontSize: '.78rem', whiteSpace: 'nowrap' }}>
                          {r.cliente || 'Walmart Guatemala'}
                        </td>
                        <td style={{
                          ...tdSt,
                          fontSize: '.74rem',
                          color: T.textMid,
                          maxWidth: 180,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {prodList || `${(r.lineas || r.productos || []).length} línea(s)`}
                        </td>
                        <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>
                          {(r.totalLbs || 0).toLocaleString('es-GT', { maximumFractionDigits: 1 })}
                        </td>
                        <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {fmtQ(r.neto)}
                        </td>
                        <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {fmtQ(r.iva)}
                        </td>
                        <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {fmtQ(r.conIva)}
                        </td>
                        <td style={{ ...tdSt, textAlign: 'right', color: T.danger, whiteSpace: 'nowrap' }}>
                          {fmtQ(r.retencion)}
                        </td>
                        <td style={{
                          ...tdSt,
                          textAlign: 'right',
                          fontWeight: 800,
                          color: T.info,
                          whiteSpace: 'nowrap',
                        }}>
                          {fmtQ(r.aCobrar)}
                        </td>
                        <td style={{ ...tdSt, fontSize: '.76rem', whiteSpace: 'nowrap' }}>
                          {r.numOC || '—'}
                        </td>
                        <td style={{
                          ...tdSt,
                          fontSize: '.72rem',
                          color: T.textMid,
                          maxWidth: 140,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {r.authSAT || '—'}
                        </td>
                        <td style={{ ...tdSt, textAlign: 'center' }}>
                          <button
                            onClick={async () => {
                              if (!window.confirm('¿Eliminar esta venta? Esta acción no se puede deshacer.')) return;
                              try {
                                await remove(r.id);
                                toast('Registro eliminado');
                              } catch {
                                toast('Error al eliminar', 'error');
                              }
                            }}
                            style={{
                              padding: '3px 10px',
                              background: 'none',
                              border: `1px solid ${T.danger}`,
                              color: T.danger,
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: '.72rem',
                              fontWeight: 600,
                            }}
                          >
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
      )}
    </div>
  );
}

// ── ProductRow ────────────────────────────────────────────────────
function ProductRow({ linea, index, catProd, onChange, onRemove, canRemove }) {
  return (
    <tr style={{ background: index % 2 ? '#F9FBF9' : '#fff' }}>

      {/* Producto */}
      <td style={{ padding: '6px 8px', minWidth: 160 }}>
        <select
          value={linea.producto}
          onChange={e => onChange('producto', e.target.value)}
          style={{ ...IS, marginTop: 0, minWidth: 150 }}
        >
          <option value="">— Producto —</option>
          {catProd.map(p => (
            <option key={p.id || p.nombre} value={p.nombre}>{p.nombre}</option>
          ))}
        </select>
      </td>

      {/* Descripción */}
      <td style={{ padding: '6px 8px', minWidth: 140 }}>
        <input
          value={linea.descripcion}
          onChange={e => onChange('descripcion', e.target.value)}
          placeholder="Descripción"
          style={{ ...IS, marginTop: 0, minWidth: 130 }}
        />
      </td>

      {/* Cajas */}
      <td style={{ padding: '6px 8px' }}>
        <input
          type="number"
          min="0"
          step="1"
          value={linea.cajas}
          onChange={e => onChange('cajas', e.target.value)}
          placeholder="0"
          style={{ ...IS, marginTop: 0, width: 80, textAlign: 'right', border: `1.5px solid ${T.secondary}` }}
        />
      </td>

      {/* LBS por caja */}
      <td style={{ padding: '6px 8px' }}>
        <input
          type="number"
          min="0"
          step="0.01"
          value={linea.lbsCaja}
          onChange={e => onChange('lbsCaja', e.target.value)}
          placeholder="0"
          style={{ ...IS, marginTop: 0, width: 80, textAlign: 'right' }}
        />
      </td>

      {/* Total LBS — auto */}
      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: T.textMid, whiteSpace: 'nowrap' }}>
        {linea.totalLbs > 0
          ? linea.totalLbs.toLocaleString('es-GT', { maximumFractionDigits: 2 })
          : '—'}
      </td>

      {/* Precio con IVA */}
      <td style={{ padding: '6px 8px' }}>
        <input
          type="number"
          min="0"
          step="0.01"
          value={linea.precioConIva}
          onChange={e => onChange('precioConIva', e.target.value)}
          placeholder="0.00"
          style={{ ...IS, marginTop: 0, width: 100, textAlign: 'right' }}
        />
      </td>

      {/* Total con IVA — auto */}
      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: T.primary, whiteSpace: 'nowrap' }}>
        {linea.totalConIva > 0 ? fmtQ(linea.totalConIva) : '—'}
      </td>

      {/* Remove */}
      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
        <button
          onClick={onRemove}
          disabled={!canRemove}
          title="Eliminar línea"
          style={{
            background: 'none',
            border: `1px solid ${canRemove ? T.danger : T.border}`,
            color: canRemove ? T.danger : T.border,
            borderRadius: 4,
            padding: '3px 9px',
            cursor: canRemove ? 'pointer' : 'default',
            fontSize: '.76rem',
            fontWeight: 700,
          }}
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

// ── SummaryCard ───────────────────────────────────────────────────
function SummaryCard({ label, value, color, bg, bdr }) {
  return (
    <div style={{
      background: bg || '#F5F5F5',
      border: `1px solid ${bdr || T.border}`,
      borderRadius: 6,
      padding: '10px 12px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: '.6rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.06em',
        color: T.textMid,
        marginBottom: 5,
      }}>
        {label}
      </div>
      <div style={{ fontWeight: 700, fontSize: '.84rem', color: color || T.textDark }}>
        {value}
      </div>
    </div>
  );
}
