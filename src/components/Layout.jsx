import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const NAV = [
  { section: 'General' },
  { to: '/dashboard',              icon: '📊', label: 'Dashboard' },
  { section: 'BPM · Transporte' },
  { to: '/bpm/tl',                 icon: '🚛', label: 'Limpieza Transporte' },
  { to: '/bpm/dt',                 icon: '📋', label: 'Despacho' },
  { section: 'BPM · Bodega' },
  { to: '/bpm/al',                 icon: '🙌', label: 'Acceso y Lavado' },
  { to: '/bpm/bas',                icon: '⚖️', label: 'Básculas' },
  { to: '/bpm/rod',                icon: '🐀', label: 'Roedores' },
  { to: '/bpm/limp',               icon: '🧹', label: 'Limpieza Bodega' },
  { to: '/bpm/vyp',                icon: '🔍', label: 'Vidrio y Plástico' },
  { to: '/bpm/fumigacion',         icon: '🧪', label: 'Fumigación' },
  { to: '/bpm/croquis',            icon: '🗺️', label: 'Croquis Bodega' },
  { section: 'BPM · Personal' },
  { to: '/bpm/lavado-prod',        icon: '💧', label: 'Lavado Producto' },
  { to: '/bpm/capacitacion',       icon: '🎓', label: 'Capacitación' },
  { to: '/bpm/enfermos',           icon: '🏥', label: 'Empleados Enfermos' },
  { to: '/bpm/visitas',            icon: '👤', label: 'Control Visitas' },
  { section: 'Inventario' },
  { to: '/stock',                  icon: '📦', label: 'Stock en Vivo' },
  { to: '/inventario/entrada',     icon: '📥', label: 'Ingresos Bodega' },
  { to: '/inventario/salida',      icon: '📤', label: 'Salidas Bodega' },
  { to: '/inventario/proveedores', icon: '🏭', label: 'Proveedores' },
  { section: 'Ventas' },
  { to: '/ventas/gt',              icon: '🇬🇹', label: 'Despachos GT' },
  { to: '/ventas/int',             icon: '✈️', label: 'Exportación' },
  { to: '/ventas/maquila',         icon: '⚙️', label: 'Maquila' },
  { to: '/walmart',                icon: '🏪', label: 'Pedidos Walmart' },
  { section: 'Finanzas' },
  { to: '/gastos',                 icon: '💸', label: 'Gastos Diarios' },
  { to: '/anticipos',              icon: '💵', label: 'Anticipos MX' },
  { to: '/cotizador/rapido',       icon: '💼', label: 'Cotizador Rápido' },
  { to: '/cotizador',              icon: '📋', label: 'Cotizador' },
  { section: 'Personal' },
  { to: '/personal',               icon: '👥', label: 'Personal' },
  { section: 'Sistema' },
  { to: '/guatecompras',           icon: '🏛️', label: 'Guatecompras' },
  { to: '/reportes',               icon: '📈', label: 'Reportes' },
  { to: '/admin',                  icon: '⚙️', label: 'Administración' },
];

const C = {
  green: '#1A3D28', light: '#2D6645', acc: '#4A9E6A',
  cream: '#F5F0E4', bg: '#F9F6EF', sand: '#E8DCC8',
};

export default function Layout() {
  const [navOpen, setNavOpen] = useState(false);
  const { user, logout }      = useAuth();
  const navigate              = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Overlay mobile */}
      {navOpen && (
        <div onClick={() => setNavOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 40,
          display: 'none', // solo visible en mobile via media query
        }} />
      )}

      {/* Sidebar */}
      <nav className={navOpen ? 'open' : ''} style={{
        width: 220, background: C.green, color: C.cream,
        flexShrink: 0, display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        overflowY: 'auto', transition: 'transform .25s',
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 10px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '.02em' }}>🌿 AJÚA BPM</div>
          {user && <div style={{ fontSize: '.68rem', opacity: .6, marginTop: 4 }}>{user.nombre} · {user.rol}</div>}
        </div>

        {/* Links */}
        <div style={{ flex: 1, padding: '8px 0' }}>
          {NAV.map((item, i) => {
            if (item.section) return (
              <div key={i} style={{ padding: '14px 16px 4px', fontSize: '.6rem', fontWeight: 700, opacity: .45, letterSpacing: '.12em', textTransform: 'uppercase' }}>
                {item.section}
              </div>
            );
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setNavOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 16px', fontSize: '.82rem',
                  color: isActive ? C.cream : 'rgba(245,240,228,.65)',
                  background: isActive ? 'rgba(255,255,255,.12)' : 'transparent',
                  textDecoration: 'none', borderRadius: 4, margin: '1px 6px',
                  borderLeft: isActive ? '3px solid #8DC26F' : '3px solid transparent',
                  transition: 'all .15s',
                })}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '8px 12px', borderRadius: 4,
            background: 'rgba(255,255,255,.08)', border: 'none',
            color: 'rgba(245,240,228,.7)', fontSize: '.78rem', cursor: 'pointer',
          }}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div style={{ marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header mobile */}
        <header style={{
          background: C.green, color: C.cream,
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 20px', position: 'sticky', top: 0, zIndex: 30,
          boxShadow: '0 2px 8px rgba(0,0,0,.2)',
        }}>
          <button onClick={() => setNavOpen(!navOpen)} style={{
            background: 'none', border: 'none', color: C.cream,
            fontSize: '1.3rem', cursor: 'pointer', display: 'none', // visible via CSS en mobile
          }}>☰</button>
          <span style={{ fontWeight: 700, fontSize: '.9rem', letterSpacing: '.04em' }}>AJÚA BPM</span>
          <span style={{ marginLeft: 'auto', fontSize: '.7rem', opacity: .55 }}>
            {new Date().toLocaleDateString('es-GT', { weekday:'short', day:'2-digit', month:'short' })}
          </span>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '24px 20px', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          nav { transform: translateX(-100%) !important; }
          nav.open { transform: translateX(0) !important; }
          main > div { margin-left: 0 !important; }
          header button { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
