import { useState, useRef } from 'react';
import { useEmpleados } from '../../hooks/useMainData';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', accent: '#43A047',
  white: '#FFFFFF', bgLight: '#F5F5F5', bgCard: '#FFFFFF',
  border: '#E0E0E0', textDark: '#1A1A18', textMid: '#6B6B60',
  danger: '#C62828', warn: '#E65100', green2: '#E8F5E9',
};

// ─── Data from bpm.html (exact) ───────────────────────────────────────────────
const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const VP_ITEMS = [
  { nivel: 'NIVEL 1', item: 'Dispensador de jabón 1' },
  { nivel: 'NIVEL 1', item: 'Dispensador de Gel' },
  { nivel: 'NIVEL 1', item: 'Lámpara 1' },
  { nivel: 'NIVEL 1', item: 'Lámpara 2' },
  { nivel: 'NIVEL 1', item: 'Lámpara 3' },
  { nivel: 'NIVEL 1', item: 'Lámpara 4' },
  { nivel: 'NIVEL 1', item: 'Ventilador 1' },
  { nivel: 'NIVEL 1', item: 'Ventilador 2' },
  { nivel: 'NIVEL 1', item: 'Ventilador 3' },
  { nivel: 'NIVEL 1', item: 'Ventilador 4' },
  { nivel: 'NIVEL 1', item: 'Trampa para roedores 1' },
  { nivel: 'NIVEL 1', item: 'Trampa para roedores 2' },
  { nivel: 'NIVEL 2', item: 'Dispensador de jabón 1' },
  { nivel: 'NIVEL 2', item: 'Trampa para roedores 3' },
  { nivel: 'NIVEL 2', item: 'Trampa para roedores 4' },
  { nivel: 'NIVEL 2', item: 'Ventilador 1' },
  { nivel: 'NIVEL 2', item: 'Ventilador 2' },
  { nivel: 'NIVEL 2', item: 'Ventilador 3' },
  { nivel: 'NIVEL 2', item: 'Lámpara 1' },
  { nivel: 'NIVEL 2', item: 'Lámpara 2' },
  { nivel: 'NIVEL 2', item: 'Lámpara 3' },
];

const VYP_AREAS = [
  'Bodega','Pre-carga','Cooler 1','Cooler 2','Parqueo','Oficina','Baños','Otro',
];

const VYP_TIPOS   = ['Vidrio','Plástico','Ambos'];
const VYP_ACCIONES = ['Retirado','Reportado','Pendiente'];

const today  = () => new Date().toISOString().slice(0, 10);
const curMes = () => MESES[new Date().getMonth()];

// ─── Shared UI helpers ────────────────────────────────────────────────────────
const inp = (val, onChange, type = 'text', extra = {}) => (
  <input type={type} value={val} onChange={e => onChange(e.target.value)}
    style={{ padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
      fontSize: '.88rem', outline: 'none', width: '100%', fontFamily: 'inherit',
      boxSizing: 'border-box', ...extra }} />
);

const sel = (val, onChange, opts) => (
  <select value={val} onChange={e => onChange(e.target.value)}
    style={{ padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
      fontSize: '.88rem', outline: 'none', width: '100%', fontFamily: 'inherit',
      background: '#fff', cursor: 'pointer' }}>
    {opts}
  </select>
);

const Lbl = ({ text, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <span style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.07em', color: T.secondary }}>{text}</span>
    {children}
  </label>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10,
    padding: 24, marginBottom: 20, ...style }}>
    {children}
  </div>
);

