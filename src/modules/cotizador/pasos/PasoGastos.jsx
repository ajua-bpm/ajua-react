import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../../components/Toast';
import { uid, calcTotales, fmt, fmtM } from '../hooks/useCotizador';

const T = { primary:'#1B5E20', secondary:'#2E7D32', border:'#E0E0E0', white:'#FFFFFF', textMid:'#6B6B60', textDark:'#1A1A18' };
const IS = { padding:'6px 8px', border:`1px solid ${T.border}`, borderRadius:4, fontSize:'.82rem', fontFamily:'inherit', color:T.textDark };
const TH = { padding:'8px 10px', fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', color:T.white, background:T.primary, textAlign:'left' };

// ── Estado local para editar gastos sin afectar Firestore en cada keystroke ──
function useLocalGastos(cotId, firestoreList) {
  const [local, setLocal] = useState(firestoreList || []);

  // Solo resetear si cambia la cotización (id diferente)
  useEffect(() => {
    setLocal(firestoreList || []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotId]);

  return [local, setLocal];
}

function Section({ title, rows, onAdd, onUpdLocal, onBlur, onDel, monedaCol }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
        <h3 style={{ margin:0, fontSize:'.9rem', fontWeight:700, color:T.primary }}>{title}</h3>
        <button onClick={onAdd} style={{ padding:'5px 14px', background:T.primary, color:T.white, border:'none', borderRadius:4, cursor:'pointer', fontSize:'.78rem', fontWeight:700 }}>
          ＋ Agregar
        </button>
      </div>
      {rows.length > 0 ? (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>
            <th style={TH}>Concepto</th>
            {monedaCol && <th style={TH}>Moneda</th>}
            <th style={TH}>Monto</th>
            <th style={TH}></th>
          </tr></thead>
          <tbody>
            {rows.map(g => (
              <GastoRow
                key={g.id}
                g={g}
                onChange={(k, v) => onUpdLocal(g.id, k, v)}
                onBlur={onBlur}
                onDel={() => onDel(g.id)}
                monedaCol={monedaCol}
              />
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ padding:'16px 0', color:T.textMid, fontSize:'.82rem' }}>Sin gastos registrados.</div>
      )}
    </div>
  );
}

function GastoRow({ g, onChange, onBlur, onDel, monedaCol }) {
  return (
    <tr>
      <td style={{ padding:'4px 6px' }}>
        <input
          value={g.label}
          onChange={e => onChange('label', e.target.value)}
          onBlur={() => onBlur()}
          style={{ ...IS, width:'100%', minWidth:180 }}
        />
      </td>
      {monedaCol && (
        <td style={{ padding:'4px 6px' }}>
          <select
            value={g.moneda||'mxn'}
            onChange={e => { onChange('moneda', e.target.value); onBlur(); }}
            style={{ ...IS, width:70 }}
          >
            <option value="mxn">MXN</option>
            <option value="gtq">GTQ</option>
          </select>
        </td>
      )}
      <td style={{ padding:'4px 6px' }}>
        <input
          type="number"
          value={g.monto ?? ''}
          onChange={e => onChange('monto', e.target.value)}
          onBlur={() => onBlur()}
          style={{ ...IS, width:110, textAlign:'right' }}
          placeholder="0.00"
        />
      </td>
      <td style={{ padding:'4px 6px' }}>
        <button onClick={onDel} style={{ background:'none', border:'none', color:'#C62828', cursor:'pointer', fontSize:'.9rem' }}>✕</button>
      </td>
    </tr>
  );
}

export default function PasoGastos({ cot, update }) {
  const toast = useToast();

  // Estado local — no se liga a cot en cada re-render
  const [gastosMX, setGastosMX] = useLocalGastos(cot.id, cot.gastosMX);
  const [gastosGT, setGastosGT] = useLocalGastos(cot.id, cot.gastosGT);

  // Guardar a Firestore (llamar desde onBlur o al agregar/quitar fila)
  const saveMX = useCallback((list) => {
    const t = calcTotales(cot.productos, list, cot.gastosGT, cot.tc);
    update({ gastosMX: list, totalGastosMXN: t.totalGastosMXN, totalGastosGTQ: t.totalGastosGTQ, totalCosto: t.totalCosto });
  }, [cot.productos, cot.gastosGT, cot.tc, update]);

  const saveGT = useCallback((list) => {
    const t = calcTotales(cot.productos, cot.gastosMX, list, cot.tc);
    update({ gastosGT: list, totalGastosMXN: t.totalGastosMXN, totalGastosGTQ: t.totalGastosGTQ, totalCosto: t.totalCosto });
  }, [cot.productos, cot.gastosMX, cot.tc, update]);

  // Totales calculados desde estado local (respuesta visual inmediata)
  const { totalGastosMXN, totalGastosGTQ } = calcTotales(cot.productos, gastosMX, gastosGT, cot.tc);

  // Agregar fila
  const addMX = () => {
    const next = [...gastosMX, { id: uid(), label: 'Nuevo gasto MX', monto: '', moneda: 'mxn' }];
    setGastosMX(next);
    saveMX(next);
  };
  const addGT = () => {
    const next = [...gastosGT, { id: uid(), label: 'Nuevo gasto GT', monto: '' }];
    setGastosGT(next);
    saveGT(next);
  };

  // Eliminar fila
  const delMX = (id) => {
    const next = gastosMX.filter(g => g.id !== id);
    setGastosMX(next);
    saveMX(next);
  };
  const delGT = (id) => {
    const next = gastosGT.filter(g => g.id !== id);
    setGastosGT(next);
    saveGT(next);
  };

  // Cambiar campo localmente (NO guarda a Firestore — se guarda en onBlur)
  const updMXLocal = (id, k, v) =>
    setGastosMX(prev => prev.map(g => g.id === id ? { ...g, [k]: v } : g));
  const updGTLocal = (id, k, v) =>
    setGastosGT(prev => prev.map(g => g.id === id ? { ...g, [k]: v } : g));

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom:16, padding:'10px 14px', background:'#F9FBF9', borderRadius:6, fontSize:'.82rem', display:'flex', gap:24, flexWrap:'wrap' }}>
        <span>Gastos MX: <strong style={{ color:T.secondary }}>$ {fmtM(totalGastosMXN)} MXN</strong></span>
        <span>Total gastos GTQ: <strong style={{ color:T.primary }}>Q {fmt(totalGastosGTQ)}</strong></span>
        <span style={{ fontSize:'.75rem', color:T.textMid }}>TC: 1 MXN = Q{cot.tc}</span>
        <span style={{ fontSize:'.75rem', color:T.textMid }}>💾 Se guarda al salir del campo</span>
      </div>

      <Section
        title="🇲🇽 Gastos México"
        rows={gastosMX}
        onAdd={addMX}
        onUpdLocal={updMXLocal}
        onBlur={() => saveMX(gastosMX)}
        onDel={delMX}
        monedaCol={true}
      />
      <Section
        title="🇬🇹 Gastos Guatemala"
        rows={gastosGT}
        onAdd={addGT}
        onUpdLocal={updGTLocal}
        onBlur={() => saveGT(gastosGT)}
        onDel={delGT}
        monedaCol={false}
      />
    </div>
  );
}
