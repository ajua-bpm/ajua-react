// MovimientoClienteForm.jsx — Modal CxC: despacho / pago / nota crédito

import { useState, useRef } from 'react';
import { useProductosCatalogo } from '../../hooks/useMainData';

const T = {
  primary: '#1B5E20', danger: '#C62828', warn: '#E65100', info: '#1565C0',
  border: '#E0E0E0', textMid: '#6B6B60', textDark: '#1A1A18', bg: '#F9F9F7',
};

const TIPOS = [
  { key: 'despacho',    icon: '🚛', label: 'Despacho',    color: '#1565C0', bg: '#E3F2FD' },
  { key: 'pago',        icon: '💰', label: 'Pago',         color: '#2E7D32', bg: '#E8F5E9' },
  { key: 'nota_credito',icon: '⚠️', label: 'Nota Crédito', color: '#C62828', bg: '#FFEBEE' },
];

const UNIDADES   = ['lb', 'quintal', 'caja', 'bulto', 'kg', 'unidad', 'lote', 'arroba'];
const BLANK_PROD = { producto: '', cantidad: '', unidad: 'lb', precioUnit: '' };

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

export default function MovimientoClienteForm({ clienteNombre, movimientos = [], initialData = null, onConfirm, onCancel }) {
  const isEdit = !!initialData;
  const { productos: catProductos } = useProductosCatalogo();
  const today = new Date().toISOString().slice(0, 10);

  const [tipo,        setTipo]        = useState(initialData?.tipo        || 'despacho');
  const [fecha,       setFecha]       = useState(initialData?.fecha       || today);
  const [descripcion, setDescripcion] = useState(initialData?.descripcion || '');
  const [notas,       setNotas]       = useState(initialData?.notas       || '');
  const [motivoEdit,  setMotivoEdit]  = useState('');

  // Despacho
  const [productos,   setProductos]   = useState(
    initialData?.productos?.length ? initialData.productos : [{ ...BLANK_PROD }]
  );
  const [formaPago,   setFormaPago]   = useState(initialData?.formaPago   || 'efectivo');
  const [diasCredito, setDiasCredito] = useState(initialData?.diasCredito != null ? String(initialData.diasCredito) : '');
  const [numFactura,  setNumFactura]  = useState(initialData?.numFactura  || '');

  // Pago
  const [monto,       setMonto]       = useState(initialData?.monto != null ? String(initialData.monto) : '');
  const [metodoPago,  setMetodoPago]  = useState(initialData?.metodoPago  || 'transferencia');
  const [referencia,  setReferencia]  = useState(initialData?.referencia  || '');

  // Nota crédito
  const [valor,       setValor]       = useState(initialData?.valor != null ? String(initialData.valor) : '');
  const [motivo,      setMotivo]      = useState(initialData?.motivo      || '');
  const [despachoId,  setDespachoId]  = useState(initialData?.despachoId  || '');

  // Foto
  const [fotoFile,    setFotoFile]    = useState(null);
  const [fotoPreview, setFotoPreview] = useState(initialData?.fotoUrl || null);
  const fotoRef = useRef(null);

  // Cálculo total despacho
  const totalVenta = productos.reduce((s, p) => s + (Number(p.cantidad) || 0) * (Number(p.precioUnit) || 0), 0);

  const setProd = (i, field, val) => setProductos(ps => ps.map((p, j) => j === i ? { ...p, [field]: val } : p));
  const addProd   = () => setProductos(ps => [...ps, { ...BLANK_PROD }]);
  const removeProd = i => setProductos(ps => ps.filter((_, j) => j !== i));

  const handleFoto = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setFotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };
  const quitarFoto = () => { setFotoFile(null); setFotoPreview(null); if (fotoRef.current) fotoRef.current.value = ''; };

  const despachos = movimientos.filter(m => m.tipo === 'despacho');

  const canConfirm = (() => {
    if (!fecha) return false;
    if (isEdit && !motivoEdit.trim()) return false;
    if (tipo === 'despacho')     return totalVenta > 0;
    if (tipo === 'pago')         return Number(monto) > 0;
    if (tipo === 'nota_credito') return Number(valor) > 0;
    return false;
  })();

  const handleConfirm = () => {
    if (!canConfirm) return;
    const base = { tipo, fecha, descripcion: descripcion.trim(), notas: notas.trim(), motivoEdit: motivoEdit.trim(), _fotoFile: fotoFile };

    if (tipo === 'despacho') {
      onConfirm({ ...base, productos, totalVenta, formaPago, diasCredito: Number(diasCredito) || 0, numFactura: numFactura.trim() });
    } else if (tipo === 'pago') {
      onConfirm({ ...base, monto: Number(monto), metodoPago, referencia: referencia.trim() });
    } else if (tipo === 'nota_credito') {
      onConfirm({ ...base, valor: Number(valor), motivo: motivo.trim(), despachoId: despachoId || null });
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 2000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '16px', overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520,
        boxShadow: '0 8px 32px rgba(0,0,0,.25)', overflow: 'hidden', margin: 'auto' }}>

        <div style={{ background: isEdit ? T.warn : T.info, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.3rem' }}>{isEdit ? '✏️' : '📒'}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>
              {isEdit ? 'Editar Movimiento' : 'Nuevo Movimiento'}
            </div>
            <div style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.7)', marginTop: 1 }}>{clienteNombre}</div>
          </div>
        </div>

        <div style={{ padding: '20px' }}>

          {/* Tipo */}
          <Field label="Tipo de movimiento">
            <div style={{ display: 'flex', gap: 8 }}>
              {TIPOS.map(t => {
                const active = tipo === t.key;
                return (
                  <button key={t.key} onClick={() => !isEdit && setTipo(t.key)} style={{
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

          {/* ── DESPACHO ── */}
          {tipo === 'despacho' && (<>
            <Field label="Productos">
              {productos.map((p, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr auto', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  <input
                    type="text" list={`prod-list-${i}`} placeholder="Producto..."
                    value={p.producto} onChange={e => setProd(i, 'producto', e.target.value)}
                    style={{ padding: '8px 10px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.83rem', fontFamily: 'inherit', outline: 'none' }}
                  />
                  <datalist id={`prod-list-${i}`}>
                    {catProductos.map(cp => <option key={cp.id} value={cp.nombre} />)}
                  </datalist>
                  <input type="number" min="0" placeholder="Cant." value={p.cantidad}
                    onChange={e => setProd(i, 'cantidad', e.target.value)}
                    style={{ padding: '8px 8px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.83rem', fontFamily: 'inherit', outline: 'none' }} />
                  <select value={p.unidad} onChange={e => setProd(i, 'unidad', e.target.value)}
                    style={{ padding: '8px 4px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.8rem', fontFamily: 'inherit', outline: 'none' }}>
                    {UNIDADES.map(u => <option key={u}>{u}</option>)}
                  </select>
                  <input type="number" min="0" step="0.01" placeholder="Q precio"
                    value={p.precioUnit} onChange={e => setProd(i, 'precioUnit', e.target.value)}
                    style={{ padding: '8px 8px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.83rem', fontFamily: 'inherit', outline: 'none' }} />
                  {productos.length > 1 && (
                    <button onClick={() => removeProd(i)} style={{ background: 'none', border: 'none', color: T.danger, fontSize: '1rem', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                  )}
                </div>
              ))}
              <button onClick={addProd} style={{ padding: '6px 14px', border: `1px dashed ${T.border}`, borderRadius: 6, background: '#fff', color: T.textMid, fontSize: '.8rem', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
                + Producto
              </button>
            </Field>
            <div style={{ background: '#E8F5E9', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '.82rem', fontWeight: 700, color: T.primary }}>Total Despacho</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: T.primary }}>{fmtQ(totalVenta)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Forma de pago">
                <select value={formaPago} onChange={e => setFormaPago(e.target.value)}
                  style={{ width: '100%', padding: '9px 8px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.88rem', fontFamily: 'inherit', background: '#fff', outline: 'none' }}>
                  {['efectivo','transferencia','cheque','credito'].map(f => <option key={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Días crédito (si aplica)">
                <Input type="number" min="0" placeholder="0" value={diasCredito} onChange={e => setDiasCredito(e.target.value)} />
              </Field>
            </div>
            <Field label="No. Factura / Referencia">
              <Input type="text" placeholder="F-001" value={numFactura} onChange={e => setNumFactura(e.target.value)} />
            </Field>
          </>)}

          {/* ── PAGO ── */}
          {tipo === 'pago' && (<>
            <Field label="Monto cobrado (Q)">
              <Input type="number" min="0" step="0.01" placeholder="0.00"
                value={monto} onChange={e => setMonto(e.target.value)}
                style={{ fontSize: '1.1rem', fontWeight: 700 }} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Método">
                <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
                  style={{ width: '100%', padding: '9px 8px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.88rem', fontFamily: 'inherit', background: '#fff', outline: 'none' }}>
                  {['transferencia','cheque','efectivo','débito'].map(m => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="No. Referencia">
                <Input type="text" placeholder="TRF-001" value={referencia} onChange={e => setReferencia(e.target.value)} />
              </Field>
            </div>
          </>)}

          {/* ── NOTA CRÉDITO ── */}
          {tipo === 'nota_credito' && (<>
            {despachos.length > 0 && (
              <Field label="Despacho relacionado (opcional)">
                <select value={despachoId} onChange={e => setDespachoId(e.target.value)}
                  style={{ width: '100%', padding: '9px 8px', border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: '.85rem', fontFamily: 'inherit', background: '#fff', outline: 'none' }}>
                  <option value="">— Sin vincular —</option>
                  {despachos.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.fecha} · {fmtQ(d.totalVenta)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Valor nota crédito / descuento (Q)">
              <Input type="number" min="0" step="0.01" placeholder="0.00"
                value={valor} onChange={e => setValor(e.target.value)}
                style={{ fontSize: '1.1rem', fontWeight: 700, color: T.danger }} />
            </Field>
            <Field label="Motivo">
              <Input type="text" placeholder="Ej: producto dañado, error precio..." value={motivo} onChange={e => setMotivo(e.target.value)} />
            </Field>
          </>)}

          {/* Foto (despacho y nota crédito) */}
          {(tipo === 'despacho' || tipo === 'nota_credito') && (
            <Field label={tipo === 'despacho' ? '📷 Foto de entrega (opcional)' : '📷 Foto de evidencia (opcional)'}>
              {fotoPreview ? (
                <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                  <img src={fotoPreview} alt="Foto"
                    style={{ width: '100%', maxHeight: 200, objectFit: 'cover',
                      borderRadius: 8, border: `1.5px solid ${T.border}`, display: 'block' }} />
                  <button type="button" onClick={quitarFoto} style={{
                    position: 'absolute', top: 6, right: 6,
                    background: 'rgba(0,0,0,.55)', color: '#fff', border: 'none',
                    borderRadius: '50%', width: 26, height: 26, cursor: 'pointer',
                    fontWeight: 700, fontSize: '.8rem', lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✕</button>
                </div>
              ) : (
                <div onClick={() => fotoRef.current?.click()}
                  style={{ border: `2px dashed ${T.border}`, borderRadius: 8,
                    padding: '24px 16px', textAlign: 'center',
                    cursor: 'pointer', color: T.textMid, fontSize: '.85rem', background: '#FAFAFA' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 4 }}>📷</div>
                  <div style={{ fontWeight: 600 }}>Toca para adjuntar foto</div>
                  <div style={{ fontSize: '.75rem', marginTop: 2 }}>Entrega / evidencia · JPG, PNG</div>
                </div>
              )}
              <input ref={fotoRef} type="file" accept="image/*" capture="environment"
                onChange={handleFoto} style={{ display: 'none' }} />
            </Field>
          )}

          {/* Descripción / notas */}
          <Field label="Descripción">
            <Input type="text" placeholder="Descripción breve..." value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </Field>
          <Field label="Notas internas (opcional)">
            <textarea rows={2} placeholder="Observaciones, acuerdos..."
              value={notas} onChange={e => setNotas(e.target.value)}
              style={{ width: '100%', padding: '9px 11px', border: `1.5px solid ${T.border}`,
                borderRadius: 6, fontSize: '.85rem', fontFamily: 'inherit', outline: 'none',
                resize: 'vertical', boxSizing: 'border-box', color: T.textDark }} />
          </Field>

          {/* Motivo edición */}
          {isEdit && (
            <Field label="Motivo de la edición *">
              <Input type="text" placeholder="Ej: Error en el monto, corrección de fecha..."
                value={motivoEdit} onChange={e => setMotivoEdit(e.target.value)}
                style={{ border: `1.5px solid ${motivoEdit.trim() ? T.border : T.warn}` }} />
              {!motivoEdit.trim() && (
                <div style={{ fontSize: '.72rem', color: T.warn, marginTop: 3 }}>Requerido para guardar cambios</div>
              )}
            </Field>
          )}

          {/* Botones */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={handleConfirm} disabled={!canConfirm} style={{
              flex: 1, minHeight: 44, borderRadius: 8, border: 'none',
              background: canConfirm ? (isEdit ? T.warn : T.info) : '#BDBDBD',
              color: '#fff', fontWeight: 700, fontSize: '.9rem',
              cursor: canConfirm ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}>
              {isEdit ? 'Guardar cambios' : 'Guardar movimiento'}
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
