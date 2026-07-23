import { useState, useEffect } from 'react';
import { db, doc, getDoc, setDoc } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';

const T = {
  bg: '#F8F3E9', paper: '#FFFFFF', ink: '#1A1A18', forest: '#1F3A2C',
  canopy: '#2D6645', ochre: '#A8835A', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)',
  ok: '#2E7D32', warn: '#B26A00', err: '#B00020',
};

// ─── Estructura de los permisos, agrupados para la UI ──────────────────
const GRUPOS = [
  {
    titulo: 'Páginas que puede ver',
    flags: [
      { k: 'ver_dashboard',   label: 'Dashboard' },
      { k: 'ver_movimientos', label: 'Movimientos' },
      { k: 'ver_empleados',   label: 'Empleados' },
      { k: 'ver_grupos',      label: 'Grupos importación' },
      { k: 'ver_resultados',  label: 'Estado de resultados' },
      { k: 'admin_usuarios_finanzas', label: 'Usuarios y permisos (admin)' },
    ],
  },
  {
    titulo: 'Qué puede cargar',
    flags: [
      { k: 'cargar_pagos',     label: 'Nuevos pagos' },
      { k: 'cargar_cobros',    label: 'Nuevos cobros' },
      { k: 'cargar_gastos_op', label: 'Gastos operativos (supervisor)' },
      { k: 'cargar_sueldos',   label: 'Sueldos / planilla' },
    ],
  },
  {
    titulo: 'Acciones',
    flags: [
      { k: 'marcar_pagado',      label: 'Marcar pagado / cobrado' },
      { k: 'anular',             label: 'Anular movimientos' },
      { k: 'aprobar_pendientes', label: 'Aprobar gastos pendientes' },
      { k: 'exportar',           label: 'Exportar a Excel' },
    ],
  },
  {
    titulo: 'Ocultar información sensible',
    flags: [
      { k: 'hide_utility', label: 'Ocultar utilidad / márgenes' },
      { k: 'hide_sueldos', label: 'Ocultar sueldos de otros' },
    ],
  },
];

const NUMERICOS = [
  { k: 'tope_gastos_op', label: 'Tope gasto directo (Q)',  help: 'Sobre este monto requiere aprobación' },
  { k: 'aprobar_hasta',  label: 'Aprobación hasta (Q)',    help: 'Monto máximo que puede cargar (0 = sin límite extra)' },
  { k: 'historial_dias', label: 'Historial visible (días)', help: '0 = todo el historial' },
];

// Presets rápidos
const PRESETS = {
  auxiliar: {
    label: '📋 Auxiliar administrativo',
    perms: {
      ver_dashboard: true, ver_movimientos: true,
      cargar_pagos: true, cargar_cobros: true, marcar_pagado: true,
      exportar: true, hide_utility: true, hide_sueldos: true,
    },
  },
  supervisor: {
    label: '🦺 Supervisor operativo',
    perms: {
      ver_movimientos: true, cargar_gastos_op: true,
      tope_gastos_op: 500, aprobar_hasta: 2000, historial_dias: 7,
      hide_utility: true, hide_sueldos: true,
    },
  },
  contador: {
    label: '🧮 Contador (solo lectura + export)',
    perms: {
      ver_dashboard: true, ver_movimientos: true, ver_resultados: true,
      exportar: true, hide_utility: false, hide_sueldos: false,
    },
  },
  ninguno: {
    label: '🚫 Sin acceso a Finanzas',
    perms: {},
  },
};

// Todos los flags booleanos en un objeto vacío (para no arrastrar undefined)
const BLANK_PERMS = () => {
  const p = {};
  GRUPOS.forEach(g => g.flags.forEach(f => { p[f.k] = false; }));
  p.tope_gastos_op = 0; p.aprobar_hasta = 0; p.historial_dias = 0;
  return p;
};

