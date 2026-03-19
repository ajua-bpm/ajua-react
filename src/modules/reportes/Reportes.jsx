import { useState, useMemo } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import * as XLSX from 'xlsx';

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  primary:   '#1B5E20',
  secondary: '#2E7D32',
  white:     '#FFFFFF',
  border:    '#E0E0E0',
  textDark:  '#1A1A18',
  textMid:   '#6B6B60',
  danger:    '#C62828',
  warn:      '#E65100',
  rowAlt:    '#F9FBF9',
};
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const fmtQ = (n) => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Get ISO week label
const weekLabel = (fecha) => {
  const d = new Date(fecha + 'T00:00:00');
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `S${weekNo}`;
};

// Pie chart color palette (greens + complementary)
const PIE_COLORS = [
  '#1B5E20', '#2E7D32', '#388E3C', '#43A047', '#66BB6A',
  '#A5D6A7', '#E65100', '#F57C00', '#FFA726', '#78909C',
];

// BPM modules to check compliance
const BPM_MODS = [
  { id: 'tl',   label: 'TL — Camiones' },
  { id: 'dt',   label: 'DT — Despachos' },
  { id: 'al',   label: 'AL — Acceso' },
  { id: 'bas',  label: 'BAS — Básculas' },
  { id: 'rod',  label: 'ROD — Roedores' },
  { id: 'limp', label: 'LIMP — Limpieza' },
  { id: 'vyp',  label: 'VYP — Vidrio/Plástico' },
  { id: 'fum',  label: 'FUM — Fumigación' },
];

const CUMPLE_VALS = new Set(['cumple', 'ok', 'aprobado', 'Aprobado', 'cumple_total']);

// ─── Excel helper ─────────────────────────────────────────────────────────────
function makeSheet(headers, rows) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map(() => ({ wch: 18 }));
  return ws;
}

