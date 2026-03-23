import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados, useConductores } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', danger: '#C62828',
  warn: '#E65100', textDark: '#1A1A18', textMid: '#6B6B60', border: '#E0E0E0',
};

// ─── Checklist ────────────────────────────────────────────────────────────────
const GRUPOS = [
  {
    label: 'EXTERIOR',
    items: [
      { id: 'lav_furgon',     text: 'Lavado de Furgón' },
      { id: 'lav_carroceria', text: 'Lavado Carrocería' },
    ],
  },
  {
    label: 'INTERIOR',
    items: [
      { id: 'barrido_furgon', text: 'Barrido Furgón' },
      { id: 'desinfeccion',   text: 'Desinfección Agua-Cloro' },
      { id: 'cabina',         text: 'Cabina' },
    ],
  },
];

const ALL_IDS = GRUPOS.flatMap(g => g.items.map(i => i.id));
const initChecks = () => Object.fromEntries(ALL_IDS.map(id => [id, 'na']));
const today = () => new Date().toISOString().slice(0, 10);
const nowHM = () => { const d = new Date(); return d.toTimeString().slice(0, 5); };

function calcScore(checks) {
  const applicable = ALL_IDS.filter(id => checks[id] !== 'na');
  const si = ALL_IDS.filter(id => checks[id] === 'si').length;
  if (applicable.length === 0) return { pct: 0, resultado: null };
  const pct = Math.round((si / applicable.length) * 100);
  const resultado = pct >= 80 ? 'aprobado' : pct >= 60 ? 'aprobado_con_obs' : 'rechazado';
  return { pct, resultado };
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
const iStyle = { padding: '9px 12px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.88rem', outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' };

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
    aprobado:         { bg: '#E8F5E9', c: '#2E7D32', l: '✓ Aprobado' },
    aprobado_con_obs: { bg: '#FFF3E0', c: '#E65100', l: '⚠ Aprobado con obs.' },
    rechazado:        { bg: '#FFEBEE', c: '#C62828', l: '✗ Rechazado' },
  };
  const m = M[resultado] || { bg: '#F5F5F5', c: T.textMid, l: resultado || '—' };
  return <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600, background: m.bg, color: m.c, whiteSpace: 'nowrap' }}>{m.l}</span>;
};

// ─── Tristate toggle: SI | NO | N/A ──────────────────────────────────────────
const BTNS = [
  { val: 'si', label: 'SI',  on: { bg: '#2E7D32', border: '#2E7D32' } },
  { val: 'no', label: 'NO',  on: { bg: '#C62828', border: '#C62828' } },
  { val: 'na', label: 'N/A', on: { bg: '#6B6B60', border: '#6B6B60' } },
];

