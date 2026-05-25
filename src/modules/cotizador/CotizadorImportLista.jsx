import { useEffect, useState, useMemo } from 'react';

const T = {
  forest:'#1F3A2C', canopy:'#2D6645', ochre:'#A8835A', bone:'#F8F3E9',
  ink:'#1A1A18', muted:'#6B6B60', rule:'rgba(26,26,24,.10)',
  green:'#2E7D32', red:'#C62828', white:'#FFFFFF',
};

const FS_BASE = 'https://firestore.googleapis.com/v1/projects/ajuabmp/databases/(default)/documents';

function fsToJs(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsToJs);
  if ('mapValue' in v) {
    const r = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) r[k] = fsToJs(val);
    return r;
  }
  return null;
}

const ESTADOS = {
  borrador:  { label:'Borrador',  bg:'rgba(168,131,90,.10)',  color:T.ochre },
  enviada:   { label:'Enviada',   bg:'rgba(168,131,90,.10)',  color:T.ochre },
  aceptada:  { label:'Aceptada',  bg:'rgba(46,125,50,.10)',   color:T.green },
  rechazada: { label:'Rechazada', bg:'rgba(198,40,40,.10)',   color:T.red   },
};

function fmtFecha(s) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (isNaN(d)) return s;
    return d.toLocaleDateString('es-GT', { year:'numeric', month:'short', day:'2-digit' });
  } catch { return s; }
}

