import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', danger: '#C62828',
  warn: '#E65100', textDark: '#1A1A18', textMid: '#6B6B60', border: '#E0E0E0',
};

// ─── Trap definitions ─────────────────────────────────────────────────────────
const ZONAS = [
  {
    zona: 'PORTÓN',
    icon: '🚪',
    trampas: [
      { id: 'T1',  nombre: 'Trampa Portón Izq' },
      { id: 'T2',  nombre: 'Trampa Portón Der' },
    ],
  },
  {
    zona: 'PARQUEO',
    icon: '🚗',
    trampas: [
      { id: 'T3',  nombre: 'Trampa Parqueo Norte' },
      { id: 'T4',  nombre: 'Trampa Parqueo Sur' },
    ],
  },
  {
    zona: 'PRE-CARGA',
    icon: '📦',
    trampas: [
      { id: 'T5',  nombre: 'Pre-carga Ent' },
      { id: 'T6',  nombre: 'Pre-carga Centro' },
      { id: 'T7',  nombre: 'Pre-carga Sal' },
      { id: 'T8',  nombre: 'Pre-carga Ext' },
    ],
  },
  {
    zona: 'BODEGA',
    icon: '🏭',
    trampas: [
      { id: 'T9',  nombre: 'Bodega Norte' },
      { id: 'T10', nombre: 'Bodega Sur' },
    ],
  },
  {
    zona: 'PALLETS',
    icon: '🪵',
    trampas: [
      { id: 'T11', nombre: 'Área Pallets' },
    ],
  },
];

const ALL_TRAMPAS = ZONAS.flatMap(z => z.trampas.map(t => ({ ...t, zona: z.zona })));
const TOTAL = ALL_TRAMPAS.length;

const initTrampas = () =>
  ALL_TRAMPAS.map(t => ({ id: t.id, nombre: t.nombre, zona: t.zona, estado: 'sin_revisar', obs: '' }));

const today = () => new Date().toISOString().slice(0, 10);
const nowHM = () => { const d = new Date(); return d.toTimeString().slice(0, 5); };

// ─── Shared UI ────────────────────────────────────────────────────────────────
const iStyle = {
  padding: '9px 12px', border: `1.5px solid ${T.border}`, borderRadius: 6,
  fontSize: '.88rem', outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box',
};

const Lbl = ({ text, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <span style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary }}>{text}</span>
    {children}
  </label>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 24, marginBottom: 20, ...style }}>
    {children}
  </div>
);

const SecTitle = ({ children }) => (
  <div style={{ fontSize: '.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.secondary, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
    {children}
  </div>
);

const ResultadoBadge = ({ resultado }) => {
  const M = {
    sin_novedades: { bg: '#E8F5E9', c: '#2E7D32', l: '✓ Sin novedades' },
    con_novedades: { bg: '#FFEBEE', c: '#C62828', l: '⚠ Con novedades' },
  };
  const m = M[resultado] || { bg: '#F5F5F5', c: T.textMid, l: resultado || '—' };
  return <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600, background: m.bg, color: m.c, whiteSpace: 'nowrap' }}>{m.l}</span>;
};

