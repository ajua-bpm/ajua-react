import { useState } from 'react';
import { useWrite } from '../../../hooks/useFirestore';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../components/Toast';

const T = {
  paper: '#FFFFFF', forest: '#1F3A2C', ochre: '#A8835A', muted: '#6B6B60',
  rule: 'rgba(26,26,24,.10)', warn: '#B26A00', err: '#B00020', ok: '#2E7D32',
};

const CATEGORIAS_OP = [
  { k: 'combustible', label: '⛽ Combustible' },
  { k: 'hielo', label: '🧊 Hielo' },
  { k: 'herramientas', label: '🔧 Herramientas' },
  { k: 'reparaciones', label: '🔨 Reparaciones' },
  { k: 'insumos', label: '📦 Insumos' },
  { k: 'transporte_local', label: '🚚 Transporte local' },
  { k: 'otros', label: '📎 Otros' },
];

export default function ModalNuevoGastoOp({ onClose, perms }) {
  const { user } = useAuth();
  const { add, saving } = useWrite('movimientos_finanzas');
  const toast = useToast();

  const [f, setF] = useState({
    categoria: '',
    concepto: '',
    monto: '',
    fecha: new Date().toISOString().slice(0, 10),
    forma_pago: 'Efectivo',
    proveedor: '',
    notas: '',
  });
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  const monto = parseFloat(f.monto) || 0;
  const tope = perms.tope_gastos_op || 0;
  const topeAprobacion = perms.aprobar_hasta || tope * 4;
  const excedeTope = monto > tope && monto <= topeAprobacion;
  const excedeAprobacion = monto > topeAprobacion;

  const guardar = async () => {
    if (!f.categoria) return toast('Elegí una categoría', 'error');
    if (!f.concepto.trim()) return toast('Ingresá el concepto', 'error');
    if (monto <= 0) return toast('Monto inválido', 'error');
    if (excedeAprobacion) return toast(`Monto excede tope máximo (Q ${topeAprobacion})`, 'error');

    try {
      await add({
        tipo: 'gasto_op',
        categoria: 'gasto_op',
        subcategoria: f.categoria,
        concepto: f.concepto.trim(),
        monto: monto,
        moneda: 'GTQ',
        fecha: f.fecha,
        forma_pago: f.forma_pago,
        proveedor: f.proveedor.trim() || null,
        estado: excedeTope ? 'pendiente_aprobacion' : 'pagado',
        notas: f.notas.trim() || null,
        creadoEn: new Date().toISOString(),
        creadoPor: user?.usuario || 'unknown',
      });
      toast(excedeTope ? '✓ Gasto enviado para aprobación' : '✓ Gasto registrado');
      onClose();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={modalBg}>
      <div style={modalBox}>
        <div style={{ ...modalHdr, background: T.ochre }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.1rem', fontWeight: 600 }}>+ Nuevo gasto operativo</h2>
          <button onClick={onClose} style={btnClose}>×</button>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ background: 'rgba(168,131,90,.08)', padding: '10px 12px', borderRadius: 3, marginBottom: 14, fontSize: '.78rem', color: T.muted }}>
            Tope directo: <b>Q {tope.toLocaleString('es-GT')}</b> · Aprobación hasta: <b>Q {topeAprobacion.toLocaleString('es-GT')}</b>
          </div>

          <Field label="Categoría">
            <select value={f.categoria} onChange={e => upd('categoria', e.target.value)} style={inp}>
              <option value="">— elegir —</option>
              {CATEGORIAS_OP.map(c => <option key={c.k} value={c.k}>{c.label}</option>)}
            </select>
          </Field>

          <Field label="Concepto">
            <input type="text" value={f.concepto} onChange={e => upd('concepto', e.target.value)} placeholder="ej: Gasolina camión 300" style={inp} />
          </Field>

          <Row>
            <Field label="Monto (GTQ)">
              <input type="number" step="0.01" value={f.monto} onChange={e => upd('monto', e.target.value)} placeholder="0.00" style={{
                ...inp,
                borderColor: excedeAprobacion ? T.err : excedeTope ? T.warn : T.rule,
              }} />
              {excedeTope && !excedeAprobacion && (
                <div style={{ fontSize: '.72rem', color: T.warn, marginTop: 4, fontWeight: 600 }}>
                  ⚠ Excede tope directo — requerirá aprobación
                </div>
              )}
              {excedeAprobacion && (
                <div style={{ fontSize: '.72rem', color: T.err, marginTop: 4, fontWeight: 600 }}>
                  ✗ Excede tope máximo — no puede cargarse
                </div>
              )}
            </Field>
            <Field label="Forma de pago">
              <select value={f.forma_pago} onChange={e => upd('forma_pago', e.target.value)} style={inp}>
                <option>Efectivo</option><option>Transferencia</option>
              </select>
            </Field>
          </Row>

          <Row>
            <Field label="Fecha">
              <input type="date" value={f.fecha} onChange={e => upd('fecha', e.target.value)} style={inp} />
            </Field>
            <Field label="Proveedor (opcional)">
              <input type="text" value={f.proveedor} onChange={e => upd('proveedor', e.target.value)} placeholder="opcional" style={inp} />
            </Field>
          </Row>

          <Field label="Notas">
            <textarea value={f.notas} onChange={e => upd('notas', e.target.value)} rows={2} placeholder="opcional" style={inp} />
          </Field>
        </div>
        <div style={modalFoot}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={guardar} disabled={saving || excedeAprobacion} style={{
            ...btnPrimary,
            background: excedeTope ? T.warn : T.ochre,
            borderColor: excedeTope ? T.warn : T.ochre,
            opacity: (saving || excedeAprobacion) ? 0.5 : 1,
          }}>
            {saving ? 'Guardando…' : excedeTope ? 'Enviar para aprobación' : 'Guardar gasto'}
          </button>
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
const modalBox = { background: T.paper, borderRadius: 4, maxWidth: 560, width: '100%', maxHeight: '92vh', overflowY: 'auto' };
const modalHdr = { padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.forest, color: 'white', borderRadius: '4px 4px 0 0' };
const modalFoot = { padding: '14px 22px', borderTop: `1px solid ${T.rule}`, display: 'flex', gap: 8, justifyContent: 'flex-end' };
const btnClose = { background: 'none', border: 'none', color: 'white', fontSize: '1.4rem', cursor: 'pointer', opacity: 0.7 };
const btnPrimary = { padding: '9px 16px', borderRadius: 3, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', border: `1.5px solid ${T.forest}`, background: T.forest, color: 'white' };
const btnGhost = { padding: '9px 16px', borderRadius: 3, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', border: `1.5px solid ${T.forest}`, background: 'white', color: T.forest };
const inp = { width: '100%', padding: '8px 10px', border: `1.5px solid ${T.rule}`, borderRadius: 3, fontSize: '.88rem', background: 'white', boxSizing: 'border-box', fontFamily: 'inherit' };