// ─── Summary stat card ────────────────────────────────────────────────────────
function StatCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: '16px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,.10)',
      borderTop: `3px solid ${color || T.primary}`,
    }}>
      <div style={{ fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMid, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: color || T.textDark, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: '.75rem', color: T.textMid, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── BPM compliance progress row ─────────────────────────────────────────────
function BpmRow({ label, total, cumple }) {
  const pct = total > 0 ? Math.round((cumple / total) * 100) : 0;
  const barColor = pct >= 80 ? T.secondary : pct >= 60 ? T.warn : T.danger;
  return (
    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
      <td style={{ padding: '10px 14px', fontSize: '.83rem', fontWeight: 600, color: T.textDark }}>{label}</td>
      <td style={{ padding: '10px 14px', fontSize: '.83rem', color: T.textMid, textAlign: 'center' }}>{total}</td>
      <td style={{ padding: '10px 14px', fontSize: '.83rem', color: T.textMid, textAlign: 'center' }}>{cumple}</td>
      <td style={{ padding: '10px 14px', minWidth: 150 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 8, background: '#E8F5E9', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 4, transition: 'width .4s ease' }} />
          </div>
          <span style={{ fontSize: '.78rem', fontWeight: 700, color: barColor, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
        </div>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Reportes() {
  const toast = useToast();
  const [desde, setDesde] = useState(monthStart());
  const [hasta, setHasta] = useState(today());
  const [exporting, setExporting] = useState(false);

  // Financial collections
  const { data: vgtVentas,    loading: l1 } = useCollection('vgtVentas',    { orderField: 'fecha', orderDir: 'asc', limit: 1000 });
  const { data: pedidosWM,    loading: l2 } = useCollection('pedidosWalmart', { orderField: 'fecha', orderDir: 'asc', limit: 500 });
  const { data: gastosDiarios, loading: l3 } = useCollection('gastosDiarios', { orderField: 'fecha', orderDir: 'asc', limit: 2000 });
  const { data: iAnticipo,    loading: l4 } = useCollection('iAnticipo',    { orderField: 'fecha', orderDir: 'asc', limit: 500 });

  // BPM collections
  const { data: tlData }   = useCollection('tl',   { orderField: 'fecha', orderDir: 'asc', limit: 500 });
  const { data: dtData }   = useCollection('dt',   { orderField: 'fecha', orderDir: 'asc', limit: 500 });
  const { data: alData }   = useCollection('al',   { orderField: 'fecha', orderDir: 'asc', limit: 500 });
  const { data: basData }  = useCollection('bas',  { orderField: 'fecha', orderDir: 'asc', limit: 500 });
  const { data: rodData }  = useCollection('rod',  { orderField: 'fecha', orderDir: 'asc', limit: 500 });
  const { data: limpData } = useCollection('limp', { orderField: 'fecha', orderDir: 'asc', limit: 500 });
  const { data: vypData }  = useCollection('vyp',  { orderField: 'fecha', orderDir: 'asc', limit: 500 });
  const { data: fumData }  = useCollection('fum',  { orderField: 'fecha', orderDir: 'asc', limit: 500 });

  const loading = l1 || l2 || l3 || l4;

  // Filter helper
  const inRange = (r) => r.fecha >= desde && r.fecha <= hasta;

  // ── Financial derived values ──────────────────────────────────────────────
  const financials = useMemo(() => {
    const vgtFilt  = vgtVentas.filter(r => inRange(r) && r.estado !== 'cancelado');
    const wmFilt   = pedidosWM.filter(r => inRange(r));
    const gastFilt = gastosDiarios.filter(r => inRange(r));
    const antFilt  = iAnticipo.filter(r => inRange(r) && r.estado === 'pendiente');

    const ingVgt  = vgtFilt.reduce((s, r) => s + Number(r.total || r.monto || 0), 0);
    const ingWm   = wmFilt.reduce((s, r)  => s + Number(r.total || r.monto || r.amount || 0), 0);
    const costos  = gastFilt.reduce((s, r) => s + Number(r.monto || 0), 0);
    const anticipos = antFilt.reduce((s, r) => s + Number(r.equivalenteQ || 0), 0);
    const utilidad = ingVgt + ingWm - costos;

    return { ingVgt, ingWm, costos, anticipos, utilidad, gastFilt, vgtFilt };
  }, [vgtVentas, pedidosWM, gastosDiarios, iAnticipo, desde, hasta]);

  // ── Gastos by category (pie) ──────────────────────────────────────────────
  const gastosPie = useMemo(() => {
    const map = {};
    financials.gastFilt.forEach(r => {
      const cat = r.cat || r.categoria || 'Sin categoría';
      map[cat] = (map[cat] || 0) + Number(r.monto || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [financials.gastFilt]);

  // ── Ventas timeline (bar) ─────────────────────────────────────────────────
  const ventasBar = useMemo(() => {
    const map = {};
    financials.vgtFilt.forEach(r => {
      const wk = weekLabel(r.fecha);
      map[wk] = (map[wk] || 0) + Number(r.total || r.monto || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [financials.vgtFilt]);

  // ── BPM compliance (current month) ───────────────────────────────────────
  const bpmCollections = useMemo(() => ({
    tl: tlData, dt: dtData, al: alData, bas: basData,
    rod: rodData, limp: limpData, vyp: vypData, fum: fumData,
  }), [tlData, dtData, alData, basData, rodData, limpData, vypData, fumData]);

  const curMonth = today().slice(0, 7); // YYYY-MM
  const bpmStats = useMemo(() => {
    return BPM_MODS.map(mod => {
      const arr = (bpmCollections[mod.id] || []).filter(r => (r.fecha || '').startsWith(curMonth));
      const cumple = arr.filter(r => CUMPLE_VALS.has(r.resultado)).length;
      return { ...mod, total: arr.length, cumple };
    });
  }, [bpmCollections, curMonth]);

  // ── Excel export ──────────────────────────────────────────────────────────
  const handleExcel = async () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Ventas GT
      const vgtRows = financials.vgtFilt.map(r => [
        r.fecha, r.cliente || '', r.producto || '', r.cantidad || '',
        r.total || r.monto || 0, r.estado || '', r.obs || '',
      ]);
      XLSX.utils.book_append_sheet(wb,
        makeSheet(['Fecha', 'Cliente', 'Producto', 'Cantidad', 'Total Q', 'Estado', 'Obs'], vgtRows),
        'Ventas GT');

      // Gastos
      const gastRows = financials.gastFilt.map(r => [
        r.fecha, r.desc || r.descripcion || '', r.cat || r.categoria || '',
        r.monto || 0, r.resp || '', r.factura || '', r.obs || '',
      ]);
      XLSX.utils.book_append_sheet(wb,
        makeSheet(['Fecha', 'Descripción', 'Categoría', 'Monto Q', 'Responsable', 'Factura', 'Obs'], gastRows),
        'Gastos');

      // BPM TL
      const tlRows = tlData.filter(inRange).map(r => [
        r.fecha, r.hora || '', r.placa || '', r.resp || '',
        r.ok || 0, r.total || 0, r.pct || 0, r.resultado || '', r.obs || '',
      ]);
      XLSX.utils.book_append_sheet(wb,
        makeSheet(['Fecha', 'Hora', 'Placa', 'Responsable', 'OK', 'Total', '%', 'Resultado', 'Obs'], tlRows),
        'BPM TL');

      // BPM DT
      const dtRows = dtData.filter(inRange).map(r => [
        r.fecha, r.hora || '', r.conductor || '', r.cliente || '',
        r.ok || 0, r.total || 0, r.pct || 0, r.resultado || '', r.obs || '',
      ]);
      XLSX.utils.book_append_sheet(wb,
        makeSheet(['Fecha', 'Hora', 'Conductor', 'Cliente', 'OK', 'Total', '%', 'Resultado', 'Obs'], dtRows),
        'BPM DT');

      const fname = `Reporte_AJUA_${desde}_${hasta}.xlsx`;
      XLSX.writeFile(wb, fname);
      toast(`Excel generado: ${fname}`);
    } catch (e) {
      toast('Error al generar Excel: ' + e.message, 'error');
    }
    setExporting(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: T.primary, margin: 0 }}>
          Reportes
        </h1>
        <p style={{ fontSize: '.82rem', color: T.textMid, margin: '4px 0 0' }}>
          Resumen financiero y cumplimiento BPM — Agroindustria Ajúa
        </p>
      </div>

      {/* ── 1. Period selector ── */}
      <div style={card}>
        <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
          Período de análisis
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {[['Desde', desde, setDesde], ['Hasta', hasta, setHasta]].map(([label, val, set]) => (
            <label key={label} style={LBL}>
              {label}
              <input type="date" value={val} onChange={e => set(e.target.value)} style={INP} />
            </label>
          ))}
          <button onClick={handleExcel} disabled={exporting} style={{
            padding: '10px 24px', background: exporting ? T.border : T.primary,
            color: exporting ? T.textMid : '#fff', border: 'none', borderRadius: 6,
            fontWeight: 700, fontSize: '.85rem', cursor: exporting ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', alignSelf: 'flex-end',
          }}>
            {exporting ? 'Generando...' : 'Descargar Excel'}
          </button>
        </div>
      </div>

      {/* ── 2. Financial summary cards ── */}
      {loading ? (
        <div style={card}><Skeleton rows={3} /></div>
      ) : (
        <>
          <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
            Resumen Financiero — {desde} al {hasta}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14, marginBottom: 20 }}>
            <StatCard label="Ingresos Ventas GT" value={fmtQ(financials.ingVgt)} color={T.secondary} />
            <StatCard label="Ingresos Walmart" value={fmtQ(financials.ingWm)} color={T.secondary} />
            <StatCard label="Costos (Gastos)" value={fmtQ(financials.costos)} color={T.warn} />
            <StatCard label="Anticipos MX" value={fmtQ(financials.anticipos)} color={T.textMid} sub="Pendientes" />
            <StatCard
              label="Utilidad Bruta"
              value={fmtQ(financials.utilidad)}
              color={financials.utilidad >= 0 ? T.secondary : T.danger}
              sub={financials.utilidad >= 0 ? 'Positiva' : 'Negativa'}
            />
          </div>
        </>
      )}

      {/* ── 3. BPM Compliance ── */}
      <div style={card}>
        <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
          Cumplimiento BPM — mes actual
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.primary }}>
                {['Módulo', 'Registros', 'Cumple', '% Cumplimiento'].map(h => (
                  <th key={h} style={{
                    padding: '9px 14px', textAlign: 'left', color: '#fff',
                    fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bpmStats.map(m => <BpmRow key={m.id} label={m.label} total={m.total} cumple={m.cumple} />)}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. Gastos by category (pie) ── */}
      {gastosPie.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
            Gastos por Categoría
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={gastosPie}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={true}
              >
                {gastosPie.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmtQ(v)} />
              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '.78rem', paddingTop: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── 5. Ventas timeline (bar) ── */}
      {ventasBar.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
            Ventas GT por Semana
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ventasBar}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'inherit' }} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'inherit' }} />
              <Tooltip formatter={(v) => fmtQ(v)} />
              <Bar dataKey="value" fill="#2E7D32" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── No data placeholder ── */}
      {!loading && ventasBar.length === 0 && gastosPie.length === 0 && (
        <div style={{
          ...card, textAlign: 'center', padding: '40px 20px',
          color: T.textMid, fontSize: '.88rem',
        }}>
          Sin datos en el período seleccionado. Ajusta el rango de fechas.
        </div>
      )}
    </div>
  );
}
