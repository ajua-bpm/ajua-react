import { useState, useCallback, useRef } from 'react';
import { db, collection, getDocs, query, where } from '../firebase';

// Module-level cache: { data, ts }
let _cache = null;
const CACHE_TTL = 60_000; // 60 seconds

/**
 * Load pricing collections with in-memory cache.
 * Returns { precios: preciosCliente[], volumen: preciosVolumen[] }
 */
async function loadPricingData() {
  const now = Date.now();
  if (_cache && now - _cache.ts < CACHE_TTL) return _cache.data;

  const [preciosSnap, volumenSnap] = await Promise.all([
    getDocs(query(collection(db, 'preciosCliente'), where('activo', '==', true))),
    getDocs(query(collection(db, 'preciosVolumen'), where('activo', '==', true))),
  ]);

  const data = {
    precios: preciosSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    volumen: volumenSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };
  _cache = { data, ts: now };
  return data;
}

/**
 * getPrecio — pure pricing logic
 *
 * Priority:
 * 1. Volume price for specific client + quantity (highest tier that fits)
 * 2. Client-specific price (check vigenteDesde / vigenteHasta vs today)
 * 3. General volume price (clienteId null/undefined) + quantity
 * 4. Returns null → caller uses precioBase
 *
 * @param {string} presentacionId
 * @param {string|null} clienteId
 * @param {number} cantidad
 * @param {{ precios: object[], volumen: object[] }} data
 * @returns {{ precio: number, tipo: string } | null}
 */
export function getPrecio(presentacionId, clienteId, cantidad, { precios = [], volumen = [] }) {
  const today = new Date().toISOString().slice(0, 10);
  const qty = Number(cantidad) || 0;

  // 1. Volume price: specific client + quantity
  if (clienteId) {
    const clientVolTiers = volumen
      .filter(v =>
        v.presentacionId === presentacionId &&
        v.clienteId === clienteId &&
        Number(v.cantidadMinima) <= qty
      )
      .sort((a, b) => Number(b.cantidadMinima) - Number(a.cantidadMinima));
    if (clientVolTiers.length > 0) {
      return { precio: Number(clientVolTiers[0].precio), tipo: 'volumen-cliente' };
    }
  }

  // 2. Client-specific price with vigencia check
  if (clienteId) {
    const clientPrice = precios.find(p => {
      if (p.presentacionId !== presentacionId || p.clienteId !== clienteId) return false;
      if (p.vigenteDesde && today < p.vigenteDesde) return false;
      if (p.vigenteHasta && today > p.vigenteHasta) return false;
      return true;
    });
    if (clientPrice) {
      return { precio: Number(clientPrice.precio), tipo: 'cliente' };
    }
  }

  // 3. General volume price (no clienteId) + quantity
  const generalVolTiers = volumen
    .filter(v =>
      v.presentacionId === presentacionId &&
      !v.clienteId &&
      Number(v.cantidadMinima) <= qty
    )
    .sort((a, b) => Number(b.cantidadMinima) - Number(a.cantidadMinima));
  if (generalVolTiers.length > 0) {
    return { precio: Number(generalVolTiers[0].precio), tipo: 'volumen-general' };
  }

  // 4. No special price found
  return null;
}

/**
 * usePricingData — React hook
 * Returns loading state and resolve function that applies the full pricing logic.
 */
export function usePricingData() {
  const [loading, setLoading] = useState(false);
  const dataRef = useRef(null);

  const ensureData = useCallback(async () => {
    if (dataRef.current) return dataRef.current;
    setLoading(true);
    try {
      const d = await loadPricingData();
      dataRef.current = d;
      return d;
    } finally {
      setLoading(false);
    }
  }, []);

  const resolve = useCallback(async (presentacionId, clienteId, cantidad, precioBase) => {
    const data = await ensureData();
    const result = getPrecio(presentacionId, clienteId, cantidad, data);
    if (result) return result;
    return precioBase != null ? { precio: Number(precioBase), tipo: 'base' } : null;
  }, [ensureData]);

  const invalidateCache = useCallback(() => {
    _cache = null;
    dataRef.current = null;
  }, []);

  return { loading, resolve, invalidateCache };
}
