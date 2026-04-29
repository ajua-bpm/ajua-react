import { useCallback, useState } from 'react';
import { db, collection, doc, getDocs, addDoc, updateDoc, query, where } from '../../firebase';
import { calcLibreStd } from '../finanzas/useFinanzas';

export { calcLibreStd as calcLibre };

// ── Helpers semana ISO ─────────────────────────────────────────────
export function isoWeek(d = new Date()) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
  const y = dt.getUTCFullYear();
  const w = Math.ceil((((dt - new Date(Date.UTC(y, 0, 1))) / 86400000) + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

export function weekRange(semana) {
  const [y, w] = semana.split('-W').map(Number);
  const jan4   = new Date(Date.UTC(y, 0, 4));
  const mon    = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (w - 1) * 7);
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
  const fmt = d => d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  return { lunes: mon.toISOString().slice(0, 10), domingo: sun.toISOString().slice(0, 10), label: `${fmt(mon)} – ${fmt(sun)}` };
}

export function shiftWeek(semana, delta) {
  const { lunes } = weekRange(semana);
  const d = new Date(lunes + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return isoWeek(d);
}

// ── calcRow — cálculo completo de una fila ─────────────────────────
export function calcRow(p) {
  const base = { precioVenta: p.precioVenta, costo: p.costo, descuentoPct: p.descuentoPct, ivaRetPct: p.ivaRetPct };
  const { libre, neto, ivaRet, descuento } = calcLibreStd(base);
  const totalLbs       = (p.cajasProyectadas || 0) * (p.lbsPorCaja || 0) * (p.frecuencia || 1);
  const totalLbsReales = (p.cajasReales      || 0) * (p.lbsPorCaja || 0) * (p.frecuencia || 1);
  // Ingresos netos reales (lo que entra al banco) = lbs_vendidas × neto/lb
  const ingresosNetos  = totalLbsReales * neto;
  // Costo de lo COMPRADO (puede ser más de lo vendido)
  const lbsCompradas   = (p.cajasCompradas   || 0) * (p.lbsPorCaja || 0) * (p.frecuencia || 1);
  const costoCompras   = lbsCompradas * (p.costo || 0);
  const margenPct      = base.precioVenta > 0 ? (libre / base.precioVenta) * 100 : 0;
  return { libre, neto, ivaRet, descuento, totalLbs, totalLbsReales, lbsCompradas, costoCompras,
    totalSemana: libre * totalLbs, totalSemanaReal: libre * totalLbsReales,
    ingresosNetos, margenPct };
}

// ── Importar pedidos Walmart de la semana → productos sugeridos ────
export async function importarDesdePedidos(semana, productosDB) {
  const { lunes, domingo } = weekRange(semana);
  const snap = await getDocs(collection(db, 'pedidosWalmart'));
  const pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(p => (p.fechaEntrega || '') >= lunes && (p.fechaEntrega || '') <= domingo);

  // Agrupar rubros por productoId
  const grouped = {};
  pedidos.forEach(pedido => {
    (pedido.rubros || []).forEach(r => {
      const pid = r.productoId || r.descripcion || r.desc || '';
      if (!pid) return;
      if (!grouped[pid]) {
        grouped[pid] = { productoId: r.productoId || '', nombre: r.productoNombre || r.descripcion || pid, cajasLista: [], entregas: 0 };
      }
      grouped[pid].cajasLista.push(r.cajas || r.cajasPedidas || 0);
      grouped[pid].entregas++;
    });
  });

  // Construir filas de proyección
  return Object.values(grouped).map(g => {
    const base = productosDB.find(p => p.id === g.productoId) || {};
    // Cajas por entrega = promedio (si varían) o la constante
    const cajasSet = [...new Set(g.cajasLista)];
    const cajasProyectadas = cajasSet.length === 1 ? cajasSet[0] : Math.round(g.cajasLista.reduce((a, b) => a + b, 0) / g.cajasLista.length);
    return {
      productoId:       g.productoId || g.nombre,
      nombre:           base.nombre  || g.nombre,
      cajasProyectadas,
      cajasCompradas:   cajasProyectadas, // por defecto = lo que compraste para entregar
      lbsPorCaja:       base.lbsPorCaja || 20,
      frecuencia:       g.entregas,
    };
  });
}

// ── Hook principal ────────────────────────────────────────────────
export function useProyeccion() {
  const [proyeccion,   setProyeccion]   = useState(null);
  const [historial,    setHistorial]    = useState([]);
  const [productosDB,  setProductosDB]  = useState([]);
  const [gastosFijos,  setGastosFijos]  = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [importing,    setImporting]    = useState(false);

  const cargar = useCallback(async (semana) => {
    setLoading(true);
    try {
      const [pSnap, fSnap, qSnap] = await Promise.all([
        getDocs(collection(db, 'productosMargen')),
        getDocs(collection(db, 'gastosFijosConfig')),
        getDocs(query(collection(db, 'proyeccionesSemana'), where('semana', '==', semana))),
      ]);
      const prods = pSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.activo !== false);
      setProductosDB(prods);
      setGastosFijos(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (!qSnap.empty) {
        setProyeccion({ id: qSnap.docs[0].id, ...qSnap.docs[0].data() });
      } else {
        const r = weekRange(semana);
        setProyeccion({ semana, lunes: r.lunes, domingo: r.domingo, productos: [], estado: 'activa', comprasSemana: 0 });
      }
    } finally { setLoading(false); }
  }, []);

  const importarWalmart = useCallback(async (semana) => {
    setImporting(true);
    try {
      const sugeridos = await importarDesdePedidos(semana, productosDB);
      if (!sugeridos.length) return 0;
      setProyeccion(prev => {
        const existingIds = new Set((prev.productos || []).map(p => p.productoId));
        const nuevos = sugeridos.filter(s => !existingIds.has(s.productoId));
        // Actualizar cajas de los que ya existen
        const actualizados = (prev.productos || []).map(p => {
          const match = sugeridos.find(s => s.productoId === p.productoId);
          return match ? { ...p, cajasProyectadas: match.cajasProyectadas, frecuencia: match.frecuencia } : p;
        });
        return { ...prev, productos: [...actualizados, ...nuevos] };
      });
      return sugeridos.length;
    } finally { setImporting(false); }
  }, [productosDB]);

  const guardar = useCallback(async (proy) => {
    const { id, ...data } = proy;
    if (id) {
      await updateDoc(doc(db, 'proyeccionesSemana', id), data);
      setProyeccion(proy);
    } else {
      const ref = await addDoc(collection(db, 'proyeccionesSemana'), { ...data, creadoEn: new Date().toISOString() });
      setProyeccion({ id: ref.id, ...data });
    }
  }, []);

  const cerrarSemana = useCallback(async (proy, reales) => {
    const productosConReal = proy.productos.map(p => ({
      ...p,
      cajasReales:    reales[p.productoId]?.vendidas  ?? 0,
      cajasCompradas: reales[p.productoId]?.compradas ?? p.cajasCompradas ?? p.cajasProyectadas ?? 0,
    }));
    const cerrada = { ...proy, productos: productosConReal, estado: 'cerrada', cerradoEn: new Date().toISOString() };
    await guardar(cerrada);
    const sig   = shiftWeek(proy.semana, 1);
    const range = weekRange(sig);
    const existing = await getDocs(query(collection(db, 'proyeccionesSemana'), where('semana', '==', sig)));
    if (existing.empty) {
      await addDoc(collection(db, 'proyeccionesSemana'), {
        semana: sig, lunes: range.lunes, domingo: range.domingo, estado: 'activa',
        productos: proy.productos.map(({ cajasReales, ...rest }) => rest),
        comprasSemana: 0, creadoEn: new Date().toISOString(),
      });
    }
    setProyeccion(cerrada);
  }, [guardar]);

  const cargarHistorial = useCallback(async () => {
    const snap = await getDocs(collection(db, 'proyeccionesSemana'));
    setHistorial(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.semana.localeCompare(a.semana)));
  }, []);

  const fijosSemanal = gastosFijos.filter(d => d.activo !== false)
    .reduce((s, d) => s + (d.frecuencia === 'quincenal' ? (d.monto || 0) * 2 : (d.monto || 0)), 0) / 4.33;

  return { proyeccion, historial, loading, importing, productosDB, fijosSemanal,
    cargar, guardar, cerrarSemana, cargarHistorial, importarWalmart, setProyeccion };
}
