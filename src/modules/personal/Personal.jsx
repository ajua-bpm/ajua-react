import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF',warn:'#e67e22' };
const today = () => new Date().toISOString().slice(0,10);
const nowTime = () => new Date().toTimeString().slice(0,5);

// ─── EMPLEADOS TAB ───────────────────────────────────────────────────────────
function TabEmpleados() {
  const toast = useToast();
  const { data, loading } = useCollection('empleados', { orderField:'nombre', limit:200 });
  const { add, update, remove, saving } = useWrite('empleados');
  const BLANK = { nombre:'', cargo:'', dpi:'', telefono:'', salario:'', fechaIngreso:'', activo:true };
  const [form, setForm] = useState({ ...BLANK });
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');

  const handleSave = async () => {
    if (!form.nombre) { toast('⚠ Nombre requerido','error'); return; }
    const doc = { ...form, salario:parseFloat(form.salario)||0 };
    if (editId) { await update(editId, doc); toast('✓ Empleado actualizado'); setEditId(null); }
    else { await add(doc); toast('✓ Empleado agregado'); }
    setForm({ ...BLANK });
  };

  const startEdit = (r) => {
    setForm({ nombre:r.nombre||'', cargo:r.cargo||'', dpi:r.dpi||'', telefono:r.telefono||'',
      salario:String(r.salario||''), fechaIngreso:r.fechaIngreso||'', activo:r.activo!==false });
    setEditId(r.id);
  };

  if (loading) return <LoadingSpinner/>;

  const filtered = data.filter(r=>!search||r.nombre?.toLowerCase().includes(search.toLowerCase()));
  const activos = data.filter(r=>r.activo!==false).length;

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:12,marginBottom:20}}>
        {[{label:'Empleados activos',val:activos,color:C.acc},{label:'Total empleados',val:data.length,color:C.green}].map(({label,val,color})=>(
          <div key={label} style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:16,textAlign:'center'}}>
            <div style={{fontSize:'1.8rem',fontWeight:800,color}}>{val}</div>
            <div style={{fontSize:'.75rem',color:'#6B8070',marginTop:2}}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:16}}>{editId?'Editar':'Nuevo empleado'}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:12}}>
          {[['nombre','Nombre *'],['cargo','Cargo / Puesto'],['dpi','DPI'],['telefono','Teléfono']].map(([id,label])=>(
            <label key={id} style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              {label}<input value={form[id]} onChange={e=>setForm(f=>({...f,[id]:e.target.value}))}
                style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
            </label>
          ))}
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Salario (Q/mes)
            <input type="number" min="0" value={form.salario} onChange={e=>setForm(f=>({...f,salario:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Fecha ingreso
            <input type="date" value={form.fechaIngreso} onChange={e=>setForm(f=>({...f,fechaIngreso:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Estado
            <select value={String(form.activo)} onChange={e=>setForm(f=>({...f,activo:e.target.value==='true'}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              <option value="true">✓ Activo</option>
              <option value="false">✗ Inactivo</option>
            </select>
          </label>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={handleSave} disabled={saving}
            style={{padding:'11px 24px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,cursor:saving?'not-allowed':'pointer'}}>
            {saving?'Guardando...':editId?'Actualizar':'Agregar'}
          </button>
          {editId&&<button onClick={()=>{setEditId(null);setForm({...BLANK});}} style={{padding:'11px 18px',background:'#f0f0f0',border:'none',borderRadius:6,fontWeight:600,cursor:'pointer'}}>Cancelar</button>}
        </div>
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontWeight:700,color:C.green}}>Lista ({filtered.length})</div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..."
            style={{padding:'7px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',width:180}}/>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Nombre','Cargo','DPI','Teléfono','Salario','Ingreso','Estado','Acciones'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`,opacity:r.activo===false?0.6:1}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.nombre}</td>
                  <td style={{padding:'7px 10px'}}>{r.cargo||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.dpi||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.telefono||'—'}</td>
                  <td style={{padding:'7px 10px',fontWeight:600}}>Q {(r.salario||0).toLocaleString()}</td>
                  <td style={{padding:'7px 10px'}}>{r.fechaIngreso||'—'}</td>
                  <td style={{padding:'7px 10px'}}>
                    <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,
                      background:r.activo!==false?'rgba(74,158,106,.15)':'rgba(192,57,43,.1)',
                      color:r.activo!==false?C.acc:C.danger}}>
                      {r.activo!==false?'Activo':'Inactivo'}
                    </span>
                  </td>
                  <td style={{padding:'7px 10px'}}>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>startEdit(r)} style={{padding:'3px 10px',background:C.acc,color:'#fff',border:'none',borderRadius:4,fontSize:'.72rem',cursor:'pointer'}}>Editar</button>
                      <button onClick={async()=>{if(confirm('¿Eliminar?'))await remove(r.id);}} style={{padding:'3px 10px',background:C.danger,color:'#fff',border:'none',borderRadius:4,fontSize:'.72rem',cursor:'pointer'}}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── ASISTENCIA TAB ──────────────────────────────────────────────────────────
function TabAsistencia() {
  const toast = useToast();
  const { data: empList, loading: lEmp } = useCollection('empleados', { orderField:'nombre', limit:200 });
  const { data: asistencias, loading: lAs } = useCollection('asistencia', { orderField:'fecha', orderDir:'desc', limit:500 });
  const { add, update, saving } = useWrite('asistencia');
  const [fecha, setFecha] = useState(today());

  const hoy = asistencias.filter(a => a.fecha === fecha);
  const presentes = hoy.filter(a => a.estado === 'presente');

  const getAsistencia = (empId) => hoy.find(a => a.empleadoId === empId);

  const marcar = async (emp, estado) => {
    const existing = getAsistencia(emp.id);
    if (existing) {
      await update(existing.id, { estado, horaEntrada: estado==='presente'?(existing.horaEntrada||nowTime()):null });
      toast(`✓ ${emp.nombre} → ${estado}`);
    } else {
      await add({ empleadoId:emp.id, empleado:emp.nombre, fecha, estado, horaEntrada:estado==='presente'?nowTime():null, horaSalida:null });
      toast(`✓ ${emp.nombre} → ${estado}`);
    }
  };

  const registrarSalida = async (emp) => {
    const existing = getAsistencia(emp.id);
    if (existing) { await update(existing.id, { horaSalida:nowTime() }); toast(`✓ Salida ${emp.nombre}`); }
    else await marcar(emp, 'presente');
  };

  if (lEmp || lAs) return <LoadingSpinner/>;

  const activos = (empList||[]).filter(e => e.activo !== false);

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20,flexWrap:'wrap'}}>
        <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
          Fecha
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
            style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
        </label>
        <div style={{background:'rgba(74,158,106,.1)',border:`1px solid ${C.acc}`,borderRadius:6,padding:'8px 16px',fontSize:'.85rem',fontWeight:700,color:C.green}}>
          ✓ Presentes: {presentes.length} / {activos.length}
        </div>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {activos.map(emp => {
          const as = getAsistencia(emp.id);
          const estado = as?.estado || 'pendiente';
          const colors = { presente:C.acc, ausente:C.danger, permiso:C.warn, pendiente:'#ccc' };
          return (
            <div key={emp.id} style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:'12px 16px',
              display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:120}}>
                <div style={{fontWeight:700,fontSize:'.9rem'}}>{emp.nombre}</div>
                <div style={{fontSize:'.75rem',color:'#6B8070'}}>{emp.cargo||'—'}</div>
              </div>
              {as?.horaEntrada && <div style={{fontSize:'.78rem',color:'#6B8070'}}>Entrada: {as.horaEntrada}</div>}
              {as?.horaSalida && <div style={{fontSize:'.78rem',color:'#6B8070'}}>Salida: {as.horaSalida}</div>}
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {['presente','ausente','permiso'].map(e=>(
                  <button key={e} onClick={()=>marcar(emp,e)} disabled={saving} style={{
                    padding:'5px 12px',borderRadius:4,fontSize:'.75rem',fontWeight:600,cursor:'pointer',
                    border:`1.5px solid ${estado===e?colors[e]:C.sand}`,
                    background:estado===e?colors[e]:'#fff',
                    color:estado===e?'#fff':'#555',
                  }}>{e.charAt(0).toUpperCase()+e.slice(1)}</button>
                ))}
                {estado==='presente'&&!as?.horaSalida&&(
                  <button onClick={()=>registrarSalida(emp)} disabled={saving} style={{
                    padding:'5px 12px',borderRadius:4,fontSize:'.75rem',fontWeight:600,cursor:'pointer',
                    border:`1.5px solid #2980b9`,background:'#2980b9',color:'#fff',
                  }}>Registrar salida</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ANTICIPOS PERSONAL TAB ──────────────────────────────────────────────────
function TabAnticipos() {
  const toast = useToast();
  const { data, loading } = useCollection('perAnticipo', { orderField:'fecha', orderDir:'desc', limit:300 });
  const { data: empList } = useCollection('empleados', { orderField:'nombre', limit:200 });
  const { add, update, saving } = useWrite('perAnticipo');
  const [form, setForm] = useState({ empleado:'', fecha:today(), monto:'', motivo:'', estado:'pendiente' });
  const [editId, setEditId] = useState(null);

  const handleSave = async () => {
    if (!form.empleado || !form.monto) { toast('⚠ Empleado y monto requeridos','error'); return; }
    const doc = { ...form, monto:parseFloat(form.monto)||0 };
    if (editId) { await update(editId, doc); toast('✓ Actualizado'); setEditId(null); }
    else { await add(doc); toast('✓ Anticipo registrado'); }
    setForm({ empleado:'', fecha:today(), monto:'', motivo:'', estado:'pendiente' });
  };

  const startEdit = (r) => {
    setForm({ empleado:r.empleado||'', fecha:r.fecha||today(), monto:String(r.monto||''), motivo:r.motivo||'', estado:r.estado||'pendiente' });
    setEditId(r.id);
  };

  const cambiarEstado = async (id, estado) => { await update(id, { estado }); toast(`✓ Estado → ${estado}`); };

  if (loading) return <LoadingSpinner/>;

  const pendientesTotal = data.filter(r=>r.estado==='pendiente').reduce((s,r)=>s+(r.monto||0),0);

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
        {[
          {label:'Pendiente de descuento',val:`Q ${pendientesTotal.toFixed(2)}`,color:C.warn},
          {label:'Total anticipos',val:data.length,color:C.green},
        ].map(({label,val,color})=>(
          <div key={label} style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:16,textAlign:'center'}}>
            <div style={{fontSize:'1.4rem',fontWeight:800,color}}>{val}</div>
            <div style={{fontSize:'.75rem',color:'#6B8070',marginTop:2}}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:16}}>{editId?'Editar':'Nuevo anticipo'}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:12}}>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Empleado
            <select value={form.empleado} onChange={e=>setForm(f=>({...f,empleado:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              <option value="">— Seleccionar —</option>
              {(empList||[]).filter(e=>e.activo!==false).map(e=><option key={e.id} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Fecha <input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Monto (Q)
            <input type="number" min="0" value={form.monto} onChange={e=>setForm(f=>({...f,monto:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Motivo <input value={form.motivo} onChange={e=>setForm(f=>({...f,motivo:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Estado
            <select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              <option value="pendiente">⏳ Pendiente</option>
              <option value="descontado">✓ Descontado</option>
              <option value="cancelado">✗ Cancelado</option>
            </select>
          </label>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={handleSave} disabled={saving}
            style={{padding:'11px 24px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,cursor:saving?'not-allowed':'pointer'}}>
            {saving?'Guardando...':editId?'Actualizar':'Registrar'}
          </button>
          {editId&&<button onClick={()=>{setEditId(null);setForm({empleado:'',fecha:today(),monto:'',motivo:'',estado:'pendiente'});}}
            style={{padding:'11px 18px',background:'#f0f0f0',border:'none',borderRadius:6,fontWeight:600,cursor:'pointer'}}>Cancelar</button>}
        </div>
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{fontWeight:700,marginBottom:12,color:C.green}}>Historial ({data.length})</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Empleado','Fecha','Monto','Motivo','Estado','Acciones'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.slice(0,60).map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.empleado}</td>
                  <td style={{padding:'7px 10px'}}>{r.fecha}</td>
                  <td style={{padding:'7px 10px',fontWeight:700,color:C.warn}}>Q {(r.monto||0).toFixed(2)}</td>
                  <td style={{padding:'7px 10px'}}>{r.motivo||'—'}</td>
                  <td style={{padding:'7px 10px'}}>
                    <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,
                      background:r.estado==='descontado'?'rgba(74,158,106,.15)':r.estado==='cancelado'?'rgba(192,57,43,.1)':'rgba(230,126,34,.12)',
                      color:r.estado==='descontado'?C.acc:r.estado==='cancelado'?C.danger:C.warn}}>
                      {r.estado==='descontado'?'✓ Descontado':r.estado==='cancelado'?'✗ Cancelado':'⏳ Pendiente'}
                    </span>
                  </td>
                  <td style={{padding:'7px 10px'}}>
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={()=>startEdit(r)} style={{padding:'3px 8px',background:C.acc,color:'#fff',border:'none',borderRadius:3,fontSize:'.7rem',cursor:'pointer'}}>Editar</button>
                      {r.estado==='pendiente'&&<button onClick={()=>cambiarEstado(r.id,'descontado')} style={{padding:'3px 8px',background:C.green,color:'#fff',border:'none',borderRadius:3,fontSize:'.7rem',cursor:'pointer'}}>Descontar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
const TABS = [
  { id:'empleados',  label:'👥 Empleados',  Component: TabEmpleados  },
  { id:'asistencia', label:'📅 Asistencia', Component: TabAsistencia },
  { id:'anticipos',  label:'💵 Anticipos',  Component: TabAnticipos  },
];

export default function Personal() {
  const [tab, setTab] = useState('empleados');
  const Active = TABS.find(t=>t.id===tab).Component;

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>👥 Personal</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:16}}>Gestión de empleados, asistencia y anticipos</p>

      <div style={{display:'flex',gap:4,marginBottom:20,borderBottom:`2px solid ${C.sand}`}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'9px 18px',border:'none',borderRadius:'6px 6px 0 0',fontWeight:700,fontSize:'.82rem',cursor:'pointer',
            background:tab===t.id?C.green:'transparent',
            color:tab===t.id?'#fff':'#6B8070',
            marginBottom:tab===t.id?'-2px':0,
          }}>{t.label}</button>
        ))}
      </div>

      <Active/>
    </div>
  );
}
