import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';
import * as XLSX from 'xlsx';
import { db, collection, doc, writeBatch } from '../../firebase';

const T = {
  primary:  '#1B5E20', secondary: '#2E7D32',
  danger:   '#C62828', warn:      '#E65100',
  textDark: '#1A1A18', textMid:   '#6B6B60',
  border:   '#E0E0E0', bgGreen:   '#E8F5E9',
  white:    '#FFFFFF', bgLight:   '#F5F5F5',
};
const card = { background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:20, marginBottom:20 };
const TH_S = { padding:'10px 14px', fontSize:'.75rem', textTransform:'uppercase', fontWeight:700, letterSpacing:'.06em', color:T.white, background:T.primary, textAlign:'left', whiteSpace:'nowrap' };
const TD_S = (alt) => ({ padding:'9px 14px', fontSize:'.83rem', borderBottom:'1px solid #F0F0F0', background: alt ? '#F9FBF9' : '#fff', color:T.textDark });
const LS   = { display:'flex', flexDirection:'column', gap:5, fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.secondary };
const IS   = { padding:'9px 12px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.85rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2, color:T.textDark, background:T.white };

const today  = () => new Date().toISOString().slice(0, 10);
const fmtQ   = n => Number(n||0).toLocaleString('es-GT', { minimumFractionDigits:2, maximumFractionDigits:2 });

// Devuelve todos los nombres que identifican a un empleado (nombre + aliases)
function nombresEmp(emp) {
  const base = (emp?.nombre || '').toLowerCase().trim();
  const als  = (emp?.aliases || []).map(a => a.toLowerCase().trim()).filter(Boolean);
  return [base, ...als].filter(Boolean);
}
// True si el nombre de un registro AL coincide con el empleado (incluyendo aliases)
function matchEmpNombre(registroNombre, emp) {
  const rn = (registroNombre || '').toLowerCase().trim();
  return nombresEmp(emp).includes(rn);
}

// Lunes de la semana que contiene la fecha dada
const weekOf = (d) => {
  const dt = new Date(d + 'T12:00:00');
  const day = dt.getDay(); // 0=dom
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return dt.toISOString().slice(0, 10);
};
// Domingo de esa semana
const weekEnd = (lunes) => {
  const dt = new Date(lunes + 'T12:00:00');
  dt.setDate(dt.getDate() + 6);
  return dt.toISOString().slice(0, 10);
};

function useEmpActivos() {
  const { empleados, loading } = useEmpleados();
  return { activos: empleados, loading };
}

// ─── TAB 1: EMPLEADOS (solo lectura) ─────────────────────────────────────────
function TabEmpleados() {
  const navigate = useNavigate();
  const { data: todos, loading } = useCollection('empleados', { orderField:'nombre', limit:300 });
  const [search, setSearch]         = useState('');
  const [soloActivos, setSoloActivos] = useState(true);

  const lista = (todos||[])
    .filter(e => !soloActivos || (e.estado !== 'inactivo' && e.activo !== false))
    .filter(e => !search || e.nombre?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <Skeleton rows={6} />;

  const nActivos = (todos||[]).filter(e => e.estado !== 'inactivo' && e.activo !== false).length;

  return (
    <div>
      <div style={{ ...card, marginBottom:16, padding:'14px 18px', borderLeft:`4px solid ${T.primary}`, background:T.bgGreen }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:'.88rem', color:T.primary }}>Catálogo de Empleados</div>
            <div style={{ fontSize:'.78rem', color:T.textMid, marginTop:3 }}>Para agregar, editar o dar de baja usá Administración.</div>
          </div>
          <button onClick={() => navigate('/admin')} style={{ padding:'8px 18px', background:T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, fontSize:'.83rem', cursor:'pointer', whiteSpace:'nowrap' }}>
            ⚙️ Ir a Administración →
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:18 }}>
        {[{ label:'Activos', val:nActivos, color:T.primary },{ label:'Total', val:(todos||[]).length, color:T.textMid }].map(({ label, val, color }) => (
          <div key={label} style={{ ...card, marginBottom:0, padding:'14px 18px' }}>
            <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:'1.4rem', fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ ...IS, width:220, marginTop:0 }} />
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'.83rem', color:T.textMid, cursor:'pointer' }}>
          <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} style={{ accentColor:T.primary }} />
          Solo activos
        </label>
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>{['Nombre','Cargo','Área','Salario/día','Estado'].map(h => <th key={h} style={TH_S}>{h}</th>)}</tr></thead>
          <tbody>
            {lista.length === 0
              ? <tr><td colSpan={5} style={{ padding:40, textAlign:'center', color:T.textMid }}>Sin resultados</td></tr>
              : lista.map((e, i) => {
                  const activo = e.estado !== 'inactivo' && e.activo !== false;
                  return (
                    <tr key={e.id||e.nombre}>
                      <td style={{ ...TD_S(i%2===1), fontWeight:600 }}>{e.nombre}</td>
                      <td style={TD_S(i%2===1)}>{e.cargo||'—'}</td>
                      <td style={TD_S(i%2===1)}>{e.area||'—'}</td>
                      <td style={{ ...TD_S(i%2===1), fontWeight:600, color:T.primary }}>{e.salarioDia ? `Q ${fmtQ(e.salarioDia)}` : '—'}</td>
                      <td style={TD_S(i%2===1)}>
                        <span style={{ padding:'2px 9px', borderRadius:100, fontSize:'.7rem', fontWeight:700, background: activo ? T.bgGreen : '#FFEBEE', color: activo ? T.secondary : T.danger }}>
                          {activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB 2: ANTICIPOS ────────────────────────────────────────────────────────
function TabAnticipos() {
  const toast = useToast();
  const { activos }             = useEmpActivos();
  const { data, loading }       = useCollection('perAnticipo', { orderField:'fecha', orderDir:'desc', limit:300 });
  const { add, update, saving } = useWrite('perAnticipo');

  const BLANK = { empleado:'', fecha:today(), monto:'', concepto:'', estado:'pendiente' };
  const [form, setForm]     = useState({ ...BLANK });
  const [editId, setEditId] = useState(null);
  const [filtroEmp, setFiltroEmp] = useState('');

  const handleSave = async () => {
    if (!form.empleado || !form.monto) { toast('Empleado y monto son requeridos', 'error'); return; }
    const payload = { ...form, monto: parseFloat(form.monto)||0, creadoEn: new Date().toISOString() };
    if (editId) { await update(editId, payload); toast('Anticipo actualizado'); setEditId(null); }
    else { await add(payload); toast('Anticipo registrado'); }
    setForm({ ...BLANK });
  };

  const startEdit = r => {
    setForm({ empleado:r.empleado||'', fecha:r.fecha||today(), monto:String(r.monto||''), concepto:r.concepto||'', estado:r.estado||'pendiente' });
    setEditId(r.id);
  };

  const descontar = async (id) => { await update(id, { estado:'descontado' }); toast('Marcado como descontado'); };

  const totalPend = data.filter(r => r.estado === 'pendiente').reduce((s,r) => s+(r.monto||0), 0);
  const porEmp    = {};
  data.filter(r => r.estado === 'pendiente').forEach(r => {
    porEmp[r.empleado] = (porEmp[r.empleado]||0) + (r.monto||0);
  });

  const filtrado = filtroEmp ? data.filter(r => r.empleado === filtroEmp) : data;

  const EST_CFG = {
    pendiente:  { color:T.warn,      bg:'rgba(230,81,0,.10)',  label:'Pendiente'  },
    descontado: { color:T.secondary, bg:'rgba(46,125,50,.12)', label:'Descontado' },
  };

  if (loading) return <Skeleton rows={5} />;

  return (
    <div>
      {/* Resumen */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:20 }}>
        <div style={{ ...card, marginBottom:0, padding:'14px 18px', borderLeft:`4px solid ${T.warn}` }}>
          <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:4 }}>Total pendiente</div>
          <div style={{ fontSize:'1.3rem', fontWeight:800, color:T.warn }}>Q {fmtQ(totalPend)}</div>
        </div>
        {Object.keys(porEmp).length > 0 && (
          <div style={{ ...card, marginBottom:0, padding:'14px 18px' }}>
            <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:8 }}>Por empleado</div>
            {Object.entries(porEmp).map(([nom, tot]) => (
              <div key={nom} style={{ display:'flex', justifyContent:'space-between', fontSize:'.82rem', marginBottom:3 }}>
                <span style={{ fontWeight:600 }}>{nom}</span>
                <span style={{ color:T.warn, fontWeight:700 }}>Q {fmtQ(tot)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulario */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.primary, marginBottom:18, borderBottom:`2px solid ${T.primary}`, paddingBottom:8 }}>
          {editId ? 'Editar Anticipo' : 'Registrar Anticipo'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:14, marginBottom:14 }}>
          <label style={LS}>Empleado *
            <select value={form.empleado} onChange={e => setForm(f => ({ ...f, empleado:e.target.value }))} style={IS}>
              <option value="">— Seleccionar —</option>
              {activos.map(e => (
                <option key={e.id||e.nombre} value={e.nombre}>
                  {e.nombre}{porEmp[e.nombre] ? ` · Q${fmtQ(porEmp[e.nombre])} pend.` : ''}
                </option>
              ))}
            </select>
          </label>
          {form.empleado && porEmp[form.empleado] && (
            <div style={{ alignSelf:'flex-end', padding:'10px 14px', background:'rgba(230,81,0,.08)', border:`1px solid ${T.warn}`, borderRadius:6, fontSize:'.83rem', fontWeight:600, color:T.warn }}>
              ⚠ Tiene Q {fmtQ(porEmp[form.empleado])} en anticipos pendientes
            </div>
          )}
          <label style={LS}>Fecha<input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha:e.target.value }))} style={IS} /></label>
          <label style={LS}>Monto (Q) *<input type="number" min="0" step="0.01" value={form.monto} onChange={e => setForm(f => ({ ...f, monto:e.target.value }))} style={IS} /></label>
          <label style={LS}>Concepto<input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto:e.target.value }))} style={IS} /></label>
          <label style={LS}>Estado
            <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado:e.target.value }))} style={IS}>
              <option value="pendiente">Pendiente</option>
              <option value="descontado">Descontado</option>
            </select>
          </label>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={handleSave} disabled={saving} style={{ padding:'11px 28px', background:saving ? '#6B6B60' : T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, cursor:saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Registrar Anticipo'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm({ ...BLANK }); }} style={{ padding:'11px 20px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, cursor:'pointer', color:T.textMid }}>Cancelar</button>}
        </div>
      </div>

      {/* Historial */}
      <div style={card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
          <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary }}>Historial ({data.length})</div>
          <select value={filtroEmp} onChange={e => setFiltroEmp(e.target.value)} style={{ ...IS, width:200, marginTop:0 }}>
            <option value="">Todos los empleados</option>
            {activos.map(e => <option key={e.id||e.nombre} value={e.nombre}>{e.nombre}</option>)}
          </select>
        </div>
        {filtrado.length === 0
          ? <div style={{ textAlign:'center', padding:'40px 0', color:T.textMid }}>Sin registros</div>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Fecha','Empleado','Monto','Concepto','Estado',''].map(h => <th key={h} style={TH_S}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtrado.slice(0,100).map((r,i) => {
                    const cfg = EST_CFG[r.estado]||EST_CFG.pendiente;
                    return (
                      <tr key={r.id}>
                        <td style={{ ...TD_S(i%2===1), whiteSpace:'nowrap' }}>{r.fecha}</td>
                        <td style={{ ...TD_S(i%2===1), fontWeight:600 }}>{r.empleado||'—'}</td>
                        <td style={{ ...TD_S(i%2===1), fontWeight:700, color:T.warn }}>Q {(r.monto||0).toFixed(2)}</td>
                        <td style={TD_S(i%2===1)}>{r.concepto||'—'}</td>
                        <td style={TD_S(i%2===1)}>
                          <span style={{ display:'inline-block', padding:'3px 9px', borderRadius:100, fontSize:'.7rem', fontWeight:700, background:cfg.bg, color:cfg.color }}>{cfg.label}</span>
                        </td>
                        <td style={TD_S(i%2===1)}>
                          <div style={{ display:'flex', gap:4 }}>
                            <button onClick={() => startEdit(r)} style={{ padding:'3px 9px', background:T.primary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Editar</button>
                            {r.estado === 'pendiente' && (
                              <button onClick={() => descontar(r.id)} style={{ padding:'3px 9px', background:T.secondary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Descontar ✓</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

// ─── TAB 3: PAGOS SEMANALES ───────────────────────────────────────────────────
function TabPagosSemanales() {
  const toast = useToast();
  const { activos, loading: lEmp } = useEmpActivos();

  // Datos externos
  const { data: alData,       loading: lAL  } = useCollection('al',         { orderField:'fecha', orderDir:'desc', limit:500 });
  const { data: anticData,    loading: lAnt  } = useCollection('perAnticipo',{ orderField:'fecha', orderDir:'desc', limit:300 });
  const { data: pagosData,    loading: lPag  } = useCollection('perPagos',   { orderField:'fecha', orderDir:'desc', limit:400 });
  const { add, update, remove, saving }        = useWrite('perPagos');
  const { update: updAntic }                   = useWrite('perAnticipo');

  const BLANK = { empleado:'', fecha:today(), semana:weekOf(today()), monto:'', tipo:'semanal', observaciones:'', estado:'pagado' };
  const [form,    setForm]    = useState({ ...BLANK });
  const [editId,  setEditId]  = useState(null);
  const [descontarAnticipos, setDescontarAnticipos] = useState(true);

  // ── Filtros historial ──
  const [filtroEmp,   setFiltroEmp]   = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [expandedId,  setExpandedId]  = useState(null);

  // ── Calcular anticipos pendientes para el empleado seleccionado ──
  const anticPendientes = useMemo(() => {
    if (!form.empleado) return [];
    return anticData.filter(a => a.empleado === form.empleado && a.estado === 'pendiente');
  }, [form.empleado, anticData]);

  const totalAnticPend = anticPendientes.reduce((s,a) => s+(a.monto||0), 0);

  // ── Empleado seleccionado (con aliases) ──
  const empSeleccionado = activos.find(e => e.nombre === form.empleado);
  const tipoPago   = empSeleccionado?.tipoPago || 'diario';
  const salarioDia = empSeleccionado?.salarioDia || 0;
  const salarioSemana = empSeleccionado?.salarioSemana || 0;

  // ── Calcular días presentes en AL para la semana seleccionada ──
  const diasPresentes = useMemo(() => {
    if (!form.empleado || !form.semana) return { dias:0, detalle:[] };
    const lunes  = form.semana;
    const domingo = weekEnd(lunes);
    const semRecs = alData.filter(r => r.fecha >= lunes && r.fecha <= domingo);
    const diasSet = new Set();
    semRecs.forEach(r => {
      (r.checks||[]).forEach(ch => {
        if (matchEmpNombre(ch.nombre, empSeleccionado)) {
          const tieneHoras = ch.horas && Object.values(ch.horas).some(v => v);
          if (tieneHoras) diasSet.add(r.fecha);
        }
      });
    });
    return { dias: diasSet.size, detalle: [...diasSet].sort() };
  }, [form.empleado, form.semana, alData, empSeleccionado]);

  // ── Monto sugerido — semanal/quincenal usan monto fijo, diario usa días × tarifa ──
  const montoBase = tipoPago === 'diario'
    ? diasPresentes.dias * salarioDia
    : (salarioSemana || 0);
  const montoSugerido = Math.max(0, montoBase - totalAnticPend);

  // Auto-llenar monto cuando cambia empleado o semana
  useEffect(() => {
    if (!editId && montoBase > 0) {
      setForm(f => ({ ...f, monto: String(montoSugerido.toFixed(2)) }));
    }
  }, [montoBase, form.empleado, form.semana, editId]);

  const handleSave = async () => {
    if (!form.empleado || !form.monto) { toast('Empleado y monto son requeridos', 'error'); return; }
    const payload = {
      ...form,
      monto:           parseFloat(form.monto)||0,
      diasAL:           diasPresentes.dias,
      fechasTrabajadas: diasPresentes.detalle,
      salarioDia,
      tipoPago,
      montoBase,
      anticDescontados: descontarAnticipos ? totalAnticPend : 0,
      creadoEn:        new Date().toISOString(),
    };
    if (editId) {
      await update(editId, payload);
      toast('Pago actualizado');
      setEditId(null);
    } else {
      await add(payload);
      // Marcar anticipos como descontados
      if (descontarAnticipos && anticPendientes.length > 0) {
        for (const a of anticPendientes) {
          await updAntic(a.id, { estado:'descontado' });
        }
        toast(`Pago registrado · ${anticPendientes.length} anticipo(s) marcado(s) como descontado`);
      } else {
        toast('Pago registrado');
      }
    }
    setForm({ ...BLANK });
  };

  const startEdit = r => {
    setForm({ empleado:r.empleado||'', fecha:r.fecha||today(), semana:r.semana||weekOf(r.fecha||today()), monto:String(r.monto||''), tipo:r.tipo||'semanal', observaciones:r.observaciones||'', estado:r.estado||'pagado' });
    setEditId(r.id);
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  // ── KPIs ──
  const totalMes = pagosData.filter(r => r.fecha?.slice(0,7) === today().slice(0,7)).reduce((s,r) => s+(r.monto||0), 0);
  const totalAnticGlobal = anticData.filter(a => a.estado === 'pendiente').reduce((s,a) => s+(a.monto||0), 0);

  // ── Historial filtrado ──
  const filtrado = pagosData
    .filter(r => !filtroEmp   || r.empleado === filtroEmp)
    .filter(r => !filtroDesde || r.fecha >= filtroDesde)
    .filter(r => !filtroHasta || r.fecha <= filtroHasta);

  const totalFiltrado = filtrado.reduce((s,r) => s+(r.monto||0), 0);

  const TIPO_CFG = {
    semanal:   { label:'Semanal',   bg:'#E8F5E9', color:T.secondary },
    quincenal: { label:'Quincenal', bg:'#E3F2FD', color:'#1565C0'  },
    especial:  { label:'Especial',  bg:'#FFF3E0', color:T.warn      },
    bono:      { label:'Bono',      bg:'#F3E5F5', color:'#6A1B9A'  },
  };

  if (lEmp || lAL || lAnt || lPag) return <Skeleton rows={6} />;

  return (
    <div>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:20 }}>
        <div style={{ ...card, marginBottom:0, padding:'14px 18px', borderLeft:`4px solid ${T.primary}` }}>
          <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:4 }}>Pagado este mes</div>
          <div style={{ fontSize:'1.3rem', fontWeight:800, color:T.primary }}>Q {fmtQ(totalMes)}</div>
        </div>
        <div style={{ ...card, marginBottom:0, padding:'14px 18px', borderLeft:`4px solid ${T.warn}` }}>
          <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:4 }}>Anticipos pendientes (total)</div>
          <div style={{ fontSize:'1.3rem', fontWeight:800, color:T.warn }}>Q {fmtQ(totalAnticGlobal)}</div>
        </div>
      </div>

      {/* Formulario de pago */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.primary, marginBottom:18, borderBottom:`2px solid ${T.primary}`, paddingBottom:8 }}>
          {editId ? 'Editar Pago' : 'Registrar Pago Semanal'}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:14, marginBottom:16 }}>
          <label style={LS}>Empleado *
            <select value={form.empleado} onChange={e => setForm(f => ({ ...f, empleado:e.target.value }))} style={IS}>
              <option value="">— Seleccionar —</option>
              {activos.map(e => <option key={e.id||e.nombre} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </label>
          <label style={LS}>Semana (lunes)
            <input type="date" value={form.semana} onChange={e => setForm(f => ({ ...f, semana:e.target.value }))} style={IS} />
          </label>
          <label style={LS}>Fecha de pago
            <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha:e.target.value }))} style={IS} />
          </label>
          <label style={LS}>Tipo
            <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo:e.target.value }))} style={IS}>
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="bono">Bono</option>
              <option value="especial">Especial</option>
            </select>
          </label>
        </div>

        {/* Panel de cálculo — visible cuando hay empleado */}
        {form.empleado && (
          <div style={{ background:'#F8FBF8', border:`1.5px solid ${T.border}`, borderRadius:8, padding:'16px 18px', marginBottom:18 }}>
            <div style={{ fontWeight:700, fontSize:'.82rem', color:T.primary, marginBottom:12, textTransform:'uppercase', letterSpacing:'.06em' }}>
              Cálculo automático
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
              {/* Días en AL */}
              <div>
                <div style={{ fontSize:'.72rem', fontWeight:700, color:T.textMid, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>
                  Días en AL esta semana
                </div>
                <div style={{ fontSize:'1.4rem', fontWeight:800, color: diasPresentes.dias > 0 ? T.secondary : T.textMid }}>
                  {diasPresentes.dias}
                </div>
                {diasPresentes.detalle.length > 0 && (
                  <div style={{ fontSize:'.7rem', color:T.textMid, marginTop:3 }}>{diasPresentes.detalle.join(', ')}</div>
                )}
                {diasPresentes.dias === 0 && (
                  <div style={{ fontSize:'.72rem', color:T.textMid, marginTop:3 }}>Sin registros de lavado esta semana</div>
                )}
              </div>

              {/* Salario configurado */}
              <div>
                <div style={{ fontSize:'.72rem', fontWeight:700, color:T.textMid, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>
                  {tipoPago === 'diario' ? 'Salario por día' : tipoPago === 'quincenal' ? 'Salario quincenal' : 'Salario semanal'}
                </div>
                <div style={{ fontSize:'1.1rem', fontWeight:700, color:T.textDark }}>
                  {tipoPago === 'diario'
                    ? (salarioDia > 0 ? `Q ${fmtQ(salarioDia)}` : <span style={{ color:T.danger, fontSize:'.82rem' }}>No configurado en Admin</span>)
                    : (salarioSemana > 0 ? `Q ${fmtQ(salarioSemana)}` : <span style={{ color:T.danger, fontSize:'.82rem' }}>No configurado en Admin</span>)
                  }
                </div>
              </div>

              {/* Base calculada */}
              <div>
                <div style={{ fontSize:'.72rem', fontWeight:700, color:T.textMid, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>
                  {tipoPago === 'diario' ? `Base (${diasPresentes.dias} días × Q${fmtQ(salarioDia)})` : 'Monto fijo'}
                </div>
                <div style={{ fontSize:'1.1rem', fontWeight:700, color:T.secondary }}>Q {fmtQ(montoBase)}</div>
              </div>

              {/* Anticipos a descontar */}
              <div>
                <div style={{ fontSize:'.72rem', fontWeight:700, color:T.textMid, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>
                  Anticipos pendientes
                </div>
                <div style={{ fontSize:'1.1rem', fontWeight:700, color: totalAnticPend > 0 ? T.warn : T.textMid }}>
                  {totalAnticPend > 0 ? `− Q ${fmtQ(totalAnticPend)}` : 'Q 0'}
                </div>
                {anticPendientes.map(a => (
                  <div key={a.id} style={{ fontSize:'.7rem', color:T.warn, marginTop:2 }}>
                    {a.fecha} · {a.concepto||'Anticipo'} · Q {fmtQ(a.monto)}
                  </div>
                ))}
              </div>

              {/* Neto sugerido */}
              <div style={{ background:T.bgGreen, borderRadius:6, padding:'10px 14px', border:`1.5px solid ${T.secondary}` }}>
                <div style={{ fontSize:'.72rem', fontWeight:700, color:T.secondary, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>
                  Neto sugerido
                </div>
                <div style={{ fontSize:'1.4rem', fontWeight:800, color:T.primary }}>Q {fmtQ(montoSugerido)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Monto final (editable) */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:14, marginBottom:14 }}>
          <label style={{ ...LS, gridColumn:'span 1' }}>
            Monto a pagar (Q) *
            <input type="number" min="0" step="0.01" value={form.monto} onChange={e => setForm(f => ({ ...f, monto:e.target.value }))} style={{ ...IS, fontWeight:700, fontSize:'1rem' }} />
          </label>
          <label style={LS}>Estado
            <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado:e.target.value }))} style={IS}>
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </label>
          <label style={{ ...LS, gridColumn:'span 2' }}>
            Observaciones
            <input value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones:e.target.value }))} placeholder="Descuentos extra, horas extra, etc." style={IS} />
          </label>
        </div>

        {/* Checkbox descontar anticipos */}
        {!editId && totalAnticPend > 0 && (
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'.85rem', color:T.warn, fontWeight:600, marginBottom:16, cursor:'pointer' }}>
            <input type="checkbox" checked={descontarAnticipos} onChange={e => setDescontarAnticipos(e.target.checked)} style={{ accentColor:T.secondary, width:16, height:16 }} />
            Marcar {anticPendientes.length} anticipo(s) como descontados al guardar (Q {fmtQ(totalAnticPend)})
          </label>
        )}

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={handleSave} disabled={saving} style={{ padding:'11px 28px', background:saving ? '#6B6B60' : T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, cursor:saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Guardando...' : editId ? 'Actualizar' : '💾 Registrar Pago'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm({ ...BLANK }); }} style={{ padding:'11px 20px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, cursor:'pointer', color:T.textMid }}>Cancelar</button>}
        </div>
      </div>

      {/* Filtros historial */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:14, alignItems:'flex-end' }}>
        <label style={LS}>Empleado
          <select value={filtroEmp} onChange={e => setFiltroEmp(e.target.value)} style={{ ...IS, width:200 }}>
            <option value="">Todos</option>
            {activos.map(e => <option key={e.id||e.nombre} value={e.nombre}>{e.nombre}</option>)}
          </select>
        </label>
        <label style={LS}>Desde<input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} style={{ ...IS, width:145 }} /></label>
        <label style={LS}>Hasta<input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} style={{ ...IS, width:145 }} /></label>
        {(filtroEmp||filtroDesde||filtroHasta) && (
          <button onClick={() => { setFiltroEmp(''); setFiltroDesde(''); setFiltroHasta(''); }} style={{ padding:'9px 16px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, cursor:'pointer', color:T.textMid, alignSelf:'flex-end' }}>
            Limpiar
          </button>
        )}
      </div>

      {/* Historial */}
      <div style={card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
          <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary }}>Historial ({filtrado.length})</div>
          {filtrado.length > 0 && <div style={{ fontWeight:700, color:T.secondary }}>Total: Q {fmtQ(totalFiltrado)}</div>}
        </div>

        {filtrado.length === 0
          ? <div style={{ textAlign:'center', padding:'40px 0', color:T.textMid }}>Sin registros</div>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Fecha','Semana','Empleado','Días AL · Fechas','Base','Anticipo desc.','Pagado','Tipo','Estado',''].map(h => <th key={h} style={TH_S}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtrado.slice(0,150).map((r,i) => {
                    const tc = TIPO_CFG[r.tipo]||TIPO_CFG.semanal;
                    const pagado = r.estado === 'pagado';
                    const fechas = r.fechasTrabajadas || [];
                    const fmtFecha = f => { const d = new Date(f + 'T12:00:00Z'); return d.toLocaleDateString('es-GT',{weekday:'short',day:'2-digit',month:'short',timeZone:'UTC'}); };
                    return (
                      <tr key={r.id}>
                        <td style={{ ...TD_S(i%2===1), whiteSpace:'nowrap' }}>{r.fecha}</td>
                        <td style={{ ...TD_S(i%2===1), whiteSpace:'nowrap', fontSize:'.78rem', color:T.textMid }}>{r.semana||'—'}</td>
                        <td style={{ ...TD_S(i%2===1), fontWeight:600 }}>{r.empleado||'—'}</td>
                        <td style={{ ...TD_S(i%2===1) }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ fontWeight:800, fontSize:'1rem', color: (r.diasAL||0)>0 ? T.secondary : T.textMid }}>{r.diasAL ?? '—'}</span>
                            {fechas.length > 0 && (
                              <button onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                                style={{ padding:'1px 7px', border:`1px solid ${T.border}`, borderRadius:4, background:'#fff', cursor:'pointer', fontSize:'.65rem', color:T.textMid, fontWeight:600 }}>
                                {expandedId === r.id ? '▲' : '▼ fechas'}
                              </button>
                            )}
                          </div>
                          {expandedId === r.id && fechas.length > 0 && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:5 }}>
                              {fechas.map(f => (
                                <span key={f} style={{ background:'#E8F5E9', color:T.secondary, border:`1px solid #A5D6A7`, borderRadius:4, padding:'1px 6px', fontSize:'.68rem', fontWeight:700, whiteSpace:'nowrap' }}>
                                  {fmtFecha(f)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ ...TD_S(i%2===1), fontWeight:600, color:T.secondary }}>
                          Q {fmtQ(r.montoBase || (r.diasAL||0)*(r.salarioDia||0))}
                        </td>
                        <td style={{ ...TD_S(i%2===1), color: r.anticDescontados > 0 ? T.warn : T.textMid }}>
                          {r.anticDescontados > 0 ? `− Q ${fmtQ(r.anticDescontados)}` : '—'}
                        </td>
                        <td style={{ ...TD_S(i%2===1), fontWeight:700, color:T.primary }}>Q {fmtQ(r.monto)}</td>
                        <td style={TD_S(i%2===1)}>
                          <span style={{ padding:'2px 9px', borderRadius:100, fontSize:'.7rem', fontWeight:700, background:tc.bg, color:tc.color }}>{tc.label}</span>
                        </td>
                        <td style={TD_S(i%2===1)}>
                          <span style={{ padding:'2px 9px', borderRadius:100, fontSize:'.7rem', fontWeight:700, background: pagado ? T.bgGreen : '#FFF3E0', color: pagado ? T.secondary : T.warn }}>
                            {pagado ? 'Pagado' : 'Pendiente'}
                          </span>
                        </td>
                        <td style={TD_S(i%2===1)}>
                          <div style={{ display:'flex', gap:4 }}>
                            <button onClick={() => startEdit(r)} style={{ padding:'3px 9px', background:T.primary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>✏</button>
                            <button onClick={() => { if (window.confirm('¿Eliminar este pago?')) remove(r.id); }} style={{ padding:'3px 9px', background:'#fff', color:T.danger, border:`1.5px solid ${T.danger}`, borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

// ─── TAB 4: NÓMINA PERÍODO ────────────────────────────────────────────────────
function TabNomina() {
  const toast   = useToast();
  const { activos, loading: lEmp } = useEmpActivos();
  const { data: alData,   loading: lAL  } = useCollection('al',          { orderField:'fecha', orderDir:'desc', limit:1000 });
  const { data: anticData                } = useCollection('perAnticipo', { orderField:'fecha', orderDir:'desc', limit:300 });
  const { add: addPago, saving }           = useWrite('perPagos');

  const [desde,     setDesde]     = useState('');
  const [hasta,     setHasta]     = useState('');
  const [nomResult, setNomResult] = useState(null);
  const [pagando,   setPagando]   = useState(false);

  const AM_HORAS = ['10:00','12:00'];
  const PM_HORAS = ['14:00','16:00'];
  const HORAS = [...AM_HORAS, ...PM_HORAS];

  const calcular = () => {
    if (!desde || !hasta) { toast('Ingresá rango de fechas', 'error'); return; }
    const filtrados = (alData||[]).filter(r => r.fecha >= desde && r.fecha <= hasta);
    const diasPorEmp = {};
    filtrados.forEach(r => {
      (r.checks||[]).forEach(row => {
        const hasAM = AM_HORAS.some(h => row.horas && row.horas[h]);
        const hasPM = PM_HORAS.some(h => row.horas && row.horas[h]);
        if (!hasAM && !hasPM) return;
        const valor = (hasAM && hasPM) ? 1 : 0.5;
        const key = row.empleadoId || row.nombre;
        if (!diasPorEmp[key]) diasPorEmp[key] = { nombre: row.nombre, diasMap: {}, he: {} };
        // Tomar el mayor valor si el mismo empleado aparece dos veces en el mismo día
        diasPorEmp[key].diasMap[r.fecha] = Math.max(diasPorEmp[key].diasMap[r.fecha] || 0, valor);
        if ((row.horasExtras||0) > 0)
          diasPorEmp[key].he[r.fecha] = (diasPorEmp[key].he[r.fecha]||0) + row.horasExtras;
      });
    });
    const tabla = Object.values(diasPorEmp).map(entry => {
      const emp   = activos.find(e => matchEmpNombre(entry.nombre, e));
      const nombreOficial = emp?.nombre || entry.nombre;
      const sd    = emp?.salarioDia || (emp?.salario ? emp.salario/30 : 0);
      const tarifaHE = emp?.tarifaHoraExtra || (sd > 0 ? (sd/8)*1.5 : 0);
      const dias  = Object.values(entry.diasMap).reduce((s,v) => s+v, 0);
      const fechas = Object.keys(entry.diasMap).sort().map(f => ({ fecha:f, he: entry.he[f]||0, val: entry.diasMap[f] }));
      const totalHE = Object.values(entry.he).reduce((s,h) => s+h, 0);
      const pagoHE  = totalHE * tarifaHE;
      const anticPend = (anticData||[]).filter(a => a.empleado === nombreOficial && a.estado === 'pendiente').reduce((s,a) => s+(a.monto||0), 0);
      const bruto = dias * sd + pagoHE;
      const neto  = Math.max(0, bruto - anticPend);
      return { nombre:nombreOficial, nombreOriginal: entry.nombre !== nombreOficial ? entry.nombre : null, dias, fechas, salarioDia:sd, tarifaHE, totalHE, pagoHE, anticPend, bruto, neto };
    }).sort((a,b) => a.nombre.localeCompare(b.nombre));
    setNomResult(tabla);
  };

  const exportarExcel = () => {
    if (!nomResult?.length) return;
    const header = ['Empleado','Días','Fechas trabajadas','Sal/Día (Q)','Pago Regular (Q)','H.E. (hrs)','Pago HE (Q)','Anticipos Pend. (Q)','Bruto (Q)','Neto (Q)'];
    const rows = nomResult.map(r => [
      r.nombre,
      r.dias,
      r.fechas.map(({fecha:f,he,val}) => `${f}${val<1?'(½)':''}${he>0?`(${he}HE)`:''}`).join(', '),
      r.salarioDia > 0 ? +r.salarioDia.toFixed(2) : '',
      r.salarioDia > 0 ? +(r.dias * r.salarioDia).toFixed(2) : '',
      r.totalHE || 0,
      r.pagoHE > 0 ? +r.pagoHE.toFixed(2) : 0,
      r.anticPend > 0 ? +r.anticPend.toFixed(2) : 0,
      r.salarioDia > 0 ? +r.bruto.toFixed(2) : '',
      r.salarioDia > 0 ? +r.neto.toFixed(2) : '',
    ]);
    const totalBrutoX = nomResult.reduce((s,r)=>s+r.bruto,0);
    const totalNetoX  = nomResult.reduce((s,r)=>s+r.neto,0);
    rows.push(['TOTAL','','','','','','','',+totalBrutoX.toFixed(2),+totalNetoX.toFixed(2)]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = [22,8,60,12,16,10,12,18,12,12].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nómina');
    XLSX.writeFile(wb, `nomina_${desde}_${hasta}.xlsx`);
  };

  const registrarPagos = async () => {
    if (!nomResult?.length) return;
    const conSalario = nomResult.filter(r => r.salarioDia > 0);
    if (!conSalario.length) { toast('Ningún empleado tiene salario configurado', 'error'); return; }
    if (!window.confirm(`¿Registrar ${conSalario.length} pago(s) por Q ${conSalario.reduce((s,r)=>s+r.neto,0).toFixed(2)} total?`)) return;
    setPagando(true);
    try {
      for (const r of conSalario) {
        await addPago({
          empleado: r.nombre,
          fecha:    hasta,
          semana:   desde,
          monto:    r.neto,
          tipo:     'semanal',
          diasAL:   r.dias,
          fechasTrabajadas: r.fechas.map(f => f.fecha),
          salarioDia: r.salarioDia,
          anticDescontados: r.anticPend,
          estado:   'pendiente',
          observaciones: `Nómina ${desde} → ${hasta}`,
          creadoEn: new Date().toISOString(),
        });
      }
      toast(`✓ ${conSalario.length} pagos registrados`);
    } catch(e) { toast('Error: '+e.message,'error'); }
    setPagando(false);
  };

  const fmtQ = n => Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2});
  const fmtF = f => { const d=new Date(f+'T12:00:00Z'); return d.toLocaleDateString('es-GT',{weekday:'short',day:'2-digit',month:'short',timeZone:'UTC'}); };

  if (lEmp||lAL) return <Skeleton rows={5}/>;

  const totalBruto = (nomResult||[]).reduce((s,r)=>s+r.bruto,0);
  const totalNeto  = (nomResult||[]).reduce((s,r)=>s+r.neto,0);

  return (
    <div>
      <div style={{...card, padding:'16px 20px'}}>
        <div style={{fontWeight:700,fontSize:'.95rem',color:T.primary,marginBottom:16,borderBottom:`2px solid ${T.primary}`,paddingBottom:8}}>
          Nómina del Período — desde AL (Acceso y Lavado)
        </div>
        <div style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'flex-end',marginBottom:14}}>
          <label style={LS}>Desde<input type="date" value={desde} onChange={e=>setDesde(e.target.value)} style={{...IS,width:145}}/></label>
          <label style={LS}>Hasta<input type="date" value={hasta} onChange={e=>setHasta(e.target.value)} style={{...IS,width:145}}/></label>
          <button onClick={calcular} style={{padding:'9px 24px',background:T.primary,color:T.white,border:'none',borderRadius:6,fontWeight:700,fontSize:'.85rem',cursor:'pointer',alignSelf:'flex-end'}}>
            👷 Calcular
          </button>
        </div>
        {nomResult && nomResult.length === 0 && (
          <div style={{textAlign:'center',padding:'30px',color:T.textMid}}>Sin registros en ese período</div>
        )}
        {nomResult && nomResult.length > 0 && (
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:16}}>
              <div style={{padding:'12px 16px',background:T.bgGreen,borderRadius:8,border:`1px solid #A5D6A7`}}>
                <div style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',color:T.textMid,marginBottom:4}}>Total bruto</div>
                <div style={{fontSize:'1.2rem',fontWeight:800,color:T.secondary}}>Q {fmtQ(totalBruto)}</div>
              </div>
              <div style={{padding:'12px 16px',background:'#FFF3E0',borderRadius:8,border:`1px solid #FFCC80`}}>
                <div style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',color:T.textMid,marginBottom:4}}>Anticipos a descontar</div>
                <div style={{fontSize:'1.2rem',fontWeight:800,color:T.warn}}>Q {fmtQ(totalBruto-totalNeto)}</div>
              </div>
              <div style={{padding:'12px 16px',background:T.bgGreen,borderRadius:8,border:`2px solid ${T.primary}`}}>
                <div style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',color:T.textMid,marginBottom:4}}>Total neto a pagar</div>
                <div style={{fontSize:'1.3rem',fontWeight:800,color:T.primary}}>Q {fmtQ(totalNeto)}</div>
              </div>
            </div>
            <div style={{overflowX:'auto',marginBottom:16}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:T.primary}}>
                    {['Empleado','Días · Fechas','Sal/Día','Pago Reg.','H.E.','Pago HE','Anticipos Pend.','Bruto','Neto'].map(h=>(
                      <th key={h} style={{padding:'9px 12px',textAlign:'left',color:'#fff',fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nomResult.map((row,i)=>(
                    <tr key={row.nombre} style={{background:i%2===0?'#fff':'#F9FBF9'}}>
                      <td style={{padding:'9px 12px',fontWeight:600,fontSize:'.85rem'}}>{row.nombre}</td>
                      <td style={{padding:'9px 12px',verticalAlign:'top'}}>
                        <div style={{fontWeight:800,fontSize:'1rem',color:T.secondary,marginBottom:4}}>{row.dias}</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                          {row.fechas.map(({fecha:f,he,val})=>(
                            <span key={f} style={{background:he>0?'#FFF3E0':val<1?'#F3E5F5':'#E8F5E9',color:he>0?T.warn:val<1?'#6A1B9A':T.secondary,border:`1px solid ${he>0?'#FFCC80':val<1?'#CE93D8':'#A5D6A7'}`,borderRadius:4,padding:'2px 6px',fontSize:'.68rem',fontWeight:700,whiteSpace:'nowrap'}}>
                              {fmtF(f)}{val<1?' ½':''}{he>0?` · ${he}HE`:''}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{padding:'9px 12px',fontSize:'.83rem'}}>{row.salarioDia>0?`Q${row.salarioDia.toFixed(2)}`:<span style={{color:T.danger,fontSize:'.75rem'}}>Sin config</span>}</td>
                      <td style={{padding:'9px 12px',fontWeight:600,color:T.secondary,fontSize:'.85rem'}}>{row.salarioDia>0?`Q${(row.dias*row.salarioDia).toFixed(2)}`:'—'}</td>
                      <td style={{padding:'9px 12px',textAlign:'center'}}>{row.totalHE>0?<span style={{background:'#FFF3E0',color:T.warn,border:'1px solid #FFCC80',borderRadius:4,padding:'2px 7px',fontSize:'.75rem',fontWeight:700}}>{row.totalHE}h</span>:'—'}</td>
                      <td style={{padding:'9px 12px',color:T.warn,fontWeight:600,fontSize:'.85rem'}}>{row.pagoHE>0?`Q${row.pagoHE.toFixed(2)}`:'—'}</td>
                      <td style={{padding:'9px 12px',color:row.anticPend>0?T.warn:T.textMid,fontSize:'.85rem'}}>{row.anticPend>0?`− Q${row.anticPend.toFixed(2)}`:'—'}</td>
                      <td style={{padding:'9px 12px',fontWeight:700,color:T.secondary,fontSize:'.85rem'}}>{row.salarioDia>0?`Q${row.bruto.toFixed(2)}`:'—'}</td>
                      <td style={{padding:'9px 12px',fontWeight:800,fontSize:'.9rem',color:T.primary}}>{row.salarioDia>0?`Q${row.neto.toFixed(2)}`:'—'}</td>
                    </tr>
                  ))}
                  <tr style={{background:'#E8F5E9'}}>
                    <td colSpan={7} style={{padding:'10px 12px',fontWeight:700,textAlign:'right',color:T.primary}}>Total:</td>
                    <td style={{padding:'10px 12px',fontWeight:800,color:T.secondary}}>Q{fmtQ(totalBruto)}</td>
                    <td style={{padding:'10px 12px',fontWeight:800,color:T.primary}}>Q{fmtQ(totalNeto)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <button onClick={exportarExcel}
                style={{padding:'11px 24px',background:'#1565C0',color:T.white,border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:'pointer'}}>
                📥 Descargar Excel
              </button>
              <button onClick={registrarPagos} disabled={pagando||saving}
                style={{padding:'11px 28px',background:pagando?'#BDBDBD':T.secondary,color:T.white,border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:pagando?'not-allowed':'pointer'}}>
                {pagando?'Registrando…':'💾 Registrar pagos en Historial'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── TAB 5: ESTADO DE CUENTA ──────────────────────────────────────────────────
function TabEstadoCuenta() {
  const toast = useToast();
  const { activos, loading: lEmp } = useEmpActivos();
  const { data: alData,   loading: lAL  } = useCollection('al',          { orderField:'fecha', orderDir:'desc', limit:1000 });
  const { data: anticData,loading: lAnt } = useCollection('perAnticipo', { orderField:'fecha', orderDir:'desc', limit:300 });
  const { data: pagosData,loading: lPag } = useCollection('perPagos',    { orderField:'fecha', orderDir:'desc', limit:500 });

  const [empSel,  setEmpSel]  = useState('');
  const [desde,   setDesde]   = useState('');
  const [hasta,   setHasta]   = useState('');
  const [nomData, setNomData] = useState(null);

  const AM_HORAS = ['10:00','12:00'];
  const PM_HORAS = ['14:00','16:00'];

  const calcular = () => {
    if (!empSel || !desde || !hasta) { toast('Seleccioná empleado y rango','error'); return; }
    const filtrados = (alData||[]).filter(r => r.fecha >= desde && r.fecha <= hasta);
    const diasMap = {};
    const heMap = {};
    const emp    = activos.find(e => e.nombre === empSel);
    filtrados.forEach(r => {
      (r.checks||[]).forEach(row => {
        if (!matchEmpNombre(row.nombre, emp)) return;
        const hasAM = AM_HORAS.some(h => row.horas && row.horas[h]);
        const hasPM = PM_HORAS.some(h => row.horas && row.horas[h]);
        if (!hasAM && !hasPM) return;
        const val = (hasAM && hasPM) ? 1 : 0.5;
        diasMap[r.fecha] = Math.max(diasMap[r.fecha]||0, val);
        if ((row.horasExtras||0) > 0) heMap[r.fecha] = (heMap[r.fecha]||0) + row.horasExtras;
      });
    });
    const sd     = emp?.salarioDia || 0;
    const tHE    = emp?.tarifaHoraExtra || (sd > 0 ? (sd/8)*1.5 : 0);
    const dias   = Object.values(diasMap).reduce((s,v)=>s+v, 0);
    const fechas = Object.keys(diasMap).sort().map(f => ({ fecha:f, he:heMap[f]||0, val:diasMap[f] }));
    const totalHE = Object.values(heMap).reduce((s,h)=>s+h, 0);
    const pagoHE  = totalHE * tHE;
    const bruto   = dias * sd + pagoHE;
    const empNorm = empSel.toLowerCase();
    const anticsPend  = (anticData||[]).filter(a => (a.empleado||'').toLowerCase()===empNorm && a.estado==='pendiente');
    const totalAntPend = anticsPend.reduce((s,a)=>s+(a.monto||0),0);
    // Filtrar por semana (inicio del período de trabajo) no por fecha de registro del pago
    const pagosRealizados = (pagosData||[]).filter(r =>
      (r.empleado||'').toLowerCase()===empNorm &&
      (r.semana||r.fecha)>=desde && (r.semana||r.fecha)<=hasta
    );
    const totalPagado = pagosRealizados.reduce((s,r)=>s+(r.monto||0),0);
    const saldo = bruto - totalAntPend - totalPagado;
    setNomData({ sd, tHE, dias, fechas, totalHE, pagoHE, bruto, anticsPend, totalAntPend, pagosRealizados, totalPagado, saldo });
  };

  const fmtQ = n => Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2});
  const fmtF = f => { const d=new Date(f+'T12:00:00Z'); return d.toLocaleDateString('es-GT',{weekday:'short',day:'2-digit',month:'short',timeZone:'UTC'}); };

  if (lEmp||lAL||lAnt||lPag) return <Skeleton rows={5}/>;

  return (
    <div>
      <div style={{...card, padding:'16px 20px'}}>
        <div style={{fontWeight:700,fontSize:'.95rem',color:T.primary,marginBottom:16,borderBottom:`2px solid ${T.primary}`,paddingBottom:8}}>
          Estado de Cuenta por Empleado
        </div>
        <div style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'flex-end',marginBottom:16}}>
          <label style={LS}>Empleado
            <select value={empSel} onChange={e=>setEmpSel(e.target.value)} style={{...IS,width:220}}>
              <option value="">— Seleccionar —</option>
              {activos.map(e=><option key={e.id||e.nombre} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </label>
          <label style={LS}>Desde<input type="date" value={desde} onChange={e=>setDesde(e.target.value)} style={{...IS,width:145}}/></label>
          <label style={LS}>Hasta<input type="date" value={hasta} onChange={e=>setHasta(e.target.value)} style={{...IS,width:145}}/></label>
          <button onClick={calcular} style={{padding:'9px 24px',background:T.primary,color:T.white,border:'none',borderRadius:6,fontWeight:700,fontSize:'.85rem',cursor:'pointer',alignSelf:'flex-end'}}>
            Ver Estado
          </button>
        </div>

        {nomData && (
          <div>
            {/* KPIs */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
              {[
                { label:'Días trabajados', val:nomData.dias,        color:T.primary,   fmt:v=>`${v}` },
                { label:'Pago regular',    val:nomData.dias*nomData.sd, color:T.secondary, fmt:v=>`Q ${fmtQ(v)}` },
                { label:'Horas extra',     val:nomData.pagoHE,      color:'#E65100',   fmt:v=>`Q ${fmtQ(v)}` },
                { label:'Total devengado', val:nomData.bruto,       color:T.primary,   fmt:v=>`Q ${fmtQ(v)}`, big:true },
                { label:'Anticipos pend.', val:nomData.totalAntPend,color:T.warn,      fmt:v=>`− Q ${fmtQ(v)}` },
                { label:'Ya pagado',       val:nomData.totalPagado, color:T.secondary, fmt:v=>`− Q ${fmtQ(v)}` },
                { label:'Saldo pendiente', val:nomData.saldo,       color:nomData.saldo>0?T.danger:T.secondary, fmt:v=>`Q ${fmtQ(v)}`, big:true },
              ].map(({label,val,color,fmt,big})=>(
                <div key={label} style={{padding:'12px 14px',background:'#fff',border:`1px solid ${T.border}`,borderRadius:8,boxShadow:'0 1px 3px rgba(0,0,0,.07)'}}>
                  <div style={{fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',color:T.textMid,marginBottom:4}}>{label}</div>
                  <div style={{fontSize:big?'1.2rem':'.95rem',fontWeight:big?800:700,color}}>{fmt(val)}</div>
                </div>
              ))}
            </div>

            {/* Fechas trabajadas */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:'.75rem',fontWeight:700,textTransform:'uppercase',color:T.textMid,marginBottom:6}}>Días trabajados</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {nomData.fechas.map(({fecha:f,he,val})=>(
                  <span key={f} style={{background:he>0?'#FFF3E0':val<1?'#F3E5F5':'#E8F5E9',color:he>0?T.warn:val<1?'#6A1B9A':T.secondary,border:`1px solid ${he>0?'#FFCC80':val<1?'#CE93D8':'#A5D6A7'}`,borderRadius:4,padding:'3px 8px',fontSize:'.75rem',fontWeight:700}}>
                    {fmtF(f)}{val<1?' ½':''}{he>0?` · ${he}HE`:''}
                  </span>
                ))}
                {nomData.fechas.length===0 && <span style={{color:T.textMid,fontSize:'.82rem'}}>Sin registros en ese período</span>}
              </div>
            </div>

            {/* Anticipos pendientes */}
            {nomData.anticsPend.length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:'.75rem',fontWeight:700,textTransform:'uppercase',color:T.warn,marginBottom:6}}>Anticipos pendientes</div>
                {nomData.anticsPend.map(a=>(
                  <div key={a.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 10px',background:'#FFF3E0',borderRadius:6,marginBottom:4,fontSize:'.82rem'}}>
                    <span>{a.fecha} · {a.concepto||'Anticipo'}</span>
                    <span style={{fontWeight:700,color:T.warn}}>Q {fmtQ(a.monto)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Pagos realizados */}
            {nomData.pagosRealizados.length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:'.75rem',fontWeight:700,textTransform:'uppercase',color:T.secondary,marginBottom:6}}>Pagos realizados en el período</div>
                {nomData.pagosRealizados.map(p=>(
                  <div key={p.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 10px',background:T.bgGreen,borderRadius:6,marginBottom:4,fontSize:'.82rem'}}>
                    <span>{p.fecha} · {p.tipo||'Pago'} {p.observaciones?`· ${p.observaciones}`:''}</span>
                    <span style={{fontWeight:700,color:T.secondary}}>Q {fmtQ(p.monto)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Saldo final */}
            <div style={{padding:'14px 18px',borderRadius:8,border:`2px solid ${nomData.saldo>0?T.danger:T.secondary}`,background:nomData.saldo>0?'#FFEBEE':T.bgGreen}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:700,fontSize:'.82rem',color:T.textMid,marginBottom:2}}>
                    {nomData.saldo>0?'⚠ Saldo pendiente de pago':'✓ Liquidado'}
                  </div>
                  <div style={{fontSize:'.78rem',color:T.textMid}}>Q{fmtQ(nomData.bruto)} devengado − Q{fmtQ(nomData.totalAntPend)} anticipos − Q{fmtQ(nomData.totalPagado)} pagado</div>
                </div>
                <div style={{fontSize:'1.6rem',fontWeight:800,color:nomData.saldo>0?T.danger:T.secondary}}>
                  Q {fmtQ(nomData.saldo)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAB: Saldos y pago (todos los empleados, balance devengado − pagado) ──────
// Vista unificada: conecta lo que se DEBE (calculado de AL) con lo que se PAGÓ
// (perPagos, misma fuente que las otras pestañas). Balance total, no por semana.
function TabBalancePagos() {
  const toast = useToast();
  const { activos, loading: lEmp } = useEmpActivos();
  const { data: alData,    loading: lAL  } = useCollection('al',          { orderField:'fecha', orderDir:'desc', limit:100000 });
  const { data: anticData, loading: lAnt } = useCollection('perAnticipo', { orderField:'fecha', orderDir:'desc', limit:100000 });
  const { data: pagosData, loading: lPag } = useCollection('perPagos',    { orderField:'fecha', orderDir:'desc', limit:100000 });

  const AM_HORAS = ['10:00','12:00'];
  const PM_HORAS = ['14:00','16:00'];

  const [sel, setSel]       = useState(() => new Set());
  const [pagando, setPagando] = useState(false);
  const [pagarModal, setPagarModal] = useState(null); // fila que se está pagando con monto elegido

  // Saldo = suma y resta ACUMULADA: todo lo que se ganó − todo lo pagado. Sin filtro de fecha
  // (un saldo no es de un período; no importa cuándo se pagó).
  const filas = useMemo(() => {
    const out = activos.map(emp => {
      const sd  = emp.salarioDia || (emp.salario ? emp.salario/30 : 0);
      const tHE = emp.tarifaHoraExtra || (sd > 0 ? (sd/8)*1.5 : 0);
      const diasMap = {}, heMap = {};
      for (const r of (alData||[])) {
        for (const row of (r.checks||[])) {
          if (!matchEmpNombre(row.nombre, emp)) continue;
          const hasAM = AM_HORAS.some(h => row.horas && row.horas[h]);
          const hasPM = PM_HORAS.some(h => row.horas && row.horas[h]);
          if (!hasAM && !hasPM) continue;
          diasMap[r.fecha] = Math.max(diasMap[r.fecha] || 0, (hasAM && hasPM) ? 1 : 0.5);
          if ((row.horasExtras||0) > 0) heMap[r.fecha] = (heMap[r.fecha]||0) + row.horasExtras;
        }
      }
      const dias    = Object.values(diasMap).reduce((s,v)=>s+v,0);
      const totalHE = Object.values(heMap).reduce((s,h)=>s+h,0);
      const devengado = dias*sd + totalHE*tHE;
      const empNorm = (emp.nombre||'').toLowerCase().trim();
      const pagos   = (pagosData||[]).filter(p => (p.empleado||'').toLowerCase().trim()===empNorm);
      const pagado  = pagos.reduce((s,p)=>s+(p.monto||0),0);
      // Anticipos entregados (todos cuentan como plata dada; los pendientes se descuentan al pagar)
      const anticips = (anticData||[]).filter(a => (a.empleado||'').toLowerCase().trim()===empNorm);
      const antTotal = anticips.reduce((s,a)=>s+(a.monto||0),0);
      const antPend  = anticips.filter(a => a.estado === 'pendiente');
      const saldo    = devengado - pagado - antTotal;
      const pendiente = Math.max(0, saldo);
      let estado;
      if (dias > 0 && sd <= 0) estado = 'sinsalario';
      else if (saldo < -0.5) estado = 'afavor';       // pagado de más
      else if (pendiente <= 0.5) estado = 'pagado';
      else if (pagado > 0 || antTotal > 0) estado = 'parcial';
      else estado = 'pendiente';
      return { emp, key: emp.id || emp.nombre, dias, totalHE, sd, devengado, pagado, antTotal, antPend, saldo, pendiente, estado, fechas: Object.keys(diasMap).sort() };
    })
    .filter(f => f.dias > 0 || f.pagado > 0)
    .sort((a,b) => (b.pendiente - a.pendiente) || a.emp.nombre.localeCompare(b.emp.nombre));
    return out;
  }, [activos, alData, pagosData, anticData]);

  const pagables = filas.filter(f => f.pendiente > 0.5 && f.sd > 0);
  const seleccionadas = pagables.filter(f => sel.has(f.key));
  const totalSel = seleccionadas.reduce((s,f)=>s+f.pendiente,0);

  const tot = useMemo(() => filas.reduce((a,f)=>({
    devengado: a.devengado + f.devengado,
    pagado:    a.pagado + f.pagado,
    porPagar:  a.porPagar + Math.max(0, f.saldo),   // solo los que faltan
    aFavor:    a.aFavor + Math.max(0, -f.saldo),     // sobrepagados
  }), { devengado:0, pagado:0, porPagar:0, aFavor:0 }), [filas]);

  const toggle = (key) => setSel(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleTodos = () => setSel(prev => prev.size === pagables.length ? new Set() : new Set(pagables.map(f=>f.key)));

  // Registra el pago del saldo pendiente de varios empleados, en un solo batch atómico
  const registrarPagos = async (filasPagar) => {
    const validas = filasPagar.filter(f => f.pendiente > 0.5 && f.sd > 0);
    if (!validas.length) { toast('No hay saldo pendiente para pagar', 'error'); return; }
    const totalPagar = validas.reduce((s,f)=>s+f.pendiente,0);
    if (!window.confirm(`¿Registrar ${validas.length} pago(s) por Q ${fmtQ(totalPagar)} total?\n\nSe paga el saldo pendiente de cada uno.`)) return;
    setPagando(true);
    try {
      const batch = writeBatch(db);
      const hoy = today();
      for (const f of validas) {
        const pagoRef = doc(collection(db, 'perPagos'));
        const antPendTotal = f.antPend.reduce((s,a)=>s+(a.monto||0),0);
        batch.set(pagoRef, {
          empleado: f.emp.nombre,
          fecha:    hoy,
          semana:   weekOf(hoy),
          monto:    Number(f.pendiente.toFixed(2)),
          tipo:     'semanal',
          diasAL:   f.dias,
          fechasTrabajadas: f.fechas,
          salarioDia: f.sd,
          anticDescontados: antPendTotal,
          estado:   'pagado',
          observaciones: 'Pago de saldo',
          origen:   'saldos',
          creadoEn: new Date().toISOString(),
        });
        // marcar anticipos pendientes como descontados (bookkeeping; el saldo ya los descontó)
        for (const a of f.antPend) batch.update(doc(db, 'perAnticipo', a.id), { estado: 'descontado' });
      }
      await batch.commit();
      setSel(new Set());
      toast(`✓ ${validas.length} pago(s) registrados por Q ${fmtQ(totalPagar)}`);
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    setPagando(false);
  };

  // Pago de UN empleado con monto elegido (completo o parcial) desde el modal
  const pagarUno = async (fila, monto, forma, fecha) => {
    const m = Number(monto);
    if (!(m > 0)) { toast('Monto inválido', 'error'); return; }
    setPagando(true);
    try {
      const esCompleto = m >= fila.pendiente - 0.5;
      const antPendTotal = fila.antPend.reduce((s,a)=>s+(a.monto||0),0);
      const batch = writeBatch(db);
      const pagoRef = doc(collection(db, 'perPagos'));
      batch.set(pagoRef, {
        empleado: fila.emp.nombre, fecha, semana: weekOf(fecha), monto: Number(m.toFixed(2)),
        tipo: 'semanal', diasAL: fila.dias, fechasTrabajadas: fila.fechas, salarioDia: fila.sd,
        anticDescontados: esCompleto ? antPendTotal : 0, estado: 'pagado', formaPago: forma,
        observaciones: esCompleto ? 'Pago de saldo' : 'Pago parcial', origen: 'saldos', creadoEn: new Date().toISOString(),
      });
      // solo al pagar completo se marcan los anticipos como descontados
      if (esCompleto) for (const a of fila.antPend) batch.update(doc(db, 'perAnticipo', a.id), { estado: 'descontado' });
      await batch.commit();
      setPagarModal(null);
      toast(`✓ Pago registrado: Q ${fmtQ(m)}`);
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    setPagando(false);
  };

  if (lEmp || lAL || lPag || lAnt) return <Skeleton rows={6} />;

  const badge = (estado) => {
    const cfg = {
      pagado:     { bg:'rgba(46,125,50,.15)', c:T.secondary, t:'✓ Pagado' },
      parcial:    { bg:'rgba(230,81,0,.14)',  c:T.warn,      t:'◑ Parcial' },
      pendiente:  { bg:'rgba(230,81,0,.14)',  c:T.warn,      t:'⏳ Pendiente' },
      afavor:     { bg:'rgba(198,40,40,.10)', c:T.danger,    t:'↑ Sobrepago' },
      sinsalario: { bg:'rgba(198,40,40,.10)', c:T.danger,    t:'⚠ Sin salario' },
    }[estado] || { bg:'#eee', c:T.textMid, t:estado };
    return <span style={{ padding:'3px 9px', borderRadius:100, fontSize:'.64rem', fontWeight:700, textTransform:'uppercase', background:cfg.bg, color:cfg.c, whiteSpace:'nowrap' }}>{cfg.t}</span>;
  };

  return (
    <div style={{ paddingBottom: seleccionadas.length ? 70 : 0 }}>
      <div style={{ fontSize:'.82rem', color:T.textMid, marginBottom:14 }}>
        Lo que se debe (días de AL × salario) menos lo pagado = saldo. <b style={{color:T.textDark}}>Acumulado — no importa cuándo se pagó.</b>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:8 }}>
        <Kpi label="Se debe (total)" val={`Q ${fmtQ(tot.devengado)}`} color={T.primary} />
        <Kpi label="Pagado (total)" val={`Q ${fmtQ(tot.pagado)}`} color={T.secondary} />
        <Kpi label="Falta pagar" val={`Q ${fmtQ(tot.porPagar)}`} color={tot.porPagar>0.5?T.warn:T.secondary} />
        {tot.aFavor > 0.5 && <Kpi label="Pagado de más" val={`Q ${fmtQ(tot.aFavor)}`} color={T.danger} />}
      </div>

      {tot.aFavor > 0.5 && (
        <div style={{ fontSize:'.76rem', color:T.textMid, marginBottom:12 }}>
          ⚠ Hay <b style={{color:T.danger}}>Q {fmtQ(tot.aFavor)}</b> pagado de más en {filas.filter(f=>f.estado==='afavor').length} empleado(s) — revisá su salario o días en AL.
        </div>
      )}

      <div style={{ overflowX:'auto', ...card, padding:0 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.83rem', minWidth:820 }}>
          <thead><tr>
            <th style={{...TH_S, width:34}}><input type="checkbox" checked={pagables.length>0 && sel.size===pagables.length} onChange={toggleTodos} style={{ width:16, height:16, accentColor:T.primary, cursor:'pointer' }} /></th>
            <th style={TH_S}>Empleado</th>
            <th style={{...TH_S, textAlign:'center'}}>Días</th>
            <th style={{...TH_S, textAlign:'right'}}>Se debe</th>
            <th style={{...TH_S, textAlign:'right'}}>Pagado</th>
            <th style={{...TH_S, textAlign:'right'}}>Saldo</th>
            <th style={{...TH_S, textAlign:'center'}}>Estado</th>
            <th style={TH_S}>Acción</th>
          </tr></thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={8} style={{ textAlign:'center', padding:34, color:T.textMid }}>Sin empleados con actividad.</td></tr>}
            {filas.map((f, i) => {
              const puede = f.pendiente > 0.5 && f.sd > 0;
              return (
                <tr key={f.key} style={{ background: sel.has(f.key) ? '#EEF6EE' : (i%2 ? '#F9FBF9' : '#fff') }}>
                  <td style={{ ...TD_S(false), textAlign:'center' }}>
                    {puede && <input type="checkbox" checked={sel.has(f.key)} onChange={()=>toggle(f.key)} style={{ width:16, height:16, accentColor:T.primary, cursor:'pointer' }} />}
                  </td>
                  <td style={TD_S(false)}>
                    <div style={{ fontWeight:600, color:T.primary }}>{f.emp.nombre}</div>
                    <div style={{ fontSize:'.72rem', color:T.textMid }}>{f.emp.area || f.emp.cargo || '—'}</div>
                  </td>
                  <td style={{ ...TD_S(false), textAlign:'center', fontVariantNumeric:'tabular-nums' }}>{f.dias}{f.totalHE>0 && <span style={{ fontSize:'.68rem', color:T.textMid }}> +{f.totalHE}HE</span>}</td>
                  <td style={{ ...TD_S(false), textAlign:'right', fontFamily:'monospace', fontVariantNumeric:'tabular-nums' }}>Q {fmtQ(f.devengado)}</td>
                  <td style={{ ...TD_S(false), textAlign:'right', fontFamily:'monospace', color:T.secondary, fontVariantNumeric:'tabular-nums' }}>{f.pagado>0 ? `Q ${fmtQ(f.pagado)}` : '—'}</td>
                  <td style={{ ...TD_S(false), textAlign:'right', fontFamily:'monospace', fontWeight:700, fontVariantNumeric:'tabular-nums',
                    color: f.saldo > 0.5 ? T.warn : f.saldo < -0.5 ? T.danger : T.textMid }}>
                    {f.saldo < -0.5
                      ? <>Q {fmtQ(Math.abs(f.saldo))}<div style={{ fontSize:'.62rem', fontWeight:600 }}>de más</div></>
                      : `Q ${fmtQ(f.pendiente)}`}
                  </td>
                  <td style={{ ...TD_S(false), textAlign:'center' }}>{badge(f.estado)}</td>
                  <td style={TD_S(false)}>
                    {puede
                      ? <button onClick={()=>setPagarModal(f)} disabled={pagando} style={{ padding:'6px 14px', background:T.secondary, color:T.white, border:'none', borderRadius:5, fontWeight:700, fontSize:'.74rem', cursor:'pointer' }}>Pagar</button>
                      : f.estado==='sinsalario'
                        ? <span style={{ fontSize:'.72rem', color:T.danger }}>Configurar salario</span>
                        : <span style={{ fontSize:'.72rem', color:T.textMid }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Barra fija de pago múltiple */}
      {seleccionadas.length > 0 && (
        <div style={{ position:'fixed', left:0, right:0, bottom:0, background:T.primary, color:'#fff', padding:'13px clamp(16px,4vw,40px)', display:'flex', alignItems:'center', gap:14, boxShadow:'0 -4px 16px rgba(0,0,0,.18)', zIndex:50 }}>
          <span style={{ fontSize:'.92rem' }}><b>{seleccionadas.length}</b> seleccionados · total <b style={{ fontVariantNumeric:'tabular-nums' }}>Q {fmtQ(totalSel)}</b></span>
          <span style={{ flex:1 }} />
          <button onClick={()=>setSel(new Set())} style={{ background:'transparent', border:'1px solid rgba(255,255,255,.4)', color:'#fff', padding:'9px 16px', borderRadius:5, fontWeight:600, fontSize:'.82rem', cursor:'pointer' }}>Quitar selección</button>
          <button onClick={()=>registrarPagos(seleccionadas)} disabled={pagando} style={{ background:'#fff', color:T.primary, border:'none', padding:'10px 20px', borderRadius:5, fontWeight:700, fontSize:'.85rem', cursor:'pointer', opacity:pagando?.5:1 }}>
            {pagando ? 'Registrando…' : `Pagar ${seleccionadas.length} →`}
          </button>
        </div>
      )}

      {pagarModal && (
        <ModalPagarSaldo fila={pagarModal} saving={pagando} onClose={()=>setPagarModal(null)} onConfirm={pagarUno} />
      )}
    </div>
  );
}

// Modal de pago: elegir completo o parcial + monto + forma + fecha
function ModalPagarSaldo({ fila, saving, onClose, onConfirm }) {
  const pend = Math.max(0, fila.pendiente);
  const [modo, setModo]   = useState('completo'); // 'completo' | 'parcial'
  const [monto, setMonto] = useState(String(pend.toFixed(2)));
  const [forma, setForma] = useState('Transferencia');
  const [fecha, setFecha] = useState(today());

  const setModoSafe = (m) => { setModo(m); if (m === 'completo') setMonto(String(pend.toFixed(2))); };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:16 }}>
      <div style={{ background:'#fff', borderRadius:10, width:'100%', maxWidth:430, boxShadow:'0 8px 32px rgba(0,0,0,.2)', overflow:'hidden' }}>
        <div style={{ background:T.primary, color:'#fff', padding:'15px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:700 }}>Registrar pago</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#fff', fontSize:'1.3rem', cursor:'pointer', opacity:.8 }}>×</button>
        </div>
        <div style={{ padding:'18px 20px' }}>
          <div style={{ fontWeight:700, color:T.primary, fontSize:'1.05rem' }}>{fila.emp.nombre}</div>
          <div style={{ fontSize:'.78rem', color:T.textMid, marginBottom:14 }}>{fila.emp.area || fila.emp.cargo || '—'}</div>

          <div style={{ background:T.bgLight, borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:'.83rem' }}>
            <Riga k="Se debe (devengado)" v={`Q ${fmtQ(fila.devengado)}`} />
            <Riga k="Ya pagado" v={`Q ${fmtQ(fila.pagado)}`} c={T.secondary} />
            <div style={{ borderTop:`1px solid ${T.border}`, marginTop:6, paddingTop:6, display:'flex', justifyContent:'space-between', fontWeight:700 }}>
              <span>Saldo pendiente</span><span style={{ fontFamily:'monospace', color:T.warn }}>Q {fmtQ(pend)}</span>
            </div>
          </div>

          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            {[['completo',`Saldo completo (Q ${fmtQ(pend)})`],['parcial','Pago parcial']].map(([k,l]) => (
              <button key={k} onClick={()=>setModoSafe(k)} style={{
                flex:1, padding:'9px 8px', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:'.78rem',
                border:`1.5px solid ${modo===k?T.primary:T.border}`, background: modo===k?'rgba(27,94,32,.08)':'#fff', color:T.primary,
              }}>{l}</button>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <label style={LS}>Monto a pagar (Q)
              <input type="number" step="0.01" value={monto} onChange={e=>setMonto(e.target.value)} disabled={modo==='completo'}
                style={{ ...IS, background: modo==='completo' ? T.bgLight : '#fff' }} />
            </label>
            <label style={LS}>Fecha de pago<input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={IS} /></label>
          </div>
          <label style={{ ...LS, marginBottom:4 }}>Forma de pago
            <div style={{ display:'flex', gap:8, marginTop:2 }}>
              {['Transferencia','Efectivo'].map(f => (
                <button key={f} onClick={()=>setForma(f)} style={{
                  flex:1, padding:'8px', borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:'.8rem',
                  border:`1.5px solid ${forma===f?T.primary:T.border}`, background: forma===f?'rgba(27,94,32,.08)':'#fff', color:T.primary,
                }}>{f}</button>
              ))}
            </div>
          </label>
        </div>
        <div style={{ padding:'14px 20px', borderTop:`1px solid ${T.border}`, display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'9px 16px', background:'#fff', border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, fontSize:'.83rem', cursor:'pointer', color:T.textMid }}>Cancelar</button>
          <button onClick={()=>onConfirm(fila, monto, forma, fecha)} disabled={saving} style={{ padding:'9px 20px', background:T.secondary, color:'#fff', border:'none', borderRadius:6, fontWeight:700, fontSize:'.83rem', cursor:'pointer', opacity:saving?.5:1 }}>
            {saving ? 'Guardando…' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Riga({ k, v, c }) {
  return <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span style={{ color:T.textMid }}>{k}</span><span style={{ fontFamily:'monospace', fontWeight:600, color:c||T.textDark }}>{v}</span></div>;
}

function Kpi({ label, val, color }) {
  return (
    <div style={{ ...card, marginBottom:0, padding:'13px 16px', borderTop:`3px solid ${color}` }}>
      <div style={{ fontSize:'.64rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:T.textMid }}>{label}</div>
      <div style={{ fontSize:'1.4rem', fontWeight:800, marginTop:2, color, fontVariantNumeric:'tabular-nums' }}>{val}</div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id:'balance',         label:'💰 Saldos y pago',   Component:TabBalancePagos   },
  { id:'empleados',       label:'👥 Empleados',      Component:TabEmpleados      },
  { id:'anticipos',       label:'💵 Anticipos',       Component:TabAnticipos      },
  { id:'pagos-semanales', label:'💳 Pagos',           Component:TabPagosSemanales },
  { id:'nomina',          label:'👷 Nómina Período',  Component:TabNomina         },
  { id:'estado-cuenta',   label:'📋 Estado de Cuenta',Component:TabEstadoCuenta  },
];

export default function Personal() {
  const [tab, setTab] = useState('balance');
  const Active = TABS.find(t => t.id === tab).Component;

  return (
    <div style={{ fontFamily:'inherit', maxWidth:1100 }}>
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontSize:'1.45rem', fontWeight:800, color:T.primary, margin:0 }}>Personal</h1>
        <p style={{ fontSize:'.83rem', color:T.textMid, marginTop:4 }}>Anticipos y pagos semanales — asistencia tomada de Control de Lavado de Manos (AL)</p>
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'8px 20px', borderRadius:100, fontWeight:700, fontSize:'.83rem', cursor:'pointer',
            border:`1.5px solid ${tab === t.id ? T.primary : T.border}`,
            background: tab === t.id ? T.primary : T.white,
            color: tab === t.id ? T.white : T.textMid,
          }}>{t.label}</button>
        ))}
      </div>
      <Active />
    </div>
  );
}
