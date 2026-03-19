import { useCollection } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const C = { green:'#1A3D28', acc:'#4A9E6A', cream:'#F5F0E4', sand:'#E8DCC8', danger:'#c0392b', warn:'#e67e22', bg:'#F9F6EF' };
const fmt = n => 'Q ' + Number(n||0).toLocaleString('es-GT', { minimumFractionDigits:0, maximumFractionDigits:0 });

const today = () => new Date().toISOString().slice(0,10);

function hoy(arr=[]) {
  const t = today();
  return arr.filter(r => (r.fecha||r.fechaEntrega||'').slice(0,10) === t).length;
}

function diasHasta(fechaStr) {
  if(!fechaStr) return null;
  const diff = new Date(fechaStr+'T00:00:00') - new Date(today()+'T00:00:00');
  return Math.ceil(diff / 86400000);
}

function StatCard({ icon, label, value, sub, color, onClick, alert, badge }) {
  return (
    <div onClick={onClick} style={{
      background:'#fff', border:`1.5px solid ${alert?C.danger:C.sand}`,
      borderRadius:8, padding:'18px 16px', cursor:onClick?'pointer':'default',
      transition:'box-shadow .15s', position:'relative',
    }}
    onMouseEnter={e=>{ if(onClick) e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.08)'; }}
    onMouseLeave={e=>{ e.currentTarget.style.boxShadow='none'; }}
    >
      <div style={{fontSize:'1.5rem',marginBottom:6}}>{icon}</div>
      <div style={{fontSize:'.7rem',color:'#6B8070',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:3}}>{label}</div>
      <div style={{fontSize:'1.8rem',fontWeight:800,color:color||C.green,lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:'.72rem',color:'#6B8070',marginTop:5}}>{sub}</div>}
      {alert&&<div style={{position:'absolute',top:8,right:8,background:C.danger,color:'#fff',borderRadius:100,padding:'2px 7px',fontSize:'.6rem',fontWeight:700}}>Sin hoy</div>}
      {badge!=null&&badge>0&&<div style={{position:'absolute',top:8,right:8,background:C.warn,color:'#fff',borderRadius:100,padding:'2px 7px',fontSize:'.6rem',fontWeight:700}}>{badge}</div>}
    </div>
  );
}

