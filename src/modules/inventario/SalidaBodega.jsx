import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useProductosCatalogo } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';
import { db, collection, getDocs } from '../../firebase';

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

const card   = { background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:20, marginBottom:20 };
const LS     = { display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:T.textMid, letterSpacing:'.06em' };
const IS     = { padding:'9px 12px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.85rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2, color:T.textDark, background:T.white, boxSizing:'border-box' };
const IS_RO  = { ...IS, background:'#F5F5F5', color:T.textMid, cursor:'default' };
const thSt   = { padding:'9px 12px', fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.white, background:T.primary, textAlign:'left', whiteSpace:'nowrap' };
const tdSt   = { padding:'8px 12px', fontSize:'.82rem', borderBottom:`1px solid ${T.border}`, color:T.textDark };

const fmtQ   = (n) => 'Q ' + (parseFloat(n)||0).toLocaleString('es-GT', { minimumFractionDigits:2, maximumFractionDigits:2 });
const newKey = () => Math.random().toString(36).slice(2);

// ── Blank line ────────────────────────────────────────────────────
const BLANK_LINEA = () => ({
  _key:           newKey(),
  productoId:     '',       // iProductos doc ID
  producto:       '',       // product name string (display + presByProd lookup)
  descripcion:    '',       // FEL description
  presentacionId: '',       // iPresentaciones doc ID
  tipoContenido:  '',       // 'unidades' | 'granel' | 'redes' | 'bolsas'
  cantidadCaja:   0,        // units per box (for tipoContenido='unidades')
  cajas:          '',       // quantity of boxes/bultos sold
  lbsCaja:        0,        // lbs per box (auto from presentation, lbs products)
  totalLbs:       0,        // cajas × lbsCaja  (lbs products)
  totalUnidades:  0,        // cajas × cantidadCaja (unit products)
  precioConIva:   '',
  totalConIva:    0,
});

const todayStr   = () => new Date().toISOString().slice(0, 10);
const BLANK_FORM = () => ({
  fecha: todayStr(), numOC:'', numEntrega:'', authSAT:'', serieFel:'', numeroDTE:'', almacen:'', obs:'',
});

const DOC_TABS = [
  { key:'ediwin',  label:'PDF Ediwin'    },
  { key:'albaran', label:'Albarán físico' },
  { key:'xml',     label:'XML FEL'       },
];

// ── XML FEL parser — Guatemala SAT DTE ────────────────────────────
function parseXML(text) {
  const tagText = (...names) => {
    for (const n of names) {
      const m = text.match(new RegExp(`<(?:[^:>\\s]+:)?${n}(?:\\s[^>]*)?>([^<]+)<\\/`, 'i'));
      if (m) return m[1].trim();
    }
    return '';
  };
  const tagAttr = (tagName, attrName) => {
    const m = text.match(new RegExp(`<(?:[^:>\\s]+:)?${tagName}[^>]*\\s${attrName}=["']([^"']+)["']`, 'i'));
    return m ? m[1].trim() : '';
  };
  const authSAT   = tagText('NumeroAutorizacion','NúmeroAutorizacion');
  const serieFel  = tagAttr('NumeroAutorizacion','Serie');
  const numeroDTE = tagAttr('NumeroAutorizacion','Numero');
  const fechaHora = tagAttr('DatosGenerales','FechaHoraEmision');
  const fecha     = fechaHora ? fechaHora.slice(0,10) : '';
  const items     = [];
  const itemRe    = /<(?:[^:>\s]+:)?Item[^>]*>([\s\S]*?)<\/(?:[^:>\s]+:)?Item>/gi;
  let m;
  while ((m = itemRe.exec(text)) !== null) {
    const block = m[1];
    const tv    = (...ns) => {
      for (const n of ns) {
        const x = block.match(new RegExp(`<(?:[^:>\\s]+:)?${n}[^>]*>([^<]+)<\\/`, 'i'));
        if (x) return x[1].trim();
      }
      return '';
    };
    const desc = tv('Descripcion');
    if (desc) items.push({ descripcion: desc, cantidad: tv('Cantidad'), precioUnitario: tv('PrecioUnitario') });
  }
  return { authSAT, serieFel, numeroDTE, fecha, items };
}

// ── Main ──────────────────────────────────────────────────────────
export default function SalidaBodega() {
  const toast                          = useToast();
  const { data: salidas, loading }     = useCollection('isalidas',       { orderField:'_ts', orderDir:'desc', limit:300 });
  const { data: presData }             = useCollection('iPresentaciones', { limit:200 });
  const { productos: catProd }         = useProductosCatalogo();
  const { add, remove, saving }        = useWrite('isalidas');

  const [mainTab,    setMainTab]    = useState('registrar');
  const [docTab,     setDocTab]     = useState('ediwin');
  const [ediwinFile, setEdiwinFile] = useState(null);
  const [albanFile,  setAlbanFile]  = useState(null);
  const [xmlFile,    setXmlFile]    = useState(null);
  const [xmlParsed,  setXmlParsed]  = useState(null);
  const [form,       setForm]       = useState(BLANK_FORM());
  const [lineas,     setLineas]     = useState([BLANK_LINEA()]);

  // Carga masiva XML
  const [bulkItems,     setBulkItems]     = useState([]);   // { file, parsed, record, status }
  const [bulkImporting, setBulkImporting] = useState(false);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Map productoNombre → product record
  const prodMap = useMemo(() =>
    Object.fromEntries(catProd.map(p => [p.id, p])),
  [catProd]);

  // Map product name → presentations (Walmart channel + no channel fallback)
  const presByProd = useMemo(() => {
    const m = {};
    for (const p of presData) {
      const wm = (p.canal || '').toLowerCase();
      if (wm && !wm.includes('walmart')) continue; // skip non-walmart presentations
      const key = p.producto || prodMap[p.productoId]?.nombre || '';
      if (!key) continue;
      if (!m[key]) m[key] = [];
      m[key].push(p);
    }
    return m;
  }, [presData, prodMap]);

  // ── Line operations ───────────────────────────────────────────
  const addLinea    = () => setLineas(ls => [...ls, BLANK_LINEA()]);
  const removeLinea = key => setLineas(ls => ls.filter(l => l._key !== key));

  const setLinea = (key, field, raw) => {
    setLineas(ls => ls.map(l => {
      if (l._key !== key) return l;
      const next = { ...l, [field]: raw };

      // Product change → store productoId + reset presentation
      if (field === 'producto') {
        const prodRec = catProd.find(p => p.nombre === raw);
        next.productoId     = prodRec?.id || '';
        next.presentacionId = '';
        next.tipoContenido  = '';
        next.cantidadCaja   = 0;
        next.lbsCaja        = 0;
        next.totalLbs       = 0;
        next.totalUnidades  = 0;
        // Auto-select if only one Walmart presentation exists
        const opts = presByProd[raw] || [];
        if (opts.length === 1) {
          const pres = opts[0];
          next.presentacionId = pres.id;
          next.tipoContenido  = pres.tipoContenido || '';
          if (pres.tipoContenido === 'unidades') {
            next.cantidadCaja = Number(pres.cantidadCaja) || 0;
          } else {
            next.lbsCaja = Number(pres.totalLbsCaja) || Number(pres.lbsUnidad) || 0;
          }
        }
      }

      // Presentation change → auto-fill conversion factor
      if (field === 'presentacionId' && raw) {
        const pres = presData.find(p => p.id === raw);
        if (pres) {
          next.tipoContenido = pres.tipoContenido || '';
          if (pres.tipoContenido === 'unidades') {
            next.cantidadCaja = Number(pres.cantidadCaja) || 0;
            next.lbsCaja      = 0;
          } else {
            next.lbsCaja      = Number(pres.totalLbsCaja) || Number(pres.lbsUnidad) || 0;
            next.cantidadCaja = 0;
          }
        }
      }

      // Recalculate totals on any field change
      const cajas = parseFloat(next.cajas) || 0;
      if (next.tipoContenido === 'unidades') {
        next.totalUnidades = cajas * (next.cantidadCaja || 0);
        next.totalLbs      = 0;
      } else {
        next.totalLbs      = cajas * (parseFloat(next.lbsCaja) || 0);
        next.totalUnidades = 0;
      }
      next.totalConIva = cajas * (parseFloat(next.precioConIva) || 0);

      return next;
    }));
  };

  // ── Financial summary ─────────────────────────────────────────
  const summary = useMemo(() => {
    const totalCajas    = lineas.reduce((s,l) => s + (parseFloat(l.cajas)||0), 0);
    const totalLbs      = lineas.reduce((s,l) => s + (l.totalLbs||0), 0);
    const totalUnidades = lineas.reduce((s,l) => s + (l.totalUnidades||0), 0);
    const conIva        = lineas.reduce((s,l) => s + (l.totalConIva||0), 0);
    const neto          = conIva / 1.12;
    const iva           = conIva - neto;
    const retencion     = iva * 0.80;
    const aCobrar       = conIva - retencion;
    return { totalCajas, totalLbs, totalUnidades, conIva, neto, iva, retencion, aCobrar };
  }, [lineas]);

  // ── XML handler with auto product + presentation match ────────
  const handleXmlFile = file => {
    if (!file) return;
    setXmlFile(file);
    const reader = new FileReader();
    reader.onload = e => {
      const text   = e.target.result;
      const parsed = parseXML(text);
      setXmlParsed(parsed);
      if (parsed.authSAT)   sf('authSAT',   parsed.authSAT);
      if (parsed.serieFel)  sf('serieFel',  parsed.serieFel);
      if (parsed.numeroDTE) sf('numeroDTE', parsed.numeroDTE);
      if (parsed.fecha)     sf('fecha',     parsed.fecha);

      if (parsed.items && parsed.items.length > 0) {
        setLineas(parsed.items.map(item => {
          const cajas       = parseFloat(item.cantidad)       || 0;
          const precioConIva = parseFloat(item.precioUnitario) || 0;
          const descUp      = (item.descripcion || '').toUpperCase();

          // 1. Match product: first significant word (>=4 chars)
          const palabra = descUp.split(' ').find(w => w.length >= 4) || '';
          const prodMatch = catProd.find(p =>
            p.nombre.toUpperCase() === descUp ||
            (palabra && (p.nombre.toUpperCase().includes(palabra) || descUp.includes(p.nombre.toUpperCase())))
          );

          // 2. Match presentation: UXC code first, then first Walmart pres
          let presMatch = null;
          if (prodMatch) {
            const walmartPres = presByProd[prodMatch.nombre] || [];
            const uxcM = descUp.match(/UXC_(\d+)/);
            if (uxcM) {
              presMatch = walmartPres.find(p => (p.nombre||'').toUpperCase().includes(uxcM[0]));
            }
            if (!presMatch) presMatch = walmartPres[0] || null;
          }

          const linea = {
            ...BLANK_LINEA(),
            productoId:   prodMatch?.id    || '',
            producto:     prodMatch?.nombre || '',
            descripcion:  item.descripcion,
            cajas:        item.cantidad,
            precioConIva: item.precioUnitario,
            totalConIva:  cajas * precioConIva,
          };

          if (presMatch) {
            linea.presentacionId = presMatch.id;
            linea.tipoContenido  = presMatch.tipoContenido || '';
            if (presMatch.tipoContenido === 'unidades') {
              linea.cantidadCaja  = Number(presMatch.cantidadCaja) || 0;
              linea.totalUnidades = cajas * linea.cantidadCaja;
              linea.lbsCaja       = 0;
              linea.totalLbs      = 0;
            } else {
              linea.lbsCaja      = Number(presMatch.totalLbsCaja) || Number(presMatch.lbsUnidad) || 0;
              linea.totalLbs     = cajas * linea.lbsCaja;
              linea.cantidadCaja = 0;
              linea.totalUnidades = 0;
            }
          }
          return linea;
        }));
      }
    };
    reader.readAsText(file);
  };

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.fecha) { toast('La fecha es requerida', 'error'); return; }
    const valid = lineas.filter(l => (l.producto || l.descripcion) && (parseFloat(l.cajas)||0) > 0);
    if (!valid.length) { toast('Agrega al menos una línea con producto y cajas > 0', 'error'); return; }

    const lineasClean = valid.map(({ _key, ...l }) => ({
      productoId:     l.productoId     || '',
      producto:       l.producto       || '',
      descripcion:    l.descripcion    || '',
      presentacionId: l.presentacionId || '',
      tipoContenido:  l.tipoContenido  || '',
      cajas:          parseFloat(l.cajas)        || 0,
      cantidadCaja:   Number(l.cantidadCaja)     || 0,
      lbsCaja:        parseFloat(l.lbsCaja)      || 0,
      totalLbs:       l.totalLbs      || 0,
      totalUnidades:  l.totalUnidades || 0,
      precioConIva:   parseFloat(l.precioConIva) || 0,
      totalConIva:    l.totalConIva   || 0,
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
        // productos alias for StockVivo / backward compat
        productos: lineasClean.map(l => ({
          productoId:     l.productoId,
          producto:       l.producto || l.descripcion,
          presentacionId: l.presentacionId,
          tipoContenido:  l.tipoContenido,
          cajasEnviadas:  l.cajas,
          cantidadCaja:   l.cantidadCaja,
          totalUnidades:  l.totalUnidades,
          lbs:            l.totalLbs,
          precioConIva:   l.precioConIva,
          totalConIva:    l.totalConIva,
        })),
        totalCajas:    summary.totalCajas,
        totalLbs:      summary.totalLbs,
        totalUnidades: summary.totalUnidades,
        neto:          summary.neto,
        iva:           summary.iva,
        conIva:        summary.conIva,
        retencion:     summary.retencion,
        aCobrar:       summary.aCobrar,
        obs:           form.obs,
        _ts:           Date.now(),
      });
      toast('Venta registrada correctamente');
      setForm(BLANK_FORM());
      setLineas([BLANK_LINEA()]);
      setEdiwinFile(null); setAlbanFile(null); setXmlFile(null); setXmlParsed(null);
    } catch (err) {
      toast('Error al guardar: ' + err.message, 'error');
    }
  };

  // ── Bulk XML helpers ──────────────────────────────────────────
  const xmlToRecord = (parsed) => {
    const lineasBulk = (parsed.items || []).map(item => {
      const cajas        = parseFloat(item.cantidad)       || 0;
      const precioConIva = parseFloat(item.precioUnitario) || 0;
      const descUp       = (item.descripcion || '').toUpperCase();
      const palabra      = descUp.split(' ').find(w => w.length >= 4) || '';
      const prodMatch    = catProd.find(p =>
        p.nombre.toUpperCase() === descUp ||
        (palabra && (p.nombre.toUpperCase().includes(palabra) || descUp.includes(p.nombre.toUpperCase())))
      );
      let presMatch = null;
      if (prodMatch) {
        const wPres = presByProd[prodMatch.nombre] || [];
        const uxcM  = descUp.match(/UXC_(\d+)/);
        if (uxcM) presMatch = wPres.find(p => (p.nombre||'').toUpperCase().includes(uxcM[0]));
        if (!presMatch) presMatch = wPres[0] || null;
      }
      const l = { ...BLANK_LINEA(), productoId: prodMatch?.id||'', producto: prodMatch?.nombre||'',
        descripcion: item.descripcion, cajas: item.cantidad, precioConIva: item.precioUnitario,
        totalConIva: cajas * precioConIva };
      if (presMatch) {
        l.presentacionId = presMatch.id;
        l.tipoContenido  = presMatch.tipoContenido || '';
        if (presMatch.tipoContenido === 'unidades') {
          l.cantidadCaja  = Number(presMatch.cantidadCaja) || 0;
          l.totalUnidades = cajas * l.cantidadCaja;
        } else {
          l.lbsCaja   = Number(presMatch.totalLbsCaja) || Number(presMatch.lbsUnidad) || 0;
          l.totalLbs  = cajas * l.lbsCaja;
        }
      }
      return l;
    });
    const totalCajas    = lineasBulk.reduce((s,l) => s + (parseFloat(l.cajas)||0), 0);
    const totalLbs      = lineasBulk.reduce((s,l) => s + (l.totalLbs||0), 0);
    const totalUnidades = lineasBulk.reduce((s,l) => s + (l.totalUnidades||0), 0);
    const conIva        = lineasBulk.reduce((s,l) => s + (l.totalConIva||0), 0);
    const neto          = conIva / 1.12;
    const iva           = conIva - neto;
    const retencion     = iva * 0.80;
    const aCobrar       = conIva - retencion;
    const lineasClean   = lineasBulk.map(({ _key, ...l }) => ({
      productoId: l.productoId||'', producto: l.producto||'', descripcion: l.descripcion||'',
      presentacionId: l.presentacionId||'', tipoContenido: l.tipoContenido||'',
      cajas: parseFloat(l.cajas)||0, cantidadCaja: Number(l.cantidadCaja)||0,
      lbsCaja: parseFloat(l.lbsCaja)||0, totalLbs: l.totalLbs||0,
      totalUnidades: l.totalUnidades||0, precioConIva: parseFloat(l.precioConIva)||0,
      totalConIva: l.totalConIva||0,
    }));
    return {
      fecha: parsed.fecha || new Date().toISOString().slice(0,10),
      cliente: 'Walmart Guatemala', nit: '1926272',
      authSAT: parsed.authSAT||'', serieFel: parsed.serieFel||'', numeroDTE: parsed.numeroDTE||'',
      numOC:'', numEntrega:'', almacen:'', obs:'',
      lineas: lineasClean,
      productos: lineasClean.map(l => ({ productoId:l.productoId, producto:l.producto||l.descripcion,
        presentacionId:l.presentacionId, tipoContenido:l.tipoContenido, cajasEnviadas:l.cajas,
        cantidadCaja:l.cantidadCaja, totalUnidades:l.totalUnidades, lbs:l.totalLbs,
        precioConIva:l.precioConIva, totalConIva:l.totalConIva })),
      totalCajas, totalLbs, totalUnidades, neto, iva, conIva, retencion, aCobrar, _ts: Date.now(),
    };
  };

  // Clave única de un FEL: authSAT si existe, si no fecha|serie|numero
  const dupKey = (r) => r?.authSAT?.trim() || `${r?.fecha}|${r?.serieFel}|${r?.numeroDTE}`;

  const handleBulkFiles = (files) => {
    const arr = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.xml'));
    if (!arr.length) return;
    setBulkItems([]);
    // Claves ya existentes en Firestore (ya cargadas via useCollection)
    const existingKeys = new Set(salidas.map(s => dupKey(s)));
    const items = arr.map(f => ({ file: f, status: 'pending', parsed: null, record: null, error: null }));
    setBulkItems(items);
    items.forEach((item, i) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const parsed = parseXML(e.target.result);
          const record = xmlToRecord(parsed);
          const isDup  = existingKeys.has(dupKey(record));
          setBulkItems(prev => prev.map((it, j) => j===i
            ? { ...it, status: isDup ? 'duplicate' : 'ready', parsed, record }
            : it));
        } catch(err) {
          setBulkItems(prev => prev.map((it, j) => j===i ? { ...it, status:'error', error: err.message } : it));
        }
      };
      reader.readAsText(item.file);
    });
  };

  const handleBulkImport = async () => {
    const ready = bulkItems.filter(it => it.status === 'ready');
    if (!ready.length) return;
    setBulkImporting(true);
    // Re-verificar contra Firestore antes de insertar (por si se importó mientras tanto)
    const snap = (await getDocs(collection(db, 'isalidas'))).docs.map(d => dupKey(d.data()));
    const serverKeys = new Set(snap);
    let ok = 0, skip = 0, fail = 0;
    for (const item of ready) {
      if (serverKeys.has(dupKey(item.record))) {
        setBulkItems(prev => prev.map(it => it === item ? { ...it, status:'duplicate' } : it));
        skip++;
        continue;
      }
      try {
        await add(item.record);
        serverKeys.add(dupKey(item.record));
        setBulkItems(prev => prev.map(it => it === item ? { ...it, status:'done' } : it));
        ok++;
      } catch(err) {
        setBulkItems(prev => prev.map(it => it === item ? { ...it, status:'error', error: err.message } : it));
        fail++;
      }
    }
    setBulkImporting(false);
    toast(`✅ ${ok} importadas · ${skip} duplicadas omitidas${fail ? ` · ${fail} errores` : ''}`);
  };

  // ── Tab styles ────────────────────────────────────────────────
  const mainTabBtn = key => ({
    padding:'9px 22px', fontWeight:600, fontSize:'.83rem', cursor:'pointer', border:'none',
    borderBottom:`3px solid ${mainTab===key ? T.primary : 'transparent'}`,
    background:'transparent', color: mainTab===key ? T.primary : T.textMid, transition:'all .15s',
  });
  const docTabBtn = key => ({
    padding:'7px 16px', fontWeight:600, fontSize:'.78rem', cursor:'pointer',
    border:`1.5px solid ${docTab===key ? T.info : T.border}`, borderRadius:6,
    background: docTab===key ? '#E3F2FD' : '#F9F9F9',
    color: docTab===key ? T.info : T.textMid, transition:'all .15s',
  });

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:'inherit', maxWidth:1200 }}>

      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:T.primary, margin:0 }}>Ventas Walmart</h1>
        <p style={{ fontSize:'.83rem', color:T.textMid, marginTop:4, marginBottom:0 }}>
          Registro de despachos Walmart — IVA 12% y retención 80% calculados automáticamente.
        </p>
      </div>

      <div style={{ display:'flex', borderBottom:`2px solid ${T.border}`, marginBottom:20 }}>
        <button style={mainTabBtn('registrar')} onClick={() => setMainTab('registrar')}>Registrar Venta</button>
        <button style={mainTabBtn('historial')} onClick={() => setMainTab('historial')}>Historial ({loading ? '…' : salidas.length})</button>
        <button style={mainTabBtn('masiva')} onClick={() => setMainTab('masiva')}>📁 Carga Masiva</button>
      </div>

      {/* ══ TAB REGISTRAR ═══════════════════════════════════════ */}
      {mainTab === 'registrar' && (
        <>
          {/* Sección 1 — Documento */}
          <div style={{ ...card, borderTop:`3px solid ${T.info}` }}>
            <div style={{ fontWeight:700, fontSize:'.9rem', color:T.info, marginBottom:4 }}>1 — Documento de venta</div>
            <p style={{ fontSize:'.76rem', color:T.textMid, marginTop:0, marginBottom:14 }}>
              Adjunta el respaldo. El XML FEL auto-completa datos y hace match de productos con presentaciones.
            </p>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              {DOC_TABS.map(t => <button key={t.key} style={docTabBtn(t.key)} onClick={() => setDocTab(t.key)}>{t.label}</button>)}
            </div>

            {docTab === 'ediwin' && (
              <FileDropZone id="input-ediwin" accept=".pdf,image/*" file={ediwinFile}
                onChange={f => setEdiwinFile(f)}
                label="Cargar PDF Ediwin"
                note={<><strong>Precio con IVA</strong> — ingresa el precio tal como aparece en el Ediwin.</>}
                color={T.info} />
            )}
            {docTab === 'albaran' && (
              <FileDropZone id="input-albaran" accept="image/*" file={albanFile}
                onChange={f => setAlbanFile(f)} label="Foto del albarán físico" color={T.secondary} />
            )}
            {docTab === 'xml' && (
              <div>
                <FileDropZone id="input-xml" accept=".xml" file={xmlFile}
                  onChange={f => handleXmlFile(f)} label="Archivo XML FEL" color={T.secondary} />
                {xmlParsed && (
                  <div style={{ marginTop:12, padding:'12px 14px', background:'#E8F5E9', border:'1px solid #A5D6A7', borderRadius:6 }}>
                    <div style={{ fontSize:'.72rem', fontWeight:700, color:T.primary, marginBottom:8, textTransform:'uppercase', letterSpacing:'.06em' }}>Datos extraídos del XML</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:8 }}>
                      {[['No. Autorización SAT',xmlParsed.authSAT],['Serie FEL',xmlParsed.serieFel],['Número DTE',xmlParsed.numeroDTE]].map(([lbl,val]) => val ? (
                        <div key={lbl}>
                          <div style={{ fontSize:'.62rem', color:T.textMid, fontWeight:600, textTransform:'uppercase' }}>{lbl}</div>
                          <div style={{ fontSize:'.8rem', fontWeight:700, color:T.primary }}>{val}</div>
                        </div>
                      ) : null)}
                    </div>
                    <div style={{ fontSize:'.72rem', color:T.textMid, marginTop:8 }}>
                      Productos y presentaciones auto-completados desde el código UXC del FEL — verifica y ajusta.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sección 2 — Datos */}
          <div style={{ ...card, borderTop:`3px solid ${T.warn}` }}>
            <div style={{ fontWeight:700, fontSize:'.9rem', color:T.warn, marginBottom:14 }}>2 — Datos de la venta — verificar</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:14 }}>
              <label style={LS}>Cliente
                <div style={{ ...IS_RO, display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
                  <span style={{ background:'#E8F5E9', color:T.secondary, border:'1px solid #A5D6A7', borderRadius:100, padding:'2px 10px', fontSize:'.72rem', fontWeight:700 }}>Walmart Guatemala</span>
                </div>
              </label>
              <label style={LS}>NIT Walmart<input readOnly value="1926272" style={IS_RO} /></label>
              <label style={LS}>Fecha *<input type="date" value={form.fecha} onChange={e=>sf('fecha',e.target.value)} style={IS} /></label>
              <label style={LS}>Orden de Compra (OC)<input value={form.numOC} onChange={e=>sf('numOC',e.target.value)} placeholder="Auto desde Ediwin" style={IS} /></label>
              <label style={LS}>No. Entrega / Albarán<input value={form.numEntrega} onChange={e=>sf('numEntrega',e.target.value)} placeholder="Auto desde Ediwin" style={IS} /></label>
              <label style={LS}>No. Autorización SAT<input value={form.authSAT} onChange={e=>sf('authSAT',e.target.value)} placeholder="Auto desde XML" style={IS} /></label>
              <label style={LS}>Serie FEL<input value={form.serieFel} onChange={e=>sf('serieFel',e.target.value)} placeholder="Serie FEL" style={IS} /></label>
              <label style={LS}>Número DTE<input value={form.numeroDTE} onChange={e=>sf('numeroDTE',e.target.value)} placeholder="Número DTE" style={IS} /></label>
              <label style={LS}>Planta / Almacén<input value={form.almacen} onChange={e=>sf('almacen',e.target.value)} placeholder="Planta o almacén destino" style={IS} /></label>
            </div>
          </div>

          {/* Sección 3 — Productos */}
          <div style={{ ...card, borderTop:`3px solid ${T.secondary}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary }}>3 — Productos</div>
                <div style={{ fontSize:'.72rem', color:T.textMid, marginTop:3 }}>
                  Precio CON IVA tal como aparece en el Ediwin. La presentación determina las unidades de stock descontadas.
                </div>
              </div>
              <button onClick={addLinea} style={{ padding:'8px 18px', background:T.secondary, color:T.white, border:'none', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:'.8rem', whiteSpace:'nowrap', flexShrink:0 }}>
                + Agregar Línea
              </button>
            </div>

            <div style={{ border:`1px solid ${T.border}`, borderRadius:6, overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:960 }}>
                <thead>
                  <tr>
                    {['Producto','Presentación','Cajas / Bultos','Factor stock','Total stock','Precio c/IVA','Total c/IVA',''].map(h => (
                      <th key={h} style={{ ...thSt, padding:'8px 10px' }}>{h}</th>
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
                      presByProd={presByProd}
                      onChange={(field, val) => setLinea(l._key, field, val)}
                      onRemove={() => removeLinea(l._key)}
                      canRemove={lineas.length > 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumen financiero */}
            {summary.conIva > 0 && (
              <div style={{ marginTop:18 }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10 }}>
                  <SummaryCard label="Cajas total" value={summary.totalCajas.toLocaleString('es-GT')} />
                  {summary.totalLbs > 0 && <SummaryCard label="Total LBS" value={summary.totalLbs.toLocaleString('es-GT', { maximumFractionDigits:1 })} />}
                  {summary.totalUnidades > 0 && <SummaryCard label="Total unidades" value={summary.totalUnidades.toLocaleString('es-GT')} color={T.info} />}
                  <SummaryCard label="Neto extraído"    value={fmtQ(summary.neto)} />
                  <SummaryCard label="IVA 12%"          value={fmtQ(summary.iva)} />
                  <SummaryCard label="Con IVA"          value={fmtQ(summary.conIva)} />
                  <SummaryCard label="Retención 80% IVA" value={'– '+fmtQ(summary.retencion)} color={T.danger} bg="#FFEBEE" bdr="#FFCDD2" />
                  <div style={{ background:'#E3F2FD', border:`2px solid ${T.info}`, borderRadius:8, padding:'12px 14px', textAlign:'center' }}>
                    <div style={{ fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.info, marginBottom:6 }}>A COBRAR</div>
                    <div style={{ fontWeight:900, fontSize:'1.15rem', color:T.info }}>{fmtQ(summary.aCobrar)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Observaciones + Guardar */}
          <div style={card}>
            <label style={LS}>Observaciones
              <textarea value={form.obs} onChange={e=>sf('obs',e.target.value)} rows={2}
                placeholder="Condiciones de entrega, temperatura, notas..." style={{ ...IS, resize:'vertical' }} />
            </label>
            <div style={{ marginTop:16 }}>
              <button onClick={handleSave} disabled={saving} style={{ padding:'11px 32px', background:saving?T.textMid:T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, fontSize:'.9rem', cursor:saving?'not-allowed':'pointer' }}>
                {saving ? 'Registrando…' : 'Registrar venta'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══ TAB CARGA MASIVA ════════════════════════════════════ */}
      {mainTab === 'masiva' && (
        <div style={card}>
          <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary, marginBottom:6 }}>Carga masiva de XML FEL</div>
          <p style={{ fontSize:'.76rem', color:T.textMid, marginTop:0, marginBottom:16 }}>
            Selecciona varios archivos XML a la vez. Se parsean automáticamente y puedes importarlos todos de una vez.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleBulkFiles(e.dataTransfer.files); }}
            style={{ border:`2px dashed ${T.border}`, borderRadius:10, padding:'28px 20px', textAlign:'center', cursor:'pointer', background:'#FAFAFA', marginBottom:16 }}
            onClick={() => document.getElementById('bulk-xml-input').click()}>
            <div style={{ fontSize:'1.6rem', marginBottom:6 }}>📂</div>
            <div style={{ fontSize:'.86rem', color:T.textMid }}>Arrastra archivos XML aquí o <b>haz clic para seleccionar</b></div>
            <div style={{ fontSize:'.76rem', color:T.textMid, marginTop:4 }}>Múltiples archivos .xml permitidos</div>
            <input id="bulk-xml-input" type="file" multiple accept=".xml" style={{ display:'none' }}
              onChange={e => { handleBulkFiles(e.target.files); e.target.value = ''; }} />
          </div>

          {/* Preview table */}
          {bulkItems.length > 0 && (
            <>
              <div style={{ overflowX:'auto', marginBottom:16 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.81rem' }}>
                  <thead>
                    <tr>{['Archivo','Fecha','Auth SAT','Productos','A Cobrar Q','Estado'].map(h => (
                      <th key={h} style={{ ...thSt, padding:'8px 10px' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {bulkItems.map((it, i) => {
                      const statusBadge = {
                        pending:   { bg:'#FFF3E0', color:'#E65100', label:'Procesando…' },
                        ready:     { bg:'#E8F5E9', color:'#1B5E20', label:'Listo'       },
                        done:      { bg:'#E3F2FD', color:'#1565C0', label:'Importado'   },
                        duplicate: { bg:'#F3F4F6', color:'#6B7280', label:'Duplicado'   },
                        error:     { bg:'#FFEBEE', color:'#C62828', label:'Error'       },
                      }[it.status] || {};
                      return (
                        <tr key={i} style={{ background: i%2 ? '#F9FBF9' : '#fff' }}>
                          <td style={{ ...tdSt, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'.76rem', color:T.textMid }}>{it.file.name}</td>
                          <td style={{ ...tdSt, whiteSpace:'nowrap', fontWeight:600 }}>{it.record?.fecha || '—'}</td>
                          <td style={{ ...tdSt, fontSize:'.72rem', color:T.textMid, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it.parsed?.authSAT || '—'}</td>
                          <td style={{ ...tdSt, textAlign:'center' }}>{it.record?.lineas?.length ?? '—'}</td>
                          <td style={{ ...tdSt, textAlign:'right', fontWeight:700, color:T.info, whiteSpace:'nowrap' }}>{it.record ? fmtQ(it.record.aCobrar) : '—'}</td>
                          <td style={{ ...tdSt, textAlign:'center' }}>
                            <span style={{ padding:'3px 10px', borderRadius:100, background:statusBadge.bg, color:statusBadge.color, fontWeight:700, fontSize:'.72rem', whiteSpace:'nowrap' }}>
                              {it.status === 'error' ? `Error: ${it.error?.slice(0,40)||'?'}` : statusBadge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <button onClick={handleBulkImport} disabled={bulkImporting || !bulkItems.some(it => it.status === 'ready')}
                  style={{ padding:'11px 28px', background: bulkImporting ? T.textMid : T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor: bulkImporting ? 'not-allowed' : 'pointer' }}>
                  {bulkImporting ? 'Importando…' : `⬆️ Importar ${bulkItems.filter(it=>it.status==='ready').length} nuevas`}
                </button>
                <button onClick={() => setBulkItems([])} disabled={bulkImporting}
                  style={{ padding:'11px 18px', background:'none', border:`1.5px solid ${T.border}`, borderRadius:6, fontWeight:600, fontSize:'.82rem', cursor:'pointer', color:T.textMid }}>
                  Limpiar
                </button>
                <span style={{ fontSize:'.78rem', color:T.textMid }}>
                  {bulkItems.filter(it=>it.status==='done').length} importadas
                  {bulkItems.filter(it=>it.status==='duplicate').length > 0 && ` · ${bulkItems.filter(it=>it.status==='duplicate').length} duplicadas`}
                  {bulkItems.filter(it=>it.status==='error').length > 0 && ` · ${bulkItems.filter(it=>it.status==='error').length} errores`}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ TAB HISTORIAL ═══════════════════════════════════════ */}
      {mainTab === 'historial' && (
        <div style={card}>
          <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary, marginBottom:16 }}>
            Historial Ventas Walmart ({salidas.length})
          </div>
          {loading ? <Skeleton rows={8} /> : salidas.length === 0 ? (
            <div style={{ textAlign:'center', padding:'52px 0', color:T.textMid, fontSize:'.88rem' }}>Sin ventas registradas.</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
                <thead>
                  <tr>{['Fecha','Cliente','Productos','LBS','Neto Q','IVA Q','Con IVA','Ret. Q','A cobrar Q','OC','Auth SAT','Eliminar'].map(h=>(
                    <th key={h} style={thSt}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {[...salidas].sort((a,b) => (b.fecha||'') > (a.fecha||'') ? 1 : -1).map((r,i) => {
                    const prodList = (r.lineas||r.productos||[]).map(l=>l.producto||l.nombre).filter(Boolean).join(', ');
                    return (
                      <tr key={r.id} style={{ background: i%2?'#F9FBF9':'#fff' }}>
                        <td style={{ ...tdSt, whiteSpace:'nowrap', fontWeight:600 }}>{r.fecha||'—'}</td>
                        <td style={{ ...tdSt, fontSize:'.78rem', whiteSpace:'nowrap' }}>{r.cliente||'Walmart Guatemala'}</td>
                        <td style={{ ...tdSt, fontSize:'.74rem', color:T.textMid, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {prodList || `${(r.lineas||r.productos||[]).length} línea(s)`}
                        </td>
                        <td style={{ ...tdSt, textAlign:'right', fontWeight:600 }}>{(r.totalLbs||0).toLocaleString('es-GT',{maximumFractionDigits:1})}</td>
                        <td style={{ ...tdSt, textAlign:'right', whiteSpace:'nowrap' }}>{fmtQ(r.neto)}</td>
                        <td style={{ ...tdSt, textAlign:'right', whiteSpace:'nowrap' }}>{fmtQ(r.iva)}</td>
                        <td style={{ ...tdSt, textAlign:'right', fontWeight:600, whiteSpace:'nowrap' }}>{fmtQ(r.conIva)}</td>
                        <td style={{ ...tdSt, textAlign:'right', color:T.danger, whiteSpace:'nowrap' }}>{fmtQ(r.retencion)}</td>
                        <td style={{ ...tdSt, textAlign:'right', fontWeight:800, color:T.info, whiteSpace:'nowrap' }}>{fmtQ(r.aCobrar)}</td>
                        <td style={{ ...tdSt, fontSize:'.76rem', whiteSpace:'nowrap' }}>{r.numOC||'—'}</td>
                        <td style={{ ...tdSt, fontSize:'.72rem', color:T.textMid, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.authSAT||'—'}</td>
                        <td style={{ ...tdSt, textAlign:'center' }}>
                          <button onClick={async()=>{ if(!window.confirm('¿Eliminar esta venta?'))return; try{await remove(r.id);toast('Eliminado');}catch{toast('Error','error');} }}
                            style={{ padding:'3px 10px', background:'none', border:`1px solid ${T.danger}`, color:T.danger, borderRadius:4, cursor:'pointer', fontSize:'.72rem', fontWeight:600 }}>
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

// ── FileDropZone ──────────────────────────────────────────────────
function FileDropZone({ id, accept, file, onChange, label, note, color }) {
  return (
    <label style={{ ...{ display:'flex', flexDirection:'column', gap:4, fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', color:'#6B6B60', letterSpacing:'.06em' }, cursor:'pointer' }}>
      {label}
      <div style={{ marginTop:6, border:`2px dashed ${file ? color : '#E0E0E0'}`, borderRadius:8, padding:'18px 14px', textAlign:'center', background: file ? (color === '#1565C0' ? '#E3F2FD' : '#E8F5E9') : '#FAFAFA', cursor:'pointer', transition:'all .15s' }}>
        <input type="file" accept={accept} style={{ display:'none' }} id={id} onChange={e => onChange(e.target.files[0]||null)} />
        <label htmlFor={id} style={{ cursor:'pointer' }}>
          {file ? (
            <span style={{ fontSize:'.82rem', color, fontWeight:600 }}>{file.name}</span>
          ) : (
            <span style={{ fontSize:'.82rem', color:'#6B6B60' }}>Haz clic para seleccionar</span>
          )}
        </label>
      </div>
      {note && <div style={{ marginTop:10, padding:'10px 14px', background:'#FFF8E1', border:'1px solid #FFE082', borderRadius:6, fontSize:'.76rem', color:'#5D4037', lineHeight:1.5 }}>{note}</div>}
    </label>
  );
}

// ── ProductRow ────────────────────────────────────────────────────
function ProductRow({ linea, index, catProd, presByProd, onChange, onRemove, canRemove }) {
  const presentations = presByProd[linea.producto] || [];
  const isUnidades    = linea.tipoContenido === 'unidades';

  const factorLabel = linea.presentacionId
    ? isUnidades
      ? `× ${linea.cantidadCaja || '?'} unid/caja`
      : `× ${linea.lbsCaja || '?'} lbs/caja`
    : '— seleccionar presentación —';

  const totalLabel = linea.presentacionId
    ? isUnidades
      ? `${linea.totalUnidades > 0 ? linea.totalUnidades.toLocaleString('es-GT') : '—'} unid`
      : `${linea.totalLbs > 0 ? linea.totalLbs.toLocaleString('es-GT',{maximumFractionDigits:2}) : '—'} lbs`
    : '—';

  const tdP = { padding:'6px 8px' };

  return (
    <tr style={{ background: index%2 ? '#F9FBF9' : '#fff' }}>

      {/* Producto */}
      <td style={{ ...tdP, minWidth:160 }}>
        <select value={linea.producto} onChange={e=>onChange('producto',e.target.value)}
          style={{ ...{ padding:'9px 12px', border:`1.5px solid #E0E0E0`, borderRadius:6, fontSize:'.85rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2, color:'#1A1A18', background:'#fff', boxSizing:'border-box' }, marginTop:0, minWidth:150 }}>
          <option value="">— Producto —</option>
          {catProd.map(p=><option key={p.id||p.nombre} value={p.nombre}>{p.nombre}</option>)}
        </select>
      </td>

      {/* Presentación */}
      <td style={{ ...tdP, minWidth:180 }}>
        <select value={linea.presentacionId} onChange={e=>onChange('presentacionId',e.target.value)}
          style={{ ...{ padding:'9px 12px', border:`1.5px solid ${linea.producto && !linea.presentacionId ? '#E65100' : '#E0E0E0'}`, borderRadius:6, fontSize:'.82rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:0, color:'#1A1A18', background: linea.presentacionId ? '#E8F5E9' : '#fff', boxSizing:'border-box' }, minWidth:170 }}>
          <option value="">— Presentación —</option>
          {presentations.map(p=><option key={p.id} value={p.id}>{p.nombre || p.descripcion || p.id}</option>)}
          {!linea.producto && <option disabled value="">Selecciona producto primero</option>}
        </select>
      </td>

      {/* Cajas */}
      <td style={tdP}>
        <input type="number" min="0" step="1" value={linea.cajas} onChange={e=>onChange('cajas',e.target.value)}
          placeholder="0"
          style={{ padding:'9px 12px', border:`1.5px solid #2E7D32`, borderRadius:6, fontSize:'.85rem', outline:'none', fontFamily:'inherit', width:80, marginTop:0, color:'#1A1A18', background:'#fff', boxSizing:'border-box', textAlign:'right' }} />
      </td>

      {/* Factor stock — readonly, auto-filled */}
      <td style={{ ...tdP, minWidth:120, fontSize:'.78rem', color: linea.presentacionId ? (isUnidades ? '#1565C0' : '#2E7D32') : '#9E9E9E', fontWeight: linea.presentacionId ? 700 : 400, whiteSpace:'nowrap' }}>
        {factorLabel}
      </td>

      {/* Total stock — auto */}
      <td style={{ ...tdP, fontWeight:700, color: linea.presentacionId ? (isUnidades ? '#1565C0' : '#1B5E20') : '#9E9E9E', textAlign:'right', whiteSpace:'nowrap' }}>
        {totalLabel}
      </td>

      {/* Precio con IVA */}
      <td style={tdP}>
        <input type="number" min="0" step="0.01" value={linea.precioConIva} onChange={e=>onChange('precioConIva',e.target.value)}
          placeholder="0.00"
          style={{ padding:'9px 12px', border:`1.5px solid #E0E0E0`, borderRadius:6, fontSize:'.85rem', outline:'none', fontFamily:'inherit', width:100, marginTop:0, color:'#1A1A18', background:'#fff', boxSizing:'border-box', textAlign:'right' }} />
      </td>

      {/* Total con IVA — auto */}
      <td style={{ ...tdP, textAlign:'right', fontWeight:700, color:'#1B5E20', whiteSpace:'nowrap' }}>
        {linea.totalConIva > 0 ? fmtQ(linea.totalConIva) : '—'}
      </td>

      {/* Remove */}
      <td style={{ ...tdP, textAlign:'center' }}>
        <button onClick={onRemove} disabled={!canRemove} title="Eliminar línea"
          style={{ background:'none', border:`1px solid ${canRemove?'#C62828':'#E0E0E0'}`, color:canRemove?'#C62828':'#E0E0E0', borderRadius:4, padding:'3px 9px', cursor:canRemove?'pointer':'default', fontSize:'.76rem', fontWeight:700 }}>
          ✕
        </button>
      </td>
    </tr>
  );
}

// ── SummaryCard ───────────────────────────────────────────────────
function SummaryCard({ label, value, color, bg, bdr }) {
  return (
    <div style={{ background:bg||'#F5F5F5', border:`1px solid ${bdr||'#E0E0E0'}`, borderRadius:6, padding:'10px 12px', textAlign:'center' }}>
      <div style={{ fontSize:'.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#6B6B60', marginBottom:5 }}>{label}</div>
      <div style={{ fontWeight:700, fontSize:'.84rem', color:color||'#1A1A18' }}>{value}</div>
    </div>
  );
}