export default function FinanzasUsuarios() {
  const { user, getFinanzasPerms } = useAuth();
  const toast = useToast();

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [selId, setSelId]       = useState(null);
  const [draft, setDraft]       = useState(null);

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  const cargar = async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'ajua_bpm', 'main'));
      setUsuarios(snap.exists() ? (snap.data().usuarios || []) : []);
    } catch (e) { toast('Error cargando usuarios: ' + e.message, 'error'); }
    setLoading(false);
  };

  const uKey = u => u.id || u._key || u.usuario || u.nombre;

  const seleccionar = (u) => {
    setSelId(uKey(u));
    // Merge: defaults en blanco + lo que ya tenga guardado
    setDraft({ ...BLANK_PERMS(), ...(u.permisos_finanzas || {}) });
  };

  const aplicarPreset = (key) => {
    setDraft({ ...BLANK_PERMS(), ...PRESETS[key].perms });
    toast(`Preset "${PRESETS[key].label}" aplicado — revisá y guardá`);
  };

  const toggle = (k) => setDraft(d => ({ ...d, [k]: !d[k] }));
  const setNum = (k, v) => setDraft(d => ({ ...d, [k]: parseFloat(v) || 0 }));

  const guardar = async () => {
    if (!selId || !draft) return;
    setSaving(true);
    try {
      // Patrón seguro: leer doc fresco, modificar SOLO el usuario elegido, escribir con spread completo
      const snap = await getDoc(doc(db, 'ajua_bpm', 'main'));
      const prev = snap.exists() ? snap.data() : {};
      const lista = prev.usuarios || [];
      const nuevos = lista.map(u => {
        if (uKey(u) !== selId) return u;
        return { ...u, permisos_finanzas: draft, id: u.id || 'u_' + Date.now() };
      });
      await setDoc(doc(db, 'ajua_bpm', 'main'), { ...prev, usuarios: nuevos });
      setUsuarios(nuevos);
      toast('✓ Permisos guardados');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    setSaving(false);
  };

  const selUsuario = usuarios.find(u => uKey(u) === selId);
  const esAdminSel = selUsuario && (selUsuario.rol === 'admin' || selUsuario.rol === 'superadmin');

  // Resumen legible de qué tiene un usuario
  const resumen = (u) => {
    if (u.rol === 'admin' || u.rol === 'superadmin') return { txt: 'Acceso total (admin)', color: T.canopy };
    const p = u.permisos_finanzas;
    if (!p || typeof p !== 'object') return { txt: 'Sin configurar (defaults)', color: T.muted };
    const vistas = GRUPOS[0].flags.filter(f => p[f.k]).length;
    if (vistas === 0) return { txt: 'Sin acceso', color: T.err };
    if (p.cargar_gastos_op && !p.cargar_pagos) return { txt: `Supervisor · tope Q${p.tope_gastos_op || 0}`, color: T.ochre };
    return { txt: `${vistas} página(s) · configurado`, color: T.forest };
  };

  return (
    <div>
      <div style={{ fontSize: '.82rem', color: T.muted, marginBottom: 4 }}>Finanzas · Usuarios y permisos</div>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.55rem', fontWeight: 600, color: T.forest }}>Usuarios y permisos</h1>
      <div style={{ fontSize: '.85rem', color: T.muted, marginBottom: 20 }}>
        Elegí qué puede hacer cada usuario dentro de Finanzas. Los permisos son <b>por usuario</b>, no por rol fijo.
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>Cargando usuarios…</div>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18, alignItems: 'start' }}>
          {/* Lista de usuarios */}
          <div style={{ background: T.paper, border: `1px solid ${T.rule}` }}>
            <div style={{ padding: '10px 14px', fontSize: '.66rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.muted, borderBottom: `1px solid ${T.rule}` }}>
              {usuarios.length} usuarios
            </div>
            {usuarios.map(u => {
              const r = resumen(u);
              const activo = uKey(u) === selId;
              return (
                <div key={uKey(u)} onClick={() => seleccionar(u)} style={{
                  padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${T.rule}`,
                  borderLeft: `3px solid ${activo ? T.forest : 'transparent'}`,
                  background: activo ? 'rgba(31,58,44,.05)' : 'transparent',
                }}>
                  <div style={{ fontWeight: activo ? 600 : 500, color: T.ink, fontSize: '.9rem' }}>{u.nombre || u.usuario}</div>
                  <div style={{ fontSize: '.72rem', color: T.muted }}>@{u.usuario} · {u.rol || 'operario'}</div>
                  <div style={{ fontSize: '.72rem', color: r.color, marginTop: 2, fontWeight: 600 }}>{r.txt}</div>
                </div>
              );
            })}
            {usuarios.length === 0 && <div style={{ padding: 20, color: T.muted, fontSize: '.85rem' }}>No hay usuarios. Creá usuarios en Administración.</div>}
          </div>

          {/* Editor de permisos */}
          <div style={{ background: T.paper, border: `1px solid ${T.rule}`, padding: 20, minHeight: 300 }}>
            {!draft && (
              <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>👈</div>
                Elegí un usuario de la lista para configurar sus permisos.
              </div>
            )}

            {draft && esAdminSel && (
              <div style={{ padding: 30, textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>👑</div>
                <h3 style={{ color: T.forest, fontFamily: "'Fraunces', serif", marginBottom: 6 }}>{selUsuario.nombre}</h3>
                <p style={{ color: T.muted, fontSize: '.88rem' }}>
                  Es <b>{selUsuario.rol}</b> — tiene acceso total a Finanzas automáticamente.<br/>
                  No requiere configuración de permisos.
                </p>
              </div>
            )}

            {draft && !esAdminSel && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.2rem', fontWeight: 600, color: T.forest }}>{selUsuario?.nombre}</h2>
                    <div style={{ fontSize: '.78rem', color: T.muted }}>@{selUsuario?.usuario}</div>
                  </div>
                  <button onClick={guardar} disabled={saving} style={{
                    padding: '9px 20px', borderRadius: 3, fontWeight: 600, fontSize: '.85rem', cursor: 'pointer',
                    border: `1.5px solid ${T.forest}`, background: T.forest, color: 'white', opacity: saving ? 0.5 : 1,
                  }}>{saving ? 'Guardando…' : '💾 Guardar permisos'}</button>
                </div>

                {/* Presets rápidos */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: '.66rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.muted, marginBottom: 6 }}>Plantillas rápidas</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(PRESETS).map(([k, p]) => (
                      <button key={k} onClick={() => aplicarPreset(k)} style={{
                        padding: '6px 12px', border: `1px solid ${T.rule}`, background: 'white', borderRadius: 3,
                        cursor: 'pointer', fontSize: '.78rem', fontWeight: 600, color: T.forest,
                      }}>{p.label}</button>
                    ))}
                  </div>
                </div>

                {/* Grupos de checkboxes */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                  {GRUPOS.map(g => (
                    <div key={g.titulo} style={{ border: `1px solid ${T.rule}`, borderRadius: 4, padding: '12px 14px' }}>
                      <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.ochre, marginBottom: 8 }}>{g.titulo}</div>
                      {g.flags.map(f => (
                        <label key={f.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: '.86rem' }}>
                          <input type="checkbox" checked={!!draft[f.k]} onChange={() => toggle(f.k)} style={{ width: 16, height: 16, accentColor: T.forest }} />
                          <span>{f.label}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Numéricos */}
                <div style={{ marginTop: 16, border: `1px solid ${T.rule}`, borderRadius: 4, padding: '12px 14px' }}>
                  <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.ochre, marginBottom: 10 }}>Límites numéricos</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    {NUMERICOS.map(n => (
                      <div key={n.k}>
                        <label style={{ display: 'block', fontSize: '.8rem', fontWeight: 600, marginBottom: 3, color: T.ink }}>{n.label}</label>
                        <input type="number" min="0" value={draft[n.k] ?? 0} onChange={e => setNum(n.k, e.target.value)} style={{
                          width: '100%', padding: '7px 10px', border: `1.5px solid ${T.rule}`, borderRadius: 3, fontSize: '.88rem', boxSizing: 'border-box',
                        }} />
                        <div style={{ fontSize: '.7rem', color: T.muted, marginTop: 2 }}>{n.help}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
