import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', danger: '#C62828',
  warn: '#E65100', textDark: '#1A1A18', textMid: '#6B6B60',
  border: '#E0E0E0', bgGreen: '#E8F5E9',
  white: '#FFFFFF', bgLight: '#F5F5F5', bgCard: '#FFFFFF', accent: '#43A047',
};

const BASCULAS = [
  { id: 'B1', nombre: 'Báscula Principal (500kg)' },
  { id: 'B2', nombre: 'Báscula Secundaria (200kg)' },
  { id: 'B3', nombre: 'Báscula Pequeña (50kg)' },
  { id: 'B4', nombre: 'Báscula Digital (5kg)' },
];

const today = () => new Date().toISOString().slice(0, 10);
const nowHM  = () => { const d = new Date(); return d.toTimeString().slice(0, 5); };

const inputStyle = {
  padding: '9px 12px', border: `1.5px solid ${T.border}`, borderRadius: 6,
  fontSize: '.88rem', outline: 'none', width: '100%', fontFamily: 'inherit',
  boxSizing: 'border-box', background: T.white,
};

const Lbl = ({ text, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <span style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary }}>{text}</span>
    {children}
  </label>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 24, marginBottom: 20, ...style }}>
    {children}
  </div>
);

const SectionTitle = ({ children }) => (
  <div style={{ fontSize: '.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.secondary, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
    {children}
  </div>
);

const Badge = ({ resultado }) => {
  const map = {
    ok:      { bg: T.bgGreen,  c: T.secondary, l: '✓ OK' },
    alerta:  { bg: '#FFEBEE',  c: T.danger,    l: '⚠ Alerta' },
    parcial: { bg: '#FFF3E0',  c: T.warn,      l: 'Parcial' },
  };
  const m = map[resultado] || { bg: T.bgLight, c: T.textMid, l: resultado || '—' };
  return <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600, background: m.bg, color: m.c }}>{m.l}</span>;
};