function Tristate({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      {BTNS.map(({ val, label, on }) => {
        const active = value === val;
        return (
          <button key={val} onClick={() => onChange(val)} style={{
            padding: '5px 11px', borderRadius: 5, fontSize: '.75rem', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s',
            background: active ? on.bg : '#fff',
            border: `1.5px solid ${active ? on.border : T.border}`,
            color: active ? '#fff' : T.textMid,
          }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TL() {
  const toast = useToast();
  const { empleados, loading: empLoading } = useEmpleados();
  const { conductores, loading: condLoading } = useConductores();
  const { data, loading } = useCollection('tl', { orderField: 'fecha', orderDir: 'desc', limit: 50 });
  const { add, saving } = useWrite('tl');

  const [fecha,       setFecha]       = useState(today());
  const [hora,        setHora]        = useState(nowHM());
  const [placa,       setPlaca]       = useState('008');
  const [placaOtra,   setPlacaOtra]   = useState('');
  const [conductor,   setConductor]   = useState('');
  const [tipo,        setTipo]        = useState('Rutina diaria');
  const [checks,      setChecks]      = useState(initChecks);
  const [obs,         setObs]         = useState('');
  const [fotoUrl,     setFotoUrl]     = useState('');

  const setCheck = (id, val) => setChecks(c => ({ ...c, [id]: val }));

  const handleFoto = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setFotoUrl(ev.target.result);
    reader.readAsDataURL(file);
  };

  const { pct, resultado } = calcScore(checks);
  const canSave = fecha && conductor;

  const handleSave = async () => {
    if (!canSave) { toast('Complete fecha y piloto', 'error'); return; }
    const placaFinal = placa === 'Otro' ? (placaOtra || 'Otro') : placa;
    try {
      await add({
        fecha, hora, placa: placaFinal, conductor, tipo,
        checks, pct, resultado, obs, fotoUrl,
        creadoEn: new Date().toISOString(),
      });
      toast('✓ Registro TL guardado');
      setChecks(initChecks());
      setObs('');
      setFotoUrl('');
      setConductor('');
      setHora(nowHM());
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  return (
    <div style={{ color: T.textDark, maxWidth: 900, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>Control de Limpieza y Transporte</h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, marginTop: 4, marginBottom: 0 }}>
          Verificación de limpieza y desinfección del furgón — 2 a 3 veces por semana
        </p>
      </div>

      <Card>
        <SecTitle>Nuevo Registro de Limpieza</SecTitle>

        {/* Row 1: fecha / hora / tipo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 14 }}>
          <Lbl text="Fecha">
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={iStyle} />
          </Lbl>
          <Lbl text="Hora Limpieza">
            <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={iStyle} />
          </Lbl>
          <Lbl text="Tipo de Limpieza">
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ ...iStyle, background: '#fff', cursor: 'pointer' }}>
              <option>Rutina diaria</option>
              <option>Profunda</option>
              <option>Post-descarga</option>
            </select>
          </Lbl>
        </div>

        {/* Row 2: placa / conductor */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 20 }}>
          <Lbl text="Placa del Vehículo">
            <select value={placa} onChange={e => setPlaca(e.target.value)} style={{ ...iStyle, background: '#fff', cursor: 'pointer' }}>
              <option value="008">008</option>
              <option value="125">125</option>
              <option value="Otro">Otro</option>
            </select>
            {placa === 'Otro' && (
              <input type="text" value={placaOtra} onChange={e => setPlacaOtra(e.target.value)}
                placeholder="Ingresá la placa" style={{ ...iStyle, marginTop: 6 }} />
            )}
          </Lbl>

          <Lbl text="Piloto">
            {condLoading ? <Skeleton height={38} /> : (
              <select value={conductor} onChange={e => setConductor(e.target.value)} style={{ ...iStyle, background: '#fff', cursor: 'pointer' }}>
                <option value="">— Seleccionar piloto —</option>
                {conductores.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
            )}
          </Lbl>
        </div>

        {/* Checklist */}
        <p style={{ fontSize: '.68rem', color: T.textMid, marginBottom: 10 }}>Marcar SI / NO / N/A para cada elemento:</p>
        <div style={{ marginBottom: 16 }}>
          {GRUPOS.map((grupo, gi) => (
            <div key={grupo.label}>
              <div style={{ fontSize: '.6rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.secondary, padding: '8px 0 6px', marginTop: gi > 0 ? 8 : 0, borderTop: gi > 0 ? `1px solid ${T.border}` : 'none' }}>
                {grupo.label}
              </div>
              {grupo.items.map((item, idx) => {
                const val = checks[item.id];
                return (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 6, marginBottom: 4,
                    background: val === 'si' ? '#F1F8E9' : val === 'no' ? '#FFF8F8' : idx % 2 === 0 ? '#F9FBF9' : '#fff',
                    border: `1px solid ${val === 'si' ? '#DCEDC8' : val === 'no' ? '#FFCDD2' : T.border}`,
                  }}>
                    <span style={{ flex: 1, fontSize: '.85rem', color: T.textDark }}>{item.text}</span>
                    <Tristate value={val} onChange={nv => setCheck(item.id, nv)} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Score panel */}
        {resultado && (
          <div style={{
            padding: '12px 16px', borderRadius: 8, marginBottom: 16, textAlign: 'center',
            border: `2px solid ${resultado === 'aprobado' ? '#2E7D32' : resultado === 'aprobado_con_obs' ? T.warn : T.danger}`,
            background: resultado === 'aprobado' ? '#E8F5E9' : resultado === 'aprobado_con_obs' ? '#FFF3E0' : '#FFEBEE',
          }}>
            <div style={{ fontSize: '.65rem', color: T.textMid, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>Resultado de Inspección</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: resultado === 'aprobado' ? '#2E7D32' : resultado === 'aprobado_con_obs' ? T.warn : T.danger }}>
              {pct}%
            </div>
            <div style={{ fontSize: '.78rem', fontWeight: 600, marginTop: 2, color: resultado === 'aprobado' ? T.secondary : resultado === 'aprobado_con_obs' ? T.warn : T.danger }}>
              {resultado === 'aprobado' ? '✓ APROBADO' : resultado === 'aprobado_con_obs' ? '⚠ APROBADO CON OBSERVACIONES' : '✗ RECHAZADO'}
            </div>
          </div>
        )}

        {/* Photo */}
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: 14, marginBottom: 14, background: '#F9FBF9' }}>
          <div style={{ fontSize: '.78rem', fontWeight: 600, marginBottom: 8 }}>📷 Foto (opcional)</div>
          <input type="file" accept="image/*" capture="environment" onChange={handleFoto} style={{ fontSize: '.83rem' }} />
          {fotoUrl && (
            <div style={{ marginTop: 10 }}>
              <img src={fotoUrl} alt="Evidencia" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4, border: `1px solid ${T.border}` }} />
              <button onClick={() => setFotoUrl('')} style={{ display: 'block', marginTop: 6, padding: '4px 10px', border: `1.5px solid ${T.danger}`, borderRadius: 4, background: '#fff', color: T.danger, cursor: 'pointer', fontSize: '.75rem', fontFamily: 'inherit' }}>
                ✕ Quitar foto
              </button>
            </div>
          )}
        </div>

        {/* Obs */}
        <Lbl text="Comentarios y Recomendaciones">
          <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Observaciones..." rows={2}
            style={{ ...iStyle, resize: 'vertical' }} />
        </Lbl>

        <button
          onClick={handleSave} disabled={saving || !canSave}
          style={{ marginTop: 16, padding: '11px 28px', background: saving || !canSave ? '#BDBDBD' : T.primary, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem', cursor: saving || !canSave ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
        >
          {saving ? 'Guardando...' : 'Guardar Registro'}
        </button>
      </Card>

      {/* History */}
      <Card>
        <SecTitle>Historial ({loading ? '…' : (data || []).length} registros)</SecTitle>
        {loading ? (
          <Skeleton height={160} />
        ) : (data || []).length === 0 ? (
          <p style={{ textAlign: 'center', padding: 32, color: T.textMid, fontSize: '.85rem' }}>Sin registros aún.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Hora', 'Placa', 'Conductor', 'Tipo', '%', 'Resultado', 'Obs'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data || []).map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FBF9' }}>
                    <td style={TD}>{r.fecha || '—'}</td>
                    <td style={TD}>{r.hora || '—'}</td>
                    <td style={TD}>
                      <span style={{ background: '#F5F5F5', border: `1px solid ${T.border}`, borderRadius: 4, padding: '2px 8px', fontSize: '.78rem', fontWeight: 600 }}>{r.placa || '—'}</span>
                    </td>
                    <td style={TD}>{r.conductor || '—'}</td>
                    <td style={{ ...TD, fontSize: '.78rem' }}>{r.tipo || '—'}</td>
                    <td style={{ ...TD, fontWeight: 700, color: (r.pct || 0) >= 80 ? T.secondary : (r.pct || 0) >= 60 ? T.warn : T.danger }}>
                      {r.pct != null ? `${r.pct}%` : '—'}
                    </td>
                    <td style={TD}><ResultadoBadge resultado={r.resultado} /></td>
                    <td style={{ ...TD, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', color: T.textMid, fontSize: '.78rem' }}>{r.obs || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const TD = { padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', whiteSpace: 'nowrap' };
