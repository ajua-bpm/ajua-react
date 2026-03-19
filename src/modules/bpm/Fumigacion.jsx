import { useState } from 'react';
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
const INSTALACIONES = [
  'Instalación Completa',
  'Cooler 1 (0–4°C)',
  'Cooler 2 (-18°C)',
  'Pre-carga',
  'Bodega General',
  'Parqueo Interior',
];

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const TIPOS = [
  { value: 'Fumigación General',      label: 'Fumigación General (empresa externa)' },
  { value: 'Desinfección con Cloro',  label: '🧴 Desinfección con Cloro (interna, semanal)' },
  { value: 'Sanitización Agua-Cloro', label: 'Sanitización Agua-Cloro' },
  { value: 'Control de Insectos',     label: 'Control de Insectos' },
];

const RESULTADOS = [
  { value: 'realizado',    label: '✓ Realizado' },
  { value: 'pendiente',   label: '⏳ Pendiente' },
  { value: 'reprogramado',label: '↻ Reprogramado' },
];

const CLORO_AREAS = [
  { id: 'c1', label: '❄️ Cooler 1' },
  { id: 'c2', label: '❄️ Cooler 2' },
  { id: 'pc', label: '📦 Pre-carga' },
  { id: 'bg', label: '🏭 Bodega General' },
];

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

