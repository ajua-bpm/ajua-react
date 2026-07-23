import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AREAS } from '../areas';

// Landing de entrada: pantalla completa con las 3 áreas como etiquetas de caja de cosecha.
// Diseño aprobado (maqueta). Cada tarjeta abre su área con su propio menú.

const EMBLEMS = {
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18" /><path d="M5 7h14" /><path d="M7 7l-3 6a3 3 0 0 0 6 0z" /><path d="M17 7l-3 6a3 3 0 0 0 6 0z" /><path d="M8 21h8" />
    </svg>
  ),
  oper: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l9-4 9 4-9 4-9-4z" /><path d="M3 8v8l9 4 9-4V8" /><path d="M12 12v8" /><path d="M12 4c1.5 1.2 1.5 2.8 0 4-1.5-1.2-1.5-2.8 0-4z" />
    </svg>
  ),
  bpm: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3s7 2.5 7 8c0 5-3.5 8-7 10-3.5-2-7-5-7-10 0-5.5 7-8 7-8z" /><path d="M9 12l2 2 4-4" />
    </svg>
  ),
};

const DESC = {
  admin: 'El dinero del negocio: lo que entra, lo que sale y lo que te deben.',
  oper:  'El movimiento diario: inventario, pedidos y despachos.',
  bpm:   'La inocuidad y lo sanitario: los registros BPM que exige auditoría.',
};
const SUBS = {
  admin: ['Finanzas', 'Cuentas', 'Personal', 'Cotizadores'],
  oper:  ['Stock', 'Recepción', 'Walmart', 'Despachos'],
  bpm:   ['Transporte', 'Bodega', 'Higiene'],
};

export default function AreaSelector() {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();

  const mods = user?.modulos || [];
  const AREA_MODS = {
    admin: ['dashboard','finanzas','cuentas-proveedores','cuentas-clientes','gastos','anticipos','personal','proyeccion-semanal','cotizador','cotizador-rapido','cotizador-import','precios','pendientes'],
    oper:  ['stock','entrada','salida','walmart','ventas-gt','ventas-int'],
    bpm:   ['tl','dt','al','bas','rod','limp','vyp','fumigacion','croquis','capacitacion','enfermos','visitas','control-personal','cloro','temperatura','inspecciones','cloro-producto'],
  };
  const puede = (id) => isAdmin(user) || !mods.length || (AREA_MODS[id] || []).some(m => mods.includes(m));
  const visibles = AREAS.filter(a => puede(a.id));

  const hoy = new Date().toLocaleDateString('es-GT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="asel">
      <style>{CSS}</style>

      <header className="asel-head">
        <div className="asel-brand">AJÚA</div>
        <div className="asel-who">
          <span className="asel-name">{user?.nombre || user?.usuario}</span>
          {user?.rol && <span className="asel-chip">{user.rol}</span>}
          <button className="asel-out" onClick={() => { logout(); navigate('/login'); }}>Salir</button>
        </div>
      </header>

      <main className="asel-main">
        <div className="asel-eyebrow">Panel interno · Agroindustria AJÚA</div>
        <p className="asel-sub">Entrá al área en la que vas a trabajar. Cada una abre con su propio menú.</p>

        <div className="asel-grid" data-n={visibles.length}>
          {visibles.map(a => (
            <button key={a.id} className={`asel-card ${a.id}`} onClick={() => navigate(a.home)}>
              <span className="asel-band" />
              <span className="asel-body">
                <span className="asel-emblem" aria-hidden="true">{EMBLEMS[a.id]}</span>
                <span className="asel-title">{a.label}</span>
                <span className="asel-desc">{DESC[a.id]}</span>
                <span className="asel-rule" />
                <span className="asel-subs">
                  {SUBS[a.id].map(s => <span key={s} className="asel-subitem">{s}</span>)}
                </span>
              </span>
              <span className="asel-enter">Entrar
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
              </span>
            </button>
          ))}
        </div>
      </main>

      <footer className="asel-foot">
        <span>AGROINDUSTRIA AJÚA · Guatemala</span>
        <span className="asel-dot" />
        <span className="asel-date">{hoy}</span>
      </footer>
    </div>
  );
}

