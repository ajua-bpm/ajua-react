import { createContext, useContext, useState, useEffect } from 'react';
import { db, doc, getDoc } from '../firebase';
import { useCollection } from './useFirestore';

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
  const { data, loading } = useCollection('empleados', { orderField: 'nombre', limit: 500 });
  const activos = (data || []).filter(e => e.estado !== 'inactivo' && e.activo !== false);
  return { empleados: activos, loading };
}

export function useClientes() {
  // Read from iclientes collection (migrated from DB.clientes)
  const { data, loading } = useCollection('iclientes', { orderField: 'nombre', limit: 500 });
  return { clientes: data, loading };
}

export function useConductores() {
  // Conductores: empleados con cargo/area/asignacion que incluya "transporte" o "piloto"
  const { data, loading } = useCollection('empleados', { orderField: 'nombre', limit: 500 });
  const conductores = (data || []).filter(e => {
    if (e.estado === 'inactivo' || e.activo === false) return false;
    const campos = [e.cargo, e.area, e.asignacion, e.puesto, e.modulo].join(' ').toLowerCase();
    return campos.includes('transporte') || campos.includes('piloto') || campos.includes('conductor');
  });
  return { conductores, loading };
}

export function useProductosCatalogo() {
  // Read from iProductos collection (same source as Cotizador Productos tab)
  const { data, loading } = useCollection('iProductos', { orderField: 'nombre', limit: 500 });
  return { productos: data, loading };
}

export function useProveedores() {
  const { data, loading } = useMainData();
  const proveedores = (data.proveedores || []).filter(p => p && (p.nombre || p.razonSocial));
  return { proveedores, loading };
}
