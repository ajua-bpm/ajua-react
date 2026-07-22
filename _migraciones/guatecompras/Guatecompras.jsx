import { useState } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF',warn:'#e67e22' };
const fmt = n => Number(n||0).toLocaleString('es-GT',{style:'currency',currency:'GTQ',minimumFractionDigits:2});

export default function Guatecompras() {
  const { data: concursos, loading: lc } = useCollection('gcConcursos', { orderField:'fecha',orderDir:'desc',limit:200 });
  const { data: descubiertos, loading: ld } = useCollection('gcDescubiertos', { orderField:'fecha',orderDir:'desc',limit:200 });
  const [tab, setTab] = useState('concursos');
  const [buscar, setBuscar] = useState('');

  if(lc||ld) return <LoadingSpinner/>;

  const filtrar = (arr) => buscar
    ? arr.filter(r => JSON.stringify(r).toLowerCase().includes(buscar.toLowerCase()))
    : arr;

  const concursosFilt = filtrar(concursos);
  const descubiertosFilt = filtrar(descubiertos);

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>🏛️ Guatecompras</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Concursos y descubiertos del sistema Guatecompras</p>

      {/* Tabs */}
      <div style={{display:'flex',gap:0,marginBottom:20,border:`1px solid ${C.sand}`,borderRadius:8,overflow:'hidden',background:'#fff'}}>
        {[
          {id:'concursos',label:`Concursos (${concursos.length})`},
          {id:'descubiertos',label:`Descubiertos (${descubiertos.length})`},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1,padding:'12px 16px',border:'none',fontWeight:700,fontSize:'.85rem',cursor:'pointer',
            background:tab===t.id?C.green:'#fff',
            color:tab===t.id?'#fff':'#6B8070',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Buscador */}
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:'10px 16px',marginBottom:16}}>
        <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar en todos los campos..."
          style={{width:'100%',padding:'8px 12px',border:`1px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
      </div>

      {/* Concursos */}
      {tab==='concursos'&&(
        <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
          <div style={{fontWeight:700,color:C.green,marginBottom:12}}>Concursos ({concursosFilt.length})</div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
              <thead><tr style={{background:C.bg}}>
                {['NOM','Fecha','Entidad','Descripción','Monto','Estado'].map(h=>(
                  <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {concursosFilt.slice(0,100).map(r=>(
                  <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                    <td style={{padding:'7px 10px',fontFamily:'monospace',fontWeight:600,whiteSpace:'nowrap'}}>{r.nom||'—'}</td>
                    <td style={{padding:'7px 10px',whiteSpace:'nowrap'}}>{r.fecha||'—'}</td>
                    <td style={{padding:'7px 10px'}}>{r.entidad||'—'}</td>
                    <td style={{padding:'7px 10px',maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.desc||r.descripcion||'—'}</td>
                    <td style={{padding:'7px 10px',fontWeight:600,whiteSpace:'nowrap'}}>{r.monto?fmt(r.monto):'—'}</td>
                    <td style={{padding:'7px 10px'}}>
                      {r.estado&&<span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,background:'rgba(74,158,106,.1)',color:C.acc}}>{r.estado}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {concursosFilt.length===0&&<div style={{textAlign:'center',padding:'40px',color:'#9aaa9e'}}>Sin concursos</div>}
        </div>
      )}

      {/* Descubiertos */}
      {tab==='descubiertos'&&(
        <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
          <div style={{fontWeight:700,color:C.green,marginBottom:12}}>Descubiertos ({descubiertosFilt.length})</div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
              <thead><tr style={{background:C.bg}}>
                {['Fecha','Entidad','Concurso','Monto adjudicado','Observaciones'].map(h=>(
                  <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {descubiertosFilt.slice(0,100).map(r=>(
                  <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                    <td style={{padding:'7px 10px',whiteSpace:'nowrap'}}>{r.fecha||'—'}</td>
                    <td style={{padding:'7px 10px'}}>{r.entidad||'—'}</td>
                    <td style={{padding:'7px 10px',fontFamily:'monospace'}}>{r.nom||r.concurso||'—'}</td>
                    <td style={{padding:'7px 10px',fontWeight:600}}>{r.monto?fmt(r.monto):'—'}</td>
                    <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.obs||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {descubiertosFilt.length===0&&<div style={{textAlign:'center',padding:'40px',color:'#9aaa9e'}}>Sin descubiertos</div>}
        </div>
      )}
    </div>
  );
}
