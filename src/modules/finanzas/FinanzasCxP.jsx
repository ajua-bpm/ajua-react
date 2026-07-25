import { useMemo, useState } from 'react';
import { db, collection, addDoc, doc, updateDoc } from '../../firebase';
import { useCollection } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { weekOf, weekEnd, diasSemana, saldoProveedor } from './cxpHelpers';

// Cuentas por Pagar consolidado: proveedores + empleados (nómina) + gastos pendientes,
// en un solo lugar, con registro y control de pago. Cada "Pagar" escribe en el ledger correcto.
const T = {
  bg: '#F8F3E9', paper: '#FDFBF6', ink: '#1A1A18', forest: '#1F3A2C',
  canopy: '#2D6645', ochre: '#A8835A', muted: '#6E6A5F', rule: 'rgba(26,26,24,.10)',
  err: '#B00020', warn: '#B26A00', ok: '#2E7D32', sand: '#E7DDC9', blue: '#1565C0',
};
const fmt = (n) => Number.isFinite(n) ? n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
const fmt0 = (n) => Number.isFinite(n) ? n.toLocaleString('es-GT', { maximumFractionDigits: 0 }) : '0';
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

const CAT_LABEL = { importacion: 'Importación MX', proveedor_local: 'Proveedor local', servicios: 'Servicio', rentas: 'Renta', sueldos: 'Sueldo', impuestos: 'Impuesto', otros: 'Otro', gasto_op: 'Gasto operativo' };
const TIPO_META = {
  proveedor: { label: 'Proveedor', bg: 'rgba(31,58,44,.10)', color: T.forest },
  empleado:  { label: 'Empleado',  bg: 'rgba(168,131,90,.16)', color: T.ochre },
  gasto:     { label: 'Gasto',     bg: 'rgba(21,101,192,.12)', color: T.blue },
};

