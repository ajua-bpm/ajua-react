import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green: '#1A3D28', acc: '#4A9E6A', sand: '#E8DCC8', danger: '#c0392b', bg: '#F9F6EF' };
const today = () => new Date().toISOString().slice(0, 10);

const TL_ITEMS = [
  'Interior del furgón limpio y sin residuos',
  'Exterior del furgón limpio',
  'Superficies de contacto con producto desinfectadas',
  'Sin olores inusuales',
  'Sistema de refrigeración funcionando',
  'Puertas cierran herméticamente',
  'Paredes en buen estado',
  'Piso limpio y seco',
];

export default function TL() {
  const toast = useToast();
  const { data, loading } = useCollection('tl', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { add, saving } = useWrite('tl');

  const [form, setForm] = useState({
    fecha: today(), hora: '', placa: '', resp: '',
    checks: TL_ITEMS.map(() => ''), obs: '',
  });

  const setCheck = (i, val) => setForm(f => {
    const checks = [...f.checks]; checks[i] = val; return { ...f, checks };
  });

  const handleSave = async () => {
    if (!form.fecha || !form.placa) { toast('⚠ Fecha y placa requeridas', 'error'); return; }
    const ok = form.checks.filter(c => c === 'si').length;
    const pct = Math.round(ok / TL_ITEMS.length * 100);
    await add({ ...form, ok, total: TL_ITEMS.length, pct, resultado: pct >= 80 ? 'cumple' : 'no_cumple' });
    toast('✓ Registro TL guardado');
    setForm(f => ({ ...f, placa: '', resp: '', checks: TL_ITEMS.map(() => ''), obs: '' }));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.green, marginBottom: 4 }}>🚛 Limpieza de Camiones</h1>
      <p style={{ fontSize: '.82rem', color: '#6B8070', marginBottom: 24 }}>Control de limpieza y desinfección de furgones</p>

      <div style={{ background: '#fff', border: `1px solid ${C.sand}`, borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginBottom: 16 }}>
          {[['fecha','date','Fecha',form.fecha],['hora','time','Hora',form.hora],['placa','text','Placa',form.placa],['resp','text','Responsable',form.resp]].map(([id,type,label,val]) => (
            <label key={id} style={{ display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em' }}>
              {label}
              <input type={type} value={val} onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
                style={{ padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none' }} />
            </label>
          ))}
        </div>

        {TL_ITEMS.map((item, i) => (
          <div key={i} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:`1px solid ${C.sand}` }}>
            <span style={{ flex:1,fontSize:'.83rem' }}>{item}</span>
            {['si','no','na'].map(v => (
              <button key={v} onClick={() => setCheck(i, v)} style={{
                padding:'5px 12px',borderRadius:4,fontSize:'.75rem',fontWeight:600,cursor:'pointer',
                border:`1.5px solid ${form.checks[i]===v?(v==='si'?C.acc:v==='no'?C.danger:C.sand):C.sand}`,
                background: form.checks[i]===v?(v==='si'?C.acc:v==='no'?C.danger:'#f0f0f0'):'#fff',
                color: form.checks[i]===v&&v!=='na'?'#fff':'#555',
              }}>
                {v.toUpperCase()}
              </button>
            ))}
          </div>
        ))}

        <textarea value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))}
          placeholder="Observaciones..." rows={2} style={{ width:'100%',marginTop:12,padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical' }} />

        <button onClick={handleSave} disabled={saving} style={{ marginTop:12,padding:'12px 28px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer' }}>
          {saving ? 'Guardando...' : 'Guardar Registro TL'}
        </button>
      </div>

      <div style={{ background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20 }}>
        <div style={{ fontWeight:700,marginBottom:12,color:C.green }}>Historial ({data.length})</div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'.8rem' }}>
            <thead><tr style={{ background:C.bg }}>
              {['Fecha','Hora','Placa','Resp.','OK','%','Resultado'].map(h => (
                <th key={h} style={{ padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}` }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.slice(0,50).map(r => (
                <tr key={r.id} style={{ borderBottom:`1px solid ${C.sand}` }}>
                  <td style={{ padding:'7px 10px',fontWeight:600 }}>{r.fecha}</td>
                  <td style={{ padding:'7px 10px',color:'#6B8070' }}>{r.hora||'—'}</td>
                  <td style={{ padding:'7px 10px' }}>{r.placa||'—'}</td>
                  <td style={{ padding:'7px 10px' }}>{r.resp||'—'}</td>
                  <td style={{ padding:'7px 10px' }}>{r.ok||0}/{r.total||0}</td>
                  <td style={{ padding:'7px 10px',fontWeight:700,color:(r.pct||0)>=80?C.acc:C.danger }}>{r.pct||0}%</td>
                  <td style={{ padding:'7px 10px' }}>
                    <span style={{ padding:'2px 8px',borderRadius:100,fontSize:'.65rem',fontWeight:700,background:r.resultado==='cumple'?'rgba(74,158,106,.15)':'rgba(192,57,43,.12)',color:r.resultado==='cumple'?C.acc:C.danger }}>
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
