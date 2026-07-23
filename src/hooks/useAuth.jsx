import { useState, useEffect, createContext, useContext } from 'react';
import { db, doc, getDoc } from '../firebase';

// Simple auth: usuarios guardados en DB.usuarios en ajua_bpm/main
// (sin Firebase Auth por ahora — compatible con sistema existente)

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('ajua_user');
    if (saved) { try { setUser(JSON.parse(saved)); } catch(e) {} }
    setLoading(false);
  }, []);

  const login = async (usuario, password) => {
    // Superadmin hardcodeado — recuperación de emergencia, siempre disponible
    if (usuario === 'admin' && password === 'ajua2024') {
      const u = { id: 'admin', nombre: 'Administrador', rol: 'superadmin', usuario: 'admin' };
      setUser(u);
      localStorage.setItem('ajua_user', JSON.stringify(u));
      return u;
    }
    // Buscar en DB.usuarios de Firestore
    try {
      const snap = await getDoc(doc(db, 'ajua_bpm', 'main'));
      const usuarios = snap.exists() ? (snap.data().usuarios || []) : [];
      const found = usuarios.find(u =>
        (u.usuario === usuario || u.email === usuario) && u.pass === password
      );
      if (!found) return null;
      const u = { id: found.id, nombre: found.nombre, rol: found.rol || 'operario', usuario: found.usuario, modulos: found.modulos || [] };
      setUser(u);
      localStorage.setItem('ajua_user', JSON.stringify(u));
      return u;
    } catch(e) {
      throw new Error('Error de conexión con Firebase');
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ajua_user');
  };

  const isAdmin = (u) => {
    const r = (u || user)?.rol;
    return r === 'admin' || r === 'superadmin';
  };

  // ─── Permisos granulares del módulo Finanzas ────────────────────
  // Aditivo: no reemplaza rol/modulos. Devuelve un objeto con todos
  // los permisos posibles. Fallback inteligente para no romper usuarios
  // existentes que aún no tienen el campo permisos_finanzas.
  const getFinanzasPerms = (u) => {
    const target = u || user;
    if (!target) return DEFAULT_PERMS_NO_ACCESS;
    // Admin/superadmin: todo automático
    if (target.rol === 'admin' || target.rol === 'superadmin') {
      return DEFAULT_PERMS_ADMIN;
    }
    // Si tiene permisos_finanzas explícito, usarlos
    if (target.permisos_finanzas && typeof target.permisos_finanzas === 'object') {
      return { ...DEFAULT_PERMS_NO_ACCESS, ...target.permisos_finanzas };
    }
    // Sin permisos_finanzas pero con módulo finanzas asignado: defaults seguros
    const hasFinanzasModulo = (target.modulos || []).includes('finanzas') ||
                              (target.modulos || []).length === 0; // fallback histórico
    if (hasFinanzasModulo) return DEFAULT_PERMS_BASIC;
    return DEFAULT_PERMS_NO_ACCESS;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin, getFinanzasPerms }}>
      {children}
    </AuthContext.Provider>
  );
}

// Sets de permisos por defecto (constantes)
const DEFAULT_PERMS_NO_ACCESS = {
  ver_dashboard: false,
  ver_movimientos: false,
  ver_empleados: false,
  ver_grupos: false,
  ver_resultados: false,
  admin_usuarios_finanzas: false,
  cargar_pagos: false,
  cargar_cobros: false,
  cargar_gastos_op: false,
  cargar_sueldos: false,
  marcar_pagado: false,
  anular: false,
  aprobar_pendientes: false,
  aprobar_hasta: 0,
  exportar: false,
  tope_gastos_op: 0,
  historial_dias: 0,
  hide_utility: true,
  hide_sueldos: true,
};

const DEFAULT_PERMS_BASIC = {
  ...DEFAULT_PERMS_NO_ACCESS,
  ver_dashboard: true,
  ver_movimientos: true,
  cargar_pagos: true,
  cargar_cobros: true,
  marcar_pagado: true,
};

const DEFAULT_PERMS_ADMIN = {
  ver_dashboard: true,
  ver_movimientos: true,
  ver_empleados: true,
  ver_grupos: true,
  ver_resultados: true,
  admin_usuarios_finanzas: true,
  cargar_pagos: true,
  cargar_cobros: true,
  cargar_gastos_op: true,
  cargar_sueldos: true,
  marcar_pagado: true,
  anular: true,
  aprobar_pendientes: true,
  aprobar_hasta: Infinity,
  exportar: true,
  tope_gastos_op: Infinity,
  historial_dias: 0, // 0 = todo el historial
  hide_utility: false,
  hide_sueldos: false,
};

export function useAuth() {
  return useContext(AuthContext);
}
