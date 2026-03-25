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
  { section: 'BPM · Higiene' },
  { to: '/bpm/lavado-prod',        icon: '💧', label: 'Lavado Producto' },
  { to: '/bpm/capacitacion',       icon: '🎓', label: 'Capacitación' },
  { to: '/bpm/enfermos',           icon: '🏥', label: 'Empleados Enfermos' },
  { to: '/bpm/visitas',            icon: '👤', label: 'Control Visitas' },
  { to: '/bpm/control-personal',   icon: '🧴', label: 'Control Personal' },
  { to: '/bpm/cloro',              icon: '💧', label: 'Control Cloro' },
  { to: '/bpm/temperatura',        icon: '🌡️', label: 'Temperatura' },
  { section: 'Inventario' },
  { to: '/stock',                  icon: '📦', label: 'Stock en Vivo' },
  { to: '/inventario/entrada',     icon: '📥', label: 'Ingresos Bodega' },
  { to: '/inventario/proveedores', icon: '🏭', label: 'Proveedores' },
  { section: 'Walmart' },
  { to: '/walmart',                icon: '🏪', label: 'Pedidos Walmart' },
  { to: '/inventario/salida',      icon: '💰', label: 'Ventas Walmart' },
  { section: 'Ventas' },
  { to: '/ventas/gt',              icon: '🇬🇹', label: 'Despachos GT' },
  { to: '/ventas/int',             icon: '✈️', label: 'Exportación' },
  { to: '/gastos/semanales',       icon: '📅', label: 'Gastos Semanales' },
  { to: '/maquila',                icon: '⚙️', label: 'Gastos Generales' },
  { section: 'Finanzas' },
  { to: '/gastos',                 icon: '💸', label: 'Gastos Diarios' },
  { to: '/anticipos',              icon: '💵', label: 'Anticipos MX' },
  { to: '/cotizador/rapido',       icon: '💼', label: 'Cotizador Rápido' },
  { to: '/cotizador',              icon: '📋', label: 'Cotizador' },
  { section: 'Precios' },
  { to: '/precios',                icon: '💲', label: 'Lista de Precios' },
  { section: 'Personal' },
  { to: '/personal',               icon: '👥', label: 'Personal' },
  { section: 'Sistema' },
  { to: '/guatecompras',           icon: '🏛️', label: 'Guatecompras' },
  { to: '/reportes',               icon: '📈', label: 'Reportes' },
  { to: '/admin',                  icon: '⚙️', label: 'Administración' },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F5F5F5', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Overlay mobile */}
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          zIndex: 40, display: 'block',
        }} />
      )}

      {/* Sidebar */}
      <nav className={`sidebar${open ? ' open' : ''}`} style={{
        width: 240, background: '#1B5E20', color: '#fff',
        flexShrink: 0, display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        overflowY: 'auto', transition: 'transform .24s cubic-bezier(.4,0,.2,1)',
        boxShadow: '2px 0 8px rgba(0,0,0,.18)',
      }}>
        {/* Brand */}
        <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid rgba(255,255,255,.12)' }}>
          <div style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '.01em', color: '#fff' }}>
            🌿 AJÚA BPM
          </div>
          {user && (
            <div style={{ marginTop: 6, fontSize: '.72rem', color: 'rgba(255,255,255,.6)', lineHeight: 1.4 }}>
              {user.nombre}<br/>
              <span style={{ background: 'rgba(255,255,255,.15)', padding: '1px 7px', borderRadius: 10, fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {user.rol}
              </span>
            </div>
          )}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: '10px 0 16px' }}>
          {NAV.map((item, i) => {
            if (item.section) return (
              <div key={i} style={{
                padding: '14px 18px 4px',
                fontSize: '.6rem', fontWeight: 700,
                color: 'rgba(255,255,255,.4)',
                letterSpacing: '.12em', textTransform: 'uppercase',
              }}>
                {item.section}
              </div>
            );
            return (
              <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 18px',
                  margin: '1px 8px',
                  borderRadius: 6,
                  fontSize: '.83rem',
                  color: isActive ? '#fff' : 'rgba(255,255,255,.65)',
                  background: isActive ? 'rgba(255,255,255,.15)' : 'transparent',
                  textDecoration: 'none',
                  borderLeft: isActive ? '3px solid #81C784' : '3px solid transparent',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all .15s',
                })}>
                <span style={{ fontSize: '.9rem' }}>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Logout */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.12)' }}>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '9px 12px', borderRadius: 6,
            background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)',
            color: 'rgba(255,255,255,.75)', fontSize: '.8rem', cursor: 'pointer',
            fontFamily: 'inherit', fontWeight: 500, letterSpacing: '.02em',
          }}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      {/* Main area */}
      <div className="main-wrapper" style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          background: '#1B5E20',
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 20px', height: 56,
          position: 'sticky', top: 0, zIndex: 30,
          boxShadow: '0 2px 8px rgba(0,0,0,.2)',
        }}>
          <button className="hamburger" onClick={() => setOpen(o => !o)} style={{
            background: 'none', border: 'none', color: '#fff',
            fontSize: '1.25rem', cursor: 'pointer', display: 'none',
            padding: '4px 6px', borderRadius: 4,
          }}>☰</button>
          <span style={{ fontWeight: 700, fontSize: '.92rem', color: '#fff', letterSpacing: '.03em' }}>
            AJÚA BPM
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '.72rem', color: 'rgba(255,255,255,.55)' }}>
            {new Date().toLocaleDateString('es-GT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
        </header>

        {/* Content */}
        <main style={{
          flex: 1, padding: '24px 24px 40px',
          maxWidth: 1160, width: '100%', margin: '0 auto',
          animation: 'fadeIn .2s ease',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
