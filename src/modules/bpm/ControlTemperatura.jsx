import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

const T = {
  primary: '#1B5E20', secondary: '#2E7D32', danger: '#C62828',
  warn: '#E65100', textMid: '#6B6B60', border: '#E0E0E0',
  white: '#FFFFFF', bgLight: '#F5F5F5', blue: '#1565C0', bgBlue: '#E3F2FD',
};

const today = () => new Date().toISOString().slice(0, 10);
const nowHM = () => new Date().toTimeString().slice(0, 5);

const iStyle = { padding: '9px 12px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.88rem', outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' };
const Lbl = ({ text, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <span style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary }}>{text}</span>
    {children}
  </label>
);
const Card = ({ children, style = {} }) => (
  <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, padding: 24, marginBottom: 20, ...style }}>{children}</div>
);
const SecTitle = ({ children }) => (
  <div style={{ fontSize: '.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.secondary, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>{children}</div>
);

// Cooler 1: 0–4°C | Cooler 2: -18–-15°C
const COOLERS = [
  { key: 'c1', label: 'Cooler 1', icon: '❄️', min: 0,   max: 4,   rangoLabel: '0°C a 4°C' },
  { key: 'c2', label: 'Cooler 2', icon: '❄️', min: -18, max: -15, rangoLabel: '-18°C a -15°C' },
];

function tempEstado(temp, min, max) {
  if (temp === '' || temp === null || isNaN(temp)) return null;
  const v = parseFloat(temp);
  if (v < min) return { label: 'MUY FRÍO',       bg: T.bgBlue,  c: T.blue };
  if (v <= max) return { label: '✓ CORRECTO',     bg: '#E8F5E9', c: T.secondary };
  return          { label: 'FUERA DE RANGO', bg: '#FFEBEE', c: T.danger };
}

function calcResultado(temps) {
  for (const cl of COOLERS) {
    const est = tempEstado(temps[cl.key], cl.min, cl.max);
    if (!est || est.label !== '✓ CORRECTO') return 'RECHAZADO';
  }
  return 'APROBADO';
}

export default function ControlTemperatura() {
  const toast = useToast();
  const { empleados, loading: empLoad } = useEmpleados();
  const { data, loading } = useCollection('controlTemp', { orderField: 'fecha', orderDir: 'desc', limit: 60 });
  const { add, saving }   = useWrite('controlTemp');

  const [fecha,       setFecha]       = useState(today());
  const [hora,        setHora]        = useState(nowHM());
  const [responsable, setResponsable] = useState('');
  const [temps,       setTemps]       = useState({ c1: '', c2: '' });
  const [obs,         setObs]         = useState({ c1: '', c2: '' });
  const [filtroFecha, setFiltroFecha] = useState('');

  const setT = k => e => setTemps(p => ({ ...p, [k]: e.target.value }));
  const setO = k => e => setObs(p => ({ ...p, [k]: e.target.value }));

  const resultado = calcResultado(temps);
  const visible   = filtroFecha ? data.filter(r => r.fecha === filtroFecha) : data;

  const handleSave = async () => {
    if (!responsable)                    { toast('Seleccioná responsable', 'warn'); return; }
    if (temps.c1 === '' || temps.c2 === '') { toast('Ingresá ambas temperaturas', 'warn'); return; }
    try {
      const est1 = tempEstado(temps.c1, COOLERS[0].min, COOLERS[0].max);
      const est2 = tempEstado(temps.c2, COOLERS[1].min, COOLERS[1].max);
      await add({
        fecha, hora, responsable,
        c1Temp: parseFloat(temps.c1), c1Estado: est1?.label || '', c1Obs: obs.c1,
        c2Temp: parseFloat(temps.c2), c2Estado: est2?.label || '', c2Obs: obs.c2,
        resultado,
      });
      toast('✓ Registro guardado');
      setTemps({ c1: '', c2: '' }); setObs({ c1: '', c2: '' });
    } catch { toast('Error al guardar', 'error'); }
  };

  if (loading || empLoad) return <Skeleton />;

  return (
    <div>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: T.primary, marginBottom: 4 }}>🌡️ Control de Temperatura</h1>
      <p style={{ fontSize: '.85rem', color: T.textMid, marginBottom: 24 }}>Cooler 1: 0–4°C · Cooler 2: -18–-15°C</p>

      <Card>
        <SecTitle>Nuevo Registro</SecTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
          <Lbl text="Fecha"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={iStyle} /></Lbl>
          <Lbl text="Hora"><input type="time" value={hora}  onChange={e => setHora(e.target.value)}  style={iStyle} /></Lbl>
          <Lbl text="Responsable">
            <select value={responsable} onChange={e => setResponsable(e.target.value)} style={iStyle}>
              <option value="">Seleccionar…</option>
              {empleados.map(e => <option key={e.id || e.nombre} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </Lbl>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {COOLERS.map(cl => {
            const est = tempEstado(temps[cl.key], cl.min, cl.max);
            return (
              <div key={cl.key} style={{ border: `1.5px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: '.88rem', color: T.primary, marginBottom: 12 }}>
                  {cl.icon} {cl.label} <span style={{ fontWeight: 400, color: T.textMid, fontSize: '.78rem' }}>({cl.rangoLabel})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input type="number" step="0.1" value={temps[cl.key]} onChange={setT(cl.key)}
                    style={{ ...iStyle, width: 110 }} placeholder="0.0" />
                  <span style={{ fontSize: '.85rem', color: T.textMid }}>°C</span>
                </div>
                {est && (
                  <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.72rem', fontWeight: 700, background: est.bg, color: est.c, display: 'inline-block', marginBottom: 8 }}>
                    {est.label}
                  </span>
                )}
                <input value={obs[cl.key]} onChange={setO(cl.key)} placeholder="Observación…" style={{ ...iStyle, fontSize: '.8rem' }} />
              </div>
            );
          })}
        </div>

        {(temps.c1 !== '' && temps.c2 !== '') && (
          <div style={{ padding: '12px 18px', borderRadius: 8, marginBottom: 16,
            background: resultado === 'APROBADO' ? '#E8F5E9' : '#FFEBEE',
            color:      resultado === 'APROBADO' ? T.secondary : T.danger,
            fontWeight: 700, fontSize: '.9rem' }}>
            Resultado: {resultado === 'APROBADO' ? '✓ APROBADO' : '✗ RECHAZADO — Revisar coolers fuera de rango'}
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{ padding: '11px 28px', background: saving ? '#BDBDBD' : T.primary, color: T.white, border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Guardando...' : 'Guardar Registro'}
        </button>
      </Card>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <SecTitle style={{ marginBottom: 0 }}>Historial ({visible.length})</SecTitle>
          <input type="date" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} style={{ ...iStyle, width: 160 }} />
        </div>
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: T.textMid }}>Sin registros</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.83rem' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha','Hora','Resp','C1 °C','C1 Estado','C2 °C','C2 Estado','Resultado'].map(h => (
                    <th key={h} style={{ padding: '9px 10px', color: T.white, textAlign: 'left', fontWeight: 600, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => {
                  const e1 = tempEstado(r.c1Temp, COOLERS[0].min, COOLERS[0].max);
                  const e2 = tempEstado(r.c2Temp, COOLERS[1].min, COOLERS[1].max);
                  const aprobado = r.resultado === 'APROBADO';
                  return (
                    <tr key={r.id} style={{ background: i % 2 ? T.bgLight : T.white }}>
                      <td style={{ padding: '9px 10px', color: T.textMid }}>{r.fecha}</td>
                      <td style={{ padding: '9px 10px', color: T.textMid }}>{r.hora}</td>
                      <td style={{ padding: '9px 10px', fontWeight: 500 }}>{r.responsable}</td>
                      <td style={{ padding: '9px 10px', fontWeight: 700 }}>{r.c1Temp}°C</td>
                      <td style={{ padding: '9px 10px' }}>{e1 && <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: '.68rem', fontWeight: 600, background: e1.bg, color: e1.c }}>{e1.label}</span>}</td>
                      <td style={{ padding: '9px 10px', fontWeight: 700 }}>{r.c2Temp}°C</td>
                      <td style={{ padding: '9px 10px' }}>{e2 && <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: '.68rem', fontWeight: 600, background: e2.bg, color: e2.c }}>{e2.label}</span>}</td>
                      <td style={{ padding: '9px 10px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 700, background: aprobado ? '#E8F5E9' : '#FFEBEE', color: aprobado ? T.secondary : T.danger }}>
                          {aprobado ? '✓ APROBADO' : '✗ RECHAZADO'}
                        </span>
                      </td>
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
