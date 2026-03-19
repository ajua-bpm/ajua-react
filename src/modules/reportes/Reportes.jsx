import { useState } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import * as XLSX from 'xlsx';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF' };
const today = () => new Date().toISOString().slice(0,10);
const monthStart = () => new Date().toISOString().slice(0,8)+'01';

function sheetFromData(title, headers, rows) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map(()=>({wch:18}));
  return ws;
}

export default function Reportes() {
  const toast = useToast();
  const [desde, setDesde] = useState(monthStart());
  const [hasta, setHasta] = useState(today());
  const [generando, setGenerando] = useState(false);

  const { data: tl } = useCollection('tl', { orderField:'fecha',orderDir:'asc',limit:500 });
  const { data: dt } = useCollection('dt', { orderField:'fecha',orderDir:'asc',limit:500 });
  const { data: al } = useCollection('al', { orderField:'fecha',orderDir:'asc',limit:500 });
  const { data: bas } = useCollection('bas', { orderField:'fecha',orderDir:'asc',limit:500 });
  const { data: rod } = useCollection('rod', { orderField:'fecha',orderDir:'asc',limit:500 });
  const { data: gastos } = useCollection('gastosDiarios', { orderField:'fecha',orderDir:'asc',limit:1000 });

  const filtrar = (arr) => arr.filter(r => r.fecha >= desde && r.fecha <= hasta);

  const handleExcel = async () => {
    setGenerando(true);
    try {
      const wb = XLSX.utils.book_new();

      // TL — Limpieza Camiones
      const tlRows = filtrar(tl).map(r => [
        r.fecha, r.hora||'', r.placa||'', r.resp||'', r.ok||0, r.fail||0,
        r.resultado==='cumple'?'Cumple':'No cumple', r.obs||''
      ]);
      XLSX.utils.book_append_sheet(wb, sheetFromData('TL',
        ['Fecha','Hora','Placa','Responsable','OK','Fallas','Resultado','Observaciones'],
        tlRows), 'TL - Limpieza Camiones');

      // DT — Despachos
      const dtRows = filtrar(dt).map(r => [
        r.fecha, r.hora||'', r.conductor||'', r.cliente||'', r.destino||'',
        r.ok||0, r.fail||0, r.resultado==='cumple'?'Cumple':'No cumple', r.obs||''
      ]);
      XLSX.utils.book_append_sheet(wb, sheetFromData('DT',
        ['Fecha','Hora','Conductor','Cliente','Destino','OK','Fallas','Resultado','Observaciones'],
        dtRows), 'DT - Despachos');

      // AL — Acceso/Lavado
      const alRows = filtrar(al).map(r => [
        r.fecha, r.empleado||'', r.horaEntrada||'', r.horaSalida||'',
        r.lavado1||'', r.lavado2||'', r.lavado3||'', r.lavado4||'', r.obs||''
      ]);
      XLSX.utils.book_append_sheet(wb, sheetFromData('AL',
        ['Fecha','Empleado','H. Entrada','H. Salida','Lavado 10:00','Lavado 12:00','Lavado 14:00','Lavado 16:00','Observaciones'],
        alRows), 'AL - Acceso y Lavado');

      // BAS — Básculas
      const basRows = filtrar(bas).map(r => [
        r.fecha, r.hora||'', r.resp||'', r.ok||0, r.fail||0,
        r.resultado==='cumple'?'Cumple':'No cumple', r.obs||''
      ]);
      XLSX.utils.book_append_sheet(wb, sheetFromData('BAS',
        ['Fecha','Hora','Responsable','OK','Fallas','Resultado','Observaciones'],
        basRows), 'BAS - Básculas');

      // ROD — Roedores
      const rodRows = filtrar(rod).map(r => [
        r.fecha, r.resp||'', r.ok||0, r.fail||0, r.pct||0,
        r.resultado==='cumple'?'Cumple':'No cumple', r.obs||''
      ]);
      XLSX.utils.book_append_sheet(wb, sheetFromData('ROD',
        ['Fecha','Responsable','OK','Fallas','% Cumplimiento','Resultado','Observaciones'],
        rodRows), 'ROD - Control Roedores');

      // Gastos
      const gastosRows = filtrar(gastos).map(r => [
        r.fecha, r.desc||'', r.cat||'', r.monto||0, r.resp||'', r.factura||'', r.obs||''
      ]);
      XLSX.utils.book_append_sheet(wb, sheetFromData('Gastos',
        ['Fecha','Descripción','Categoría','Monto Q','Responsable','Factura','Observaciones'],
        gastosRows), 'Gastos Diarios');

      const fname = `AJUA-BPM_${desde}_${hasta}.xlsx`;
      XLSX.writeFile(wb, fname);
      toast(`✓ Excel generado: ${fname}`);
    } catch(e) {
      toast('✗ Error al generar Excel: '+e.message, 'error');
    }
    setGenerando(false);
  };

  const modulos = [
    { id:'tl', label:'TL — Limpieza Camiones', data: filtrar(tl) },
    { id:'dt', label:'DT — Despachos', data: filtrar(dt) },
    { id:'al', label:'AL — Acceso y Lavado', data: filtrar(al) },
    { id:'bas', label:'BAS — Básculas', data: filtrar(bas) },
    { id:'rod', label:'ROD — Roedores', data: filtrar(rod) },
    { id:'gastos', label:'Gastos Diarios', data: filtrar(gastos) },
  ];

  const calcPct = (arr) => {
    const withResult = arr.filter(r=>r.resultado);
    if(!withResult.length) return null;
    const ok = withResult.filter(r=>r.resultado==='cumple').length;
    return Math.round(ok/withResult.length*100);
  };

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>📊 Reportes</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Descarga de datos y reportes de cumplimiento BPM</p>

      {/* Rango */}
      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:14}}>Rango de fechas</div>
        <div style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'flex-end'}}>
          {[['desde','Desde',desde,setDesde],['hasta','Hasta',hasta,setHasta]].map(([id,label,val,set])=>(
            <label key={id} style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
              {label}<input type="date" value={val} onChange={e=>set(e.target.value)}
                style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
            </label>
          ))}
          <button onClick={handleExcel} disabled={generando} style={{padding:'12px 28px',background:generando?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:generando?'not-allowed':'pointer'}}>
            {generando?'Generando...':'⬇ Descargar Excel'}
          </button>
        </div>
      </div>

      {/* Resumen módulos */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,marginBottom:20}}>
        {modulos.map(m=>{
          const pct = calcPct(m.data);
          return (
            <div key={m.id} style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:'14px 18px'}}>
              <div style={{fontSize:'.75rem',fontWeight:700,color:'#6B8070',marginBottom:6}}>{m.label}</div>
              <div style={{fontSize:'1.4rem',fontWeight:800,color:C.green}}>{m.data.length}</div>
              <div style={{fontSize:'.72rem',color:'#9aaa9e'}}>registros</div>
              {pct!==null&&(
                <div style={{marginTop:6,fontSize:'.8rem',fontWeight:700,color:pct>=80?C.acc:pct>=60?C.warn:C.danger}}>
                  {pct}% cumplimiento
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div style={{background:'rgba(74,158,106,.08)',border:`1px solid rgba(74,158,106,.2)`,borderRadius:8,padding:16,fontSize:'.82rem',color:'#2d6e47'}}>
        <strong>El Excel incluye:</strong> TL, DT, AL, BAS, ROD y Gastos Diarios — filtrados por el rango de fechas seleccionado.
        Cada módulo en una hoja separada.
      </div>
    </div>
  );
}
