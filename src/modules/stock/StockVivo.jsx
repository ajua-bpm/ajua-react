import { useMemo, useState, useCallback, useEffect } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import { useMainData, useProductosCatalogo } from '../../hooks/useMainData';
import Skeleton from '../../components/Skeleton';

// ── Design tokens ─────────────────────────────────────────────────
const T = {
  primary:   '#1B5E20',
  secondary: '#2E7D32',
  white:     '#FFFFFF',
  bgLight:   '#F5F5F5',
  border:    '#E0E0E0',
  textDark:  '#1A1A18',
  textMid:   '#6B6B60',
  danger:    '#C62828',
  warn:      '#E65100',
  info:      '#1565C0',
};
const card = { background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:20, marginBottom:20 };

// ── Helpers ───────────────────────────────────────────────────────
const fmtDate = d => {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  if (d?.toDate) return d.toDate().toISOString().slice(0, 10);
  return '';
};
const fmtN = (n, dec = 1) => (n || 0).toLocaleString('es-GT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const lbsToKg = n => ((n || 0) / 2.205).toFixed(1);

function canalBadge(canal) {
  const c = (canal || '').toLowerCase();
  if (c.includes('walmart'))                       return { label: 'Walmart',  bg: '#FFEBEE', color: '#C62828' };
  if (c.includes('gt') || c.includes('local'))     return { label: 'Local GT', bg: '#E8F5E9', color: '#1B5E20' };
  if (c.includes('int') || c.includes('export'))   return { label: 'Export',   bg: '#E3F2FD', color: '#1565C0' };
  return { label: 'Entrada', bg: '#E8F5E9', color: '#2E7D32' };
}

// Resolve productoId / nombre to canonical catalog key (mirrors bpm.html resolveId logic)
function resolveProductId(productoId, nombre, prodById, prodByName, prodByFirstWord) {
  if (productoId && prodById[productoId]) return productoId;
  const up = (nombre || '').toUpperCase().trim();
  if (up && prodByName[up]) return prodByName[up];
  const fw = up.split(/\s+/)[0];
  if (fw && prodByFirstWord[fw]) return prodByFirstWord[fw];
  // Fallback: use uppercase name or original id so unknown products still appear
  return up || productoId || null;
}

// ── Main ──────────────────────────────────────────────────────────
export default function StockVivo() {
  const { data: colEntradas, loading: loadE } = useCollection('ientradas',       { orderField: 'fecha', orderDir: 'desc', limit: 2000 });
  const { data: colSalidas,  loading: loadS } = useCollection('isalidas',        { orderField: 'fecha', orderDir: 'desc', limit: 2000 });
  const { data: presData                    } = useCollection('iPresentaciones',  { limit: 200 });
  const { data: mainData,    loading: loadM } = useMainData();
  const { productos: catalogItems, loading: loadC } = useProductosCatalogo();
  const [filtProd, setFiltProd] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const loading = loadE || loadS || loadM || loadC;

  // Build catalog lookup maps from iProductos
  const { prodById, prodByName, prodByFirstWord } = useMemo(() => {
    const byId        = {};
    const byName      = {};
    const byFirstWord = {};
    for (const p of catalogItems) {
      const id   = p.id;
      const name = (p.nombre || '').toUpperCase().trim();
      byId[id] = p;
      if (name) byName[name] = id;
      const fw = name.split(/\s+/)[0];
      if (fw && !byFirstWord[fw]) byFirstWord[fw] = id;
    }
    return { prodById: byId, prodByName: byName, prodByFirstWord: byFirstWord };
  }, [catalogItems]);

  const resolve = useCallback(
    (id, nombre) => resolveProductId(id, nombre, prodById, prodByName, prodByFirstWord),
    [prodById, prodByName, prodByFirstWord]
  );

  // Map: canonId → unidades por caja
  // Handles two schemas: Cotizador (cantidadCaja + tipoContenido) and Lista de Precios (descripcion "4 unidades × ...")
  const cantPorCajaMap = useMemo(() => {
    const m = {};
    for (const p of (presData || [])) {
      // Get qty: structured field OR parse "4 unidades" from descripcion/nombre
      const qty = Number(p.cantidadCaja)
        || Number((p.descripcion || p.nombre || '').match(/^(\d+)\s*unidades?/i)?.[1])
        || 0;
      if (!qty) continue;
      // Resolve canonical product ID: by productoId (Lista de Precios) or by name string (Cotizador)
      const canonId = (p.productoId && prodById[p.productoId])
        ? p.productoId
        : resolve(null, p.producto || '');
      if (!canonId) continue;
      // Only apply to products tracked by unit (esPorUnidad)
      const cat = prodById[canonId];
      if (!cat || (cat.unidadCompra !== 'unidad' && cat.unidadCompra !== 'pza')) continue;
      if (!m[canonId]) m[canonId] = qty;
    }
    return m;
  }, [presData, prodById, resolve]);

  // Merge Firestore ientradas + legacy ajua_bpm/main ientradas
  const entradas = useMemo(() => {
    const mainEnt = (mainData?.ientradas || []).map(r => ({
      ...r,
      producto: r.producto || r.productoNombre || '',
      // lbsNeto→lbsBrutas→lbsTotal(cotizador)→lbsBruto(manual saveIne)
      lbs: Number(r.lbs) || Number(r.lbsBrutas) || Number(r.lbsNeto) || Number(r.lbsTotal) || Number(r.lbsBruto) || (Number(r.kgTotal) * 2.20462) || 0,
    }));
    const seen = new Set(colEntradas.map(r => r.id));
    return [...colEntradas, ...mainEnt.filter(r => r.id && !seen.has(r.id))];
  }, [colEntradas, mainData]);

  const salidas = useMemo(() => {
    const mainSal = (mainData?.isalidas || []);
    const seen = new Set(colSalidas.map(r => r.id));
    return [...colSalidas, ...mainSal.filter(r => r.id && !seen.has(r.id))];
  }, [colSalidas, mainData]);

  // ── Per-product summary keyed by canonical productoId ─────────
  // Mirrors bpm.html invGetStock() logic: resolves by id→exactName→firstWord
  // Products with unidadCompra='unidad'/'pza' (repollo) track bultos, not lbs
  const stockMap = useMemo(() => {
    const m = {};
    const ensure = (canonId, fallbackNombre) => {
      if (!m[canonId]) {
        const cat        = prodById[canonId];
        const esPorUnidad = cat?.unidadCompra === 'unidad' || cat?.unidadCompra === 'pza';
        m[canonId] = {
          nombre: cat?.nombre || fallbackNombre || canonId,
          esPorUnidad,
          entLbs: 0, salLbs: 0,
          entUnid: 0, salUnid: 0,
          lastDuca: '', lastDucaLbs: 0,
        };
      }
    };

    for (const e of entradas) {
      const nombre   = e.producto || e.productoNombre || '';
      const canonId  = resolve(e.productoId, nombre);
      if (!canonId) continue;
      ensure(canonId, nombre);
      const slot = m[canonId];
      if (slot.esPorUnidad) {
        slot.entUnid += Number(e.bultos) || Number(e.unidades) || Number(e.cantidad) || 0;
      } else {
        const lbs = Number(e.lbs) || Number(e.lbsBrutas) || Number(e.lbsNeto) || Number(e.lbsTotal) || Number(e.lbsBruto) || (Number(e.kgTotal) * 2.20462) || 0;
        slot.entLbs += lbs;
      }
      if (e.duca) { slot.lastDuca = e.duca; slot.lastDucaLbs = Number(e.lbsBrutas) || Number(e.lbs) || 0; }
    }

    for (const s of salidas) {
      // bpm.html isalidas use lineas[]; React isalidas use productos[]; single-product fallback
      const lineas = Array.isArray(s.lineas)
        ? s.lineas
        : Array.isArray(s.productos)
          ? s.productos
          : s.producto
            ? [{ productoId: s.productoId, productoNombre: s.producto, totalLbs: s.lbs, bultos: s.cajasEnviadas }]
            : [];

      for (const l of lineas) {
        const nombre  = l.productoNombre || l.producto || l.nombre || l.descripcion || '';
        const canonId = resolve(l.productoId, nombre);
        if (!canonId) continue;
        ensure(canonId, nombre);
        const slot = m[canonId];
        if (slot.esPorUnidad) {
          // New records: totalUnidades pre-calculated by SalidaBodega
          if (Number(l.totalUnidades) > 0) {
            slot.salUnid += Number(l.totalUnidades);
          } else {
            // Fallback for old records: cajas × cantidadCaja (linea) or cantPorCajaMap
            const cajas       = Number(l.bultos) || Number(l.cajasEnviadas) || Number(l.cajas) || Number(l.cantidad) || 0;
            const cantPorCaja = Number(l.cantidadCaja) || cantPorCajaMap[canonId] || 1;
            slot.salUnid += cajas * cantPorCaja;
          }
        } else {
          const lbs = Number(l.totalLbs) || Number(l.lbs) || (Number(l.lbsBulto) * (Number(l.bultos) || 0)) || 0;
          slot.salLbs += lbs;
        }
      }
    }

    return m;
  }, [entradas, salidas, prodById, resolve, cantPorCajaMap]);

  const productos = useMemo(() =>
    Object.entries(stockMap)
      .map(([canonId, v]) => ({
        canonId,
        nombre: v.nombre,
        esPorUnidad: v.esPorUnidad,
        entQ: v.esPorUnidad ? v.entUnid : v.entLbs,
        salQ: v.esPorUnidad ? v.salUnid : v.salLbs,
        stock: v.esPorUnidad ? (v.entUnid - v.salUnid) : (v.entLbs - v.salLbs),
        lastDuca: v.lastDuca,
        lastDucaLbs: v.lastDucaLbs,
      }))
      .filter(p => p.entQ > 0 || p.salQ > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [stockMap]
  );

  // ── Movement history (per-line, resolved to canonical product) ─
  const movements = useMemo(() => {
    const mvs = [];

    for (const e of entradas) {
      const nombre  = e.producto || e.productoNombre || '';
      const canonId = resolve(e.productoId, nombre);
      if (!canonId) continue;
      const cat     = prodById[canonId];
      const esPorUnidad = cat?.unidadCompra === 'unidad' || cat?.unidadCompra === 'pza';
      const lbs  = esPorUnidad ? 0 : (Number(e.lbs) || Number(e.lbsBrutas) || Number(e.lbsNeto) || Number(e.lbsTotal) || Number(e.lbsBruto) || 0);
      const unid = esPorUnidad ? (Number(e.bultos) || Number(e.unidades) || Number(e.cantidad) || 0) : 0;
      mvs.push({
        fecha: fmtDate(e.fecha),
        tipo:  'entrada',
        canal: 'Entrada',
        canonId,
        producto:    cat?.nombre || nombre,
        entidad:     e.proveedor || '—',
        bultos:      Number(e.bultos) || 0,
        lbs,
        unid,
        esPorUnidad,
        docId:   e.id,
        felAuth: e.duca || '',
      });
    }

    for (const s of salidas) {
      const lineas = Array.isArray(s.lineas)
        ? s.lineas
        : Array.isArray(s.productos)
          ? s.productos
          : s.producto
            ? [{ productoId: s.productoId, productoNombre: s.producto, totalLbs: s.lbs, bultos: s.cajasEnviadas }]
            : [];
      const canal   = s.canal || (s.tipo === 'walmart' ? 'Walmart' : 'Salida');
      const entidad = s.cliente || s.clienteNombre || s.almacen || 'Walmart Guatemala';
      for (const l of lineas) {
        const nombre  = l.productoNombre || l.producto || l.nombre || l.descripcion || '';
        const canonId = resolve(l.productoId, nombre);
        if (!canonId) continue;
        const cat     = prodById[canonId];
        const esPorUnidad = cat?.unidadCompra === 'unidad' || cat?.unidadCompra === 'pza';
        const lbs      = esPorUnidad ? 0 : (Number(l.totalLbs) || Number(l.lbs) || (Number(l.lbsBulto) * (Number(l.bultos) || 0)) || 0);
        const cajasRaw = Number(l.bultos) || Number(l.cajasEnviadas) || Number(l.cajas) || 0;
        // New records have totalUnidades; fallback for old records uses cantidadCaja or cantPorCajaMap
        const unid = esPorUnidad
          ? (Number(l.totalUnidades) > 0
              ? Number(l.totalUnidades)
              : cajasRaw * (Number(l.cantidadCaja) || cantPorCajaMap[canonId] || 1))
          : 0;
        mvs.push({
          fecha: fmtDate(s.fecha),
          tipo:  'salida',
          canal,
          canonId,
          producto:    cat?.nombre || nombre,
          entidad,
          bultos:      cajasRaw,
          lbs,
          unid,
          esPorUnidad,
          docId:   s.id,
          felAuth: s.authSAT || s.numFel || s.numeroDTE || '',
        });
      }
    }

    // Sort oldest-first to compute running stock balance
    mvs.sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0);
    const run = {};
    for (const mv of mvs) {
      if (!run[mv.canonId]) run[mv.canonId] = 0;
      const qty = mv.esPorUnidad ? mv.unid : mv.lbs;
      run[mv.canonId] += mv.tipo === 'entrada' ? qty : -qty;
      mv.stockBodega = run[mv.canonId];
    }

    return mvs.reverse();
  }, [entradas, salidas, prodById, resolve, cantPorCajaMap]);

  const filtMvs = useMemo(() =>
    filtProd ? movements.filter(m => m.canonId === filtProd) : movements,
    [movements, filtProd]
  );

  if (loading) return <div style={{ padding: 24 }}><Skeleton rows={10} /></div>;

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1100 }}>

      {/* Page header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: T.primary, margin: 0 }}>Stock en Tiempo Real</h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>
          Existencias por producto en bodega · Historial de movimientos: entradas, Walmart, Local GT, Exportación
        </p>
      </div>

      {/* Product summary cards */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary, marginBottom: 16 }}>
          Existencias en Bodega por Producto
        </div>
        {productos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: T.textMid, fontSize: '.88rem' }}>
            <div style={{ fontSize: '2rem', opacity: .3, marginBottom: 8 }}>📦</div>
            Sin movimientos registrados. Registre ingresos y salidas para ver el stock.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {productos.map(p => {
              const pct    = p.entQ > 0 ? Math.max(0, Math.min(100, (p.stock / p.entQ) * 100)) : 0;
              const sColor = p.stock > 0 ? T.secondary : T.danger;
              const unit   = p.esPorUnidad ? 'unid' : 'lbs';
              return (
                <div
                  key={p.canonId}
                  style={{ flex: '1 1 220px', minWidth: 200, background: T.bgLight, borderRadius: 8, padding: 16, border: `1px solid ${T.border}` }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: '.82rem', color: T.textDark, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      {p.nombre}
                    </div>
                    <button
                      onClick={() => setFiltProd(filtProd === p.canonId ? '' : p.canonId)}
                      style={{ padding: '2px 8px', background: filtProd === p.canonId ? T.secondary : 'rgba(46,125,50,.10)', color: filtProd === p.canonId ? T.white : T.secondary, border: '1px solid rgba(46,125,50,.25)', borderRadius: 10, fontSize: '.62rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Trazabilidad
                    </button>
                  </div>

                  <div style={{ fontSize: '2rem', fontWeight: 800, color: sColor, lineHeight: 1 }}>
                    {fmtN(p.stock, 0)}
                  </div>
                  <div style={{ fontSize: '.72rem', color: T.textMid, marginTop: 2, marginBottom: 10 }}>
                    {unit} en bodega{!p.esPorUnidad ? ` · ${lbsToKg(p.stock)} kg` : ''}
                  </div>

                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ padding: '2px 7px', background: '#E8F5E9', color: T.secondary, borderRadius: 10, fontSize: '.68rem', fontWeight: 700 }}>
                      ENTRADA {fmtN(p.entQ, 0)} {unit}
                    </span>
                    <span style={{ padding: '2px 7px', background: '#FFEBEE', color: T.danger, borderRadius: 10, fontSize: '.68rem', fontWeight: 700 }}>
                      SALIDA {fmtN(p.salQ, 0)} {unit}
                    </span>
                  </div>

                  <div style={{ height: 5, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: sColor, borderRadius: 3 }} />
                  </div>

                  {p.lastDuca && (
                    <div style={{ marginTop: 8, fontSize: '.68rem', color: T.info, background: 'rgba(21,101,192,.07)', padding: '3px 8px', borderRadius: 6, display: 'inline-block' }}>
                      DUCA {p.lastDuca} · {fmtN(p.lastDucaLbs, 0)} lbs
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Movement history */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary }}>
            Historial de Movimientos ({filtMvs.length})
          </div>
          <select
            value={filtProd}
            onChange={e => setFiltProd(e.target.value)}
            style={{ padding: '6px 12px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.82rem', outline: 'none', fontFamily: 'inherit', color: T.textDark, background: T.white }}
          >
            <option value=''>Todos los productos</option>
            {productos.map(p => <option key={p.canonId} value={p.canonId}>{p.nombre}</option>)}
          </select>
        </div>

        {filtMvs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: T.textMid, fontSize: '.88rem' }}>
            Sin movimientos registrados
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtMvs.slice(0, 400).map((mv, i) => {
              const badge  = canalBadge(mv.canal);
              const sColor = mv.stockBodega >= 0 ? T.secondary : T.danger;
              const qty    = mv.esPorUnidad ? mv.unid : mv.lbs;
              const unit   = mv.esPorUnidad ? 'unid' : 'lbs';
              return (
                <div key={`${mv.docId}-${mv.canonId}-${i}`} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.10)', borderLeft: `4px solid ${mv.tipo === 'entrada' ? T.secondary : T.danger}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>📅 {mv.fecha}</span>
                      <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: mv.tipo === 'entrada' ? T.secondary : T.danger }}>
                      {mv.tipo === 'entrada' ? '+' : '-'}{fmtN(qty)} {unit}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.textDark, marginBottom: 4 }}>{mv.producto}</div>
                  {mv.entidad && <div style={{ fontSize: 13, color: T.textMid, marginBottom: 4 }}>👤 {mv.entidad}</div>}
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
                    {mv.bultos > 0 && (
                      <span><b>Bultos:</b> {mv.bultos.toLocaleString()}{mv.esPorUnidad && mv.tipo === 'salida' && cantPorCajaMap[mv.canonId] > 1 ? ` ×${cantPorCajaMap[mv.canonId]}` : ''}</span>
                    )}
                    <span><b>Stock:</b> <span style={{ color: sColor, fontWeight: 700 }}>{fmtN(mv.stockBodega)} {unit}</span></span>
                    {mv.felAuth && <span style={{ fontSize: 11, color: T.info, fontFamily: 'monospace' }}>{mv.felAuth.slice(0, 16)}…</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Canal', 'Producto', 'Entidad / Cliente', 'Bultos / Cajas', 'Cantidad', 'Stock Bodega', 'Documento'].map(h => (
                    <th key={h} style={{ color: T.white, padding: '9px 12px', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtMvs.slice(0, 400).map((mv, i) => {
                  const badge  = canalBadge(mv.canal);
                  const sColor = mv.stockBodega >= 0 ? T.secondary : T.danger;
                  const qty    = mv.esPorUnidad ? mv.unid : mv.lbs;
                  const unit   = mv.esPorUnidad ? 'unid' : 'lbs';
                  return (
                    <tr key={`${mv.docId}-${mv.canonId}-${i}`} style={{ background: i % 2 === 1 ? '#F9FBF9' : '#fff' }}>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', color: T.textMid, fontWeight: 600, whiteSpace: 'nowrap' }}>{mv.fecha}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '.68rem', fontWeight: 700, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600, color: T.textDark }}>{mv.producto}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', color: T.textMid }}>{mv.entidad}</td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', textAlign: 'right', color: T.textDark }}>
                        {mv.bultos > 0 ? (
                          <span>
                            {mv.bultos.toLocaleString()}
                            {mv.esPorUnidad && mv.tipo === 'salida' && cantPorCajaMap[mv.canonId] > 1 && (
                              <span style={{ fontSize: '.68rem', color: T.textMid, marginLeft: 4 }}>
                                ×{cantPorCajaMap[mv.canonId]}
                              </span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: mv.tipo === 'entrada' ? T.secondary : T.danger, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {mv.tipo === 'entrada' ? '+' : '-'}{fmtN(qty)} {unit}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: sColor, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {fmtN(mv.stockBodega)} {unit}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '.75rem', borderBottom: '1px solid #F0F0F0', color: T.info, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mv.felAuth
                          ? <span title={mv.felAuth} style={{ fontFamily: 'monospace' }}>{mv.felAuth.slice(0, 16)}{mv.felAuth.length > 16 ? '…' : ''}</span>
                          : <span style={{ color: T.border }}>—</span>}
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
