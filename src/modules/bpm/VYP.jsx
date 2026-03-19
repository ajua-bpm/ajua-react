import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28', acc:'#4A9E6A', sand:'#E8DCC8', danger:'#c0392b', bg:'#F9F6EF', warn:'#e67e22' };
const today = () => new Date().toISOString().slice(0,10);

const AREAS = ['Cooler 1','Cooler 2','Pre-carga','Bodega general','Área de proceso','Baños','Externo'];
const TIPOS = ['Vidrio','Plástico','Metal','Madera','Otro material extraño'];
const ACCIONES = ['Retirado y desechado','Área bloqueada temporalmente','Producto retenido para inspección','Notificado a supervisor','Investigación en proceso'];

const SEV = {
  bajo:  { color:'#27ae60', bg:'rgba(39,174,96,.12)',   label:'Bajo' },
  medio: { color:'#e67e22', bg:'rgba(230,126,34,.12)',  label:'Medio' },
  alto:  { color:'#c0392b', bg:'rgba(192,57,43,.12)',   label:'Alto' },
};

export default function VYP() {
  const toast = useToast();
  const { data, loading } = useCollection('vyp', { orderField:'fecha', orderDir:'desc', limit:200 });
  const { add, saving } = useWrite('vyp');

  const [form, setForm] = useState({
    fecha: today(), resp: '', area: '', tipo: 'Vidrio',
    descripcion: '', cantidad: '', severidad: 'medio',
    accion: '', foto: '', obs: '',
  });

  const handleSave = async () => {
    if(!form.fecha || !form.area || !form.descripcion) {
      toast('⚠ Fecha, área y descripción requeridos','error'); return;
    }
    await add(form);
    toast('✓ Hallazgo VYP registrado');
    setForm(f => ({...f, area:'', descripcion:'', cantidad:'', accion:'', foto:'', obs:'', resp:''}));
  };

  if(loading) return <LoadingSpinner/>;

  const totalAlto  = data.filter(r=>r.severidad==='alto').length;
  const totalMedio = data.filter(r=>r.severidad==='medio').length;

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>🔍 Vidrio y Plástico</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:16}}>Registro de hallazgos de materiales extraños — vidrio, plástico, metal</p>

      {/* Resumen */}
      {(totalAlto>0||totalMedio>0)&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          <div style={{background:SEV.alto.bg,border:`1px solid ${SEV.alto.color}44`,borderRadius:8,padding:'10px 14px'}}>
            <div style={{fontSize:'.7rem',fontWeight:700,color:SEV.alto.color,textTransform:'uppercase'}}>Severidad Alta</div>
            <div style={{fontSize:'1.8rem',fontWeight:800,color:SEV.alto.color}}>{totalAlto}</div>
          </div>
          <div style={{background:SEV.medio.bg,border:`1px solid ${SEV.medio.color}44`,borderRadius:8,padding:'10px 14px'}}>
            <div style={{fontSize:'.7rem',fontWeight:700,color:SEV.medio.color,textTransform:'uppercase'}}>Severidad Media</div>
            <div style={{fontSize:'1.8rem',fontWeight:800,color:SEV.medio.color}}>{totalMedio}</div>
          </div>
        </div>
      )}

      {/* Formulario */}
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,fontSize:'.9rem',color:C.green,marginBottom:14}}>Registrar Hallazgo</div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:12}}>
          <label style={L}>Fecha<input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} style={I}/></label>
          <label style={L}>Responsable<input value={form.resp} onChange={e=>setForm(f=>({...f,resp:e.target.value}))} style={I}/></label>
          <label style={L}>Área
            <select value={form.area} onChange={e=>setForm(f=>({...f,area:e.target.value}))} style={I}>
              <option value="">— Seleccionar —</option>
              {AREAS.map(a=><option key={a}>{a}</option>)}
            </select>
          </label>
          <label style={L}>Tipo material
            <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))} style={I}>
              {TIPOS.map(t=><option key={t}>{t}</option>)}
            </select>
          </label>
          <label style={L}>Cantidad / tamaño
            <input value={form.cantidad} onChange={e=>setForm(f=>({...f,cantidad:e.target.value}))} placeholder="ej: 3 fragmentos" style={I}/>
          </label>
          <label style={L}>Severidad
            <select value={form.severidad} onChange={e=>setForm(f=>({...f,severidad:e.target.value}))} style={{...I,color:SEV[form.severidad]?.color,fontWeight:700}}>
              <option value="bajo">Bajo</option>
              <option value="medio">Medio</option>
              <option value="alto">Alto</option>
            </select>
          </label>
        </div>

        <label style={{...L,display:'block',marginBottom:12}}>
          Descripción del hallazgo *
          <input value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} placeholder="Descripción detallada..." style={I}/>
        </label>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
          <label style={L}>Acción tomada
            <select value={form.accion} onChange={e=>setForm(f=>({...f,accion:e.target.value}))} style={I}>
              <option value="">— Seleccionar —</option>
              {ACCIONES.map(a=><option key={a}>{a}</option>)}
            </select>
          </label>
          <label style={L}>Foto (URL o código)
            <input value={form.foto} onChange={e=>setForm(f=>({...f,foto:e.target.value}))} placeholder="URL foto..." style={I}/>
          </label>
        </div>

        <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} placeholder="Observaciones adicionales..." rows={2}
          style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical',marginBottom:12}}/>

        <button onClick={handleSave} disabled={saving} style={{padding:'12px 28px',background:saving?'#ccc':C.danger,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer'}}>
          {saving?'Guardando...':'Registrar Hallazgo'}
        </button>
      </div>

      {/* Historial */}
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{fontWeight:700,marginBottom:12,color:C.green}}>Historial ({data.length})</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {data.slice(0,50).map(r=>{
            const sev = SEV[r.severidad] || SEV.medio;
            return (
              <div key={r.id} style={{border:`1px solid ${C.sand}`,borderRadius:6,padding:'12px 14px',borderLeft:`4px solid ${sev.color}`}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:'.85rem',color:C.green}}>{r.tipo||'—'} · {r.area||'—'}</div>
                    <div style={{fontSize:'.78rem',color:'#555',marginTop:2}}>{r.descripcion||'—'}</div>
                    {r.accion&&<div style={{fontSize:'.72rem',color:'#6B8070',marginTop:4}}>Acción: {r.accion}</div>}
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:'.72rem',fontWeight:600,color:'#6B8070'}}>{r.fecha}</div>
                    <span style={{display:'inline-block',marginTop:4,padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,background:sev.bg,color:sev.color}}>
                      {sev.label}
                    </span>
                  </div>
                </div>
                {r.resp&&<div style={{fontSize:'.7rem',color:'#9aaa9e',marginTop:6}}>Responsable: {r.resp}</div>}
              </div>
            );
          })}
          {data.length===0&&<div style={{textAlign:'center',padding:'40px',color:'#9aaa9e'}}>Sin hallazgos registrados</div>}
        </div>
      </div>
    </div>
  );
}

const L = { display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:'#4A9E6A',letterSpacing:'.06em' };
const I = { padding:'9px 12px',border:'1.5px solid #E8DCC8',borderRadius:4,fontSize:'.85rem',outline:'none',fontFamily:'inherit',width:'100%',marginTop:2 };
