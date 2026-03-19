import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF' };
const today = () => new Date().toISOString().slice(0,10);

const TEMAS = [
  'BPM — Buenas Prácticas de Manufactura',
  'Higiene personal y lavado de manos',
  'Manejo seguro de alimentos',
  'Uso de equipo de protección personal',
  'Control de plagas',
  'Primeros auxilios',
  'Seguridad industrial',
  'Otro',
];

export default function Capacitacion() {
  const toast = useToast();
  const { data, loading } = useCollection('cap', { orderField:'fecha', orderDir:'desc', limit:200 });
  const { data: empList } = useCollection('empleados', { orderField:'nombre', limit:200 });
  const { add, saving } = useWrite('cap');

  const [form, setForm] = useState({
    fecha: today(), tema: '', temaOtro: '', instructor: '',
    duracion: '', participantes: [], obs: '', resultado: 'aprobado',
  });
  const [nuevoParticipante, setNuevoParticipante] = useState('');

  const addParticipante = () => {
    const n = nuevoParticipante.trim();
    if (!n || form.participantes.includes(n)) return;
    setForm(f => ({ ...f, participantes: [...f.participantes, n] }));
    setNuevoParticipante('');
  };

  const removeParticipante = (n) => setForm(f => ({ ...f, participantes: f.participantes.filter(x=>x!==n) }));

  const addFromEmp = (nombre) => {
    if (!form.participantes.includes(nombre))
      setForm(f => ({ ...f, participantes: [...f.participantes, nombre] }));
  };

  const handleSave = async () => {
    if (!form.fecha || !form.tema || !form.instructor) {
      toast('⚠ Fecha, tema e instructor requeridos', 'error'); return;
    }
    const temaFinal = form.tema === 'Otro' ? form.temaOtro : form.tema;
    await add({ ...form, tema: temaFinal });
    toast('✓ Capacitación registrada');
    setForm(f => ({ ...f, tema:'', temaOtro:'', instructor:'', duracion:'', participantes:[], obs:'', resultado:'aprobado' }));
  };

  if (loading) return <LoadingSpinner/>;

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>🎓 Registro de Capacitaciones</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Control de formación y capacitación del personal</p>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:16}}>
          {[['fecha','Fecha','date'],['instructor','Instructor','text'],['duracion','Duración (hrs)','text']].map(([id,label,type])=>(
            <label key={id} style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              {label}
              <input type={type} value={form[id]} onChange={e=>setForm(f=>({...f,[id]:e.target.value}))}
                style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
            </label>
          ))}
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Tema
            <select value={form.tema} onChange={e=>setForm(f=>({...f,tema:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              <option value="">— Seleccionar —</option>
              {TEMAS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {form.tema==='Otro' && (
            <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              Especificar tema
              <input value={form.temaOtro} onChange={e=>setForm(f=>({...f,temaOtro:e.target.value}))}
                style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
            </label>
          )}
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Resultado
            <select value={form.resultado} onChange={e=>setForm(f=>({...f,resultado:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              <option value="aprobado">✓ Aprobado</option>
              <option value="pendiente">⏳ Pendiente evaluación</option>
              <option value="reprogramar">🔄 Reprogramar</option>
            </select>
          </label>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em',marginBottom:8}}>
            Participantes ({form.participantes.length})
          </div>
          <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap'}}>
            <select value="" onChange={e=>{ if(e.target.value) addFromEmp(e.target.value); }}
              style={{padding:'7px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',flex:'1 1 200px'}}>
              <option value="">+ Agregar desde lista empleados</option>
              {(empList||[]).filter(e=>e.activo!==false).map(e=>(
                <option key={e.id} value={e.nombre}>{e.nombre}</option>
              ))}
            </select>
            <div style={{display:'flex',gap:6,flex:'1 1 200px'}}>
              <input value={nuevoParticipante} onChange={e=>setNuevoParticipante(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&addParticipante()}
                placeholder="Nombre manual..."
                style={{padding:'7px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',flex:1}}/>
              <button onClick={addParticipante}
                style={{padding:'7px 14px',background:C.acc,color:'#fff',border:'none',borderRadius:4,fontWeight:700,cursor:'pointer'}}>+</button>
            </div>
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {form.participantes.map(n=>(
              <span key={n} style={{background:'rgba(74,158,106,.12)',color:C.green,padding:'4px 10px',borderRadius:20,fontSize:'.78rem',fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
                {n}
                <button onClick={()=>removeParticipante(n)} style={{background:'none',border:'none',cursor:'pointer',color:C.danger,fontWeight:700,fontSize:'.9rem',lineHeight:1}}>×</button>
              </span>
            ))}
          </div>
        </div>

        <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))}
          placeholder="Observaciones..." rows={2}
          style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical'}}/>

        <button onClick={handleSave} disabled={saving}
          style={{marginTop:12,padding:'12px 28px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer'}}>
          {saving?'Guardando...':'Guardar Capacitación'}
        </button>
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{fontWeight:700,marginBottom:12,color:C.green}}>Historial ({data.length})</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Fecha','Tema','Instructor','Duración','Participantes','Resultado'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.slice(0,50).map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.fecha}</td>
                  <td style={{padding:'7px 10px'}}>{r.tema||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.instructor||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.duracion?`${r.duracion}h`:'—'}</td>
                  <td style={{padding:'7px 10px'}}>{(r.participantes||[]).length} personas</td>
                  <td style={{padding:'7px 10px'}}>
                    <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,
                      background:r.resultado==='aprobado'?'rgba(74,158,106,.15)':'rgba(255,165,0,.12)',
                      color:r.resultado==='aprobado'?C.acc:'#e67e22'}}>
                      {r.resultado==='aprobado'?'✓ Aprobado':r.resultado==='pendiente'?'⏳ Pendiente':'🔄 Reprogramar'}
                    </span>
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