function ModuleRow({ icon, label, to, total, hoyCount, navigate }) {
  const sinHoy = hoyCount === 0;
  return (
    <div onClick={()=>navigate(to)} style={{
      display:'flex',alignItems:'center',gap:14,
      padding:'12px 16px',borderRadius:6,cursor:'pointer',
      background:'#fff',border:`1px solid ${sinHoy?C.danger+'44':C.sand}`,
      transition:'background .1s',
    }}>
      <span style={{fontSize:'1.2rem'}}>{icon}</span>
      <div style={{flex:1}}>
        <div style={{fontWeight:600,fontSize:'.85rem',color:C.green}}>{label}</div>
        <div style={{fontSize:'.72rem',color:'#6B8070'}}>{total} registros · {hoyCount} hoy</div>
      </div>
      {sinHoy&&<span style={{fontSize:'.65rem',background:C.danger,color:'#fff',padding:'2px 7px',borderRadius:100,fontWeight:700}}>Sin hoy</span>}
      <span style={{color:'#ccc'}}>›</span>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const alC   = useCollection('al',   { orderField:'fecha', limit:200 });
  const tlC   = useCollection('tl',   { orderField:'fecha', limit:200 });
  const dtC   = useCollection('dt',   { orderField:'fecha', limit:200 });
  const basC  = useCollection('bas',  { orderField:'fecha', limit:200 });
  const rodC  = useCollection('rod',  { orderField:'fecha', limit:200 });
  const gastosC   = useCollection('gastosDiarios', { orderField:'fecha', limit:500 });
  const walmartC  = useCollection('pedidosWalmart', { orderField:'fechaEntrega', orderDir:'desc', limit:200 });
  const gcC       = useCollection('gcConcursos',    { orderField:'fechaCierre',  orderDir:'asc',  limit:100 });

  const loading = alC.loading || tlC.loading;
  if(loading) return <LoadingSpinner text="Cargando dashboard..."/>;

  const t = today();
  const semanaInicio = (() => {
    const d = new Date(t+'T00:00:00'); const day = d.getDay();
    d.setDate(d.getDate() - (day===0?6:day-1)); return d.toISOString().slice(0,10);
  })();

  // Gastos
  const gastosHoy    = gastosC.data.filter(g=>g.fecha===t).reduce((s,g)=>s+(g.monto||0),0);
  const gastosSemana = gastosC.data.filter(g=>g.fecha>=semanaInicio).reduce((s,g)=>s+(g.monto||0),0);

  // Walmart pendientes
  const walmartPendientes = walmartC.data.filter(p=>p.estado==='pendiente'||p.estado==='en_proceso');

  // Concursos urgentes (cierre en ≤7 días)
  const gcUrgentes = gcC.data.filter(c=>{
    const dias = diasHasta(c.fechaCierre);
    return dias!=null && dias>=0 && dias<=7;
  });

  // Módulos BPM
  const modules = [
    { icon:'🙌', label:'Acceso y Lavado',     to:'/bpm/al',  data:alC.data  },
    { icon:'🚛', label:'Limpieza Transporte', to:'/bpm/tl',  data:tlC.data  },
    { icon:'📋', label:'Despacho Transporte', to:'/bpm/dt',  data:dtC.data  },
    { icon:'⚖️', label:'Básculas',            to:'/bpm/bas', data:basC.data },
    { icon:'🐭', label:'Control Roedores',    to:'/bpm/rod', data:rodC.data },
  ];

  const cumpleHoy = modules.filter(m=>hoy(m.data)>0).length;
  const pctCumple = Math.round(cumpleHoy/modules.length*100);
  const totalBpm  = modules.reduce((s,m)=>s+m.data.length, 0);

  return (
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:2}}>Dashboard</h1>
        <div style={{fontSize:'.82rem',color:'#6B8070'}}>
          {new Date().toLocaleDateString('es-GT',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
        </div>
      </div>

      {/* Stats principales */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:24}}>
        <StatCard icon="📊" label="Cumplimiento BPM hoy"
          value={pctCumple+'%'}
          sub={`${cumpleHoy}/${modules.length} módulos`}
          color={pctCumple>=80?C.acc:pctCumple>=50?C.warn:C.danger}
        />
        <StatCard icon="💸" label="Gastos hoy"
          value={fmt(gastosHoy)}
          sub={'Semana: '+fmt(gastosSemana)}
          color={C.green} onClick={()=>navigate('/gastos')}
        />
        <StatCard icon="📋" label="Registros BPM"
          value={totalBpm}
          sub="AL+TL+DT+BAS+ROD" color={C.green}
        />
        <StatCard icon="🙌" label="Accesos hoy"
          value={hoy(alC.data)}
          alert={hoy(alC.data)===0}
          onClick={()=>navigate('/bpm/al')}
        />
        <StatCard icon="🏪" label="Walmart pendientes"
          value={walmartPendientes.length}
          sub="pedidos activos"
          color={walmartPendientes.length>0?C.warn:C.acc}
          badge={walmartPendientes.length}
          onClick={()=>navigate('/walmart')}
        />
        <StatCard icon="🏛️" label="Concursos urgentes"
          value={gcUrgentes.length}
          sub="cierran en ≤7 días"
          color={gcUrgentes.length>0?C.danger:C.acc}
          badge={gcUrgentes.length}
          onClick={()=>navigate('/guatecompras')}
        />
      </div>

      {/* Concursos urgentes detalle */}
      {gcUrgentes.length>0&&(
        <div style={{background:'rgba(192,57,43,.07)',border:`1px solid rgba(192,57,43,.25)`,borderRadius:8,padding:'12px 16px',marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:'.82rem',color:C.danger,marginBottom:8}}>⚠ Concursos por cerrar</div>
          {gcUrgentes.slice(0,3).map(c=>(
            <div key={c.id} style={{fontSize:'.8rem',color:'#555',marginBottom:4,display:'flex',justifyContent:'space-between'}}>
              <span>{c.nom||c.id}</span>
              <span style={{fontWeight:700,color:diasHasta(c.fechaCierre)<=2?C.danger:C.warn}}>
                {diasHasta(c.fechaCierre)===0?'Hoy':diasHasta(c.fechaCierre)===1?'Mañana':`${diasHasta(c.fechaCierre)} días`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Estado módulos BPM */}
      <div style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'#6B8070',marginBottom:8}}>
        Estado módulos BPM — {t}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {modules.map(m=>(
          <ModuleRow key={m.to} {...m} hoyCount={hoy(m.data)} total={m.data.length} navigate={navigate}/>
        ))}
      </div>
    </div>
  );
}
