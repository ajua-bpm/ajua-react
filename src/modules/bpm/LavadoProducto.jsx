import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  primary:   '#1B5E20',
  secondary: '#2E7D32',
  white:     '#FFFFFF',
  border:    '#E0E0E0',
  textDark:  '#212121',
  textMid:   '#616161',
  danger:    '#C62828',
  warn:      '#E65100',
  rowAlt:    '#F9FBF9',
};
const card = {
  background: '#fff', borderRadius: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 20, marginBottom: 20,
};

// ─── Shared input styles ──────────────────────────────────────────────────────
const LBL = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '.06em', color: T.textMid,
};
const INP = {
  padding: '9px 12px', border: `1px solid ${T.border}`, borderRadius: 6,
  fontSize: '.83rem', outline: 'none', fontFamily: 'inherit',
  width: '100%', marginTop: 2, background: '#fff', color: T.textDark,
  transition: 'border-color .15s',
};

const today = () => new Date().toISOString().slice(0, 10);

const CHECK_LABELS = [
  '¿Lavado con agua potable?',
  '¿Desinfectado correctamente?',
  '¿Secado adecuado?',
  '¿Aprobado para proceso?',
];

const INIT = () => ({
  fecha: today(), hora: '', producto: '', lote: '', responsable: '',
  temperaturaAgua: '', tiempoLavado: '',
  checks: CHECK_LABELS.map(texto => ({ texto, ok: null })),
  resultado: '', obs: '',
});

