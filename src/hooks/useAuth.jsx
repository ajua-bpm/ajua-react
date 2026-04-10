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

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
