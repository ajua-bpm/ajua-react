import { useState, useMemo } from 'react';
import { useProductosCatalogo } from '../../../hooks/useMainData';
import { useToast } from '../../../components/Toast';
import { uid, calcTotales, fmt, fmtM } from '../hooks/useCotizador';

const T = { primary:'#1B5E20', secondary:'#2E7D32', border:'#E0E0E0', white:'#FFFFFF', textMid:'#6B6B60', textDark:'#1A1A18' };
const TH = { padding:'8px 10px', fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', color:T.white, background:T.primary, textAlign:'left', whiteSpace:'nowrap' };
const IS = { padding:'6px 8px', border:`1px solid ${T.border}`, borderRadius:4, fontSize:'.82rem', fontFamily:'inherit', color:T.textDark };

export default function PasoProductos({ cot, update }) {
  const { productos: catalogo } = useProductosCatalogo();
  const toast = useToast();
  const [selId, setSelId] = useState('');
  const [saving, setSaving] = useState(false);

  const { productos, totalKg, totalLbs, totalBultos, totalCompraGTQ, totalGastosGTQ, totalCosto } =
    useMemo(() => calcTotales(cot.productos, cot.gastosMX, cot.gastosGT, cot.tc), [cot]);

  const save = async (newProds) => {
    setSaving(true);
    const t = calcTotales(newProds, cot.gastosMX, cot.gastosGT, cot.tc);
    await update({ productos: t.productos, totalKg:t.totalKg, totalLbs:t.totalLbs, totalBultos:t.totalBultos, totalCompraGTQ:t.totalCompraGTQ, totalGastosGTQ:t.totalGastosGTQ, totalCosto:t.totalCosto });
    setSaving(false);
  };

  const addProd = () => {
    if (!selId) return;
    const cat = (catalogo||[]).find(c => c.id === selId);
    if (!cat) return;
    if ((cot.productos||[]).find(p => p.productoId === selId)) { toast('Producto ya agregado'); return; }
    const p = { id:uid(), productoId:selId, nom:cat.nombre||cat.nom||'', unit:cat.unidad||'bulto', kgu:cat.kgPorUnidad||cat.kgu||0, qty:0, pMXN:0 };
    save([...(cot.productos||[]), p]);
    setSelId('');
  };

  const updProd = (id, field, val) => {
    const newProds = (cot.productos||[]).map(p => p.id===id ? { ...p, [field]: val } : p);
    save(newProds);
  };

  const delProd = (id) => save((cot.productos||[]).filter(p => p.id !== id));

  return (
    <div style={{ padding:20 }}>
      {/* TC header */}
      <div style={{ marginBottom:16, display:'flex', gap:24, flexWrap:'wrap', fontSize:'.82rem', color:T.textMid }}>
        <span>TC: <strong style={{ color:T.textDark }}>1 MXN = Q{cot.tc}</strong></span>
        <span>Total compra: <strong style={{ color:T.secondary }}>Q {fmt(totalCompraGTQ)}</strong></span>
        <span>Gastos: <strong style={{ color:T.secondary }}>Q {fmt(totalGastosGTQ)}</strong></span>
        <span style={{ fontWeight:700, color:T.primary }}>Costo total: Q {fmt(totalCosto)}</span>
        <span>{fmt(totalKg)} kg · {fmt(totalLbs)} lbs · {Math.round(totalBultos)} bultos</span>
      </div>

      {/* Add product row */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <select value={selId} onChange={e=>setSelId(e.target.value)} style={{ ...IS, flex:'1 1 220px' }}>
          <option value="">— Seleccionar producto del catálogo —</option>
          {(catalogo||[]).map(c => <option key={c.id} value={c.id}>{c.nombre||c.nom}</option>)}
        </select>
        <button onClick={addProd} disabled={!selId||saving}
          style={{ padding:'6px 16px', background:T.primary, color:T.white, border:'none', borderRadius:4, cursor:'pointer', fontWeight:700, fontSize:'.82rem' }}>
          ＋ Agregar
        </button>
      </div>

      {/* Products table */}
      {(cot.productos||[]).length > 0 && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.78rem' }}>
            <thead>
              <tr>{['Producto','Qty','Unidad','Kg/u','Kg Tot','Precio MXN','Precio GTQ','Sub GTQ','% Gasto','Gastos','Costo Tot','Costo/kg',''].map(h=><th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {productos.map((p,i) => (
                <tr key={p.id} style={{ background:i%2?'#F9FBF9':T.white }}>
                  <td style={{ padding:'7px 10px', fontWeight:600, color:T.primary }}>{p.nom}</td>
                  <td style={{ padding:'4px 6px' }}>
                    <input type="number" value={p.qty||''} onChange={e=>updProd(p.id,'qty',e.target.value)}
                      style={{ ...IS, width:60, textAlign:'right' }} />
                  </td>
                  <td style={{ padding:'4px 6px', color:T.textMid }}>{p.unit}</td>
                  <td style={{ padding:'4px 6px' }}>
                    <input type="number" value={p.kgu||''} onChange={e=>updProd(p.id,'kgu',e.target.value)}
                      style={{ ...IS, width:65, textAlign:'right' }} />
                  </td>
                  <td style={{ padding:'7px 10px', textAlign:'right' }}>{fmt(p.kgT)}</td>
                  <td style={{ padding:'4px 6px' }}>
                    <input type="number" value={p.pMXN||''} onChange={e=>updProd(p.id,'pMXN',e.target.value)}
                      style={{ ...IS, width:80, textAlign:'right' }} />
                  </td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:T.textMid }}>Q{fmt(p.pGTQ)}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:T.secondary }}>Q{fmt(p.sGTQ)}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:T.textMid }}>{((p.pctGas||0)*100).toFixed(1)}%</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:T.textMid }}>Q{fmt(p.gastosP)}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:700, color:T.primary }}>Q{fmt(p.costoTot)}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:T.textMid }}>Q{fmt(p.costoKg)}/kg</td>
                  <td style={{ padding:'4px 6px' }}>
                    <button onClick={()=>delProd(p.id)} style={{ background:'none', border:'none', color:'#C62828', cursor:'pointer', fontSize:'.9rem' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(cot.productos||[]).length === 0 && (
        <div style={{ textAlign:'center', padding:'32px 0', color:T.textMid }}>Sin productos — agrega del catálogo.</div>
      )}
    </div>
  );
}
