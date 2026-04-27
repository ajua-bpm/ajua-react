import { useState } from 'react';
import { CATEGORIAS, CATEGORIAS_MAP, TOP_CATS } from './useFinanzas';

const T = { primary:'#1B5E20', danger:'#C62828', border:'#E0E0E0', mid:'#6B6B60', dark:'#1A1A18' };
const WHITE = '#FFFFFF';
const fmtQ  = n => 'Q ' + Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2});

function MovCard({ mov, onClasificar }) {
  const [catSel,  setCatSel]  = useState(mov.categoria || '');
  const [nota,    setNota]    = useState(mov.notas     || '');
  const [expand,  setExpand]  = useState(false);
  const [saving,  setSaving]  = useState(false);

  const topCats  = CATEGORIAS.filter(c => TOP_CATS.includes(c.id));
  const restCats = CATEGORIAS.filter(c => !TOP_CATS.includes(c.id));
  const esCredito = (mov.credito || 0) > 0;
  const monto     = esCredito ? mov.credito : mov.debito;

  const handleGuardar = async () => {
    if (!catSel) return;
    setSaving(true);
    try { await onClasificar(mov.id, catSel, nota); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background:WHITE, borderRadius:10, border:`1.5px solid ${mov.clasificado?'#A5D6A7':T.border}`, marginBottom:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.08)' }}>
      {/* Header */}
      <div style={{ padding:'12px 14px', background: mov.clasificado?'#F1F8F1':'#FAFAFA' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
          <span style={{ fontSize:'.72rem', fontWeight:700, color:T.mid }}>{mov.banco} · {mov.fecha}</span>
          {!mov.clasificado && <span style={{ fontSize:'.68rem', fontWeight:700, color:T.danger, background:'#FFEBEE', padding:'2px 6px', borderRadius:100 }}>SIN</span>}
          {mov.clasificado && <span style={{ fontSize:'.68rem', fontWeight:700, color:'#15803d', background:'#E8F5E9', padding:'2px 6px', borderRadius:100 }}>✓ {CATEGORIAS_MAP[mov.categoria]?.label||mov.categoria}</span>}
        </div>
        <div style={{ fontWeight:700, fontSize:'.9rem', color:T.dark, marginBottom:2 }}>{mov.descripcion}</div>
        {mov.referencia && <div style={{ fontSize:'.74rem', color:T.mid }}>Ref: {mov.referencia}</div>}
        <div style={{ marginTop:6, fontSize:'1.05rem', fontWeight:800, color: esCredito?'#15803d':T.danger }}>
          {esCredito ? '+' : '-'} {fmtQ(monto)}
        </div>
      </div>

      {/* Clasificador (solo si no clasificado o expandido) */}
      {(!mov.clasificado || expand) && (
        <div style={{ padding:'12px 14px', borderTop:`1px solid ${T.border}` }}>
          {/* Top cats */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
            {topCats.map(c => (
              <button key={c.id} onClick={()=>setCatSel(c.id)}
                style={{ padding:'7px 12px', borderRadius:100, border:`1.5px solid ${catSel===c.id?c.color:T.border}`, background:catSel===c.id?c.color:'#F5F5F5', color:catSel===c.id?WHITE:T.dark, fontSize:'.78rem', fontWeight:600, cursor:'pointer', minHeight:36 }}>
                {c.label}
              </button>
            ))}
            <button onClick={()=>setExpand(o=>!o)}
              style={{ padding:'7px 12px', borderRadius:100, border:`1.5px solid ${T.border}`, background:'#F5F5F5', color:T.mid, fontSize:'.78rem', cursor:'pointer', minHeight:36 }}>
              {expand ? '− menos' : '+ más…'}
            </button>
          </div>

          {/* Rest cats */}
          {expand && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
              {restCats.map(c => (
                <button key={c.id} onClick={()=>setCatSel(c.id)}
                  style={{ padding:'7px 12px', borderRadius:100, border:`1.5px solid ${catSel===c.id?c.color:T.border}`, background:catSel===c.id?c.color:'#F5F5F5', color:catSel===c.id?WHITE:T.dark, fontSize:'.78rem', fontWeight:600, cursor:'pointer', minHeight:36 }}>
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Nota + Guardar */}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:6 }}>
            <input value={nota} onChange={e=>setNota(e.target.value)} placeholder="Nota (opcional)…"
              style={{ flex:1, padding:'8px 10px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.84rem', fontFamily:'inherit' }} />
            <button onClick={handleGuardar} disabled={!catSel||saving}
              style={{ padding:'8px 18px', background:catSel&&!saving?T.primary:'#ccc', color:WHITE, border:'none', borderRadius:6, fontWeight:700, fontSize:'.84rem', cursor:catSel&&!saving?'pointer':'not-allowed', minHeight:40, whiteSpace:'nowrap' }}>
              {saving ? '…' : '✓ Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClasificadorDiario({ movimientos, onClasificar }) {
  const [soloSin, setSoloSin] = useState(true);

  const lista = soloSin ? movimientos.filter(m => !m.clasificado) : movimientos;
  const total = movimientos.length;
  const clasificados = movimientos.filter(m => m.clasificado).length;

  if (total === 0) return (
    <div style={{ textAlign:'center', padding:'40px 20px', color:T.mid }}>
      <div style={{ fontSize:'2rem', marginBottom:8 }}>📭</div>
      Sin movimientos en el período. Importa un extracto bancario primero.
    </div>
  );

  return (
    <div>
      {/* Counter + toggle */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div>
          <span style={{ fontWeight:700, color:T.dark }}>{clasificados} de {total} clasificados</span>
          {clasificados===total && <span style={{ marginLeft:8, color:'#15803d', fontWeight:700 }}>✅ Todo clasificado</span>}
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'.82rem', color:T.mid, cursor:'pointer' }}>
          <input type="checkbox" checked={soloSin} onChange={e=>setSoloSin(e.target.checked)} style={{ accentColor:T.primary }} />
          Solo pendientes
        </label>
      </div>

      {lista.length === 0 && soloSin && (
        <div style={{ textAlign:'center', padding:'40px 20px', color:'#15803d', fontWeight:700, fontSize:'1.1rem' }}>
          ✅ ¡Todo clasificado!
        </div>
      )}

      {lista.map(m => (
        <MovCard key={m.id} mov={m} onClasificar={onClasificar} />
      ))}
    </div>
  );
}
