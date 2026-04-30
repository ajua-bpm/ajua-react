import { useState, useEffect, useMemo } from 'react';
import { useMovimientosBanco, useFacturasFEL, useGastosFijos, useVentasSalidas, calcPnL } from './useFinanzas';
import ClasificadorDiario  from './ClasificadorDiario';
import ImportadorBanco     from './ImportadorBanco';
import ImportadorFEL       from './ImportadorFEL';
import PnL                 from './PnL';
import GastosFijosConfig   from './GastosFijosConfig';
import MargenProductos     from './MargenProductos';

const T = { primary:'#1B5E20', danger:'#C62828', warn:'#E65100', border:'#E0E0E0', mid:'#6B6B60', dark:'#1A1A18' };
const WHITE = '#FFFFFF';
const fmtQ  = n => 'Q ' + Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2});

function hoy()    { return new Date().toISOString().slice(0,10); }
function lunes()  { const d=new Date(); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d.toISOString().slice(0,10); }
function mesIni() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; }
function mesAntIni() { const d=new Date(new Date().getFullYear(),new Date().getMonth()-1,1); return d.toISOString().slice(0,10); }
function mesAntFin() { const d=new Date(new Date().getFullYear(),new Date().getMonth(),0);   return d.toISOString().slice(0,10); }

const PERIODOS = [
  { id:'hoy',    label:'Hoy',          desde:hoy,       hasta:hoy       },
  { id:'semana', label:'Esta semana',   desde:lunes,     hasta:hoy       },
  { id:'mes',    label:'Este mes',      desde:mesIni,    hasta:hoy       },
  { id:'ant',    label:'Mes anterior',  desde:mesAntIni, hasta:mesAntFin },
  { id:'rango',  label:'Rango',         desde:null,      hasta:null      },
];

function SummaryCard({ label, value, sub, color }) {
  return (
    <div style={{ background:WHITE, borderRadius:10, padding:'14px 16px', boxShadow:'0 1px 3px rgba(0,0,0,.1)', flex:'1 1 160px', minWidth:0 }}>
      <div style={{ fontSize:'.72rem', fontWeight:700, color:T.mid, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:'1.15rem', fontWeight:800, color: color||T.dark }}>{fmtQ(value)}</div>
      {sub && <div style={{ fontSize:'.75rem', color:T.mid, marginTop:2 }}>{sub}</div>}
    </div>
  );
}

