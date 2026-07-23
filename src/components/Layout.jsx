import { useState, useMemo } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { useCollection } from '../hooks/useFirestore';
import { SECTION_AREA, areaById } from '../areas';
import IngieMari from './asistente/IngieMari';

const NAV = [
  { section: 'Inicio' },
  { to: '/dashboard',              mod: 'dashboard',         icon: '📊', label: 'Dashboard' },

  // ═══ ADMINISTRACIÓN — dinero, cuentas, personal ═══
  { section: 'Finanzas' },
  { to: '/finanzas',               mod: 'finanzas',          icon: '✨', label: 'Finanzas' },
  { to: '/cuentas-proveedores',    mod: 'cuentas-proveedores', icon: '🏪', label: 'Cuentas Proveedores' },
  { to: '/cuentas-clientes',       mod: 'cuentas-clientes',    icon: '🛒', label: 'Cuentas Clientes' },
  { to: '/gastos',                 mod: 'gastos',            icon: '💸', label: 'Gastos' },
  { to: '/anticipos',              mod: 'anticipos',         icon: '💵', label: 'Anticipos MX' },
  { to: '/personal',               mod: 'personal',          icon: '👥', label: 'Personal / Nómina' },

  { section: 'Comercial' },
  { to: '/proyeccion-semanal',     mod: 'proyeccion-semanal', icon: '📊', label: 'Proyección Semanal' },
  { to: '/cotizador/rapido',       mod: 'cotizador-rapido',  icon: '💼', label: 'Cotizador Rápido' },
  { to: '/cotizador',              mod: 'cotizador',         icon: '🚢', label: 'Cotizador Contenedor' },
  { to: '/cotizador-import-lista', mod: 'cotizador-import',  icon: '📋', label: 'Cotizaciones Importación' },
  { to: '/cotizador-importacion',  mod: 'cotizador-import',  icon: '🇲🇽', label: 'Cotizador Importación (Nuevo)', external: true },
  { to: '/actividad-proveedores',  mod: 'cotizador-import',  icon: '🔎', label: 'Actividad Proveedores' },
  { to: '/precios',                mod: 'precios',           icon: '💲', label: 'Lista de Precios' },

  { section: 'Inventario y Ventas' },
  { to: '/stock',                  mod: 'stock',             icon: '📦', label: 'Stock en Vivo' },
  { to: '/inventario/entrada',     mod: 'entrada',           icon: '📥', label: 'Ingresos / Recepción' },
  { to: '/walmart',                mod: 'walmart',           icon: '🏪', label: 'Pedidos Walmart' },
  { to: '/inventario/salida',      mod: 'salida',            icon: '💰', label: 'Ventas Walmart' },
  { to: '/ventas/gt',              mod: 'ventas-gt',         icon: '🇬🇹', label: 'Despachos GT' },
  { to: '/ventas/int',             mod: 'ventas-int',        icon: '✈️', label: 'Exportación' },

  { section: 'Equipo' },
  { to: '/pendientes',             mod: 'pendientes',        icon: '✅', label: 'Pendientes Equipo' },

  // ═══ CUMPLIMIENTO — BPM, inocuidad, sanitario ═══
  { section: 'Transporte' },
  { to: '/bpm/tl',                 mod: 'tl',                icon: '🚛', label: 'Limpieza Transporte' },
  { to: '/bpm/dt',                 mod: 'dt',                icon: '📋', label: 'Despacho' },
  { section: 'Bodega' },
  { to: '/bpm/al',                 mod: 'al',                icon: '🙌', label: 'Acceso y Lavado' },
  { to: '/bpm/bas',                mod: 'bas',               icon: '⚖️', label: 'Básculas' },
  { to: '/bpm/rod',                mod: 'rod',               icon: '🐀', label: 'Roedores' },
  { to: '/bpm/limp',               mod: 'limp',              icon: '🧹', label: 'Limpieza Bodega' },
  { to: '/bpm/vyp',                mod: 'vyp',               icon: '🔍', label: 'Vidrio y Plástico' },
  { to: '/bpm/fumigacion',         mod: 'fumigacion',        icon: '🧪', label: 'Fumigación' },
  { to: '/bpm/croquis',            mod: 'croquis',           icon: '🗺️', label: 'Croquis Bodega' },
  { section: 'Higiene' },
  // Lavado Producto (legacy) — reemplazado por Control de Lavado por Producto. Ruta sigue activa para registros históricos.
  { to: '/bpm/capacitacion',       mod: 'capacitacion',      icon: '🎓', label: 'Capacitación' },
  { to: '/bpm/enfermos',           mod: 'enfermos',          icon: '🏥', label: 'Empleados Enfermos' },
  { to: '/bpm/visitas',            mod: 'visitas',           icon: '👤', label: 'Control Visitas' },
  { to: '/bpm/control-personal',   mod: 'control-personal',  icon: '🧴', label: 'Control Personal' },
  { to: '/bpm/cloro',              mod: 'cloro',             icon: '💧', label: 'Control Cloro' },
  { to: '/bpm/temperatura',        mod: 'temperatura',       icon: '🌡️', label: 'Temperatura' },
  { to: '/bpm/inspecciones',       mod: 'inspecciones',      icon: '📝', label: 'Inspecciones + CAPA' },
  { to: '/bpm/cloro-producto',     mod: 'cloro-producto',    icon: '💧', label: 'Control de Lavado' },

  { section: 'Sistema' },
  { to: '/admin',                  mod: '_admin',            icon: '⚙️', label: 'Administración' },
];

