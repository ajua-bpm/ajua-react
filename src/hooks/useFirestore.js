import { useState, useEffect, useCallback } from 'react';
import { db, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot } from '../firebase';

/**
 * Lee una colección entera (sin paginación) con listener en tiempo real.
 * Cada módulo usa su propia colección: 'al', 'tl', 'dt', 'bas', 'rod', 'fum', etc.
 */
export function useCollection(colName, opts = {}) {
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (!colName) return;
    setLoading(true);

    const constraints = [];
    if (opts.orderField) constraints.push(orderBy(opts.orderField, opts.orderDir || 'desc'));
    if (opts.limit)      constraints.push(limit(opts.limit));

    const q = constraints.length
      ? query(collection(db, colName), ...constraints)
      : collection(db, colName);

    const unsub = onSnapshot(q,
      snap => {
        setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      err => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [colName]);

  return { data, loading, error };
}

/**
 * Lee un documento único (ej: ajua_bpm/main para datos legacy)
 */
export function useDocument(colName, docId) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (!colName || !docId) return;
    const ref = doc(db, colName, docId);
    const unsub = onSnapshot(ref,
      snap => {
        setData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      err => { setError(err.message); setLoading(false); }
    );
    return unsub;
  }, [colName, docId]);

  return { data, loading, error };
}

/**
 * Operaciones de escritura
 */
export function useWrite(colName) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const add = useCallback(async (data) => {
    setSaving(true); setError(null);
    try {
      const ref = await addDoc(collection(db, colName), { ...data, _ts: new Date().toISOString() });
      return ref.id;
    } catch (e) { setError(e.message); throw e; }
    finally { setSaving(false); }
  }, [colName]);

  const update = useCallback(async (id, data) => {
    setSaving(true); setError(null);
    try { await updateDoc(doc(db, colName, id), data); }
    catch (e) { setError(e.message); throw e; }
    finally { setSaving(false); }
  }, [colName]);

  const remove = useCallback(async (id) => {
    setSaving(true); setError(null);
    try { await deleteDoc(doc(db, colName, id)); }
    catch (e) { setError(e.message); throw e; }
    finally { setSaving(false); }
  }, [colName]);

  return { add, update, remove, saving, error };
}
