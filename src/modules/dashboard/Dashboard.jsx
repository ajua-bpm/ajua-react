import { useMemo, useState } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import { useMainData } from '../../hooks/useMainData';
import { useNotifications } from '../../hooks/useNotifications';
import Skeleton from '../../components/Skeleton';

function NotifBanner() {
  const { permission, supported, requestPermission } = useNotifications();
  if (!supported || permission === 'granted' || permission === 'denied') return null;
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      gap:12, flexWrap:'wrap',
      background:'var(--white)', border:'1px solid var(--border)',
      borderLeft:'3px solid var(--forest)', borderRadius:4,
      padding:'11px 16px', marginBottom:20, fontSize:'13px',
    }}>
      <span style={{ color:'var(--ink)', fontWeight:500 }}>
        🔔 Recibí alertas de pedidos nuevos en este dispositivo
      </span>
      <button onClick={requestPermission} style={{
        padding:'6px 16px', background:'var(--forest)', color:'#fff',
        border:'none', borderRadius:3, fontWeight:700, fontSize:'11px',
        letterSpacing:'1px', textTransform:'uppercase', cursor:'pointer',
        fontFamily:'inherit', whiteSpace:'nowrap',
      }}>
        Activar
      </button>
    </div>
  );
}

const T = { primary:'#1B5E20', secondary:'#2E7D32', textMid:'#6B6B60', danger:'#C62828', warn:'#E65100' };
const today = () => new Date().toISOString().slice(0,10);
const thisWeek = () => { const d=new Date(); d.setDate(d.getDate()-7); return d.toISOString().slice(0,10); };
// Lunes de la semana actual
const weekStart = () => { const d=new Date(); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d.toISOString().slice(0,10); };
const fmt = (n) => `Q ${(n||0).toLocaleString('es-GT', { minimumFractionDigits:2 })}`;

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:'18px 20px', display:'flex', alignItems:'flex-start', gap:14 }}>
      {icon && <div style={{ fontSize:'1.5rem', lineHeight:1, marginTop:2 }}>{icon}</div>}
      <div style={{ flex:1 }}>
        <div style={{ fontSize:'1.5rem', fontWeight:800, color:color||T.primary, lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:'.78rem', fontWeight:600, color:'#1A1A18', marginTop:4 }}>{label}</div>
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
        : <div style={{ fontSize:'.72rem', color:'#6B6B60' }}>Sin registros</div>
      }
      <div style={{ fontSize:'.7rem', color:T.textMid, marginTop:6 }}>
        {total > 0 ? `${ok} / ${total} cumplen` : '—'}
      </div>
    </div>
  );
}

const WM_COLOR = { pendiente:'#2563eb', preparando:'#d97706', entregado:'#16a34a', cancelado:'#dc2626' };

