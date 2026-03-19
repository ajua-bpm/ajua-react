import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  primary:   '#1B5E20',
  secondary: '#2E7D32',
  white:     '#FFFFFF',
  bgLight:   '#F5F5F5',
  border:    '#E0E0E0',
  textDark:  '#212121',
  textMid:   '#616161',
  danger:    '#C62828',
  warn:      '#E65100',
};

const card = { background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:20, marginBottom:20 };
const TH_S = { padding:'10px 14px', fontSize:'.75rem', textTransform:'uppercase', fontWeight:700, letterSpacing:'.06em', color:T.white, background:T.primary, textAlign:'left', whiteSpace:'nowrap' };
const TD_S = (alt) => ({ padding:'9px 14px', fontSize:'.83rem', borderBottom:'1px solid #F0F0F0', background:alt?'#F9FBF9':'#fff', color:T.textDark });
const LS   = { display:'flex', flexDirection:'column', gap:5, fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.secondary };
const IS   = { padding:'9px 12px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.85rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2, color:T.textDark, background:T.white };

const today = () => new Date().toISOString().slice(0,10);
const fmtQ  = n => Number(n||0).toLocaleString('es-GT',{style:'currency',currency:'GTQ',minimumFractionDigits:2});

const ESTADO_CFG = {
  pendiente: { bg:'rgba(230,101,0,.10)', color:T.warn,      label:'Pendiente' },
  parcial:   { bg:'rgba(21,101,192,.10)', color:'#1565C0',  label:'Parcial'   },
  devuelto:  { bg:'rgba(27,94,32,.10)',   color:T.primary,  label:'Devuelto'  },
};

function EstadoChip({ estado }) {
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.pendiente;
  return (
    <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:100,
      fontSize:'.7rem', fontWeight:700, background:cfg.bg, color:cfg.color }}>
      {cfg.label}
    </span>
  );
}