const CSS = `
.asel {
  --cream:#F8F3E9; --paper:#FDFBF6; --ink:#1A1A18; --muted:#6E6A5F;
  --line:rgba(26,26,24,.10); --forest:#1F3A2C; --ochre:#A8835A; --canopy:#2D6645;
  --serif:'Fraunces',Georgia,'Times New Roman',serif;
  min-height:100vh; display:flex; flex-direction:column;
  font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; color:var(--ink);
  background:radial-gradient(120% 80% at 50% -10%, rgba(45,102,69,.06), transparent 60%), var(--cream);
  -webkit-font-smoothing:antialiased;
}
.asel-head { display:flex; align-items:center; justify-content:space-between; padding:22px clamp(20px,5vw,48px); border-bottom:1px solid var(--line); }
.asel-brand { font-family:var(--serif); font-size:1.5rem; font-weight:700; letter-spacing:.18em; color:var(--forest); }
.asel-who { display:flex; align-items:center; gap:12px; }
.asel-name { font-size:.82rem; color:var(--muted); }
.asel-chip { font-size:.58rem; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--ochre); border:1px solid rgba(168,131,90,.4); padding:3px 9px; border-radius:2px; }
.asel-out { padding:6px 13px; border:1px solid var(--line); background:var(--paper); border-radius:3px; font:inherit; font-size:.72rem; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); cursor:pointer; }
.asel-out:hover { color:var(--forest); border-color:rgba(31,58,44,.3); }

.asel-main { flex:1; display:flex; flex-direction:column; justify-content:center; padding:clamp(28px,6vh,64px) clamp(20px,5vw,48px); max-width:1120px; width:100%; margin:0 auto; }
.asel-eyebrow { font-size:.68rem; font-weight:700; letter-spacing:.28em; text-transform:uppercase; color:var(--ochre); margin-bottom:12px; }
.asel-sub { font-size:1.02rem; color:var(--muted); margin:0 0 clamp(28px,5vh,46px); max-width:52ch; }

.asel-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:clamp(16px,2.2vw,26px); }
.asel-grid[data-n="2"] { grid-template-columns:repeat(2,minmax(0,360px)); justify-content:center; }
.asel-grid[data-n="1"] { grid-template-columns:minmax(0,380px); justify-content:center; }
@media (max-width:800px){ .asel-grid, .asel-grid[data-n="2"] { grid-template-columns:1fr; } }

.asel-card {
  position:relative; display:flex; flex-direction:column; text-align:left; font:inherit; color:inherit;
  background:var(--paper); border:1px solid var(--line); border-radius:6px; padding:0 0 26px; overflow:hidden; cursor:pointer;
  box-shadow:0 1px 2px rgba(26,26,24,.04);
  transition:transform .22s cubic-bezier(.4,0,.2,1), box-shadow .22s, border-color .22s;
  opacity:0; transform:translateY(14px); animation:aselrise .6s cubic-bezier(.2,.7,.2,1) forwards;
}
.asel-card:nth-child(1){ animation-delay:.05s; } .asel-card:nth-child(2){ animation-delay:.14s; } .asel-card:nth-child(3){ animation-delay:.23s; }
@keyframes aselrise { to { opacity:1; transform:translateY(0); } }
.asel-band { height:6px; background:var(--accent); }
.asel-body { padding:26px 26px 0; display:flex; flex-direction:column; gap:12px; flex:1; }
.asel-emblem { width:52px; height:52px; display:flex; align-items:center; justify-content:center; border-radius:50%; background:color-mix(in srgb, var(--accent) 10%, transparent); color:var(--accent); }
.asel-emblem svg { width:28px; height:28px; }
.asel-title { font-family:var(--serif); font-weight:600; font-size:1.42rem; margin-top:2px; color:var(--accent); letter-spacing:-.01em; }
.asel-desc { font-size:.9rem; color:var(--muted); line-height:1.5; }
.asel-rule { height:1px; background:var(--line); margin:4px 0; }
.asel-subs { display:flex; flex-wrap:wrap; }
.asel-subitem { font-size:.74rem; color:var(--muted); }
.asel-subitem:not(:last-child)::after { content:'·'; margin:0 8px; color:var(--line); }
.asel-enter { display:flex; align-items:center; gap:7px; margin:18px 26px 0; font-size:.74rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--accent); opacity:.55; transition:opacity .2s, gap .2s; }
.asel-enter svg { width:15px; height:15px; }
.asel-card:hover, .asel-card:focus-visible { transform:translateY(-6px); box-shadow:0 14px 34px rgba(31,58,44,.14); border-color:color-mix(in srgb, var(--accent) 45%, var(--line)); outline:none; }
.asel-card:hover .asel-enter, .asel-card:focus-visible .asel-enter { opacity:1; gap:12px; }
.asel-card:focus-visible { box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent); }
.asel-card.admin { --accent:var(--forest); } .asel-card.oper { --accent:var(--ochre); } .asel-card.bpm { --accent:var(--canopy); }

.asel-foot { display:flex; gap:10px; justify-content:center; align-items:center; padding:20px; border-top:1px solid var(--line); font-size:.72rem; color:var(--muted); letter-spacing:.04em; }
.asel-dot { width:4px; height:4px; border-radius:50%; background:var(--ochre); }
.asel-date { font-variant-numeric:tabular-nums; text-transform:capitalize; }

@media (prefers-reduced-motion:reduce){ .asel-card { animation:none; opacity:1; transform:none; } .asel-card,.asel-enter { transition:none; } }
`;
