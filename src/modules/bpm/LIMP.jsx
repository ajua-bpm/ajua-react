import { useState, useEffect, Fragment } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// Solución estándar de limpieza — toda limpieza de bodega se hace con esto.
const SOLUCION_LIMPIEZA = 'Agua + cloro al 10%';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', danger: '#C62828',
  warn: '#E65100', textDark: '#1A1A18', textMid: '#6B6B60',
  border: '#E0E0E0', bgGreen: '#E8F5E9',
  white: '#FFFFFF', bgLight: '#F5F5F5', bgCard: '#FFFFFF', accent: '#43A047',
};

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

const Badge = ({ ok }) => (
  <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600, background: ok ? T.bgGreen : '#FFEBEE', color: ok ? T.secondary : T.danger }}>
    {ok ? '✓ Cumple' : '✗ No Cumple'}
  </span>
);

const SaveBtn = ({ onClick, saving, label = 'Guardar Registro', fullWidth = false }) => (
  <button
    onClick={onClick}
    disabled={saving}
    style={{ padding: '11px 28px', background: saving ? '#BDBDBD' : T.primary, color: T.white, border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', width: fullWidth ? '100%' : 'auto', minHeight: 44 }}
  >
    {saving ? 'Guardando...' : label}
  </button>
);

// ─── LIMP checklist data ──────────────────────────────────────────────────────
const AREAS = [
  {
    key: 'cooler1', label: 'COOLER 1', icon: '❄️', obsKey: 'obsC1', fotoKey: 'foto_c1',
    checks: ['Pisos limpios y secos', 'Paredes sin hongos ni residuos', 'Temperatura correcta registrada'],
  },
  {
    key: 'cooler2', label: 'COOLER 2', icon: '❄️', obsKey: 'obsC2', fotoKey: 'foto_c2',
    checks: ['Pisos limpios y secos', 'Paredes sin hongos ni residuos', 'Temperatura correcta registrada'],
  },
  {
    key: 'precarga', label: 'PRE-CARGA', icon: '📦', obsKey: 'obsPc', fotoKey: 'foto_pc',
    checks: ['Área libre de residuos', 'Piso barrido y trapeado', 'Sin productos en el piso'],
  },
  {
    key: 'bodega', label: 'BODEGA GENERAL', icon: '🏭', obsKey: 'obsBg', fotoKey: 'foto_bg',
    checks: ['Pisos limpios', 'Pasillos libres', 'Iluminación funcionando', 'Sin plagas visibles'],
  },
];

const BL_CHECKS = [
  { key: 'pisos',     label: 'Pisos barridos y trapeados' },
  { key: 'paredes',   label: 'Paredes y esquinas limpias' },
  { key: 'estantes',  label: 'Estantes y tarimas despejados' },
  { key: 'basura',    label: 'Basura y residuos retirados' },
  { key: 'pasillos',  label: 'Pasillos libres y despejados' },
  { key: 'iluminacion', label: 'Iluminación funcionando' },
];

const BL_AREAS = ['Bodega Principal', 'Cámara Fría', 'Área de Proceso', 'Pasillos'];

const PARQ_CHECKS = [
  { key: 'barrido',  label: 'Barrido general del parqueo' },
  { key: 'basura',   label: 'Retiro de basura y residuos' },
  { key: 'drenajes', label: 'Drenajes limpios y despejados' },
  { key: 'acceso',   label: 'Acceso principal libre y despejado' },
];

const DIAS_PARQUEO = [1, 3, 5]; // Mon, Wed, Fri

function todayIsParqueoDay() {
  return DIAS_PARQUEO.includes(new Date().getDay());
}

// ─── SiNoNa toggle ────────────────────────────────────────────────────────────
function SiNoNa({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
      {['si', 'no', 'na'].map(v => (
        <button
          key={v}
          onClick={() => onChange(v === value ? '' : v)}
          style={{
            padding: '5px 10px', borderRadius: 6, border: '1.5px solid', cursor: 'pointer',
            fontWeight: 700, fontSize: '.76rem', fontFamily: 'inherit', transition: 'all .15s',
            background: value === v ? (v === 'si' ? T.bgGreen : v === 'no' ? '#FFEBEE' : '#F5F5F5') : T.white,
            borderColor: value === v ? (v === 'si' ? T.secondary : v === 'no' ? T.danger : '#6B6B60') : T.border,
            color: value === v ? (v === 'si' ? T.secondary : v === 'no' ? T.danger : '#555') : T.textMid,
          }}
        >
          {v.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ─── CheckRow ─────────────────────────────────────────────────────────────────
function CheckRow({ label, value, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 6, marginBottom: 4,
      background: value === 'si' ? '#F1F8E9' : value === 'no' ? '#FFF8F8' : T.bgLight,
      border: `1px solid ${value === 'si' ? '#DCEDC8' : value === 'no' ? '#FFCDD2' : T.border}`,
    }}>
      <span style={{ flex: 1, fontSize: '.85rem' }}>{label}</span>
      <SiNoNa value={value || ''} onChange={onChange} />
    </div>
  );
}

// ─── ResultadoBox ─────────────────────────────────────────────────────────────
function ResultadoBox({ pct, resultado }) {
  if (!pct && pct !== 0) return null;
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 8, marginBottom: 16, textAlign: 'center',
      border: `2px solid ${resultado === 'cumple' ? T.secondary : T.danger}`,
      background: resultado === 'cumple' ? T.bgGreen : '#FFEBEE',
    }}>
      <div style={{ fontSize: '.65rem', color: T.textMid, textTransform: 'uppercase', marginBottom: 4 }}>Resultado</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color: resultado === 'cumple' ? T.secondary : T.danger }}>{pct}%</div>
      <div style={{ fontSize: '.8rem', fontWeight: 600, color: resultado === 'cumple' ? T.secondary : T.danger }}>
        {resultado === 'cumple' ? '✓ CUMPLE' : '✗ NO CUMPLE'}
      </div>
    </div>
  );
}

// ─── LIMP main ────────────────────────────────────────────────────────────────
export default function LIMP() {
  const toast = useToast();
  const { empleados, loading: empLoading } = useEmpleados();

  const { data: limpData,  loading: limpLoad }  = useCollection('limp', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { data: blData,    loading: blLoad }    = useCollection('bl',   { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { data: parqData,  loading: parqLoad }  = useCollection('parq', { orderField: 'fecha', orderDir: 'desc', limit: 200 });

  const { add: addLimp, saving: savingLimp, remove: removeLimp } = useWrite('limp');
  const { add: addBl,   saving: savingBl, remove: removeBl } = useWrite('bl');
  const { add: addParq, saving: savingParq, remove: removeParq } = useWrite('parq');

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const [tab, setTab] = useState('limp');

  // ── Tab 1: Áreas de Proceso (Limpieza Diaria) ──────────────────────────────
  const [fecha,  setFecha]  = useState(today());
  const [hora,   setHora]   = useState(nowHM());
  const [resp,   setResp]   = useState('');

  const [checksArea, setChecksArea] = useState({});
  const [obsArea,    setObsArea]    = useState({});
  const [fotosArea,  setFotosArea]  = useState({});

  const setCheck = (akey, ci, val) =>
    setChecksArea(prev => ({ ...prev, [akey]: { ...(prev[akey] || {}), [ci]: val } }));

  const setObs = (akey, val) => setObsArea(prev => ({ ...prev, [akey]: val }));
  const setFoto = (akey, dataUrl) => setFotosArea(prev => ({ ...prev, [akey]: dataUrl }));

  const allChecks = AREAS.flatMap(a =>
    a.checks.map((_, ci) => checksArea[a.key]?.[ci] || '')
  );
  const totalSi  = allChecks.filter(c => c === 'si').length;
  const totalNo  = allChecks.filter(c => c === 'no').length;
  const denom    = totalSi + totalNo;
  const pct      = denom > 0 ? Math.round(totalSi / denom * 100) : 0;
  const resultado = pct >= 80 ? 'cumple' : 'no_cumple';

  const handleSaveLimp = async () => {
    if (!fecha || !resp) { toast('Complete fecha y responsable', 'error'); return; }
    const buildArea = (a) => ({
      checks: a.checks.map((_, ci) => checksArea[a.key]?.[ci] || ''),
      obs: obsArea[a.key] || '',
      fotoUrl: fotosArea[a.key] || '',
    });
    try {
      await addLimp({
        fecha, hora, responsable: resp,
        cooler1:  buildArea(AREAS[0]),
        cooler2:  buildArea(AREAS[1]),
        precarga: buildArea(AREAS[2]),
        bodega:   buildArea(AREAS[3]),
        pct, resultado, solucion: SOLUCION_LIMPIEZA,
        creadoEn: new Date().toISOString(),
      });
      toast('Registro de limpieza diaria guardado');
      setChecksArea({}); setObsArea({}); setFotosArea({}); setResp('');
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  const [expLimp, setExpLimp] = useState(null);
  const toggleLimpExpand = (id) => setExpLimp(prev => prev === id ? null : id);

  // Registro de 1 toque (Áreas de Proceso): crea el registro de HOY con todas las áreas en cumple,
  // Agua+cloro 10%, tomando el último responsable usado. Para marcar la limpieza diaria al momento.
  const [quickLimp, setQuickLimp] = useState(false);
  const handleQuickLimp = async () => {
    const r = resp || limpData?.[0]?.responsable || empleados?.[0]?.nombre || '';
    if (!r) { toast('Elegí un responsable primero', 'error'); return; }
    const areaSi = (a) => ({ checks: a.checks.map(() => 'si'), obs: '', fotoUrl: '' });
    setQuickLimp(true);
    try {
      await addLimp({
        fecha: today(), hora: nowHM(), responsable: r,
        cooler1: areaSi(AREAS[0]), cooler2: areaSi(AREAS[1]),
        precarga: areaSi(AREAS[2]), bodega: areaSi(AREAS[3]),
        pct: 100, resultado: 'cumple', solucion: SOLUCION_LIMPIEZA,
        creadoEn: new Date().toISOString(),
      });
      toast(`Limpieza de hoy registrada — ${r}`);
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    } finally { setQuickLimp(false); }
  };

  // ── Tab 2: Bodega Limpieza ─────────────────────────────────────────────────
  const [blFecha,     setBlFecha]     = useState(today());
  const [blHora,      setBlHora]      = useState(nowHM());
  const [blResp,      setBlResp]      = useState('');
  const [blArea,      setBlArea]      = useState('');
  const [blChecks,    setBlChecks]    = useState({});
  const [blResultado, setBlResultado] = useState('Realizado');
  const [blObs,       setBlObs]       = useState('');
  const [blExpanded,  setBlExpanded]  = useState(null);
  const toggleBlExpand = (id) => setBlExpanded(prev => prev === id ? null : id);

  const setBlCheck = (key, val) => setBlChecks(prev => ({ ...prev, [key]: val }));

  const blOkCount  = BL_CHECKS.filter(p => blChecks[p.key] === 'si').length;
  const blDenom    = BL_CHECKS.filter(p => blChecks[p.key] === 'si' || blChecks[p.key] === 'no').length;
  const blPct      = blDenom > 0 ? Math.round(blOkCount / blDenom * 100) : 0;
  const blAutoRes  = blDenom > 0 ? (blPct >= 80 ? 'Realizado' : 'Pendiente') : blResultado;

  const handleSaveBl = async () => {
    if (!blFecha || !blResp || !blArea) { toast('Complete fecha, responsable y área', 'error'); return; }
    try {
      await addBl({
        fecha: blFecha, hora: blHora, responsable: blResp, area: blArea,
        checks: blChecks, pct: blPct, resultado: blResultado, obs: blObs,
        solucion: SOLUCION_LIMPIEZA,
        creadoEn: new Date().toISOString(),
      });
      toast('Registro de bodega guardado');
      setBlArea(''); setBlChecks({}); setBlObs(''); setBlResp('');
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  // Registro de 1 toque: crea el registro de HOY con el estándar (todo cumple, Agua+cloro 10%),
  // tomando el último responsable/área usados. Pensado para marcar la limpieza al momento, sin llenar el formulario.
  const [quickBl, setQuickBl] = useState(false);
  const handleQuickBl = async () => {
    const resp = blResp || blData?.[0]?.responsable || empleados?.[0]?.nombre || '';
    const area = blArea || blData?.[0]?.area || BL_AREAS[0];
    if (!resp) { toast('Elegí un responsable primero', 'error'); return; }
    setQuickBl(true);
    try {
      await addBl({
        fecha: today(), hora: nowHM(), responsable: resp, area,
        checks: Object.fromEntries(BL_CHECKS.map(p => [p.key, 'si'])),
        pct: 100, resultado: 'Realizado', obs: '',
        solucion: SOLUCION_LIMPIEZA, creadoEn: new Date().toISOString(),
      });
      toast(`Limpieza de hoy registrada — ${resp}`);
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    } finally { setQuickBl(false); }
  };

  // ── Tab 3: Parqueo ─────────────────────────────────────────────────────────
  const [parqFecha,  setParqFecha]  = useState(today());
  const [parqHora,   setParqHora]   = useState(nowHM());
  const [parqResp,   setParqResp]   = useState('');
  const [parqChecks, setParqChecks] = useState({});
  const [parqObs,    setParqObs]    = useState('');

  const setParqCheck = (key, val) => setParqChecks(prev => ({ ...prev, [key]: val }));

  const parqOk  = PARQ_CHECKS.filter(p => parqChecks[p.key] === 'si').length;
  const parqRes = parqOk === PARQ_CHECKS.length ? 'cumple' : 'no_cumple';

  const [expParq, setExpParq] = useState(null);
  const toggleParqExpand = (id) => setExpParq(prev => prev === id ? null : id);
  const [quickParq, setQuickParq] = useState(false);
  const handleQuickParq = async () => {
    const r = parqResp || parqData?.[0]?.responsable || empleados?.[0]?.nombre || '';
    if (!r) { toast('Elegí un responsable primero', 'error'); return; }
    setQuickParq(true);
    try {
      await addParq({
        fecha: today(), hora: nowHM(), responsable: r,
        checks: Object.fromEntries(PARQ_CHECKS.map(p => [p.key, 'si'])),
        resultado: 'cumple', obs: '', creadoEn: new Date().toISOString(),
      });
      toast(`Parqueo de hoy registrado — ${r}`);
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    } finally { setQuickParq(false); }
  };

  const handleSaveParq = async () => {
    if (!parqFecha || !parqResp) { toast('Complete fecha y responsable', 'error'); return; }
    try {
      await addParq({
        fecha: parqFecha, hora: parqHora, responsable: parqResp,
        checks: parqChecks, resultado: parqRes, obs: parqObs,
        creadoEn: new Date().toISOString(),
      });
      toast('Limpieza de parqueo registrada');
      setParqChecks({}); setParqResp(''); setParqObs('');
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: T.textDark, maxWidth: 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Control de Limpieza — Bodega
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, marginTop: 4, marginBottom: 0 }}>
          Verificación diaria — Áreas de Proceso · Bodega · Parqueo
        </p>
      </div>

      {/* Tabs */}
      <div style={{ overflowX: isMobile ? 'auto' : 'visible', marginBottom: 20, borderBottom: `2px solid ${T.border}` }}>
        <div style={{ display: 'flex', gap: 4, minWidth: 'max-content' }}>
          {[
            { key: 'limp', label: 'Áreas de Proceso' },
            { key: 'bl',   label: 'Bodega Limpieza' },
            { key: 'parq', label: 'Parqueo' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 20px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '.85rem', fontWeight: 600, borderRadius: '6px 6px 0 0',
                background: tab === t.key ? T.primary : 'transparent',
                color: tab === t.key ? T.white : T.textMid,
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab 1: Áreas de Proceso ── */}
      {tab === 'limp' && (
        <>
          {/* Registro de 1 toque — marca la limpieza diaria de HOY al momento */}
          <Card style={{ background: T.bgGreen, borderColor: '#A5D6A7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '.95rem', color: T.primary }}>✓ Registrar limpieza de hoy</div>
                <div style={{ fontSize: '.78rem', color: T.textMid, marginTop: 2 }}>
                  1 toque: las 4 áreas en cumple con <b>{SOLUCION_LIMPIEZA}</b>, fecha y hora de ahora.
                </div>
              </div>
              <select value={resp} onChange={e => setResp(e.target.value)}
                style={{ ...inputStyle, width: 'auto', minWidth: 170, flex: '0 1 auto', cursor: 'pointer' }}>
                <option value="">— Responsable{limpData?.[0]?.responsable ? ` (${limpData[0].responsable})` : ''} —</option>
                {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
              </select>
              <button onClick={handleQuickLimp} disabled={quickLimp}
                style={{ padding: '12px 24px', background: quickLimp ? '#BDBDBD' : T.primary, color: T.white, border: 'none', borderRadius: 8, fontWeight: 800, fontSize: '.92rem', cursor: quickLimp ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: 48, whiteSpace: 'nowrap' }}>
                {quickLimp ? 'Guardando…' : '✓ Registrar hoy'}
              </button>
            </div>
          </Card>

          <Card>
            <SectionTitle>Nuevo Registro</SectionTitle>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 18 }}>
              <Lbl text="Fecha">
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
              </Lbl>
              <Lbl text="Hora">
                <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={inputStyle} />
              </Lbl>
              <Lbl text="Responsable">
                {empLoading ? <Skeleton height={38} /> : (
                  <select value={resp} onChange={e => setResp(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">— Seleccionar responsable —</option>
                    {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                  </select>
                )}
              </Lbl>
            </div>

            {AREAS.map(area => (
              <div key={area.key} style={{ marginBottom: 18, padding: 14, borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgLight }}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.secondary, marginBottom: 12 }}>
                  {area.icon} {area.label}
                </div>

                {area.checks.map((check, ci) => (
                  <CheckRow
                    key={ci}
                    label={check}
                    value={checksArea[area.key]?.[ci] || ''}
                    onChange={v => setCheck(area.key, ci, v)}
                  />
                ))}

                <div style={{ marginTop: 10 }}>
                  <textarea
                    value={obsArea[area.key] || ''}
                    onChange={e => setObs(area.key, e.target.value)}
                    rows={2}
                    placeholder={`Novedades ${area.label}...`}
                    style={{ ...inputStyle, resize: 'vertical', fontSize: '.82rem' }}
                  />
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.68rem', fontWeight: 600, textTransform: 'uppercase', color: T.textMid }}>
                    Foto (opcional)
                    <input type="file" accept="image/*" capture="environment"
                      onChange={e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setFoto(area.key, ev.target.result); r.readAsDataURL(f); }}
                      style={{ fontSize: '.82rem', color: T.textDark }} />
                  </label>
                  {fotosArea[area.key] && <img src={fotosArea[area.key]} alt="foto" style={{ marginTop: 8, maxWidth: '100%', maxHeight: 200, borderRadius: 6, objectFit: 'cover' }} />}
                </div>
              </div>
            ))}

            {denom > 0 && <ResultadoBox pct={pct} resultado={resultado} />}

            <SaveBtn onClick={handleSaveLimp} saving={savingLimp} fullWidth={isMobile} />
          </Card>

          <Card>
            <SectionTitle>Historial — Áreas de Proceso</SectionTitle>
            {limpLoad ? <Skeleton height={120} /> : (limpData || []).length === 0 ? (
              <p style={{ textAlign: 'center', padding: 24, color: T.textMid }}>Sin registros.</p>
            ) : isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(limpData || []).slice(0, 100).map(r => {
                  const allC = ['cooler1', 'cooler2', 'precarga', 'bodega'].flatMap(k => r[k]?.checks || []);
                  const si = allC.filter(c => c === 'si').length;
                  const no = allC.filter(c => c === 'no').length;
                  const foto = r.cooler1?.fotoUrl || r.cooler2?.fotoUrl || r.precarga?.fotoUrl || '';
                  const obs = r.cooler1?.obs || r.cooler2?.obs || r.precarga?.obs || r.bodega?.obs || '';
                  return (
                    <div key={r.id} style={{ background: T.white, borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.10)', borderLeft: `4px solid ${r.resultado === 'cumple' ? T.secondary : T.danger}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>📅 {r.fecha || '—'}</span>
                          {r.hora && <span style={{ marginLeft: 8, fontSize: 12, color: T.textMid }}>🕐 {r.hora}</span>}
                        </div>
                        <Badge ok={r.resultado === 'cumple'} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.textDark, marginBottom: 4 }}>👤 {r.responsable || '—'}</div>
                      <div style={{ fontSize: 12, color: T.secondary, fontWeight: 700, marginBottom: 6 }}>🧴 {r.solucion || SOLUCION_LIMPIEZA}</div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: foto || obs ? 6 : 0 }}>
                        <span><b>Cumple:</b> <span style={{ color: T.secondary, fontWeight: 700 }}>{si}</span></span>
                        <span><b>No cumple:</b> <span style={{ color: T.danger, fontWeight: 700 }}>{no}</span></span>
                      </div>
                      {obs && <div style={{ fontSize: 12, color: T.textMid, marginBottom: foto ? 6 : 0 }}>📝 {obs}</div>}
                      {foto && <img src={foto} alt="f" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, marginTop: 4 }} />}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: T.primary }}>
                      {['Fecha', 'Hora', 'Responsable', 'Cumple', 'No Cumple', 'Resultado', '', ''].map((h, hi) => (
                        <th key={hi} style={{ padding: '9px 12px', textAlign: 'left', color: T.white, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(limpData || []).slice(0, 100).map((r, i) => {
                      const allC = ['cooler1', 'cooler2', 'precarga', 'bodega'].flatMap(k => r[k]?.checks || []);
                      const si = allC.filter(c => c === 'si').length;
                      const no = allC.filter(c => c === 'no').length;
                      const isExp = expLimp === r.id;
                      return (
                        <Fragment key={r.id}>
                          <tr style={{ background: isExp ? '#F1F8E9' : i % 2 === 0 ? T.white : '#F9FBF9', cursor: 'pointer' }} onClick={() => toggleLimpExpand(r.id)}>
                            <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600 }}>{r.fecha || '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.hora || '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.responsable || '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', color: T.secondary, fontWeight: 700 }}>{si}</td>
                            <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', color: T.danger }}>{no}</td>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }}><Badge ok={r.resultado === 'cumple'} /></td>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0', textAlign: 'center', color: T.secondary, fontWeight: 700, fontSize: '.8rem' }}>{isExp ? '▲' : '▼'}</td>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => { if (window.confirm('¿Eliminar este registro?')) removeLimp(r.id); }}
                                style={{ padding: '3px 10px', borderRadius: 5, border: `1.5px solid ${T.danger}`, background: '#fff', color: T.danger, cursor: 'pointer', fontSize: '.75rem', fontWeight: 700, fontFamily: 'inherit' }}>✕</button>
                            </td>
                          </tr>
                          {isExp && (
                            <tr>
                              <td colSpan={8} style={{ padding: 0, borderBottom: '2px solid #A5D6A7' }}>
                                <div style={{ padding: '14px 18px', background: '#F9FEF9', borderLeft: '4px solid #2E7D32' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <span style={{ fontSize: '1.05rem' }}>🧴</span>
                                    <span style={{ fontSize: '.8rem', fontWeight: 700, color: T.secondary }}>Solución: {r.solucion || SOLUCION_LIMPIEZA}</span>
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14 }}>
                                    {AREAS.map(area => (
                                      <div key={area.key}>
                                        <div style={{ fontWeight: 700, fontSize: '.7rem', color: T.secondary, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{area.icon} {area.label}</div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                                          <tbody>
                                            {area.checks.map((label, ci) => {
                                              const v = r[area.key]?.checks?.[ci];
                                              return (
                                                <tr key={ci} style={{ background: ci % 2 === 0 ? '#fff' : '#F4FAF4' }}>
                                                  <td style={{ padding: '4px 8px', color: T.textDark }}>{label}</td>
                                                  <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                    {v === 'si' ? <span style={{ color: T.accent }}>✓</span> : v === 'no' ? <span style={{ color: T.danger }}>✗</span> : <span style={{ color: T.textMid }}>N/A</span>}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                        {r[area.key]?.obs && <div style={{ fontSize: '.72rem', color: T.textMid, marginTop: 4 }}>📝 {r[area.key].obs}</div>}
                                        {r[area.key]?.fotoUrl && <img src={r[area.key].fotoUrl} alt="foto" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 5, marginTop: 6 }} />}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Tab 2: Bodega Limpieza ── */}
      {tab === 'bl' && (
        <>
          {/* Registro de 1 toque — marca la limpieza de HOY al momento */}
          <Card style={{ background: T.bgGreen, borderColor: '#A5D6A7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '.95rem', color: T.primary }}>✓ Registrar limpieza de hoy</div>
                <div style={{ fontSize: '.78rem', color: T.textMid, marginTop: 2 }}>
                  1 toque: deja todo en cumple con <b>{SOLUCION_LIMPIEZA}</b>, con la fecha y hora de ahora.
                </div>
              </div>
              <select value={blResp} onChange={e => setBlResp(e.target.value)}
                style={{ ...inputStyle, width: 'auto', minWidth: 170, flex: '0 1 auto', cursor: 'pointer' }}>
                <option value="">— Responsable{blData?.[0]?.responsable ? ` (${blData[0].responsable})` : ''} —</option>
                {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
              </select>
              <button onClick={handleQuickBl} disabled={quickBl}
                style={{ padding: '12px 24px', background: quickBl ? '#BDBDBD' : T.primary, color: T.white, border: 'none', borderRadius: 8, fontWeight: 800, fontSize: '.92rem', cursor: quickBl ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: 48, whiteSpace: 'nowrap' }}>
                {quickBl ? 'Guardando…' : '✓ Registrar hoy'}
              </button>
            </div>
          </Card>

          <Card>
            <SectionTitle>Nuevo Registro de Bodega</SectionTitle>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 14 }}>
              <Lbl text="Fecha">
                <input type="date" value={blFecha} onChange={e => setBlFecha(e.target.value)} style={inputStyle} />
              </Lbl>
              <Lbl text="Hora">
                <input type="time" value={blHora} onChange={e => setBlHora(e.target.value)} style={inputStyle} />
              </Lbl>
              <Lbl text="Responsable">
                {empLoading ? <Skeleton height={38} /> : (
                  <select value={blResp} onChange={e => setBlResp(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">— Seleccionar responsable —</option>
                    {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                  </select>
                )}
              </Lbl>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <Lbl text="Área">
                <select value={blArea} onChange={e => setBlArea(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">— Seleccionar área —</option>
                  {BL_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Lbl>
              <Lbl text="Resultado">
                <select value={blResultado} onChange={e => setBlResultado(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="Realizado">Realizado</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Reprogramado">Reprogramado</option>
                </select>
              </Lbl>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, marginBottom: 14, background: T.bgGreen, border: `1.5px solid #A5D6A7` }}>
              <span style={{ fontSize: '1.1rem' }}>🧴</span>
              <div>
                <div style={{ fontSize: '.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMid }}>Solución de limpieza</div>
                <div style={{ fontSize: '.9rem', fontWeight: 700, color: T.secondary }}>{SOLUCION_LIMPIEZA}</div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: '.68rem', color: T.textMid, marginBottom: 8, marginTop: 0 }}>Checklist de limpieza — marcar SI / NO / NA:</p>
              {BL_CHECKS.map(p => (
                <CheckRow
                  key={p.key}
                  label={p.label}
                  value={blChecks[p.key] || ''}
                  onChange={v => setBlCheck(p.key, v)}
                />
              ))}
            </div>

            {blDenom > 0 && (
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: '.78rem', color: T.textMid }}>
                  Checks OK: <strong style={{ color: blPct >= 80 ? T.secondary : T.warn }}>{blOkCount}/{BL_CHECKS.length}</strong>
                  {' '}— Sugerido: <strong style={{ color: blAutoRes === 'Realizado' ? T.secondary : T.warn }}>{blAutoRes}</strong>
                </span>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <Lbl text="Observaciones">
                <textarea value={blObs} onChange={e => setBlObs(e.target.value)} rows={2} placeholder="Observaciones adicionales..." style={{ ...inputStyle, resize: 'vertical' }} />
              </Lbl>
            </div>

            <SaveBtn onClick={handleSaveBl} saving={savingBl} fullWidth={isMobile} />
          </Card>

          <Card>
            <SectionTitle>Historial Bodega Limpieza</SectionTitle>
            {blLoad ? <Skeleton height={120} /> : (blData || []).length === 0 ? (
              <p style={{ textAlign: 'center', padding: 24, color: T.textMid }}>Sin registros.</p>
            ) : isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(blData || []).slice(0, 100).map(r => {
                  const okN = BL_CHECKS.filter(p => (r.checks || {})[p.key] === 'si').length;
                  const resBg = r.resultado === 'Realizado' ? T.bgGreen : r.resultado === 'Pendiente' ? '#FFEBEE' : '#FFF3E0';
                  const resC  = r.resultado === 'Realizado' ? T.secondary : r.resultado === 'Pendiente' ? T.danger : T.warn;
                  return (
                    <div key={r.id} style={{ background: T.white, borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.10)', borderLeft: `4px solid ${resC}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>📅 {r.fecha || '—'}</span>
                          {r.hora && <span style={{ marginLeft: 8, fontSize: 12, color: T.textMid }}>🕐 {r.hora}</span>}
                        </div>
                        <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: resBg, color: resC }}>{r.resultado || '—'}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.textDark, marginBottom: 4 }}>👤 {r.responsable || '—'}</div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: 6 }}>
                        <span><b>Área:</b> {r.area || '—'}</span>
                        <span><b>Checks OK:</b> <span style={{ color: okN === BL_CHECKS.length ? T.secondary : T.warn, fontWeight: 700 }}>{okN}/{BL_CHECKS.length}</span></span>
                      </div>
                      <div style={{ fontSize: 12, color: T.secondary, fontWeight: 700, marginBottom: 8 }}>🧴 {r.solucion || SOLUCION_LIMPIEZA}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: r.obs ? 6 : 0, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                        {BL_CHECKS.map(p => {
                          const v = (r.checks || {})[p.key];
                          return (
                            <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                              <span style={{ color: T.textMid }}>{p.label}</span>
                              <span style={{ fontWeight: 700, color: v === 'si' ? T.accent : v === 'no' ? T.danger : T.textMid }}>{v === 'si' ? '✓' : v === 'no' ? '✗' : 'N/A'}</span>
                            </div>
                          );
                        })}
                      </div>
                      {r.obs && <div style={{ fontSize: 12, color: T.textMid }}>📝 {r.obs}</div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: T.primary }}>
                      {['Fecha', 'Hora', 'Responsable', 'Área', 'Checks OK', 'Resultado', '', ''].map((h, hi) => (
                        <th key={hi} style={{ padding: '9px 12px', textAlign: 'left', color: T.white, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(blData || []).slice(0, 100).map((r, i) => {
                      const okN = BL_CHECKS.filter(p => (r.checks || {})[p.key] === 'si').length;
                      const isExp = blExpanded === r.id;
                      return (
                        <Fragment key={r.id}>
                          <tr style={{ background: isExp ? '#F1F8E9' : i % 2 === 0 ? T.white : '#F9FBF9', cursor: 'pointer' }} onClick={() => toggleBlExpand(r.id)}>
                            <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600 }}>{r.fecha || '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.hora || '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.responsable || '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>
                              <div>{r.area || '—'}</div>
                              <div style={{ fontSize: '.68rem', color: T.secondary, fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap' }}>🧴 {r.solucion || SOLUCION_LIMPIEZA}</div>
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: okN === BL_CHECKS.length ? T.secondary : T.warn }}>{okN}/{BL_CHECKS.length}</td>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }}>
                              <span style={{
                                padding: '2px 8px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600,
                                background: r.resultado === 'Realizado' ? T.bgGreen : r.resultado === 'Pendiente' ? '#FFEBEE' : '#FFF3E0',
                                color: r.resultado === 'Realizado' ? T.secondary : r.resultado === 'Pendiente' ? T.danger : T.warn,
                              }}>{r.resultado || '—'}</span>
                            </td>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0', textAlign: 'center', color: T.secondary, fontWeight: 700, fontSize: '.8rem' }}>{isExp ? '▲' : '▼'}</td>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => { if (window.confirm('¿Eliminar este registro?')) removeBl(r.id); }}
                                style={{ padding: '3px 10px', borderRadius: 5, border: `1.5px solid ${T.danger}`, background: '#fff', color: T.danger, cursor: 'pointer', fontSize: '.75rem', fontWeight: 700, fontFamily: 'inherit' }}>✕</button>
                            </td>
                          </tr>
                          {isExp && (
                            <tr>
                              <td colSpan={8} style={{ padding: 0, borderBottom: '2px solid #A5D6A7' }}>
                                <div style={{ padding: '14px 18px', background: '#F9FEF9', borderLeft: '4px solid #2E7D32' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <span style={{ fontSize: '1.05rem' }}>🧴</span>
                                    <span style={{ fontSize: '.8rem', fontWeight: 700, color: T.secondary }}>Solución: {r.solucion || SOLUCION_LIMPIEZA}</span>
                                  </div>
                                  <div style={{ fontWeight: 700, fontSize: '.7rem', color: T.secondary, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
                                    Detalle de limpieza — {r.area || '—'}
                                  </div>
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ borderCollapse: 'collapse', fontSize: '.8rem' }}>
                                      <tbody>
                                        {BL_CHECKS.map((p, pi) => {
                                          const v = (r.checks || {})[p.key];
                                          return (
                                            <tr key={p.key} style={{ background: pi % 2 === 0 ? '#fff' : '#F4FAF4' }}>
                                              <td style={{ padding: '5px 24px 5px 10px', color: T.textDark, whiteSpace: 'nowrap' }}>{p.label}</td>
                                              <td style={{ padding: '5px 14px', textAlign: 'center', fontWeight: 700 }}>
                                                {v === 'si' ? <span style={{ color: T.accent }}>✓</span> : v === 'no' ? <span style={{ color: T.danger }}>✗</span> : <span style={{ color: T.textMid }}>N/A</span>}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                  {r.obs && <div style={{ marginTop: 10, fontSize: '.78rem', color: T.textMid }}>📝 {r.obs}</div>}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Tab 3: Parqueo ── */}
      {tab === 'parq' && (
        <>
          {!todayIsParqueoDay() && (
            <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, background: '#FFF3E0', border: `1.5px solid ${T.warn}`, color: T.warn, fontSize: '.84rem', fontWeight: 500 }}>
              ⚠ Limpieza de parqueo: Lun, Mié, Vie — hoy no es día de limpieza
            </div>
          )}

          {/* Registro de 1 toque — marca el parqueo de HOY al momento */}
          <Card style={{ background: T.bgGreen, borderColor: '#A5D6A7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '.95rem', color: T.primary }}>✓ Registrar parqueo de hoy</div>
                <div style={{ fontSize: '.78rem', color: T.textMid, marginTop: 2 }}>1 toque: los 4 puntos en cumple, con fecha y hora de ahora.</div>
              </div>
              <select value={parqResp} onChange={e => setParqResp(e.target.value)}
                style={{ ...inputStyle, width: 'auto', minWidth: 170, flex: '0 1 auto', cursor: 'pointer' }}>
                <option value="">— Responsable{parqData?.[0]?.responsable ? ` (${parqData[0].responsable})` : ''} —</option>
                {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
              </select>
              <button onClick={handleQuickParq} disabled={quickParq}
                style={{ padding: '12px 24px', background: quickParq ? '#BDBDBD' : T.primary, color: T.white, border: 'none', borderRadius: 8, fontWeight: 800, fontSize: '.92rem', cursor: quickParq ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: 48, whiteSpace: 'nowrap' }}>
                {quickParq ? 'Guardando…' : '✓ Registrar hoy'}
              </button>
            </div>
          </Card>

          <Card>
            <SectionTitle>Limpieza de Parqueo</SectionTitle>
            <p style={{ fontSize: '.7rem', color: T.textMid, marginBottom: 14 }}>Lunes, Miércoles y Viernes — 3 veces por semana</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 18 }}>
              <Lbl text="Fecha">
                <input type="date" value={parqFecha} onChange={e => setParqFecha(e.target.value)} style={inputStyle} />
              </Lbl>
              <Lbl text="Hora">
                <input type="time" value={parqHora} onChange={e => setParqHora(e.target.value)} style={inputStyle} />
              </Lbl>
              <Lbl text="Responsable">
                {empLoading ? <Skeleton height={38} /> : (
                  <select value={parqResp} onChange={e => setParqResp(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">— Seleccionar responsable —</option>
                    {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                  </select>
                )}
              </Lbl>
            </div>

            <p style={{ fontSize: '.68rem', color: T.textMid, marginBottom: 10 }}>Marcar SI / NO para cada punto:</p>

            {PARQ_CHECKS.map(p => (
              <CheckRow
                key={p.key}
                label={p.label}
                value={parqChecks[p.key] || ''}
                onChange={v => setParqCheck(p.key, v)}
              />
            ))}

            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <span style={{ fontSize: '.78rem', color: T.textMid }}>
                Checks OK: <strong style={{ color: parqOk === PARQ_CHECKS.length ? T.secondary : T.warn }}>{parqOk}/{PARQ_CHECKS.length}</strong>
              </span>
            </div>

            <div style={{ marginBottom: 18 }}>
              <Lbl text="Observaciones">
                <textarea value={parqObs} onChange={e => setParqObs(e.target.value)} rows={2} placeholder="Novedades del parqueo..." style={{ ...inputStyle, resize: 'vertical' }} />
              </Lbl>
            </div>

            <SaveBtn onClick={handleSaveParq} saving={savingParq} fullWidth={isMobile} />
          </Card>

          <Card>
            <SectionTitle>Historial Parqueo</SectionTitle>
            {parqLoad ? <Skeleton height={120} /> : (parqData || []).length === 0 ? (
              <p style={{ textAlign: 'center', padding: 24, color: T.textMid }}>Sin registros.</p>
            ) : isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(parqData || []).slice(0, 100).map(r => {
                  const ok = PARQ_CHECKS.filter(p => (r.checks || {})[p.key] === 'si').length;
                  return (
                    <div key={r.id} style={{ background: T.white, borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.10)', borderLeft: `4px solid ${r.resultado === 'cumple' ? T.secondary : T.danger}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>📅 {r.fecha || '—'}</span>
                          {r.hora && <span style={{ marginLeft: 8, fontSize: 12, color: T.textMid }}>🕐 {r.hora}</span>}
                        </div>
                        <Badge ok={r.resultado === 'cumple'} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.textDark, marginBottom: 4 }}>👤 {r.responsable || '—'}</div>
                      <div style={{ fontSize: 13, marginBottom: r.obs ? 4 : 0 }}>
                        <b>Checks OK:</b> <span style={{ color: ok === PARQ_CHECKS.length ? T.secondary : T.warn, fontWeight: 700 }}>{ok}/{PARQ_CHECKS.length}</span>
                      </div>
                      {r.obs && <div style={{ fontSize: 12, color: T.textMid }}>📝 {r.obs}</div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: T.primary }}>
                      {['Fecha', 'Hora', 'Responsable', 'Checks OK', 'Resultado', '', ''].map((h, hi) => (
                        <th key={hi} style={{ padding: '9px 12px', textAlign: 'left', color: T.white, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(parqData || []).slice(0, 100).map((r, i) => {
                      const ok = PARQ_CHECKS.filter(p => (r.checks || {})[p.key] === 'si').length;
                      const isExp = expParq === r.id;
                      return (
                        <Fragment key={r.id}>
                          <tr style={{ background: isExp ? '#F1F8E9' : i % 2 === 0 ? T.white : '#F9FBF9', cursor: 'pointer' }} onClick={() => toggleParqExpand(r.id)}>
                            <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600 }}>{r.fecha || '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.hora || '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.responsable || '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: ok === PARQ_CHECKS.length ? T.secondary : T.warn }}>{ok}/{PARQ_CHECKS.length}</td>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }}><Badge ok={r.resultado === 'cumple'} /></td>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0', textAlign: 'center', color: T.secondary, fontWeight: 700, fontSize: '.8rem' }}>{isExp ? '▲' : '▼'}</td>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0' }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => { if (window.confirm('¿Eliminar este registro?')) removeParq(r.id); }}
                                style={{ padding: '3px 10px', borderRadius: 5, border: `1.5px solid ${T.danger}`, background: '#fff', color: T.danger, cursor: 'pointer', fontSize: '.75rem', fontWeight: 700, fontFamily: 'inherit' }}>✕</button>
                            </td>
                          </tr>
                          {isExp && (
                            <tr>
                              <td colSpan={7} style={{ padding: 0, borderBottom: '2px solid #A5D6A7' }}>
                                <div style={{ padding: '14px 18px', background: '#F9FEF9', borderLeft: '4px solid #2E7D32' }}>
                                  <div style={{ fontWeight: 700, fontSize: '.7rem', color: T.secondary, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Detalle del parqueo</div>
                                  <table style={{ borderCollapse: 'collapse', fontSize: '.8rem' }}>
                                    <tbody>
                                      {PARQ_CHECKS.map((p, pi) => {
                                        const v = (r.checks || {})[p.key];
                                        return (
                                          <tr key={p.key} style={{ background: pi % 2 === 0 ? '#fff' : '#F4FAF4' }}>
                                            <td style={{ padding: '4px 24px 4px 10px', color: T.textDark, whiteSpace: 'nowrap' }}>{p.label}</td>
                                            <td style={{ padding: '4px 14px', textAlign: 'center', fontWeight: 700 }}>
                                              {v === 'si' ? <span style={{ color: T.accent }}>✓</span> : v === 'no' ? <span style={{ color: T.danger }}>✗</span> : <span style={{ color: T.textMid }}>N/A</span>}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                  {r.obs && <div style={{ marginTop: 10, fontSize: '.78rem', color: T.textMid }}>📝 {r.obs}</div>}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
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
