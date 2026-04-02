import { useState, useMemo } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { useCollection } from '../hooks/useFirestore';

const NAV = [
  { section: 'General' },
  { to: '/dashboard',              mod: 'dashboard',         icon: '📊', label: 'Dashboard' },
  { section: 'BPM · Transporte' },
  { to: '/bpm/tl',                 mod: 'tl',                icon: '🚛', label: 'Limpieza Transporte' },
  { to: '/bpm/dt',                 mod: 'dt',                icon: '📋', label: 'Despacho' },
  { section: 'BPM · Bodega' },
  { to: '/bpm/al',                 mod: 'al',                icon: '🙌', label: 'Acceso y Lavado' },
  { to: '/bpm/bas',                mod: 'bas',               icon: '⚖️', label: 'Básculas' },
  { to: '/bpm/rod',                mod: 'rod',               icon: '🐀', label: 'Roedores' },
  { to: '/bpm/limp',               mod: 'limp',              icon: '🧹', label: 'Limpieza Bodega' },
  { to: '/bpm/vyp',                mod: 'vyp',               icon: '🔍', label: 'Vidrio y Plástico' },
  { to: '/bpm/fumigacion',         mod: 'fumigacion',        icon: '🧪', label: 'Fumigación' },
  { to: '/bpm/croquis',            mod: 'croquis',           icon: '🗺️', label: 'Croquis Bodega' },
  { section: 'BPM · Higiene' },
  { to: '/bpm/lavado-prod',        mod: 'lavado-prod',       icon: '💧', label: 'Lavado Producto' },
  { to: '/bpm/capacitacion',       mod: 'capacitacion',      icon: '🎓', label: 'Capacitación' },
  { to: '/bpm/enfermos',           mod: 'enfermos',          icon: '🏥', label: 'Empleados Enfermos' },
  { to: '/bpm/visitas',            mod: 'visitas',           icon: '👤', label: 'Control Visitas' },
  { to: '/bpm/control-personal',   mod: 'control-personal',  icon: '🧴', label: 'Control Personal' },
  { to: '/bpm/cloro',              mod: 'cloro',             icon: '💧', label: 'Control Cloro' },
  { to: '/bpm/temperatura',        mod: 'temperatura',       icon: '🌡️', label: 'Temperatura' },
  { section: 'Inventario' },
  { to: '/stock',                  mod: 'stock',             icon: '📦', label: 'Stock en Vivo' },
  { to: '/recepcion',              mod: 'recepcion',         icon: '🔬', label: 'Recepción Producto' },
  { to: '/inventario/entrada',     mod: 'entrada',           icon: '📥', label: 'Ingresos Bodega' },
  { to: '/inventario/proveedores', mod: 'proveedores',       icon: '🏭', label: 'Proveedores' },
  { section: 'Walmart' },
  { to: '/walmart',                mod: 'walmart',           icon: '🏪', label: 'Pedidos Walmart' },
  { to: '/inventario/salida',      mod: 'salida',            icon: '💰', label: 'Ventas Walmart' },
  { section: 'Ventas' },
  { to: '/ventas/gt',              mod: 'ventas-gt',         icon: '🇬🇹', label: 'Despachos GT' },
  { to: '/ventas/int',             mod: 'ventas-int',        icon: '✈️', label: 'Exportación' },
  { section: 'Finanzas' },
  { to: '/gastos',                 mod: 'gastos',            icon: '💸', label: 'Gastos' },
  { to: '/cuentas-proveedores',    mod: 'cuentas-proveedores', icon: '🏪', label: 'Cuentas Proveedores' },
  { to: '/anticipos',              mod: 'anticipos',         icon: '💵', label: 'Anticipos MX' },
  { to: '/cotizador/rapido',       mod: 'cotizador-rapido',  icon: '💼', label: 'Cotizador Rápido' },
  { to: '/cotizador',              mod: 'cotizador',         icon: '🚢', label: 'Cotizador Contenedor' },
  { section: 'Precios' },
  { to: '/precios',                mod: 'precios',           icon: '💲', label: 'Lista de Precios' },
  { section: 'Personal' },
  { to: '/personal',               mod: 'personal',          icon: '👥', label: 'Personal' },
  { section: 'Sistema' },
  { to: '/guatecompras',           mod: 'guatecompras',      icon: '🏛️', label: 'Guatecompras' },
  { to: '/reportes',               mod: 'reportes',          icon: '📈', label: 'Reportes' },
  { to: '/admin',                  mod: '_admin',            icon: '⚙️', label: 'Administración' },
];

function canSee(user, mod) {
  const rol = user?.rol;
  if (rol === 'admin' || rol === 'superadmin') return true;
  if (mod === '_admin') return false;
  const mods = user?.modulos;
  if (!mods || mods.length === 0) return true;
  return mods.includes(mod);
}

