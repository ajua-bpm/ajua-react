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

const PLACAS = ['008', '125', 'Otro'];

const CHECKS = [
  'Furgón limpio y desinfectado',
  'Temperatura correcta (≤4°C)',
  'Producto en buen estado',
  'Embalaje íntegro',
  'Carga completa según pedido',
  'Documentos en orden',
  'Conductor con uniforme',
  'Higiene del conductor',
  'Camión en buen estado mecánico',
  'Sello de seguridad colocado',
];

const ESTADOS = ['pendiente', 'despachado', 'entregado'];

const today = () => new Date().toISOString().slice(0, 10);
const initChecks = () => CHECKS.map(texto => ({ texto, ok: null }));

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

// ─── Badge components ─────────────────────────────────────────────────────────
const Badge = ({ type }) => {
  const M = {
    cumple:    { bg: '#E8F5E9', c: '#2E7D32', l: '✓ Cumple' },
    no_cumple: { bg: '#FFEBEE', c: '#C62828', l: '✗ No cumple' },
  };
  const m = M[type] || { bg: '#F5F5F5', c: '#616161', l: type };
  return <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.7rem', fontWeight: 600, background: m.bg, color: m.c }}>{m.l}</span>;
};

const EstadoBadge = ({ estado }) => {
  const M = {
    pendiente:  { bg: '#FFF3E0', c: '#E65100', l: 'Pendiente' },
    despachado: { bg: '#E3F2FD', c: '#1565C0', l: 'Despachado' },
    entregado:  { bg: '#E8F5E9', c: '#2E7D32', l: 'Entregado' },
  };
  const m = M[estado] || { bg: '#F5F5F5', c: '#616161', l: estado || '—' };
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

// ─── Inline estado updater ────────────────────────────────────────────────────
function EstadoUpdater({ record, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(record.estado || 'pendiente');
  const [saving, setSaving] = useState(false);

  const handleChange = async (newVal) => {
    setValue(newVal);
    setSaving(true);
    try {
      await onUpdate(record.id, { estado: newVal });
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        style={{ cursor: 'pointer' }}
        title="Clic para cambiar estado"
      >
        <EstadoBadge estado={record.estado} />
      </span>
    );
  }

  return (
    <select
      value={value}
      onChange={e => handleChange(e.target.value)}
      disabled={saving}
      autoFocus
      onBlur={() => setEditing(false)}
      style={{
        padding: '4px 8px', border: '1.5px solid #E0E0E0', borderRadius: 6,
        fontSize: '.78rem', outline: 'none', fontFamily: 'inherit',
        background: '#fff', cursor: 'pointer',
      }}
    >
      {ESTADOS.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
    </select>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DT() {
  const toast = useToast();
  const { empleados, loading: empLoading } = useEmpleados();
  const { data: clientes, loading: cliLoading } = useCollection('clientes', { orderField: 'nombre', limit: 200 });
  const { data: registros, loading: histLoading } = useCollection('dt', { orderField: 'fecha', orderDir: 'desc', limit: 300 });
  const { add, update, saving } = useWrite('dt');

  const [form, setForm] = useState({
    fecha: today(),
    conductor: '',
    placa: '',
    placaOtra: '',
    cliente: '',
    temperatura: '',
    cargaKg: '',
    numFel: '',
    estado: 'pendiente',
  });
  const [checks, setChecks] = useState(initChecks);
  const [obs, setObs] = useState('');

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const toggleCheck = (i, value) => {
    setChecks(prev => prev.map((c, idx) => idx !== i ? c : { ...c, ok: c.ok === value ? null : value }));
  };

  // Computed
  const answeredChecks = checks.filter(c => c.ok !== null);
  const okChecks = checks.filter(c => c.ok === true).length;
  const pct = answeredChecks.length > 0 ? Math.round(okChecks / CHECKS.length * 100) : 0;
  const resultado = okChecks >= Math.ceil(CHECKS.length * 0.8) ? 'cumple' : 'no_cumple';

  const handleSave = async () => {
    if (!form.fecha)     { toast('Ingresá la fecha', 'error'); return; }
    if (!form.conductor) { toast('Seleccioná el conductor', 'error'); return; }
    if (!form.placa)     { toast('Seleccioná la placa', 'error'); return; }

    const placaFinal = form.placa === 'Otro' ? (form.placaOtra || 'Otro') : form.placa;

    try {
      await add({
        fecha: form.fecha,
        conductor: form.conductor,
        placa: placaFinal,
        cliente: form.cliente,
        temperatura: form.temperatura !== '' ? Number(form.temperatura) : null,
        cargaKg: form.cargaKg !== '' ? Number(form.cargaKg) : null,
        numFel: form.numFel,
        estado: form.estado,
        checks,
        okChecks,
        totalChecks: CHECKS.length,
        pct,
        resultado,
        obs,
      });
      toast('Registro DT guardado correctamente');
      setChecks(initChecks());
      setObs('');
      setForm(f => ({
        ...f,
        conductor: '', placa: '', placaOtra: '', cliente: '',
        temperatura: '', cargaKg: '', numFel: '', estado: 'pendiente',
      }));
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  };

  const handleEstadoUpdate = async (id, data) => {
    try {
      await update(id, data);
    } catch (e) {
      toast('Error al actualizar estado: ' + e.message, 'error');
    }
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: T.textDark, maxWidth: 1000, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: T.primary, margin: 0 }}>Despacho Transporte</h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, marginTop: 4, marginBottom: 0 }}>
          Checklist de conformidad de carga — {CHECKS.length} puntos de verificación
        </p>
      </div>

      <Card>
        <SectionTitle>Nuevo Registro</SectionTitle>

        {/* Row 1: fecha, conductor, placa */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Lbl text="Fecha">{inp(form.fecha, v => set('fecha', v), 'date')}</Lbl>

          <Lbl text="Conductor">
            {empLoading
              ? <Skeleton height={38} />
              : sel(form.conductor, v => set('conductor', v),
                  <>
                    <option value="">— Seleccionar —</option>
                    {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                  </>
                )
            }
          </Lbl>

          <Lbl text="Placa">
            {sel(form.placa, v => set('placa', v),
              <>
                <option value="">— Seleccionar —</option>
                {PLACAS.map(p => <option key={p} value={p}>{p}</option>)}
              </>
            )}
            {form.placa === 'Otro' && (
              <input
                type="text"
                value={form.placaOtra}
                onChange={e => set('placaOtra', e.target.value)}
                placeholder="Ingresá la placa"
                style={{
                  marginTop: 6, padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
                  fontSize: '.88rem', outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            )}
          </Lbl>
        </div>

        {/* Row 2: cliente, temperatura, cargaKg */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Lbl text="Cliente">
            {cliLoading
              ? <Skeleton height={38} />
              : sel(form.cliente, v => set('cliente', v),
                  <>
                    <option value="">— Seleccionar cliente —</option>
                    {(clientes || []).map(c => <option key={c.id} value={c.nombre || c.id}>{c.nombre}{c.muni ? ' · ' + c.muni : ''}</option>)}
                  </>
                )
            }
          </Lbl>
          <Lbl text="Temperatura (°C)">{inp(form.temperatura, v => set('temperatura', v), 'number')}</Lbl>
          <Lbl text="Carga (kg)">{inp(form.cargaKg, v => set('cargaKg', v), 'number')}</Lbl>
        </div>

        {/* Row 3: numFel, estado */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
          <Lbl text="Número FEL (Factura Electrónica)">{inp(form.numFel, v => set('numFel', v))}</Lbl>
          <Lbl text="Estado">
            {sel(form.estado, v => set('estado', v),
              <>
                <option value="pendiente">Pendiente</option>
                <option value="despachado">Despachado</option>
                <option value="entregado">Entregado</option>
              </>
            )}
          </Lbl>
        </div>

        {/* Checklist */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.secondary }}>
              Checklist de despacho
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '.78rem', color: T.textMid }}>
                {okChecks}/{CHECKS.length} ✓
              </span>
              <span style={{
                fontSize: '.78rem', fontWeight: 700,
                color: pct >= 80 ? T.accent : pct >= 60 ? T.warn : T.danger,
              }}>
                {answeredChecks.length > 0 ? `${pct}%` : '—'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {checks.map((check, i) => (
              <div key={check.texto} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 6,
                background: check.ok === true ? '#F1F8E9' : check.ok === false ? '#FFF8F8' : i % 2 === 0 ? T.white : T.bgLight,
                border: `1px solid ${check.ok === true ? '#DCEDC8' : check.ok === false ? '#FFCDD2' : T.border}`,
              }}>
                <span style={{ flex: 1, fontSize: '.85rem', color: T.textDark }}>{check.texto}</span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => toggleCheck(i, true)}
                    style={{
                      width: 36, height: 32, borderRadius: 6, border: '1.5px solid',
                      cursor: 'pointer', fontWeight: 700, fontSize: '.85rem',
                      fontFamily: 'inherit', transition: 'all .15s',
                      background: check.ok === true ? T.accent : T.white,
                      borderColor: check.ok === true ? T.accent : T.border,
                      color: check.ok === true ? T.white : T.textMid,
                    }}
                    title="Cumple"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => toggleCheck(i, false)}
                    style={{
                      width: 36, height: 32, borderRadius: 6, border: '1.5px solid',
                      cursor: 'pointer', fontWeight: 700, fontSize: '.85rem',
                      fontFamily: 'inherit', transition: 'all .15s',
                      background: check.ok === false ? T.danger : T.white,
                      borderColor: check.ok === false ? T.danger : T.border,
                      color: check.ok === false ? T.white : T.textMid,
                    }}
                    title="No cumple"
                  >
                    ✗
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Result preview */}
        {answeredChecks.length > 0 && (
          <div style={{
            background: resultado === 'no_cumple' ? '#FFEBEE' : '#E8F5E9',
            border: `1px solid ${resultado === 'no_cumple' ? '#FFCDD2' : '#C8E6C9'}`,
            borderRadius: 8, padding: '10px 16px', marginBottom: 20,
            fontSize: '.83rem', fontWeight: 600,
            color: resultado === 'no_cumple' ? T.danger : T.secondary,
          }}>
            {resultado === 'no_cumple'
              ? `✗ No cumple — ${pct}% (mínimo 80% requerido)`
              : `✓ Cumple — ${pct}% de verificaciones aprobadas`}
          </div>
        )}

        <Lbl text="Observaciones">
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Observaciones, condiciones especiales, acciones correctivas..."
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
          {saving ? 'Guardando...' : 'Guardar Registro DT'}
        </button>
      </Card>

      {/* History */}
      <Card>
        <SectionTitle>Historial ({(registros || []).length} registros)</SectionTitle>

        {histLoading ? (
          <Skeleton height={200} />
        ) : (registros || []).length === 0 ? (
          <p style={{ textAlign: 'center', padding: 32, color: T.textMid, fontSize: '.85rem' }}>Sin registros aún.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Fecha', 'Conductor', 'Placa', 'Cliente', 'Temp', 'FEL', '%', 'Estado', 'Resultado'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', color: T.white,
                      fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(registros || []).slice(0, 100).map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? T.white : '#F9FBF9' }}>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.fecha}</td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', whiteSpace: 'nowrap' }}>{r.conductor || '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>
                      <span style={{ background: T.bgLight, border: `1px solid ${T.border}`, borderRadius: 4, padding: '2px 8px', fontSize: '.78rem', fontWeight: 600 }}>
                        {r.placa || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cliente || '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', whiteSpace: 'nowrap', color: r.temperatura != null ? (r.temperatura <= 4 ? T.accent : T.danger) : T.textMid, fontWeight: r.temperatura != null ? 600 : 400 }}>
                      {r.temperatura != null ? `${r.temperatura}°C` : '—'}
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>{r.numFel || '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', fontWeight: 700, color: (r.pct || 0) >= 80 ? T.accent : T.danger, whiteSpace: 'nowrap' }}>
                      {r.pct != null ? `${r.pct}%` : '—'}
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>
                      <EstadoUpdater record={r} onUpdate={handleEstadoUpdate} />
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0' }}>
                      <Badge type={r.resultado || 'no_cumple'} />
                    </td>
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
