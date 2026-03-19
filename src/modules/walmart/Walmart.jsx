import { useState } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF',warn:'#e67e22' };
const fmt = n => Number(n||0).toLocaleString('es-GT',{style:'currency',currency:'GTQ',minimumFractionDigits:2});
const today = () => new Date().toISOString().slice(0,10);

const ESTADO_COLORS = {
  pendiente: { bg:'rgba(230,126,34,.12)', color:'#e67e22' },
  en_proceso: { bg:'rgba(52,152,219,.12)', color:'#2980b9' },
  cerrado: { bg:'rgba(74,158,106,.15)', color:'#4A9E6A' },
  con_rechazo: { bg:'rgba(192,57,43,.12)', color:'#c0392b' },
};

export default function Walmart() {
  const { data, loading } = useCollection('pedidosWalmart', { orderField:'fechaEntrega',orderDir:'desc',limit:300 });
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');

  if(loading) return <LoadingSpinner/>;

  const filtered = data.filter(r => {
    if(filtroEstado && r.estado!==filtroEstado) return false;
    if(filtroDesde && r.fechaEntrega<filtroDesde) return false;
    return true;
  });

  const totalPedidos = filtered.length;
  const totalCerrados = filtered.filter(r=>r.estado==='cerrado').length;
  const totalRechazos = filtered.filter(r=>r.estado==='con_rechazo').length;

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>🛒 Pedidos Walmart</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Seguimiento de pedidos y entregas a Walmart</p>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
        {[
          {label:'Total pedidos',val:totalPedidos,color:C.green},
          {label:'Cerrados',val:totalCerrados,color:C.acc},
          {label:'Con rechazo',val:totalRechazos,color:C.danger},
        ].map(({label,val,color})=>(
          <div key={label} style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:'14px 18px'}}>
            <div style={{fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:'#9aaa9e',letterSpacing:'.06em',marginBottom:4}}>{label}</div>
            <div style={{fontSize:'1.6rem',fontWeight:800,color}}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:'14px 20px',marginBottom:20,display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'.78rem',fontWeight:600,color:'#6B8070'}}>
          Estado:
          <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)}
            style={{padding:'5px 8px',border:`1px solid ${C.sand}`,borderRadius:4,fontSize:'.8rem',outline:'none',background:'#fff'}}>
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_proceso">En proceso</option>
            <option value="cerrado">Cerrado</option>
            <option value="con_rechazo">Con rechazo</option>
          </select>
        </label>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'.78rem',fontWeight:600,color:'#6B8070'}}>
          Desde: <input type="date" value={filtroDesde} onChange={e=>setFiltroDesde(e.target.value)}
            style={{padding:'5px 8px',border:`1px solid ${C.sand}`,borderRadius:4,fontSize:'.8rem',outline:'none'}}/>
        </label>
        {(filtroEstado||filtroDesde)&&(
          <button onClick={()=>{setFiltroEstado('');setFiltroDesde('');}}
            style={{padding:'5px 10px',background:'#f0f0f0',border:'none',borderRadius:4,fontSize:'.78rem',cursor:'pointer'}}>
            ✕ Limpiar
          </button>
        )}
        <span style={{marginLeft:'auto',fontSize:'.8rem',color:'#6B8070'}}>{filtered.length} pedidos</span>
      </div>

      {/* Tabla */}
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['No. Orden','Producto','F. Entrega','Estado','Cajas','Rechazo','Responsable'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`,whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.slice(0,100).map(r=>{
                const es = ESTADO_COLORS[r.estado] || { bg:'#f5f5f5', color:'#999' };
                const cajas = r.rubros ? r.rubros.reduce((s,rb)=>s+(rb.cajasAceptadas||rb.cajas||0),0) : (r.cajas||0);
                const rechazo = r.rubros ? r.rubros.reduce((s,rb)=>s+(rb.cajasRechazadas||0),0) : (r.rechazo||0);
                return (
                  <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                    <td style={{padding:'7px 10px',fontWeight:600,fontFamily:'monospace'}}>{r.noOrden||r.id?.slice(0,8)||'—'}</td>
                    <td style={{padding:'7px 10px'}}>{r.producto||r.rubros?.[0]?.producto||'—'}</td>
                    <td style={{padding:'7px 10px',whiteSpace:'nowrap'}}>{r.fechaEntrega||'—'}</td>
                    <td style={{padding:'7px 10px'}}>
                      <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,...es}}>
                        {r.estado?.replace(/_/g,' ')||'—'}
                      </span>
                    </td>
                    <td style={{padding:'7px 10px',fontWeight:600}}>{cajas||'—'}</td>
                    <td style={{padding:'7px 10px',color:rechazo>0?C.danger:'#6B8070',fontWeight:rechazo>0?700:400}}>{rechazo||0}</td>
                    <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.resp||r.conductor||'—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length===0&&(
          <div style={{textAlign:'center',padding:'40px',color:'#9aaa9e',fontSize:'.9rem'}}>Sin registros con el filtro actual</div>
        )}
      </div>
    </div>
  );
}
