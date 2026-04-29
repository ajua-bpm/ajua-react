import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

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
const fmtQ   = n => Number(n||0).toLocaleString('es-GT', { minimumFractionDigits:2 });

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

  // ── Calcular anticipos pendientes para el empleado seleccionado ──
  const anticPendientes = useMemo(() => {
    if (!form.empleado) return [];
    return anticData.filter(a => a.empleado === form.empleado && a.estado === 'pendiente');
  }, [form.empleado, anticData]);

  const totalAnticPend = anticPendientes.reduce((s,a) => s+(a.monto||0), 0);

  // ── Calcular días presentes en AL para la semana seleccionada ──
  const diasPresentes = useMemo(() => {
    if (!form.empleado || !form.semana) return { dias:0, detalle:[] };
    const lunes  = form.semana;
    const domingo = weekEnd(lunes);
    // Registros AL de esa semana
    const semRecs = alData.filter(r => r.fecha >= lunes && r.fecha <= domingo);
    const diasSet = new Set();
    semRecs.forEach(r => {
      (r.checks||[]).forEach(ch => {
        // Buscar por nombre (normalizado) o empleadoId
        const empNombre = (ch.nombre||'').toLowerCase().trim();
        const formNombre = form.empleado.toLowerCase().trim();
        if (empNombre === formNombre) {
          const tieneHoras = ch.horas && Object.values(ch.horas).some(v => v);
          if (tieneHoras) diasSet.add(r.fecha);
        }
      });
    });
    return { dias: diasSet.size, detalle: [...diasSet].sort() };
  }, [form.empleado, form.semana, alData]);

  // ── Salario del empleado seleccionado ──
  const empSeleccionado = activos.find(e => e.nombre === form.empleado);
  const salarioDia = empSeleccionado?.salarioDia || 0;

  // ── Monto sugerido ──
  const montoBase     = diasPresentes.dias * salarioDia;
  const montoSugerido = Math.max(0, montoBase - totalAnticPend);

  // Auto-llenar monto cuando cambia empleado o semana
  useEffect(() => {
    if (!editId && montoBase > 0) {
      setForm(f => ({ ...f, monto: String(montoSugerido.toFixed(2)) }));
    }
  }, [montoBase, montoSugerido, form.empleado, form.semana]);

  const handleSave = async () => {
    if (!form.empleado || !form.monto) { toast('Empleado y monto son requeridos', 'error'); return; }
    const payload = {
      ...form,
      monto:           parseFloat(form.monto)||0,
      diasAL:          diasPresentes.dias,
      fechasTrabajadas: diasPresentes.detalle,
      salarioDia,
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

              {/* Salario/día */}
              <div>
                <div style={{ fontSize:'.72rem', fontWeight:700, color:T.textMid, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>
                  Salario por día
                </div>
                <div style={{ fontSize:'1.1rem', fontWeight:700, color:T.textDark }}>
                  {salarioDia > 0 ? `Q ${fmtQ(salarioDia)}` : <span style={{ color:T.danger, fontSize:'.82rem' }}>No configurado en Admin</span>}
                </div>
              </div>

              {/* Base calculada */}
              <div>
                <div style={{ fontSize:'.72rem', fontWeight:700, color:T.textMid, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>
                  Base ({diasPresentes.dias} × Q{fmtQ(salarioDia)})
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
                          <div style={{ fontWeight:800, fontSize:'1rem', color: (r.diasAL||0)>0 ? T.secondary : T.textMid, marginBottom: fechas.length?4:0 }}>{r.diasAL ?? '—'}</div>
                          {fechas.length > 0 && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                              {fechas.map(f => (
                                <span key={f} style={{ background:'#E8F5E9', color:T.secondary, border:`1px solid #A5D6A7`, borderRadius:4, padding:'1px 6px', fontSize:'.68rem', fontWeight:700, whiteSpace:'nowrap' }}>
                                  {fmtFecha(f)}
                                </span>
                              ))}
                            </div>
                          )}
                          {fechas.length === 0 && r.diasAL > 0 && (
                            <div style={{ fontSize:'.68rem', color:T.textMid }}>fechas no guardadas</div>
                          )}
                        </td>
                        <td style={{ ...TD_S(i%2===1), fontWeight:600, color:T.secondary }}>Q {fmtQ((r.diasAL||0)*(r.salarioDia||0))}</td>
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

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id:'empleados',       label:'Empleados',       Component:TabEmpleados      },
  { id:'anticipos',       label:'Anticipos',        Component:TabAnticipos      },
  { id:'pagos-semanales', label:'Pagos Semanales',  Component:TabPagosSemanales },
];

export default function Personal() {
  const [tab, setTab] = useState('pagos-semanales');
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