// ─── Main component ───────────────────────────────────────────────────────────
export default function Fumigacion() {
  const toast = useToast();
  const { empleados, loading: empLoading } = useEmpleados();
  const { data: registros, loading: histLoading } = useCollection('fum', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { add, remove, saving } = useWrite('fum');

  const [form, setForm] = useState({
    instalacion: 'Instalación Completa',
    mes:         curMes(),
    semana:      '1',
    resp:        '',
    fecha:       today(),
    tipo:        'Fumigación General',
    resultado:   'realizado',
    obs:         '',
  });

  // Cloro panel state
  const [cloroAreas, setCloroAreas] = useState({ c1: false, c2: false, pc: false, bg: false });
  const [cloroConc, setCloroConc]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const showCloroPanel = form.tipo === 'Desinfección con Cloro';

  const handleSave = async () => {
    if (!form.fecha)  { toast('⚠ Complete la fecha de realización', 'error'); return; }
    if (!form.resp)   { toast('⚠ Seleccione responsable', 'error'); return; }

    const cloro = showCloroPanel
      ? CLORO_AREAS.filter(a => cloroAreas[a.id]).map(a => ({ area: a.label, concentracion: cloroConc }))
      : [];

    try {
      await add({
        instalacion: form.instalacion,
        mes:         form.mes,
        semana:      form.semana,
        resp:        form.resp,
        fecha:       form.fecha,
        tipo:        form.tipo,
        resultado:   form.resultado,
        cloro,
        cloroConc:   showCloroPanel ? (cloroConc || '') : '',
        obs:         form.obs,
        creadoEn:    new Date().toISOString(),
      });
      toast('✓ Control de fumigación registrado');
      setForm(f => ({ ...f, obs: '', fecha: today() }));
      setCloroAreas({ c1: false, c2: false, pc: false, bg: false });
      setCloroConc('');
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  const resColor = (v) => v === 'realizado' ? T.accent : v === 'pendiente' ? T.warn : T.textMid;

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: T.textDark, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Control de Fumigación / Sanitización
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, marginTop: 4, marginBottom: 0 }}>
          Fumigación externa mensual · Desinfección con cloro semanal — 2026
        </p>
      </div>

      <Card>
        <SecTitle>Registrar Control</SecTitle>

        {/* Row 1: instalacion, mes, semana, responsable */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
          <Lbl text="Instalación / Área">
            {sel(form.instalacion, v => set('instalacion', v),
              INSTALACIONES.map(x => <option key={x} value={x}>{x}</option>))}
          </Lbl>
          <Lbl text="Mes">
            {sel(form.mes, v => set('mes', v),
              MESES.map(m => <option key={m} value={m}>{m}</option>))}
          </Lbl>
          <Lbl text="Semana">
            {sel(form.semana, v => set('semana', v),
              ['1','2','3','4'].map(n => <option key={n} value={n}>{n}</option>))}
          </Lbl>
          <Lbl text="Responsable">
            {empLoading
              ? <Skeleton height={38} />
              : sel(form.resp, v => set('resp', v),
                  <>
                    <option value="">— Seleccionar responsable —</option>
                    {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}{e.cargo ? ' · ' + e.cargo : ''}</option>)}
                  </>
                )}
          </Lbl>
        </div>

        {/* Row 2: fecha, tipo, resultado */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
          <Lbl text="Fecha Realización">{inp(form.fecha, v => set('fecha', v), 'date')}</Lbl>
          <Lbl text="Tipo de Control">
            {sel(form.tipo, v => set('tipo', v),
              TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>))}
          </Lbl>
          <Lbl text="Resultado">
            {sel(form.resultado, v => set('resultado', v),
              RESULTADOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>))}
          </Lbl>
        </div>

        {/* Cloro panel */}
        {showCloroPanel && (
          <div style={{ padding: '10px 14px', border: '1.5px solid rgba(100,180,100,.35)',
            borderRadius: 6, background: 'rgba(92,200,92,.04)', marginBottom: 12 }}>
            <div style={{ fontSize: '.68rem', fontWeight: 600, color: T.secondary, marginBottom: 8 }}>
              🧴 Desinfección con Cloro — campos adicionales
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Lbl text="Áreas desinfectadas">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6, fontSize: '.78rem' }}>
                  {CLORO_AREAS.map(a => (
                    <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={cloroAreas[a.id]}
                        onChange={e => setCloroAreas(prev => ({ ...prev, [a.id]: e.target.checked }))}
                        style={{ accentColor: T.accent }} />
                      {a.label}
                    </label>
                  ))}
                </div>
              </Lbl>
              <Lbl text="Concentración de Cloro (%)">
                <input type="number" value={cloroConc} onChange={e => setCloroConc(e.target.value)}
                  placeholder="Ej: 0.5" step="0.1" min="0" max="10"
                  style={{ padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
                    fontSize: '.88rem', outline: 'none', width: 130, fontFamily: 'inherit' }} />
              </Lbl>
            </div>
          </div>
        )}

        {/* Observaciones */}
        <div style={{ marginBottom: 12 }}>
          <Lbl text="Observaciones">
            <textarea value={form.obs} onChange={e => set('obs', e.target.value)}
              placeholder="Productos utilizados, empresa, condiciones..."
              rows={2}
              style={{ padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
                fontSize: '.85rem', outline: 'none', width: '100%', fontFamily: 'inherit',
                resize: 'vertical', boxSizing: 'border-box' }} />
          </Lbl>
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ padding: '10px 22px', background: saving ? '#BDBDBD' : T.primary,
            color: T.white, border: 'none', borderRadius: 6, fontWeight: 700,
            fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Guardando...' : 'Registrar'}
        </button>
      </Card>

      {/* History table */}
      <Card>
        <SecTitle>Cronograma 2026</SecTitle>
        {histLoading ? <Skeleton height={140} /> : (registros || []).length === 0
          ? <p style={{ textAlign: 'center', padding: 32, color: T.textMid, fontSize: '.85rem' }}>Sin registros</p>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.primary }}>
                    {['Instalación','Mes','Semana','Responsable','Fecha','Tipo','Estado','Obs',''].map(h => <ThCell key={h}>{h}</ThCell>)}
                  </tr>
                </thead>
                <tbody>
                  {(registros || []).slice(0, 100).map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? T.white : '#F9FBF9' }}>
                      <TdCell style={{ fontSize: '.78rem' }}>{r.instalacion || '—'}</TdCell>
                      <TdCell>{r.mes || '—'}</TdCell>
                      <TdCell style={{ textAlign: 'center' }}>{r.semana || '—'}</TdCell>
                      <TdCell>{r.resp || '—'}</TdCell>
                      <TdCell style={{ fontWeight: 600 }}>{r.fecha || '—'}</TdCell>
                      <TdCell style={{ fontSize: '.75rem' }}>{r.tipo || '—'}</TdCell>
                      <TdCell>
                        <span style={{ padding: '3px 8px', borderRadius: 100, fontSize: '.68rem', fontWeight: 600,
                          background: r.resultado === 'realizado' ? T.green2 : r.resultado === 'pendiente' ? '#FFF3E0' : '#F5F5F5',
                          color: resColor(r.resultado) }}>
                          {RESULTADOS.find(x => x.value === r.resultado)?.label || r.resultado || '—'}
                        </span>
                      </TdCell>
                      <TdCell style={{ fontSize: '.72rem', maxWidth: 140 }}>{r.obs || '—'}</TdCell>
                      <TdCell>
                        <button onClick={() => remove(r.id)}
                          style={{ background: 'none', border: `1px solid ${T.border}`,
                            borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
                            fontSize: '.75rem', color: T.textMid }}>✕</button>
                      </TdCell>
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
