import * as XLSX from 'xlsx';
import { calcRow } from './useProyeccion';

// Safari/iOS no soporta a.click() en blobs — usa window.open como fallback
function downloadXLSX(wb, filename) {
  const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    || /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isSafari) {
    // En Safari: abrir en nueva pestaña — el usuario toca "Compartir → Guardar en Archivos"
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  } else {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

const Q  = n => Number(n || 0).toFixed(2);
const P  = n => Number(n || 0).toFixed(1) + '%';
const N  = n => Number(n || 0).toFixed(0);

function mergeProducto(p, productosMap) {
  const base = productosMap[p.productoId] || {};
  return {
    nombre:      p.nombre || base.nombre || '—',
    precioVenta: p.precioVenta ?? base.precioVenta ?? 0,
    costo:       p.costo       ?? base.costo       ?? 0,
    descuentoPct:p.descuentoPct ?? base.descuentoPct ?? 0,
    ivaRetPct:   p.ivaRetPct   ?? base.ivaRetPct   ?? 85.71,
    cajasProyectadas: p.cajasProyectadas || 0,
    lbsPorCaja:  p.lbsPorCaja  || 0,
    frecuencia:  p.frecuencia  || 1,
    cajasReales: p.cajasReales ?? null,
  };
}

export function exportarProyeccion({ proyeccion, productosMap, fijosSemanal, historial, allHistorialProductosMap }) {
  const wb  = XLSX.utils.book_new();
  const sem = proyeccion?.semana || 'semana';
  const prods = (proyeccion?.productos || []).map(p => {
    const m = mergeProducto(p, productosMap);
    return { ...m, ...calcRow(m) };
  });

  const totalProy   = prods.reduce((s, p) => s + p.totalSemana, 0);
  const totalReal   = prods.reduce((s, p) => s + p.totalSemanaReal, 0);
  const variacion   = totalReal - totalProy;
  const variPct     = totalProy > 0 ? (variacion / totalProy) * 100 : 0;
  const cobertura   = fijosSemanal > 0 ? (totalProy / fijosSemanal) * 100 : 0;
  const lbsTotales  = prods.reduce((s, p) => s + p.totalLbs, 0);
  const margenProm  = prods.length ? prods.reduce((s, p) => s + p.margenPct, 0) / prods.length : 0;

  // ── Hoja 1: RESUMEN KPIs ────────────────────────────────────────
  const resumen = [
    ['AJÚA AGROINDUSTRIA — PROYECCIÓN SEMANAL WALMART'],
    [`Semana: ${sem}  |  Período: ${proyeccion?.lunes || ''} – ${proyeccion?.domingo || ''}  |  Estado: ${(proyeccion?.estado || '').toUpperCase()}`],
    [],
    ['KPI', 'VALOR', 'NOTA'],
    ['Total Proyectado Contribución', `Q ${Q(totalProy)}`, ''],
    ['Total Real Contribución',       `Q ${Q(totalReal)}`, proyeccion?.estado === 'cerrada' ? '' : 'Semana no cerrada'],
    ['Variación (Real − Proyectado)', `Q ${Q(variacion)}`,  variacion >= 0 ? '▲ Positivo' : '▼ Negativo'],
    ['Variación %',                   P(variPct),           ''],
    ['Gastos Fijos Semana',           `Q ${Q(fijosSemanal)}`, 'gastosFijosConfig / 4.33'],
    ['Cobertura de Fijos',            P(cobertura),         cobertura >= 100 ? '✅ Cubre' : '⚠️ Déficit'],
    ['Superávit / Déficit',          `Q ${Q(totalProy - fijosSemanal)}`, ''],
    [],
    ['VOLUMEN'],
    ['Productos activos',             prods.length,         ''],
    ['Total Lbs Proyectadas',         N(lbsTotales),        'lbs'],
    ['Margen libre promedio',         P(margenProm),        '% sobre precio venta'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(resumen);
  ws1['!cols'] = [{ wch: 35 }, { wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws1, '📊 Resumen KPIs');

  // ── Hoja 2: DETALLE PROYECCIÓN ──────────────────────────────────
  const dHead = ['Producto','Cajas Proy.','Lb/Caja','Frec.','Total Lbs',
    'P.V./lb','Costo/lb','IVA Ret./lb','Desc./lb','Neto Recibido/lb','Libre/lb','Margen%',
    'Q Sem. Proy.','Cajas Real','Lbs Reales','Q Sem. Real','Variación Q','Var%'];
  const dRows = prods.map(p => [
    p.nombre, p.cajasProyectadas, p.lbsPorCaja, p.frecuencia, N(p.totalLbs),
    Q(p.precioVenta), Q(p.costo), Q(p.ivaRet), Q(p.descuento), Q(p.neto), Q(p.libre), P(p.margenPct),
    Q(p.totalSemana),
    p.cajasReales ?? '',
    p.cajasReales != null ? N(p.totalLbsReales) : '',
    p.cajasReales != null ? Q(p.totalSemanaReal) : '',
    p.cajasReales != null ? Q(p.totalSemanaReal - p.totalSemana) : '',
    p.cajasReales != null ? P(((p.totalSemanaReal - p.totalSemana) / (p.totalSemana || 1)) * 100) : '',
  ]);
  dRows.push(['TOTAL', '', '', '', N(lbsTotales),
    '','','','','','','', Q(totalProy), '', '', Q(totalReal), Q(variacion), P(variPct)]);
  const ws2 = XLSX.utils.aoa_to_sheet([dHead, ...dRows]);
  ws2['!cols'] = [{ wch: 22 }, ...dHead.slice(1).map(() => ({ wch: 13 }))];
  XLSX.utils.book_append_sheet(wb, ws2, '📋 Detalle Proyección');

  // ── Hoja 3: ANÁLISIS DE MÁRGENES ────────────────────────────────
  const mHead = ['Producto','P.V./lb','÷1.12 (sin IVA)','IVA Total','IVA Retenido 80%',
    'Descuento Comercial','Neto Recibido/lb','Costo/lb','Libre/lb','Margen%','Semáforo'];
  const mRows = prods.map(p => {
    const ivaBruto = (p.precioVenta / 1.12) * 0.12;
    const sem = p.margenPct >= 15 ? '🟢 Bueno (≥15%)' : p.margenPct >= 8 ? '🟡 Justo (8-15%)' : '🔴 Bajo (<8%)';
    return [p.nombre, Q(p.precioVenta), Q(p.precioVenta / 1.12), Q(ivaBruto),
      Q(p.ivaRet), Q(p.descuento), Q(p.neto), Q(p.costo), Q(p.libre), P(p.margenPct), sem];
  });
  const ws3 = XLSX.utils.aoa_to_sheet([mHead, ...mRows]);
  ws3['!cols'] = [{ wch: 22 }, ...mHead.slice(1).map(() => ({ wch: 16 }))];
  XLSX.utils.book_append_sheet(wb, ws3, '📈 Márgenes');

  // ── Hoja 4: HISTORIAL ───────────────────────────────────────────
  if (historial && historial.length > 0) {
    const hHead = ['Semana','Período','Proyectado Q','Real Q','Variación Q','Var%','Cobertura Fijos%','Estado'];
    const hRows = historial.map(h => {
      const map = allHistorialProductosMap || productosMap;
      const hp = (h.productos || []).reduce((s, p) => {
        const m = mergeProducto(p, map);
        return s + calcRow(m).totalSemana;
      }, 0);
      const hr = (h.productos || []).reduce((s, p) => {
        const m = mergeProducto(p, map);
        return s + calcRow(m).totalSemanaReal;
      }, 0);
      const hv  = hr - hp;
      const hvp = hp > 0 ? (hv / hp) * 100 : 0;
      return [h.semana, `${h.lunes || ''} – ${h.domingo || ''}`,
        Q(hp), h.estado === 'cerrada' ? Q(hr) : '—',
        h.estado === 'cerrada' ? Q(hv) : '—',
        h.estado === 'cerrada' ? P(hvp) : '—',
        P(fijosSemanal > 0 ? (hp / fijosSemanal) * 100 : 0),
        h.estado || ''];
    });
    const ws4 = XLSX.utils.aoa_to_sheet([hHead, ...hRows]);
    ws4['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws4, '📅 Historial');
  }

  downloadXLSX(wb, `ajua_proyeccion_${sem}.xlsx`);
}
