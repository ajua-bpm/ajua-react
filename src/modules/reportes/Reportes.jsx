import { useState, useMemo } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import Skeleton from '../../components/Skeleton';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary:  '#1B5E20',
  secondary:'#2E7D32',
  danger:   '#C62828',
  warn:     '#E65100',
  info:     '#1565C0',
  textDark: '#1A1A18',
  textMid:  '#6B6B60',
  border:   '#E0E0E0',
  bgGreen:  '#E8F5E9',
};

// ─── Shared styles ────────────────────────────────────────────────────────────
const card = {
  background: '#fff', borderRadius: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 20, marginBottom: 20,
};
const LBL = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '.06em', color: T.textMid,
};
const INP = {
  padding: '9px 12px', border: `1px solid ${T.border}`, borderRadius: 6,
  fontSize: '.83rem', outline: 'none', fontFamily: 'inherit',
  marginTop: 2, background: '#fff', color: T.textDark,
};
const SECTION_HDR = {
  fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.08em', color: T.primary,
  marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.border}`,
};
const TAB_MODS = ['📊 Estado de Resultados', '✅ Cumplimiento BPM', '📥 Exportar Excel'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const fmtQ = (n) =>
  `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN = (n) =>
  Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PIE_COLORS = [
  '#1B5E20','#2E7D32','#388E3C','#43A047','#66BB6A',
  '#A5D6A7','#E65100','#F57C00','#FFA726','#78909C',
];

// BPM compliance helper
const bpmStats = (arr, desde, hasta) => {
  const filtered = (arr || []).filter(r => r.fecha >= desde && r.fecha <= hasta);
  const ok = filtered.filter(r =>
    ['cumple','aprobado','sin_novedades','ok','realizado','cumple_total'].includes((r.resultado || '').toLowerCase())
  ).length;
  return {
    ok,
    total: filtered.length,
    pct: filtered.length > 0 ? Math.round(ok / filtered.length * 100) : null,
  };
};

// Business days in a date range (Mon–Fri)
const businessDays = (desde, hasta) => {
  let count = 0;
  const d = new Date(desde + 'T00:00:00');
  const end = new Date(hasta + 'T00:00:00');
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
};

// Week label for timeline chart
const weekLabel = (fecha) => {
  const d = new Date(fecha + 'T00:00:00');
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const wk = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `S${wk}`;
};

// Excel sheet builder
function makeSheet(headers, rows, colWidths) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = (colWidths || headers.map(() => ({ wch: 18 })));
  return ws;
}

// ─── Semáforo ─────────────────────────────────────────────────────────────────
function Semaforo({ pct }) {
  if (pct === null) return <span style={{ color: T.textMid }}>—</span>;
  const color = pct >= 80 ? '#2E7D32' : pct >= 60 ? T.warn : T.danger;
  const icon = pct >= 80 ? '🟢' : pct >= 60 ? '🟡' : '🔴';
  return <span style={{ color, fontWeight: 700 }}>{icon} {pct}%</span>;
}

