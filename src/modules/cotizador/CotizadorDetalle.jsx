import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocument, useWrite } from '../../hooks/useFirestore';
import Skeleton from '../../components/Skeleton';
import { ESTADOS, PIPE_INT, PIPE_TER, fmt } from './hooks/useCotizador';
import PasoProductos from './pasos/PasoProductos';
import PasoGastos    from './pasos/PasoGastos';
import PasoAnticipos from './pasos/PasoAnticipos';
import PasoDuca      from './pasos/PasoDuca';
import PasoBodega    from './pasos/PasoBodega';

const T = { primary:'#1B5E20', secondary:'#2E7D32', border:'#E0E0E0', white:'#FFFFFF', textMid:'#6B6B60', textDark:'#1A1A18' };

function Pipeline({ tipo, estado }) {
  const steps = tipo === 'terceros' ? PIPE_TER : PIPE_INT;
  const cur = steps.indexOf(estado);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
      {steps.map((s,i) => {
        const e = ESTADOS[s]; const done = i <= cur;
        return (
          <span key={s} style={{ display:'flex', alignItems:'center' }}>
            <span style={{ padding:'3px 10px', fontSize:'.68rem', fontWeight:700, borderRadius:3, whiteSpace:'nowrap',
              background:done?e.bg:'#F5F5F5', color:done?e.color:T.textMid, border:`1px solid ${done?e.color:T.border}` }}>
              {e.label}
            </span>
            {i < steps.length-1 && <span style={{ width:8, height:1, background:T.border, display:'inline-block', margin:'0 1px' }}/>}
          </span>
        );
      })}
    </div>
  );
}

const TABS_INT = [
  { key:'productos', label:'📦 Productos' },
  { key:'gastos',    label:'💸 Gastos' },
  { key:'anticipos', label:'💵 Anticipos MX' },
  { key:'duca',      label:'📄 DUCA' },
  { key:'bodega',    label:'🏭 Bodega' },
];
const TABS_TER = [
  { key:'productos', label:'📦 Productos' },
  { key:'gastos',    label:'💸 Gastos' },
  { key:'anticipos', label:'💵 Anticipos' },
  { key:'entrega',   label:'🚚 Entrega' },
  { key:'pagado',    label:'✅ Pago' },
];

export default function CotizadorDetalle() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: cot, loading } = useDocument('cotizaciones', id);
  const { update } = useWrite('cotizaciones');
  const [tab, setTab] = useState('productos');

  if (loading) return <div style={{ padding:28 }}><Skeleton rows={6}/></div>;
  if (!cot) return <div style={{ padding:28, color:T.textMid }}>Cotización no encontrada.</div>;

  const tabs = cot.tipo === 'terceros' ? TABS_TER : TABS_INT;
  const upd = (data) => update(id, data);

  const tabBtn = (t) => (
    <button key={t.key} onClick={()=>setTab(t.key)} style={{
      padding:'8px 16px', border:'none', borderRadius:'4px 4px 0 0', cursor:'pointer',
      fontSize:'.8rem', fontWeight:tab===t.key?700:400, fontFamily:'inherit',
      background:tab===t.key?T.white:'transparent',
      color:tab===t.key?T.primary:T.textMid,
      borderBottom:tab===t.key?`2px solid ${T.primary}`:'2px solid transparent',
    }}>{t.label}</button>
  );

  return (
    <div style={{ padding:'24px 28px', maxWidth:1200, fontFamily:'inherit' }}>
      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <button onClick={()=>nav('/cotizador')} style={{ background:'none', border:'none', color:T.textMid, cursor:'pointer', padding:'0 0 4px', fontSize:'.82rem' }}>
          ← Volver a lista
        </button>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginTop:8 }}>
          <div>
            <h2 style={{ margin:0, fontSize:'1.2rem', fontWeight:700, color:T.primary }}>{cot.nombre}</h2>
            <div style={{ margin:'4px 0 0', display:'flex', gap:12, fontSize:'.8rem', color:T.textMid, flexWrap:'wrap' }}>
              <span>{cot.tipo==='interno'?'🏭 Interno':'🤝 Terceros'}</span>
              <span>📅 {cot.fecha}</span>
              {cot.tc && <span>TC: 1 MXN = Q{cot.tc}</span>}
              {cot.totalCosto>0 && <span style={{ fontWeight:700, color:T.secondary }}>Total: Q {fmt(cot.totalCosto)}</span>}
            </div>
          </div>
          <Pipeline tipo={cot.tipo} estado={cot.estado}/>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom:`1px solid ${T.border}`, marginBottom:0, display:'flex', gap:2, flexWrap:'wrap' }}>
        {tabs.map(tabBtn)}
      </div>

      {/* Tab content */}
      <div style={{ background:T.white, borderRadius:'0 4px 8px 8px', boxShadow:'0 1px 3px rgba(0,0,0,.10)', minHeight:300 }}>
        {tab === 'productos' && <PasoProductos cot={cot} update={upd}/>}
        {tab === 'gastos'    && <PasoGastos    cot={cot} update={upd}/>}
        {tab === 'anticipos' && <PasoAnticipos cot={cot} update={upd}/>}
        {tab === 'duca'      && <PasoDuca      cot={cot} update={upd}/>}
        {tab === 'bodega'    && <PasoBodega    cot={cot} update={upd}/>}
        {tab === 'entrega'   && (
          <div style={{ padding:28, color:T.textMid }}>
            <p>Estado de entrega: <strong>{ESTADOS[cot.estado]?.label}</strong></p>
            <button onClick={()=>upd({ estado:'en_entrega' })}
              style={{ padding:'8px 18px', background:T.primary, color:T.white, border:'none', borderRadius:5, cursor:'pointer', fontWeight:700, marginRight:10 }}>
              Marcar En entrega
            </button>
            <button onClick={()=>upd({ estado:'entregada' })}
              style={{ padding:'8px 18px', background:T.secondary, color:T.white, border:'none', borderRadius:5, cursor:'pointer', fontWeight:700 }}>
              Marcar Entregada
            </button>
          </div>
        )}
        {tab === 'pagado'    && (
          <div style={{ padding:28, color:T.textMid }}>
            <p>Confirmar pago recibido del cliente.</p>
            <button onClick={()=>upd({ estado:'pagado', pagadoEn:new Date().toISOString() })}
              style={{ padding:'8px 18px', background:T.primary, color:T.white, border:'none', borderRadius:5, cursor:'pointer', fontWeight:700 }}>
              ✅ Marcar Pagado
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