export default function AnticiposMX() {
  const toast = useToast();
  const { data, loading } = useCollection('iAnticipo', { orderField:'fecha', orderDir:'desc', limit:200 });
  const { add, update, saving } = useWrite('iAnticipo');

  const [form, setForm] = useState({
    fecha:today(), proveedor:'', monto:'', moneda:'USD', tc:'', equivalenteQ:'', estado:'pendiente', obs:'',
  });
  const [filtro, setFiltro] = useState('');
  const [editId, setEditId] = useState(null);

  const f = (field, val) => {
    setForm(p => {
      const next = { ...p, [field]: val };
      if (field === 'monto' || field === 'tc') {
        const m = parseFloat(field==='monto'?val:next.monto) || 0;
        const t = parseFloat(field==='tc'?val:next.tc) || 0;
        next.equivalenteQ = m > 0 && t > 0 ? (m * t).toFixed(2) : '';
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.fecha || !form.proveedor || !form.monto) {
      toast('Fecha, proveedor y monto son requeridos', 'error'); return;
    }
    const payload = {
      ...form,
      monto: parseFloat(form.monto)||0,
      tc: parseFloat(form.tc)||0,
      equivalenteQ: parseFloat(form.equivalenteQ)||0,
    };
    if (editId) {
      await update(editId, payload); toast('Anticipo actualizado'); setEditId(null);
    } else {
      await add(payload); toast('Anticipo registrado');
    }
    setForm({ fecha:today(), proveedor:'', monto:'', moneda:'USD', tc:'', equivalenteQ:'', estado:'pendiente', obs:'' });
  };

  const startEdit = (r) => {
    setForm({
      fecha:r.fecha||today(), proveedor:r.proveedor||'', monto:String(r.monto||''),
      moneda:r.moneda||'USD', tc:String(r.tc||''), equivalenteQ:String(r.equivalenteQ||''),
      estado:r.estado||'pendiente', obs:r.obs||'',
    });
    setEditId(r.id);
  };

  const updateEstado = async (id, estado) => {
    await update(id, { estado }); toast(`Estado actualizado a ${ESTADO_CFG[estado]?.label||estado}`);
  };

  const filtered   = filtro ? data.filter(r => r.estado===filtro) : data;
  const pendTotalQ = data.filter(r=>r.estado==='pendiente').reduce((s,r)=>s+(r.equivalenteQ||0),0);

  return (
    <div style={{ fontFamily:'inherit', maxWidth:1100 }}>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:'1.45rem', fontWeight:800, color:T.primary, margin:0 }}>Anticipos a Proveedores MX</h1>
        <p style={{ fontSize:'.83rem', color:T.textMid, marginTop:4 }}>Control de anticipos en dólares/pesos para importaciones</p>
      </div>

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14, marginBottom:24 }}>
        <div style={{ ...card, marginBottom:0, padding:'16px 20px', borderLeft:`4px solid ${T.warn}` }}>
          <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:6 }}>Pendiente total (Q)</div>
          <div style={{ fontSize:'1.35rem', fontWeight:800, color:T.warn }}>{fmtQ(pendTotalQ)}</div>
        </div>
        <div style={{ ...card, marginBottom:0, padding:'16px 20px' }}>
          <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:6 }}>Anticipos pendientes</div>
          <div style={{ fontSize:'1.35rem', fontWeight:800, color:T.primary }}>{data.filter(r=>r.estado==='pendiente').length}</div>
        </div>
        <div style={{ ...card, marginBottom:0, padding:'16px 20px' }}>
          <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:6 }}>Total registros</div>
          <div style={{ fontSize:'1.35rem', fontWeight:800, color:T.textMid }}>{data.length}</div>
        </div>
      </div>

      {/* Form */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.primary, marginBottom:18, borderBottom:`2px solid ${T.primary}`, paddingBottom:8 }}>
          {editId ? 'Editar Anticipo' : 'Registrar Anticipo'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, marginBottom:14 }}>
          <label style={LS}>Fecha<input type="date" value={form.fecha} onChange={e=>f('fecha',e.target.value)} style={IS}/></label>
          <label style={LS}>Proveedor *<input value={form.proveedor} onChange={e=>f('proveedor',e.target.value)} placeholder="Nombre del proveedor" style={IS}/></label>
          <label style={LS}>
            Moneda
            <select value={form.moneda} onChange={e=>f('moneda',e.target.value)} style={IS}>
              {['USD','MXN'].map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label style={LS}>Monto *<input type="number" min="0" step="0.01" value={form.monto} onChange={e=>f('monto',e.target.value)} placeholder="0.00" style={IS}/></label>
          <label style={LS}>Tipo cambio (→Q)<input type="number" min="0" step="0.01" value={form.tc} onChange={e=>f('tc',e.target.value)} placeholder="0.00" style={IS}/></label>
          <label style={LS}>
            Equivalente Q
            <input readOnly value={form.equivalenteQ ? `Q ${Number(form.equivalenteQ).toLocaleString('es-GT',{minimumFractionDigits:2})}` : ''} style={{ ...IS, background:'#F5F5F5', color:T.primary, fontWeight:700 }}/>
          </label>
          <label style={LS}>
            Estado
            <select value={form.estado} onChange={e=>f('estado',e.target.value)} style={IS}>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="devuelto">Devuelto</option>
            </select>
          </label>
        </div>
        <label style={LS}>
          Observaciones
          <textarea value={form.obs} onChange={e=>f('obs',e.target.value)} rows={2}
            style={{ ...IS, resize:'vertical' }} placeholder="Notas adicionales..."/>
        </label>
        <div style={{ display:'flex', gap:10, marginTop:16 }}>
          <button onClick={handleSave} disabled={saving} style={{
            padding:'11px 28px', background:saving?'#9E9E9E':T.primary, color:T.white,
            border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor:saving?'not-allowed':'pointer',
          }}>
            {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Registrar'}
          </button>
          {editId && (
            <button onClick={()=>{setEditId(null);setForm({fecha:today(),proveedor:'',monto:'',moneda:'USD',tc:'',equivalenteQ:'',estado:'pendiente',obs:''}); }}
              style={{ padding:'11px 20px', background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:6, fontWeight:600, cursor:'pointer', color:T.textMid }}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:'.78rem', color:T.textMid, fontWeight:600 }}>Filtrar:</span>
        {[['','Todos'],['pendiente','Pendientes'],['parcial','Parciales'],['devuelto','Devueltos']].map(([val,label])=>(
          <button key={val} onClick={()=>setFiltro(val)} style={{
            padding:'5px 14px', borderRadius:20, fontSize:'.76rem', fontWeight:600, cursor:'pointer',
            border:`1.5px solid ${filtro===val?T.primary:T.border}`,
            background:filtro===val?T.primary:T.white, color:filtro===val?T.white:T.textMid,
          }}>{label}</button>
        ))}
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary, marginBottom:16 }}>
          Historial ({filtered.length} registros)
        </div>
        {loading ? <Skeleton rows={5}/> : (
          filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:T.textMid, fontSize:'.9rem' }}>
              Sin anticipos para este filtro
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['Fecha','Proveedor','Monto','Moneda','TC','Equivalente Q','Estado','Acciones'].map(h=>(
                      <th key={h} style={TH_S}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0,100).map((r,i)=>(
                    <tr key={r.id}>
                      <td style={TD_S(i%2===1)}>{r.fecha||'—'}</td>
                      <td style={{ ...TD_S(i%2===1), fontWeight:600 }}>{r.proveedor||'—'}</td>
                      <td style={{ ...TD_S(i%2===1), fontWeight:700 }}>{r.moneda||'USD'} {(r.monto||0).toLocaleString('es',{minimumFractionDigits:2})}</td>
                      <td style={TD_S(i%2===1)}>{r.moneda||'USD'}</td>
                      <td style={TD_S(i%2===1)}>{r.tc||'—'}</td>
                      <td style={{ ...TD_S(i%2===1), fontWeight:700, color:T.primary }}>{r.equivalenteQ ? fmtQ(r.equivalenteQ) : '—'}</td>
                      <td style={TD_S(i%2===1)}><EstadoChip estado={r.estado}/></td>
                      <td style={TD_S(i%2===1)}>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                          <button onClick={()=>startEdit(r)} style={{ padding:'3px 10px', background:T.primary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Editar</button>
                          {r.estado==='pendiente' && <button onClick={()=>updateEstado(r.id,'parcial')} style={{ padding:'3px 10px', background:'#1565C0', color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Parcial</button>}
                          {r.estado!=='devuelto' && <button onClick={()=>updateEstado(r.id,'devuelto')} style={{ padding:'3px 10px', background:T.secondary, color:T.white, border:'none', borderRadius:4, fontSize:'.72rem', fontWeight:600, cursor:'pointer' }}>Devuelto</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
