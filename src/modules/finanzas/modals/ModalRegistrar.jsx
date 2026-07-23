import { useState } from 'react';
import { db, collection, addDoc } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../components/Toast';
import { useEmpleados } from '../../../hooks/useMainData';

// Pantalla ÚNICA de registro. El helper elige QUÉ registra y a QUIÉN;
// cada caso se guarda en su estado de cuenta real (rutea, no duplica).
const T = {
  paper: '#FFFFFF', ink: '#1A1A18', forest: '#1F3A2C', canopy: '#2D6645',
  ochre: '#A8835A', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)', err: '#B00020', warn: '#B26A00',
  sand: '#E7DDC9',
};

const GASTO_CATS = [
  { k: 'importacion', label: '📦 Importación MX' },
  { k: 'servicios',   label: '💡 Servicio (luz/agua/internet)' },
  { k: 'rentas',      label: '🏠 Renta' },
  { k: 'impuestos',   label: '🧾 Impuesto' },
  { k: 'otros',       label: '📎 Otro gasto' },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function ModalRegistrar({ proveedores = [], clientes = [], onClose }) {
  const { user } = useAuth();
  const toast = useToast();

  // Paso 1: qué tipo de movimiento
  const [tipo, setTipo] = useState('');           // 'pago' | 'cobro' | 'venta'
  const [destino, setDestino] = useState('');     // para pago: 'proveedor' | 'empleado' | 'gasto'
  const [saving, setSaving] = useState(false);

  // Campos
  const [f, setF] = useState({
    entidadId: '', empleadoNombre: '', categoria: '', concepto: '',
    monto: '', fecha: today(), forma: 'Transferencia',
  });
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  const reset = () => { setTipo(''); setDestino(''); setF({ entidadId: '', empleadoNombre: '', categoria: '', concepto: '', monto: '', fecha: today(), forma: 'Transferencia' }); };

  const guardar = async () => {
    const monto = parseFloat(f.monto);
    if (!Number.isFinite(monto) || monto <= 0) return toast('Monto inválido', 'error');
    const metodoPago = f.forma === 'Efectivo' ? 'efectivo' : 'transferencia';
    const stamp = { creadoEn: new Date().toISOString(), creadoPor: user?.usuario || 'unknown', origen: 'finanzas' };
    setSaving(true);
    try {
      // ── PAGO ──────────────────────────────────────────────
      if (tipo === 'pago') {
        if (destino === 'proveedor') {
          if (!f.entidadId) { setSaving(false); return toast('Elegí el proveedor', 'error'); }
          await addDoc(collection(db, 'cuentasProveedores'), {
            tipo: 'pago', proveedorId: f.entidadId, monto, fecha: f.fecha,
            metodoPago, descripcion: f.concepto.trim() || 'Pago', referencia: '', notas: '', recepcionId: null, ...stamp,
          });
          toast('✓ Pago registrado — actualiza estado de cuenta del proveedor');
        } else if (destino === 'empleado') {
          if (!f.empleadoNombre) { setSaving(false); return toast('Elegí el empleado', 'error'); }
          await addDoc(collection(db, 'perAnticipo'), {
            empleado: f.empleadoNombre, monto, fecha: f.fecha,
            concepto: f.concepto.trim() || 'Anticipo', estado: 'pendiente', ...stamp,
          });
          toast('✓ Anticipo registrado — pendiente de descontar en nómina');
        } else if (destino === 'gasto') {
          if (!f.categoria) { setSaving(false); return toast('Elegí la categoría del gasto', 'error'); }
          if (!f.concepto.trim()) { setSaving(false); return toast('Ingresá el concepto', 'error'); }
          await addDoc(collection(db, 'movimientos_finanzas'), {
            tipo: 'pago', categoria: f.categoria, concepto: f.concepto.trim(), monto, moneda: 'GTQ',
            fecha: f.fecha, forma_pago: f.forma, estado: 'pagado', ...stamp,
          });
          toast('✓ Gasto registrado');
        } else { setSaving(false); return toast('Elegí a quién le pagás', 'error'); }
      }
      // ── COBRO (CxC) ───────────────────────────────────────
      else if (tipo === 'cobro') {
        if (!f.entidadId) { setSaving(false); return toast('Elegí el cliente', 'error'); }
        await addDoc(collection(db, 'cuentasClientes'), {
          tipo: 'pago', clienteId: f.entidadId, monto, fecha: f.fecha,
          metodoPago, descripcion: f.concepto.trim() || 'Cobro', referencia: '', notas: '', ...stamp,
        });
        toast('✓ Cobro registrado — baja lo que te debe el cliente');
      }
      // ── VENTA (genera CxC) ────────────────────────────────
      else if (tipo === 'venta') {
        if (!f.entidadId) { setSaving(false); return toast('Elegí el cliente', 'error'); }
        await addDoc(collection(db, 'cuentasClientes'), {
          tipo: 'despacho', clienteId: f.entidadId, totalVenta: monto, fecha: f.fecha,
          descripcion: f.concepto.trim() || 'Venta', notas: '', ...stamp,
        });
        toast('✓ Venta registrada — suma a cuentas por cobrar');
      } else { setSaving(false); return toast('Elegí qué registrás', 'error'); }

      onClose();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    setSaving(false);
  };

  // ¿Ya se puede mostrar el formulario de campos?
  const listoParaCampos = tipo === 'cobro' || tipo === 'venta' || (tipo === 'pago' && destino);

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={modalBg}>
      <div style={modalBox}>
        <div style={modalHdr}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.15rem', fontWeight: 600 }}>Registrar movimiento</h2>
          <button onClick={onClose} style={btnClose}>×</button>
        </div>

        <div style={{ padding: '18px 22px' }}>
          {/* PASO 1 — ¿Qué registrás? */}
          <Seccion titulo="1 · ¿Qué registrás?">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <BigBtn active={tipo === 'pago'}  onClick={() => { setTipo('pago'); setDestino(''); }} icon="💸" label="Pago"  sub="dinero que sale" color={T.err} />
              <BigBtn active={tipo === 'cobro'} onClick={() => { setTipo('cobro'); setDestino(''); }} icon="💰" label="Cobro" sub="dinero que entra" color={T.canopy} />
              <BigBtn active={tipo === 'venta'} onClick={() => { setTipo('venta'); setDestino(''); }} icon="🧾" label="Venta" sub="genera CxC" color={T.ochre} />
            </div>
          </Seccion>

          {/* PASO 2 — Para PAGO: ¿a quién? */}
          {tipo === 'pago' && (
            <Seccion titulo="2 · ¿A quién le pagás?">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <BigBtn active={destino === 'proveedor'} onClick={() => setDestino('proveedor')} icon="🌱" label="Proveedor" sub="baja su saldo" color={T.forest} small />
                <BigBtn active={destino === 'empleado'}  onClick={() => setDestino('empleado')}  icon="👥" label="Empleado"  sub="anticipo" color={T.forest} small />
                <BigBtn active={destino === 'gasto'}     onClick={() => setDestino('gasto')}     icon="📎" label="Gasto"     sub="servicio/renta" color={T.forest} small />
              </div>
            </Seccion>
          )}

          {/* PASO 3 — Campos según el caso */}
          {listoParaCampos && (
            <Seccion titulo="3 · Datos">
              {/* Selector de entidad */}
              {tipo === 'pago' && destino === 'proveedor' && (
                <Campo label="Proveedor *">
                  <select value={f.entidadId} onChange={e => upd('entidadId', e.target.value)} style={inp}>
                    <option value="">— elegir proveedor —</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </Campo>
              )}
              {tipo === 'pago' && destino === 'empleado' && (
                <Campo label="Empleado *">
                  <EmpleadoSelect value={f.empleadoNombre} onChange={v => upd('empleadoNombre', v)} />
                </Campo>
              )}
              {tipo === 'pago' && destino === 'gasto' && (
                <Campo label="Categoría del gasto *">
                  <select value={f.categoria} onChange={e => upd('categoria', e.target.value)} style={inp}>
                    <option value="">— elegir —</option>
                    {GASTO_CATS.map(c => <option key={c.k} value={c.k}>{c.label}</option>)}
                  </select>
                </Campo>
              )}
              {(tipo === 'cobro' || tipo === 'venta') && (
                <Campo label="Cliente *">
                  <select value={f.entidadId} onChange={e => upd('entidadId', e.target.value)} style={inp}>
                    <option value="">— elegir cliente —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </Campo>
              )}

              <Campo label={tipo === 'venta' ? 'Descripción de la venta' : 'Concepto'}>
                <input value={f.concepto} onChange={e => upd('concepto', e.target.value)}
                  placeholder={placeholderConcepto(tipo, destino)} style={inp} />
              </Campo>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Campo label={tipo === 'venta' ? 'Total venta (Q) *' : 'Monto (Q) *'}>
                  <input type="number" step="0.01" value={f.monto} onChange={e => upd('monto', e.target.value)} placeholder="0.00" style={inp} />
                </Campo>
                <Campo label="Fecha">
                  <input type="date" value={f.fecha} onChange={e => upd('fecha', e.target.value)} style={inp} />
                </Campo>
              </div>

              {tipo !== 'venta' && destino !== 'empleado' && (
                <Campo label="Forma de pago">
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['Transferencia', 'Efectivo'].map(fp => (
                      <button key={fp} onClick={() => upd('forma', fp)} style={{
                        flex: 1, padding: '8px', borderRadius: 3, cursor: 'pointer', fontWeight: 600, fontSize: '.82rem',
                        border: `1.5px solid ${f.forma === fp ? T.forest : T.rule}`,
                        background: f.forma === fp ? 'rgba(31,58,44,.06)' : 'white', color: T.forest,
                      }}>{fp}</button>
                    ))}
                  </div>
                </Campo>
              )}

              <div style={{ marginTop: 6, fontSize: '.74rem', color: T.muted, background: T.sand, padding: '8px 10px', borderRadius: 3 }}>
                {textoRuteo(tipo, destino)}
              </div>
            </Seccion>
          )}
        </div>

        <div style={modalFoot}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <div style={{ flex: 1 }} />
          {(tipo || destino) && <button onClick={reset} style={btnGhost}>↺ Reiniciar</button>}
          <button onClick={guardar} disabled={saving || !listoParaCampos} style={{ ...btnPrimary, opacity: (saving || !listoParaCampos) ? 0.5 : 1 }}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Selector de empleado (lee empleados activos de su colección)
function EmpleadoSelect({ value, onChange }) {
  const { empleados } = useEmpleados();
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inp}>
      <option value="">— elegir empleado —</option>
      {empleados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
    </select>
  );
}

function placeholderConcepto(tipo, destino) {
  if (tipo === 'venta') return 'ej: Despacho zanahoria 40 cajas';
  if (tipo === 'cobro') return 'ej: Abono factura #123';
  if (destino === 'proveedor') return 'ej: Abono compra semana 28';
  if (destino === 'empleado') return 'ej: Anticipo quincena';
  return 'ej: Pago luz bodega julio';
}

function textoRuteo(tipo, destino) {
  if (tipo === 'cobro') return '→ Se registra en el estado de cuenta del cliente (baja lo que te debe).';
  if (tipo === 'venta') return '→ Suma a cuentas por cobrar del cliente.';
  if (destino === 'proveedor') return '→ Se registra como pago en el estado de cuenta del proveedor.';
  if (destino === 'empleado') return '→ Queda como anticipo pendiente, se descuenta en la próxima nómina.';
  if (destino === 'gasto') return '→ Se registra como gasto de Finanzas.';
  return '';
}

function Seccion({ titulo, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.ochre, marginBottom: 8 }}>{titulo}</div>
      {children}
    </div>
  );
}
function BigBtn({ active, onClick, icon, label, sub, color, small }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer',
      padding: small ? '10px 6px' : '14px 6px', borderRadius: 5,
      border: `1.5px solid ${active ? color : T.rule}`,
      background: active ? color : 'white', color: active ? 'white' : T.ink,
      transition: 'all .12s',
    }}>
      <span style={{ fontSize: small ? '1.1rem' : '1.5rem' }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: small ? '.82rem' : '.9rem' }}>{label}</span>
      <span style={{ fontSize: '.66rem', opacity: active ? 0.85 : 0.6 }}>{sub}</span>
    </button>
  );
}
function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: '.66rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.muted, marginBottom: 3 }}>{label}</label>
      {children}
    </div>
  );
}

