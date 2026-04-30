import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWrite } from '../../hooks/useFirestore';
import { useClientes } from '../../hooks/useMainData';
import { useToast } from '../../components/Toast';
import { uid, today, GASTOS_MX_DEF, GASTOS_GT_DEF } from './hooks/useCotizador';

const T = { primary:'#1B5E20', border:'#E0E0E0', white:'#FFFFFF', textDark:'#1A1A18', textMid:'#6B6B60' };
const IS = { padding:'9px 12px', border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:'.85rem', fontFamily:'inherit', width:'100%', marginTop:2, color:T.textDark, background:T.white, boxSizing:'border-box' };
const LS = { fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:T.primary };

export default function CotizadorNuevo() {
  const nav = useNavigate();
  const { add } = useWrite('cotizaciones');
  const { clientes } = useClientes();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    nombre:'', tipo:'interno', fecha:today(), tc:'7.5', duca:'', obs:'',
    cliente:'', pais:'México', monedaCli:'MXN',
  });

  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!f.nombre.trim()) { toast('Nombre requerido'); return; }
    setSaving(true);
    try {
      const gastosMX = GASTOS_MX_DEF.map(label => ({ id:uid(), label, monto:'', moneda:'mxn' }));
      const gastosGT = GASTOS_GT_DEF.map(label => ({ id:uid(), label, monto:'' }));
      const rec = {
        nombre: f.nombre.trim(), tipo: f.tipo, fecha: f.fecha,
        tc: parseFloat(f.tc) || 7.5, estado:'borrador',
        duca: f.duca, obs: f.obs,
        ...(f.tipo === 'terceros' && { cliente:f.cliente, pais:f.pais, monedaCli:f.monedaCli }),
        gastosMX, gastosGT,
        productos:[], anticipos:[], pagos:[], ducaInfo:null, bodegaInfo:null,
        totalKg:0, totalLbs:0, totalBultos:0, totalCompraGTQ:0, totalGastosGTQ:0, totalCosto:0,
        creadoEn: new Date().toISOString(),
      };
      const newId = await add(rec);
      nav(`/cotizador/${newId}`);
    } catch(err) {
      toast('Error al guardar: ' + err.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ padding:'24px 28px', maxWidth:600, fontFamily:'inherit' }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ margin:0, fontSize:'1.2rem', fontWeight:700, color:T.primary }}>Nueva Cotización</h2>
        <p style={{ margin:'3px 0 0', fontSize:'.82rem', color:T.textMid }}>Importación de contenedor</p>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ background:T.white, borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,.10)', padding:24 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            <div style={{ gridColumn:'span 2' }}>
              <label style={LS}>Nombre / Referencia *</label>
              <input value={f.nombre} onChange={set('nombre')} style={IS} placeholder="ej: Contenedor Brócoli Marzo 2026" required />
            </div>
            <div>
              <label style={LS}>Tipo</label>
              <select value={f.tipo} onChange={set('tipo')} style={IS}>
                <option value="interno">🏭 Interno (Importación propia)</option>
                <option value="terceros">🤝 Terceros (Venta a cliente)</option>
              </select>
            </div>
            <div>
              <label style={LS}>Fecha</label>
              <input type="date" value={f.fecha} onChange={set('fecha')} style={IS} />
            </div>
            <div>
              <label style={LS}>Tipo de cambio (1 MXN = ? GTQ)</label>
              <input type="number" step="0.01" value={f.tc} onChange={set('tc')} style={IS} placeholder="7.5" />
            </div>
            <div>
              <label style={LS}>No. DUCA (opcional)</label>
              <input value={f.duca} onChange={set('duca')} style={IS} placeholder="ej: GT-2026-001234" />
            </div>
            {f.tipo === 'terceros' && <>
              <div>
                <label style={LS}>Cliente</label>
                <select value={f.cliente} onChange={set('cliente')} style={IS}>
                  <option value="">— Seleccionar cliente —</option>
                  {(clientes||[]).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={LS}>País destino</label>
                <input value={f.pais} onChange={set('pais')} style={IS} placeholder="Guatemala" />
              </div>
              <div>
                <label style={LS}>Moneda cliente</label>
                <select value={f.monedaCli} onChange={set('monedaCli')} style={IS}>
                  <option value="GTQ">GTQ (Quetzal)</option>
                  <option value="USD">USD (Dólar)</option>
                  <option value="MXN">MXN (Peso)</option>
                </select>
              </div>
            </>}
            <div style={{ gridColumn:'span 2' }}>
              <label style={LS}>Observaciones</label>
              <textarea value={f.obs} onChange={set('obs')} style={{ ...IS, height:60, resize:'vertical' }} />
            </div>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button type="button" onClick={() => nav('/cotizador')}
              style={{ padding:'9px 20px', background:'transparent', border:`1.5px solid ${T.border}`, borderRadius:6, cursor:'pointer', fontSize:'.88rem', fontFamily:'inherit' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              style={{ padding:'9px 24px', background:T.primary, color:T.white, border:'none', borderRadius:6, fontWeight:700, fontSize:'.88rem', cursor:'pointer', opacity:saving ? .6 : 1, fontFamily:'inherit' }}>
              {saving ? 'Guardando…' : 'Crear cotización →'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
