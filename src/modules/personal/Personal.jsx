import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  primary:   '#1B5E20',
  secondary: '#2E7D32',
  white:     '#FFFFFF',
  bgLight:   '#F5F5F5',
  border:    '#E0E0E0',
  textDark:  '#212121',
  textMid:   '#616161',
  danger:    '#C62828',
  warn:      '#E65100',
};

const card = { background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:20, marginBottom:20 };
const TH_S = { padding:'10px 14px', fontSize:'.75rem', textTransform:'uppercase', fontWeight:700, letterSpacing:'.06em', color:T.white, background:T.primary, textAlign:'left', whiteSpace:'nowrap' };
const TD_S = (alt) => ({ padding:'9px 14px', fontSize:'.83rem', borderBottom:'1px solid #F0F0F0', background:alt?'#F9FBF9':'#fff', color:T.textDark });
const LS   = { display:'flex', flexDirection:'column', gap:5, fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.secondary };
const IS   = { padding:'9px 12px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.85rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2, color:T.textDark, background:T.white };

const today   = () => new Date().toISOString().slice(0,10);
const nowTime = () => new Date().toTimeString().slice(0,5);

// ─── TAB 1: EMPLEADOS ───────────────────────────────────────────────────────
function TabEmpleados() {
  const toast = useToast();
  const { data, loading } = useCollection('empleados', { orderField:'nombre', limit:200 });
  const { add, update, remove, saving } = useWrite('empleados');

  const BLANK = { nombre:'', cargo:'', dpi:'', telefono:'', salarioDia:'', fechaIngreso:'', activo:true };
  const [form, setForm]   = useState({ ...BLANK });
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');

  const handleSave = async () => {
    if (!form.nombre) { toast('Nombre es requerido','error'); return; }
    const payload = { ...form, salarioDia:parseFloat(form.salarioDia)||0 };
    if (editId) { await update(editId,payload); toast('Empleado actualizado'); setEditId(null); }
    else { await add(payload); toast('Empleado agregado'); }
    setForm({ ...BLANK });
  };

  const startEdit = r => {
    setForm({ nombre:r.nombre||'', cargo:r.cargo||'', dpi:r.dpi||'', telefono:r.telefono||'',
      salarioDia:String(r.salarioDia||''), fechaIngreso:r.fechaIngreso||'', activo:r.activo!==false });
    setEditId(r.id);
  };

  if (loading) return <Skeleton rows={6}/>;

  const filtered      = data.filter(r=>!search||r.nombre?.toLowerCase().includes(search.toLowerCase()));
  const activos       = data.filter(r=>r.activo!==false);
  const nominaSemanal = activos.reduce((s,r)=>s+(r.salarioDia||0)*6, 0);

  return (
    <div>
      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:22 }}>
        {[
          { label:'Total activos',     val:activos.length, color:T.primary   },
          { label:'Nómina semanal est.', val:`Q ${nominaSemanal.toLocaleString('es-GT',{minimumFractionDigits:2})}`, color:T.secondary },
          { label:'Total empleados',   val:data.length,    color:T.textMid   },
        ].map(({label,val,color})=>(
          <div key={label} style={{ ...card, marginBottom:0, padding:'16px 20px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:'1.35rem', fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.primary, marginBottom:18, borderBottom:`2px solid ${T.primary}`, paddingBottom:8 }}>
          {editId ? 'Editar Empleado' : 'Nuevo Empleado'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:14, marginBottom:14 }}>
          <label style={LS}>Nombre *<input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} style={IS}/></label>
          <label style={LS}>Cargo / Puesto<input value={form.cargo} onChange={e=>setForm(f=>({...f,cargo:e.target.value}))} style={IS}/></label>
          <label style={LS}>DPI<input value={form.dpi} onChange={e=>setForm(f=>({...f,dpi:e.target.value}))} style={IS}/></label>
          <label style={LS}>Teléfono<input value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))} style={IS}/></label>
          <label style={LS}>Salario/día (Q)<input type="number" min="0" step="0.01" value={form.salarioDia} onChange={e=>setForm(f=>({...f,salarioDia:e.target.value}))} style={IS}/></label>
          <label style={LS}>Fecha ingreso<input type="date" value={form.fechaIngreso} onChange={e=>setForm(f=>({...f,fechaIngreso:e.target.value}))} style={IS}/></label>
          <label style={LS}>
            Estado
            <select value={String(form.activo)} onChange={e=>setForm(f=>({...f,activo:e.target.value==='true'}))} style={IS}>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </label>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={handleSave} disabled={saving} style={{ padding:'11px 28px', background:saving?'#9E9E9E':T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, cursor:saving?'not-allowed':'pointer' }}>
            {saving?'Guardando...':editId?'Actualizar':'Agregar'}
          </button>
          {editId && <button onClick={()=>{setEditId(null);setForm({...BLANK});}} style={{ padding:'11px 20px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, cursor:'pointer', color:T.textMid }}>Cancelar</button>}
        </div>
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary }}>Lista ({filtered.length})</div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar empleado..."
            style={{ ...IS, width:200, marginTop:0 }}/>
        </div>
        {filtered.length===0 ? <div style={{ textAlign:'center', padding:'40px 0', color:T.textMid }}>Sin empleados</div> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['Nombre','Cargo','DPI','Teléfono','Salario/día','Ingreso','Estado','Acciones'].map(h=><th key={h} style={TH_S}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((r,i)=>(
                  <tr key={r.id} style={{ opacity:r.activo===false?0.65:1 }}>
                    <td style={{ ...TD_S(i%2===1), fontWeight:600 }}>{r.nombre}</td>
                    <td style={TD_S(i%2===1)}>{r.cargo||'—'}</td>
                    <td style={TD_S(i%2===1)}>{r.dpi||'—'}</td>
                    <td style={TD_S(i%2===1)}>{r.telefono||'—'}</td>
                    <td style={{ ...TD_S(i%2===1), fontWeight:600 }}>Q {(r.salarioDia||0).toFixed(2)}</td>
                    <td style={TD_S(i%2===1)}>{r.fechaIngreso||'—'}</td>
                    <td style={TD_S(i%2===1)}>
                      <span style={{ display:'inline-block', padding:'3px 9px', borderRadius:100, fontSize:'.7rem', fontWeight:700,
                        background:r.activo!==false?'rgba(46,125,50,.12)':'rgba(198,40,40,.10)',
                        color:r.activo!==false?T.secondary:T.danger }}>
                        {r.activo!==false?'Activo':'Inactivo'}
                      </span>
                    </td>
                    <td style={TD_S(i%2===1)}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>startEdit(r)} style={{ padding:'3px 9px', background:T.primary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Editar</button>
                        <button onClick={async()=>{if(confirm('¿Eliminar?'))await remove(r.id);}} style={{ padding:'3px 9px', background:T.danger, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAB 2: ASISTENCIA ──────────────────────────────────────────────────────
function TabAsistencia() {
  const toast = useToast();
  const { data: empCol, loading:lEmpCol } = useCollection('empleados', { orderField:'nombre', limit:200 });
  const { empleados: empMain, loading:lEmpMain } = useEmpleados();
  const { data: asistencias, loading:lAs } = useCollection('asistencia', { orderField:'fecha', orderDir:'desc', limit:600 });
  const { add, update, saving } = useWrite('asistencia');
  const [fecha, setFecha] = useState(today());

  // Merge both sources, dedup by nombre
  const allEmpleados = useMemo(() => {
    const seen = new Set();
    const merged = [];
    [...(empCol||[]), ...(empMain||[])].forEach(e => {
      const key = (e.nombre||'').toLowerCase().trim();
      if (!seen.has(key) && e.nombre) { seen.add(key); merged.push(e); }
    });
    return merged.filter(e => e.activo !== false).sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
  }, [empCol, empMain]);

  const hoy      = asistencias.filter(a => a.fecha === fecha);
  const presentes = hoy.filter(a => a.estado === 'presente').length;

  const getAs = empId => hoy.find(a => a.empleadoId === empId);

  const marcar = async (emp, estado) => {
    const existing = getAs(emp.id);
    if (existing) {
      await update(existing.id, { estado, horaEntrada:estado==='presente'?(existing.horaEntrada||nowTime()):null });
    } else {
      await add({ empleadoId:emp.id, empleado:emp.nombre, fecha, estado, horaEntrada:estado==='presente'?nowTime():null, horaSalida:null });
    }
    toast(`${emp.nombre} → ${estado}`);
  };

  const registrarSalida = async (emp) => {
    const existing = getAs(emp.id);
    if (existing) { await update(existing.id, { horaSalida:nowTime() }); toast(`Salida registrada: ${emp.nombre}`); }
    else { await marcar(emp,'presente'); }
  };

  if (lEmpCol||lEmpMain||lAs) return <Skeleton rows={6}/>;

  const EST_COLORS = { presente:T.secondary, ausente:T.danger, permiso:T.warn, pendiente:'#BDBDBD' };

  return (
    <div>
      {/* Date + counter */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20, flexWrap:'wrap' }}>
        <label style={LS}>
          Fecha
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{ ...IS, width:170 }}/>
        </label>
        <div style={{ background:`rgba(46,125,50,.10)`, border:`1.5px solid ${T.secondary}`, borderRadius:8, padding:'10px 20px' }}>
          <span style={{ fontSize:'.83rem', fontWeight:700, color:T.primary }}>
            Presentes: {presentes} / {allEmpleados.length}
          </span>
        </div>
      </div>

      {allEmpleados.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px 0', color:T.textMid }}>Sin empleados activos registrados</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {allEmpleados.map(emp => {
            const as     = getAs(emp.id);
            const estado = as?.estado || 'pendiente';
            return (
              <div key={emp.id} style={{ ...card, marginBottom:0, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:130 }}>
                  <div style={{ fontWeight:700, fontSize:'.9rem', color:T.textDark }}>{emp.nombre}</div>
                  <div style={{ fontSize:'.76rem', color:T.textMid }}>{emp.cargo||'—'}</div>
                </div>
                {as?.horaEntrada && <div style={{ fontSize:'.78rem', color:T.textMid }}>Entrada: <strong>{as.horaEntrada}</strong></div>}
                {as?.horaSalida  && <div style={{ fontSize:'.78rem', color:T.textMid }}>Salida: <strong>{as.horaSalida}</strong></div>}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {['presente','ausente','permiso'].map(e=>(
                    <button key={e} onClick={()=>marcar(emp,e)} disabled={saving} style={{
                      padding:'6px 14px', borderRadius:6, fontSize:'.78rem', fontWeight:700, cursor:'pointer',
                      border:`1.5px solid ${estado===e?EST_COLORS[e]:T.border}`,
                      background:estado===e?EST_COLORS[e]:T.white,
                      color:estado===e?T.white:T.textMid,
                      textTransform:'capitalize',
                    }}>{e.charAt(0).toUpperCase()+e.slice(1)}</button>
                  ))}
                  {estado==='presente'&&!as?.horaSalida && (
                    <button onClick={()=>registrarSalida(emp)} disabled={saving} style={{ padding:'6px 14px', borderRadius:6, fontSize:'.78rem', fontWeight:700, cursor:'pointer', border:`1.5px solid #1565C0`, background:'#1565C0', color:T.white }}>
                      Registrar salida
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── TAB 3: ANTICIPOS PERSONAL ──────────────────────────────────────────────
function TabAnticipos() {
  const toast = useToast();
  const { data, loading }         = useCollection('perAnticipo', { orderField:'fecha', orderDir:'desc', limit:300 });
  const { data: empCol }          = useCollection('empleados', { orderField:'nombre', limit:200 });
  const { empleados: empMain }    = useEmpleados();
  const { add, update, saving }   = useWrite('perAnticipo');

  const [form, setForm]   = useState({ empleado:'', fecha:today(), monto:'', motivo:'', estado:'pendiente' });
  const [editId, setEditId] = useState(null);

  const allEmpleados = useMemo(() => {
    const seen = new Set();
    const merged = [];
    [...(empCol||[]), ...(empMain||[])].forEach(e => {
      const key = (e.nombre||'').toLowerCase().trim();
      if (!seen.has(key) && e.nombre) { seen.add(key); merged.push(e); }
    });
    return merged.filter(e=>e.activo!==false).sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
  }, [empCol, empMain]);

  const handleSave = async () => {
    if (!form.empleado||!form.monto) { toast('Empleado y monto son requeridos','error'); return; }
    const payload = { ...form, monto:parseFloat(form.monto)||0 };
    if (editId) { await update(editId,payload); toast('Anticipo actualizado'); setEditId(null); }
    else { await add(payload); toast('Anticipo registrado'); }
    setForm({ empleado:'', fecha:today(), monto:'', motivo:'', estado:'pendiente' });
  };

  const startEdit = r => {
    setForm({ empleado:r.empleado||'', fecha:r.fecha||today(), monto:String(r.monto||''), motivo:r.motivo||'', estado:r.estado||'pendiente' });
    setEditId(r.id);
  };

  const cambiarEstado = async (id,estado) => { await update(id,{estado}); toast(`Estado actualizado`); };

  if (loading) return <Skeleton rows={5}/>;

  const totalPendiente = data.filter(r=>r.estado==='pendiente').reduce((s,r)=>s+(r.monto||0),0);

  const EST_CFG = {
    pendiente: { color:T.warn,      bg:'rgba(230,81,0,.10)',    label:'Pendiente'  },
    descontado:{ color:T.secondary, bg:'rgba(46,125,50,.12)',   label:'Descontado' },
    cancelado: { color:T.danger,    bg:'rgba(198,40,40,.10)',   label:'Cancelado'  },
  };

  return (
    <div>
      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14, marginBottom:22 }}>
        <div style={{ ...card, marginBottom:0, padding:'16px 20px', borderLeft:`4px solid ${T.warn}` }}>
          <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:6 }}>Total pendiente a descontar</div>
          <div style={{ fontSize:'1.35rem', fontWeight:800, color:T.warn }}>Q {totalPendiente.toLocaleString('es-GT',{minimumFractionDigits:2})}</div>
        </div>
        <div style={{ ...card, marginBottom:0, padding:'16px 20px' }}>
          <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:6 }}>Total anticipos</div>
          <div style={{ fontSize:'1.35rem', fontWeight:800, color:T.primary }}>{data.length}</div>
        </div>
      </div>

      {/* Form */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.primary, marginBottom:18, borderBottom:`2px solid ${T.primary}`, paddingBottom:8 }}>
          {editId ? 'Editar Anticipo' : 'Registrar Anticipo Personal'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:14, marginBottom:14 }}>
          <label style={LS}>
            Empleado *
            <select value={form.empleado} onChange={e=>setForm(f=>({...f,empleado:e.target.value}))} style={IS}>
              <option value="">— Seleccionar —</option>
              {allEmpleados.map(e=><option key={e.id||e.nombre} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </label>
          <label style={LS}>Fecha<input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} style={IS}/></label>
          <label style={LS}>Monto (Q) *<input type="number" min="0" step="0.01" value={form.monto} onChange={e=>setForm(f=>({...f,monto:e.target.value}))} style={IS}/></label>
          <label style={LS}>Motivo<input value={form.motivo} onChange={e=>setForm(f=>({...f,motivo:e.target.value}))} style={IS}/></label>
          <label style={LS}>
            Estado
            <select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))} style={IS}>
              <option value="pendiente">Pendiente</option>
              <option value="descontado">Descontado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </label>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={handleSave} disabled={saving} style={{ padding:'11px 28px', background:saving?'#9E9E9E':T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, cursor:saving?'not-allowed':'pointer' }}>
            {saving?'Guardando...':editId?'Actualizar':'Registrar'}
          </button>
          {editId && <button onClick={()=>{setEditId(null);setForm({empleado:'',fecha:today(),monto:'',motivo:'',estado:'pendiente'});}} style={{ padding:'11px 20px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, cursor:'pointer', color:T.textMid }}>Cancelar</button>}
        </div>
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary, marginBottom:16 }}>Historial ({data.length})</div>
        {data.length===0 ? <div style={{ textAlign:'center', padding:'40px 0', color:T.textMid }}>Sin anticipos registrados</div> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['Empleado','Fecha','Monto','Motivo','Estado','Acciones'].map(h=><th key={h} style={TH_S}>{h}</th>)}</tr></thead>
              <tbody>
                {data.slice(0,80).map((r,i)=>{
                  const cfg = EST_CFG[r.estado]||EST_CFG.pendiente;
                  return (
                    <tr key={r.id}>
                      <td style={{ ...TD_S(i%2===1), fontWeight:600 }}>{r.empleado||'—'}</td>
                      <td style={TD_S(i%2===1)}>{r.fecha}</td>
                      <td style={{ ...TD_S(i%2===1), fontWeight:700, color:T.warn }}>Q {(r.monto||0).toFixed(2)}</td>
                      <td style={TD_S(i%2===1)}>{r.motivo||'—'}</td>
                      <td style={TD_S(i%2===1)}>
                        <span style={{ display:'inline-block', padding:'3px 9px', borderRadius:100, fontSize:'.7rem', fontWeight:700, background:cfg.bg, color:cfg.color }}>{cfg.label}</span>
                      </td>
                      <td style={TD_S(i%2===1)}>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                          <button onClick={()=>startEdit(r)} style={{ padding:'3px 9px', background:T.primary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Editar</button>
                          {r.estado==='pendiente' && <button onClick={()=>cambiarEstado(r.id,'descontado')} style={{ padding:'3px 9px', background:T.secondary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Descontar</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
const TABS = [
  { id:'empleados',  label:'Empleados',  Component:TabEmpleados  },
  { id:'asistencia', label:'Asistencia', Component:TabAsistencia },
  { id:'anticipos',  label:'Anticipos',  Component:TabAnticipos  },
];

export default function Personal() {
  const [tab, setTab] = useState('empleados');
  const Active = TABS.find(t=>t.id===tab).Component;

  return (
    <div style={{ fontFamily:'inherit', maxWidth:1100 }}>
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontSize:'1.45rem', fontWeight:800, color:T.primary, margin:0 }}>Personal</h1>
        <p style={{ fontSize:'.83rem', color:T.textMid, marginTop:4 }}>Gestión de empleados, asistencia y anticipos</p>
      </div>

      {/* Pill tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'8px 20px', borderRadius:100, fontWeight:700, fontSize:'.83rem', cursor:'pointer',
            border:`1.5px solid ${tab===t.id?T.primary:T.border}`,
            background:tab===t.id?T.primary:T.white,
            color:tab===t.id?T.white:T.textMid,
          }}>{t.label}</button>
        ))}
      </div>

      <Active/>
    </div>
  );
}
