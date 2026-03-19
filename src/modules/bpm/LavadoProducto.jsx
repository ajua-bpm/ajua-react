import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF' };
const today = () => new Date().toISOString().slice(0,10);

const CHECKS = [
  'Producto pre-lavado con agua potable',
  'Solución desinfectante preparada correctamente',
  'Tiempo de contacto cumplido (≥3 min)',
  'Enjuague final con agua potable',
  'Superficies de contacto desinfectadas',
  'Personal con equipo de protección',
  'Temperatura de agua adecuada',
  'Registro de concentración de cloro',
];

export default function LavadoProducto() {
  const toast = useToast();
  const { data, loading } = useCollection('lavadoProd', { orderField:'fecha', orderDir:'desc', limit:200 });
  const { add, saving } = useWrite('lavadoProd');

  const [form, setForm] = useState({
    fecha: today(), hora: '', producto: '', lote: '',
    responsable: '', concentracion: '',
    checks: CHECKS.map(()=>null), obs: '', resultado: '',
  });

  const setCheck = (i, val) => setForm(f => {
    const checks = [...f.checks]; checks[i] = val; return { ...f, checks };
  });

  const handleSave = async () => {
    if (!form.fecha || !form.producto || !form.responsable) {
      toast('⚠ Fecha, producto y responsable requeridos', 'error'); return;
    }
    const ok = form.checks.filter(c=>c===true).length;
    const pct = Math.round(ok / CHECKS.length * 100);
    const resultado = pct >= 85 ? 'aprobado' : 'no_aprobado';
    await add({ ...form, ok, total: CHECKS.length, pct, resultado });
    toast('✓ Registro lavado guardado');
    setForm(f => ({ ...f, producto:'', lote:'', responsable:'', concentracion:'', checks:CHECKS.map(()=>null), obs:'' }));
  };

  if (loading) return <LoadingSpinner/>;

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>💧 Lavado y Desinfección de Producto</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Control del proceso de lavado y desinfección de vegetales</p>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:16}}>
          {[['fecha','Fecha','date'],['hora','Hora','time'],['producto','Producto','text'],
            ['lote','Lote','text'],['responsable','Responsable','text'],['concentracion','Conc. cloro (ppm)','text']].map(([id,label,type])=>(
            <label key={id} style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              {label}
              <input type={type} value={form[id]} onChange={e=>setForm(f=>({...f,[id]:e.target.value}))}
                style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
            </label>
          ))}
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em',marginBottom:10}}>
            Lista de verificación
          </div>
          {CHECKS.map((item, i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:`1px solid ${C.sand}`}}>
              <span style={{flex:1,fontSize:'.83rem'}}>{item}</span>
              {[{v:true,label:'✓ Sí'},{v:false,label:'✗ No'}].map(({v,label})=>(
                <button key={String(v)} onClick={()=>setCheck(i,v)} style={{
                  padding:'5px 12px',borderRadius:4,fontSize:'.75rem',fontWeight:600,cursor:'pointer',
                  border:`1.5px solid ${form.checks[i]===v?(v?C.acc:C.danger):C.sand}`,
                  background:form.checks[i]===v?(v?C.acc:C.danger):'#fff',
                  color:form.checks[i]===v?'#fff':'#555',
                }}>{label}</button>
              ))}
            </div>
          ))}
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
              {['Fecha','Hora','Producto','Lote','Responsable','%','Resultado'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.slice(0,50).map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.fecha}</td>
                  <td style={{padding:'7px 10px'}}>{r.hora||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.producto||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.lote||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.responsable||'—'}</td>
                  <td style={{padding:'7px 10px',fontWeight:700,color:(r.pct||0)>=85?C.acc:C.danger}}>{r.pct||0}%</td>
                  <td style={{padding:'7px 10px'}}>
                    <span style={{padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,
                      background:r.resultado==='aprobado'?'rgba(74,158,106,.15)':'rgba(192,57,43,.12)',
                      color:r.resultado==='aprobado'?C.acc:C.danger}}>
                      {r.resultado==='aprobado'?'✓ Aprobado':'✗ No aprobado'}
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
