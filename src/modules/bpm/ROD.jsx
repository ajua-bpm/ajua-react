import { useState } from 'react';
import { useEmpleados } from '../../hooks/useMainData';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', accent: '#43A047',
  white: '#FFFFFF', bgLight: '#F5F5F5', bgCard: '#FFFFFF',
  border: '#E0E0E0', textDark: '#212121', textMid: '#616161',
  danger: '#C62828', warn: '#E65100',
};

const TRAMPAS = [
  'T-01 — Entrada principal',
  'T-02 — Cooler 1 izquierda',
  'T-03 — Cooler 1 derecha',
  'T-04 — Cooler 2 izquierda',
  'T-05 — Cooler 2 derecha',
  'T-06 — Pre-carga norte',
  'T-07 — Pre-carga sur',
  'T-08 — Bodega centro',
  'T-09 — Bodega fondo',
  'T-10 — Área de lavado',
  'T-11 — Salida de carga',
];

const today = () => new Date().toISOString().slice(0, 10);

const initTrampas = () =>
  TRAMPAS.map((nombre, idx) => ({
    id: `T-${String(idx + 1).padStart(2, '0')}`,
    nombre,
    estado: 'en_lugar',
    nota: '',
  }));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inp = (val, onChange, type = 'text', extra = {}) => (
  <input type={type} value={val} onChange={e => onChange(e.target.value)}
    style={{
      padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
      fontSize: '.88rem', outline: 'none', width: '100%', fontFamily: 'inherit', ...extra,
    }} />
);

const sel = (val, onChange, opts) => (
  <select value={val} onChange={e => onChange(e.target.value)}
    style={{
      padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
      fontSize: '.88rem', outline: 'none', width: '100%', fontFamily: 'inherit',
      background: '#fff', cursor: 'pointer',
    }}>
    {opts}
  </select>
);

