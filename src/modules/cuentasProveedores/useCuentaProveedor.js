// useCuentaProveedor.js — lógica Firebase con getDocs (fetch manual)
import { useState, useCallback } from 'react';
import { db, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from '../../firebase';
import { arrayUnion } from 'firebase/firestore';

export function useCuentaProveedor(proveedorId) {
  const [movimientos, setMovimientos] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  const cargar = useCallback(async (desde, hasta) => {
    if (!proveedorId) return;
    setLoading(true);
    setError(null);
    try {
      // Sin orderBy para evitar índice compuesto en Firestore — se ordena en cliente
      const q = query(
        collection(db, 'cuentasProveedores'),
        where('proveedorId', '==', proveedorId)
      );
      const snap = await getDocs(q);
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Ordenar por fecha ascendente en cliente
      docs.sort((a, b) => (a.fecha || '') > (b.fecha || '') ? 1 : -1);
      if (desde) docs = docs.filter(m => (m.fecha || '') >= desde);
      if (hasta) docs = docs.filter(m => (m.fecha || '') <= hasta);
      setMovimientos(docs);
    } catch (e) {
      console.error('useCuentaProveedor.cargar:', e);
      setError(e.message || 'Error al cargar movimientos');
    }
    setLoading(false);
  }, [proveedorId]);

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

  // Cálculos del estado de cuenta
  const resumen = movimientos.reduce((acc, m) => {
    if (m.tipo === 'recepcion') acc.comprado  += Number(m.totalBruto   || 0);
    if (m.tipo === 'rechazo')   acc.rechazos  += Number(m.valorRechazo || 0);
    if (m.tipo === 'pago')      acc.pagado    += Number(m.monto        || 0);
    return acc;
  }, { comprado: 0, rechazos: 0, pagado: 0 });
  resumen.saldo = resumen.comprado - resumen.rechazos - resumen.pagado;

  // Saldo acumulado por movimiento
  const movimientosConSaldo = movimientos.reduce((acc, m) => {
    const prev  = acc.length > 0 ? acc[acc.length - 1].saldoAcum : 0;
    const cargo = m.tipo === 'recepcion' ? Number(m.totalBruto || 0) : 0;
    const abono = m.tipo === 'pago'      ? Number(m.monto       || 0)
                : m.tipo === 'rechazo'   ? Number(m.valorRechazo|| 0) : 0;
    acc.push({ ...m, cargo, abono, saldoAcum: prev + cargo - abono });
    return acc;
  }, []);

  return { movimientos: movimientosConSaldo, resumen, loading, saving, error, cargar, agregar, actualizar, eliminar };
}

export function useProveedoresList() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'proveedores'));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
      setProveedores(lista);
    } catch { setProveedores([]); }
    setLoading(false);
  }, []);

  return { proveedores, loading, cargar };
}
