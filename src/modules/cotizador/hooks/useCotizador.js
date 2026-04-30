// ── Pure calculation logic for Cotizador de Contenedor ────────────
export const uid   = () => Math.random().toString(36).slice(2,9) + Date.now().toString(36);
export const today = () => new Date().toISOString().slice(0,10);
export const fmt   = n  => Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2});
export const fmtM  = n  => Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2});

export const ESTADOS = {
  borrador:   {label:'Borrador',     color:'#6B6B60', bg:'rgba(107,107,96,.10)'},
  anticipos:  {label:'Anticipos MX', color:'#E65100', bg:'rgba(230,81,0,.10)'},
  duca:       {label:'DUCA recibida',color:'#1565C0', bg:'rgba(21,101,192,.10)'},
  bodega:     {label:'En bodega',    color:'#2E7D32', bg:'rgba(46,125,50,.12)'},
  aceptada:   {label:'Aceptada',     color:'#E65100', bg:'rgba(230,81,0,.10)'},
  en_entrega: {label:'En entrega',   color:'#1565C0', bg:'rgba(21,101,192,.10)'},
  entregada:  {label:'Entregada',    color:'#2E7D32', bg:'rgba(46,125,50,.12)'},
  pagado:     {label:'Pagado',       color:'#1B5E20', bg:'rgba(27,94,32,.12)'},
};

export const PIPE_INT = ['borrador','anticipos','duca','bodega'];
export const PIPE_TER = ['borrador','aceptada','en_entrega','entregada','pagado'];

// ── calcTotales: returns enriched products + all totals ───────────
export function calcTotales(productos, gastosMX, gastosGT, tc) {
  const t = parseFloat(tc)||0;

  // Pass 1: total compra GTQ (needed for proration)
  let totalCompraGTQ = 0;
  (productos||[]).forEach(p => {
    const sMXN = (parseFloat(p.qty)||0)*(parseFloat(p.pMXN)||0);
    totalCompraGTQ += t>0 ? sMXN/t : 0;
  });

  // Gastos totales GTQ
  let totalGastosMXN=0, totalGastosGTQ=0;
  (gastosMX||[]).forEach(g => {
    const m=parseFloat(g.monto)||0;
    if (g.moneda==='gtq') totalGastosGTQ+=m;
    else { totalGastosMXN+=m; totalGastosGTQ+=t>0?m/t:0; }
  });
  (gastosGT||[]).forEach(g => { totalGastosGTQ+=parseFloat(g.monto)||0; });

  // Pass 2: per-product with proration
  let totalKg=0, totalLbs=0, totalBultos=0;
  const prods = (productos||[]).map(p => {
    const qty=parseFloat(p.qty)||0, kgu=parseFloat(p.kgu)||0, pMXN=parseFloat(p.pMXN)||0;
    const kgT=qty*kgu, lbsT=kgT*2.20462, sMXN=qty*pMXN;
    const pGTQ=t>0?pMXN/t:0, sGTQ=t>0?sMXN/t:0;
    const pctGas=totalCompraGTQ>0?sGTQ/totalCompraGTQ:0;
    const gastosP=totalGastosGTQ*pctGas;
    const costoTot=sGTQ+gastosP;
    totalKg+=kgT; totalLbs+=lbsT; totalBultos+=qty;
    return {
      ...p, kgT, lbsT, pGTQ, sMXN, sGTQ, pctGas, gastosP, costoTot,
      costoUd: qty>0?costoTot/qty:0,
      costoKg: kgT>0?costoTot/kgT:0,
      costoLb: lbsT>0?costoTot/lbsT:0,
    };
  });
  return {
    productos: prods,
    totalCompraGTQ, totalGastosMXN, totalGastosGTQ,
    totalCosto: totalCompraGTQ+totalGastosGTQ,
    totalKg, totalLbs, totalBultos,
  };
}

export const GASTOS_MX_DEF = [
  'Transporte México','Agente Aduanal México','Trasbordo / Cruce frontera MX',
  'Laboratorios / Análisis','Tarimas','Cargadores México',
];
export const GASTOS_GT_DEF = [
  'Agente Aduanal Guatemala','Gastos MAGA','Transporte GT (frontera → bodega)',
  'Gastos en frontera GT','Estadía camión','Combustible',
];