const Badge = ({ type }) => {
  const M = {
    sin_novedades: { bg: '#E8F5E9', c: '#2E7D32', l: '✓ Sin novedades' },
    con_novedades: { bg: '#FFEBEE', c: '#C62828', l: '⚠ Con novedades' },
    en_lugar:      { bg: '#E8F5E9', c: '#2E7D32', l: '✓ En su lugar' },
    novedad:       { bg: '#FFEBEE', c: '#C62828', l: '⚠ Novedad' },
  };
  const m = M[type] || { bg: '#F5F5F5', c: '#616161', l: type };
  return <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600, background: m.bg, color: m.c }}>{m.l}</span>;
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
  <div style={{
    fontSize: '.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em',
    color: T.secondary, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${T.border}`,
  }}>{children}</div>
);

// ─── Main component ───────────────────────────────────────────────────────────
export default function ROD() {
  const toast = useToast();
  const { empleados, loading: empLoading } = useEmpleados();
  const { data: registros, loading: histLoading } = useCollection('rod', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { add, saving } = useWrite('rod');

  const [form, setForm] = useState({ fecha: today(), responsable: '' });
  const [trampas, setTrampas] = useState(initTrampas);
  const [obs, setObs] = useState('');

  const setTrampa = (i, field, value) =>
    setTrampas(prev => prev.map((t, idx) => idx !== i ? t : { ...t, [field]: value }));

  const handleSave = async () => {
    if (!form.fecha) { toast('Ingresá la fecha', 'error'); return; }
    if (!form.responsable) { toast('Seleccioná el responsable', 'error'); return; }

    const conNovedad = trampas.filter(t => t.estado === 'novedad').length;
    const resultado = conNovedad === 0 ? 'sin_novedades' : 'con_novedades';

    try {
      await add({
        fecha: form.fecha,
        responsable: form.responsable,
        trampas: trampas.map(t => ({
          id: t.id,
          nombre: t.nombre,
          estado: t.estado,
          nota: t.estado === 'novedad' ? t.nota : '',
        })),
        resultado,
        obs,
      });
      toast('Registro ROD guardado correctamente');
      setTrampas(initTrampas());
      setObs('');
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  const conNovedad = trampas.filter(t => t.estado === 'novedad').length;
  const enLugar = trampas.filter(t => t.estado === 'en_lugar').length;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: T.textDark, maxWidth: 900, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>Roedores</h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, marginTop: 4, marginBottom: 0 }}>
          Inspección de {TRAMPAS.length} trampas — verificación de posición y novedades
        </p>
      </div>

      <Card>
        <SectionTitle>Nuevo Registro</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
          <Lbl text="Fecha">{inp(form.fecha, v => setForm(f => ({ ...f, fecha: v })), 'date')}</Lbl>
          <Lbl text="Responsable">
            {empLoading
              ? <Skeleton height={38} />
              : sel(form.responsable, v => setForm(f => ({ ...f, responsable: v })),
                  <>
                    <option value="">— Seleccionar —</option>
                    {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}{e.cargo ? ' · ' + e.cargo : ''}</option>)}
                  </>
                )
            }
          </Lbl>
        </div>

        {/* Trampas grid */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary, marginBottom: 12 }}>
            Estado de trampas ({enLugar}/{TRAMPAS.length} en su lugar)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {trampas.map((t, i) => (
              <div key={t.id} style={{
                background: t.estado === 'novedad' ? '#FFF8F8' : T.bgLight,
                border: `1px solid ${t.estado === 'novedad' ? '#FFCDD2' : T.border}`,
                borderRadius: 8, padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* Trap ID chip */}
                  <span style={{
                    background: t.estado === 'novedad' ? T.danger : T.primary,
                    color: T.white, borderRadius: 4, padding: '3px 8px',
                    fontSize: '.72rem', fontWeight: 700, letterSpacing: '.04em',
                    minWidth: 40, textAlign: 'center', flexShrink: 0,
                  }}>
                    {t.id}
                  </span>

                  <span style={{ flex: 1, fontWeight: 500, fontSize: '.85rem', minWidth: 160 }}>
                    {t.nombre.split('— ')[1] || t.nombre}
                  </span>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => setTrampa(i, 'estado', 'en_lugar')}
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: '1.5px solid',
                        cursor: 'pointer', fontSize: '.8rem', fontWeight: 600,
                        fontFamily: 'inherit', transition: 'all .15s',
                        background: t.estado === 'en_lugar' ? T.accent : T.white,
                        borderColor: t.estado === 'en_lugar' ? T.accent : T.border,
                        color: t.estado === 'en_lugar' ? T.white : T.textMid,
                      }}
                    >
                      En su lugar ✓
                    </button>
                    <button
                      onClick={() => setTrampa(i, 'estado', 'novedad')}
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: '1.5px solid',
                        cursor: 'pointer', fontSize: '.8rem', fontWeight: 600,
                        fontFamily: 'inherit', transition: 'all .15s',
                        background: t.estado === 'novedad' ? T.danger : T.white,
                        borderColor: t.estado === 'novedad' ? T.danger : T.border,
                        color: t.estado === 'novedad' ? T.white : T.textMid,
                      }}
                    >
                      Novedad ⚠
                    </button>
                  </div>
                </div>

                {t.estado === 'novedad' && (
                  <div style={{ marginTop: 10 }}>
                    <input
                      type="text"
                      value={t.nota}
                      onChange={e => setTrampa(i, 'nota', e.target.value)}
                      placeholder="Describir la novedad encontrada..."
                      style={{
                        padding: '7px 12px', border: `1.5px solid ${T.danger}`, borderRadius: 6,
                        fontSize: '.83rem', outline: 'none', width: '100%', fontFamily: 'inherit',
                        background: '#FFF', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Result preview */}
        <div style={{
          background: conNovedad > 0 ? '#FFEBEE' : '#E8F5E9',
          border: `1px solid ${conNovedad > 0 ? '#FFCDD2' : '#C8E6C9'}`,
          borderRadius: 8, padding: '10px 16px', marginBottom: 20,
          fontSize: '.83rem', fontWeight: 600,
          color: conNovedad > 0 ? T.danger : T.secondary,
        }}>
          {conNovedad > 0
            ? `⚠ Con novedades — ${conNovedad} trampa(s) requieren atención`
            : `✓ Sin novedades — Las ${TRAMPAS.length} trampas en su lugar`}
        </div>

        <Lbl text="Observaciones">
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Observaciones generales de la ronda..."
            rows={3}
            style={{
              padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
              fontSize: '.88rem', outline: 'none', width: '100%', fontFamily: 'inherit',
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </Lbl>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: 16, padding: '11px 28px',
            background: saving ? '#BDBDBD' : T.primary,
            color: T.white, border: 'none', borderRadius: 6,
            fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Guardando...' : 'Guardar Registro ROD'}
        </button>
      </Card>

      {/* History */}
      <Card>
        <SectionTitle>Historial ({(registros || []).length} registros)</SectionTitle>

        {histLoading ? (
          <Skeleton height={160} />
        ) : (registros || []).length === 0 ? (
          <p style={{ textAlign: 'center', padding: 32, color: T.textMid, fontSize: '.85rem' }}>Sin registros aún.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Responsable', 'Trampas OK', 'Novedades', 'Resultado'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', color: T.white,
                      fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(registros || []).slice(0, 100).map((r, i) => {
                  const tr = r.trampas || [];
                  const okCount  = tr.filter(t => t.estado === 'en_lugar').length;
                  const novCount = tr.filter(t => t.estado === 'novedad').length;
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? T.white : '#F9FBF9' }}>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600 }}>{r.fecha}</td>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.responsable || '—'}</td>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', textAlign: 'center', color: T.accent, fontWeight: 600 }}>{okCount}</td>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', textAlign: 'center', color: novCount > 0 ? T.danger : T.textMid, fontWeight: novCount > 0 ? 700 : 400 }}>{novCount}</td>
                      <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>
                        <Badge type={r.resultado || 'con_novedades'} />
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
