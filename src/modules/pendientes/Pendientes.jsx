import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { notificar, useNotifications } from '../../hooks/useNotifications';
import { db, doc, getDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot } from '../../firebase';
import { arrayUnion } from 'firebase/firestore';

// ── Design tokens ──────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32',
  danger: '#C62828', warn: '#E65100', info: '#1565C0',
  textDark: '#1A1A18', textMid: '#6B6B60',
  border: '#E0E0E0', bgGreen: '#E8F5E9',
};
const WHITE  = '#FFFFFF';
const shadow = '0 1px 3px rgba(0,0,0,.10)';
const card   = { background: WHITE, borderRadius: 10, boxShadow: shadow, padding: 20, marginBottom: 16 };
const btn    = (bg, disabled) => ({
  padding: '8px 16px', background: disabled ? '#ccc' : bg, color: WHITE,
  border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.82rem',
  cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
});
const IS = {
  padding: '8px 11px', border: `1.5px solid ${T.border}`, borderRadius: 6,
  fontSize: '.88rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
};

function fmtFecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fechaVencida(iso) {
  if (!iso) return false;
  return iso < new Date().toISOString().slice(0, 10);
}
function fechaHoy() { return new Date().toISOString().slice(0, 10); }

// ── Chip de prioridad ──────────────────────────────────────────────
function PrioChip({ prioridad }) {
  if (prioridad !== 'alta') return null;
  return (
    <span style={{ padding: '2px 8px', background: '#FFEBEE', color: T.danger, borderRadius: 100, fontSize: '.68rem', fontWeight: 700, letterSpacing: '.04em' }}>
      URGENTE
    </span>
  );
}

// ── Modal genérico ─────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: WHITE, borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: T.textDark }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: T.textMid, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </div>
  );
}

// ── Selector de usuarios ───────────────────────────────────────────
function UsuariosSelector({ usuarios, selected, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {usuarios.map(u => {
        const id = u.id || u.usuario;
        const sel = selected.includes(id);
        return (
          <button key={id} type="button" onClick={() => onChange(sel ? selected.filter(x => x !== id) : [...selected, id])}
            style={{ padding: '4px 12px', borderRadius: 100, fontSize: '.78rem', fontWeight: 600, cursor: 'pointer',
              background: sel ? T.primary : '#F0F4F0', color: sel ? WHITE : T.textMid,
              border: `1.5px solid ${sel ? T.primary : T.border}` }}>
            {u.nombre || u.usuario}
          </button>
        );
      })}
    </div>
  );
}

// ── Form crear/editar tarea ────────────────────────────────────────
function TareaForm({ usuarios, inicial, onSave, onCancel, saving }) {
  const [titulo,      setTitulo]      = useState(inicial?.titulo      || '');
  const [descripcion, setDescripcion] = useState(inicial?.descripcion || '');
  const [asignadoA,   setAsignadoA]   = useState(inicial?.asignadoA   || []);
  const [fechaLimite, setFechaLimite] = useState(inicial?.fechaLimite || '');
  const [prioridad,   setPrioridad]   = useState(inicial?.prioridad   || 'normal');

  const valid = titulo.trim().length > 0 && asignadoA.length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onSave({ titulo: titulo.trim(), descripcion: descripcion.trim(), asignadoA, fechaLimite: fechaLimite || null, prioridad });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, color: T.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Tarea *</label>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Descripción de la tarea…" style={IS} autoFocus />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, color: T.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Detalle (opcional)</label>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3}
          placeholder="Instrucciones adicionales…" style={{ ...IS, resize: 'vertical' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, color: T.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Asignar a *</label>
        <UsuariosSelector usuarios={usuarios} selected={asignadoA} onChange={setAsignadoA} />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, color: T.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Fecha límite</label>
          <input type="date" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)} style={IS} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, color: T.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Prioridad</label>
          <select value={prioridad} onChange={e => setPrioridad(e.target.value)} style={IS}>
            <option value="normal">Normal</option>
            <option value="alta">Urgente</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
        <button type="button" onClick={onCancel} style={{ ...btn('#888'), background: '#888' }}>Cancelar</button>
        <button type="submit" disabled={!valid || saving} style={btn(T.primary, !valid || saving)}>
          {saving ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Crear tarea'}
        </button>
      </div>
    </form>
  );
}

