import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF' };
const today = () => new Date().toISOString().slice(0,10);

const SINTOMAS = [
  'Fiebre','Gripe / Resfriado','Diarrea','Vómitos','Dolor abdominal',
  'Tos','Herida en manos','Infección cutánea','COVID-19','Otro',
];

export default function EmpleadosEnfermos() {
  const toast = useToast();
  const { data, loading } = useCollection('ee', { orderField:'fecha', orderDir:'desc', limit:200 });
  const { data: empList } = useCollection('empleados', { orderField:'nombre', limit:200 });
  const { add, update, saving } = useWrite('ee');

  const [form, setForm] = useState({
    empleado: '', fecha: today(), sintoma: '', sintomaOtro: '',
    diasFuera: '', fechaRegreso: '', estado: 'activo', obs: '',
  });

  const handleSave = async () => {
    if (!form.empleado || !form.fecha || !form.sintoma) {
      toast('⚠ Empleado, fecha y síntoma requeridos', 'error'); return;
    }
    const sintomaFinal = form.sintoma === 'Otro' ? form.sintomaOtro : form.sintoma;
    await add({ ...form, sintoma: sintomaFinal });
    toast('✓ Registro guardado');
    setForm(f => ({ ...f, empleado:'', sintoma:'', sintomaOtro:'', diasFuera:'', fechaRegreso:'', estado:'activo', obs:'' }));
  };

  const marcarRegreso = async (r) => {
    await update(r.id, { estado:'regresó', fechaRegresoReal: today() });
    toast('✓ Empleado marcado como regresado');
  };

  if (loading) return <LoadingSpinner/>;

  const activos = data.filter(r => r.estado === 'activo');

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>🏥 Empleados Enfermos</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Control de ausencias por enfermedad</p>

      {activos.length > 0 && (
        <div style={{background:'rgba(192,57,43,.08)',border:`1.5px solid ${C.danger}`,borderRadius:8,padding:16,marginBottom:20}}>
          <div style={{fontWeight:700,color:C.danger,marginBottom:8}}>⚠ Actualmente fuera ({activos.length})</div>
          {activos.map(r=>(
            <div key={r.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:`1px solid rgba(192,57,43,.15)`}}>
              <span style={{flex:1,fontWeight:600}}>{r.empleado}</span>
              <span style={{fontSize:'.8rem',color:'#6B8070'}}>{r.sintoma} · desde {r.fecha}</span>
              <button onClick={()=>marcarRegreso(r)} style={{padding:'4px 12px',background:C.acc,color:'#fff',border:'none',borderRadius:4,fontSize:'.75rem',fontWeight:700,cursor:'pointer'}}>
                Regresó ✓
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:16}}>Nuevo Registro</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:16}}>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Empleado
            <select value={form.empleado} onChange={e=>setForm(f=>({...f,empleado:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              <option value="">— Seleccionar —</option>
              {(empList||[]).filter(e=>e.activo!==false).map(e=>(
                <option key={e.id} value={e.nombre}>{e.nombre}</option>
              ))}
            </select>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Fecha inicio
            <input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Síntoma
            <select value={form.sintoma} onChange={e=>setForm(f=>({...f,sintoma:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              <option value="">— Seleccionar —</option>
              {SINTOMAS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {form.sintoma==='Otro' && (
            <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              Especificar
              <input value={form.sintomaOtro} onChange={e=>setForm(f=>({...f,sintomaOtro:e.target.value}))}
                style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
            </label>
          )}
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Días fuera (est.)
            <input type="number" min="1" value={form.diasFuera} onChange={e=>setForm(f=>({...f,diasFuera:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Fecha regreso est.
            <input type="date" value={form.fechaRegreso} onChange={e=>setForm(f=>({...f,fechaRegreso:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
        </div>
        <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))}
          placeholder="Observaciones..." rows={2}
          style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical'}}/>
        <button onClick={handleSave} disabled={saving}
          style={{marginTop:12,padding:'12px 28px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer'}}>
          {saving?'Guardando...':'Guardar Registro'}
        </button>
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{fontWeight:700,marginBottom:12,color:C.green}}>Historial ({data.length})</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Empleado','Fecha','Síntoma','Días','Regreso est.','Estado'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.slice(0,50).map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.empleado}</td>
                  <td style={{padding:'7px 10px'}}>{r.fecha}</td>
                  <td style={{padding:'7px 10px'}}>{r.sintoma}</td>
                  <td style={{padding:'7px 10px'}}>{r.diasFuera||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.fechaRegreso||'—'}</td>
                  <td style={{padding:'7px 10px'}}>
                    <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,
                      background:r.estado==='regresó'?'rgba(74,158,106,.15)':'rgba(192,57,43,.12)',
                      color:r.estado==='regresó'?C.acc:C.danger}}>
                      {r.estado==='regresó'?'✓ Regresó':'● Fuera'}
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
