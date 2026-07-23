import { useMemo, useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';

const T = {
  bg: '#F8F3E9', paper: '#FFFFFF', ink: '#1A1A18', forest: '#1F3A2C',
  canopy: '#2D6645', ochre: '#A8835A', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)',
  ok: '#2E7D32', warn: '#B26A00', err: '#B00020', sand: '#E7DDC9',
};

const fmt = (n) => Number.isFinite(n) ? n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
const monedaSym = { GTQ: 'Q', MXN: '$', USD: '$' };
const fmtMon = (n, mon) => `${monedaSym[mon] || 'Q'} ${fmt(n)}${mon && mon !== 'GTQ' ? ' ' + mon : ''}`;

export default function FinanzasGrupos() {
  const { getFinanzasPerms } = useAuth();
  const perms = getFinanzasPerms();
  const toast = useToast();

  const { data: grupos, loading: lg } = useCollection('grupos_finanzas', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { data: movs, loading: lm } = useCollection('movimientos_finanzas', { orderField: 'fecha', orderDir: 'desc', limit: 1000 });
  const { add: addGrupo, update: updGrupo, remove: removeGrupo, saving: savGrupo } = useWrite('grupos_finanzas');
  const { update: updMov } = useWrite('movimientos_finanzas');

  const [selId, setSelId] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Movimientos por grupo
  const movsDeGrupo = useMemo(() => {
    const map = {};
    for (const m of (movs || [])) {
      if (m.grupoId) { (map[m.grupoId] = map[m.grupoId] || []).push(m); }
    }
    return map;
  }, [movs]);

  // Rentabilidad de un grupo
  const rentabilidad = (grupoId) => {
    const lista = movsDeGrupo[grupoId] || [];
    let costos = 0, ingresos = 0;
    for (const m of lista) {
      const monto = parseFloat(m.montoGTQ ?? m.monto) || 0;
      if (m.tipo === 'cobro') ingresos += monto;
      else costos += monto; // pago o gasto_op
    }
    return { costos, ingresos, utilidad: ingresos - costos, count: lista.length };
  };

  const crearGrupo = async () => {
    if (!nuevoNombre.trim()) { toast('Ingresá un nombre', 'error'); return; }
    setCreando(true);
    try {
      const id = await addGrupo({
        nombre: nuevoNombre.trim(),
        tipo: 'importacion',
        estado: 'abierto',
        fecha: new Date().toISOString().slice(0, 10),
        creadoEn: new Date().toISOString(),
      });
      setNuevoNombre('');
      setSelId(id);
      toast('✓ Grupo creado');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    setCreando(false);
  };

  const asignar = async (mov) => {
    try {
      await updMov(mov.id, { grupoId: selId });
      toast('✓ Movimiento agregado al grupo');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  const quitar = async (mov) => {
    try {
      await updMov(mov.id, { grupoId: null });
      toast('Movimiento quitado del grupo');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  const eliminarGrupo = async (g) => {
    const lista = movsDeGrupo[g.id] || [];
    if (!window.confirm(`¿Eliminar el grupo "${g.nombre}"?${lista.length ? `\n\nLos ${lista.length} movimientos se desasignan (NO se borran).` : ''}`)) return;
    try {
      // Desasignar todos sus movimientos primero
      for (const m of lista) { await updMov(m.id, { grupoId: null }); }
      await removeGrupo(g.id);
      if (selId === g.id) setSelId(null);
      toast('Grupo eliminado');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  const cerrarAbrir = async (g) => {
    try {
      await updGrupo(g.id, { estado: g.estado === 'cerrado' ? 'abierto' : 'cerrado' });
      toast(g.estado === 'cerrado' ? 'Grupo reabierto' : '✓ Grupo cerrado');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  const sinAsignar = useMemo(() => (movs || []).filter(m => !m.grupoId), [movs]);
  const selGrupo = (grupos || []).find(g => g.id === selId);
  const loading = lg || lm;

  return (
    <div>
      <div style={{ fontSize: '.82rem', color: T.muted, marginBottom: 4 }}>Finanzas · Grupos importación</div>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.55rem', fontWeight: 600, color: T.forest }}>Grupos importación</h1>
      <div style={{ fontSize: '.85rem', color: T.muted, marginBottom: 20 }}>
        Agrupá pagos y cobros sueltos en un contenedor/importación para ver su rentabilidad real.
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>Cargando…</div>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 18, alignItems: 'start' }}>
          {/* Columna izquierda: grupos */}
          <div>
            {perms.cargar_pagos && (
              <div style={{ background: T.paper, border: `1px solid ${T.rule}`, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: '.66rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.muted, marginBottom: 6 }}>Nuevo grupo</div>
                <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && crearGrupo()}
                  placeholder="ej: Contenedor #14 — Zanahoria" style={{ width: '100%', padding: '7px 10px', border: `1.5px solid ${T.rule}`, borderRadius: 3, fontSize: '.85rem', boxSizing: 'border-box', marginBottom: 8 }} />
                <button onClick={crearGrupo} disabled={creando || savGrupo} style={{ width: '100%', padding: '8px', border: `1.5px solid ${T.forest}`, background: T.forest, color: 'white', borderRadius: 3, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', opacity: (creando || savGrupo) ? 0.5 : 1 }}>
                  + Crear grupo
                </button>
              </div>
            )}

            <div style={{ background: T.paper, border: `1px solid ${T.rule}` }}>
              <div style={{ padding: '10px 12px', fontSize: '.66rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.muted, borderBottom: `1px solid ${T.rule}` }}>
                {(grupos || []).length} grupos
              </div>
              {(grupos || []).map(g => {
                const r = rentabilidad(g.id);
                const activo = g.id === selId;
                return (
                  <div key={g.id} onClick={() => { setSelId(g.id); setPickerOpen(false); }} style={{
                    padding: '10px 12px', cursor: 'pointer', borderBottom: `1px solid ${T.rule}`,
                    borderLeft: `3px solid ${activo ? T.forest : 'transparent'}`,
                    background: activo ? 'rgba(31,58,44,.05)' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontWeight: activo ? 600 : 500, fontSize: '.88rem', color: T.forest }}>{g.nombre}</span>
                      {g.estado === 'cerrado' && <span style={{ fontSize: '.62rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase' }}>cerrado</span>}
                    </div>
                    <div style={{ fontSize: '.72rem', color: T.muted, marginTop: 2 }}>{r.count} movimientos</div>
                    {r.count > 0 && (
                      <div style={{ fontSize: '.74rem', marginTop: 3, fontWeight: 600, color: r.utilidad >= 0 ? T.ok : T.err }}>
                        {r.utilidad >= 0 ? '▲' : '▼'} Q {fmt(r.utilidad)}
                        {!perms.hide_utility && r.ingresos > 0 && <span style={{ color: T.muted, fontWeight: 400 }}> · {(r.utilidad / r.ingresos * 100).toFixed(0)}%</span>}
                      </div>
                    )}
                  </div>
                );
              })}
              {(grupos || []).length === 0 && <div style={{ padding: 20, color: T.muted, fontSize: '.85rem' }}>Sin grupos. Creá el primero arriba.</div>}
            </div>
          </div>

          {/* Columna derecha: detalle */}
          <div style={{ background: T.paper, border: `1px solid ${T.rule}`, padding: 20, minHeight: 300 }}>
            {!selGrupo && (
              <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📦</div>
                Elegí un grupo para ver su detalle y rentabilidad.
              </div>
            )}

            {selGrupo && (() => {
              const r = rentabilidad(selGrupo.id);
              const lista = movsDeGrupo[selGrupo.id] || [];
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    <div>
                      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.2rem', fontWeight: 600, color: T.forest }}>{selGrupo.nombre}</h2>
                      <div style={{ fontSize: '.76rem', color: T.muted }}>Creado {selGrupo.fecha} · {selGrupo.estado || 'abierto'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => cerrarAbrir(selGrupo)} style={btnMini}>{selGrupo.estado === 'cerrado' ? 'Reabrir' : 'Cerrar'}</button>
                      {perms.anular && <button onClick={() => eliminarGrupo(selGrupo)} style={{ ...btnMini, borderColor: T.err, color: T.err }}>Eliminar</button>}
                    </div>
                  </div>

                  {/* Rentabilidad */}
                  <div style={{ display: 'grid', gridTemplateColumns: perms.hide_utility ? '1fr' : 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                    <Kpi lbl="Costos" val={`Q ${fmt(r.costos)}`} color={T.err} />
                    {!perms.hide_utility && <Kpi lbl="Ingresos" val={`Q ${fmt(r.ingresos)}`} color={T.canopy} />}
                    {!perms.hide_utility && <Kpi lbl="Rentabilidad" val={`Q ${fmt(r.utilidad)}`} color={r.utilidad >= 0 ? T.ok : T.err} sub={r.ingresos > 0 ? `${(r.utilidad / r.ingresos * 100).toFixed(1)}%` : ''} />}
                  </div>

                  {/* Botón asignar */}
                  {selGrupo.estado !== 'cerrado' && (perms.cargar_pagos || perms.cargar_cobros) && (
                    <button onClick={() => setPickerOpen(o => !o)} style={{ marginBottom: 12, padding: '7px 14px', border: `1.5px solid ${T.ochre}`, background: pickerOpen ? T.ochre : 'white', color: pickerOpen ? 'white' : T.ochre, borderRadius: 3, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer' }}>
                      {pickerOpen ? '✕ Cerrar selector' : `+ Asignar movimientos (${sinAsignar.length} sin agrupar)`}
                    </button>
                  )}

                  {/* Picker de movimientos sin asignar */}
                  {pickerOpen && (
                    <div style={{ border: `1px dashed ${T.ochre}`, borderRadius: 4, padding: 10, marginBottom: 16, maxHeight: 240, overflowY: 'auto' }}>
                      {sinAsignar.length === 0 && <div style={{ color: T.muted, fontSize: '.82rem', padding: 8 }}>No hay movimientos sin agrupar.</div>}
                      {sinAsignar.map(m => (
                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderBottom: `1px solid ${T.rule}`, fontSize: '.82rem' }}>
                          <span>
                            <span style={{ color: m.tipo === 'cobro' ? T.canopy : T.err, fontWeight: 600 }}>{m.tipo === 'cobro' ? '↓' : '↑'}</span>
                            {' '}{m.fecha} · {m.concepto || m.categoria} · <b>{fmtMon(parseFloat(m.monto) || 0, m.moneda)}</b>
                          </span>
                          <button onClick={() => asignar(m)} style={{ ...btnMini, borderColor: T.canopy, color: T.canopy }}>+ Agregar</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Movimientos del grupo */}
                  <div style={{ fontSize: '.66rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.muted, marginBottom: 6 }}>Movimientos del grupo ({lista.length})</div>
                  {lista.length === 0 && <div style={{ color: T.muted, fontSize: '.85rem', padding: 8 }}>Todavía no hay movimientos. Usá "Asignar movimientos".</div>}
                  {lista.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 8px', borderBottom: `1px solid ${T.rule}`, fontSize: '.84rem' }}>
                      <span>
                        <span style={{ color: m.tipo === 'cobro' ? T.canopy : T.err, fontWeight: 600 }}>{m.tipo === 'cobro' ? '↓ cobro' : '↑ ' + (m.categoria || 'pago')}</span>
                        {' · '}{m.fecha} · {m.concepto || '—'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <b style={{ fontFamily: 'monospace' }}>{fmtMon(parseFloat(m.monto) || 0, m.moneda)}</b>
                        {selGrupo.estado !== 'cerrado' && perms.anular && <button onClick={() => quitar(m)} title="Quitar del grupo" style={{ ...btnMini, padding: '2px 7px', borderColor: T.rule, color: T.muted }}>✕</button>}
                      </span>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ lbl, val, sub, color }) {
  return (
    <div style={{ background: T.bg, padding: '10px 12px', borderTop: `3px solid ${color}`, border: `1px solid ${T.rule}` }}>
      <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.muted }}>{lbl}</div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: '1.2rem', fontWeight: 600, marginTop: 2, color, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
      {sub && <div style={{ fontSize: '.7rem', color: T.muted }}>{sub}</div>}
    </div>
  );
}

const btnMini = { padding: '4px 10px', border: `1px solid ${T.rule}`, background: 'white', borderRadius: 3, cursor: 'pointer', fontSize: '.74rem', fontWeight: 600, color: T.forest };
