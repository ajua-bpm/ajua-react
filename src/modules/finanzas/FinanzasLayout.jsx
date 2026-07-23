import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

// Layout con sidebar de Finanzas. Cada sub-página se pinta en <Outlet/>.
// Los items del sidebar solo se muestran si el usuario tiene el permiso correspondiente.
// Aditivo: no toca el Layout principal de la app.

const T = {
  bg: '#F8F3E9', paper: '#FFFFFF', ink: '#1A1A18', forest: '#1F3A2C',
  canopy: '#2D6645', ochre: '#A8835A', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)',
  sand: '#E7DDC9',
};

const ITEMS = [
  { to: '/finanzas-nuevo',              perm: 'ver_dashboard',   icon: '📊', label: 'Dashboard',       end: true },
  { to: '/finanzas-nuevo/movimientos',  perm: 'ver_movimientos', icon: '💸', label: 'Movimientos' },
  { to: '/finanzas-nuevo/empleados',    perm: 'ver_empleados',   icon: '👥', label: 'Empleados' },
  { to: '/finanzas-nuevo/grupos',       perm: 'ver_grupos',      icon: '📦', label: 'Grupos importación' },
  { to: '/finanzas-nuevo/resultados',   perm: 'ver_resultados',  icon: '📈', label: 'Estado resultados' },
  { to: '/finanzas-nuevo/usuarios',     perm: 'admin_usuarios_finanzas', icon: '🔐', label: 'Usuarios y permisos' },
];

export default function FinanzasLayout() {
  const { getFinanzasPerms } = useAuth();
  const perms = getFinanzasPerms();
  const visibleItems = ITEMS.filter(i => perms[i.perm]);

  // Si no tiene acceso a ninguna sub-página, mostrar sin-acceso
  if (visibleItems.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: T.muted }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🚫</div>
        <h2 style={{ fontFamily: "'Fraunces', serif", color: T.forest, marginBottom: 8 }}>Sin acceso a Finanzas</h2>
        <p style={{ fontSize: '.9rem' }}>Tu usuario no tiene permiso para ver este módulo.<br/>Consultá con el administrador.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 'calc(100vh - 60px)' }}>
      <aside style={{ background: T.paper, borderRight: `1px solid ${T.rule}`, padding: '16px 0' }}>
        <div style={{ padding: '4px 20px 8px', fontSize: '.66rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: T.muted }}>
          Finanzas
        </div>
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 20px', fontSize: '.88rem',
              color: isActive ? T.forest : T.ink,
              background: isActive ? 'rgba(31,58,44,.06)' : 'transparent',
              borderLeft: `3px solid ${isActive ? T.forest : 'transparent'}`,
              fontWeight: isActive ? 600 : 400,
              textDecoration: 'none',
            })}
          >
            <span style={{ fontSize: '1rem' }}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </aside>
      <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>
    </div>
  );
}