export default function FinanzasCxP() {
  const { getFinanzasPerms } = useAuth();
  const perms = getFinanzasPerms();

  const { empleados } = useEmpleados();
  const { data: cxProv, loading: lp } = useCollection('cuentasProveedores', { limit: 100000 });
  const { data: movFin, loading: lm } = useCollection('movimientos_finanzas', { limit: 100000 });
  const { data: alData, loading: la } = useCollection('al', { orderField: 'fecha', orderDir: 'desc', limit: 100000 });
  const { data: anticipos, loading: lan } = useCollection('perAnticipo', { limit: 100000 });
  const { data: perPagos, loading: lpp } = useCollection('perPagos', { limit: 100000 });
  const { data: proveedores } = useCollection('proveedores', { orderField: 'nombre', limit: 100000 });

  const [filtro, setFiltro] = useState('todos');
  const [pagando, setPagando] = useState(null); // fila a pagar

  const provMap = useMemo(() => Object.fromEntries((proveedores || []).map(p => [p.id, p.nombre])), [proveedores]);
  const semanaActual = weekOf(today());

  // ── Construir las filas de CxP desde las 3 fuentes ──────────────
  const filas = useMemo(() => {
    const out = [];

    // 1) Proveedores con saldo pendiente
    const porProv = {};
    for (const m of (cxProv || [])) {
      if (!m.proveedorId) continue;
      (porProv[m.proveedorId] = porProv[m.proveedorId] || []).push(m);
    }
    for (const [pid, movs] of Object.entries(porProv)) {
      const { saldo } = saldoProveedor(movs);
      if (saldo > 0.5) {
        out.push({ _tipo: 'proveedor', id: 'prov_' + pid, entidad: provMap[pid] || '—', concepto: 'Saldo de cuenta', monto: saldo, venc: null, estado: 'pendiente', _prov: { proveedorId: pid } });
      }
    }

    // 2) Empleados — nómina de la semana actual, no pagada.
    // Guard anti-doble-pago robusto: cuenta como "ya pagado esta semana" si hay un
    // perPagos con semana === la actual, O con fecha dentro del rango lunes→domingo
    // (en la nómina vieja el campo `semana` es texto editable y puede no coincidir).
    const domSemana = weekEnd(semanaActual);
    const pagadosSemana = new Set(
      (perPagos || [])
        .filter(p => p.semana === semanaActual || (p.fecha && p.fecha >= semanaActual && p.fecha <= domSemana))
        .map(p => (p.empleado || '').toLowerCase().trim())
    );
    for (const e of (empleados || [])) {
      const { dias, fechas, horasExtras } = diasSemana(alData, e, semanaActual);
      const salarioDia = parseFloat(e.salarioDia) || 0;
      const salarioSemana = parseFloat(e.salarioSemana) || 0;
      const tipoPago = e.tipoPago || 'diario';
      const montoBase = tipoPago === 'diario' ? dias * salarioDia : salarioSemana;
      if (montoBase <= 0) continue;
      if (pagadosSemana.has((e.nombre || '').toLowerCase().trim())) continue;
      const antPend = (anticipos || []).filter(a => a.empleado === e.nombre && a.estado === 'pendiente');
      const totalAnt = antPend.reduce((s, a) => s + (a.monto || 0), 0);
      const neto = Math.max(0, montoBase - totalAnt);
      out.push({
        _tipo: 'empleado', id: 'emp_' + e.id, entidad: e.nombre,
        concepto: tipoPago === 'diario' ? `${dias} día${dias !== 1 ? 's' : ''} × Q${fmt0(salarioDia)}` : 'Sueldo semanal',
        monto: neto, venc: weekEnd(semanaActual), estado: 'pendiente',
        _emp: { emp: e, dias, fechas, horasExtras, salarioDia, tipoPago, montoBase, antPend, totalAnt, semana: semanaActual },
      });
    }

    // 3) Gastos pendientes (movimientos_finanzas sin pagar)
    for (const m of (movFin || [])) {
      const esGasto = m.tipo === 'pago' || m.tipo === 'gasto_op';
      if (!esGasto) continue;
      if (m.estado !== 'pendiente' && m.estado !== 'pendiente_aprobacion') continue;
      out.push({
        _tipo: 'gasto', id: 'gas_' + m.id, entidad: m.proveedor || CAT_LABEL[m.categoria] || 'Gasto',
        concepto: m.concepto || CAT_LABEL[m.categoria] || '—', monto: parseFloat(m.montoGTQ ?? m.monto) || 0,
        venc: m.fecha_vencimiento || null, estado: m.estado, categoria: m.categoria, _gasto: { id: m.id },
      });
    }

    // marcar vencidos
    const hoy = today();
    for (const r of out) {
      r.vencido = !!(r.venc && r.venc < hoy);
    }
    // ordenar: vencidos primero, luego por vencimiento asc, luego sin fecha
    out.sort((a, b) => {
      if (!!a.vencido !== !!b.vencido) return a.vencido ? -1 : 1;
      const va = a.venc || '9999', vb = b.venc || '9999';
      return va < vb ? -1 : va > vb ? 1 : 0;
    });
    return out;
  }, [cxProv, movFin, alData, anticipos, perPagos, empleados, provMap, semanaActual]);

  const visibles = filtro === 'todos' ? filas : filas.filter(f => f._tipo === filtro);

  const kpis = useMemo(() => {
    const hoy = today(), en7 = addDays(hoy, 7);
    let total = 0, vencido = 0, semana = 0, nomina = 0;
    for (const f of filas) {
      total += f.monto;
      if (f.vencido) vencido += f.monto;
      if (f.venc && f.venc >= hoy && f.venc <= en7) semana += f.monto;
      if (f._tipo === 'empleado') nomina += f.monto;
    }
    return { total, vencido, semana, nomina, count: filas.length };
  }, [filas]);

  const loading = lp || lm || la || lan || lpp;
  const vencLabel = (r) => {
    if (!r.venc) return '—';
    const hoy = today();
    if (r.venc < hoy) return { txt: '🔴 vencido ' + r.venc, rojo: true };
    if (r.venc === hoy) return { txt: 'hoy', rojo: true };
    return { txt: r.venc, rojo: false };
  };

  const CHIPS = [
    { k: 'todos', label: 'Todos' },
    { k: 'proveedor', label: '🌱 Proveedores' },
    { k: 'empleado', label: '👥 Empleados' },
    { k: 'gasto', label: '💡 Gastos' },
  ];

  return (
    <div>
      <div style={{ fontSize: '.82rem', color: T.muted, marginBottom: 4 }}>Finanzas · Cuentas por Pagar</div>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.55rem', fontWeight: 600, color: T.forest }}>Cuentas por Pagar</h1>
      <div style={{ fontSize: '.85rem', color: T.muted, marginBottom: 18 }}>Todo lo que debés, en un solo lugar. Registrá y controlá cada pago desde acá.</div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>Consolidando cuentas…</div>}

      {!loading && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 11, marginBottom: 18 }}>
            <Kpi l="Total a pagar" v={`Q ${fmt0(kpis.total)}`} s={`${kpis.count} cuentas`} c={T.err} />
            <Kpi l="Vencido" v={`Q ${fmt0(kpis.vencido)}`} s={kpis.vencido > 0 ? '🔴 atrasado' : 'al día'} c={T.err} />
            <Kpi l="Vence esta semana" v={`Q ${fmt0(kpis.semana)}`} s="próximos 7 días" c={T.warn} />
            <Kpi l="Nómina personal" v={`Q ${fmt0(kpis.nomina)}`} s="semana actual" c={T.ochre} />
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {CHIPS.map(c => {
              const on = filtro === c.k;
              return (
                <button key={c.k} onClick={() => setFiltro(c.k)} style={{
                  padding: '6px 13px', borderRadius: 100, fontSize: '.78rem', fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${on ? T.forest : T.rule}`, background: on ? T.forest : T.paper, color: on ? '#fff' : T.ink,
                }}>{c.label}</button>
              );
            })}
          </div>

          {/* Tabla */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: T.paper, boxShadow: '0 1px 3px rgba(0,0,0,.05)', fontSize: '.85rem', minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={thL}>Vence</th><th style={thL}>Tipo</th><th style={thL}>A quién / concepto</th>
                  <th style={{ ...thL, textAlign: 'right' }}>Monto</th><th style={thL}>Estado</th><th style={thL}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr><td colSpan={6} style={{ ...td, textAlign: 'center', padding: 34, color: T.muted }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>✅</div>
                    {filas.length === 0 ? 'Nada pendiente por pagar.' : 'Sin cuentas en este filtro.'}
                  </td></tr>
                )}
                {visibles.map((r, i) => {
                  const vl = vencLabel(r);
                  const tm = TIPO_META[r._tipo];
                  return (
                    <tr key={r.id} style={{ background: i % 2 ? '#FAF7F0' : T.paper }}>
                      <td style={td}><span style={{ fontSize: '.72rem', fontWeight: vl.rojo ? 700 : 400, color: vl.rojo ? T.err : T.muted }}>{vl.txt || vl}</span></td>
                      <td style={td}><span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 3, fontSize: '.64rem', fontWeight: 700, textTransform: 'uppercase', background: tm.bg, color: tm.color }}>{tm.label}</span></td>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: T.forest }}>{r.entidad}</div>
                        <div style={{ fontSize: '.75rem', color: T.muted }}>
                          {r.concepto}
                          {r._tipo === 'empleado' && r._emp.totalAnt > 0 && <span style={{ color: T.warn, fontWeight: 600 }}> · −Q{fmt0(r._emp.totalAnt)} anticipo</span>}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>Q {fmt(r.monto)}</td>
                      <td style={td}>{r.vencido
                        ? <span style={estBadge(T.err, 'rgba(176,0,32,.12)')}>Vencido</span>
                        : <span style={estBadge(T.warn, 'rgba(178,106,0,.14)')}>Pendiente</span>}</td>
                      <td style={td}>
                        {(() => {
                          // Gasto que excedió tope de supervisor: requiere permiso de aprobación (y monto dentro del límite)
                          const necesitaAprob = r._tipo === 'gasto' && r.estado === 'pendiente_aprobacion';
                          const puedeAprobar = perms.aprobar_pendientes && r.monto <= (perms.aprobar_hasta ?? 0);
                          if (necesitaAprob && !puedeAprobar) return <span title="Requiere aprobación" style={{ fontSize: '.7rem', color: T.warn, fontWeight: 600 }}>requiere aprobación</span>;
                          if (!perms.marcar_pagado) return <span style={{ fontSize: '.72rem', color: T.muted }}>—</span>;
                          return <button onClick={() => setPagando(r)} style={btnPay}>{necesitaAprob ? 'Aprobar y pagar' : 'Pagar'}</button>;
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, fontSize: '.75rem', color: T.muted, lineHeight: 1.5 }}>
            Empleados sale automático de Control Acceso y Lavado (semana actual, días × salario) y descuenta anticipos pendientes. Al pagar, cada movimiento se registra en su cuenta y sale de la lista.
          </div>
        </>
      )}

      {pagando && (
        <ModalPagar
          row={pagando}
          onClose={() => setPagando(null)}
        />
      )}
    </div>
  );
}

// ─── Modal de pago (se adapta por tipo) ──────────────────────────────
function ModalPagar({ row, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const [monto, setMonto] = useState(String((row.monto || 0).toFixed(2)));
  const [forma, setForma] = useState('Transferencia');
  const [fecha, setFecha] = useState(today());
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    const m = parseFloat(monto);
    if (!Number.isFinite(m) || m <= 0) return toast('Monto inválido', 'error');
    const metodoPago = forma === 'Efectivo' ? 'efectivo' : 'transferencia';
    const stamp = { creadoEn: new Date().toISOString(), creadoPor: user?.usuario || 'unknown', origen: 'cxp' };
    setSaving(true);
    try {
      if (row._tipo === 'proveedor') {
        await addDoc(collection(db, 'cuentasProveedores'), {
          tipo: 'pago', proveedorId: row._prov.proveedorId, monto: m, fecha,
          metodoPago, descripcion: 'Pago', referencia: '', notas: '', recepcionId: null, ...stamp,
        });
        toast('✓ Pago a proveedor registrado');
      } else if (row._tipo === 'gasto') {
        await updateDoc(doc(db, 'movimientos_finanzas', row._gasto.id), {
          estado: 'pagado', forma_pago: forma, pagadoEn: stamp.creadoEn, pagadoPor: stamp.creadoPor,
        });
        toast('✓ Gasto marcado como pagado');
      } else if (row._tipo === 'empleado') {
        const e = row._emp;
        await addDoc(collection(db, 'perPagos'), {
          empleado: e.emp.nombre, fecha, semana: e.semana, monto: m, tipo: 'semanal', observaciones: '',
          estado: 'pagado', diasAL: e.dias, fechasTrabajadas: e.fechas, salarioDia: e.salarioDia,
          tipoPago: e.tipoPago, montoBase: e.montoBase, anticDescontados: e.totalAnt, ...stamp,
        });
        // marcar anticipos descontados
        for (const a of e.antPend) {
          await updateDoc(doc(db, 'perAnticipo', a.id), { estado: 'descontado' });
        }
        toast(`✓ Pago de nómina registrado${e.antPend.length ? ` · ${e.antPend.length} anticipo(s) descontado(s)` : ''}`);
      }
      onClose();
    } catch (err) { toast('Error: ' + err.message, 'error'); }
    setSaving(false);
  };

  const esEmpleado = row._tipo === 'empleado';
  const e = row._emp;

  return (
    <div onClick={ev => ev.target === ev.currentTarget && onClose()} style={modalBg}>
      <div style={modalBox}>
        <div style={modalHdr}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.1rem', fontWeight: 600 }}>Registrar pago</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer', opacity: .7 }}>×</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.muted }}>{TIPO_META[row._tipo].label}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: '1.2rem', fontWeight: 600, color: T.forest }}>{row.entidad}</div>
            <div style={{ fontSize: '.82rem', color: T.muted }}>{row.concepto}</div>
          </div>

          {esEmpleado && (
            <div style={{ background: T.sand, borderRadius: 4, padding: '10px 12px', marginBottom: 14, fontSize: '.82rem' }}>
              <Riga k="Base (semana actual)" v={`Q ${fmt(e.montoBase)}`} />
              {e.totalAnt > 0 && <Riga k={`Anticipos a descontar (${e.antPend.length})`} v={`− Q ${fmt(e.totalAnt)}`} color={T.warn} />}
              <div style={{ borderTop: `1px solid ${T.rule}`, marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Neto a pagar</span><span style={{ fontFamily: 'monospace' }}>Q {fmt(Math.max(0, e.montoBase - e.totalAnt))}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Campo label="Monto a pagar">
              <input type="number" step="0.01" value={monto} onChange={ev => setMonto(ev.target.value)} style={inp} />
            </Campo>
            <Campo label="Fecha">
              <input type="date" value={fecha} onChange={ev => setFecha(ev.target.value)} style={inp} />
            </Campo>
          </div>
          <Campo label="Forma de pago">
            <div style={{ display: 'flex', gap: 8 }}>
              {['Transferencia', 'Efectivo'].map(f => (
                <button key={f} onClick={() => setForma(f)} style={{
                  flex: 1, padding: 8, borderRadius: 3, cursor: 'pointer', fontWeight: 600, fontSize: '.82rem',
                  border: `1.5px solid ${forma === f ? T.forest : T.rule}`, background: forma === f ? 'rgba(31,58,44,.06)' : '#fff', color: T.forest,
                }}>{f}</button>
              ))}
            </div>
          </Campo>
          {row._tipo === 'proveedor' && <div style={{ fontSize: '.72rem', color: T.muted, marginTop: 4 }}>Podés pagar el saldo completo o una parte (abono).</div>}
        </div>
        <div style={modalFoot}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{ ...btnPrimary, opacity: saving ? .5 : 1 }}>{saving ? 'Guardando…' : 'Confirmar pago'}</button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ l, v, s, c }) {
  return (
    <div style={{ background: T.paper, border: `1px solid ${T.rule}`, borderTop: `3px solid ${c}`, padding: '12px 15px' }}>
      <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.muted }}>{l}</div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: '1.5rem', fontWeight: 600, marginTop: 3, color: c, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      {s && <div style={{ fontSize: '.7rem', color: T.muted, marginTop: 1 }}>{s}</div>}
    </div>
  );
}
function Riga({ k, v, color }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, color: color || T.ink }}><span style={{ color: T.muted }}>{k}</span><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span></div>;
}
function Campo({ label, children }) {
  return <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: '.66rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: T.muted, marginBottom: 3 }}>{label}</label>{children}</div>;
}

const estBadge = (color, bg) => ({ fontSize: '.64rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 2, background: bg, color });
const thL = { background: T.forest, color: '#fff', textAlign: 'left', padding: '9px 11px', fontSize: '.64rem', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 };
const td = { padding: '10px 11px', borderBottom: `1px solid ${T.rule}`, verticalAlign: 'middle' };
const btnPay = { padding: '6px 14px', border: `1.5px solid ${T.canopy}`, background: T.canopy, color: '#fff', borderRadius: 4, fontWeight: 700, fontSize: '.76rem', cursor: 'pointer' };
const modalBg = { position: 'fixed', inset: 0, background: 'rgba(26,26,24,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 };
const modalBox = { background: T.paper, borderRadius: 4, maxWidth: 480, width: '100%', maxHeight: '92vh', overflowY: 'auto' };
const modalHdr = { padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.forest, color: '#fff', borderRadius: '4px 4px 0 0' };
const modalFoot = { padding: '14px 22px', borderTop: `1px solid ${T.rule}`, display: 'flex', gap: 8, justifyContent: 'flex-end' };
const btnPrimary = { padding: '9px 18px', borderRadius: 3, fontWeight: 600, fontSize: '.85rem', cursor: 'pointer', border: `1.5px solid ${T.forest}`, background: T.forest, color: '#fff' };
const btnGhost = { padding: '9px 16px', borderRadius: 3, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', border: `1.5px solid ${T.rule}`, background: '#fff', color: T.forest };
const inp = { width: '100%', padding: '8px 10px', border: `1.5px solid ${T.rule}`, borderRadius: 3, fontSize: '.9rem', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' };