export default function Finanzas() {
  const [tab,    setTab]    = useState('clasificar');
  const [pid,    setPid]    = useState('mes');
  const [desde,  setDesde]  = useState(mesIni);
  const [hasta,  setHasta]  = useState(hoy);

  const banco   = useMovimientosBanco();
  const fel     = useFacturasFEL();
  const fijos   = useGastosFijos();
  const salidas = useVentasSalidas();

  // Cargar fijos al montar (son estáticos, no dependen del período)
  useEffect(() => { fijos.cargar(); }, []); // eslint-disable-line

  // Aplicar período
  useEffect(() => {
    const p = PERIODOS.find(x => x.id === pid);
    if (!p) return;
    if (p.desde) { setDesde(p.desde()); setHasta(p.hasta()); }
  }, [pid]);

  useEffect(() => { banco.cargar(desde, hasta);   }, [desde, hasta]); // eslint-disable-line
  useEffect(() => { fel.cargar(desde, hasta);     }, [desde, hasta]); // eslint-disable-line
  useEffect(() => { salidas.cargar(desde, hasta); }, [desde, hasta]); // eslint-disable-line

  const pnl = useMemo(() => calcPnL(banco.data, fel.data, fijos.data, salidas.data, desde, hasta), [banco.data, fel.data, fijos.data, salidas.data, desde, hasta]);

  const TABS = [
    { id:'clasificar', label:'⚡ Clasificar', badge: pnl.sinClasificar||0 },
    { id:'pnl',        label:'📊 P&L' },
    { id:'walmart',    label:'🛒 Walmart', badge: salidas.data.length||0 },
    { id:'banco',      label:'🏦 Banco' },
    { id:'fel',        label:'📄 FEL' },
    { id:'importar',   label:'⬆️ Importar' },
    { id:'fijos',      label:'⚙️ Fijos' },
    { id:'margen',     label:'📦 Margen' },
  ];

  return (
    <div style={{ maxWidth:900, margin:'0 auto', padding:'20px 12px' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <h1 style={{ margin:0, fontSize:'1.35rem', fontWeight:800, color:T.dark }}>💰 Finanzas</h1>
        {pnl.sinClasificar > 0 && (
          <span onClick={()=>setTab('clasificar')} style={{ background:'#FFEBEE', color:T.danger, border:`1px solid #FFCDD2`, borderRadius:100, padding:'4px 12px', fontSize:'.78rem', fontWeight:700, cursor:'pointer' }}>
            ⚠️ {pnl.sinClasificar} sin clasificar
          </span>
        )}
      </div>

      {/* Selector período */}
      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:16 }}>
        {PERIODOS.map(p => (
          <button key={p.id} onClick={()=>setPid(p.id)}
            style={{ padding:'6px 14px', border:`1.5px solid ${pid===p.id?T.primary:T.border}`, borderRadius:6, background:pid===p.id?T.primary:WHITE, color:pid===p.id?WHITE:T.dark, fontSize:'.80rem', fontWeight:600, cursor:'pointer' }}>
            {p.label}
          </button>
        ))}
        {pid==='rango' && (
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
            <input type="date" value={desde} onChange={e=>setDesde(e.target.value)} style={{ padding:'5px 8px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.82rem' }} />
            <span style={{ color:T.mid }}>—</span>
            <input type="date" value={hasta} onChange={e=>setHasta(e.target.value)} style={{ padding:'5px 8px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.82rem' }} />
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20 }}>
        <SummaryCard label="Ingresos"  value={pnl.ingresoNeto}    color="#15803d" />
        <SummaryCard label="Costos"    value={pnl.costosProducto+pnl.gastosFijos+pnl.gastosVariables} color={T.danger} />
        <SummaryCard label="Utilidad"  value={pnl.utilidadNeta}   color={pnl.utilidadNeta>=0?'#15803d':T.danger}
          sub={`Margen ${pnl.margenNeto.toFixed(1)}%`} />
        <SummaryCard label="Punto Eq." value={pnl.puntoEquilibrio}
          color={pnl.pctEq>=100?'#15803d':pnl.pctEq>=80?T.warn:T.danger}
          sub={`${pnl.pctEq.toFixed(0)}% ${pnl.pctEq>=100?'🟢':pnl.pctEq>=80?'🟡':'🔴'}`} />
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, borderBottom:`2px solid ${T.border}`, marginBottom:20, overflowX:'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ padding:'9px 14px', border:'none', borderBottom:`2px solid ${tab===t.id?T.primary:'transparent'}`, marginBottom:-2, background:'none', fontWeight:tab===t.id?700:500, color:tab===t.id?T.primary:T.mid, fontSize:'.84rem', cursor:'pointer', whiteSpace:'nowrap', position:'relative' }}>
            {t.label}
            {t.badge>0 && <span style={{ marginLeft:5, background:T.danger, color:WHITE, borderRadius:100, padding:'1px 6px', fontSize:'.68rem', fontWeight:700 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab==='clasificar' && <ClasificadorDiario movimientos={banco.data} onClasificar={banco.clasificar} />}
      {tab==='pnl'        && <PnL pnl={pnl} movimientos={banco.data} facturas={fel.data} />}
      {tab==='walmart' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <span style={{ fontWeight:700, color:T.dark }}>{salidas.data.length} ventas · A cobrar total: <span style={{ color:'#15803d' }}>{fmtQ(salidas.data.reduce((s,r)=>s+(r.aCobrar||r.neto||0),0))}</span></span>
            <button onClick={()=>salidas.cargar(desde,hasta)} style={{ padding:'6px 14px', background:T.primary, color:WHITE, border:'none', borderRadius:6, fontSize:'.82rem', fontWeight:600, cursor:'pointer' }}>🔄 Recargar</button>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.82rem' }}>
              <thead><tr style={{ background:T.primary, color:WHITE }}>
                {['Fecha','Productos','LBS','Neto Q','IVA Q','Con IVA','Ret. Q','A Cobrar Q','OC'].map(h=>(
                  <th key={h} style={{ padding:'8px 10px', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{salidas.data.map((r,i)=>{
                const prods = (r.lineas||r.productos||[]).map(l=>l.producto||l.nombre).filter(Boolean).join(', ');
                return (
                  <tr key={r.id} style={{ background:i%2===0?WHITE:'#F9F9F9', borderBottom:`1px solid ${T.border}` }}>
                    <td style={{ padding:'7px 10px', whiteSpace:'nowrap', fontWeight:600 }}>{r.fecha||'—'}</td>
                    <td style={{ padding:'7px 10px', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'.78rem', color:T.mid }}>{prods||'—'}</td>
                    <td style={{ padding:'7px 10px', textAlign:'right' }}>{(r.totalLbs||0).toLocaleString('es-GT',{maximumFractionDigits:1})}</td>
                    <td style={{ padding:'7px 10px', textAlign:'right' }}>{fmtQ(r.neto)}</td>
                    <td style={{ padding:'7px 10px', textAlign:'right' }}>{fmtQ(r.iva)}</td>
                    <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:600 }}>{fmtQ(r.conIva)}</td>
                    <td style={{ padding:'7px 10px', textAlign:'right', color:T.danger }}>{fmtQ(r.retencion)}</td>
                    <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:800, color:'#15803d' }}>{fmtQ(r.aCobrar||r.neto)}</td>
                    <td style={{ padding:'7px 10px', fontSize:'.76rem' }}>{r.numOC||'—'}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      )}
      {tab==='banco'      && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
            <span style={{ fontWeight:700, color:T.dark }}>{banco.data.length} movimientos</span>
            <div style={{ display:'flex', gap:8 }}>
              {['BAM','GYT','INDUSTRIAL'].map(b => (
                <button key={b} onClick={async () => {
                  if (!window.confirm(`¿Borrar TODOS los movimientos de ${b}? Esta acción no se puede deshacer.`)) return;
                  const n = await banco.borrarPorBanco(b);
                  alert(`${n} movimientos de ${b} eliminados.`);
                }} style={{ padding:'5px 12px', background:'none', border:`1.5px solid ${T.danger}`, color:T.danger, borderRadius:6, fontSize:'.76rem', fontWeight:600, cursor:'pointer' }}>
                  🗑 {b}
                </button>
              ))}
              <button onClick={async () => {
                if (!window.confirm('¿Borrar todos los movimientos de solo CRÉDITO (sin débito) de todos los bancos?')) return;
                const n = await banco.borrarCreditos();
                alert(`${n} movimientos de crédito eliminados.`);
                banco.cargar(desde, hasta);
              }} style={{ padding:'5px 12px', background:'none', border:`1.5px solid ${T.danger}`, color:T.danger, borderRadius:6, fontSize:'.76rem', fontWeight:600, cursor:'pointer' }}>
                🗑 Limpiar créditos
              </button>
              <button onClick={()=>banco.cargar(desde,hasta)} style={{ padding:'6px 14px', background:T.primary, color:WHITE, border:'none', borderRadius:6, fontSize:'.82rem', fontWeight:600, cursor:'pointer' }}>🔄 Recargar</button>
            </div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.82rem' }}>
              <thead><tr style={{ background:T.primary, color:WHITE }}>
                {['Banco','Fecha','Descripción','Débito','Crédito','Categoría'].map(h=>(
                  <th key={h} style={{ padding:'8px 10px', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{banco.data.map((m,i)=>(
                <tr key={m.id} style={{ background:i%2===0?WHITE:'#F9F9F9', borderBottom:`1px solid ${T.border}` }}>
                  <td style={{ padding:'7px 10px' }}>{m.banco}</td>
                  <td style={{ padding:'7px 10px', whiteSpace:'nowrap' }}>{m.fecha}</td>
                  <td style={{ padding:'7px 10px', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.descripcion}</td>
                  <td style={{ padding:'7px 10px', color:T.danger, textAlign:'right' }}>{m.debito>0?fmtQ(m.debito):''}</td>
                  <td style={{ padding:'7px 10px', color:'#15803d', textAlign:'right' }}>{m.credito>0?fmtQ(m.credito):''}</td>
                  <td style={{ padding:'7px 10px' }}>{m.categoria||<span style={{color:T.danger,fontWeight:600}}>Sin clasificar</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
      {tab==='fel' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontWeight:700, color:T.dark }}>{fel.data.length} facturas</span>
            <button onClick={()=>fel.cargar(desde,hasta)} style={{ padding:'6px 14px', background:T.primary, color:WHITE, border:'none', borderRadius:6, fontSize:'.82rem', fontWeight:600, cursor:'pointer' }}>🔄 Recargar</button>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.82rem' }}>
              <thead><tr style={{ background:T.primary, color:WHITE }}>
                {['Tipo','Fecha','Emisor','Receptor','Total','IVA Ret.','Neto'].map(h=>(
                  <th key={h} style={{ padding:'8px 10px', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{fel.data.map((f,i)=>(
                <tr key={f.id} style={{ background:i%2===0?WHITE:'#F9F9F9', borderBottom:`1px solid ${T.border}` }}>
                  <td style={{ padding:'7px 10px' }}><span style={{ padding:'2px 8px', borderRadius:100, fontSize:'.72rem', fontWeight:700, background:f.tipoFEL==='emitida'?'#E8F5E9':'#EEF2FF', color:f.tipoFEL==='emitida'?'#15803d':'#3730a3' }}>{f.tipoFEL}</span></td>
                  <td style={{ padding:'7px 10px', whiteSpace:'nowrap' }}>{f.fecha?.slice(0,10)}</td>
                  <td style={{ padding:'7px 10px', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.emisorNombre}</td>
                  <td style={{ padding:'7px 10px', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.receptorNombre}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right' }}>{fmtQ(f.montoTotal)}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:T.danger }}>{f.ivaRetenido>0?fmtQ(f.ivaRetenido):''}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:600 }}>{fmtQ(f.montoNeto)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
      {tab==='fijos'    && <GastosFijosConfig />}
      {tab==='margen'   && <MargenProductos />}
      {tab==='importar' && (
        <div>
          <ImportadorBanco onImportado={()=>banco.cargar(desde,hasta)} />
          <ImportadorFEL   onImportado={()=>fel.cargar(desde,hasta)} />
        </div>
      )}
    </div>
  );
}