export default function CotizadorImportLista() {
  const [cots, setCots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEst, setFiltroEst] = useState('todos');

  async function cargar() {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${FS_BASE}/cotizacionesImport?pageSize=200`);
      if (!r.ok) throw new Error('Error servidor');
      const data = await r.json();
      const docs = (data.documents || []).map(doc => {
        const id = doc.name.split('/').pop();
        const f = doc.fields || {};
        const obj = fsToJs({ mapValue: { fields: f } }) || {};
        return { id, ...obj };
      });
      setCots(docs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  const rows = useMemo(() => {
    let r = cots.slice();
    if (filtroEst !== 'todos') r = r.filter(c => (c.estado || 'sin-enviar') === filtroEst);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      r = r.filter(c =>
        (c.meta?.numero || c.id || '').toLowerCase().includes(q) ||
        (c.meta?.productor || '').toLowerCase().includes(q) ||
        (c.productorEmail || c.meta?.productorEmail || '').toLowerCase().includes(q)
      );
    }
    r.sort((a,b) => (b.actualizadoEn || '').localeCompare(a.actualizadoEn || ''));
    return r;
  }, [cots, filtroEst, busqueda]);

  const stats = useMemo(() => {
    const s = { total: cots.length, borrador: 0, aceptada: 0, rechazada: 0, sin_email: 0 };
    cots.forEach(c => {
      const e = c.estado;
      if (e === 'borrador') s.borrador++;
      else if (e === 'aceptada') s.aceptada++;
      else if (e === 'rechazada') s.rechazada++;
      if (!(c.productorEmail || c.meta?.productorEmail)) s.sin_email++;
    });
    return s;
  }, [cots]);

  return (
    <div style={{ padding:'24px 28px', maxWidth:1200, fontFamily:'inherit', background:T.bone, minHeight:'100vh' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ margin:0, fontSize:'1.3rem', fontWeight:700, color:T.forest, fontFamily:"'Source Serif 4', serif" }}>
            Cotizaciones de Importación
          </h2>
          <p style={{ margin:'4px 0 0', fontSize:'.85rem', color:T.muted }}>
            México → Guatemala · cotizaciones enviadas a productores
          </p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={cargar} style={{
            padding:'9px 16px', background:T.white, color:T.ink, border:`1px solid ${T.rule}`,
            borderRadius:4, fontWeight:600, fontSize:'.8rem', cursor:'pointer',
          }}>↻ Recargar</button>
          <a href="/cotizador-importacion" style={{
            padding:'9px 18px', background:T.forest, color:T.white, textDecoration:'none',
            borderRadius:4, fontWeight:600, fontSize:'.8rem', display:'inline-block',
          }}>＋ Nueva cotización</a>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:12, marginBottom:20 }}>
        {[
          { lbl:'Total', val:stats.total, col:T.ink },
          { lbl:'Borrador', val:stats.borrador, col:T.ochre },
          { lbl:'Aceptadas', val:stats.aceptada, col:T.green },
          { lbl:'Rechazadas', val:stats.rechazada, col:T.red },
          { lbl:'Sin email portal', val:stats.sin_email, col:T.muted },
        ].map(s => (
          <div key={s.lbl} style={{ background:T.white, padding:'14px 16px', borderTop:`3px solid ${s.col}`, border:`1px solid ${T.rule}` }}>
            <div style={{ fontSize:'.66rem', fontWeight:700, letterSpacing:'.15em', textTransform:'uppercase', color:T.muted }}>{s.lbl}</div>
            <div style={{ fontFamily:"'Source Serif 4', serif", fontSize:'1.5rem', fontWeight:600, color:s.col, marginTop:2 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <select value={filtroEst} onChange={e=>setFiltroEst(e.target.value)} style={{
          padding:'8px 12px', border:`1px solid ${T.rule}`, borderRadius:4, fontSize:'.85rem', background:T.white, color:T.ink,
        }}>
          <option value="todos">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="aceptada">Aceptada</option>
          <option value="rechazada">Rechazada</option>
          <option value="sin-enviar">Sin enviar al portal</option>
        </select>
        <input value={busqueda} onChange={e=>setBusqueda(e.target.value)}
          placeholder="Buscar por número, productor o email…"
          style={{
            padding:'8px 12px', border:`1px solid ${T.rule}`, borderRadius:4, fontSize:'.85rem',
            background:T.white, color:T.ink, flex:'1 1 280px', maxWidth:420,
          }} />
      </div>

      {/* Tabla */}
      <div style={{ background:T.white, border:`1px solid ${T.rule}`, overflow:'auto' }}>
        {loading && <div style={{ padding:30, textAlign:'center', color:T.muted }}>Cargando…</div>}
        {error && <div style={{ padding:30, textAlign:'center', color:T.red }}>Error: {error}</div>}
        {!loading && !error && (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.85rem' }}>
            <thead>
              <tr style={{ background:T.forest, color:T.white }}>
                <th style={{ padding:'10px 12px', textAlign:'left', fontSize:'.7rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase' }}>Número</th>
                <th style={{ padding:'10px 12px', textAlign:'left', fontSize:'.7rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase' }}>Fecha</th>
                <th style={{ padding:'10px 12px', textAlign:'left', fontSize:'.7rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase' }}>Productor</th>
                <th style={{ padding:'10px 12px', textAlign:'left', fontSize:'.7rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase' }}>Email portal</th>
                <th style={{ padding:'10px 12px', textAlign:'center', fontSize:'.7rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase' }}>Productos</th>
                <th style={{ padding:'10px 12px', textAlign:'center', fontSize:'.7rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase' }}>Estado</th>
                <th style={{ padding:'10px 12px', textAlign:'right', fontSize:'.7rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase' }}>Última edición</th>
                <th style={{ padding:'10px 12px', textAlign:'center', fontSize:'.7rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:T.muted, fontStyle:'italic' }}>
                  {cots.length === 0 ? 'No hay cotizaciones guardadas todavía.' : 'No hay resultados con esos filtros.'}
                </td></tr>
              )}
              {rows.map((c, i) => {
                const e = c.estado || 'sin-enviar';
                const est = ESTADOS[e];
                const email = c.productorEmail || c.meta?.productorEmail || '';
                const numProds = Array.isArray(c.productos) ? c.productos.length : 0;
                const hayPropuestas = (c.productos || []).some(p => p.propuestaProductor);
                return (
                  <tr key={c.id} style={{ background: i % 2 ? '#FAFAF7' : T.white, borderBottom:`1px solid ${T.rule}` }}>
                    <td style={{ padding:'10px 12px', fontWeight:600, color:T.forest, fontFamily:"'Source Serif 4', serif" }}>
                      {c.meta?.numero || c.id}
                    </td>
                    <td style={{ padding:'10px 12px', color:T.ink }}>{fmtFecha(c.meta?.fecha)}</td>
                    <td style={{ padding:'10px 12px', color:T.ink }}>{c.meta?.productor || <span style={{ color:T.muted, fontStyle:'italic' }}>—</span>}</td>
                    <td style={{ padding:'10px 12px', color:email ? T.ink : T.muted, fontSize:'.8rem' }}>
                      {email || <span style={{ fontStyle:'italic' }}>(sin email)</span>}
                    </td>
                    <td style={{ padding:'10px 12px', textAlign:'center' }}>
                      {numProds}{hayPropuestas && <span style={{ marginLeft:6, color:T.ochre, fontSize:'.7rem', fontWeight:700 }} title="Productor mandó propuesta">●</span>}
                    </td>
                    <td style={{ padding:'10px 12px', textAlign:'center' }}>
                      {est ? (
                        <span style={{
                          padding:'3px 10px', fontSize:'.66rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase',
                          background:est.bg, color:est.color, border:`1px solid ${est.color}`,
                        }}>{est.label}</span>
                      ) : <span style={{ color:T.muted, fontSize:'.75rem', fontStyle:'italic' }}>sin enviar</span>}
                    </td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontSize:'.78rem', color:T.muted }}>
                      {c.actualizadoEn ? new Date(c.actualizadoEn).toLocaleString('es-GT', { dateStyle:'short', timeStyle:'short' }) : '—'}
                    </td>
                    <td style={{ padding:'10px 12px', textAlign:'center' }}>
                      <a href={`/cotizador-importacion?load=${encodeURIComponent(c.id)}`} style={{
                        padding:'5px 12px', background:T.ochre, color:T.white, textDecoration:'none',
                        borderRadius:3, fontSize:'.72rem', fontWeight:600, letterSpacing:'.05em',
                      }}>Abrir</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
