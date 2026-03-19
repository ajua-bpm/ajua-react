import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF' };
const today = () => new Date().toISOString().slice(0,10);
const nowTime = () => new Date().toTimeString().slice(0,5);

const MOTIVOS = ['Proveedor','Cliente','Auditoría / Inspección','Visita técnica','Personal administrativo','Otro'];

export default function Visitas() {
  const toast = useToast();
  const { data, loading } = useCollection('vis', { orderField:'fecha', orderDir:'desc', limit:300 });
  const { add, update, saving } = useWrite('vis');

  const [form, setForm] = useState({
    visitante: '', empresa: '', fecha: today(),
    horaEntrada: nowTime(), horaSalida: '', motivo: '', motivoOtro: '',
    autoriza: '', dpi: '', obs: '',
  });

  const handleSave = async () => {
    if (!form.visitante || !form.fecha || !form.motivo) {
      toast('⚠ Visitante, fecha y motivo requeridos', 'error'); return;
    }
    const motivoFinal = form.motivo === 'Otro' ? form.motivoOtro : form.motivo;
    await add({ ...form, motivo: motivoFinal, estado: 'adentro' });
    toast('✓ Visita registrada — entrada');
    setForm(f => ({ ...f, visitante:'', empresa:'', horaEntrada:nowTime(), horaSalida:'', motivo:'', motivoOtro:'', autoriza:'', dpi:'', obs:'' }));
  };

  const registrarSalida = async (r) => {
    await update(r.id, { horaSalida: nowTime(), estado: 'salió' });
    toast('✓ Salida registrada');
  };

  if (loading) return <LoadingSpinner/>;

  const adentro = data.filter(r => r.estado === 'adentro' && r.fecha === today());

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>👤 Control de Visitas</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Registro de entrada y salida de visitantes</p>

      {adentro.length > 0 && (
        <div style={{background:'rgba(74,158,106,.08)',border:`1.5px solid ${C.acc}`,borderRadius:8,padding:16,marginBottom:20}}>
          <div style={{fontWeight:700,color:C.green,marginBottom:8}}>Actualmente en instalaciones ({adentro.length})</div>
          {adentro.map(r=>(
            <div key={r.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:`1px solid rgba(74,158,106,.15)`}}>
              <span style={{flex:1,fontWeight:600}}>{r.visitante}</span>
              <span style={{fontSize:'.8rem',color:'#6B8070'}}>{r.empresa||'—'} · Entrada: {r.horaEntrada}</span>
              <button onClick={()=>registrarSalida(r)}
                style={{padding:'4px 12px',background:C.green,color:'#fff',border:'none',borderRadius:4,fontSize:'.75rem',fontWeight:700,cursor:'pointer'}}>
                Salida ↗
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:16}}>Registrar Visita</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:16}}>
          {[['visitante','Nombre visitante'],['empresa','Empresa'],['dpi','DPI / ID'],['autoriza','Autoriza (anfitrión)']].map(([id,label])=>(
            <label key={id} style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              {label}
              <input value={form[id]} onChange={e=>setForm(f=>({...f,[id]:e.target.value}))}
                style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
            </label>
          ))}
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Fecha
            <input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Hora entrada
            <input type="time" value={form.horaEntrada} onChange={e=>setForm(f=>({...f,horaEntrada:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Hora salida
            <input type="time" value={form.horaSalida} onChange={e=>setForm(f=>({...f,horaSalida:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Motivo
            <select value={form.motivo} onChange={e=>setForm(f=>({...f,motivo:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              <option value="">— Seleccionar —</option>
              {MOTIVOS.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          {form.motivo==='Otro' && (
            <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              Especificar
              <input value={form.motivoOtro} onChange={e=>setForm(f=>({...f,motivoOtro:e.target.value}))}
                style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
            </label>
          )}
        </div>
        <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))}
          placeholder="Observaciones..." rows={2}
          style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical'}}/>
        <button onClick={handleSave} disabled={saving}
          style={{marginTop:12,padding:'12px 28px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer'}}>
          {saving?'Guardando...':'Registrar Entrada'}
        </button>
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{fontWeight:700,marginBottom:12,color:C.green}}>Historial ({data.length})</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Fecha','Visitante','Empresa','Motivo','Entrada','Salida','Estado'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.slice(0,60).map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.fecha}</td>
                  <td style={{padding:'7px 10px'}}>{r.visitante}</td>
                  <td style={{padding:'7px 10px'}}>{r.empresa||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.motivo}</td>
                  <td style={{padding:'7px 10px'}}>{r.horaEntrada||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.horaSalida||'—'}</td>
                  <td style={{padding:'7px 10px'}}>
                    <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,
                      background:r.estado==='salió'?'rgba(74,158,106,.15)':'rgba(74,158,106,.25)',
                      color:C.green}}>
                      {r.estado==='salió'?'✓ Salió':'● Adentro'}
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
