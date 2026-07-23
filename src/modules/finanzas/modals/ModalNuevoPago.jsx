import { useState } from 'react';
import { useWrite } from '../../../hooks/useFirestore';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../components/Toast';

const T = {
  paper: '#FFFFFF', ink: '#1A1A18', forest: '#1F3A2C', canopy: '#2D6645',
  ochre: '#A8835A', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)',
};

const SUBCATS = {
  importacion: ['Pago productor', 'Flete MX', 'Gastos frontera MX', 'Laboratorio', 'Flete GT', 'Impuestos importación GT', 'Aduana GT', 'Transporte directo'],
  proveedor_local: ['Producto', 'Transporte'],
  servicios: ['Luz', 'Agua', 'Internet', 'Teléfono', 'Otro'],
  rentas: ['Bodega', 'Oficina', 'Otro'],
  sueldos: ['Planilla quincenal', 'Anticipo', 'Bono', 'Aguinaldo', 'Bono 14'],
  impuestos: ['IVA', 'ISR', 'IUSI', 'Otro'],
  otros: ['—'],
};

export default function ModalNuevoPago({ onClose }) {
  const { user, getFinanzasPerms } = useAuth();
  const perms = getFinanzasPerms();
  const { add, saving } = useWrite('movimientos_finanzas');
  const toast = useToast();

  const [f, setF] = useState({
    categoria: '',
    subcategoria: '',
    concepto: '',
    monto: '',
    moneda: 'GTQ',
    fecha: new Date().toISOString().slice(0, 10),
    forma_pago: 'Transferencia',
    proveedor: '',
    estado: 'pagado',
    fecha_vencimiento: '',
    notas: '',
  });

  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!f.categoria) return toast('Elegí una categoría', 'error');
    if (!f.concepto.trim()) return toast('Ingresá el concepto', 'error');
    const m = parseFloat(f.monto);
    if (!Number.isFinite(m) || m <= 0) return toast('Monto inválido', 'error');
    try {
      await add({
        tipo: 'pago',
        categoria: f.categoria,
        subcategoria: f.subcategoria || null,
        concepto: f.concepto.trim(),
        monto: m,
        moneda: f.moneda,
        fecha: f.fecha,
        forma_pago: f.forma_pago,
        proveedor: f.proveedor.trim() || null,
        estado: f.estado,
        fecha_vencimiento: f.estado === 'pendiente' ? (f.fecha_vencimiento || null) : null,
        notas: f.notas.trim() || null,
        creadoEn: new Date().toISOString(),
        creadoPor: user?.usuario || 'unknown',
      });
      toast('✓ Pago registrado');
      onClose();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  const categoriasVisibles = Object.keys(SUBCATS).filter(k => !(k === 'sueldos' && !perms.cargar_sueldos));

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={modalBg}>
      <div style={modalBox}>
        <div style={modalHdr}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.1rem', fontWeight: 600 }}>+ Nuevo pago</h2>
          <button onClick={onClose} style={btnClose}>×</button>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <Row>
            <Field label="Categoría">
              <select value={f.categoria} onChange={e => { upd('categoria', e.target.value); upd('subcategoria', ''); }} style={inp}>
                <option value="">— elegir —</option>
                {categoriasVisibles.map(c => (
                  <option key={c} value={c}>
                    {{ importacion: '📦 Importación MX', proveedor_local: '🌱 Proveedores locales', servicios: '💡 Servicios', rentas: '🏠 Rentas', sueldos: '👥 Sueldos', impuestos: '🧾 Impuestos', otros: '📎 Otros' }[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sub-categoría">
              <select value={f.subcategoria} onChange={e => upd('subcategoria', e.target.value)} style={inp} disabled={!f.categoria}>
                <option value="">— elegir —</option>
                {(SUBCATS[f.categoria] || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </Row>

          <Field label="Concepto">
            <input type="text" value={f.concepto} onChange={e => upd('concepto', e.target.value)} placeholder="ej: Zanahoria 16 pallets" style={inp} />
          </Field>

          <Row>
            <Field label="Monto">
              <input type="number" step="0.01" value={f.monto} onChange={e => upd('monto', e.target.value)} placeholder="0.00" style={inp} />
            </Field>
            <Field label="Moneda">
              <select value={f.moneda} onChange={e => upd('moneda', e.target.value)} style={inp}>
                <option>GTQ</option><option>MXN</option><option>USD</option>
              </select>
            </Field>
          </Row>

          <Row>
            <Field label="Fecha">
              <input type="date" value={f.fecha} onChange={e => upd('fecha', e.target.value)} style={inp} />
            </Field>
            <Field label="Forma de pago">
              <select value={f.forma_pago} onChange={e => upd('forma_pago', e.target.value)} style={inp}>
                <option>Transferencia</option><option>Efectivo</option>
              </select>
            </Field>
          </Row>

          <Field label="Proveedor / beneficiario (opcional)">
            <input type="text" value={f.proveedor} onChange={e => upd('proveedor', e.target.value)} placeholder="opcional" style={inp} />
          </Field>

          <Row>
            <Field label="Estado">
              <select value={f.estado} onChange={e => upd('estado', e.target.value)} style={inp}>
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </Field>
            {f.estado === 'pendiente' && (
              <Field label="Fecha vencimiento">
                <input type="date" value={f.fecha_vencimiento} onChange={e => upd('fecha_vencimiento', e.target.value)} style={inp} />
              </Field>
            )}
          </Row>

          <Field label="Notas">
            <textarea value={f.notas} onChange={e => upd('notas', e.target.value)} rows={2} placeholder="opcional" style={inp} />
          </Field>
        </div>
        <div style={modalFoot}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>{saving ? 'Guardando…' : 'Guardar pago'}</button>
        </div>
      </div>
    </div>
  );
}

function Row({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>; }
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: '.66rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.muted, marginBottom: 3 }}>{label}</label>
      {children}
    </div>
  );
}
const modalBg = { position: 'fixed', inset: 0, background: 'rgba(26,26,24,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 };
const modalBox = { background: T.paper, borderRadius: 4, maxWidth: 620, width: '100%', maxHeight: '92vh', overflowY: 'auto' };
const modalHdr = { padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.forest, color: 'white', borderRadius: '4px 4px 0 0' };
const modalFoot = { padding: '14px 22px', borderTop: `1px solid ${T.rule}`, display: 'flex', gap: 8, justifyContent: 'flex-end' };
const btnClose = { background: 'none', border: 'none', color: 'white', fontSize: '1.4rem', cursor: 'pointer', opacity: 0.7 };
const btnPrimary = { padding: '9px 16px', borderRadius: 3, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', border: `1.5px solid ${T.forest}`, background: T.forest, color: 'white' };
const btnGhost = { padding: '9px 16px', borderRadius: 3, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', border: `1.5px solid ${T.forest}`, background: 'white', color: T.forest };
const inp = { width: '100%', padding: '8px 10px', border: `1.5px solid ${T.rule}`, borderRadius: 3, fontSize: '.88rem', background: 'white', boxSizing: 'border-box', fontFamily: 'inherit' };
