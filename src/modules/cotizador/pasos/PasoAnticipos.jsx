import { useState } from 'react';
import { useWrite } from '../../../hooks/useFirestore';
import { useToast } from '../../../components/Toast';
import { uid, today, fmt, fmtM } from '../hooks/useCotizador';

const T = { primary:'#1B5E20', secondary:'#2E7D32', border:'#E0E0E0', white:'#FFFFFF', textMid:'#6B6B60', textDark:'#1A1A18', warn:'#E65100' };
const IS = { padding:'8px 10px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.83rem', fontFamily:'inherit', width:'100%', color:T.textDark, background:T.white, boxSizing:'border-box', marginTop:2 };
const LS = { fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.primary };
const TH = { padding:'8px 10px', fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', color:T.white, background:T.primary, textAlign:'left', whiteSpace:'nowrap' };

const emptyForm = () => ({ fecha:today(), monto:'', moneda:'mxn', concepto:'Anticipo proveedor', proveedor:'', obs:'' });

export default function PasoAnticipos({ cot, update }) {
  const { add: addAnticipo } = useWrite('iAnticipo');
  const toast = useToast();
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const totalMXN = (cot.anticipos||[]).filter(a=>a.moneda==='mxn').reduce((s,a)=>s+(parseFloat(a.monto)||0),0);
  const totalGTQ = (cot.anticipos||[]).filter(a=>a.moneda==='gtq').reduce((s,a)=>s+(parseFloat(a.monto)||0),0);

  const handleAdd = async () => {
    if (!form.monto || !form.fecha) { toast('Fecha y monto requeridos'); return; }
    setSaving(true);
    try {
      const anticipo = {
        fecha: form.fecha, monto: parseFloat(form.monto)||0,
        moneda: form.moneda, concepto: form.concepto,
        proveedor: form.proveedor, obs: form.obs,
        cotizacionId: cot.id, cotizacionNom: cot.nombre||'',
        creadoEn: new Date().toISOString(),
      };
      await addAnticipo(anticipo);
      const newList = [...(cot.anticipos||[]), { ...anticipo, id: uid() }];
      await update({ anticipos: newList, estado: 'anticipos' });
      setForm(emptyForm()); setOpen(false);
      toast('✅ Anticipo registrado');
    } catch(err) { toast('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ padding:20 }}>
      <div style={{ marginBottom:16, display:'flex', gap:20, flexWrap:'wrap', fontSize:'.83rem', padding:'10px 14px', background:'#F9FBF9', borderRadius:6 }}>
        <span>Anticipos MXN: <strong style={{ color:T.warn }}>$ {fmtM(totalMXN)}</strong></span>
        <span>Anticipos GTQ: <strong style={{ color:T.warn }}>Q {fmt(totalGTQ)}</strong></span>
        <span style={{ color:T.textMid }}>({(cot.anticipos||[]).length} registros)</span>
      </div>

      <button onClick={()=>setOpen(o=>!o)}
        style={{ padding:'7px 18px', background:T.primary, color:T.white, border:'none', borderRadius:5, cursor:'pointer', fontWeight:700, fontSize:'.83rem', marginBottom:16 }}>
        ＋ Registrar anticipo
      </button>

      {open && (
        <div style={{ background:'#F9FBF9', border:`1px solid ${T.border}`, borderRadius:8, padding:18, marginBottom:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div><label style={LS}>Fecha</label><input type="date" value={form.fecha} onChange={set('fecha')} style={IS}/></div>
            <div><label style={LS}>Monto</label><input type="number" step="0.01" value={form.monto} onChange={set('monto')} style={IS} placeholder="0.00"/></div>
            <div>
              <label style={LS}>Moneda</label>
              <select value={form.moneda} onChange={set('moneda')} style={IS}>
                <option value="mxn">MXN (Peso mexicano)</option>
                <option value="gtq">GTQ (Quetzal)</option>
                <option value="usd">USD (Dólar)</option>
              </select>
            </div>
            <div><label style={LS}>Proveedor</label><input value={form.proveedor} onChange={set('proveedor')} style={IS} placeholder="Nombre proveedor"/></div>
            <div style={{ gridColumn:'span 2' }}><label style={LS}>Concepto</label><input value={form.concepto} onChange={set('concepto')} style={IS}/></div>
            <div style={{ gridColumn:'span 2' }}><label style={LS}>Observaciones</label><input value={form.obs} onChange={set('obs')} style={IS}/></div>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={()=>setOpen(false)} style={{ padding:'7px 16px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:5, cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
            <button onClick={handleAdd} disabled={saving}
              style={{ padding:'7px 18px', background:T.primary, color:T.white, border:'none', borderRadius:5, cursor:'pointer', fontWeight:700, opacity:saving?.6:1, fontFamily:'inherit' }}>
              {saving ? 'Guardando…' : 'Guardar anticipo'}
            </button>
          </div>
        </div>
      )}

      {(cot.anticipos||[]).length > 0 ? (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.8rem' }}>
          <thead><tr>
            {['Fecha','Proveedor','Concepto','Monto','Moneda'].map(h=><th key={h} style={TH}>{h}</th>)}
          </tr></thead>
          <tbody>
            {(cot.anticipos||[]).map((a,i) => (
              <tr key={a.id||i} style={{ background:i%2?'#F9FBF9':T.white }}>
                <td style={{ padding:'7px 10px' }}>{a.fecha}</td>
                <td style={{ padding:'7px 10px' }}>{a.proveedor||'—'}</td>
                <td style={{ padding:'7px 10px', color:T.textMid }}>{a.concepto}</td>
                <td style={{ padding:'7px 10px', fontWeight:700, color:T.warn, textAlign:'right' }}>{(a.moneda||'').toUpperCase()==='MXN'?'$':'Q'} {fmtM(a.monto)}</td>
                <td style={{ padding:'7px 10px', color:T.textMid }}>{(a.moneda||'mxn').toUpperCase()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ padding:'24px 0', textAlign:'center', color:T.textMid }}>Sin anticipos registrados.</div>
      )}
    </div>
  );
}