const modalBg = { position: 'fixed', inset: 0, background: 'rgba(26,26,24,.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: 20, overflowY: 'auto' };
const modalBox = { background: T.paper, borderRadius: 4, maxWidth: 560, width: '100%', margin: 'auto' };
const modalHdr = { padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.forest, color: 'white', borderRadius: '4px 4px 0 0', position: 'sticky', top: 0 };
const modalFoot = { padding: '14px 22px', borderTop: `1px solid ${T.rule}`, display: 'flex', gap: 8, alignItems: 'center' };
const btnClose = { background: 'none', border: 'none', color: 'white', fontSize: '1.4rem', cursor: 'pointer', opacity: 0.7 };
const btnPrimary = { padding: '9px 20px', borderRadius: 3, fontWeight: 600, fontSize: '.85rem', cursor: 'pointer', border: `1.5px solid ${T.forest}`, background: T.forest, color: 'white' };
const btnGhost = { padding: '9px 14px', borderRadius: 3, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', border: `1.5px solid ${T.rule}`, background: 'white', color: T.forest };
const inp = { width: '100%', padding: '9px 11px', border: `1.5px solid ${T.rule}`, borderRadius: 3, fontSize: '.9rem', background: 'white', boxSizing: 'border-box', fontFamily: 'inherit' };