// ── Card de tarea ──────────────────────────────────────────────────
function TareaCard({ tarea, user, isAdmin, usuarios, onUpdate, onDelete }) {
  const toast = useToast();
  const [expanded,    setExpanded]    = useState(false);
  const [showDone,    setShowDone]    = useState(false);
  const [showEdit,    setShowEdit]    = useState(false);
  const [resultado,   setResultado]   = useState('');
  const [comentario,  setComentario]  = useState('');
  const [saving,      setSaving]      = useState(false);

  const isDone    = tarea.estado === 'completado';
  const vencida   = !isDone && fechaVencida(tarea.fechaLimite);

  // Nombres de asignados
  const nombresAsig = useMemo(() => {
    return (tarea.asignadoA || []).map(id => {
      const u = usuarios.find(x => (x.id || x.usuario) === id);
      return u ? (u.nombre || u.usuario) : id;
    }).join(', ');
  }, [tarea.asignadoA, usuarios]);

  const handleMarcarDone = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'pendientesEquipo', tarea.id), {
        estado:       'completado',
        resultado:    resultado.trim(),
        completadoPor: user.nombre || user.usuario,
        completadoEn: new Date().toISOString(),
      });
      toast('Tarea marcada como completada');
      setShowDone(false);
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    } finally { setSaving(false); }
  };

  const handleReabrir = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'pendientesEquipo', tarea.id), {
        estado: 'pendiente', resultado: '', completadoPor: '', completadoEn: '',
      });
      toast('Tarea reabierta');
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    } finally { setSaving(false); }
  };

  const handleComentario = async () => {
    if (!comentario.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'pendientesEquipo', tarea.id), {
        comentarios: arrayUnion({
          texto:      comentario.trim(),
          autorId:    user.id || user.usuario,
          autorNombre: user.nombre || user.usuario,
          fecha:      new Date().toISOString(),
        }),
      });
      setComentario('');
      toast('Comentario agregado');
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    } finally { setSaving(false); }
  };

  const borderColor = isDone ? '#A5D6A7' : vencida ? '#FFCDD2' : tarea.prioridad === 'alta' ? '#FFCDD2' : T.border;
  const bgHeader    = isDone ? '#F1F8F1' : vencida ? '#FFF8F8' : WHITE;

  return (
    <div style={{ borderRadius: 10, border: `1.5px solid ${borderColor}`, background: WHITE, marginBottom: 12, overflow: 'hidden', boxShadow: shadow }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', background: bgHeader, cursor: 'pointer' }} onClick={() => setExpanded(o => !o)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: '.93rem', color: isDone ? T.textMid : T.textDark,
                textDecoration: isDone ? 'line-through' : 'none' }}>
                {tarea.titulo}
              </span>
              <PrioChip prioridad={tarea.prioridad} />
              {isDone && (
                <span style={{ padding: '2px 8px', background: T.bgGreen, color: T.secondary, borderRadius: 100, fontSize: '.68rem', fontWeight: 700 }}>
                  ✓ COMPLETADO
                </span>
              )}
              {vencida && (
                <span style={{ padding: '2px 8px', background: '#FFEBEE', color: T.danger, borderRadius: 100, fontSize: '.68rem', fontWeight: 700 }}>
                  VENCIDA
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '.77rem', color: T.textMid }}>
              <span>👤 {nombresAsig || '—'}</span>
              {tarea.fechaLimite && (
                <span style={{ color: vencida ? T.danger : T.textMid }}>
                  📅 {fmtFecha(tarea.fechaLimite)}
                </span>
              )}
              {(tarea.comentarios?.length > 0) && (
                <span>💬 {tarea.comentarios.length}</span>
              )}
              <span style={{ color: '#aaa' }}>Por {tarea.creadoPorNombre}</span>
            </div>
          </div>
          <span style={{ color: T.textMid, fontSize: '.8rem', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ padding: '14px 16px', borderTop: `1px solid ${T.border}` }}>
          {tarea.descripcion && (
            <p style={{ margin: '0 0 14px', fontSize: '.86rem', color: T.textDark, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {tarea.descripcion}
            </p>
          )}

          {/* Resultado si está completada */}
          {isDone && tarea.resultado && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#F1F8F1', border: `1px solid #C8E6C9`, borderRadius: 8 }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: T.secondary, marginBottom: 4 }}>RESULTADO</div>
              <div style={{ fontSize: '.86rem', color: T.textDark }}>{tarea.resultado}</div>
              <div style={{ fontSize: '.74rem', color: T.textMid, marginTop: 4 }}>
                — {tarea.completadoPor} · {tarea.completadoEn ? new Date(tarea.completadoEn).toLocaleDateString('es-GT') : ''}
              </div>
            </div>
          )}

          {/* Comentarios */}
          {(tarea.comentarios?.length > 0) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: T.textMid, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Comentarios</div>
              {tarea.comentarios.map((c, i) => (
                <div key={i} style={{ padding: '8px 12px', background: '#F8F8F8', borderRadius: 8, marginBottom: 6, fontSize: '.83rem' }}>
                  <span style={{ fontWeight: 600, color: T.textDark }}>{c.autorNombre}</span>
                  <span style={{ color: T.textMid, fontSize: '.75rem', marginLeft: 8 }}>
                    {c.fecha ? new Date(c.fecha).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  <div style={{ marginTop: 3, color: T.textDark }}>{c.texto}</div>
                </div>
              ))}
            </div>
          )}

          {/* Agregar comentario */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input value={comentario} onChange={e => setComentario(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComentario(); }}}
              placeholder="Agregar comentario…" style={{ ...IS, flex: 1 }} />
            <button onClick={handleComentario} disabled={!comentario.trim() || saving}
              style={btn(T.info, !comentario.trim() || saving)}>Comentar</button>
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!isDone && (
              <button onClick={() => setShowDone(true)} style={btn(T.secondary)}>
                ✓ Marcar finalizado
              </button>
            )}
            {isDone && isAdmin && (
              <button onClick={handleReabrir} disabled={saving} style={btn(T.warn, saving)}>
                Reabrir tarea
              </button>
            )}
            {isAdmin && (
              <>
                <button onClick={() => setShowEdit(true)} style={btn(T.info)}>Editar</button>
                <button onClick={() => onDelete(tarea.id)} style={btn(T.danger)}>Eliminar</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal marcar done */}
      {showDone && (
        <Modal title="Marcar como finalizado" onClose={() => setShowDone(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: '.88rem', color: T.textDark }}>
              <b>{tarea.titulo}</b>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, color: T.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Resultado / Observaciones
              </label>
              <textarea value={resultado} onChange={e => setResultado(e.target.value)} rows={3}
                placeholder="Describe qué se hizo o el resultado obtenido…"
                style={{ ...IS, resize: 'vertical' }} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDone(false)} style={btn('#888')}>Cancelar</button>
              <button onClick={handleMarcarDone} disabled={saving} style={btn(T.secondary, saving)}>
                {saving ? 'Guardando…' : '✓ Confirmar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal editar (solo admin) */}
      {showEdit && isAdmin && (
        <Modal title="Editar tarea" onClose={() => setShowEdit(false)}>
          <TareaForm
            usuarios={usuarios}
            inicial={tarea}
            saving={saving}
            onCancel={() => setShowEdit(false)}
            onSave={async (data) => {
              setSaving(true);
              try {
                await updateDoc(doc(db, 'pendientesEquipo', tarea.id), data);
                toast('Tarea actualizada');
                setShowEdit(false);
              } catch (e) { toast('Error: ' + e.message, 'error'); }
              finally { setSaving(false); }
            }}
          />
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function Pendientes() {
  const { user, isAdmin: checkAdmin } = useAuth();
  const isAdmin  = checkAdmin();
  const toast    = useToast();
  const { permission, requestPermission } = useNotifications();

  const [tareas,   setTareas]   = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filtro,   setFiltro]   = useState('pendiente'); // 'pendiente' | 'completado' | 'todas'

  const userId       = user?.id || user?.usuario;
  const prevTareas   = useRef(null); // para detectar cambios nuevos

  // ── Cargar usuarios ────────────────────────────────────────────
  useEffect(() => {
    getDoc(doc(db, 'ajua_bpm', 'main')).then(snap => {
      if (snap.exists()) setUsuarios(snap.data().usuarios || []);
    }).catch(() => {});
  }, []);

  // ── Listener tareas en tiempo real + detección de cambios ──────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'pendientesEquipo'),
      snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => {
          if (a.prioridad === 'alta' && b.prioridad !== 'alta') return -1;
          if (b.prioridad === 'alta' && a.prioridad !== 'alta') return 1;
          const fa = a.fechaLimite || '9999';
          const fb = b.fechaLimite || '9999';
          if (fa !== fb) return fa < fb ? -1 : 1;
          return (a.creadoEn || '') < (b.creadoEn || '') ? 1 : -1;
        });

        // Notificar cambios después de la carga inicial
        if (prevTareas.current !== null) {
          const prev = prevTareas.current;
          docs.forEach(t => {
            const esAsignado = (t.asignadoA || []).includes(userId);
            if (!esAsignado && !isAdmin) return;

            const anterior = prev.find(p => p.id === t.id);

            // Tarea nueva asignada a mí
            if (!anterior && esAsignado) {
              notificar('Nueva tarea asignada', t.titulo);
              return;
            }

            if (!anterior) return;

            // Comentario nuevo
            const comentariosAntes = anterior.comentarios?.length || 0;
            const comentariosAhora = t.comentarios?.length || 0;
            if (comentariosAhora > comentariosAntes) {
              const ultimo = t.comentarios[t.comentarios.length - 1];
              if (ultimo?.autorId !== userId) {
                notificar(
                  `Comentario en: ${t.titulo}`,
                  `${ultimo?.autorNombre || 'Alguien'}: ${ultimo?.texto || ''}`
                );
              }
            }

            // Tarea completada (notificar al creador si es admin)
            if (anterior.estado !== 'completado' && t.estado === 'completado' && isAdmin) {
              notificar(`Tarea completada`, `${t.titulo} — por ${t.completadoPor}`);
            }
          });
        }

        prevTareas.current = docs;
        setTareas(docs);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [userId, isAdmin]); // eslint-disable-line

  // ── Filtrar según rol ──────────────────────────────────────────
  const tareasFiltradas = useMemo(() => {
    let lista = isAdmin ? tareas : tareas.filter(t => (t.asignadoA || []).includes(userId));
    if (filtro === 'pendiente')  lista = lista.filter(t => t.estado !== 'completado');
    if (filtro === 'completado') lista = lista.filter(t => t.estado === 'completado');
    return lista;
  }, [tareas, filtro, isAdmin, userId]);

  // ── Contadores ─────────────────────────────────────────────────
  const counts = useMemo(() => {
    const base = isAdmin ? tareas : tareas.filter(t => (t.asignadoA || []).includes(userId));
    return {
      pendiente:  base.filter(t => t.estado !== 'completado').length,
      completado: base.filter(t => t.estado === 'completado').length,
      todas:      base.length,
    };
  }, [tareas, isAdmin, userId]);

  // ── Crear tarea ────────────────────────────────────────────────
  const handleCrear = useCallback(async (data) => {
    setSaving(true);
    try {
      await addDoc(collection(db, 'pendientesEquipo'), {
        ...data,
        estado:        'pendiente',
        resultado:     '',
        completadoPor: '',
        completadoEn:  '',
        comentarios:   [],
        creadoPor:     userId,
        creadoPorNombre: user?.nombre || user?.usuario || '',
        creadoEn:      new Date().toISOString(),
      });
      toast('Tarea creada');
      setShowForm(false);
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    } finally { setSaving(false); }
  }, [user, userId, toast]);

  // ── Eliminar tarea (solo admin) ────────────────────────────────
  const handleDelete = useCallback(async (id) => {
    if (!isAdmin) return;
    if (!window.confirm('¿Eliminar esta tarea? No se puede deshacer.')) return;
    try {
      await deleteDoc(doc(db, 'pendientesEquipo', id));
      toast('Tarea eliminada');
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }
  }, [isAdmin, toast]);

  const pendientesUrgentes = counts.pendiente > 0 && tareasFiltradas.some(t => t.prioridad === 'alta' && t.estado !== 'completado');

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: T.textDark, fontFamily: 'var(--font-heading, inherit)' }}>
            Pendientes Equipo
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '.84rem', color: T.textMid }}>
            {isAdmin ? 'Vista de administrador — todas las tareas' : `Mis tareas asignadas`}
            {pendientesUrgentes && <span style={{ marginLeft: 10, color: T.danger, fontWeight: 700 }}>⚠ Hay tareas urgentes</span>}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={btn(T.primary)}>+ Nueva tarea</button>
      </div>

      {/* Banner activar notificaciones */}
      {permission === 'default' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#FFF8E1', border: `1px solid #FFE082`, borderRadius: 8, marginBottom: 16, fontSize: '.84rem', color: '#5D4037' }}>
          <span>🔔 Activa las notificaciones para recibir alertas de nuevas tareas y comentarios.</span>
          <button onClick={async () => { const ok = await requestPermission(); if (ok) toast('Notificaciones activadas'); }} style={{ ...btn(T.warn), padding: '5px 14px', flexShrink: 0 }}>
            Activar
          </button>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#F5F5F5', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'pendiente',  label: `Pendientes (${counts.pendiente})` },
          { key: 'completado', label: `Completadas (${counts.completado})` },
          { key: 'todas',      label: `Todas (${counts.todas})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            style={{ padding: '7px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '.82rem', fontWeight: 600, transition: 'all .15s',
              background: filtro === f.key ? WHITE : 'transparent',
              color: filtro === f.key ? T.primary : T.textMid,
              boxShadow: filtro === f.key ? shadow : 'none' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ color: T.textMid, padding: 32, textAlign: 'center' }}>Cargando tareas…</div>
      ) : tareasFiltradas.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '40px 20px', color: T.textMid }}>
          {filtro === 'pendiente' ? '¡Sin tareas pendientes!' : 'Sin tareas en esta categoría.'}
        </div>
      ) : (
        tareasFiltradas.map(t => (
          <TareaCard
            key={t.id}
            tarea={t}
            user={user}
            isAdmin={isAdmin}
            usuarios={usuarios}
            onDelete={handleDelete}
          />
        ))
      )}

      {/* Modal nueva tarea */}
      {showForm && (
        <Modal title="Nueva tarea" onClose={() => setShowForm(false)}>
          <TareaForm
            usuarios={usuarios}
            saving={saving}
            onCancel={() => setShowForm(false)}
            onSave={handleCrear}
          />
        </Modal>
      )}
    </div>
  );
}