function WmCard({ r }) {
  const [open, setOpen] = useState(false);
  const estado = r.estado || 'pendiente';
  const color  = WM_COLOR[estado] || '#6b7280';
  const cajas  = r.totalCajas || (r.rubros||[]).reduce((s,x)=>s+(x.cajas??x.cajasPedidas??0),0) || 0;
  const desc   = r.descripcion || (r.rubros||[]).map(x=>x.descripcion||x.item||'').filter(Boolean).join(' / ') || r.numOC ? `OC ${r.numOC}` : '—';
  return (
    <div style={{ background:'#fff', borderRadius:8, border:'1px solid #E0E0E0', borderLeft:`4px solid ${color}`, marginBottom:8, overflow:'hidden' }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:'10px 14px', cursor:'pointer', userSelect:'none', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <span style={{ fontWeight:700, fontSize:14 }}>{r.fechaEntrega || r.fecha || '—'}</span>
          {r.horaEntrega && <span style={{ marginLeft:8, fontSize:12, color:T.secondary, fontWeight:700 }}>{r.horaEntrega}</span>}
          <div style={{ fontSize:12, color:'#374151', marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{desc}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <span style={{ background:color, color:'#fff', borderRadius:20, padding:'2px 9px', fontSize:11, fontWeight:600 }}>
            {estado.charAt(0).toUpperCase()+estado.slice(1)}
          </span>
          <span style={{ fontSize:16, color:'#9ca3af' }}>{open?'▲':'▼'}</span>
        </div>
      </div>
      {open && (
        <div style={{ padding:'0 14px 12px', borderTop:'1px solid #F0F0F0', fontSize:13, color:'#555' }}>
          {r.notaImportante && <div style={{ color:'#1565C0', fontSize:12, marginTop:8, marginBottom:4 }}>📋 {r.notaImportante}</div>}
          <div style={{ display:'flex', gap:16, marginTop:8, flexWrap:'wrap' }}>
            <span><b>OC:</b> {r.numOC||'—'}</span>
            <span><b>SAP:</b> {r.numAtlas||'—'}</span>
            {r.rampa && <span><b>Rampa:</b> {r.rampa}</span>}
            {cajas > 0 && <span><b>Cajas:</b> {cajas}</span>}
          </div>
        </div>
      )}
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
  const wmC         = useCollection('pedidosWalmart', { orderField:'fechaEntrega', orderDir:'asc', limit:300 });
  const { data: mainData } = useMainData();
  // Merge colección nueva + legacy bpm.html (fingerprint dedup)
  const wmAll = useMemo(() => {
    const col    = wmC.data || [];
    const legacy = mainData?.pedidosWalmart || [];
    const existingIds       = new Set(col.map(r => r.id));
    const existingLegacyIds = new Set(col.map(r => r.legacyId).filter(Boolean));
    const existingOCs       = new Set(col.map(r => r.numOC).filter(Boolean));
    const fp = r => {
      const f = r.fechaEntrega || r.fecha || '';
      if (r.numOC) return `${f}|oc|${r.numOC}`;
      const c = r.totalCajas || (r.rubros||[]).reduce((s,x)=>s+(x.cajas||x.cajasPedidas||0),0) || 0;
      const item = (r.rubros||[])[0]?.item || (r.descripcion||'').slice(0,20).replace(/\s+/g,'');
      return `${f}|${c}|${item}`;
    };
    const existingFPs = new Set(col.map(fp));
    const legacyNew = legacy.filter(r =>
      !(r.id  && existingIds.has(r.id))       &&
      !(r.id  && existingLegacyIds.has(r.id)) &&
      !(r.numOC && existingOCs.has(r.numOC))  &&
      !existingFPs.has(fp(r))
    );
    return [...col, ...legacyNew];
  }, [wmC.data, mainData]);
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

  // ── HOY: qué BPM falta registrar ──────────────────────────────────
  const BPM_HOY = [
    { icon:'🚛', label:'Limpieza Transporte', data: tlC.data },
    { icon:'📋', label:'Despacho',            data: dtC.data },
    { icon:'🙌', label:'Acceso y Lavado',     data: alC.data },
    { icon:'⚖️', label:'Básculas',             data: basC.data },
    { icon:'🧹', label:'Limpieza Bodega',      data: limpC.data },
  ];
  const bpmFaltaHoy = BPM_HOY.filter(m => !m.data.some(r => r.fecha === td));

  // ── HOY: pedidos Walmart con horario ──────────────────────────────
  const wmHoy = wmAll.filter(r => (r.fechaEntrega || r.fecha) === td && r.estado !== 'cancelado');

  // ── Resto de métricas ─────────────────────────────────────────────
  const wkStart    = weekStart();
  // Solo pendientes de esta semana en adelante (no semanas pasadas)
  const wmPending  = wmAll.filter(r =>
    (!r.estado || r.estado === 'pendiente') &&
    (r.fechaEntrega || r.fecha || '') >= wkStart
  );
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

      <NotifBanner />

      {/* ── ALERTAS ─────────────────────────────────────────────── */}
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

      {/* ── PENDIENTE HOY ───────────────────────────────────────── */}
      <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:20, marginBottom:20 }}>
        <div style={{ fontWeight:700, color:T.primary, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
          Pendiente HOY
          {bpmFaltaHoy.length === 0
            ? <span style={{ background:'#E8F5E9', color:T.secondary, fontSize:'.72rem', fontWeight:700, padding:'2px 10px', borderRadius:100 }}>✓ Todo registrado</span>
            : <span style={{ background:'#FFEBEE', color:T.danger, fontSize:'.72rem', fontWeight:700, padding:'2px 10px', borderRadius:100 }}>{bpmFaltaHoy.length} módulo{bpmFaltaHoy.length>1?'s':''} sin registro</span>
          }
        </div>

        {bpmFaltaHoy.length === 0 ? (
          <div style={{ fontSize:'.83rem', color:T.textMid }}>Todos los módulos BPM tienen al menos un registro hoy.</div>
        ) : (
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {bpmFaltaHoy.map(m => (
              <div key={m.label} style={{
                display:'flex', alignItems:'center', gap:6,
                background:'#FFF3E0', border:'1px solid #FFB74D',
                borderRadius:6, padding:'7px 14px',
                fontSize:'.82rem', fontWeight:600, color:'#E65100',
              }}>
                {m.icon} {m.label}
              </div>
            ))}
          </div>
        )}

        {/* Walmart de hoy */}
        {wmHoy.length > 0 && (
          <div style={{ marginTop:16, borderTop:'1px solid #F0F0F0', paddingTop:14 }}>
            <div style={{ fontSize:'.78rem', fontWeight:700, color:T.textMid, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>
              Entregas Walmart hoy — {wmHoy.length} pedido{wmHoy.length>1?'s':''}
            </div>
            {wmHoy.map(r => <WmCard key={r.id} r={r} />)}
          </div>
        )}
      </div>

      {/* ── STATS ──────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:12, marginBottom:24 }}>
        <StatCard icon="📤" label="Ventas esta semana" value={fmt(ventasWeek)} color={T.secondary} />
        <StatCard icon="💸" label="Gastos hoy" value={fmt(gastosHoy)} sub={`Semana: ${fmt(gastosWeek)}`} color={T.warn} />
        <StatCard icon="📦" label="Walmart pendientes" value={wmPending.length} color={wmPending.length>0?T.danger:T.secondary} />
        <StatCard icon="🏛️" label="Concursos urgentes" value={gcUrgent.length} color={gcUrgent.length>0?T.danger:T.secondary} />
      </div>

      {/* ── BPM SEMANA ─────────────────────────────────────────── */}
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

      {/* ── WALMART PENDIENTES ──────────────────────────────────── */}
      {wmPending.length > 0 && (
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:20, marginBottom:20 }}>
          <div style={{ fontWeight:700, color:T.primary, marginBottom:12 }}>
            Pedidos Walmart — Pendientes ({wmPending.length})
          </div>
          {wmPending.slice(0,8).map(r => <WmCard key={r.id} r={r} />)}
        </div>
      )}

      {/* ── GUATECOMPRAS ────────────────────────────────────────── */}
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
