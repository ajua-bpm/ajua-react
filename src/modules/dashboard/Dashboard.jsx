import { useCollection } from '../../hooks/useFirestore';
import Skeleton from '../../components/Skeleton';

const T = { primary:'#1B5E20', secondary:'#2E7D32', textMid:'#616161', danger:'#C62828', warn:'#E65100' };
const today = () => new Date().toISOString().slice(0,10);
const thisWeek = () => { const d=new Date(); d.setDate(d.getDate()-7); return d.toISOString().slice(0,10); };
const fmt = (n) => `Q ${(n||0).toLocaleString('es-GT', { minimumFractionDigits:2 })}`;

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:'18px 20px', display:'flex', alignItems:'flex-start', gap:14 }}>
      {icon && <div style={{ fontSize:'1.5rem', lineHeight:1, marginTop:2 }}>{icon}</div>}
      <div style={{ flex:1 }}>
        <div style={{ fontSize:'1.5rem', fontWeight:800, color:color||T.primary, lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:'.78rem', fontWeight:600, color:'#212121', marginTop:4 }}>{label}</div>
        {sub && <div style={{ fontSize:'.72rem', color:T.textMid, marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function BpmCard({ icon, label, ok, total }) {
  const pct = total > 0 ? Math.round(ok / total * 100) : null;
  const bc = pct === null ? '#E0E0E0' : pct >= 80 ? T.secondary : pct >= 60 ? T.warn : T.danger;
  return (
    <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.08)', padding:'14px 16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:'.82rem', fontWeight:600 }}>{icon} {label}</span>
        {pct !== null && <span style={{ fontSize:'.78rem', fontWeight:700, color:bc }}>{pct}%</span>}
      </div>
      {pct !== null
        ? <div style={{ height:4, background:'#F0F0F0', borderRadius:2 }}>
            <div style={{ height:'100%', width:`${pct}%`, background:bc, borderRadius:2, transition:'width .4s' }} />
          </div>
        : <div style={{ fontSize:'.72rem', color:'#9E9E9E' }}>Sin registros</div>
      }
      <div style={{ fontSize:'.7rem', color:T.textMid, marginTop:6 }}>
        {total > 0 ? `${ok} / ${total} cumplen` : '—'}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const td = today(), wk = thisWeek();
  const tlC   = useCollection('tl',   { orderField:'fecha', orderDir:'desc', limit:100 });
  const dtC   = useCollection('dt',   { orderField:'fecha', orderDir:'desc', limit:100 });
  const alC   = useCollection('al',   { orderField:'fecha', orderDir:'desc', limit:100 });
  const basC  = useCollection('bas',  { orderField:'fecha', orderDir:'desc', limit:100 });
  const rodC  = useCollection('rod',  { orderField:'fecha', orderDir:'desc', limit:100 });
  const limpC = useCollection('limp', { orderField:'fecha', orderDir:'desc', limit:100 });
  const wmC   = useCollection('pedidosWalmart', { orderField:'fechaEntrega', orderDir:'asc', limit:100 });
  const gcC   = useCollection('gcConcursos', { orderField:'fechaCierre', orderDir:'asc', limit:50 });
  const gasC  = useCollection('gastosDiarios', { orderField:'fecha', orderDir:'desc', limit:100 });
  const vtC   = useCollection('vgtVentas', { orderField:'fecha', orderDir:'desc', limit:100 });

  if (tlC.loading && dtC.loading) return (
    <div>
      <h1 style={{ fontSize:'1.35rem', fontWeight:700, color:T.primary, marginBottom:20 }}>Dashboard</h1>
      <Skeleton rows={8} />
    </div>
  );

  const bpmStats = (arr) => {
    const week = arr.filter(r => r.fecha >= wk);
    return { ok: week.filter(r => ['cumple','ok','aprobado','sin_novedades'].includes(r.resultado)).length, total: week.length };
  };

  const wmPending  = wmC.data.filter(r => !r.estado || r.estado === 'pendiente');
  const ventasWeek = vtC.data.filter(r => r.fecha >= wk && r.estado !== 'cancelado').reduce((s,r) => s+(r.total||0), 0);
  const gastosHoy  = gasC.data.filter(r => r.fecha === td).reduce((s,r) => s+(r.monto||0), 0);
  const gastosWeek = gasC.data.filter(r => r.fecha >= wk).reduce((s,r) => s+(r.monto||0), 0);
  const sevenDays  = new Date(); sevenDays.setDate(sevenDays.getDate() + 7);
  const gcUrgent   = gcC.data.filter(r => r.fechaCierre && new Date(r.fechaCierre) <= sevenDays && r.estado !== 'cerrado');

  return (
    <div className="fade-in">
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:'1.35rem', fontWeight:700, color:T.primary, marginBottom:4 }}>Dashboard</h1>
        <p style={{ fontSize:'.82rem', color:T.textMid }}>
          {new Date().toLocaleDateString('es-GT', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
        </p>
      </div>

      {(wmPending.length > 0 || gcUrgent.length > 0) && (
        <div style={{ marginBottom:20, display:'flex', flexDirection:'column', gap:8 }}>
          {wmPending.length > 0 && (
            <div style={{ background:'#FFF3E0', border:'1.5px solid #FFB74D', borderRadius:8, padding:'11px 16px', display:'flex', gap:10, alignItems:'center' }}>
              <span>⚠️</span>
              <span style={{ fontSize:'.85rem', fontWeight:600, color:'#E65100' }}>
                {wmPending.length} pedido{wmPending.length>1?'s':''} de Walmart pendiente{wmPending.length>1?'s':''}
              </span>
            </div>
          )}
          {gcUrgent.length > 0 && (
            <div style={{ background:'#FFEBEE', border:'1.5px solid #EF9A9A', borderRadius:8, padding:'11px 16px', display:'flex', gap:10, alignItems:'center' }}>
              <span>🏛️</span>
              <span style={{ fontSize:'.85rem', fontWeight:600, color:T.danger }}>
                {gcUrgent.length} concurso{gcUrgent.length>1?'s':''} vence{gcUrgent.length>1?'n':''} en 7 días
              </span>
            </div>
          )}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:12, marginBottom:24 }}>
        <StatCard icon="📤" label="Ventas esta semana" value={fmt(ventasWeek)} color={T.secondary} />
        <StatCard icon="💸" label="Gastos hoy" value={fmt(gastosHoy)} sub={`Semana: ${fmt(gastosWeek)}`} color={T.warn} />
        <StatCard icon="📦" label="Walmart pendientes" value={wmPending.length} color={wmPending.length>0?T.danger:T.secondary} />
        <StatCard icon="🏛️" label="Concursos urgentes" value={gcUrgent.length} color={gcUrgent.length>0?T.danger:T.secondary} />
      </div>

      <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:20, marginBottom:20 }}>
        <div style={{ fontWeight:700, color:T.primary, marginBottom:14 }}>Cumplimiento BPM — Última semana</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))', gap:10 }}>
          <BpmCard icon="🚛" label="Limpieza Transporte" {...bpmStats(tlC.data)} />
          <BpmCard icon="📋" label="Despacho"            {...bpmStats(dtC.data)} />
          <BpmCard icon="🙌" label="Acceso y Lavado"     {...bpmStats(alC.data)} />
          <BpmCard icon="⚖️" label="Básculas"             {...bpmStats(basC.data)} />
          <BpmCard icon="🐀" label="Roedores"             {...bpmStats(rodC.data)} />
          <BpmCard icon="🧹" label="Limpieza Bodega"      {...bpmStats(limpC.data)} />
        </div>
      </div>

      {wmPending.length > 0 && (
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:20, marginBottom:20 }}>
          <div style={{ fontWeight:700, color:T.primary, marginBottom:12 }}>Pedidos Walmart — Pendientes</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr style={{ background:T.primary }}>
                {['Fecha Entrega','Descripción','Total'].map(h=>(
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', color:'#fff', fontSize:'.72rem', fontWeight:600, textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {wmPending.slice(0,5).map((r,i)=>(
                  <tr key={r.id} style={{ background:i%2===0?'#fff':'#F9FBF9', borderBottom:'1px solid #F0F0F0' }}>
                    <td style={{ padding:'9px 12px', fontWeight:600 }}>{r.fechaEntrega||'—'}</td>
                    <td style={{ padding:'9px 12px', color:T.textMid }}>{r.descripcion||r.productos||'—'}</td>
                    <td style={{ padding:'9px 12px', fontWeight:700, color:T.secondary }}>{r.total?fmt(r.total):'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {gcUrgent.length > 0 && (
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:20 }}>
          <div style={{ fontWeight:700, color:T.primary, marginBottom:12 }}>Guatecompras — Próximos a vencer</div>
          {gcUrgent.slice(0,5).map((r,i)=>(
            <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:i<gcUrgent.length-1?'1px solid #F0F0F0':'none' }}>
              <span style={{ fontSize:'.83rem' }}>{r.nombre||r.descripcion||r.id}</span>
              <span style={{ background:'#FFEBEE', color:T.danger, padding:'3px 10px', borderRadius:100, fontSize:'.72rem', fontWeight:600 }}>
                Cierra {r.fechaCierre}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