// ─── Trap estado button ───────────────────────────────────────────────────────
const ESTADOS = [
  { val: 'en_lugar',    label: 'En lugar ✓', bg: '#2E7D32' },
  { val: 'novedad',     label: 'Novedad ⚠',  bg: '#E65100' },
  { val: 'sin_revisar', label: 'Sin revisar', bg: '#9E9E9E' },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function ROD() {
  const toast = useToast();
  const { empleados, loading: empLoading } = useEmpleados();
  const { data, loading } = useCollection('rod', { orderField: 'fecha', orderDir: 'desc', limit: 50 });
  const { add, saving } = useWrite('rod');

  const [fecha,       setFecha]       = useState(today());
  const [hora,        setHora]        = useState(nowHM());
  const [responsable, setResponsable] = useState('');
  const [trampas,     setTrampas]     = useState(initTrampas);
  const [obs,         setObs]         = useState('');
  const [editId,      setEditId]      = useState(null);   // which trap name is being edited
  const [editVal,     setEditVal]     = useState('');

  const setTrampa = (id, field, value) =>
    setTrampas(prev => prev.map(t => t.id !== id ? t : { ...t, [field]: value }));

  const startRename = (t) => { setEditId(t.id); setEditVal(t.nombre); };
  const commitRename = () => {
    if (editId && editVal.trim()) setTrampa(editId, 'nombre', editVal.trim());
    setEditId(null);
  };

  // Live summary
  const revisadas  = trampas.filter(t => t.estado !== 'sin_revisar').length;
  const enLugar    = trampas.filter(t => t.estado === 'en_lugar').length;
  const conNovedad = trampas.filter(t => t.estado === 'novedad').length;
  const sinRev     = trampas.filter(t => t.estado === 'sin_revisar').length;

  const canSave = fecha && responsable;

  const handleSave = async () => {
    if (!canSave) { toast('Complete fecha y responsable', 'error'); return; }
    const resultado = conNovedad > 0 ? 'con_novedades' : 'sin_novedades';
    try {
      await add({
        fecha, hora, responsable,
        traps: trampas.map(t => ({
          id: t.id, nombre: t.nombre, zona: t.zona,
          estado: t.estado,
          obs: t.estado === 'novedad' ? t.obs : '',
        })),
        resultado, obs,
        creadoEn: new Date().toISOString(),
      });
      toast('✓ Revisión ROD guardada');
      setTrampas(initTrampas());
      setObs('');
      setResponsable('');
      setHora(nowHM());
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  return (
    <div style={{ color: T.textDark, maxWidth: 900, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>Control de Plagas y Roedores</h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, marginTop: 4, marginBottom: 0 }}>
          Revisión de las {TOTAL} trampas — Portón · Parqueo · Pre-carga · Bodega · Pallets
        </p>
      </div>

      <Card>
        <SecTitle>Nueva Revisión</SecTitle>

        {/* Row: fecha / hora / responsable */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 20 }}>
          <Lbl text="Fecha">
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={iStyle} />
          </Lbl>
          <Lbl text="Hora de Revisión">
            <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={iStyle} />
          </Lbl>
          <Lbl text="Responsable">
            {empLoading ? <Skeleton height={38} /> : (
              <select value={responsable} onChange={e => setResponsable(e.target.value)} style={{ ...iStyle, background: '#fff', cursor: 'pointer' }}>
                <option value="">— Seleccionar responsable —</option>
                {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}{e.cargo ? ' · ' + e.cargo : ''}</option>)}
              </select>
            )}
          </Lbl>
        </div>

        {/* Live summary bar */}
        <div style={{ padding: '10px 14px', borderRadius: 6, marginBottom: 20, fontSize: '.82rem', border: `1px solid ${T.border}`, background: '#F9FBF9', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <span>Revisadas: <strong style={{ color: T.secondary }}>{revisadas}/{TOTAL}</strong></span>
          <span>En lugar: <strong style={{ color: T.secondary }}>{enLugar}</strong></span>
          <span>Novedad: <strong style={{ color: T.warn }}>{conNovedad}</strong></span>
          <span>Sin revisar: <strong style={{ color: T.textMid }}>{sinRev}</strong></span>
        </div>

        {/* Trap zones */}
        {ZONAS.map((zona, zi) => (
          <div key={zona.zona}>
            <div style={{ fontSize: '.6rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.secondary, padding: '8px 0 6px', marginTop: zi > 0 ? 8 : 0, borderTop: zi > 0 ? `1px solid ${T.border}` : 'none' }}>
              {zona.icon} {zona.zona}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {trampas.filter(t => t.zona === zona.zona).map(t => (
                <div key={t.id} style={{
                  background: t.estado === 'novedad' ? '#FFF8F8' : t.estado === 'en_lugar' ? '#F1F8E9' : '#F9FBF9',
                  border: `1px solid ${t.estado === 'novedad' ? '#FFCDD2' : t.estado === 'en_lugar' ? '#DCEDC8' : T.border}`,
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {/* ID chip */}
                    <span style={{ background: t.estado === 'novedad' ? T.danger : T.primary, color: '#fff', borderRadius: 4, padding: '3px 8px', fontSize: '.72rem', fontWeight: 700, minWidth: 36, textAlign: 'center', flexShrink: 0 }}>
                      {t.id}
                    </span>

                    {/* Trap name (editable) */}
                    {editId === t.id ? (
                      <input
                        autoFocus value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={e => e.key === 'Enter' && commitRename()}
                        style={{ padding: '4px 8px', border: `1.5px solid ${T.secondary}`, borderRadius: 5, fontSize: '.83rem', fontFamily: 'inherit', outline: 'none', width: 180 }}
                      />
                    ) : (
                      <span style={{ flex: 1, fontWeight: 500, fontSize: '.85rem', minWidth: 140 }}>
                        {t.nombre}
                        <button onClick={() => startRename(t)} title="Renombrar trampa" style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: '.72rem', color: T.textMid, padding: '0 3px' }}>✏</button>
                      </span>
                    )}

                    {/* Estado buttons */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                      {ESTADOS.map(({ val, label, bg }) => {
                        const active = t.estado === val;
                        return (
                          <button key={val} onClick={() => setTrampa(t.id, 'estado', val)} style={{
                            padding: '6px 12px', borderRadius: 6, border: '1.5px solid', cursor: 'pointer',
                            fontSize: '.78rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all .12s',
                            background: active ? bg : '#fff',
                            borderColor: active ? bg : T.border,
                            color: active ? '#fff' : T.textMid,
                          }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Per-trap obs when novedad */}
                  {t.estado === 'novedad' && (
                    <div style={{ marginTop: 8 }}>
                      <input
                        type="text" value={t.obs}
                        onChange={e => setTrampa(t.id, 'obs', e.target.value)}
                        placeholder="Describir la novedad encontrada..."
                        style={{ padding: '7px 12px', border: `1.5px solid ${T.danger}`, borderRadius: 6, fontSize: '.83rem', outline: 'none', width: '100%', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Result preview */}
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: conNovedad > 0 ? '#FFEBEE' : '#E8F5E9',
          border: `1px solid ${conNovedad > 0 ? '#FFCDD2' : '#C8E6C9'}`,
          fontSize: '.83rem', fontWeight: 600,
          color: conNovedad > 0 ? T.danger : T.secondary,
        }}>
          {conNovedad > 0
            ? `⚠ Con novedades — ${conNovedad} trampa(s) requieren atención`
            : `✓ Sin novedades — ${enLugar} trampa(s) en su lugar`}
        </div>

        {/* General obs */}
        <Lbl text="Observaciones Generales">
          <textarea value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Actividad detectada, acciones tomadas, novedades..." rows={2}
            style={{ ...iStyle, resize: 'vertical' }} />
        </Lbl>

        <button
          onClick={handleSave} disabled={saving || !canSave}
          style={{ marginTop: 16, padding: '11px 28px', background: saving || !canSave ? '#BDBDBD' : T.primary, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem', cursor: saving || !canSave ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
        >
          {saving ? 'Guardando...' : 'Guardar Revisión'}
        </button>
      </Card>

      {/* History */}
      <Card>
        <SecTitle>Historial de Revisiones ({loading ? '…' : (data || []).length} registros)</SecTitle>
        {loading ? (
          <Skeleton height={160} />
        ) : (data || []).length === 0 ? (
          <p style={{ textAlign: 'center', padding: 32, color: T.textMid, fontSize: '.85rem' }}>Sin revisiones registradas.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Hora', 'Responsable', 'Revisadas', 'Novedades', 'Resultado'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data || []).map((r, i) => {
                  const traps = r.traps || r.trampas || [];
                  const rev  = traps.filter(t => t.estado !== 'sin_revisar').length;
                  const nov  = traps.filter(t => t.estado === 'novedad').length;
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FBF9' }}>
                      <td style={TD}>{r.fecha || '—'}</td>
                      <td style={TD}>{r.hora || '—'}</td>
                      <td style={TD}>{r.responsable || r.resp || '—'}</td>
                      <td style={{ ...TD, textAlign: 'center', color: T.secondary, fontWeight: 600 }}>{rev}/{TOTAL}</td>
                      <td style={{ ...TD, textAlign: 'center', color: nov > 0 ? T.danger : T.textMid, fontWeight: nov > 0 ? 700 : 400 }}>{nov}</td>
                      <td style={TD}><ResultadoBadge resultado={r.resultado} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const TD = { padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', whiteSpace: 'nowrap' };
