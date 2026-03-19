import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green: '#1A3D28', acc: '#4A9E6A', sand: '#E8DCC8', danger: '#c0392b', bg: '#F9F6EF' };
const today = () => new Date().toISOString().slice(0, 10);

const DT_ITEMS = [
  { area: 'Vehículo', item: 'Interior limpio y sin residuos' },
  { area: 'Vehículo', item: 'Exterior limpio' },
  { area: 'Vehículo', item: 'Superficies de producto desinfectadas' },
  { area: 'Vehículo', item: 'Sin olores fuertes o inusuales' },
  { area: 'Vehículo', item: 'Sin plagas visibles' },
  { area: 'Equipos', item: 'Sistema de refrigeración funciona' },
  { area: 'Equipos', item: 'Puertas cierran herméticamente' },
  { area: 'Equipos', item: 'Paredes en buen estado' },
  { area: 'Equipos', item: 'Piso limpio, seco y sin roturas' },
  { area: 'Equipos', item: 'Ventilación adecuada' },
];

export default function DT() {
  const toast = useToast();
  const { data, loading } = useCollection('dt', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const conductores = useCollection('conductores', {});
  const clientes    = useCollection('clientes', {});
  const { add, saving } = useWrite('dt');

  const [form, setForm] = useState({
    fecha: today(), hora: '', placa: '',
    conductorId: '', clienteId: '',
    carga: '', temp: '',
    checks: DT_ITEMS.map(() => ''),
    obs: '', accion: '', autorizado: '',
  });

  const setCheck = (i, val) => setForm(f => { const c=[...f.checks]; c[i]=val; return {...f,checks:c}; });

  const selectedCond = (conductores.data||[]).find(c => c.id === form.conductorId);
  const selectedCli  = (clientes.data||[]).find(c => c.id === form.clienteId);

  const handleSave = async () => {
    if (!form.fecha || !form.placa) { toast('⚠ Fecha y placa requeridas', 'error'); return; }
    if (!form.conductorId) { toast('⚠ Seleccioná un conductor', 'error'); return; }
    const ok  = form.checks.filter(c => c === 'si').length;
    const pct = Math.round(ok / DT_ITEMS.length * 100);
    await add({
      ...form,
      conductorNombre: selectedCond?.nombre || '',
      conductorLic:    selectedCond?.lic || '',
      clienteNombre:   selectedCli?.nombre || 'Sin destino',
      clienteDir:      [selectedCli?.dir, selectedCli?.muni].filter(Boolean).join(', '),
      ok, total: DT_ITEMS.length, pct,
      resultado: pct >= 80 ? 'cumple' : 'no_cumple',
    });
    toast('✓ Registro DT guardado');
    setForm(f => ({ ...f, placa:'', conductorId:'', clienteId:'', carga:'', temp:'', checks:DT_ITEMS.map(()=>''), obs:'', accion:'' }));
  };

  if (loading) return <LoadingSpinner />;

  let lastArea = '';
  return (
    <div>
      <h1 style={{ fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4 }}>📋 Despacho Transporte</h1>
      <p style={{ fontSize:'.82rem',color:'#6B8070',marginBottom:24 }}>Checklist de conformidad de carga antes del despacho</p>

      <div style={{ background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20 }}>
        {/* Campos básicos */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:16 }}>
          {[['fecha','date','Fecha',form.fecha],['hora','time','Hora',form.hora],['placa','text','Placa',form.placa],['temp','number','Temp °C',form.temp]].map(([id,type,label,val])=>(
            <label key={id} style={{ display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em' }}>
              {label}
              <input type={type} value={val} onChange={e=>setForm(f=>({...f,[id]:e.target.value}))}
                style={{ padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none' }} />
            </label>
          ))}
        </div>

        {/* Conductor */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16 }}>
          <label style={{ display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em' }}>
            Conductor
            <select value={form.conductorId} onChange={e=>setForm(f=>({...f,conductorId:e.target.value}))}
              style={{ padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none' }}>
              <option value="">— Seleccionar —</option>
              {(conductores.data||[]).map(c=><option key={c.id} value={c.id}>{c.nombre} · {c.lic||'—'}</option>)}
            </select>
            {selectedCond && <span style={{ fontSize:'.7rem',color:'#6B8070',marginTop:2 }}>Lic: {selectedCond.lic||'—'} · Venc: {selectedCond.venc||'—'}</span>}
          </label>
          <label style={{ display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em' }}>
            Cliente / Destino
            <select value={form.clienteId} onChange={e=>setForm(f=>({...f,clienteId:e.target.value}))}
              style={{ padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none' }}>
              <option value="">— Seleccionar —</option>
              {(clientes.data||[]).map(c=><option key={c.id} value={c.id}>{c.nombre}{c.muni?' · '+c.muni:''}</option>)}
            </select>
            {selectedCli && <span style={{ fontSize:'.7rem',color:'#6B8070',marginTop:2 }}>{selectedCli.dir||''}</span>}
          </label>
        </div>

        {/* Checklist */}
        {DT_ITEMS.map((x, i) => {
          const showHeader = x.area !== lastArea; lastArea = x.area;
          return (
            <div key={i}>
              {showHeader && <div style={{ fontWeight:700,fontSize:'.72rem',textTransform:'uppercase',color:'#6B8070',padding:'10px 0 4px',letterSpacing:'.08em' }}>{x.area}</div>}
              <div style={{ display:'flex',alignItems:'center',gap:12,padding:'9px 0',borderBottom:`1px solid ${C.sand}` }}>
                <span style={{ flex:1,fontSize:'.83rem' }}>{x.item}</span>
                {['si','no'].map(v=>(
                  <button key={v} onClick={()=>setCheck(i,v)} style={{
                    padding:'5px 14px',borderRadius:4,fontSize:'.75rem',fontWeight:600,cursor:'pointer',
                    border:`1.5px solid ${form.checks[i]===v?(v==='si'?C.acc:C.danger):C.sand}`,
                    background:form.checks[i]===v?(v==='si'?C.acc:C.danger):'#fff',
                    color:form.checks[i]===v?'#fff':'#555',
                  }}>{v.toUpperCase()}</button>
                ))}
              </div>
            </div>
          );
        })}

        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:14 }}>
          <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} placeholder="Observaciones generales..." rows={2}
            style={{ padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical' }} />
          <textarea value={form.accion} onChange={e=>setForm(f=>({...f,accion:e.target.value}))} placeholder="Acción correctiva..." rows={2}
            style={{ padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical' }} />
        </div>

        <label style={{ display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em',marginTop:12,maxWidth:240 }}>
          Autorizado
          <select value={form.autorizado} onChange={e=>setForm(f=>({...f,autorizado:e.target.value}))}
            style={{ padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none' }}>
            <option value="">— Seleccionar —</option>
            <option value="si">✓ Autorizado</option>
            <option value="condicional">⚠ Condicional</option>
            <option value="no">✗ Rechazado</option>
          </select>
        </label>

        <button onClick={handleSave} disabled={saving} style={{ marginTop:16,padding:'12px 28px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer' }}>
          {saving?'Guardando...':'Guardar Inspección DT'}
        </button>
      </div>

      {/* Historial */}
      <div style={{ background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20 }}>
        <div style={{ fontWeight:700,marginBottom:12,color:C.green }}>Historial ({data.length})</div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'.8rem' }}>
            <thead><tr style={{ background:C.bg }}>
              {['Fecha','Placa','Conductor','Cliente','%','Autorizado'].map(h=>(
                <th key={h} style={{ padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.slice(0,50).map(r=>(
                <tr key={r.id} style={{ borderBottom:`1px solid ${C.sand}` }}>
                  <td style={{ padding:'7px 10px',fontWeight:600 }}>{r.fecha}</td>
                  <td style={{ padding:'7px 10px' }}>{r.placa||'—'}</td>
                  <td style={{ padding:'7px 10px' }}>{r.conductorNombre||'—'}</td>
                  <td style={{ padding:'7px 10px',fontSize:'.72rem' }}>{r.clienteNombre||'—'}</td>
                  <td style={{ padding:'7px 10px',fontWeight:700,color:(r.pct||0)>=80?C.acc:C.danger }}>{r.pct||0}%</td>
                  <td style={{ padding:'7px 10px' }}>
                    <span style={{ padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,
                      background:r.autorizado==='si'?'rgba(74,158,106,.15)':r.autorizado==='no'?'rgba(192,57,43,.12)':'rgba(230,126,34,.12)',
                      color:r.autorizado==='si'?C.acc:r.autorizado==='no'?C.danger:'#e67e22' }}>
                      {r.autorizado==='si'?'✓ Autoriz.':r.autorizado==='no'?'✗ Rechaz.':r.autorizado||'—'}
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
