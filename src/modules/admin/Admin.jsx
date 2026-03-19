import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useAuth } from '../../hooks/useAuth';
import { db, doc, getDoc, setDoc, collection, addDoc } from '../../firebase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28', acc:'#4A9E6A', sand:'#E8DCC8', danger:'#c0392b', bg:'#F9F6EF' };
const LS = { display:'flex',flexDirection:'column',gap:3,fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',color:'#4A9E6A',letterSpacing:'.06em' };
const IS = { padding:'8px 10px',border:'1.5px solid #E8DCC8',borderRadius:4,fontSize:'.83rem',outline:'none',fontFamily:'inherit',width:'100%',marginTop:2 };

function CrudTable({ saving, onAdd, form, setForm, fields, data, cols, row, onDelete }) {
  return (
    <div>
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:16}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:10}}>
          {fields.map(({id,label,type='text'})=>(
            <label key={id} style={LS}>
              {label}
              <input type={type} value={form[id]||''} onChange={e=>setForm(f=>({...f,[id]:e.target.value}))} style={IS}/>
            </label>
          ))}
        </div>
        <button onClick={onAdd} disabled={saving} style={{padding:'10px 24px',background:saving?'#ccc':C.acc,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.85rem',cursor:saving?'not-allowed':'pointer'}}>
          + Agregar
        </button>
      </div>
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {[...cols,''].map((h,i)=>(
                <th key={i} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  {row(r).map((v,i)=><td key={i} style={{padding:'7px 10px',fontWeight:i===0?600:400,color:i===0?C.green:'#6B8070'}}>{v}</td>)}
                  <td style={{padding:'7px 10px'}}>
                    <button onClick={()=>onDelete(r.id)} style={{padding:'3px 10px',background:'rgba(192,57,43,.1)',color:C.danger,border:`1px solid ${C.danger}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✕</button>
                  </td>
                </tr>
              ))}
              {data.length===0&&<tr><td colSpan={cols.length+1} style={{textAlign:'center',padding:'30px',color:'#9aaa9e'}}>Sin registros</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('conductores');

  const { data: conductores, loading: lc  } = useCollection('conductores', { orderField:'nombre', limit:200 });
  const { data: clientes,   loading: lcl  } = useCollection('clientes',    { orderField:'nombre', limit:200 });
  const { data: empleados,  loading: le   } = useCollection('empleados',   { orderField:'nombre', limit:200 });

  const { add: addCond, remove: removeCond, saving: savCond } = useWrite('conductores');
  const { add: addCli,  remove: removeCli,  saving: savCli  } = useWrite('clientes');
  const { add: addEmp,  remove: removeEmp,  saving: savEmp  } = useWrite('empleados');

  const [formCond, setFormCond] = useState({ nombre:'', lic:'', tel:'', obs:'' });
  const [formCli,  setFormCli ] = useState({ nombre:'', rtu:'', tel:'', dir:'', muni:'', obs:'' });
  const [formEmp,  setFormEmp ] = useState({ nombre:'', cargo:'', tel:'', dpi:'' });

  // Usuarios (ajua_bpm/main)
  const [usuarios,  setUsuarios ] = useState([]);
  const [loadingU,  setLoadingU ] = useState(false);
  const [formU,     setFormU    ] = useState({ nombre:'', usuario:'', pass:'', rol:'operario' });
  const [savingU,   setSavingU  ] = useState(false);

  // ── Migración ──
  const [migStatus,  setMigStatus ] = useState({});
  const [migRunning, setMigRunning] = useState(false);

  const MIGRATE_COLLECTIONS = [
    { mainKey: 'tl',              col: 'tl' },
    { mainKey: 'dt',              col: 'dt' },
    { mainKey: 'al',              col: 'al' },
    { mainKey: 'bas',             col: 'bas' },
    { mainKey: 'rod',             col: 'rod' },
    { mainKey: 'fum',             col: 'fum' },
    { mainKey: 'limp',            col: 'limp' },
    { mainKey: 'vyp',             col: 'vyp' },
    { mainKey: 'gastosDiarios',   col: 'gastosDiarios' },
    { mainKey: 'pedidosWalmart',  col: 'pedidosWalmart' },
    { mainKey: 'vgtVentas',       col: 'vgtVentas' },
    { mainKey: 'vintVentas',      col: 'vintVentas' },
    { mainKey: 'gcConcursos',     col: 'gcConcursos' },
    { mainKey: 'gcDescubiertos',  col: 'gcDescubiertos' },
    { mainKey: 'iAnticipo',       col: 'iAnticipo' },
    { mainKey: 'ientradas',       col: 'ientradas' },
    { mainKey: 'isalidas',        col: 'isalidas' },
    { mainKey: 'cotizadorRapido', col: 'cotizadorRapido' },
  ];

  const runMigration = async () => {
    if (!window.confirm('¿Migrar datos de ajua_bpm/main a colecciones individuales? Esto agrega registros históricos sin borrar datos existentes.')) return;
    setMigRunning(true);
    setMigStatus({});

    try {
      const snap = await getDoc(doc(db, 'ajua_bpm', 'main'));
      if (!snap.exists()) {
        alert('No se encontró ajua_bpm/main');
        setMigRunning(false);
        return;
      }
      const mainData = snap.data();

      for (const { mainKey, col } of MIGRATE_COLLECTIONS) {
        const arr = mainData[mainKey];
        if (!Array.isArray(arr) || arr.length === 0) {
          setMigStatus(prev => ({ ...prev, [col]: { done: 0, total: 0, skip: true } }));
          continue;
        }

        setMigStatus(prev => ({ ...prev, [col]: { done: 0, total: arr.length } }));

        let done = 0;
        for (const item of arr) {
          try {
            if (!item || typeof item !== 'object') continue;
            await addDoc(collection(db, col), { ...item, _migratedFrom: 'main', _ts: new Date().toISOString() });
            done++;
            setMigStatus(prev => ({ ...prev, [col]: { done, total: arr.length } }));
          } catch (e) {
            // skip individual errors, continue
          }
        }
        setMigStatus(prev => ({ ...prev, [col]: { done, total: arr.length, complete: true } }));
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setMigRunning(false);
  };

  const cargarUsuarios = async () => {
    setLoadingU(true);
    try {
      const snap = await getDoc(doc(db,'ajua_bpm','main'));
      setUsuarios(snap.exists() ? (snap.data().usuarios||[]) : []);
    } catch(e) { toast('Error cargando usuarios: '+e.message,'error'); }
    setLoadingU(false);
  };

  const handleSaveU = async () => {
    if(!formU.nombre||!formU.usuario||!formU.pass) { toast('⚠ Nombre, usuario y clave requeridos','error'); return; }
    setSavingU(true);
    try {
      const snap = await getDoc(doc(db,'ajua_bpm','main'));
      const prev = snap.exists() ? snap.data() : {};
      const lista = prev.usuarios||[];
      if(lista.find(u=>u.usuario===formU.usuario)) { toast('⚠ Usuario ya existe','error'); setSavingU(false); return; }
      const nuevo = { ...formU, id:'u_'+Date.now() };
      await setDoc(doc(db,'ajua_bpm','main'), {...prev, usuarios:[...lista, nuevo]});
      setUsuarios([...lista, nuevo]);
      setFormU({ nombre:'', usuario:'', pass:'', rol:'operario' });
      toast('✓ Usuario agregado');
    } catch(e) { toast('Error: '+e.message,'error'); }
    setSavingU(false);
  };

  const handleDelU = async (id) => {
    if(!window.confirm('¿Eliminar usuario?')) return;
    setSavingU(true);
    try {
      const snap = await getDoc(doc(db,'ajua_bpm','main'));
      const prev = snap.exists() ? snap.data() : {};
      const nuevos = (prev.usuarios||[]).filter(u=>u.id!==id);
      await setDoc(doc(db,'ajua_bpm','main'), {...prev, usuarios:nuevos});
      setUsuarios(nuevos);
      toast('Usuario eliminado');
    } catch(e) { toast('Error: '+e.message,'error'); }
    setSavingU(false);
  };

  if(lc||lcl||le) return <LoadingSpinner/>;

  const TAB_LABELS = {
    conductores: `Conductores (${conductores.length})`,
    clientes:    `Clientes (${clientes.length})`,
    empleados:   `Empleados (${empleados.length})`,
    usuarios:    'Usuarios',
  };

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>⚙️ Administración</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:16}}>Gestión de conductores, clientes, empleados y usuarios</p>

      <div style={{background:'rgba(74,158,106,.08)',border:`1px solid rgba(74,158,106,.2)`,borderRadius:8,padding:'10px 16px',marginBottom:16,fontSize:'.82rem',color:'#2d6e47'}}>
        Sesión: <strong>{user?.nombre}</strong> · Rol: <strong>{user?.rol}</strong>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:0,marginBottom:20,border:`1px solid ${C.sand}`,borderRadius:8,overflow:'hidden',background:'#fff'}}>
        {Object.keys(TAB_LABELS).map(t=>(
          <button key={t} onClick={()=>{ setTab(t); if(t==='usuarios') cargarUsuarios(); }} style={{
            flex:1,padding:'11px 6px',border:'none',fontWeight:700,fontSize:'.75rem',cursor:'pointer',
            background:tab===t?C.green:'#fff', color:tab===t?'#fff':'#6B8070',
          }}>{TAB_LABELS[t]}</button>
        ))}
      </div>

      {tab==='conductores'&&<CrudTable
        saving={savCond} onAdd={async()=>{ if(!formCond.nombre){toast('⚠ Nombre requerido','error');return;} await addCond(formCond); toast('✓ Conductor agregado'); setFormCond({nombre:'',lic:'',tel:'',obs:''}); }}
        form={formCond} setForm={setFormCond}
        fields={[{id:'nombre',label:'Nombre *'},{id:'lic',label:'Licencia'},{id:'tel',label:'Teléfono'},{id:'obs',label:'Obs.'}]}
        data={conductores} cols={['Nombre','Licencia','Teléfono']}
        row={r=>[r.nombre,r.lic||'—',r.tel||'—']}
        onDelete={async id=>{ if(!window.confirm('¿Eliminar conductor?'))return; await removeCond(id); toast('Eliminado'); }}
      />}

      {tab==='clientes'&&<CrudTable
        saving={savCli} onAdd={async()=>{ if(!formCli.nombre){toast('⚠ Nombre requerido','error');return;} await addCli(formCli); toast('✓ Cliente agregado'); setFormCli({nombre:'',rtu:'',tel:'',dir:'',muni:'',obs:''}); }}
        form={formCli} setForm={setFormCli}
        fields={[{id:'nombre',label:'Nombre *'},{id:'rtu',label:'RTU'},{id:'tel',label:'Teléfono'},{id:'dir',label:'Dirección'},{id:'muni',label:'Municipio'}]}
        data={clientes} cols={['Nombre','RTU','Municipio','Teléfono']}
        row={r=>[r.nombre,r.rtu||'—',r.muni||'—',r.tel||'—']}
        onDelete={async id=>{ if(!window.confirm('¿Eliminar cliente?'))return; await removeCli(id); toast('Eliminado'); }}
      />}

      {tab==='empleados'&&(
        <div>
          <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:16}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:10}}>
              {[{id:'nombre',label:'Nombre *'},{id:'cargo',label:'Cargo'},{id:'tel',label:'Teléfono'},{id:'dpi',label:'DPI'}].map(({id,label})=>(
                <label key={id} style={LS}>{label}<input value={formEmp[id]||''} onChange={e=>setFormEmp(f=>({...f,[id]:e.target.value}))} style={IS}/></label>
              ))}
            </div>
            <button onClick={async()=>{ if(!formEmp.nombre){toast('⚠ Nombre requerido','error');return;} await addEmp({...formEmp,activo:true}); toast('✓ Empleado agregado'); setFormEmp({nombre:'',cargo:'',tel:'',dpi:''}); }} disabled={savEmp}
              style={{padding:'10px 24px',background:savEmp?'#ccc':C.acc,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.85rem',cursor:savEmp?'not-allowed':'pointer'}}>
              + Agregar
            </button>
          </div>
          <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
              <thead><tr style={{background:C.bg}}>
                {['Nombre','Cargo','Teléfono','Estado',''].map(h=>(
                  <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {empleados.map(r=>(
                  <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                    <td style={{padding:'7px 10px',fontWeight:600,color:C.green}}>{r.nombre}</td>
                    <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.cargo||'—'}</td>
                    <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.tel||'—'}</td>
                    <td style={{padding:'7px 10px'}}>
                      <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,background:r.activo!==false?'rgba(74,158,106,.15)':'rgba(192,57,43,.1)',color:r.activo!==false?C.acc:C.danger}}>
                        {r.activo!==false?'Activo':'Inactivo'}
                      </span>
                    </td>
                    <td style={{padding:'7px 10px'}}>
                      <button onClick={async()=>{ if(!window.confirm('¿Eliminar?'))return; await removeEmp(r.id); toast('Eliminado'); }}
                        style={{padding:'3px 10px',background:'rgba(192,57,43,.1)',color:C.danger,border:`1px solid ${C.danger}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✕</button>
                    </td>
                  </tr>
                ))}
                {empleados.length===0&&<tr><td colSpan={5} style={{textAlign:'center',padding:'30px',color:'#9aaa9e'}}>Sin empleados</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Migración ── */}
      <div style={{background:'#fff',borderRadius:8,boxShadow:'0 1px 3px rgba(0,0,0,.10)',padding:20,marginTop:20}}>
        <div style={{fontSize:'1rem',fontWeight:700,color:'#1B5E20',marginBottom:8}}>🔄 Migración de Datos desde bpm.html</div>
        <p style={{fontSize:'.83rem',color:'#6B6B60',marginBottom:14,lineHeight:1.5}}>
          Copia los registros históricos de <code>ajua_bpm/main</code> a las colecciones individuales de Firestore.
          No borra datos existentes. Se puede ejecutar varias veces (crea duplicados si ya migró).
        </p>
        <button
          onClick={runMigration}
          disabled={migRunning}
          style={{padding:'10px 24px',background:migRunning?'#BDBDBD':'#1B5E20',color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:migRunning?'not-allowed':'pointer',fontFamily:'inherit'}}
        >
          {migRunning ? '⏳ Migrando...' : '🚀 Iniciar Migración'}
        </button>

        {Object.keys(migStatus).length > 0 && (
          <div style={{marginTop:16,display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}}>
            {MIGRATE_COLLECTIONS.map(({col}) => {
              const s = migStatus[col];
              if (!s) return null;
              return (
                <div key={col} style={{padding:'8px 12px',borderRadius:6,background:s.complete?'#E8F5E9':s.skip?'#F5F5F5':'#FFF3E0',border:`1px solid ${s.complete?'#2E7D32':s.skip?'#E0E0E0':'#FFB74D'}`}}>
                  <div style={{fontSize:'.75rem',fontWeight:700,color:'#1A1A18'}}>{col}</div>
                  <div style={{fontSize:'.7rem',color:'#6B6B60'}}>
                    {s.skip ? '— vacío' : s.complete ? `✓ ${s.done}/${s.total}` : `⏳ ${s.done}/${s.total}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {tab==='usuarios'&&(
        <div>
          <div style={{background:'rgba(230,126,34,.08)',border:`1px solid rgba(230,126,34,.3)`,borderRadius:6,padding:'10px 14px',marginBottom:14,fontSize:'.8rem',color:'#c05000'}}>
            ⚠ Los usuarios se guardan en <code>ajua_bpm/main</code> — compatibles con bpm.html
          </div>
          <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:16}}>
            <div style={{fontWeight:700,color:C.green,marginBottom:12}}>Agregar Usuario</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:10}}>
              <label style={LS}>Nombre *<input value={formU.nombre} onChange={e=>setFormU(f=>({...f,nombre:e.target.value}))} style={IS}/></label>
              <label style={LS}>Usuario *<input value={formU.usuario} onChange={e=>setFormU(f=>({...f,usuario:e.target.value}))} style={IS}/></label>
              <label style={LS}>Contraseña *<input type="password" value={formU.pass} onChange={e=>setFormU(f=>({...f,pass:e.target.value}))} style={IS}/></label>
              <label style={LS}>Rol
                <select value={formU.rol} onChange={e=>setFormU(f=>({...f,rol:e.target.value}))} style={IS}>
                  <option value="operario">Operario</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>
            <button onClick={handleSaveU} disabled={savingU} style={{padding:'10px 24px',background:savingU?'#ccc':C.acc,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.85rem',cursor:savingU?'not-allowed':'pointer'}}>
              + Agregar
            </button>
          </div>
          <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
            {loadingU ? <LoadingSpinner/> : (
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
                <thead><tr style={{background:C.bg}}>
                  {['Nombre','Usuario','Rol',''].map(h=>(
                    <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {usuarios.map(u=>(
                    <tr key={u.id||u.usuario} style={{borderBottom:`1px solid ${C.sand}`}}>
                      <td style={{padding:'7px 10px',fontWeight:600,color:C.green}}>{u.nombre}</td>
                      <td style={{padding:'7px 10px',fontFamily:'monospace'}}>{u.usuario}</td>
                      <td style={{padding:'7px 10px'}}>
                        <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,background:'rgba(74,158,106,.1)',color:C.acc}}>{u.rol||'operario'}</span>
                      </td>
                      <td style={{padding:'7px 10px'}}>
                        <button onClick={()=>handleDelU(u.id)} style={{padding:'3px 10px',background:'rgba(192,57,43,.1)',color:C.danger,border:`1px solid ${C.danger}`,borderRadius:4,fontSize:'.72rem',cursor:'pointer',fontWeight:600}}>✕</button>
                      </td>
                    </tr>
                  ))}
                  {usuarios.length===0&&<tr><td colSpan={4} style={{textAlign:'center',padding:'30px',color:'#9aaa9e'}}>Sin usuarios cargados</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
