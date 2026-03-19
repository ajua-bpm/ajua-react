import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useEmpleados } from '../../hooks/useMainData';
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
  accent:    '#2E7D32',
};

const card  = { background:'#fff', borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:20, marginBottom:20 };
const TH_S  = { padding:'10px 14px', fontSize:'.75rem', textTransform:'uppercase', fontWeight:700, letterSpacing:'.06em', color:T.white, background:T.primary, textAlign:'left', whiteSpace:'nowrap' };
const TD_S  = (alt) => ({ padding:'9px 14px', fontSize:'.83rem', borderBottom:`1px solid #F0F0F0`, background:alt?'#F9FBF9':'#fff', color:T.textDark });
const LS    = { display:'flex', flexDirection:'column', gap:5, fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.secondary };
const IS    = { padding:'9px 12px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.85rem', outline:'none', fontFamily:'inherit', width:'100%', marginTop:2, color:T.textDark, background:T.white };

const today = () => new Date().toISOString().slice(0,10);
const fmtQ  = n => Number(n||0).toLocaleString('es-GT',{style:'currency',currency:'GTQ',minimumFractionDigits:2});

const CATS = ['Combustible','Mantenimiento','Alimentación','Servicios','Mano de obra','Materiales','Otros'];

const CHIP_CAT = {
  Combustible:  '#1565C0',
  Mantenimiento:'#6A1B9A',
  Alimentación: '#2E7D32',
  Servicios:    '#00695C',
  'Mano de obra':'#E65100',
  Materiales:   '#4E342E',
  Otros:        '#546E7A',
};