// ─── Progress bar row ─────────────────────────────────────────────────────────
function BpmProgressRow({ label, stats, diasHabiles }) {
  const { ok, total, pct } = stats;
  const barColor = pct === null ? T.border : pct >= 80 ? T.secondary : pct >= 60 ? T.warn : T.danger;
  return (
    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
      <td style={{ padding: '10px 14px', fontSize: '.84rem', fontWeight: 600, color: T.textDark, whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '.82rem', color: T.textMid }}>{total}</td>
      <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '.82rem', color: T.textMid }}>{ok}</td>
      <td style={{ padding: '10px 14px', minWidth: 160 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 8, background: '#E8F5E9', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct ?? 0}%`, background: barColor, borderRadius: 4, transition: 'width .4s ease' }} />
          </div>
          <Semaforo pct={pct} />
        </div>
      </td>
      <td style={{ padding: '10px 14px', fontSize: '.78rem', color: T.textMid }}>
        {total} reg. / {diasHabiles} días háb.
      </td>
    </tr>
  );
}

// ─── Ledger row helpers ───────────────────────────────────────────────────────
function LRow({ label, amount, indent, bold, separator, highlight, color }) {
  const bg = highlight ? (color === 'red' ? '#FFEBEE' : '#E8F5E9') : 'transparent';
  return (
    <>
      {separator && (
        <tr><td colSpan={2} style={{ borderTop: `1px solid ${T.border}`, padding: 0, lineHeight: 0 }} /></tr>
      )}
      <tr style={{ background: bg }}>
        <td style={{
          padding: indent ? '5px 14px 5px 30px' : '5px 14px',
          fontSize: bold ? '.88rem' : '.84rem',
          fontWeight: bold ? 700 : 400,
          color: highlight ? (color === 'red' ? T.danger : T.secondary) : T.textDark,
        }}>
          {label}
        </td>
        <td style={{
          padding: '5px 14px',
          textAlign: 'right',
          fontSize: bold ? '.9rem' : '.84rem',
          fontWeight: bold ? 700 : 400,
          color: highlight ? (color === 'red' ? T.danger : T.secondary) : T.textDark,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}>
          {amount !== null ? fmtQ(amount) : ''}
        </td>
      </tr>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Reportes() {
  const [desde, setDesde] = useState(monthStart());
  const [hasta, setHasta] = useState(today());
  const [tab, setTab] = useState(0);
  const [exporting, setExporting] = useState(false);

  // ── Collections ──────────────────────────────────────────────────────────
  const { data: wmData,    loading: lWm  } = useCollection('pedidosWalmart', { orderField: 'fechaEntrega', orderDir: 'desc', limit: 500 });
  const { data: vgtData,   loading: lVgt } = useCollection('vgtVentas',      { orderField: 'fecha', orderDir: 'desc', limit: 500 });
  const { data: gasData,   loading: lGas } = useCollection('gastosDiarios',  { orderField: 'fecha', orderDir: 'desc', limit: 500 });
  const { data: anticipos, loading: lAnt } = useCollection('iAnticipo',      { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { data: entradas,  loading: lEnt } = useCollection('ientradas',      { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { data: tlData  }  = useCollection('tl',   { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { data: dtData  }  = useCollection('dt',   { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { data: alData  }  = useCollection('al',   { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { data: basData }  = useCollection('bas',  { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { data: rodData }  = useCollection('rod',  { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { data: limpData } = useCollection('limp', { orderField: 'fecha', orderDir: 'desc', limit: 200 });
  const { data: fumData  } = useCollection('fum',  { orderField: 'fecha', orderDir: 'desc', limit: 200 });

  const loading = lWm || lVgt || lGas || lAnt || lEnt;

  // ── Filtered sets ────────────────────────────────────────────────────────
  const wmFilt  = useMemo(() => (wmData  || []).filter(r => {
    const f = r.fechaEntrega || r.fecha || '';
    return f >= desde && f <= hasta && r.estado === 'entregado' && Number(r.montoFactura || 0) > 0;
  }), [wmData, desde, hasta]);

  const vgtFilt = useMemo(() => (vgtData || []).filter(r =>
    r.fecha >= desde && r.fecha <= hasta && r.estado !== 'cancelado'
  ), [vgtData, desde, hasta]);

  const gasFilt = useMemo(() => (gasData || []).filter(r =>
    r.fecha >= desde && r.fecha <= hasta
  ), [gasData, desde, hasta]);

  const antFilt = useMemo(() => (anticipos || []).filter(r =>
    r.fecha >= desde && r.fecha <= hasta
  ), [anticipos, desde, hasta]);

  const entFilt = useMemo(() => (entradas || []).filter(r =>
    r.fecha >= desde && r.fecha <= hasta
  ), [entradas, desde, hasta]);

  // ── Financial calculations ───────────────────────────────────────────────
  const ingWalmart = useMemo(() =>
    wmFilt.reduce((s, r) => s + Number(r.montoFactura || 0), 0), [wmFilt]);

  const ingGT = useMemo(() =>
    vgtFilt.reduce((s, r) => s + Number(r.total || 0), 0), [vgtFilt]);

  const totalIngresos = ingWalmart + ingGT;

  const costImport = useMemo(() =>
    antFilt.reduce((s, r) => s + Number(r.monto || 0), 0), [antFilt]);

  const costProducto = useMemo(() =>
    entFilt.reduce((s, r) => s + Number(r.totalQ || 0), 0), [entFilt]);

  const totalCostos = costImport + costProducto;
  const utilBruta = totalIngresos - totalCostos;

  // ── Gastos by category ──────────────────────────────────────────────────
  const gastosMap = useMemo(() => {
    const map = {};
    gasFilt.forEach(r => {
      const cat = r.categoria || r.cat || 'Sin categoría';
      map[cat] = (map[cat] || 0) + Number(r.monto || 0);
    });
    return map;
  }, [gasFilt]);

  const gastosSorted = useMemo(() =>
    Object.entries(gastosMap).sort((a, b) => b[1] - a[1]), [gastosMap]);

  const top8 = gastosSorted.slice(0, 8);
  const otros = gastosSorted.slice(8).reduce((s, [, v]) => s + v, 0);
  const totalGastos = gasFilt.reduce((s, r) => s + Number(r.monto || 0), 0);
  const utilNeta = utilBruta - totalGastos;

  // ── Weekly revenue vs expenses chart ────────────────────────────────────
  const weeklyChart = useMemo(() => {
    const revMap = {};
    const expMap = {};
    vgtFilt.forEach(r => {
      const wk = weekLabel(r.fecha);
      revMap[wk] = (revMap[wk] || 0) + Number(r.total || 0);
    });
    gasFilt.forEach(r => {
      const wk = weekLabel(r.fecha);
      expMap[wk] = (expMap[wk] || 0) + Number(r.monto || 0);
    });
    const keys = [...new Set([...Object.keys(revMap), ...Object.keys(expMap)])].sort();
    return keys.map(k => ({ name: k, ingresos: revMap[k] || 0, gastos: expMap[k] || 0 }));
  }, [vgtFilt, gasFilt]);

  // ── BPM stats ────────────────────────────────────────────────────────────
  const diasHabiles = useMemo(() => businessDays(desde, hasta), [desde, hasta]);

  const BPM_MODULES = useMemo(() => [
    { label: '🚛 Limpieza Transporte', data: tlData },
    { label: '📋 Despacho',            data: dtData },
    { label: '🙌 Acceso y Lavado',     data: alData },
    { label: '⚖️ Básculas',            data: basData },
    { label: '🐀 Roedores',            data: rodData },
    { label: '🧹 Limpieza Bodega',     data: limpData },
    { label: '💧 Fumigación',          data: fumData },
  ], [tlData, dtData, alData, basData, rodData, limpData, fumData]);

  const bpmResults = useMemo(() =>
    BPM_MODULES.map(m => ({ label: m.label, stats: bpmStats(m.data, desde, hasta) })),
    [BPM_MODULES, desde, hasta]
  );

  const bpmChartData = useMemo(() =>
    bpmResults.map(m => ({
      name: m.label.replace(/^.{2}/, '').split(' ')[0],
      pct: m.stats.pct ?? 0,
    })),
    [bpmResults]
  );

  // ── Export Excel ─────────────────────────────────────────────────────────
  const exportExcel = () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1 — Resumen Ejecutivo
      const ws1Data = [
        ['AGROINDUSTRIA AJÚA — Reporte Ejecutivo'],
        [`Período: ${desde} al ${hasta}`],
        [],
        ['RESUMEN FINANCIERO'],
        ['Concepto', 'Monto Q'],
        ['Ventas Walmart', fmtN(ingWalmart)],
        ['Ventas GT', fmtN(ingGT)],
        ['TOTAL INGRESOS', fmtN(totalIngresos)],
        [],
        ['Costo Importación MX', fmtN(costImport)],
        ['Costo Producto (Entradas)', fmtN(costProducto)],
        ['TOTAL COSTOS DIRECTOS', fmtN(totalCostos)],
        [],
        ['UTILIDAD BRUTA', fmtN(utilBruta)],
        [],
        ['Total Gastos Operativos', fmtN(totalGastos)],
        [],
        ['UTILIDAD NETA', fmtN(utilNeta)],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
      ws1['!cols'] = [{ wch: 35 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Resumen Ejecutivo');

      // Sheet 2 — Estado de Resultados
      const ws2Rows = [
        ['INGRESOS', ''],
        ['  Ventas Walmart', fmtN(ingWalmart)],
        ['  Ventas GT', fmtN(ingGT)],
        ['  TOTAL INGRESOS', fmtN(totalIngresos)],
        ['', ''],
        ['COSTOS DIRECTOS', ''],
        ['  Importación MX', fmtN(costImport)],
        ['  Costo Producto', fmtN(costProducto)],
        ['  TOTAL COSTOS', fmtN(totalCostos)],
        ['', ''],
        ['UTILIDAD BRUTA', fmtN(utilBruta)],
        ['', ''],
        ['GASTOS OPERATIVOS', ''],
        ...top8.map(([cat, amt]) => [`  ${cat}`, fmtN(amt)]),
        ...(otros > 0 ? [['  Otros gastos', fmtN(otros)]] : []),
        ['  TOTAL GASTOS', fmtN(totalGastos)],
        ['', ''],
        ['UTILIDAD NETA', fmtN(utilNeta)],
      ];
      const ws2 = XLSX.utils.aoa_to_sheet([['CONCEPTO', 'MONTO Q'], ...ws2Rows]);
      ws2['!cols'] = [{ wch: 35 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Estado de Resultados');

      // Sheet 3 — Gastos por Categoría
      const ws3Rows = gastosSorted.map(([cat, amt]) => [
        cat,
        gastosSorted.filter(([c]) => c === cat).length || gasFilt.filter(r => (r.categoria || r.cat || 'Sin categoría') === cat).length,
        fmtN(amt),
        totalGastos > 0 ? `${Math.round(amt / totalGastos * 100)}%` : '0%',
      ]);
      XLSX.utils.book_append_sheet(wb,
        makeSheet(['Categoría', 'N° Registros', 'Total Q', '% del Total'], ws3Rows, [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]),
        'Gastos por Categoría');

      // Sheet 4 — BPM Cumplimiento
      const ws4Rows = bpmResults.map(m => [
        m.label,
        m.stats.total,
        m.stats.ok,
        m.stats.pct !== null ? `${m.stats.pct}%` : 'Sin datos',
        m.stats.pct === null ? 'Sin datos' : m.stats.pct >= 80 ? 'Cumple' : m.stats.pct >= 60 ? 'Alerta' : 'No cumple',
      ]);
      XLSX.utils.book_append_sheet(wb,
        makeSheet(['Módulo', 'Registros', 'Cumplen', '%', 'Estado'], ws4Rows, [{ wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 14 }]),
        'BPM Cumplimiento');

      // Sheet 5 — Pedidos Walmart
      const ws5Rows = wmFilt.map(r => [
        r.fechaEntrega || r.fecha || '',
        r.oc || r.numeroOC || '',
        r.atlas || r.sap || '',
        r.descripcion || r.desc || '',
        r.cajas || r.cantidad || '',
        fmtN(r.montoFactura || 0),
        r.estado || '',
      ]);
      XLSX.utils.book_append_sheet(wb,
        makeSheet(['Fecha', 'OC', 'Atlas/SAP', 'Descripción', 'Cajas', 'Total Q', 'Estado'], ws5Rows,
          [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 14 }]),
        'Pedidos Walmart');

      XLSX.writeFile(wb, `Reporte_AJUA_${desde}_${hasta}.xlsx`);
    } catch (e) {
      console.error('Error generando Excel:', e);
    }
    setExporting(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: T.primary, margin: 0 }}>
          Reportes
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, margin: '4px 0 0' }}>
          Estado de resultados, cumplimiento BPM y exportación — Agroindustria Ajúa
        </p>
      </div>

      {/* Period selector */}
      <div style={card}>
        <div style={SECTION_HDR}>Período de análisis</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={LBL}>
            Desde
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={INP} />
          </label>
          <label style={LBL}>
            Hasta
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={INP} />
          </label>
          <div style={{ fontSize: '.8rem', color: T.textMid, alignSelf: 'flex-end', paddingBottom: 10 }}>
            {diasHabiles} días hábiles
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: `2px solid ${T.border}` }}>
        {TAB_MODS.map((t, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === i ? `3px solid ${T.primary}` : '3px solid transparent',
              color: tab === i ? T.primary : T.textMid,
              fontWeight: tab === i ? 700 : 500,
              fontSize: '.84rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all .15s',
              marginBottom: -2,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ══════════════════ TAB 0 — Estado de Resultados ══════════════════ */}
      {tab === 0 && (
        <>
          {loading ? (
            <div style={card}><Skeleton rows={10} /></div>
          ) : (
            <div style={card}>
              <div style={SECTION_HDR}>Estado de Resultados — {desde} al {hasta}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.bgGreen }}>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: T.primary }}>CONCEPTO</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: T.primary }}>MONTO Q</th>
                  </tr>
                </thead>
                <tbody>
                  {/* INGRESOS */}
                  <LRow label="INGRESOS" amount={null} bold />
                  <LRow label="Ventas Walmart" amount={ingWalmart} indent />
                  <LRow label="Ventas GT" amount={ingGT} indent />
                  <LRow label="TOTAL INGRESOS" amount={totalIngresos} bold separator />

                  {/* COSTOS */}
                  <LRow label="COSTOS DIRECTOS" amount={null} bold separator />
                  <LRow label="Importación MX" amount={costImport} indent />
                  <LRow label="Costo Producto" amount={costProducto} indent />
                  <LRow label="TOTAL COSTOS DIRECTOS" amount={totalCostos} bold separator />

                  {/* UTILIDAD BRUTA */}
                  <LRow
                    label="UTILIDAD BRUTA"
                    amount={utilBruta}
                    bold separator highlight
                    color={utilBruta >= 0 ? 'green' : 'red'}
                  />

                  {/* GASTOS OPERATIVOS */}
                  <LRow label="GASTOS OPERATIVOS" amount={null} bold separator />
                  {top8.map(([cat, amt]) => (
                    <LRow key={cat} label={cat} amount={amt} indent />
                  ))}
                  {otros > 0 && <LRow label="Otros gastos" amount={otros} indent />}
                  <LRow label="TOTAL GASTOS OPERATIVOS" amount={totalGastos} bold separator />

                  {/* UTILIDAD NETA */}
                  <LRow
                    label="UTILIDAD NETA"
                    amount={utilNeta}
                    bold separator highlight
                    color={utilNeta >= 0 ? 'green' : 'red'}
                  />
                </tbody>
              </table>
            </div>
          )}

          {/* Weekly trend chart */}
          {weeklyChart.length > 0 && (
            <div style={card}>
              <div style={SECTION_HDR}>Tendencia Semanal — Ingresos vs Gastos</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={weeklyChart} barGap={4}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'inherit' }} />
                  <YAxis tick={{ fontSize: 11, fontFamily: 'inherit' }} />
                  <Tooltip formatter={(v) => fmtQ(v)} />
                  <Legend wrapperStyle={{ fontSize: '.78rem' }} />
                  <Bar dataKey="ingresos" name="Ingresos" fill={T.secondary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gastos"   name="Gastos"   fill={T.warn}      radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Gastos pie */}
          {gastosSorted.length > 0 && (
            <div style={card}>
              <div style={SECTION_HDR}>Distribución de Gastos por Categoría</div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={gastosSorted.map(([name, value]) => ({ name, value }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine
                  >
                    {gastosSorted.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtQ(v)} />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '.78rem', paddingTop: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {!loading && weeklyChart.length === 0 && gastosSorted.length === 0 && (
            <div style={{ ...card, textAlign: 'center', padding: '40px 20px', color: T.textMid, fontSize: '.88rem' }}>
              Sin datos en el período seleccionado. Ajusta el rango de fechas.
            </div>
          )}
        </>
      )}

      {/* ══════════════════ TAB 1 — Cumplimiento BPM ══════════════════════ */}
      {tab === 1 && (
        <>
          <div style={card}>
            <div style={SECTION_HDR}>Cumplimiento BPM — {desde} al {hasta}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.primary }}>
                    {['Módulo', 'Registros', 'Cumplen', '% Cumplimiento', 'Cobertura'].map(h => (
                      <th key={h} style={{
                        padding: '9px 14px', textAlign: 'left', color: '#fff',
                        fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bpmResults.map(m => (
                    <BpmProgressRow
                      key={m.label}
                      label={m.label}
                      stats={m.stats}
                      diasHabiles={diasHabiles}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* BPM bar chart */}
          {bpmChartData.some(d => d.pct > 0) && (
            <div style={card}>
              <div style={SECTION_HDR}>Cumplimiento por Módulo (%)</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={bpmChartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'inherit' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fontFamily: 'inherit' }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="pct" name="% Cumplimiento" radius={[4, 4, 0, 0]}>
                    {bpmChartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.pct >= 80 ? T.secondary : entry.pct >= 60 ? T.warn : T.danger}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* ══════════════════ TAB 2 — Exportar Excel ════════════════════════ */}
      {tab === 2 && (
        <div style={card}>
          <div style={SECTION_HDR}>Exportar Reporte Profesional</div>
          <p style={{ fontSize: '.84rem', color: T.textMid, marginBottom: 20 }}>
            Genera un archivo Excel con múltiples hojas para auditoría y análisis externo.
            Período: <strong>{desde}</strong> al <strong>{hasta}</strong>.
          </p>

          {/* Info cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
            <div style={{ background: T.bgGreen, borderRadius: 8, padding: '14px 18px', border: `1px solid #C8E6C9` }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: T.primary }}>5</div>
              <div style={{ fontSize: '.78rem', fontWeight: 600, color: T.secondary, marginTop: 2 }}>Hojas de trabajo</div>
              <div style={{ fontSize: '.72rem', color: T.textMid, marginTop: 4 }}>Resumen · Resultados · Gastos · BPM · Walmart</div>
            </div>
            <div style={{ background: '#E3F2FD', borderRadius: 8, padding: '14px 18px', border: `1px solid #BBDEFB` }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: T.info }}>{desde}</div>
              <div style={{ fontSize: '.72rem', color: T.textMid }}>al</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: T.info }}>{hasta}</div>
              <div style={{ fontSize: '.78rem', fontWeight: 600, color: T.info, marginTop: 4 }}>Período del reporte</div>
            </div>
            <div style={{ background: '#FFF3E0', borderRadius: 8, padding: '14px 18px', border: `1px solid #FFE0B2` }}>
              <div style={{ fontSize: '.8rem', color: T.textMid, marginBottom: 6 }}>Registros por hoja</div>
              {[
                ['Resumen Ejecutivo', '—'],
                ['Estado de Resultados', '—'],
                ['Gastos x Categoría', gastosSorted.length],
                ['BPM Cumplimiento', bpmResults.length],
                ['Pedidos Walmart', wmFilt.length],
              ].map(([sh, n]) => (
                <div key={sh} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: T.textDark, marginBottom: 2 }}>
                  <span>{sh}</span>
                  <strong>{n}</strong>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={exportExcel}
            disabled={exporting}
            style={{
              padding: '12px 32px',
              background: exporting ? T.border : T.primary,
              color: exporting ? T.textMid : '#fff',
              border: 'none', borderRadius: 7,
              fontWeight: 700, fontSize: '.9rem',
              cursor: exporting ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '.02em',
            }}
          >
            {exporting ? 'Generando...' : `Descargar Excel — Reporte_AJUA_${desde}_${hasta}.xlsx`}
          </button>

          <div style={{ marginTop: 16, fontSize: '.76rem', color: T.textMid }}>
            El archivo se descargará automáticamente en tu navegador.
          </div>
        </div>
      )}
    </div>
  );
}
