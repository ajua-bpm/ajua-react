import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF',warn:'#e67e22' };
const today = () => new Date().toISOString().slice(0,10);
const fmt = n => Number(n||0).toLocaleString('es-GT',{style:'currency',currency:'GTQ',minimumFractionDigits:2});

const CATS = [
  'Combustible','Mantenimiento','Alimentación','Papelería','Limpieza',
  'Transporte','Servicios','Compras producción','Otros',
];

export default function Gastos() {
  const toast = useToast();
  const { data, loading } = useCollection('gastosDiarios', { orderField:'fecha',orderDir:'desc',limit:300 });
  const { add, saving } = useWrite('gastosDiarios');

  const [form, setForm] = useState({
    fecha: today(), desc:'', cat:'Combustible', monto:'', resp:'', factura:'', obs:'',
  });
  const [filtro, setFiltro] = useState('');

  const handleSave = async () => {
    if(!form.fecha||!form.desc||!form.monto){toast('⚠ Fecha, descripción y monto requeridos','error');return;}
    if(isNaN(Number(form.monto))||Number(form.monto)<=0){toast('⚠ Monto inválido','error');return;}
    await add({ ...form, monto: Number(form.monto) });
    toast('✓ Gasto registrado');
    setForm(f=>({...f, desc:'', monto:'', factura:'', obs:'', resp:''}));
  };

  const filtered = filtro
    ? data.filter(r=>r.fecha>=filtro)
    : data;

  const totalFiltrado = filtered.reduce((s,r)=>s+(r.monto||0),0);
  const totalHoy = data.filter(r=>r.fecha===today()).reduce((s,r)=>s+(r.monto||0),0);

  if(loading) return <LoadingSpinner/>;

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>💰 Gastos Diarios</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Registro y control de gastos operacionales</p>

      {/* Totales */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:20}}>
        {[
          {label:'Hoy',val:fmt(totalHoy),color:C.green},
          {label:'Total filtrado',val:fmt(totalFiltrado),color:C.acc},
          {label:'Registros',val:filtered.length,color:'#6B8070'},
        ].map(({label,val,color})=>(
          <div key={label} style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:'14px 18px'}}>
            <div style={{fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:'#9aaa9e',letterSpacing:'.06em',marginBottom:4}}>{label}</div>
            <div style={{fontSize:'1.3rem',fontWeight:800,color}}>{val}</div>
          </div>
        ))}
      </div>

      {/* Formulario */}
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,fontSize:'.9rem',color:C.green,marginBottom:14}}>Nuevo Gasto</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:12}}>
          {[
            {id:'fecha',type:'date',label:'Fecha'},
            {id:'resp',type:'text',label:'Responsable'},
            {id:'factura',type:'text',label:'No. Factura'},
          ].map(({id,type,label})=>(
            <label key={id} style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              {label}<input type={type} value={form[id]} onChange={e=>setForm(f=>({...f,[id]:e.target.value}))}
                style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
            </label>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:12}}>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em',gridColumn:'1/-1'}}>
            Descripción
            <input type="text" value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} placeholder="Descripción del gasto..."
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Categoría
            <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',background:'#fff'}}>
              {CATS.map(c=><option key={c}>{c}</option>)}
            </select>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Monto (Q)
            <input type="number" value={form.monto} onChange={e=>setForm(f=>({...f,monto:e.target.value}))} placeholder="0.00" step="0.01"
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
          </label>
        </div>
        <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} placeholder="Observaciones..." rows={2}
          style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical',marginBottom:12}}/>
        <button onClick={handleSave} disabled={saving} style={{padding:'12px 28px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer'}}>
          {saving?'Guardando...':'Registrar Gasto'}
        </button>
      </div>

      {/* Historial */}
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12,flexWrap:'wrap'}}>
          <div style={{fontWeight:700,color:C.green,flex:1}}>Historial</div>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'.78rem',fontWeight:600,color:'#6B8070'}}>
            Desde: <input type="date" value={filtro} onChange={e=>setFiltro(e.target.value)}
              style={{padding:'5px 8px',border:`1px solid ${C.sand}`,borderRadius:4,fontSize:'.8rem',outline:'none'}}/>
          </label>
          {filtro&&<button onClick={()=>setFiltro('')} style={{padding:'5px 10px',background:'#f0f0f0',border:'none',borderRadius:4,fontSize:'.78rem',cursor:'pointer'}}>✕ Limpiar</button>}
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Fecha','Descripción','Categoría','Monto','Responsable','Factura'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.slice(0,100).map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600,whiteSpace:'nowrap'}}>{r.fecha}</td>
                  <td style={{padding:'7px 10px'}}>{r.desc||'—'}</td>
                  <td style={{padding:'7px 10px'}}>
                    <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,background:'rgba(74,158,106,.1)',color:C.acc}}>{r.cat||'—'}</span>
                  </td>
                  <td style={{padding:'7px 10px',fontWeight:700,color:C.danger}}>{fmt(r.monto)}</td>
                  <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.resp||'—'}</td>
                  <td style={{padding:'7px 10px',color:'#6B8070'}}>{r.factura||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