function canSee(user, mod) {
  const rol = user?.rol;
  if (rol === 'admin' || rol === 'superadmin') return true;
  if (mod === '_admin') return false;
  // MARI consume API ($) — admin asigna explícitamente, no acceso por default
  if (mod === 'mari') return (user?.modulos || []).includes('mari');
  const mods = user?.modulos;
  if (!mods || mods.length === 0) return true;
  return mods.includes(mod);
}

const today = () => new Date().toISOString().slice(0, 10);
const weekStart = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

// A qué área pertenece una ruta (match exacto o por prefijo más largo)
function areaForPath(pathname) {
  let curArea = 'admin', best = null, bestLen = -1;
  for (const item of NAV) {
    if (item.section) { curArea = SECTION_AREA[item.section] || 'admin'; continue; }
    if (!item.to) continue;
    if (pathname === item.to || pathname.startsWith(item.to + '/')) {
      if (item.to.length > bestLen) { bestLen = item.to.length; best = curArea; }
    }
  }
  return best;
}

// Items del menú de un área (mantiene headers de sección + sus items)
function navForArea(area) {
  const out = [];
  let curArea = 'admin';
  for (const item of NAV) {
    if (item.section) { curArea = SECTION_AREA[item.section] || 'admin'; if (curArea === area) out.push(item); continue; }
    if (curArea === area) out.push(item);
  }
  return out;
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeArea = areaForPath(location.pathname) || 'admin';
  const area = areaById(activeArea);
  const navItems = navForArea(activeArea);
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

        {/* Área activa */}
        <div style={{ padding: '13px 18px 12px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <button onClick={() => navigate('/areas')} style={{
            background: 'none', border: 'none', padding: 0, marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit',
            color: 'rgba(255,255,255,.4)', fontSize: '10px', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ fontSize: '12px' }}>←</span> Áreas
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: '1.1rem' }}>{area.icon}</span>
            <span style={{ fontFamily: 'var(--font-heading, serif)', fontSize: '1.02rem', fontWeight: 700, color: '#fff', letterSpacing: '.01em' }}>{area.label}</span>
          </div>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: '8px 0 16px' }}>
          {navItems.map((item, i) => {
            if (item.section) {
              const nextSection = navItems.slice(i + 1).findIndex(n => n.section);
              const sectionItems = nextSection === -1 ? navItems.slice(i + 1) : navItems.slice(i + 1, i + 1 + nextSection);
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
            const baseStyle = {
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '7px 20px',
              margin: '1px 0',
              fontSize: '13px',
              textDecoration: 'none',
              borderLeft: '3px solid transparent',
              fontWeight: 400,
              letterSpacing: '.01em',
              transition: 'all .12s',
              color: 'rgba(255,255,255,.55)',
              background: 'transparent',
            };
            if (item.external) {
              return (
                <a key={item.to} href={item.to} onClick={() => setOpen(false)} style={baseStyle}>
                  <span style={{ fontSize: '13px', opacity: .8 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                </a>
              );
            }
            return (
              <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}
                style={({ isActive }) => ({
                  ...baseStyle,
                  color: isActive ? '#fff' : baseStyle.color,
                  background: isActive ? 'rgba(255,255,255,.07)' : baseStyle.background,
                  borderLeft: isActive ? '3px solid var(--gold)' : baseStyle.borderLeft,
                  fontWeight: isActive ? 600 : 400,
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

          {/* Bell — activar notificaciones del browser */}
          {supported && permission !== 'denied' && (
            <button
              onClick={async () => {
                if (permission === 'granted') { navigate('/pendientes'); return; }
                await requestPermission();
              }}
              title={permission === 'granted' ? 'Notificaciones activas' : 'Activar notificaciones'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 6px', borderRadius: 4, fontSize: '1.1rem',
                lineHeight: 1, position: 'relative',
                color: permission === 'granted' ? 'var(--forest)' : 'var(--ink-light)',
              }}
            >
              🔔
              {permission !== 'granted' && (
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
      {canSee(user, 'mari') && <IngieMari />}
    </div>
  );
}