export default function LavadoProducto() {
  const toast = useToast();
  const { data, loading } = useCollection('lavadoProd', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { data: productos, loading: prodLoading } = useCollection('iProductos', { orderField: 'nombre', limit: 200 });
  const { empleados, loading: empLoading } = useEmpleados();
  const { add, saving } = useWrite('lavadoProd');

  const [form, setForm] = useState(INIT());

  const setCheck = (i, ok) => {
    setForm(f => {
      const checks = f.checks.map((c, idx) => idx === i ? { ...c, ok } : c);
      const allAnswered = checks.every(c => c.ok !== null);
      const resultado = allAnswered
        ? checks.every(c => c.ok === true) ? 'aprobado' : 'rechazado'
        : '';
      return { ...f, checks, resultado };
    });
  };

  const handleSave = async () => {
    if (!form.fecha || !form.producto || !form.responsable) {
      toast('Fecha, producto y responsable son requeridos', 'error'); return;
    }
    await add({ ...form });
    toast('Registro de lavado guardado');
    setForm(INIT());
  };

  if (loading || prodLoading || empLoading) {
    return (
      <div>
        <div style={{ height: 28, background: '#E8F5E9', borderRadius: 6, width: 260, marginBottom: 8 }} />
        <div style={card}><Skeleton rows={6} /></div>
      </div>
    );
  }

  const hasProd = productos && productos.length > 0;
  const resultadoColor = form.resultado === 'aprobado' ? T.secondary : form.resultado === 'rechazado' ? T.danger : T.textMid;

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: T.primary, margin: 0 }}>
          Lavado y Desinfección de Producto
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, margin: '4px 0 0' }}>
          Control del proceso de lavado — BPM Vegetal
        </p>
      </div>

      {/* ── Form ── */}
      <div style={card}>
        <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
          Nuevo Registro
        </div>

        {/* Row 1: fecha, hora, lote */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 12, marginBottom: 12 }}>
          <label style={LBL}>
            Fecha *
            <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} style={INP} />
          </label>
          <label style={LBL}>
            Hora
            <input type="time" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} style={INP} />
          </label>
          <label style={LBL}>
            Lote
            <input value={form.lote} onChange={e => setForm(f => ({ ...f, lote: e.target.value }))} placeholder="Ej: LOT-001" style={INP} />
          </label>
          <label style={LBL}>
            Temp. Agua (°C)
            <input type="number" step="0.1" value={form.temperaturaAgua} onChange={e => setForm(f => ({ ...f, temperaturaAgua: e.target.value }))} placeholder="18" style={INP} />
          </label>
          <label style={LBL}>
            Tiempo Lavado (min)
            <input type="number" min="1" value={form.tiempoLavado} onChange={e => setForm(f => ({ ...f, tiempoLavado: e.target.value }))} placeholder="5" style={INP} />
          </label>
        </div>

        {/* Row 2: producto, responsable */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <label style={LBL}>
            Producto *
            {hasProd ? (
              <select value={form.producto} onChange={e => setForm(f => ({ ...f, producto: e.target.value }))} style={INP}>
                <option value="">— Seleccionar —</option>
                {productos.map(p => <option key={p.id} value={p.nombre || p.id}>{p.nombre || p.id}</option>)}
              </select>
            ) : (
              <input value={form.producto} onChange={e => setForm(f => ({ ...f, producto: e.target.value }))} placeholder="Nombre del producto" style={INP} />
            )}
          </label>
          <label style={LBL}>
            Responsable *
            <select value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} style={INP}>
              <option value="">— Seleccionar —</option>
              {empleados.map(e => <option key={e.nombre} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </label>
        </div>

        {/* Checklist */}
        <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
          Lista de Verificación
        </div>
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
          {CHECK_LABELS.map((label, i) => {
            const ok = form.checks[i].ok;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px',
                background: i % 2 === 1 ? T.rowAlt : '#fff',
                borderBottom: i < CHECK_LABELS.length - 1 ? `1px solid ${T.border}` : 'none',
              }}>
                <span style={{ flex: 1, fontSize: '.83rem', color: T.textDark }}>{label}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ v: true, label: '✓ Sí' }, { v: false, label: '✗ No' }].map(({ v, label: bl }) => (
                    <button key={String(v)} onClick={() => setCheck(i, v)} style={{
                      padding: '5px 14px', borderRadius: 5, fontSize: '.75rem', fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                      border: `1.5px solid ${ok === v ? (v ? T.secondary : T.danger) : T.border}`,
                      background: ok === v ? (v ? T.secondary : T.danger) : '#fff',
                      color: ok === v ? '#fff' : T.textMid,
                      transition: 'all .15s',
                    }}>{bl}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Resultado badge */}
        {form.resultado && (
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '.75rem', fontWeight: 600, color: T.textMid }}>Resultado automático:</span>
            <span style={{
              padding: '3px 12px', borderRadius: 100, fontSize: '.75rem', fontWeight: 700,
              background: form.resultado === 'aprobado' ? 'rgba(46,125,50,.12)' : 'rgba(198,40,40,.10)',
              color: resultadoColor,
            }}>
              {form.resultado === 'aprobado' ? '✓ Aprobado' : '✗ Rechazado'}
            </span>
          </div>
        )}

        {/* Observaciones */}
        <label style={{ ...LBL, marginBottom: 14 }}>
          Observaciones
          <textarea value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))}
            rows={2} placeholder="Observaciones adicionales..."
            style={{ ...INP, resize: 'vertical', lineHeight: 1.5 }} />
        </label>

        <button onClick={handleSave} disabled={saving} style={{
          padding: '11px 28px', background: saving ? T.border : T.primary,
          color: saving ? T.textMid : '#fff', border: 'none', borderRadius: 6,
          fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', letterSpacing: '.02em',
        }}>
          {saving ? 'Guardando...' : 'Guardar Registro'}
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
                {['Fecha', 'Producto', 'Lote', 'Responsable', 'Temp °C', 'Tiempo', 'Resultado'].map(h => (
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
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textDark }}>{r.producto || '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textMid }}>{r.lote || '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textDark }}>{r.responsable || '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textMid }}>{r.temperaturaAgua ? `${r.temperaturaAgua}°C` : '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: '.83rem', color: T.textMid }}>{r.tiempoLavado ? `${r.tiempoLavado} min` : '—'}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 100, fontSize: '.72rem', fontWeight: 700,
                      background: r.resultado === 'aprobado' ? 'rgba(46,125,50,.12)' : 'rgba(198,40,40,.10)',
                      color: r.resultado === 'aprobado' ? T.secondary : T.danger,
                    }}>
                      {r.resultado === 'aprobado' ? '✓ Aprobado' : r.resultado === 'rechazado' ? '✗ Rechazado' : r.resultado || '—'}
                    </span>
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
