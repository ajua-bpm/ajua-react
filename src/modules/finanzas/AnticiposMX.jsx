import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28', acc:'#4A9E6A', sand:'#E8DCC8', danger:'#c0392b', bg:'#F9F6EF', warn:'#e67e22' };
const today = () => new Date().toISOString().slice(0,10);
const fmtMX = n => Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2});
const fmtQ  = n => Number(n||0).toLocaleString('es-GT',{style:'currency',currency:'GTQ',minimumFractionDigits:2});

export default function AnticiposMX() {
  const toast = useToast();
  const { data, loading } = useCollection('iAnticipo', { orderField:'fecha', orderDir:'desc', limit:200 });
  const { add, update, saving } = useWrite('iAnticipo');

  const [form, setForm] = useState({
    fecha: today(), concepto:'', monto_mx:'', tipo_cambio:'',
    responsable:'', proveedor:'', estado:'pendiente', obs:'',
  });
  const [filtro, setFiltro] = useState('');

  const montoQ = form.monto_mx && form.tipo_cambio
    ? (Number(form.monto_mx) * Number(form.tipo_cambio)).toFixed(2)
    : '';

  const handleSave = async () => {
    if(!form.fecha||!form.monto_mx||!form.concepto) {
      toast('⚠ Fecha, concepto y monto requeridos','error'); return;
    }
    await add({
      ...form,
      monto_mx: Number(form.monto_mx),
      tipo_cambio: Number(form.tipo_cambio)||0,
      monto_q: montoQ ? Number(montoQ) : 0,
    });
    toast('✓ Anticipo registrado');
    setForm(f=>({...f, concepto:'', monto_mx:'', tipo_cambio:'', responsable:'', proveedor:'', obs:''}));
  };

  const handleEstado = async (id, estado) => {
    await update(id, { estado, fecha_cierre: estado==='devuelto'?today():'' });
    toast(`✓ Marcado como ${estado}`);
  };

  const filtered = filtro ? data.filter(r=>r.estado===filtro) : data;
  const totalPendiente = data.filter(r=>r.estado==='pendiente').reduce((s,r)=>s+(r.monto_mx||0),0);
  const totalDevuelto  = data.filter(r=>r.estado==='devuelto').reduce((s,r)=>s+(r.monto_mx||0),0);

  if(loading) return <LoadingSpinner/>;

  const ESTADO = {
    pendiente: { bg:'rgba(230,126,34,.12)', color:'#e67e22', label:'Pendiente' },
    devuelto:  { bg:'rgba(74,158,106,.15)', color:C.acc,    label:'Devuelto'  },
    parcial:   { bg:'rgba(52,152,219,.12)', color:'#2980b9', label:'Parcial'  },
  };

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>💵 Anticipos MX</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:16}}>Control de anticipos en pesos mexicanos para importaciones</p>

      {/* Totales */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:20}}>
        <div style={{background:'rgba(230,126,34,.08)',border:`1px solid rgba(230,126,34,.25)`,borderRadius:8,padding:'14px 18px'}}>
          <div style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',color:C.warn,letterSpacing:'.06em',marginBottom:4}}>Pendiente recuperar</div>
          <div style={{fontSize:'1.3rem',fontWeight:800,color:C.warn}}>{fmtMX(totalPendiente)}</div>
        </div>
        <div style={{background:'rgba(74,158,106,.08)',border:`1px solid rgba(74,158,106,.2)`,borderRadius:8,padding:'14px 18px'}}>
          <div style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em',marginBottom:4}}>Total devuelto</div>
          <div style={{fontSize:'1.3rem',fontWeight:800,color:C.acc}}>{fmtMX(totalDevuelto)}</div>
        </div>
        <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:'14px 18px'}}>
          <div style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',color:'#6B8070',letterSpacing:'.06em',marginBottom:4}}>Total registros</div>
          <div style={{fontSize:'1.3rem',fontWeight:800,color:C.green}}>{data.length}</div>
        </div>
      </div>

      {/* Formulario */}
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,fontSize:'.9rem',color:C.green,marginBottom:14}}>Registrar Anticipo</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:12}}>
          <label style={LS}>Fecha<input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} style={IS}/></label>
          <label style={LS}>Responsable<input value={form.responsable} onChange={e=>setForm(f=>({...f,responsable:e.target.value}))} style={IS}/></label>
          <label style={LS}>Proveedor<input value={form.proveedor} onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))} style={IS}/></label>
          <label style={LS}>Monto MX$
            <input type="number" value={form.monto_mx} onChange={e=>setForm(f=>({...f,monto_mx:e.target.value}))} placeholder="0.00" style={IS}/>
          </label>
          <label style={LS}>Tipo cambio (MX→Q)
            <input type="number" value={form.tipo_cambio} onChange={e=>setForm(f=>({...f,tipo_cambio:e.target.value}))} placeholder="0.00" step="0.01" style={IS}/>
          </label>
          <label style={LS}>Equivalente Q
            <input value={montoQ ? `Q ${Number(montoQ).toLocaleString()}` : ''} readOnly
              style={{...IS,background:C.bg,color:C.green,fontWeight:700}}/>
          </label>
        </div>
        <label style={{...LS,display:'block',marginBottom:12}}>
          Concepto *
          <input value={form.concepto} onChange={e=>setForm(f=>({...f,concepto:e.target.value}))} placeholder="Descripción del anticipo..." style={IS}/>
        </label>
        <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} placeholder="Observaciones..." rows={2}
          style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical',marginBottom:12}}/>
        <button onClick={handleSave} disabled={saving} style={{padding:'12px 28px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer'}}>
          {saving?'Guardando...':'Registrar Anticipo'}
        </button>
      </div>

      {/* Historial */}
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12,flexWrap:'wrap'}}>
          <div style={{fontWeight:700,color:C.green,flex:1}}>Historial ({filtered.length})</div>
          <select value={filtro} onChange={e=>setFiltro(e.target.value)} style={{padding:'5px 10px',border:`1px solid ${C.sand}`,borderRadius:4,fontSize:'.8rem',outline:'none',background:'#fff'}}>
            <option value="">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="parcial">Parciales</option>
            <option value="devuelto">Devueltos</option>
          </select>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.slice(0,50).map(r=>{
            const est = ESTADO[r.estado]||ESTADO.pendiente;
            return (
              <div key={r.id} style={{border:`1px solid ${C.sand}`,borderRadius:6,padding:'12px 14px'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:10,justifyContent:'space-between',flexWrap:'wrap'}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:'.85rem',color:C.green}}>{r.concepto}</div>
                    <div style={{fontSize:'.78rem',color:'#555',marginTop:2}}>
                      {fmtMX(r.monto_mx)} {r.tipo_cambio?`× ${r.tipo_cambio} = ${fmtQ(r.monto_q)}`:''} · {r.proveedor||'—'}
                    </div>
                    {r.responsable&&<div style={{fontSize:'.7rem',color:'#9aaa9e',marginTop:3}}>Responsable: {r.responsable}</div>}
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:'.72rem',color:'#6B8070'}}>{r.fecha}</div>
                    <span style={{display:'inline-block',marginTop:4,padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,...est}}>
                      {est.label}
                    </span>
                  </div>
                </div>
                {r.estado!=='devuelto'&&(
                  <div style={{display:'flex',gap:8,marginTop:10}}>
                    <button onClick={()=>handleEstado(r.id,'parcial')} style={{padding:'4px 12px',background:'rgba(52,152,219,.12)',color:'#2980b9',border:'1px solid #2980b9',borderRadius:4,fontSize:'.72rem',fontWeight:600,cursor:'pointer'}}>
                      Parcial
                    </button>
                    <button onClick={()=>handleEstado(r.id,'devuelto')} style={{padding:'4px 12px',background:'rgba(74,158,106,.12)',color:C.acc,border:`1px solid ${C.acc}`,borderRadius:4,fontSize:'.72rem',fontWeight:600,cursor:'pointer'}}>
                      ✓ Devuelto
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length===0&&<div style={{textAlign:'center',padding:'40px',color:'#9aaa9e'}}>Sin anticipos</div>}
        </div>
      </div>
    </div>
  );
}

const LS = { display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:'#4A9E6A',letterSpacing:'.06em' };
const IS = { padding:'9px 12px',border:'1.5px solid #E8DCC8',borderRadius:4,fontSize:'.85rem',outline:'none',fontFamily:'inherit',width:'100%',marginTop:2 };
