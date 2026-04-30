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

function cloroEstado(ppm) {
  if (ppm === '' || isNaN(ppm)) return null;
  const v = parseFloat(ppm);
  if (v < 0.5)  return { label: 'BAJO — Ajustar',  bg: '#FFEBEE', c: T.danger };
  if (v <= 1.5) return { label: '✓ En rango',       bg: '#E8F5E9', c: T.secondary };
  return          { label: 'ALTO — Ajustar',  bg: '#FFEBEE', c: T.danger };
}

export default function ControlCloro() {
  const toast = useToast();
  const { empleados, loading: empLoad } = useEmpleados();
  const { data, loading } = useCollection('controlCloro', { orderField: 'fecha', orderDir: 'desc', limit: 60 });
  const { add, saving }   = useWrite('controlCloro');

  const [fecha,       setFecha]       = useState(today());
  const [hora,        setHora]        = useState(nowHM());
  const [responsable, setResponsable] = useState('');
  const [ppm,         setPpm]         = useState('');
  const [obs,         setObs]         = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');

  const estado  = cloroEstado(ppm);
  const visible = filtroFecha ? data.filter(r => r.fecha === filtroFecha) : data;

  const handleSave = async () => {
    if (!responsable) { toast('Seleccioná responsable', 'warn'); return; }
    if (ppm === '')   { toast('Ingresá concentración', 'warn');  return; }
    try {
      await add({ fecha, hora, responsable, ppm: parseFloat(ppm), obs, estado: estado?.label || '' });
      toast('✓ Registro guardado');
      setPpm(''); setObs('');
    } catch { toast('Error al guardar', 'error'); }
  };

  if (loading || empLoad) return <Skeleton />;

  return (
    <div>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: T.primary, marginBottom: 4 }}>💧 Control Cloro Cisterna</h1>
      <p style={{ fontSize: '.85rem', color: T.textMid, marginBottom: 24 }}>Rango aceptable: 0.5 – 1.5 ppm</p>

      <Card>
        <SecTitle>Nuevo Registro</SecTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Lbl text="Fecha"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={iStyle} /></Lbl>
          <Lbl text="Hora"><input type="time" value={hora}  onChange={e => setHora(e.target.value)}  style={iStyle} /></Lbl>
          <Lbl text="Responsable">
            <select value={responsable} onChange={e => setResponsable(e.target.value)} style={iStyle}>
              <option value="">Seleccionar…</option>
              {empleados.map(e => <option key={e.id || e.nombre} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </Lbl>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 16 }}>
          <Lbl text="Concentración (ppm)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" step="0.01" min="0" value={ppm} onChange={e => setPpm(e.target.value)}
                style={{ ...iStyle, width: 130 }} placeholder="0.00" />
              <span style={{ fontSize: '.85rem', color: T.textMid }}>ppm</span>
            </div>
          </Lbl>
          {estado && (
            <span style={{ marginBottom: 2, padding: '6px 16px', borderRadius: 100, fontSize: '.8rem', fontWeight: 700, background: estado.bg, color: estado.c }}>
              {estado.label}
            </span>
          )}
        </div>

        <Lbl text="Observaciones">
          <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
            style={{ ...iStyle, resize: 'vertical', marginBottom: 16 }} placeholder="Observaciones…" />
        </Lbl>

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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.83rem' }}>
            <thead>
              <tr style={{ background: T.primary }}>
                {['Fecha','Hora','Responsable','ppm','Estado','Observaciones'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', color: T.white, textAlign: 'left', fontWeight: 600, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => {
                const est = cloroEstado(r.ppm);
                return (
                  <tr key={r.id} style={{ background: i % 2 ? T.bgLight : T.white }}>
                    <td style={{ padding: '9px 12px', color: T.textMid }}>{r.fecha}</td>
                    <td style={{ padding: '9px 12px', color: T.textMid }}>{r.hora}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 500 }}>{r.responsable}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 700, color: T.primary }}>{r.ppm} ppm</td>
                    <td style={{ padding: '9px 12px' }}>
                      {est && <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600, background: est.bg, color: est.c }}>{est.label}</span>}
                    </td>
                    <td style={{ padding: '9px 12px', color: T.textMid, fontSize: '.78rem' }}>{r.obs || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
