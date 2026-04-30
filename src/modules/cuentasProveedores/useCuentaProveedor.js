// useCuentaProveedor.js — lógica Firebase con onSnapshot (listener en tiempo real)
import { useState, useEffect, useCallback } from 'react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot } from '../../firebase';
import { arrayUnion } from 'firebase/firestore';

// Reorder: linked items (rechazos/pagos with recepcionId) follow their parent recepción immediately
function reorderWithChildren(docs) {
  const childrenMap = {};
  const roots = [];
  docs.forEach(d => {
    // Solo rechazos se muestran como sub-filas; pagos siempre son filas independientes
    if (d.tipo === 'rechazo' && d.recepcionId) {
      if (!childrenMap[d.recepcionId]) childrenMap[d.recepcionId] = [];
      childrenMap[d.recepcionId].push({ ...d, _isChild: true });
    } else {
      roots.push(d);
    }
  });
  const usedParents = new Set();
  const result = [];
  roots.forEach(d => {
    result.push(d);
    (childrenMap[d.id] || []).forEach(c => result.push(c));
    if (childrenMap[d.id]?.length) usedParents.add(d.id);
  });
  // orphan children (parent filtered out) — append at end
  Object.entries(childrenMap).forEach(([parentId, children]) => {
    if (!usedParents.has(parentId)) children.forEach(c => result.push(c));
  });
  return result;
}

export function useCuentaProveedor(proveedorId) {
  const [movimientos, setMovimientos] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  // filtros de fecha — controlados desde afuera via cargar()
  const [filtros, setFiltros] = useState({ desde: null, hasta: null });

  // Listener en tiempo real filtrado por proveedorId (sin orderBy → sin índice compuesto)
  useEffect(() => {
    if (!proveedorId) { setMovimientos([]); return; }
    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'cuentasProveedores'),
      where('proveedorId', '==', proveedorId)
    );

    const unsub = onSnapshot(q,
      snap => {
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Ordenar: fecha ASC → dentro de la misma fecha, creadoEn ASC
        // Así los registros ingresados con fecha pasada van al final de esa fecha
        docs.sort((a, b) => {
          const fa = a.fecha || '', fb = b.fecha || '';
          if (fa !== fb) return fa > fb ? 1 : -1;
          return (a.creadoEn || '') > (b.creadoEn || '') ? 1 : -1;
        });
        // Aplicar filtros de fecha (solo a raíces — los hijos siguen a su padre)
        if (filtros.desde) docs = docs.filter(m => m.recepcionId || (m.fecha || '') >= filtros.desde);
        if (filtros.hasta) docs = docs.filter(m => m.recepcionId || (m.fecha || '') <= filtros.hasta);
        // Reagrupar: hijos inmediatamente después de su padre
        docs = reorderWithChildren(docs);
        setMovimientos(docs);
        setLoading(false);
      },
      err => {
        console.error('useCuentaProveedor:', err.message);
        setError(err.message || 'Error al cargar movimientos');
        setLoading(false);
      }
    );

    return unsub;
  }, [proveedorId, filtros.desde, filtros.hasta]);

  // cargar() ahora solo actualiza los filtros de fecha — el listener se re-activa
  const cargar = useCallback((desde, hasta) => {
    setFiltros({ desde: desde || null, hasta: hasta || null });
  }, []);

  const agregar = useCallback(async (data) => {
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, 'cuentasProveedores'), {
        ...data,
        creadoEn: new Date().toISOString(),
      });
      return ref.id;
    } finally { setSaving(false); }
  }, []);

  // actualizar — actualiza campos y agrega entrada de auditoría con arrayUnion
  const actualizar = useCallback(async (id, data, auditEntry) => {
    setSaving(true);
    try {
      const payload = {
        ...data,
        ultimaEdicion: new Date().toISOString(),
      };
      if (auditEntry) {
        payload.historialEdiciones = arrayUnion({ ...auditEntry, ts: new Date().toISOString() });
      }
      await updateDoc(doc(db, 'cuentasProveedores', id), payload);
    } finally { setSaving(false); }
  }, []);

  const eliminar = useCallback(async (id) => {
    await deleteDoc(doc(db, 'cuentasProveedores', id));
  }, []);

  // Linked rechazos por recepción (solo _isChild)
  const linkedRejMap = {};
  movimientos.forEach(m => {
    if (m.tipo === 'rechazo' && m._isChild) {
      if (!linkedRejMap[m.recepcionId]) linkedRejMap[m.recepcionId] = { totalQty: 0, totalMoney: 0 };
      linkedRejMap[m.recepcionId].totalQty  += Number(m.cantidadRechazada || 0);
      linkedRejMap[m.recepcionId].totalMoney += Number(m.valorRechazo     || 0);
    }
  });

  // Cargo por recepción:
  // — Si tiene liquidacionId → totalBruto ya fue actualizado por la liquidación, usarlo directo
  // — Si no → qty_neta × precioUnit − valorRechazo_dinero
  const movimientosConSaldo = movimientos.reduce((acc, m) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].saldoAcum : 0;
    let cargo = 0, abono = 0;
    if (m.tipo === 'recepcion') {
      if (m.liquidacionId) {
        cargo = Number(m.totalBruto || 0);
      } else {
        const rej = linkedRejMap[m.id] || { totalQty: 0, totalMoney: 0 };
        const qty   = Number(m.cantidad  || 0);
        const bruto = Number(m.totalBruto || 0);
        const pu    = Number(m.precioUnit || 0) || (qty > 0 ? bruto / qty : 0);
        const qtyNeta   = Math.max(0, qty - rej.totalQty);
        const valorBase = pu > 0 ? qtyNeta * pu : bruto;
        cargo = Math.max(0, valorBase - rej.totalMoney);
      }
    } else if (m.tipo === 'pago') {
      abono = Number(m.monto || 0);
    } else if (m.tipo === 'rechazo' && !m._isChild) {
      abono = Number(m.valorRechazo || 0);
    }
    acc.push({ ...m, cargo, abono, saldoAcum: prev + cargo - abono });
    return acc;
  }, []);

  // Resumen coherente con los cargos/abonos ya calculados
  const resumen = { comprado: 0, rechazos: 0, pagado: 0 };
  movimientosConSaldo.forEach(m => {
    if (m.tipo === 'recepcion')                      resumen.comprado += m.cargo || 0;
    if (m.tipo === 'pago')                           resumen.pagado   += m.abono || 0;
    if (m.tipo === 'rechazo' && !m._isChild)         resumen.rechazos += m.abono || 0;
  });
  resumen.saldo = resumen.comprado - resumen.rechazos - resumen.pagado;

  return { movimientos: movimientosConSaldo, resumen, loading, saving, error, cargar, agregar, actualizar, eliminar };
}

export function useProveedoresList() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'proveedores'),
      snap => {
        const lista = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        setProveedores(lista);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  // cargar() mantenido para compatibilidad con código existente (ya no hace nada)
  const cargar = useCallback(() => {}, []);

  return { proveedores, loading, cargar };
}
