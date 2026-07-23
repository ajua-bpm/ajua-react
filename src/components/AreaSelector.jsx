import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AREAS } from '../areas';

// Pantalla de entrada: 2-3 botones grandes, cada uno lleva a su área con su propio menú.
export default function AreaSelector() {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();

  // Filtrar áreas por permiso: si el usuario no es admin y tiene módulos asignados,
  // solo mostrar las áreas donde tiene al menos un módulo. Sin módulos = ve todo.
  const mods = user?.modulos || [];
  const AREA_MODS = {
    admin: ['dashboard','finanzas','cuentas-proveedores','cuentas-clientes','gastos','anticipos','personal','proyeccion-semanal','cotizador','cotizador-rapido','cotizador-import','precios','pendientes'],
    oper:  ['stock','entrada','salida','walmart','ventas-gt','ventas-int'],
    bpm:   ['tl','dt','al','bas','rod','limp','vyp','fumigacion','croquis','capacitacion','enfermos','visitas','control-personal','cloro','temperatura','inspecciones','cloro-producto'],
  };
  const puede = (areaId) => {
    if (isAdmin(user)) return true;
    if (!mods.length) return true; // fallback histórico: sin módulos = ve todo
    return (AREA_MODS[areaId] || []).some(m => mods.includes(m));
  };
  const visibles = AREAS.filter(a => puede(a.id));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream, #F8F3E9)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px' }}>
        <div style={{ fontFamily: 'var(--font-heading, serif)', fontSize: '1.6rem', fontWeight: 700, letterSpacing: '2px', color: 'var(--forest, #1F3A2C)' }}>AJÚA</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: '.82rem', color: '#6B6B60' }}>{user?.nombre}</span>
          <button onClick={() => { logout(); navigate('/login'); }} style={{
            padding: '7px 14px', border: '1px solid rgba(26,26,24,.15)', background: 'white', borderRadius: 4,
            fontSize: '.75rem', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', cursor: 'pointer', color: '#6B6B60',
          }}>Salir</button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px 28px 60px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading, serif)', fontSize: '1.8rem', fontWeight: 600, color: 'var(--forest, #1F3A2C)', marginBottom: 6, textAlign: 'center' }}>
          ¿A dónde entrás hoy?
        </h1>
        <p style={{ fontSize: '.92rem', color: '#6B6B60', marginBottom: 34, textAlign: 'center' }}>Elegí un área para empezar a trabajar</p>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(visibles.length, 3)}, minmax(220px, 300px))`, gap: 20, width: '100%', maxWidth: 960, justifyContent: 'center' }}>
          {visibles.map(a => (
            <button key={a.id} onClick={() => navigate(a.home)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              padding: '40px 24px', borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${a.color}22`, background: 'white',
              boxShadow: '0 2px 12px rgba(0,0,0,.06)', transition: 'transform .12s, box-shadow .12s',
              fontFamily: 'inherit',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.12)'; e.currentTarget.style.borderColor = a.color; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,.06)'; e.currentTarget.style.borderColor = `${a.color}22`; }}
            >
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${a.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem' }}>{a.icon}</div>
              <div style={{ fontFamily: 'var(--font-heading, serif)', fontSize: '1.25rem', fontWeight: 700, color: a.color }}>{a.label}</div>
              <div style={{ fontSize: '.82rem', color: '#6B6B60', textAlign: 'center', lineHeight: 1.4 }}>{a.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