// ─── BAS main ─────────────────────────────────────────────────────────────────
export default function BAS() {
  const toast = useToast();
  const { empleados, loading: empLoading } = useEmpleados();
  const { data: registros, loading: histLoading } = useCollection('bas', { orderField: 'creadoEn', orderDir: 'desc', limit: 200 });
  const { data: calibraciones, loading: calLoading } = useCollection('bas_calibraciones', { orderField: 'fechaCal', orderDir: 'desc', limit: 100 });
  const { add: addBas, saving: savingBas } = useWrite('bas');
  const { add: addCal, saving: savingCal } = useWrite('bas_calibraciones');

  const [tab, setTab] = useState('revision');

  // ── Tab 1: Revisión Diaria ─────────────────────────────────────────────────
  const [fecha, setFecha]         = useState(today());
  const [hora, setHora]           = useState(nowHM());
  const [responsable, setResp]    = useState('');
  // basEstado: { B1: 'ok'|'variacion'|'', B2: ... }
  const [basEstado, setBasEstado] = useState({});
  // variacionGramos: { B1: '', B2: ... }
  const [variacion, setVariacion] = useState({});
  const [obs, setObs]             = useState('');

  const setEstado = (bid, estado) => setBasEstado(prev => ({ ...prev, [bid]: estado }));
  const setVar    = (bid, val)    => setVariacion(prev => ({ ...prev, [bid]: val }));

  const handleSave = async () => {
    if (!fecha || !responsable) { toast('Complete fecha y responsable', 'error'); return; }
    const basculas = BASCULAS.map(b => ({
      id: b.id, nombre: b.nombre,
      estado: basEstado[b.id] || '',
      variacionGramos: basEstado[b.id] === 'variacion' ? (variacion[b.id] || null) : null,
    }));
    const fail = basculas.filter(b => b.estado === 'variacion').length;
    const ok   = basculas.filter(b => b.estado === 'ok').length;
    const resultado = fail > 0 ? 'alerta' : ok === 4 ? 'ok' : 'parcial';
    try {
      await addBas({ fecha, hora, responsable, basculas, resultado, obs, creadoEn: new Date().toISOString() });
      toast('Revisión de básculas guardada');
      setBasEstado({}); setVariacion({}); setObs(''); setResp('');
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  // Last calibration per bascula
  const lastCal = (bid) => {
    if (!calibraciones) return null;
    return calibraciones.find(c => c.basculaId === bid);
  };

  // ── Tab 2: Calibraciones ──────────────────────────────────────────────────
  const [fechaCal, setFechaCal]           = useState(today());
  const [basculaId, setBasculaId]         = useState('B1');
  const [empresa, setEmpresa]             = useState('');
  const [tecnico, setTecnico]             = useState('');
  const [motivo, setMotivo]               = useState('');
  const [proximaCal, setProximaCal]       = useState('');
  const [calObs, setCalObs]               = useState('');
  const [calFotoUrl, setCalFotoUrl]       = useState('');

  const handleSaveCal = async () => {
    if (!fechaCal || !empresa) { toast('Complete fecha y empresa calibradora', 'error'); return; }
    try {
      await addCal({
        fechaCal, basculaId, empresa, tecnico, motivo, proximaCalibracion: proximaCal,
        obs: calObs, fotoUrl: calFotoUrl, creadoEn: new Date().toISOString(),
      });
      toast('Calibración registrada');
      setEmpresa(''); setTecnico(''); setMotivo(''); setProximaCal(''); setCalObs(''); setCalFotoUrl('');
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: T.textDark, maxWidth: 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Verificación de Básculas
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, marginTop: 4, marginBottom: 0 }}>
          Masa madre: 10 libras — Revisión diaria de las 4 básculas
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `2px solid ${T.border}` }}>
        {[{ key: 'revision', label: 'Revisión Diaria' }, { key: 'calibraciones', label: 'Calibraciones' }].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '.85rem', fontWeight: 600, borderRadius: '6px 6px 0 0',
              background: tab === t.key ? T.primary : 'transparent',
              color: tab === t.key ? T.white : T.textMid,
              borderBottom: tab === t.key ? `2px solid ${T.primary}` : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Revisión ── */}
      {tab === 'revision' && (
        <>
          <Card>
            <SectionTitle>Nueva Revisión</SectionTitle>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 18 }}>
              <Lbl text="Fecha">
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
              </Lbl>
              <Lbl text="Responsable">
                {empLoading ? <Skeleton height={38} /> : (
                  <select value={responsable} onChange={e => setResp(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">— Seleccionar responsable —</option>
                    {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                  </select>
                )}
              </Lbl>
              <Lbl text="Hora de Revisión">
                <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={inputStyle} />
              </Lbl>
            </div>

            <div style={{ fontSize: '.6rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.secondary, padding: '8px 0', borderTop: `1px solid ${T.border}`, marginBottom: 10 }}>
              Las 4 Básculas — Masa madre: 10.00 lbs
            </div>

            {BASCULAS.map(b => {
              const estado = basEstado[b.id] || '';
              const cal    = lastCal(b.id);
              return (
                <div key={b.id} style={{
                  padding: '12px 14px', borderRadius: 8, marginBottom: 8,
                  border: `1.5px solid ${estado === 'ok' ? '#DCEDC8' : estado === 'variacion' ? '#FFCC80' : T.border}`,
                  background: estado === 'ok' ? '#F9FEF5' : estado === 'variacion' ? '#FFFDE7' : T.bgLight,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: `${T.bgGreen}`, border: `1.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.78rem', fontWeight: 700, color: T.secondary, flexShrink: 0 }}>
                      {b.id}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '.84rem', fontWeight: 600 }}>{b.nombre}</div>
                      {cal && (
                        <div style={{ fontSize: '.64rem', color: T.textMid, marginTop: 2 }}>
                          Última cal: {cal.fechaCal || '—'} — Próxima: {cal.proximaCalibracion || '—'}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setEstado(b.id, estado === 'ok' ? '' : 'ok')}
                        style={{
                          padding: '7px 16px', borderRadius: 6, border: `2px solid`, cursor: 'pointer', fontWeight: 700, fontSize: '.8rem', fontFamily: 'inherit', transition: 'all .15s',
                          background: estado === 'ok' ? T.bgGreen : T.white,
                          borderColor: estado === 'ok' ? T.secondary : T.border,
                          color: estado === 'ok' ? T.secondary : T.textMid,
                        }}
                      >
                        ✓ OK
                      </button>
                      <button
                        onClick={() => setEstado(b.id, estado === 'variacion' ? '' : 'variacion')}
                        style={{
                          padding: '7px 16px', borderRadius: 6, border: `2px solid`, cursor: 'pointer', fontWeight: 700, fontSize: '.8rem', fontFamily: 'inherit', transition: 'all .15s',
                          background: estado === 'variacion' ? '#FFF3E0' : T.white,
                          borderColor: estado === 'variacion' ? T.warn : T.border,
                          color: estado === 'variacion' ? T.warn : T.textMid,
                        }}
                      >
                        ⚠ Variación
                      </button>
                    </div>
                  </div>
                  {estado === 'variacion' && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid #FFE082` }}>
                      <input
                        type="number"
                        value={variacion[b.id] || ''}
                        onChange={e => setVar(b.id, e.target.value)}
                        placeholder="Variación en gramos"
                        style={{ ...inputStyle, maxWidth: 240, borderColor: T.warn }}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <Lbl text="Observaciones Generales">
                <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Novedades, acciones tomadas..." style={{ ...inputStyle, resize: 'vertical' }} />
              </Lbl>
            </div>

            <button
              onClick={handleSave}
              disabled={savingBas}
              style={{ padding: '11px 28px', background: savingBas ? '#BDBDBD' : T.primary, color: T.white, border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem', cursor: savingBas ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {savingBas ? 'Guardando...' : 'Guardar Revisión'}
            </button>
          </Card>

          {/* History Tab 1 */}
          <Card>
            <SectionTitle>Historial de Revisiones</SectionTitle>
            {histLoading ? <Skeleton height={160} /> : (registros || []).length === 0 ? (
              <p style={{ textAlign: 'center', padding: 32, color: T.textMid }}>Sin revisiones registradas.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: T.primary }}>
                      {['Fecha', 'Hora', 'Responsable', 'B1', 'B2', 'B3', 'B4', 'Resultado', 'Obs'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: T.white, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(registros || []).slice(0, 100).map((r, i) => (
                      <tr key={r.id} style={{ background: i % 2 === 0 ? T.white : '#F9FBF9' }}>
                        <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600 }}>{r.fecha || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.hora || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.responsable || '—'}</td>
                        {(r.basculas || []).map(b => (
                          <td key={b.id} style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0', textAlign: 'center' }}>
                            {b.estado === 'ok'
                              ? <span style={{ color: T.secondary, fontWeight: 700 }}>✓</span>
                              : b.estado === 'variacion'
                              ? <span style={{ color: T.warn, fontWeight: 700 }}>⚠{b.variacionGramos ? ` ${b.variacionGramos}g` : ''}</span>
                              : <span style={{ color: T.textMid }}>—</span>}
                          </td>
                        ))}
                        {!(r.basculas || []).length && <><td/><td/><td/><td/></>}
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }}><Badge resultado={r.resultado} /></td>
                        <td style={{ padding: '8px 12px', fontSize: '.75rem', borderBottom: '1px solid #F0F0F0', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.obs || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Tab 2: Calibraciones ── */}
      {tab === 'calibraciones' && (
        <>
          <Card>
            <SectionTitle>Registrar Calibración</SectionTitle>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 14 }}>
              <Lbl text="Báscula">
                <select value={basculaId} onChange={e => setBasculaId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {BASCULAS.map(b => <option key={b.id} value={b.id}>{b.id} — {b.nombre}</option>)}
                </select>
              </Lbl>
              <Lbl text="Fecha de Calibración">
                <input type="date" value={fechaCal} onChange={e => setFechaCal(e.target.value)} style={inputStyle} />
              </Lbl>
              <Lbl text="Próxima Calibración">
                <input type="date" value={proximaCal} onChange={e => setProximaCal(e.target.value)} style={inputStyle} />
              </Lbl>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <Lbl text="Empresa Calibradora">
                <input type="text" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Nombre de la empresa" style={inputStyle} />
              </Lbl>
              <Lbl text="Técnico Responsable">
                <input type="text" value={tecnico} onChange={e => setTecnico(e.target.value)} placeholder="Nombre del técnico" style={inputStyle} />
              </Lbl>
            </div>

            <div style={{ marginBottom: 14 }}>
              <Lbl text="Motivo">
                <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Calibración semestral, falla detectada..." style={inputStyle} />
              </Lbl>
            </div>

            <div style={{ marginBottom: 14 }}>
              <Lbl text="Observaciones / Resultado">
                <textarea value={calObs} onChange={e => setCalObs(e.target.value)} rows={2} placeholder="Resultado de la calibración, ajustes realizados..." style={{ ...inputStyle, resize: 'vertical' }} />
              </Lbl>
            </div>

            {/* Photo */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: T.textMid }}>
                Foto Certificado (opcional)
                <input type="file" accept="image/*" capture="environment"
                  onChange={e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setCalFotoUrl(ev.target.result); r.readAsDataURL(f); }}
                  style={{ fontSize: '.82rem', color: T.textDark }} />
              </label>
              {calFotoUrl && <img src={calFotoUrl} alt="foto" style={{ marginTop: 8, maxWidth: '100%', maxHeight: 200, borderRadius: 6, objectFit: 'cover' }} />}
            </div>

            <button
              onClick={handleSaveCal}
              disabled={savingCal}
              style={{ padding: '11px 28px', background: savingCal ? '#BDBDBD' : T.primary, color: T.white, border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem', cursor: savingCal ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {savingCal ? 'Guardando...' : 'Registrar Calibración'}
            </button>
          </Card>

          {/* History calibraciones */}
          <Card>
            <SectionTitle>Historial de Calibraciones</SectionTitle>
            {calLoading ? <Skeleton height={120} /> : (calibraciones || []).length === 0 ? (
              <p style={{ textAlign: 'center', padding: 32, color: T.textMid }}>Sin calibraciones registradas.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: T.primary }}>
                      {['Fecha', 'Báscula', 'Empresa', 'Técnico', 'Próxima Cal', 'Obs'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: T.white, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(calibraciones || []).slice(0, 100).map((r, i) => (
                      <tr key={r.id} style={{ background: i % 2 === 0 ? T.white : '#F9FBF9' }}>
                        <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600 }}>{r.fechaCal || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.basculaId || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.empresa || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.tecnico || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.proximaCalibracion || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: '.75rem', borderBottom: '1px solid #F0F0F0', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.obs || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
