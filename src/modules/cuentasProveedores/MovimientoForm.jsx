// MovimientoForm.jsx — Modal para registrar recepción / pago / rechazo en cuenta proveedor

import { useState } from 'react';

const T = {
  primary: '#1B5E20', danger: '#C62828', warn: '#E65100',
  border: '#E0E0E0', textMid: '#6B6B60', textDark: '#1A1A18',
  bg: '#F9F9F7',
};

const TIPOS = [
  { key: 'recepcion', icon: '📥', label: 'Recepción',   color: '#1565C0', bg: '#E3F2FD' },
  { key: 'pago',      icon: '💰', label: 'Pago',         color: '#2E7D32', bg: '#E8F5E9' },
  { key: 'rechazo',   icon: '⚠️', label: 'Rechazo',     color: '#C62828', bg: '#FFEBEE' },
];

const fmtQ = n => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.08em', color: T.textMid, display: 'block', marginBottom: 4 }}>
      {label}
    </label>
    {children}
  </div>
);

const Input = ({ style, ...props }) => (
  <input {...props} style={{
    width: '100%', padding: '9px 11px', border: `1.5px solid ${T.border}`,
    borderRadius: 6, fontSize: '.88rem', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', color: T.textDark, background: '#fff', ...style,
  }} />
);

const Textarea = ({ style, ...props }) => (
  <textarea {...props} style={{
    width: '100%', padding: '9px 11px', border: `1.5px solid ${T.border}`,
    borderRadius: 6, fontSize: '.85rem', fontFamily: 'inherit', outline: 'none',
    resize: 'vertical', boxSizing: 'border-box', color: T.textDark, ...style,
  }} />
);

