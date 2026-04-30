import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollection } from '../../hooks/useFirestore';
import Skeleton from '../../components/Skeleton';
import { ESTADOS, PIPE_INT, PIPE_TER, fmt } from './hooks/useCotizador';

const T = { primary:'#1B5E20', secondary:'#2E7D32', textMid:'#6B6B60', border:'#E0E0E0', white:'#FFFFFF', textDark:'#1A1A18' };
const card = { background:T.white, borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:20, marginBottom:16 };
const TH = { padding:'9px 12px', fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', color:T.white, background:T.primary, textAlign:'left', whiteSpace:'nowrap' };
const TD = a => ({ padding:'8px 12px', fontSize:'.83rem', borderBottom:'1px solid #F0F0F0', background:a?'#F9FBF9':T.white });
const IS = { padding:'7px 10px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.82rem', background:T.white, color:T.textDark };

function Pipeline({ tipo, estado }) {
  const steps = tipo === 'terceros' ? PIPE_TER : PIPE_INT;
  const cur = steps.indexOf(estado);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, flexWrap:'nowrap' }}>
      {steps.map((s,i) => {
        const e = ESTADOS[s]; const done = i <= cur;
        return (
          <span key={s} style={{ display:'flex', alignItems:'center' }}>
            <span style={{
              padding:'2px 7px', fontSize:'.6rem', fontWeight:700, borderRadius:3, whiteSpace:'nowrap',
              background: done?e.bg:'#F5F5F5', color: done?e.color:T.textMid,
              border:`1px solid ${done?e.color:T.border}`,
            }}>{e.label}</span>
            {i < steps.length-1 && <span style={{ width:6, height:1, background:T.border, display:'inline-block' }}/>}
          </span>
        );
      })}
    </div>
  );
}

export default function CotizadorLista() {
  const nav = useNavigate();
  const { data, loading } = useCollection('cotizaciones', { orderField:'fecha', orderDir:'desc', limit:200 });
  const [filtroTipo, setTipo]     = useState('todos');
  const [filtroEst,  setEstado]   = useState('todos');
  const [busqueda,   setBusqueda] = useState('');

  const rows = useMemo(() => {
    let r = data;
    if (filtroTipo !== 'todos') r = r.filter(x => x.tipo   === filtroTipo);
    if (filtroEst  !== 'todos') r = r.filter(x => x.estado === filtroEst);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      r = r.filter(x => (x.nombre||'').toLowerCase().includes(q) || (x.duca||'').toLowerCase().includes(q));
    }
    return r;
  }, [data, filtroTipo, filtroEst, busqueda]);

  return (
    <div style={{ padding:'24px 28px', maxWidth:1200, fontFamily:'inherit' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ margin:0, fontSize:'1.2rem', fontWeight:700, color:T.primary }}>Cotizador de Contenedor</h2>
          <p style={{ margin:'3px 0 0', fontSize:'.82rem', color:T.textMid }}>Importación propia · Terceros · Seguimiento de anticipos y pagos</p>
        </div>
        <button onClick={() => nav('/cotizador/nuevo')}
          style={{ padding:'10px 20px', background:T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor:'pointer' }}>
          ＋ Nueva cotización
        </button>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <select value={filtroTipo} onChange={e=>setTipo(e.target.value)} style={IS}>
          <option value="todos">Todos los tipos</option>
          <option value="interno">🏭 Interno</option>
          <option value="terceros">🤝 Terceros</option>
        </select>
        <select value={filtroEst} onChange={e=>setEstado(e.target.value)} style={IS}>
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar nombre o DUCA…"
          style={{ ...IS, flex:'1 1 200px' }} />
      </div>

      <div style={card}>
        {loading ? <Skeleton rows={6}/> : rows.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 0', color:T.textMid }}>Sin cotizaciones — crea la primera con ＋.</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Nombre','Tipo','Fecha','Pipeline','Total GTQ',''].map(h=><th key={h} style={TH}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0,120).map((r,i) => (
                  <tr key={r.id} onClick={()=>nav(`/cotizador/${r.id}`)} style={{ cursor:'pointer' }}>
                    <td style={{ ...TD(i%2===1), fontWeight:600, color:T.primary }}>{r.nombre||'—'}</td>
                    <td style={TD(i%2===1)}>
                      <span style={{ padding:'2px 8px', borderRadius:4, fontSize:'.7rem', fontWeight:700,
                        background:r.tipo==='interno'?'#E8F5E9':'#E3F2FD', color:r.tipo==='interno'?T.secondary:'#1565C0' }}>
                        {r.tipo==='interno'?'🏭 Interno':'🤝 Terceros'}
                      </span>
                    </td>
                    <td style={TD(i%2===1)}>{r.fecha||'—'}</td>
                    <td style={{ ...TD(i%2===1), minWidth:250 }}><Pipeline tipo={r.tipo} estado={r.estado}/></td>
                    <td style={{ ...TD(i%2===1), fontWeight:700, color:T.secondary }}>Q {fmt(r.totalCosto)}</td>
                    <td style={TD(i%2===1)}>
                      <button onClick={e=>{e.stopPropagation();nav(`/cotizador/${r.id}`);}}
                        style={{ padding:'4px 12px', background:T.primary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>
                        Ver →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
