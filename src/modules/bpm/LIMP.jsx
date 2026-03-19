import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28', acc:'#4A9E6A', sand:'#E8DCC8', danger:'#c0392b', bg:'#F9F6EF' };
const today = () => new Date().toISOString().slice(0,10);

const AREAS = [
  {
    nombre: '❄️ Cooler 1 (0–4°C)',
    checks: ['Pisos limpios y secos','Paredes sin manchas ni residuos','Puertas y juntas limpias','Cortinas en buen estado','Sin olores inusuales'],
  },
  {
    nombre: '❄️ Cooler 2 (3–7°C)',
    checks: ['Pisos limpios y secos','Paredes sin manchas ni residuos','Puertas y juntas limpias','Cortinas en buen estado','Sin olores inusuales'],
  },
  {
    nombre: '📦 Área de Pre-carga',
    checks: ['Pisos barridos y trapeados','Mesas y superficies desinfectadas','Sin residuos de producto','Desagües limpios'],
  },
  {
    nombre: '🏭 Bodega General',
    checks: ['Pasillos despejados','Pisos limpios','Estantes limpios y ordenados','Sin plagas visibles','Basura retirada'],
  },
  {
    nombre: '🚿 Área de Sanitización',
    checks: ['Pediluvio con solución activa','Lavamanos con jabón y papel','Concentración cloro correcta (200 ppm)'],
  },
];

export default function LIMP() {
  const toast = useToast();
  const { data, loading } = useCollection('limp', { orderField:'fecha', orderDir:'desc', limit:200 });
  const { add, saving } = useWrite('limp');

  const [form, setForm] = useState({
    fecha: today(), resp: '',
    areas: AREAS.map(a => ({ nombre: a.nombre, checks: a.checks.map(c => ({ texto:c, ok:null })), obs:'' })),
    obs: '', foto: '',
  });

  const setCheck = (ai, ci, val) => setForm(f => {
    const areas = f.areas.map((a,i) => i!==ai ? a : {
      ...a, checks: a.checks.map((c,j) => j!==ci ? c : {...c, ok:val})
    });
    return {...f, areas};
  });

  const setAreaObs = (ai, val) => setForm(f => {
    const areas = [...f.areas]; areas[ai] = {...areas[ai], obs:val}; return {...f, areas};
  });

  const handleSave = async () => {
    if(!form.fecha || !form.resp) { toast('⚠ Fecha y responsable requeridos','error'); return; }
    const total = form.areas.reduce((s,a) => s+a.checks.length, 0);
    const ok    = form.areas.reduce((s,a) => s+a.checks.filter(c=>c.ok===true).length, 0);
    const fail  = form.areas.reduce((s,a) => s+a.checks.filter(c=>c.ok===false).length, 0);
    const pct   = total>0 ? Math.round(ok/total*100) : 0;
    await add({ ...form, ok, fail, total, pct, resultado: fail===0?'cumple':'no_cumple' });
    toast('✓ Registro LIMP guardado');
    setForm(f => ({...f, resp:'', foto:'',
      areas: AREAS.map(a => ({ nombre:a.nombre, checks:a.checks.map(c=>({texto:c,ok:null})), obs:'' })),
      obs:'',
    }));
  };

  if(loading) return <LoadingSpinner/>;

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>🧹 Limpieza de Bodega</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Registro diario de limpieza y sanitización de áreas</p>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
          {[['fecha','date','Fecha',form.fecha],['resp','text','Responsable',form.resp],['foto','text','Foto (URL o código)',form.foto]].map(([id,type,label,val])=>(
            <label key={id} style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              {label}
              <input type={type} value={val} onChange={e=>setForm(f=>({...f,[id]:e.target.value}))}
                style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
            </label>
          ))}
        </div>

        {form.areas.map((area, ai) => (
          <div key={ai} style={{marginBottom:16,border:`1px solid ${C.sand}`,borderRadius:6,padding:14}}>
            <div style={{fontWeight:700,fontSize:'.85rem',color:C.green,marginBottom:10}}>{area.nombre}</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {area.checks.map((c, ci) => (
                <div key={ci} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                  <span style={{fontSize:'.82rem',flex:1}}>{c.texto}</span>
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    {[{v:true,label:'✓'},{v:false,label:'✗'}].map(({v,label})=>(
                      <button key={String(v)} onClick={()=>setCheck(ai,ci,v)} style={{
                        width:34,height:28,borderRadius:4,fontSize:'.8rem',fontWeight:700,cursor:'pointer',
                        border:`1.5px solid ${c.ok===v?(v?C.acc:C.danger):C.sand}`,
                        background:c.ok===v?(v?C.acc:C.danger):'#fff',
                        color:c.ok===v?'#fff':'#555',
                      }}>{label}</button>
                    ))}
                  </div>
                </div>
              ))}
              <input value={area.obs} onChange={e=>setAreaObs(ai,e.target.value)} placeholder="Observaciones del área..."
                style={{marginTop:4,padding:'6px 10px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.8rem',outline:'none'}}/>
            </div>
          </div>
        ))}

        <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} placeholder="Observaciones generales..." rows={2}
          style={{width:'100%',marginTop:4,padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical'}}/>
        <button onClick={handleSave} disabled={saving} style={{marginTop:12,padding:'12px 28px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer'}}>
          {saving?'Guardando...':'Guardar Registro LIMP'}
        </button>
      </div>

      {/* Historial */}
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{fontWeight:700,marginBottom:12,color:C.green}}>Historial ({data.length})</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Fecha','Responsable','OK','Fallas','%','Resultado'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.slice(0,50).map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.fecha}</td>
                  <td style={{padding:'7px 10px'}}>{r.resp||'—'}</td>
                  <td style={{padding:'7px 10px',color:C.acc,fontWeight:600}}>{r.ok||0}</td>
                  <td style={{padding:'7px 10px',color:C.danger,fontWeight:600}}>{r.fail||0}</td>
                  <td style={{padding:'7px 10px',fontWeight:700,color:(r.pct||0)>=80?C.acc:C.danger}}>{r.pct||0}%</td>
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