const today = () => new Date().toISOString().slice(0, 10);
const weekStart = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { permission, supported, requestPermission } = useNotifications();

  // Badge: pedidos Walmart pendientes de esta semana en adelante
  const { data: wmData } = useCollection('pedidosWalmart', { orderField: 'fechaEntrega', orderDir: 'asc', limit: 200 });
  const wmBadge = useMemo(() => {
    const wk = weekStart();
    return (wmData || []).filter(r =>
      (!r.estado || r.estado === 'pendiente') &&
      (r.fechaEntrega || r.fecha || '') >= wk
    ).length;
  }, [wmData]);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cream)', fontFamily: 'var(--font-body)' }}>

      {/* Overlay mobile */}
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          zIndex: 40,
        }} />
      )}

      {/* Sidebar */}
      <nav className={`sidebar${open ? ' open' : ''}`} style={{
        width: 232,
        background: 'var(--ink)',
        color: '#fff',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 50,
        overflowY: 'auto',
        transition: 'transform .22s cubic-bezier(.4,0,.2,1)',
      }}>

        {/* Brand */}
        <div style={{
          padding: '22px 20px 16px',
          borderBottom: '1px solid rgba(255,255,255,.08)',
        }}>
          <div style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.5rem',
            fontWeight: 700,
            letterSpacing: '2px',
            color: '#fff',
            lineHeight: 1,
            marginBottom: 8,
          }}>
            AJÚA
          </div>
          {user && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.45)', lineHeight: 1.5 }}>
              {user.nombre}<br />
              <span style={{
                background: 'rgba(139,115,85,.25)',
                color: 'rgba(255,255,255,.7)',
                padding: '1px 8px',
                borderRadius: 2,
                fontSize: '9px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.1em',
              }}>
                {user.rol}
              </span>
            </div>
          )}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: '8px 0 16px' }}>
          {NAV.map((item, i) => {
            if (item.section) {
              const nextSection = NAV.slice(i + 1).findIndex(n => n.section);
              const sectionItems = nextSection === -1 ? NAV.slice(i + 1) : NAV.slice(i + 1, i + 1 + nextSection);
              const sectionVisible = sectionItems.some(n => canSee(user, n.mod));
              if (!sectionVisible) return null;
              return (
                <div key={i} style={{
                  padding: '14px 20px 4px',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,.28)',
                  letterSpacing: '.15em',
                  textTransform: 'uppercase',
                }}>
                  {item.section}
                </div>
              );
            }
            if (!canSee(user, item.mod)) return null;
            return (
              <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '7px 20px',
                  margin: '1px 0',
                  fontSize: '13px',
                  color: isActive ? '#fff' : 'rgba(255,255,255,.55)',
                  background: isActive ? 'rgba(255,255,255,.07)' : 'transparent',
                  textDecoration: 'none',
                  borderLeft: isActive ? '3px solid var(--gold)' : '3px solid transparent',
                  fontWeight: isActive ? 600 : 400,
                  letterSpacing: '.01em',
                  transition: 'all .12s',
                })}>
                <span style={{ fontSize: '13px', opacity: .8 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.mod === 'walmart' && wmBadge > 0 && (
                  <span style={{ background: '#EF4444', color: '#fff', borderRadius: '50%', minWidth: 18, height: 18, fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', lineHeight: 1 }}>
                    {wmBadge > 99 ? '99+' : wmBadge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Logout */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <button onClick={handleLogout} style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: 3,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,.15)',
            color: 'rgba(255,255,255,.5)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all .15s',
          }}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      {/* Main area */}
      <div className="main-wrapper" style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          background: 'var(--white)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 24px',
          height: 52,
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}>
          <button className="hamburger" onClick={() => setOpen(o => !o)} style={{
            background: 'none',
            border: 'none',
            color: 'var(--ink)',
            fontSize: '1.2rem',
            cursor: 'pointer',
            display: 'none',
            padding: '4px 6px',
            borderRadius: 3,
          }}>☰</button>
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '1rem',
            color: 'var(--forest)',
            letterSpacing: '1.5px',
          }}>
            AJÚA
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--ink-light)', letterSpacing: '.3px' }}>
            {new Date().toLocaleDateString('es-GT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </span>

          {/* Bell — solo si soportado */}
          {supported && (
            <button
              onClick={permission === 'granted' ? () => navigate('/walmart') : requestPermission}
              title={permission === 'granted' ? 'Ir a pedidos Walmart' : 'Activar notificaciones'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: 4,
                fontSize: '1.1rem',
                lineHeight: 1,
                position: 'relative',
                color: permission === 'granted' ? 'var(--forest)' : 'var(--ink-light)',
                opacity: permission === 'denied' ? 0.35 : 1,
              }}
            >
              🔔
              {permission !== 'granted' && permission !== 'denied' && (
                <span style={{
                  position: 'absolute', top: 1, right: 1,
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#EF4444', border: '1.5px solid var(--white)',
                }} />
              )}
            </button>
          )}
        </header>

        {/* Content */}
        <main style={{
          flex: 1,
          padding: '28px 28px 48px',
          maxWidth: 1160,
          width: '100%',
          margin: '0 auto',
          animation: 'fadeIn .18s ease',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
