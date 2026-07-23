import { useState } from 'react';
import { useWrite } from '../../../hooks/useFirestore';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../components/Toast';

const T = {
  paper: '#FFFFFF', ink: '#1A1A18', forest: '#1F3A2C', canopy: '#2D6645',
  ochre: '#A8835A', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)', err: '#B00020', warn: '#B26A00',
};

const fmt = (n) => Number.isFinite(n) ? n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
const monedaSym = { GTQ: 'Q', MXN: '$', USD: '$' };

const CAT_LABELS = {
  importacion: 'Importación MX', proveedor_local: 'Proveedores locales', servicios: 'Servicios',
  rentas: 'Rentas', sueldos: 'Sueldos', impuestos: 'Impuestos', otros: 'Otros', gasto_op: 'Gasto operativo', cobro: 'Cobro',
};

export default function ModalDetalleMovimiento({ mov, onClose }) {
  const { user, getFinanzasPerms } = useAuth();
  const perms = getFinanzasPerms();
  const { update, remove, saving } = useWrite('movimientos_finanzas');
  const toast = useToast();

  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({
    concepto: mov.concepto || '',
    monto: mov.monto ?? '',
    fecha: mov.fecha || '',
    proveedor: mov.proveedor || mov.cliente || '',
    notas: mov.notas || '',
  });
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  // ¿Puede editar este movimiento? Según tipo + permiso de carga correspondiente
  const canEdit = mov.tipo === 'cobro' ? perms.cargar_cobros
    : mov.tipo === 'gasto_op' ? perms.cargar_gastos_op
    : perms.cargar_pagos;

  const guardar = async () => {
    const m = parseFloat(f.monto);
    if (!f.concepto.trim()) return toast('El concepto no puede quedar vacío', 'error');
    if (!Number.isFinite(m) || m <= 0) return toast('Monto inválido', 'error');
    try {
      const patch = {
        concepto: f.concepto.trim(),
        monto: m,
        fecha: f.fecha,
        notas: f.notas.trim() || null,
        editadoEn: new Date().toISOString(),
        editadoPor: user?.usuario || 'unknown',
      };
      if (mov.tipo === 'cobro') patch.cliente = f.proveedor.trim() || null;
      else patch.proveedor = f.proveedor.trim() || null;
      await update(mov.id, patch);
      toast('✓ Movimiento actualizado');
      onClose();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  const anular = async () => {
    const label = `${CAT_LABELS[mov.categoria] || mov.tipo} · ${monedaSym[mov.moneda] || 'Q'} ${fmt(parseFloat(mov.monto) || 0)}`;
    if (!window.confirm(`¿ANULAR este movimiento?\n\n${label}\n${mov.concepto || ''}\n\nSe elimina de forma permanente y deja de contar en dashboard, resultados y grupos. Esta acción no se puede deshacer.`)) return;
    try {
      await remove(mov.id);
      toast('Movimiento anulado');
      onClose();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  const Fila = ({ label, children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 10, padding: '7px 0', borderBottom: `1px solid ${T.rule}`, alignItems: 'center' }}>
      <span style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: T.muted }}>{label}</span>
      <span style={{ fontSize: '.9rem', color: T.ink }}>{children}</span>
    </div>
  );

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={modalBg}>
      <div style={modalBox}>
        <div style={modalHdr}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.1rem', fontWeight: 600 }}>
            {editando ? 'Editar movimiento' : 'Detalle del movimiento'}
          </h2>
          <button onClick={onClose} style={btnClose}>×</button>
        </div>

        <div style={{ padding: '18px 22px' }}>
          {!editando && (
            <>
              <Fila label="Tipo">
                <span style={{ color: mov.tipo === 'cobro' ? T.canopy : T.err, fontWeight: 600 }}>
                  {mov.tipo === 'cobro' ? '↓ Cobro' : '↑ ' + (CAT_LABELS[mov.categoria] || 'Pago')}
                </span>
                {mov.subcategoria && <span style={{ color: T.muted }}> · {mov.subcategoria}</span>}
              </Fila>
              <Fila label="Concepto">{mov.concepto || '—'}</Fila>
              <Fila label="Monto">
                <b style={{ fontFamily: 'monospace', fontSize: '1rem' }}>{monedaSym[mov.moneda] || 'Q'} {fmt(parseFloat(mov.monto) || 0)}{mov.moneda && mov.moneda !== 'GTQ' ? ' ' + mov.moneda : ''}</b>
              </Fila>
              <Fila label="Fecha">{mov.fecha || '—'}</Fila>
              <Fila label="Forma de pago">{mov.forma_pago || '—'}</Fila>
              <Fila label={mov.tipo === 'cobro' ? 'Cliente' : 'Proveedor'}>{mov.proveedor || mov.cliente || '—'}</Fila>
              <Fila label="Estado">{mov.estado || '—'}</Fila>
              {mov.fecha_vencimiento && <Fila label="Vencimiento">{mov.fecha_vencimiento}</Fila>}
              {mov.notas && <Fila label="Notas">{mov.notas}</Fila>}
              <Fila label="Cargado por">{mov.creadoPor || '—'}{mov.editadoPor && <span style={{ color: T.muted, fontSize: '.78rem' }}> · editado por {mov.editadoPor}</span>}</Fila>
            </>
          )}

          {editando && canEdit && (
            <>
              <Campo label="Concepto"><input value={f.concepto} onChange={e => upd('concepto', e.target.value)} style={inp} /></Campo>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Campo label="Monto"><input type="number" step="0.01" value={f.monto} onChange={e => upd('monto', e.target.value)} style={inp} /></Campo>
                <Campo label="Fecha"><input type="date" value={f.fecha} onChange={e => upd('fecha', e.target.value)} style={inp} /></Campo>
              </div>
              <Campo label={mov.tipo === 'cobro' ? 'Cliente' : 'Proveedor'}><input value={f.proveedor} onChange={e => upd('proveedor', e.target.value)} style={inp} /></Campo>
              <Campo label="Notas"><textarea value={f.notas} onChange={e => upd('notas', e.target.value)} rows={2} style={inp} /></Campo>
              <div style={{ fontSize: '.72rem', color: T.muted, marginTop: 4 }}>
                * Para cambiar categoría o estado, anulá y volvé a cargar el movimiento.
              </div>
            </>
          )}
        </div>

        <div style={modalFoot}>
          {!editando && (
            <>
              {perms.anular && <button onClick={anular} disabled={saving} style={btnDanger}>🗑 Anular</button>}
              <div style={{ flex: 1 }} />
              {canEdit && <button onClick={() => setEditando(true)} style={btnGhost}>✏ Editar</button>}
              <button onClick={onClose} style={btnPrimary}>Cerrar</button>
            </>
          )}
          {editando && (
            <>
              <button onClick={() => setEditando(false)} style={btnGhost}>Cancelar</button>
              <div style={{ flex: 1 }} />
              <button onClick={guardar} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }) {
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
const modalFoot = { padding: '14px 22px', borderTop: `1px solid ${T.rule}`, display: 'flex', gap: 8, alignItems: 'center' };
const btnClose = { background: 'none', border: 'none', color: 'white', fontSize: '1.4rem', cursor: 'pointer', opacity: 0.7 };
const btnPrimary = { padding: '9px 16px', borderRadius: 3, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', border: `1.5px solid ${T.forest}`, background: T.forest, color: 'white' };
const btnGhost = { padding: '9px 16px', borderRadius: 3, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', border: `1.5px solid ${T.forest}`, background: 'white', color: T.forest };
const btnDanger = { padding: '9px 16px', borderRadius: 3, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', border: `1.5px solid ${T.err}`, background: 'white', color: T.err };
const inp = { width: '100%', padding: '8px 10px', border: `1.5px solid ${T.rule}`, borderRadius: 3, fontSize: '.88rem', background: 'white', boxSizing: 'border-box', fontFamily: 'inherit' };
