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
  const totalLbs      = (p.cajasProyectadas || 0) * (p.lbsPorCaja || 0) * (p.frecuencia || 1);
  const totalLbsReales = (p.cajasReales || 0) * (p.lbsPorCaja || 0) * (p.frecuencia || 1);
  const margenPct     = base.precioVenta > 0 ? (libre / base.precioVenta) * 100 : 0;
  return { libre, neto, ivaRet, descuento, totalLbs, totalLbsReales,
    totalSemana: libre * totalLbs, totalSemanaReal: libre * totalLbsReales, margenPct };
}

// ── Hook principal ────────────────────────────────────────────────
export function useProyeccion() {
  const [proyeccion,   setProyeccion]   = useState(null);
  const [historial,    setHistorial]    = useState([]);
  const [productosDB,  setProductosDB]  = useState([]);
  const [gastosFijos,  setGastosFijos]  = useState([]);
  const [loading,      setLoading]      = useState(false);

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
        setProyeccion({ semana, lunes: r.lunes, domingo: r.domingo, productos: [], estado: 'activa' });
      }
    } finally { setLoading(false); }
  }, []);

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
      cajasReales: reales[p.productoId] ?? 0,
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
        creadoEn: new Date().toISOString(),
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

  return { proyeccion, historial, loading, productosDB, fijosSemanal,
    cargar, guardar, cerrarSemana, cargarHistorial, setProyeccion };
}
