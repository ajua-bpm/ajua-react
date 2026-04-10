// useCuentaCliente.js — CxC: estado de cuenta por cliente (despachos locales)
import { useState, useEffect, useCallback } from 'react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot } from '../../firebase';
import { arrayUnion } from 'firebase/firestore';

export function useCuentaCliente(clienteId) {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [saving,  setSaving]          = useState(false);
  const [error,   setError]           = useState(null);
  const [filtros, setFiltros]         = useState({ desde: null, hasta: null });

  useEffect(() => {
    if (!clienteId) { setMovimientos([]); return; }
    setLoading(true); setError(null);

    const q = query(collection(db, 'cuentasClientes'), where('clienteId', '==', clienteId));
    const unsub = onSnapshot(q,
      snap => {
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (a.fecha || '') > (b.fecha || '') ? 1 : -1);
        if (filtros.desde) docs = docs.filter(m => (m.fecha || '') >= filtros.desde);
        if (filtros.hasta) docs = docs.filter(m => (m.fecha || '') <= filtros.hasta);
        setMovimientos(docs);
        setLoading(false);
      },
      err => { setError(err.message || 'Error'); setLoading(false); }
    );
    return unsub;
  }, [clienteId, filtros.desde, filtros.hasta]);

  const cargar = useCallback((desde, hasta) => {
    setFiltros({ desde: desde || null, hasta: hasta || null });
  }, []);

  const agregar = useCallback(async (data) => {
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, 'cuentasClientes'), {
        ...data, creadoEn: new Date().toISOString(),
      });
      return ref.id;
    } finally { setSaving(false); }
  }, []);

  const actualizar = useCallback(async (id, data, auditEntry) => {
    setSaving(true);
    try {
      const payload = { ...data, ultimaEdicion: new Date().toISOString() };
      if (auditEntry) payload.historialEdiciones = arrayUnion({ ...auditEntry, ts: new Date().toISOString() });
      await updateDoc(doc(db, 'cuentasClientes', id), payload);
    } finally { setSaving(false); }
  }, []);

  const eliminar = useCallback(async (id) => {
    await deleteDoc(doc(db, 'cuentasClientes', id));
  }, []);

  // Resumen: despacho = cargo, pago/nota_credito = abono
  const resumen = movimientos.reduce((acc, m) => {
    if (m.tipo === 'despacho')     acc.despachado  += Number(m.totalVenta  || 0);
    if (m.tipo === 'nota_credito') acc.notas        += Number(m.valor       || 0);
    if (m.tipo === 'pago')         acc.cobrado      += Number(m.monto       || 0);
    return acc;
  }, { despachado: 0, notas: 0, cobrado: 0 });
  resumen.saldo = resumen.despachado - resumen.notas - resumen.cobrado;

  // Saldo acumulado por movimiento
  const movimientosConSaldo = movimientos.reduce((acc, m) => {
    const prev  = acc.length > 0 ? acc[acc.length - 1].saldoAcum : 0;
    const cargo = m.tipo === 'despacho'     ? Number(m.totalVenta  || 0) : 0;
    const abono = m.tipo === 'pago'         ? Number(m.monto       || 0)
                : m.tipo === 'nota_credito' ? Number(m.valor       || 0) : 0;
    acc.push({ ...m, cargo, abono, saldoAcum: prev + cargo - abono });
    return acc;
  }, []);

  return { movimientos: movimientosConSaldo, resumen, loading, saving, error, cargar, agregar, actualizar, eliminar };
}

export function useClientesList() {
  const [clientes, setClientes] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'clientes'),
      snap => {
        const lista = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        setClientes(lista);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  return { clientes, loading };
}
