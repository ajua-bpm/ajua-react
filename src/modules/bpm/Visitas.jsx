import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  primary:   '#1B5E20',
  secondary: '#2E7D32',
  white:     '#FFFFFF',
  border:    '#E0E0E0',
  textDark:  '#1A1A18',
  textMid:   '#6B6B60',
  danger:    '#C62828',
  warn:      '#E65100',
  rowAlt:    '#F9FBF9',
};
const card = {
  background: '#fff', borderRadius: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 20, marginBottom: 20,
};
const LBL = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '.06em', color: T.textMid,
};
const INP = {
  padding: '9px 12px', border: `1px solid ${T.border}`, borderRadius: 6,
  fontSize: '.83rem', outline: 'none', fontFamily: 'inherit',
  width: '100%', marginTop: 2, background: '#fff', color: T.textDark,
};

const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

const MOTIVOS = [
  'Proveedor', 'Cliente', 'Auditoría', 'Visita técnica', 'Administrativo', 'Otro',
];

const INIT = () => ({
  visitante: '', empresa: '', dpi: '', fecha: today(),
  horaEntrada: nowTime(), horaSalida: '',
  motivo: '', motivoOtro: '', autoriza: '', obs: '',
});

export default function Visitas() {
  const toast = useToast();
  const { data, loading } = useCollection('vis', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { add, update, saving } = useWrite('vis');

  const [form, setForm] = useState(INIT());

  const handleSave = async () => {
    if (!form.visitante || !form.fecha || !form.motivo) {
      toast('Visitante, fecha y motivo son requeridos', 'error'); return;
    }
    const motivoFinal = form.motivo === 'Otro' ? (form.motivoOtro || 'Otro') : form.motivo;
    await add({ ...form, motivo: motivoFinal, estado: 'adentro' });
    toast('Visita registrada — entrada');
    setForm(INIT());
  };

  const registrarSalida = async (r) => {
    await update(r.id, { horaSalida: nowTime(), estado: 'salió' });
    toast('Salida registrada');
  };

  if (loading) {
    return (
      <div>
        <div style={{ height: 28, background: '#E8F5E9', borderRadius: 6, width: 240, marginBottom: 8 }} />
        <div style={card}><Skeleton rows={5} /></div>
      </div>
    );
  }

  const adentro = data.filter(r => r.estado === 'adentro' && r.fecha === today());

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: T.primary, margin: 0 }}>
          Control de Visitas
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, margin: '4px 0 0' }}>
          Registro de entrada y salida de visitantes externos
        </p>
      </div>

      {/* ── Active visitors panel ── */}
      {adentro.length > 0 && (
        <div style={{
          background: 'rgba(27,94,32,.05)', border: `1.5px solid ${T.secondary}`,
          borderRadius: 8, padding: '14px 18px', marginBottom: 20,
        }}>
          <div style={{ fontWeight: 700, color: T.primary, fontSize: '.88rem', marginBottom: 10 }}>
            Actualmente en instalaciones — {adentro.length} visitante{adentro.length !== 1 ? 's' : ''}
          </div>
          {adentro.map((r, i) => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 0',
              borderBottom: i < adentro.length - 1 ? `1px solid rgba(46,125,50,.2)` : 'none',
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: '.88rem', color: T.textDark }}>{r.visitante}</span>
                {r.empresa && <span style={{ fontSize: '.78rem', color: T.textMid, marginLeft: 8 }}>{r.empresa}</span>}
                <span style={{ fontSize: '.78rem', color: T.textMid, marginLeft: 10 }}>
                  {r.motivo} · Entrada: {r.horaEntrada}
                  {r.autoriza && <span> · Autoriza: {r.autoriza}</span>}
                </span>
              </div>
              <button onClick={() => registrarSalida(r)} style={{
                padding: '6px 14px', background: T.primary, color: '#fff',
                border: 'none', borderRadius: 5, fontSize: '.75rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}>
                Registrar Salida
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Form ── */}
      <div style={card}>
        <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
          Registrar Visita
        </div>

        {/* Personal info row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 12 }}>
          <label style={LBL}>
            Nombre visitante *
            <input value={form.visitante} onChange={e => setForm(f => ({ ...f, visitante: e.target.value }))} placeholder="Nombre completo" style={INP} />
          </label>
          <label style={LBL}>
            Empresa
            <input value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} placeholder="Empresa u organización" style={INP} />
          </label>
          <label style={LBL}>
            DPI / Identificación
            <input value={form.dpi} onChange={e => setForm(f => ({ ...f, dpi: e.target.value }))} placeholder="No. de DPI" style={INP} />
          </label>
          <label style={LBL}>
            Autoriza (anfitrión)
            <input value={form.autoriza} onChange={e => setForm(f => ({ ...f, autoriza: e.target.value }))} placeholder="Quien autoriza" style={INP} />
          </label>
        </div>

        {/* Time row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 12 }}>
          <label style={LBL}>
            Fecha *
            <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} style={INP} />
          </label>
          <label style={LBL}>
            Hora entrada
            <input type="time" value={form.horaEntrada} onChange={e => setForm(f => ({ ...f, horaEntrada: e.target.value }))} style={INP} />
          </label>
          <label style={LBL}>
            Hora salida
            <input type="time" value={form.horaSalida} onChange={e => setForm(f => ({ ...f, horaSalida: e.target.value }))} style={INP} />
          </label>
          <label style={LBL}>
            Motivo *
            <select value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} style={INP}>
              <option value="">— Seleccionar —</option>
              {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          {form.motivo === 'Otro' && (
            <label style={LBL}>
              Especificar motivo
              <input value={form.motivoOtro} onChange={e => setForm(f => ({ ...f, motivoOtro: e.target.value }))} placeholder="Describe el motivo" style={INP} />
            </label>
          )}
        </div>

        <label style={{ ...LBL, marginBottom: 14 }}>
          Observaciones
          <textarea value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))}
            rows={2} placeholder="Notas adicionales..."
            style={{ ...INP, resize: 'vertical', lineHeight: 1.5 }} />
        </label>

        <button onClick={handleSave} disabled={saving} style={{
          padding: '11px 28px', background: saving ? T.border : T.primary,
          color: saving ? T.textMid : '#fff', border: 'none', borderRadius: 6,
          fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}>
          {saving ? 'Guardando...' : 'Registrar Entrada'}
        </button>
      </div>

      {/* ── History ── */}
      <div style={card}>
        <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
          Historial — {data.length} registros
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.primary }}>
                {['Fecha', 'Visitante', 'Empresa', 'Motivo', 'Entrada', 'Salida', 'Estado'].map(h => (
                  <th key={h} style={{
                    padding: '9px 14px', textAlign: 'left', color: '#fff',
                    fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 60).map((r, idx) => (
                <tr key={r.id} style={{ background: idx % 2 === 1 ? T.rowAlt : '#fff', borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', fontWeight: 600, color: T.textDark, whiteSpace: 'nowrap' }}>{r.fecha}</td>
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textDark }}>{r.visitante}</td>
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textMid }}>{r.empresa || '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textMid }}>{r.motivo}</td>
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textMid }}>{r.horaEntrada || '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textMid }}>{r.horaSalida || '—'}</td>
                  <td style={{ padding: '9px 14px' }}>
                    {r.estado === 'salió' ? (
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.72rem', fontWeight: 700, background: 'rgba(46,125,50,.12)', color: T.secondary }}>
                        Salió
                      </span>
                    ) : (
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.72rem', fontWeight: 700, background: 'rgba(27,94,32,.18)', color: T.primary }}>
                        Adentro
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: T.textMid, fontSize: '.83rem' }}>
                  Sin registros aún
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
