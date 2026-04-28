import { useCallback, useState } from 'react';
import { db, collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where } from '../../firebase';

// ── Categorías ─────────────────────────────────────────────────────
export const CATEGORIAS = [
  { id: 'venta_walmart',         label: 'Venta Walmart',          color: '#16a34a', tipo: 'ingreso'  },
  { id: 'venta_cliente',         label: 'Venta otro cliente',     color: '#15803d', tipo: 'ingreso'  },
  { id: 'recuperacion',          label: 'Recuperación/abono',     color: '#166534', tipo: 'ingreso'  },
  { id: 'compra_importacion',    label: 'Compra importación',     color: '#2563eb', tipo: 'costo'    },
  { id: 'compra_local',          label: 'Compra local',           color: '#1d4ed8', tipo: 'costo'    },
  { id: 'flete_logistica',       label: 'Flete/logística',        color: '#1e40af', tipo: 'costo'    },
  { id: 'renta_bodega',          label: 'Renta bodega',           color: '#d97706', tipo: 'fijo'     },
  { id: 'transporte_fijo',       label: 'Transporte fijo',        color: '#b45309', tipo: 'fijo'     },
  { id: 'luz_servicios',         label: 'Luz/servicios',          color: '#92400e', tipo: 'fijo'     },
  { id: 'empleado_fijo',         label: 'Empleado fijo',          color: '#78350f', tipo: 'fijo'     },
  { id: 'personal_dia',          label: 'Personal día',           color: '#dc2626', tipo: 'variable' },
  { id: 'combustible',           label: 'Combustible',            color: '#b91c1c', tipo: 'variable' },
  { id: 'maquila_equipo',        label: 'Maquila/equipo',         color: '#991b1b', tipo: 'variable' },
  { id: 'material_empaque',      label: 'Material empaque',       color: '#7f1d1d', tipo: 'variable' },
  { id: 'alimentos',             label: 'Alimentos personal',     color: '#ef4444', tipo: 'variable' },
  { id: 'comision_venta',        label: 'Comisión venta',         color: '#f87171', tipo: 'variable' },
  { id: 'comision_compra',       label: 'Comisión compra',        color: '#fca5a5', tipo: 'variable' },
  { id: 'transferencia_interna', label: 'Transferencia interna',  color: '#6b7280', tipo: 'neutro'   },
  { id: 'ajuste',                label: 'Ajuste/corrección',      color: '#9ca3af', tipo: 'neutro'   },
  { id: 'ignorar',               label: 'Ignorar',                color: '#d1d5db', tipo: 'neutro'   },
];

export const CATEGORIAS_MAP = Object.fromEntries(CATEGORIAS.map(c => [c.id, c]));
export const TOP_CATS = ['personal_dia', 'alimentos', 'combustible', 'compra_local', 'venta_walmart', 'transferencia_interna'];

// ── Hook movimientos banco ─────────────────────────────────────────
export function useMovimientosBanco() {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async (desde, hasta) => {
    setLoading(true);
    try {
      let q = query(collection(db, 'movimientosBanco'));
      if (desde) q = query(collection(db, 'movimientosBanco'), where('fecha', '>=', desde));
      const snap = await getDocs(q);
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (hasta) docs = docs.filter(d => (d.fecha || '') <= hasta);
      docs.sort((a, b) => (a.fecha > b.fecha ? -1 : 1));
      setData(docs);
    } finally { setLoading(false); }
  }, []);

  const clasificar = useCallback(async (id, categoria, notas) => {
    await updateDoc(doc(db, 'movimientosBanco', id), { categoria, notas: notas || '', clasificado: true });
    setData(prev => prev.map(d => d.id === id ? { ...d, categoria, notas: notas || '', clasificado: true } : d));
  }, []);

  const importar = useCallback(async (movimientos) => {
    const existentes = (await getDocs(collection(db, 'movimientosBanco'))).docs.map(d => d.data());
    const dupKey = m => `${m.banco}|${m.referencia}|${m.fecha}`;
    const keys = new Set(existentes.map(dupKey));
    const nuevos = movimientos.filter(m => !keys.has(dupKey(m)));
    for (const m of nuevos) await addDoc(collection(db, 'movimientosBanco'), { ...m, clasificado: false, importadoEn: new Date().toISOString() });
    return { total: movimientos.length, importados: nuevos.length, duplicados: movimientos.length - nuevos.length };
  }, []);

  return { data, loading, cargar, clasificar, importar };
}

