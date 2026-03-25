import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

const T = {
  primary: '#1B5E20', secondary: '#2E7D32', danger: '#C62828',
  textMid: '#6B6B60', border: '#E0E0E0', white: '#FFFFFF', bgLight: '#F5F5F5',
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

const COOLERS = [
  { key: 'c1', label: 'Cooler 1', icon: '❄️' },
  { key: 'c2', label: 'Cooler 2', icon: '❄️' },
];

export default function ControlTemperatura() {
  const toast = useToast();
  const { empleados, loading: empLoad } = useEmpleados();
  const { data, loading } = useCollection('controlTemp', { orderField: 'fecha', orderDir: 'desc', limit: 60 });
  const { add, saving }   = useWrite('controlTemp');

  const [fecha,       setFecha]       = useState(today());
  const [hora,        setHora]        = useState(nowHM());
  const [responsable, setResponsable] = useState('');
  const [temps,       setTemps]       = useState({ c1: '', c2: '' });
  const [enc,         setEnc]         = useState({ c1: false, c2: false });
  const [obs,         setObs]         = useState({ c1: '', c2: '' });
  const [filtroFecha, setFiltroFecha] = useState('');

  const setT = k => e => setTemps(p => ({ ...p, [k]: e.target.value }));
  const setO = k => e => setObs(p => ({ ...p, [k]: e.target.value }));
  const toggleEnc = k => () => setEnc(p => ({ ...p, [k]: !p[k] }));

  const visible = filtroFecha ? data.filter(r => r.fecha === filtroFecha) : data;

  const handleSave = async () => {
    if (!responsable) { toast('Seleccioná responsable', 'warn'); return; }
    try {
      await add({
        fecha, hora, responsable,
        c1Temp: temps.c1 !== '' ? parseFloat(temps.c1) : null,
        c1Enc: enc.c1, c1Obs: obs.c1,
        c2Temp: temps.c2 !== '' ? parseFloat(temps.c2) : null,
        c2Enc: enc.c2, c2Obs: obs.c2,
      });
      toast('✓ Registro guardado');
      setTemps({ c1: '', c2: '' }); setObs({ c1: '', c2: '' }); setEnc({ c1: false, c2: false });
    } catch { toast('Error al guardar', 'error'); }
  };

  if (loading || empLoad) return <Skeleton />;

  return (
    <div>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: T.primary, marginBottom: 4 }}>🌡️ Control de Temperatura</h1>
      <p style={{ fontSize: '.85rem', color: T.textMid, marginBottom: 24 }}>Registro de temperatura y estado de coolers</p>

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
          {COOLERS.map(cl => (
            <div key={cl.key} style={{ border: `1.5px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: '.88rem', color: T.primary, marginBottom: 14 }}>
                {cl.icon} {cl.label}
              </div>

              {/* Encendido toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={toggleEnc(cl.key)}
                  style={{
                    padding: '6px 18px', borderRadius: 100, border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: '.8rem', fontFamily: 'inherit',
                    background: enc[cl.key] ? '#E8F5E9' : '#FFEBEE',
                    color: enc[cl.key] ? T.secondary : T.danger,
                  }}>
                  {enc[cl.key] ? '● Encendido' : '○ Apagado'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <input type="number" step="0.1" value={temps[cl.key]} onChange={setT(cl.key)}
                  style={{ ...iStyle, width: 110 }} placeholder="0.0" disabled={!enc[cl.key]} />
                <span style={{ fontSize: '.85rem', color: T.textMid }}>°C</span>
              </div>

              <input value={obs[cl.key]} onChange={setO(cl.key)} placeholder="Observación…"
                style={{ ...iStyle, fontSize: '.8rem' }} />
            </div>
          ))}
        </div>

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
                  {['Fecha','Hora','Responsable','C1 Estado','C1 °C','C2 Estado','C2 °C'].map(h => (
                    <th key={h} style={{ padding: '9px 10px', color: T.white, textAlign: 'left', fontWeight: 600, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 ? T.bgLight : T.white }}>
                    <td style={{ padding: '9px 10px', color: T.textMid }}>{r.fecha}</td>
                    <td style={{ padding: '9px 10px', color: T.textMid }}>{r.hora}</td>
                    <td style={{ padding: '9px 10px', fontWeight: 500 }}>{r.responsable}</td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600,
                        background: r.c1Enc ? '#E8F5E9' : '#FFEBEE',
                        color: r.c1Enc ? T.secondary : T.danger }}>
                        {r.c1Enc ? '● Encendido' : '○ Apagado'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 10px', fontWeight: 700 }}>{r.c1Temp != null ? `${r.c1Temp}°C` : '—'}</td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600,
                        background: r.c2Enc ? '#E8F5E9' : '#FFEBEE',
                        color: r.c2Enc ? T.secondary : T.danger }}>
                        {r.c2Enc ? '● Encendido' : '○ Apagado'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 10px', fontWeight: 700 }}>{r.c2Temp != null ? `${r.c2Temp}°C` : '—'}</td>
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
