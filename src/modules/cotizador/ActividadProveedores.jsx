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
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsToJs);
  if ('mapValue' in v) {
    const r = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) r[k] = fsToJs(val);
    return r;
  }
  return null;
}

function tiempoRel(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'hace unos segundos';
    if (diff < 3600) return `hace ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
    if (diff < 86400*7) return `hace ${Math.floor(diff/86400)} d`;
    return d.toLocaleDateString('es-GT');
  } catch { return '—'; }
}

function navegadorCorto(ua) {
  if (!ua) return '—';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Otro';
}

function plataformaCorta(ua) {
  if (!ua) return '—';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad/.test(ua)) return 'iOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux';
  return '—';
}

export default function ActividadProveedores() {
  const [tab, setTab] = useState('accesos');
  const [accesos, setAccesos] = useState([]);
  const [cots, setCots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function cargar() {
    setLoading(true); setError(null);
    try {
      const [rAcc, rCot] = await Promise.all([
        fetch(`${FS_BASE}/accesosPortal?pageSize=500`),
        fetch(`${FS_BASE}/cotizacionesImport?pageSize=500`),
      ]);
      const dataAcc = rAcc.ok ? await rAcc.json() : { documents: [] };
      const dataCot = rCot.ok ? await rCot.json() : { documents: [] };
      setAccesos((dataAcc.documents || []).map(d => {
        const id = d.name.split('/').pop();
        return { id, ...(fsToJs({ mapValue:{ fields:d.fields } }) || {}) };
      }));
      setCots((dataCot.documents || []).map(d => {
        const id = d.name.split('/').pop();
        return { id, ...(fsToJs({ mapValue:{ fields:d.fields } }) || {}) };
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  // ── Resumen por email
  const usuarios = useMemo(() => {
    const map = new Map();
    accesos.forEach(a => {
      const email = (a.email || '').toLowerCase();
      if (!email) return;
      if (!map.has(email)) {
        map.set(email, { email, total: 0, ultimo: '', primero: '', userAgent: '', screen: '' });
      }
      const u = map.get(email);
      u.total++;
      const ts = a.ts || '';
      if (!u.ultimo || ts > u.ultimo) {
        u.ultimo = ts;
        u.userAgent = a.userAgent || '';
        u.screen = a.screen || '';
      }
      if (!u.primero || ts < u.primero) u.primero = ts;
    });
    return Array.from(map.values()).sort((a,b) => (b.ultimo || '').localeCompare(a.ultimo || ''));
  }, [accesos]);

  // ── Todos los cambios por cotización aplanados
  const cambios = useMemo(() => {
    const out = [];
    cots.forEach(c => {
      const hist = c.historial || [];
      hist.forEach(h => {
        out.push({
          ts: h.ts || '',
          who: h.who || '',
          action: h.action || '',
          summary: h.summary || '',
          cotId: c.id,
          cotNumero: c.meta?.numero || c.id,
          productor: c.meta?.productor || '',
        });
      });
    });
    out.sort((a,b) => (b.ts || '').localeCompare(a.ts || ''));
    return out;
  }, [cots]);

  const stats = useMemo(() => ({
    usuariosUnicos: usuarios.length,
    totalLogins: accesos.length,
    totalCambios: cambios.length,
    activosUltSemana: usuarios.filter(u => {
      if (!u.ultimo) return false;
      const d = new Date(u.ultimo);
      return (Date.now() - d.getTime()) < 86400000 * 7;
    }).length,
  }), [usuarios, accesos, cambios]);

  const TH = { padding:'10px 12px', textAlign:'left', fontSize:'.7rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', background:T.forest, color:T.white };
  const TD = (i) => ({ padding:'9px 12px', fontSize:'.83rem', background: i%2 ? '#FAFAF7' : T.white, borderBottom:`1px solid ${T.rule}` });

  return (
    <div style={{ padding:'24px 28px', maxWidth:1300, fontFamily:'inherit', minHeight:'100vh' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:18, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ margin:0, fontSize:'1.3rem', fontWeight:700, color:T.forest, fontFamily:"'Source Serif 4', serif" }}>
            Actividad de Proveedores
          </h2>
          <p style={{ margin:'4px 0 0', fontSize:'.85rem', color:T.muted }}>
            Auditoría de accesos al portal y cambios sobre cotizaciones
          </p>
        </div>
        <button onClick={cargar} style={{
          padding:'9px 16px', background:T.white, color:T.ink, border:`1px solid ${T.rule}`,
          borderRadius:4, fontWeight:600, fontSize:'.8rem', cursor:'pointer',
        }}>↻ Recargar</button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:12, marginBottom:18 }}>
        {[
          { lbl:'Usuarios únicos', val:stats.usuariosUnicos, col:T.forest },
          { lbl:'Activos última semana', val:stats.activosUltSemana, col:T.green },
          { lbl:'Total logins', val:stats.totalLogins, col:T.canopy },
          { lbl:'Cambios en cotizaciones', val:stats.totalCambios, col:T.ochre },
        ].map(s => (
          <div key={s.lbl} style={{ background:T.white, padding:'14px 16px', borderTop:`3px solid ${s.col}`, border:`1px solid ${T.rule}` }}>
            <div style={{ fontSize:'.66rem', fontWeight:700, letterSpacing:'.15em', textTransform:'uppercase', color:T.muted }}>{s.lbl}</div>
            <div style={{ fontFamily:"'Source Serif 4', serif", fontSize:'1.5rem', fontWeight:600, color:s.col, marginTop:2 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, marginBottom:0, borderBottom:`2px solid ${T.forest}` }}>
        {[
          { id:'accesos', lbl:'Accesos al portal' },
          { id:'historial', lbl:'Cambios en cotizaciones' },
          { id:'recientes', lbl:'Logins recientes (raw)' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'10px 18px', background: tab===t.id ? T.forest : 'transparent',
            color: tab===t.id ? T.white : T.ink, border:'none', borderTop:`1px solid ${T.rule}`,
            borderLeft:`1px solid ${T.rule}`, borderRight:`1px solid ${T.rule}`,
            fontWeight:600, fontSize:'.82rem', cursor:'pointer', letterSpacing:'.03em',
          }}>{t.lbl}</button>
        ))}
      </div>

      <div style={{ background:T.white, border:`1px solid ${T.rule}`, borderTop:0, overflow:'auto' }}>
        {loading && <div style={{ padding:30, textAlign:'center', color:T.muted }}>Cargando…</div>}
        {error && <div style={{ padding:30, textAlign:'center', color:T.red }}>Error: {error}</div>}

        {!loading && !error && tab === 'accesos' && (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.83rem' }}>
            <thead><tr>
              <th style={TH}>Email</th>
              <th style={TH}>Total sesiones</th>
              <th style={TH}>Último acceso</th>
              <th style={TH}>Primer acceso</th>
              <th style={TH}>Navegador · Plataforma</th>
            </tr></thead>
            <tbody>
              {usuarios.length === 0 && (
                <tr><td colSpan={5} style={{ padding:40, textAlign:'center', color:T.muted, fontStyle:'italic' }}>
                  Nadie se ha conectado al portal todavía.
                </td></tr>
              )}
              {usuarios.map((u, i) => (
                <tr key={u.email}>
                  <td style={TD(i)}><b>{u.email}</b></td>
                  <td style={TD(i)}>{u.total}</td>
                  <td style={TD(i)}>
                    <div>{tiempoRel(u.ultimo)}</div>
                    <div style={{ fontSize:'.72rem', color:T.muted }}>{u.ultimo ? new Date(u.ultimo).toLocaleString('es-GT') : ''}</div>
                  </td>
                  <td style={TD(i)}>{u.primero ? new Date(u.primero).toLocaleDateString('es-GT') : '—'}</td>
                  <td style={TD(i)}>
                    {navegadorCorto(u.userAgent)} · {plataformaCorta(u.userAgent)}
                    {u.screen && <span style={{ color:T.muted, fontSize:'.74rem' }}> · {u.screen}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && !error && tab === 'historial' && (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.83rem' }}>
            <thead><tr>
              <th style={TH}>Fecha y hora</th>
              <th style={TH}>Cotización</th>
              <th style={TH}>Quién</th>
              <th style={TH}>Acción</th>
              <th style={TH}>Detalle</th>
            </tr></thead>
            <tbody>
              {cambios.length === 0 && (
                <tr><td colSpan={5} style={{ padding:40, textAlign:'center', color:T.muted, fontStyle:'italic' }}>
                  No hay cambios registrados en las cotizaciones todavía.
                </td></tr>
              )}
              {cambios.map((c, i) => {
                const isProductor = (c.who || '') !== 'agroajua@gmail.com';
                return (
                  <tr key={i}>
                    <td style={TD(i)}>
                      <div>{c.ts ? new Date(c.ts).toLocaleString('es-GT') : '—'}</div>
                      <div style={{ fontSize:'.72rem', color:T.muted }}>{tiempoRel(c.ts)}</div>
                    </td>
                    <td style={TD(i)}>
                      <a href={`/cotizador-importacion?load=${encodeURIComponent(c.cotId)}`} style={{ color:T.forest, fontWeight:600, textDecoration:'none' }}>{c.cotNumero}</a>
                      {c.productor && <div style={{ fontSize:'.72rem', color:T.muted }}>{c.productor}</div>}
                    </td>
                    <td style={TD(i)}>
                      <span style={{ color: isProductor ? T.ochre : T.forest, fontWeight:600 }}>{c.who || '—'}</span>
                      <div style={{ fontSize:'.7rem', color:T.muted }}>{isProductor ? 'productor' : 'admin'}</div>
                    </td>
                    <td style={TD(i)}>
                      <span style={{
                        padding:'2px 8px', fontSize:'.7rem', fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase',
                        background: c.action === 'aceptar' ? 'rgba(46,125,50,.1)' : c.action === 'rechazar' ? 'rgba(198,40,40,.1)' : 'rgba(168,131,90,.1)',
                        color: c.action === 'aceptar' ? T.green : c.action === 'rechazar' ? T.red : T.ochre,
                        border:`1px solid ${c.action === 'aceptar' ? T.green : c.action === 'rechazar' ? T.red : T.ochre}`,
                      }}>{c.action || 'cambio'}</span>
                    </td>
                    <td style={TD(i)}>{c.summary || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && !error && tab === 'recientes' && (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.83rem' }}>
            <thead><tr>
              <th style={TH}>Fecha y hora</th>
              <th style={TH}>Email</th>
              <th style={TH}>Navegador · Plataforma</th>
              <th style={TH}>Pantalla</th>
              <th style={TH}>UID</th>
            </tr></thead>
            <tbody>
              {accesos.length === 0 && (
                <tr><td colSpan={5} style={{ padding:40, textAlign:'center', color:T.muted, fontStyle:'italic' }}>
                  Sin accesos registrados todavía.
                </td></tr>
              )}
              {accesos.slice().sort((a,b)=>(b.ts||'').localeCompare(a.ts||'')).map((a, i) => (
                <tr key={a.id}>
                  <td style={TD(i)}>
                    <div>{a.ts ? new Date(a.ts).toLocaleString('es-GT') : '—'}</div>
                    <div style={{ fontSize:'.72rem', color:T.muted }}>{tiempoRel(a.ts)}</div>
                  </td>
                  <td style={TD(i)}><b>{a.email}</b></td>
                  <td style={TD(i)}>{navegadorCorto(a.userAgent)} · {plataformaCorta(a.userAgent)}</td>
                  <td style={TD(i)}>{a.screen || '—'}</td>
                  <td style={TD(i)}><code style={{ fontSize:'.72rem', color:T.muted }}>{(a.uid || '').slice(0, 12)}…</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