export default function Gastos() {
  const toast = useToast();
  const { data, loading } = useCollection('gastosDiarios', { orderField:'fecha', orderDir:'desc', limit:300 });
  const { empleados } = useEmpleados();
  const { add, saving } = useWrite('gastosDiarios');

  const [form, setForm] = useState({
    fecha:today(), categoria:'Combustible', descripcion:'', monto:'', responsable:'', recibo:'', obs:'',
  });
  const [filtrocat, setFiltrocat] = useState('');

  const f = (field, val) => setForm(p => ({ ...p, [field]: val }));

  const handleSave = async () => {
    if (!form.fecha || !form.descripcion || !form.monto) {
      toast('Fecha, descripción y monto son requeridos', 'error'); return;
    }
    const monto = parseFloat(form.monto);
    if (isNaN(monto) || monto <= 0) { toast('Monto inválido', 'error'); return; }
    await add({ ...form, monto });
    toast('Gasto registrado correctamente');
    setForm(p => ({ ...p, descripcion:'', monto:'', recibo:'', obs:'', responsable:'' }));
  };

  const filtered = filtrocat ? data.filter(r => r.categoria === filtrocat) : data;

  const totalHoy  = data.filter(r => r.fecha === today()).reduce((s,r) => s+(r.monto||0), 0);
  const mes       = today().slice(0,7);
  const totalMes  = data.filter(r => (r.fecha||'').startsWith(mes)).reduce((s,r) => s+(r.monto||0), 0);
  const diasMes   = new Set(data.filter(r => (r.fecha||'').startsWith(mes)).map(r=>r.fecha)).size;
  const promedio  = diasMes > 0 ? totalMes / diasMes : 0;

  return (
    <div style={{ fontFamily:'inherit', maxWidth:1100 }}>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:'1.45rem', fontWeight:800, color:T.primary, margin:0 }}>Gastos Operacionales</h1>
        <p style={{ fontSize:'.83rem', color:T.textMid, marginTop:4 }}>Registro y control de gastos diarios</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:24 }}>
        {[
          { label:'Total hoy',        val:fmtQ(totalHoy), color:T.primary  },
          { label:'Total mes',        val:fmtQ(totalMes), color:T.secondary },
          { label:'Promedio diario',  val:fmtQ(promedio), color:T.textMid   },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...card, marginBottom:0, padding:'16px 20px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:T.textMid, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:'1.35rem', fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.95rem', color:T.primary, marginBottom:18, borderBottom:`2px solid ${T.primary}`, paddingBottom:8 }}>
          Registrar Gasto
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, marginBottom:14 }}>
          <label style={LS}>Fecha<input type="date" value={form.fecha} onChange={e=>f('fecha',e.target.value)} style={IS}/></label>
          <label style={LS}>
            Categoría
            <select value={form.categoria} onChange={e=>f('categoria',e.target.value)} style={IS}>
              {CATS.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={{...LS, gridColumn:'span 2'}}>
            Descripción *
            <input value={form.descripcion} onChange={e=>f('descripcion',e.target.value)} placeholder="Descripción del gasto..." style={IS}/>
          </label>
          <label style={LS}>Monto (Q)<input type="number" min="0" step="0.01" value={form.monto} onChange={e=>f('monto',e.target.value)} placeholder="0.00" style={IS}/></label>
          <label style={LS}>
            Responsable
            <select value={form.responsable} onChange={e=>f('responsable',e.target.value)} style={IS}>
              <option value="">— Seleccionar —</option>
              {empleados.map(e=><option key={e.id||e.nombre} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </label>
          <label style={LS}>No. Recibo<input value={form.recibo} onChange={e=>f('recibo',e.target.value)} placeholder="Número de recibo" style={IS}/></label>
        </div>
        <label style={LS}>
          Observaciones
          <textarea value={form.obs} onChange={e=>f('obs',e.target.value)} rows={2}
            style={{ ...IS, resize:'vertical', marginBottom:0 }} placeholder="Notas adicionales..."/>
        </label>
        <div style={{ marginTop:16 }}>
          <button onClick={handleSave} disabled={saving} style={{
            padding:'11px 28px', background:saving?'#9E9E9E':T.primary, color:T.white,
            border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem',
            cursor:saving?'not-allowed':'pointer', letterSpacing:'.04em',
          }}>
            {saving ? 'Guardando...' : 'Registrar Gasto'}
          </button>
        </div>
      </div>

      {/* Filtros por categoría */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
        <button onClick={()=>setFiltrocat('')} style={{
          padding:'5px 14px', borderRadius:20, fontSize:'.76rem', fontWeight:600, cursor:'pointer',
          border:`1.5px solid ${!filtrocat?T.primary:T.border}`,
          background:!filtrocat?T.primary:T.white,
          color:!filtrocat?T.white:T.textMid,
        }}>Todos</button>
        {CATS.map(c=>(
          <button key={c} onClick={()=>setFiltrocat(c===filtrocat?'':c)} style={{
            padding:'5px 14px', borderRadius:20, fontSize:'.76rem', fontWeight:600, cursor:'pointer',
            border:`1.5px solid ${filtrocat===c?T.primary:T.border}`,
            background:filtrocat===c?T.primary:T.white,
            color:filtrocat===c?T.white:T.textMid,
          }}>{c}</button>
        ))}
      </div>

      {/* History Table */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'.9rem', color:T.primary, marginBottom:16 }}>
          Historial ({filtered.length} registros)
        </div>
        {loading ? <Skeleton rows={6}/> : (
          <>
            {filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'48px 0', color:T.textMid, fontSize:'.9rem' }}>
                Sin gastos registrados para este filtro
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      {['Fecha','Categoría','Descripción','Monto','Responsable','Recibo'].map(h=>(
                        <th key={h} style={TH_S}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0,120).map((r,i)=>(
                      <tr key={r.id}>
                        <td style={TD_S(i%2===1)}>{r.fecha||'—'}</td>
                        <td style={TD_S(i%2===1)}>
                          <span style={{
                            display:'inline-block', padding:'2px 9px', borderRadius:100,
                            fontSize:'.7rem', fontWeight:700,
                            background:`${CHIP_CAT[r.categoria]||T.textMid}18`,
                            color:CHIP_CAT[r.categoria]||T.textMid,
                          }}>{r.categoria||'—'}</span>
                        </td>
                        <td style={{ ...TD_S(i%2===1), maxWidth:260 }}>{r.descripcion||'—'}</td>
                        <td style={{ ...TD_S(i%2===1), fontWeight:700, color:T.danger }}>{fmtQ(r.monto)}</td>
                        <td style={{ ...TD_S(i%2===1), color:T.textMid }}>{r.responsable||'—'}</td>
                        <td style={{ ...TD_S(i%2===1), color:T.textMid }}>{r.recibo||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
