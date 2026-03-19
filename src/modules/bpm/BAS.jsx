import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF' };
const today = () => new Date().toISOString().slice(0,10);

const BASCULAS = ['Báscula 1','Báscula 2','Báscula 3','Báscula 4'];

export default function BAS() {
  const toast = useToast();
  const { data, loading } = useCollection('bas', { orderField:'fecha',orderDir:'desc',limit:200 });
  const { add, saving } = useWrite('bas');

  const [form, setForm] = useState({
    fecha: today(), hora:'', resp:'',
    basculas: BASCULAS.map(n => ({ nombre:n, ok:null, peso_ref:'', peso_lec:'', obs:'' })),
    obs: '',
  });

  const setBas = (i, field, val) => setForm(f => {
    const b=[...f.basculas]; b[i]={...b[i],[field]:val}; return {...f,basculas:b};
  });

  const handleSave = async () => {
    if(!form.fecha||!form.resp){toast('⚠ Fecha y responsable requeridos','error');return;}
    const ok=form.basculas.filter(b=>b.ok===true).length;
    const fail=form.basculas.filter(b=>b.ok===false).length;
    await add({ ...form, ok, fail, resultado: fail===0?'cumple':'no_cumple' });
    toast('✓ Registro BAS guardado');
    setForm(f=>({...f,resp:'',basculas:BASCULAS.map(n=>({nombre:n,ok:null,peso_ref:'',peso_lec:'',obs:''})),obs:''}));
  };

  if(loading) return <LoadingSpinner/>;

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>⚖️ Revisión de Básculas</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Calibración y verificación diaria de básculas industriales</p>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
          {[['fecha','date','Fecha',form.fecha],['hora','time','Hora',form.hora],['resp','text','Responsable',form.resp]].map(([id,type,label,val])=>(
            <label key={id} style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              {label}<input type={type} value={val} onChange={e=>setForm(f=>({...f,[id]:e.target.value}))}
                style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
            </label>
          ))}
        </div>

        {form.basculas.map((b,i)=>(
          <div key={i} style={{padding:'14px 0',borderBottom:`1px solid ${C.sand}`}}>
            <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <span style={{fontWeight:700,fontSize:'.85rem',minWidth:100}}>{b.nombre}</span>
              <label style={{display:'flex',flexDirection:'column',gap:3,fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',color:C.acc}}>
                Peso ref (kg)
                <input type="number" value={b.peso_ref} onChange={e=>setBas(i,'peso_ref',e.target.value)} placeholder="0.000"
                  style={{width:90,padding:'7px 10px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.82rem',outline:'none'}}/>
              </label>
              <label style={{display:'flex',flexDirection:'column',gap:3,fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',color:C.acc}}>
                Peso lectura (kg)
                <input type="number" value={b.peso_lec} onChange={e=>setBas(i,'peso_lec',e.target.value)} placeholder="0.000"
                  style={{width:90,padding:'7px 10px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.82rem',outline:'none'}}/>
              </label>
              <div style={{display:'flex',gap:6}}>
                {[{v:true,label:'✓ OK'},{v:false,label:'✗ Falla'}].map(({v,label})=>(
                  <button key={String(v)} onClick={()=>setBas(i,'ok',v)} style={{
                    padding:'6px 14px',borderRadius:4,fontSize:'.75rem',fontWeight:600,cursor:'pointer',
                    border:`1.5px solid ${b.ok===v?(v?C.acc:C.danger):C.sand}`,
                    background:b.ok===v?(v?C.acc:C.danger):'#fff',
                    color:b.ok===v?'#fff':'#555',
                  }}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        ))}

        <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} placeholder="Observaciones generales..." rows={2}
          style={{width:'100%',marginTop:14,padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical'}}/>
        <button onClick={handleSave} disabled={saving} style={{marginTop:12,padding:'12px 28px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer'}}>
          {saving?'Guardando...':'Guardar Registro BAS'}
        </button>
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{fontWeight:700,marginBottom:12,color:C.green}}>Historial ({data.length})</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Fecha','Hora','Responsable','OK','Fallas','Resultado'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.slice(0,50).map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.fecha}</td>
                  <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.hora||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.resp||'—'}</td>
                  <td style={{padding:'7px 10px',color:C.acc,fontWeight:600}}>{r.ok||0}</td>
                  <td style={{padding:'7px 10px',color:C.danger,fontWeight:600}}>{r.fail||0}</td>
                  <td style={{padding:'7px 10px'}}>
                    <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,background:r.resultado==='cumple'?'rgba(74,158,106,.15)':'rgba(192,57,43,.12)',color:r.resultado==='cumple'?C.acc:C.danger}}>
                      {r.resultado==='cumple'?'✓ Cumple':'✗ No cumple'}
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