export default function MovimientoForm({ proveedorNombre, movimientos = [], onConfirm, onCancel }) {
  const today = new Date().toISOString().slice(0, 10);

  const [tipo,        setTipo]        = useState('recepcion');
  const [fecha,       setFecha]       = useState(today);
  const [descripcion, setDescripcion] = useState('');
  const [notas,       setNotas]       = useState('');

  // Recepción
  const [producto,    setProducto]    = useState('');
  const [cantidad,    setCantidad]    = useState('');
  const [unidad,      setUnidad]      = useState('lb');
  const [precioUnit,  setPrecioUnit]  = useState('');
  const [totalBruto,  setTotalBruto]  = useState('');
  const [factura,     setFactura]     = useState('');

  // Pago
  const [monto,       setMonto]       = useState('');
  const [metodoPago,  setMetodoPago]  = useState('transferencia');
  const [referencia,  setReferencia]  = useState('');

  // Rechazo
  const [recepcionId, setRecepcionId] = useState('');
  const [valorRechazo,setValorRechazo]= useState('');
  const [resolucion,  setResolucion]  = useState('devolucion');

  // Auto-calcular totalBruto en recepción
  const calcTotal = (cant, precio) => {
    const t = (Number(cant) || 0) * (Number(precio) || 0);
    setTotalBruto(t > 0 ? t.toFixed(2) : '');
  };

  const recepciones = movimientos.filter(m => m.tipo === 'recepcion');

  const canConfirm = (() => {
    if (!fecha) return false;
    if (tipo === 'recepcion') return producto.trim() && (Number(totalBruto) > 0 || Number(cantidad) > 0);
    if (tipo === 'pago')      return Number(monto) > 0;
    if (tipo === 'rechazo')   return Number(valorRechazo) > 0;
    return false;
  })();

  const handleConfirm = () => {
    if (!canConfirm) return;
    const base = { tipo, fecha, descripcion: descripcion.trim(), notas: notas.trim() };

    if (tipo === 'recepcion') {
      onConfirm({
        ...base,
        producto: producto.trim(),
        cantidad: Number(cantidad) || 0,
        unidad,
        precioUnit: Number(precioUnit) || 0,
        totalBruto: Number(totalBruto) || 0,
        factura: factura.trim(),
      });
    } else if (tipo === 'pago') {
      onConfirm({
        ...base,
        monto: Number(monto),
        metodoPago,
        referencia: referencia.trim(),
      });
    } else if (tipo === 'rechazo') {
      onConfirm({
        ...base,
        recepcionId: recepcionId || null,
        valorRechazo: Number(valorRechazo),
        resolucion,
      });
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 2000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '16px', overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480,
        boxShadow: '0 8px 32px rgba(0,0,0,.25)', overflow: 'hidden', margin: 'auto' }}>

        {/* Header */}
        <div style={{ background: T.primary, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.3rem' }}>📒</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>Nuevo Movimiento</div>
            <div style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.7)', marginTop: 1 }}>{proveedorNombre}</div>
          </div>
        </div>

        <div style={{ padding: '20px' }}>

          {/* Selector tipo */}
          <Field label="Tipo de movimiento">
            <div style={{ display: 'flex', gap: 8 }}>
              {TIPOS.map(t => {
                const active = tipo === t.key;
                return (
                  <button key={t.key} onClick={() => setTipo(t.key)} style={{
                    flex: 1, padding: '9px 4px', borderRadius: 8,
                    border: `2px solid ${active ? t.color : T.border}`,
                    background: active ? t.bg : '#fff',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                    transition: 'all .12s',
                  }}>
                    <div style={{ fontSize: '1.1rem' }}>{t.icon}</div>
                    <div style={{ fontSize: '.72rem', fontWeight: active ? 700 : 500,
                      color: active ? t.color : T.textMid, marginTop: 2 }}>{t.label}</div>
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Fecha */}
          <Field label="Fecha">
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </Field>

          {/* ── RECEPCIÓN ── */}
          {tipo === 'recepcion' && (<>
            <Field label="Producto">
              <Input
                type="text" placeholder="Ej. Brócoli premium"
                value={producto} onChange={e => setProducto(e.target.value)}
              />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
              <Field label="Cantidad">
                <Input
                  type="number" min="0" placeholder="0"
                  value={cantidad}
                  onChange={e => { setCantidad(e.target.value); calcTotal(e.target.value, precioUnit); }}
                />
              </Field>
              <Field label="Unidad">
                <select value={unidad} onChange={e => setUnidad(e.target.value)} style={{
                  width: '100%', padding: '9px 8px', border: `1.5px solid ${T.border}`,
                  borderRadius: 6, fontSize: '.88rem', fontFamily: 'inherit',
                  background: '#fff', color: T.textDark, outline: 'none',
                }}>
                  {['lb','kg','qq','caja','bulto','unidad'].map(u => <option key={u}>{u}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Precio unitario (Q)">
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={precioUnit}
                  onChange={e => { setPrecioUnit(e.target.value); calcTotal(cantidad, e.target.value); }}
                />
              </Field>
              <Field label="Total bruto (Q)">
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={totalBruto} onChange={e => setTotalBruto(e.target.value)}
                  style={{ fontWeight: 700 }}
                />
              </Field>
            </div>
            <Field label="No. Factura / Referencia">
              <Input type="text" placeholder="F-001" value={factura} onChange={e => setFactura(e.target.value)} />
            </Field>
          </>)}

          {/* ── PAGO ── */}
          {tipo === 'pago' && (<>
            <Field label="Monto (Q)">
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={monto} onChange={e => setMonto(e.target.value)}
                style={{ fontSize: '1.1rem', fontWeight: 700 }}
              />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Método">
                <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={{
                  width: '100%', padding: '9px 8px', border: `1.5px solid ${T.border}`,
                  borderRadius: 6, fontSize: '.88rem', fontFamily: 'inherit',
                  background: '#fff', color: T.textDark, outline: 'none',
                }}>
                  {['transferencia','cheque','efectivo','débito'].map(m => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="No. Referencia">
                <Input type="text" placeholder="TRF-001" value={referencia} onChange={e => setReferencia(e.target.value)} />
              </Field>
            </div>
          </>)}

          {/* ── RECHAZO ── */}
          {tipo === 'rechazo' && (<>
            {recepciones.length > 0 && (
              <Field label="Recepción relacionada (opcional)">
                <select value={recepcionId} onChange={e => setRecepcionId(e.target.value)} style={{
                  width: '100%', padding: '9px 8px', border: `1.5px solid ${T.border}`,
                  borderRadius: 6, fontSize: '.85rem', fontFamily: 'inherit',
                  background: '#fff', color: T.textDark, outline: 'none',
                }}>
                  <option value="">— Sin vincular —</option>
                  {recepciones.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.fecha} · {r.producto} · {fmtQ(r.totalBruto)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Valor del rechazo (Q)">
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={valorRechazo} onChange={e => setValorRechazo(e.target.value)}
                style={{ fontSize: '1.1rem', fontWeight: 700, color: T.danger }}
              />
            </Field>
            <Field label="Resolución">
              <select value={resolucion} onChange={e => setResolucion(e.target.value)} style={{
                width: '100%', padding: '9px 8px', border: `1.5px solid ${T.border}`,
                borderRadius: 6, fontSize: '.88rem', fontFamily: 'inherit',
                background: '#fff', color: T.textDark, outline: 'none',
              }}>
                <option value="devolucion">Devolución física</option>
                <option value="descuento">Descuento en factura</option>
                <option value="nota_credito">Nota de crédito futura</option>
                <option value="negociacion_pendiente">Negociación pendiente</option>
              </select>
            </Field>
          </>)}

          {/* Descripción / notas */}
          <Field label="Descripción">
            <Input
              type="text" placeholder="Descripción breve..."
              value={descripcion} onChange={e => setDescripcion(e.target.value)}
            />
          </Field>
          <Field label="Notas internas (opcional)">
            <Textarea
              rows={2} placeholder="Observaciones, acuerdos..."
              value={notas} onChange={e => setNotas(e.target.value)}
            />
          </Field>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              style={{
                flex: 1, minHeight: 44, borderRadius: 8, border: 'none',
                background: canConfirm ? T.primary : '#BDBDBD',
                color: '#fff', fontWeight: 700, fontSize: '.9rem',
                cursor: canConfirm ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
              }}>
              Guardar movimiento
            </button>
            <button onClick={onCancel} style={{
              minHeight: 44, padding: '0 16px', borderRadius: 8,
              border: `1.5px solid ${T.border}`, background: '#fff',
              color: T.textMid, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