const SecTitle = ({ children }) => (
  <div style={{ fontSize: '.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em',
    color: T.secondary, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
    {children}
  </div>
);

const CatHeader = ({ text }) => (
  <div style={{ fontSize: '.65rem', letterSpacing: '.1em', textTransform: 'uppercase',
    color: T.secondary, fontWeight: 700, padding: '8px 0 4px',
    borderBottom: `1px solid ${T.border}`, marginBottom: 4 }}>
    {text}
  </div>
);

const ThCell = ({ children }) => (
  <th style={{ padding: '9px 12px', textAlign: 'left', color: T.white,
    fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
    {children}
  </th>
);
const TdCell = ({ children, style = {} }) => (
  <td style={{ padding: '8px 12px', fontSize: '.82rem', borderBottom: '1px solid #F0F0F0', ...style }}>
    {children}
  </td>
);

const EmpSel = ({ value, onChange, empleados, empLoading }) => empLoading
  ? <Skeleton height={38} />
  : sel(value, onChange,
      <>
        <option value="">— Seleccionar responsable —</option>
        {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}{e.cargo ? ' · ' + e.cargo : ''}</option>)}
      </>
    );

// SI/NO/NA tristate for VP inventory
function Tristate3({ value, onChange }) {
  const opts = [
    { v: 'cumple',    l: 'SI',  ac: T.accent },
    { v: 'no_cumple', l: 'NO',  ac: T.danger },
    { v: 'na',        l: 'N/A', ac: T.textMid },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      {opts.map(o => (
        <button key={o.v} onClick={() => onChange(o.v === value ? '' : o.v)}
          style={{ padding: '4px 9px', borderRadius: 5, border: '1.5px solid',
            cursor: 'pointer', fontWeight: 700, fontSize: '.75rem', fontFamily: 'inherit',
            background: value === o.v ? o.ac : T.white,
            borderColor: value === o.v ? o.ac : T.border,
            color: value === o.v ? T.white : T.textMid }}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

// ─── Tab 1: Inventario Mensual (collection: vp) ───────────────────────────────
function TabVP({ empleados, empLoading }) {
  const toast = useToast();
  const { data: registros, loading: histLoading } = useCollection('vp', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { add, remove, saving } = useWrite('vp');

  const initChecks = () => VP_ITEMS.map(() => '');
  const [fecha, setFecha]   = useState(today());
  const [resp, setResp]     = useState('');
  const [mes, setMes]       = useState(curMes());
  const [checks, setChecks] = useState(initChecks);

  const setCheck = (i, v) => setChecks(prev => prev.map((c, idx) => idx === i ? v : c));

  const ok  = checks.filter(c => c === 'cumple').length;
  const nok = checks.filter(c => c === 'no_cumple').length;
  const pct = (ok + nok) > 0 ? Math.round(ok / (ok + nok) * 100) : 0;

  const handleSave = async () => {
    if (!fecha || !resp) { toast('⚠ Complete fecha y responsable', 'error'); return; }
    try {
      await add({ fecha, mes, resp, checks, ok, nok });
      toast('✓ Revisión de vidrio y plástico guardada');
      setChecks(initChecks());
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  let lastNivel = '';
  return (
    <>
      <Card>
        <SecTitle>Nueva Revisión Mensual</SecTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
          <Lbl text="Fecha de Revisión">{inp(fecha, setFecha, 'date')}</Lbl>
          <Lbl text="Responsable"><EmpSel value={resp} onChange={setResp} empleados={empleados} empLoading={empLoading} /></Lbl>
          <Lbl text="Mes de Revisión">
            {sel(mes, setMes, MESES.map(m => <option key={m} value={m}>{m}</option>))}
          </Lbl>
        </div>

        <div style={{ overflowX: 'auto', marginBottom: 14 }}>
          {VP_ITEMS.map((x, i) => {
            const showNivel = x.nivel !== lastNivel;
            if (showNivel) lastNivel = x.nivel;
            return (
              <div key={i}>
                {showNivel && <CatHeader text={x.nivel} />}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ flex: 1, marginRight: 12 }}>
                    <div style={{ fontSize: '.72rem', color: T.textMid }}>{x.nivel}</div>
                    <div style={{ fontSize: '.85rem', color: T.textDark }}>{x.item}</div>
                  </div>
                  <Tristate3 value={checks[i]} onChange={v => setCheck(i, v)} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '10px 22px', background: saving ? '#BDBDBD' : T.primary,
              color: T.white, border: 'none', borderRadius: 6, fontWeight: 700,
              fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Guardando...' : 'Guardar Revisión'}
          </button>
        </div>
      </Card>

      <Card>
        <SecTitle>Historial de Revisiones</SecTitle>
        {histLoading ? <Skeleton height={100} /> : (registros || []).length === 0
          ? <p style={{ textAlign: 'center', padding: 32, color: T.textMid, fontSize: '.85rem' }}>Sin registros</p>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.primary }}>
                    {['Fecha','Mes','Responsable','Cumplen','No Cumplen','% OK',''].map(h => <ThCell key={h}>{h}</ThCell>)}
                  </tr>
                </thead>
                <tbody>
                  {(registros || []).slice(0, 100).map((r, i) => {
                    const p = (r.ok + r.nok) > 0 ? Math.round(r.ok / (r.ok + r.nok) * 100) : 0;
                    return (
                      <tr key={r.id} style={{ background: i % 2 === 0 ? T.white : '#F9FBF9' }}>
                        <TdCell style={{ fontWeight: 600 }}>{r.fecha}</TdCell>
                        <TdCell>{r.mes || '—'}</TdCell>
                        <TdCell>{r.resp || '—'}</TdCell>
                        <TdCell style={{ color: T.accent, fontWeight: 600 }}>{r.ok ?? '—'}</TdCell>
                        <TdCell style={{ color: T.danger, fontWeight: 600 }}>{r.nok ?? '—'}</TdCell>
                        <TdCell style={{ fontWeight: 700, color: p >= 80 ? T.accent : T.danger }}>{p}%</TdCell>
                        <TdCell>
                          <button onClick={() => remove(r.id)}
                            style={{ background: 'none', border: `1px solid ${T.border}`,
                              borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
                              fontSize: '.75rem', color: T.textMid }}>✕</button>
                        </TdCell>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </>
  );
}

// ─── Tab 2: Hallazgos (collection: vyp) ──────────────────────────────────────
function TabVYP({ empleados, empLoading }) {
  const toast = useToast();
  const { data: registros, loading: histLoading } = useCollection('vyp', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { add, remove, saving } = useWrite('vyp');

  const [fecha, setFecha]   = useState(today());
  const [area, setArea]     = useState('');
  const [resp, setResp]     = useState('');
  const [tipo, setTipo]     = useState('Vidrio');
  const [accion, setAccion] = useState('Retirado');
  const [desc, setDesc]     = useState('');
  const [foto, setFoto]     = useState(null);
  const fotoRef             = useRef(null);

  const handleFoto = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setFoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const clearFoto = () => {
    setFoto(null);
    if (fotoRef.current) fotoRef.current.value = '';
  };

  const handleSave = async () => {
    if (!fecha || !area || !resp) { toast('⚠ Complete fecha, área y responsable', 'error'); return; }
    try {
      await add({ fecha, area, tipo, desc, accion, resp, foto: foto || null });
      toast('✓ Hallazgo registrado');
      setDesc(''); clearFoto();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  const accionBadge = (ac) => {
    if (ac === 'Pendiente') return { bg: '#FFEBEE', c: T.danger, l: '⚠ Pendiente' };
    if (ac === 'Retirado')  return { bg: T.green2, c: T.secondary, l: '✓ Retirado' };
    return { bg: '#E3F2FD', c: '#1565C0', l: ac || '—' };
  };

  return (
    <>
      <Card style={{ borderLeft: `3px solid ${T.danger}` }}>
        <SecTitle>🚨 Reporte de Hallazgo — Contaminación</SecTitle>
        <p style={{ fontSize: '.7rem', color: T.textMid, marginBottom: 16, marginTop: -8 }}>
          Reportar vidrio o plástico encontrado en cualquier área. Registrar inmediatamente.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
          <Lbl text="Fecha">{inp(fecha, setFecha, 'date')}</Lbl>
          <Lbl text="Área donde se encontró">
            {sel(area, setArea,
              <>
                <option value="">— Seleccionar área —</option>
                {VYP_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </>
            )}
          </Lbl>
          <Lbl text="Responsable que reporta">
            <EmpSel value={resp} onChange={setResp} empleados={empleados} empLoading={empLoading} />
          </Lbl>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Lbl text="Tipo de hallazgo">
            {sel(tipo, setTipo, VYP_TIPOS.map(t => <option key={t} value={t}>{t}</option>))}
          </Lbl>
          <Lbl text="Acción tomada">
            {sel(accion, setAccion, VYP_ACCIONES.map(a => <option key={a} value={a}>{a}</option>))}
          </Lbl>
        </div>

        <div style={{ marginBottom: 14 }}>
          <Lbl text="Descripción del hallazgo">
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Qué se encontró, cantidad, estado, posible origen..."
              rows={2}
              style={{ padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
                fontSize: '.85rem', outline: 'none', width: '100%', fontFamily: 'inherit',
                resize: 'vertical', boxSizing: 'border-box' }} />
          </Lbl>
        </div>

        {/* Photo */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '.72rem', color: T.textMid, marginBottom: 5 }}>📷 Foto (opcional)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input ref={fotoRef} type="file" id="vyp-foto-input" accept="image/*"
              onChange={handleFoto} style={{ fontSize: '.7rem' }} />
            {foto && (
              <button onClick={clearFoto}
                style={{ padding: '4px 10px', background: 'none', border: `1px solid ${T.danger}`,
                  borderRadius: 4, cursor: 'pointer', fontSize: '.72rem', color: T.danger, fontFamily: 'inherit' }}>
                ✕ Quitar foto
              </button>
            )}
          </div>
          {foto && (
            <div style={{ marginTop: 6 }}>
              <img src={foto} alt="preview" style={{ maxHeight: 80, borderRadius: 4, border: `1px solid ${T.border}` }} />
            </div>
          )}
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ padding: '10px 22px', background: saving ? '#BDBDBD' : T.primary,
            color: T.white, border: 'none', borderRadius: 6, fontWeight: 700,
            fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Guardando...' : 'Registrar Hallazgo'}
        </button>
      </Card>

      <Card>
        <SecTitle>Historial de Hallazgos</SecTitle>
        {histLoading ? <Skeleton height={100} /> : (registros || []).length === 0
          ? <p style={{ textAlign: 'center', padding: 32, color: T.textMid, fontSize: '.85rem' }}>Sin reportes de hallazgos</p>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.primary }}>
                    {['Fecha','Área','Tipo','Descripción','Acción','Responsable','Foto',''].map(h => <ThCell key={h}>{h}</ThCell>)}
                  </tr>
                </thead>
                <tbody>
                  {(registros || []).slice(0, 100).map((r, i) => {
                    const badge = accionBadge(r.accion);
                    return (
                      <tr key={r.id} style={{ background: i % 2 === 0 ? T.white : '#F9FBF9' }}>
                        <TdCell style={{ fontWeight: 600 }}>{r.fecha}</TdCell>
                        <TdCell style={{ fontSize: '.78rem' }}>{r.area || '—'}</TdCell>
                        <TdCell>
                          <span style={{ padding: '3px 8px', borderRadius: 100, fontSize: '.65rem', fontWeight: 600,
                            background: '#E3F2FD', color: '#1565C0' }}>{r.tipo || '—'}</span>
                        </TdCell>
                        <TdCell style={{ fontSize: '.75rem', maxWidth: 140 }}>{r.desc || '—'}</TdCell>
                        <TdCell>
                          <span style={{ padding: '3px 8px', borderRadius: 100, fontSize: '.65rem', fontWeight: 600,
                            background: badge.bg, color: badge.c }}>{badge.l}</span>
                        </TdCell>
                        <TdCell style={{ fontSize: '.78rem' }}>{r.resp || '—'}</TdCell>
                        <TdCell>
                          {r.foto
                            ? <img src={r.foto} alt="" style={{ height: 28, borderRadius: 3, cursor: 'pointer' }} title="Ver foto" />
                            : '—'}
                        </TdCell>
                        <TdCell>
                          <button onClick={() => remove(r.id)}
                            style={{ background: 'none', border: `1px solid ${T.border}`,
                              borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
                              fontSize: '.75rem', color: T.textMid }}>✕</button>
                        </TdCell>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </>
  );
}

// ─── Main VYP component ───────────────────────────────────────────────────────
const TABS = [
  { key: 'vp',  label: 'Inventario Mensual' },
  { key: 'vyp', label: '🚨 Hallazgos' },
];

export default function VYP() {
  const [activeTab, setActiveTab] = useState('vp');
  const { empleados, loading: empLoading } = useEmpleados();

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: T.textDark, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          🔍 Vidrio y Plástico
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, marginTop: 4, marginBottom: 0 }}>
          Revisión mensual de inventario · Reporte de hallazgos de contaminación
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: `2px solid ${T.border}` }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ padding: '10px 18px', background: 'none', border: 'none',
              borderBottom: activeTab === t.key ? `3px solid ${T.primary}` : '3px solid transparent',
              cursor: 'pointer', fontWeight: activeTab === t.key ? 700 : 500,
              color: activeTab === t.key ? T.primary : T.textMid,
              fontSize: '.82rem', fontFamily: 'inherit', transition: 'all .15s',
              marginBottom: -2 }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'vp'  && <TabVP  empleados={empleados} empLoading={empLoading} />}
      {activeTab === 'vyp' && <TabVYP empleados={empleados} empLoading={empLoading} />}
    </div>
  );
}
