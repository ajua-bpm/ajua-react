const T = { primary:'#1B5E20', danger:'#C62828', warn:'#E65100', mid:'#6B6B60', dark:'#1A1A18', border:'#E0E0E0' };
const fmtQ = n => 'Q ' + Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtP = n => Number(n||0).toFixed(1) + '%';

function Row({ label, value, indent=0, bold=false, color, borderTop=false }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'5px 0', paddingLeft: indent*16, borderTop: borderTop?`1.5px solid ${T.border}`:'none' }}>
      <span style={{ fontSize:'.86rem', color: color||T.dark, fontWeight: bold?700:400 }}>{label}</span>
      <span style={{ fontSize:'.88rem', fontWeight: bold?700:400, color: color||(value<0?T.danger:T.dark), fontFamily:'monospace', marginLeft:16 }}>
        {value<0 ? '-'+fmtQ(Math.abs(value)) : fmtQ(value)}
      </span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontWeight:700, fontSize:'.78rem', color:T.mid, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6, paddingBottom:4, borderBottom:`2px solid ${T.border}` }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function PnL({ pnl, movimientos }) {
  const { ingresosBanco, ventasWalmart, felEmitidas, notasCredito, ivaRetenido, ingresoNeto,
          costosProducto, utilidadBruta, margenBruto,
          gastosFijos, gastosVariables, utilidadNeta, margenNeto,
          puntoEquilibrio, pctEq, sinClasificar } = pnl;

  // Desglose fijos y variables desde movimientos
  const sumCat = (catId) => movimientos.filter(m=>m.categoria===catId&&m.clasificado).reduce((s,m)=>s+(m.debito||0),0);

  return (
    <div style={{ maxWidth:560 }}>
      {sinClasificar > 0 && (
        <div style={{ padding:'10px 14px', background:'#FFF3E0', border:`1px solid #FFB74D`, borderRadius:8, marginBottom:16, fontSize:'.83rem', color:T.warn }}>
          ⚠️ {sinClasificar} movimientos sin clasificar — los números pueden estar incompletos
        </div>
      )}

      <Section title="Ingresos">
        <Row label="Ventas Walmart (salidas)" value={ventasWalmart} indent={1} color="#15803d" />
        <Row label="Otros cobros banco (clientes)"  value={ingresosBanco} indent={1} />
        <Row label="Facturas FEL emitidas"    value={felEmitidas}   indent={1} />
        {notasCredito > 0 && <Row label="- Notas de crédito"     value={-notasCredito} indent={1} color={T.danger} />}
        {ivaRetenido  > 0 && <Row label="- IVA retenido Walmart" value={-ivaRetenido}  indent={1} color={T.danger} />}
        <Row label="INGRESO NETO" value={ingresoNeto} bold borderTop color="#15803d" />
      </Section>

      <Section title="Costos de producto">
        <Row label="Compras importación" value={sumCat('compra_importacion')} indent={1} />
        <Row label="Compras locales"     value={sumCat('compra_local')}       indent={1} />
        <Row label="Flete/logística"     value={sumCat('flete_logistica')}    indent={1} />
        <Row label="COSTO PRODUCTO" value={costosProducto} bold borderTop />
      </Section>

      <div style={{ padding:'10px 14px', background:'#F1F8F1', borderRadius:8, marginBottom:20, display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontWeight:700, color:T.dark }}>UTILIDAD BRUTA</span>
        <span style={{ fontWeight:800, fontSize:'1.05rem', color: utilidadBruta>=0?'#15803d':T.danger, fontFamily:'monospace' }}>
          {utilidadBruta<0?'-':''}{fmtQ(Math.abs(utilidadBruta))} <span style={{ fontSize:'.8rem', fontWeight:600 }}>({fmtP(margenBruto)})</span>
        </span>
      </div>

      <Section title="Gastos fijos">
        <Row label="Renta bodega"     value={sumCat('renta_bodega')}    indent={1} />
        <Row label="Transporte fijo"  value={sumCat('transporte_fijo')} indent={1} />
        <Row label="Luz/servicios"    value={sumCat('luz_servicios')}   indent={1} />
        <Row label="Empleados fijos"  value={sumCat('empleado_fijo')}   indent={1} />
        <Row label="TOTAL FIJOS" value={gastosFijos} bold borderTop />
      </Section>

      <Section title="Gastos variables">
        <Row label="Personal día"     value={sumCat('personal_dia')}    indent={1} />
        <Row label="Combustible"      value={sumCat('combustible')}     indent={1} />
        <Row label="Maquila/equipo"   value={sumCat('maquila_equipo')}  indent={1} />
        <Row label="Material empaque" value={sumCat('material_empaque')} indent={1} />
        <Row label="Alimentos"        value={sumCat('alimentos')}       indent={1} />
        <Row label="Comisión venta"   value={sumCat('comision_venta')}  indent={1} />
        <Row label="Comisión compra"  value={sumCat('comision_compra')} indent={1} />
        <Row label="TOTAL VARIABLES" value={gastosVariables} bold borderTop />
      </Section>

      <div style={{ padding:'14px 16px', background: utilidadNeta>=0?'#E8F5E9':'#FFEBEE', borderRadius:10, marginBottom:24, border:`2px solid ${utilidadNeta>=0?'#A5D6A7':'#FFCDD2'}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontWeight:800, fontSize:'1rem', color:T.dark }}>UTILIDAD NETA</span>
          <span style={{ fontWeight:800, fontSize:'1.2rem', color: utilidadNeta>=0?'#15803d':T.danger, fontFamily:'monospace' }}>
            {utilidadNeta<0?'-':''}{fmtQ(Math.abs(utilidadNeta))}
          </span>
        </div>
        <div style={{ textAlign:'right', fontSize:'.8rem', color:T.mid, marginTop:2 }}>Margen neto {fmtP(margenNeto)}</div>
      </div>

      {/* Punto de equilibrio */}
      <Section title="Punto de equilibrio">
        <Row label="Gastos fijos del período" value={gastosFijos} indent={1} />
        <Row label="Margen bruto"            value={0} indent={1} />
        <div style={{ paddingLeft:16, fontSize:'.84rem', color:T.mid, marginTop:-6, marginBottom:4 }}>{fmtP(margenBruto)}</div>
        <Row label="Necesitas vender"        value={puntoEquilibrio} indent={1} bold />
        <Row label="Llevas vendido"          value={ingresoNeto}     indent={1} bold color="#15803d" />
        <div style={{ margin:'10px 0 4px', background:'#F0F0F0', borderRadius:100, height:18, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:100, width:`${Math.min(100,pctEq)}%`, background: pctEq>=100?'#16a34a':pctEq>=80?'#f59e0b':'#dc2626', transition:'width .4s' }} />
        </div>
        <div style={{ fontSize:'.82rem', fontWeight:600, color: pctEq>=100?'#15803d':pctEq>=80?T.warn:T.danger }}>
          {pctEq>=100 ? `✅ Punto de equilibrio superado (${fmtP(pctEq)})`
            : `Te faltan ${fmtQ(Math.max(0,puntoEquilibrio-ingresoNeto))} para cubrir costos fijos (${fmtP(pctEq)})`}
        </div>
      </Section>
    </div>
  );
}