// ── Hook facturas FEL ──────────────────────────────────────────────
export function useFacturasFEL() {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async (desde, hasta) => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'facturasFEL'));
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (desde) docs = docs.filter(d => (d.fecha || '') >= desde);
      if (hasta) docs = docs.filter(d => (d.fecha || '') <= hasta);
      setData(docs);
    } finally { setLoading(false); }
  }, []);

  const importar = useCallback(async (facturas) => {
    const existentes = new Set((await getDocs(collection(db, 'facturasFEL'))).docs.map(d => d.data().uuid));
    const nuevas = facturas.filter(f => !existentes.has(f.uuid));
    for (const f of nuevas) await addDoc(collection(db, 'facturasFEL'), { ...f, importadoEn: new Date().toISOString() });
    return { total: facturas.length, importadas: nuevas.length, duplicadas: facturas.length - nuevas.length };
  }, []);

  return { data, loading, cargar, importar };
}

// ── Hook productos (análisis de margen) ───────────────────────────
export function useProductosMargen() {
  const [productos, setProductos] = useState([]);
  const [ventas,    setVentas]    = useState([]);
  const [loading,   setLoading]   = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [pSnap, vSnap] = await Promise.all([
        getDocs(collection(db, 'productosMargen')),
        getDocs(collection(db, 'ventasSemanales')),
      ]);
      setProductos(pSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>((a.orden||0)-(b.orden||0))));
      setVentas(vSnap.docs.map(d=>({id:d.id,...d.data()})));
    } finally { setLoading(false); }
  }, []);

  const guardarProducto = useCallback(async (item) => {
    if (item.id) {
      await updateDoc(doc(db,'productosMargen',item.id), item);
      setProductos(prev=>prev.map(p=>p.id===item.id?{...p,...item}:p));
    } else {
      const ref = await addDoc(collection(db,'productosMargen'),{...item,creadoEn:new Date().toISOString()});
      setProductos(prev=>[...prev,{id:ref.id,...item}]);
    }
  }, []);

  const eliminarProducto = useCallback(async (id) => {
    await deleteDoc(doc(db,'productosMargen',id));
    setProductos(prev=>prev.filter(p=>p.id!==id));
  }, []);

  const guardarVenta = useCallback(async (semana, productoId, lbs, cajas) => {
    const existe = ventas.find(v=>v.semana===semana&&v.productoId===productoId);
    if (existe) {
      await updateDoc(doc(db,'ventasSemanales',existe.id),{lbs,cajas,actualizadoEn:new Date().toISOString()});
      setVentas(prev=>prev.map(v=>v.id===existe.id?{...v,lbs,cajas}:v));
    } else {
      const ref = await addDoc(collection(db,'ventasSemanales'),{semana,productoId,lbs,cajas,registradoEn:new Date().toISOString()});
      setVentas(prev=>[...prev,{id:ref.id,semana,productoId,lbs,cajas}]);
    }
  }, [ventas]);

  // Calcular libre_lb para un producto
  const calcLibre = (p) => {
    const iva        = (p.precioVenta||0) / 1.12 * 0.12;
    const ivaRet     = iva * ((p.ivaRetPct||0) / 100);
    const descuento  = (p.precioVenta||0) * ((p.descuentoPct||0) / 100);
    const neto       = (p.precioVenta||0) - ivaRet - descuento;
    return { neto, libre: neto - (p.costo||0), ivaRet, descuento };
  };

  return { productos, ventas, loading, cargar, guardarProducto, eliminarProducto, guardarVenta, calcLibre };
}

