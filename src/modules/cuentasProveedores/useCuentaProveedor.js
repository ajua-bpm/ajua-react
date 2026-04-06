// useCuentaProveedor.js — lógica Firebase con onSnapshot (listener en tiempo real)
import { useState, useEffect, useCallback } from 'react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot } from '../../firebase';
import { arrayUnion } from 'firebase/firestore';

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
        // Ordenar por fecha ascendente en cliente
        docs.sort((a, b) => (a.fecha || '') > (b.fecha || '') ? 1 : -1);
        // Aplicar filtros de fecha si están activos
        if (filtros.desde) docs = docs.filter(m => (m.fecha || '') >= filtros.desde);
        if (filtros.hasta) docs = docs.filter(m => (m.fecha || '') <= filtros.hasta);
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
