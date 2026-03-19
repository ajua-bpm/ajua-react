import { createContext, useContext, useState, useEffect } from 'react';
import { db, doc, getDoc } from '../firebase';

const MainDataCtx = createContext(null);

/**
 * Reads ajua_bpm/main ONCE and caches globally.
 * Provides catalog arrays: empleados, clientes, conductores, iProductos, proveedores
 * NEVER writes to ajua_bpm/main
 */
export function MainDataProvider({ children }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, 'ajua_bpm', 'main'))
      .then(snap => setData(snap.exists() ? snap.data() : {}))
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MainDataCtx.Provider value={{ data, loading }}>
      {children}
    </MainDataCtx.Provider>
  );
}

export function useMainData() {
  return useContext(MainDataCtx) || { data: {}, loading: false };
}

export function useEmpleados() {
  const { data, loading } = useMainData();
  return { empleados: (data?.empleados || []).filter(e => e.activo !== false), loading };
}

export function useClientes() {
  const { data, loading } = useMainData();
  return { clientes: data?.clientes || [], loading };
}

export function useConductores() {
  const { data, loading } = useMainData();
  return { conductores: data?.conductores || [], loading };
}

export function useProductosCatalogo() {
  const { data, loading } = useMainData();
  return { productos: data?.iProductos || [], loading };
}