// ── Hook gastos fijos configurados ─────────────────────────────────
export function useGastosFijos() {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'gastosFijosConfig'));
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>(a.concepto||'').localeCompare(b.concepto||'')));
    } finally { setLoading(false); }
  }, []);

  const agregar = useCallback(async (item) => {
    const ref = await addDoc(collection(db, 'gastosFijosConfig'), { ...item, creadoEn: new Date().toISOString() });
    const nuevo = { id: ref.id, ...item };
    setData(prev => [...prev, nuevo].sort((a,b)=>(a.concepto||'').localeCompare(b.concepto||'')));
  }, []);

  const actualizar = useCallback(async (id, item) => {
    await updateDoc(doc(db, 'gastosFijosConfig', id), item);
    setData(prev => prev.map(d => d.id === id ? { ...d, ...item } : d));
  }, []);

  const eliminar = useCallback(async (id) => {
    await deleteDoc(doc(db, 'gastosFijosConfig', id));
    setData(prev => prev.filter(d => d.id !== id));
  }, []);

  // Total mensual: mensual=monto, quincenal=monto×2
  const totalMensual = data.filter(d=>d.activo!==false).reduce((s,d) =>
    s + (d.frecuencia === 'quincenal' ? (d.monto||0)*2 : (d.monto||0)), 0);

  return { data, loading, cargar, agregar, actualizar, eliminar, totalMensual };
}

// ── Cálculo P&L ────────────────────────────────────────────────────
export function calcPnL(movimientos, facturas, gastosFijosConfig = []) {
  const sumCat = (tipo) => CATEGORIAS.filter(c => c.tipo === tipo).reduce((s, c) => {
    return s + movimientos.filter(m => m.categoria === c.id && m.clasificado).reduce((a, m) => a + (m.debito || 0), 0);
  }, 0);

  const ingresosBanco = ['venta_walmart', 'venta_cliente', 'recuperacion'].reduce((s, cat) =>
    s + movimientos.filter(m => m.categoria === cat && m.clasificado).reduce((a, m) => a + (m.credito || 0), 0), 0);

  const felEmitidas  = facturas.filter(f => f.tipoFEL === 'emitida').reduce((s, f) => s + (f.montoNeto  || 0), 0);
  const notasCredito = facturas.filter(f => f.tipoFEL === 'emitida').reduce((s, f) => s + (f.notaCredito|| 0), 0);
  const ivaRetenido  = facturas.filter(f => f.tipoFEL === 'emitida').reduce((s, f) => s + (f.ivaRetenido|| 0), 0);

  const ingresoNeto    = ingresosBanco + felEmitidas;
  const costosProducto = sumCat('costo');
  const utilidadBruta  = ingresoNeto - costosProducto;
  const margenBruto    = ingresoNeto > 0 ? (utilidadBruta / ingresoNeto) * 100 : 0;

  // Gastos fijos: usar configurados si existen, si no usar movimientos clasificados
  const fijosConfig   = gastosFijosConfig.filter(d => d.activo !== false)
    .reduce((s, d) => s + (d.frecuencia === 'quincenal' ? (d.monto||0)*2 : (d.monto||0)), 0);
  const fijosBanco    = sumCat('fijo');
  const gastosFijos   = fijosConfig > 0 ? fijosConfig : fijosBanco;

  const gastosVariables = sumCat('variable');
  const utilidadNeta    = utilidadBruta - gastosFijos - gastosVariables;
  const margenNeto      = ingresoNeto > 0 ? (utilidadNeta / ingresoNeto) * 100 : 0;
  const puntoEquilibrio = margenBruto > 0 ? (gastosFijos / (margenBruto / 100)) : 0;
  const pctEq           = puntoEquilibrio > 0 ? Math.min(200, (ingresoNeto / puntoEquilibrio) * 100) : 0;
  const sinClasificar   = movimientos.filter(m => !m.clasificado).length;

  return { ingresosBanco, felEmitidas, notasCredito, ivaRetenido, ingresoNeto, costosProducto, utilidadBruta, margenBruto, gastosFijos, fijosConfig, fijosBanco, gastosVariables, utilidadNeta, margenNeto, puntoEquilibrio, pctEq, sinClasificar };
}
