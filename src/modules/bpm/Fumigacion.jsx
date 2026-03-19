import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF' };
const today = () => new Date().toISOString().slice(0,10);

const AREAS = ['Cooler 1','Cooler 2','Pre-carga','Bodega principal','Baños','Área externa'];
const TIPOS = ['Fumigación empresa externa','Desinfección con cloro','Control de plagas interno','Nebulización'];

export default function Fumigacion() {
  const toast = useToast();
  const { data, loading } = useCollection('fum', { orderField:'fecha', orderDir:'desc', limit:200 });
  const { add, saving } = useWrite('fum');

  const [form, setForm] = useState({
    fecha: today(), tipo: '', empresa: '', responsable: '',
    producto: '', dosis: '', frecuencia: '',
    areas: [], obs: '', resultado: 'aprobado',
  });

  const toggleArea = (a) => setForm(f => ({
    ...f, areas: f.areas.includes(a) ? f.areas.filter(x=>x!==a) : [...f.areas, a]
  }));

  const handleSave = async () => {
    if (!form.fecha || !form.tipo || !form.responsable) {
      toast('⚠ Fecha, tipo y responsable requeridos', 'error'); return;
    }
    await add({ ...form });
    toast('✓ Registro FUM guardado');
    setForm(f => ({ ...f, tipo:'', empresa:'', responsable:'', producto:'', dosis:'', frecuencia:'', areas:[], obs:'', resultado:'aprobado' }));
  };

  const f = form;
  const inp = (id, label, type='text', opts={}) => (
    <label style={{ display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em' }}>
      {label}
      <input type={type} value={f[id]} onChange={e=>setForm(p=>({...p,[id]:e.target.value}))} {...opts}
        style={{ padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none' }}/>
    </label>
  );

  if (loading) return <LoadingSpinner/>;

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>🧪 Control de Fumigación</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Registro de fumigaciones y desinfecciones</p>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:16}}>
          {inp('fecha','Fecha','date')}
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Tipo
            <select value={f.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              <option value="">— Seleccionar —</option>
              {TIPOS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {inp('empresa','Empresa / Proveedor')}
          {inp('responsable','Responsable')}
          {inp('producto','Producto / Químico')}
          {inp('dosis','Dosis / Concentración')}
          {inp('frecuencia','Frecuencia')}
          <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
            Resultado
            <select value={f.resultado} onChange={e=>setForm(p=>({...p,resultado:e.target.value}))}
              style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}>
              <option value="aprobado">✓ Aprobado</option>
              <option value="observaciones">⚠ Con observaciones</option>
              <option value="rechazado">✗ Rechazado</option>
            </select>
          </label>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em',marginBottom:8}}>Áreas tratadas</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {AREAS.map(a=>(
              <button key={a} onClick={()=>toggleArea(a)} style={{
                padding:'6px 14px',borderRadius:20,fontSize:'.78rem',fontWeight:600,cursor:'pointer',
                border:`1.5px solid ${f.areas.includes(a)?C.acc:C.sand}`,
                background:f.areas.includes(a)?C.acc:'#fff',
                color:f.areas.includes(a)?'#fff':'#555',
              }}>{a}</button>
            ))}
          </div>
        </div>

        <textarea value={f.obs} onChange={e=>setForm(p=>({...p,obs:e.target.value}))}
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
              {['Fecha','Tipo','Empresa','Responsable','Producto','Áreas','Resultado'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.slice(0,50).map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.fecha}</td>
                  <td style={{padding:'7px 10px'}}>{r.tipo||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.empresa||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.responsable||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.producto||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{(r.areas||[]).join(', ')||'—'}</td>
                  <td style={{padding:'7px 10px'}}>
                    <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,
                      background:r.resultado==='aprobado'?'rgba(74,158,106,.15)':r.resultado==='rechazado'?'rgba(192,57,43,.12)':'rgba(255,165,0,.12)',
                      color:r.resultado==='aprobado'?C.acc:r.resultado==='rechazado'?C.danger:'#e67e22'}}>
                      {r.resultado==='aprobado'?'✓ Aprobado':r.resultado==='rechazado'?'✗ Rechazado':'⚠ Observaciones'}
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
