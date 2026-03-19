import { useState, useMemo } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ── Design tokens ─────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', danger: '#C62828',
  warn: '#E65100', textDark: '#1A1A18', textMid: '#6B6B60',
  border: '#E0E0E0', bgGreen: '#E8F5E9', white: '#FFFFFF',
};

const card = { background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.10)', padding: 20, marginBottom: 20 };
const LS   = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: T.textMid, letterSpacing: '.06em' };
const IS   = { padding: '8px 10px', border: `1.5px solid ${T.border}`, borderRadius: 5, fontSize: '.83rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', color: T.textDark, background: T.white };

// ── Plan de cuentas structure ─────────────────────────────────────
const PLAN = [
  {
    categoria: 'IMPORTACION',
    color: '#1565C0',
    bg: '#E3F2FD',
    items: [
      'Flete Internacional',
      'Agente Aduanero',
      'Aranceles / DAI',
      'Fumigacion Aduanera',
      'Documentacion (DUCA, etc.)',
    ],
  },
  {
    categoria: 'OPERACIONES',
    color: '#E65100',
    bg: '#FFF3E0',
    items: [
      'Flete Local Guatemala',
      'Empaque y Materiales',
      'Combustible',
      'Mantenimiento Vehiculos',
      'Servicios Publicos (agua/luz)',
      'Alquiler Bodega',
    ],
  },
  {
    categoria: 'PERSONAL',
    color: '#6A1B9A',
    bg: '#F3E5F5',
    items: [
      'Salarios Semanales',
      'Horas Extras',
      'Bonificaciones',
    ],
  },
  {
    categoria: 'VENTAS',
    color: '#2E7D32',
    bg: '#E8F5E9',
    items: [
      'Comisiones de Ventas',
      'Publicidad / Marketing',
      'Transporte Ventas Locales',
    ],
  },
  {
    categoria: 'ADMINISTRACION',
    color: '#37474F',
    bg: '#ECEFF1',
    items: [
      'Papeleria y Oficina',
      'Servicios Profesionales',
      'Impuestos y Tasas',
      'Otros Gastos',
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

/** Returns the Monday of the week containing the given date string */
function getMondayOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function weekLabel(mondayStr) {
  if (!mondayStr) return '—';
  const d = new Date(mondayStr + 'T12:00:00');
  const sat = new Date(d); sat.setDate(d.getDate() + 5);
  const fmt = (x) => x.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
  return `Semana ${fmt(d)} — ${fmt(sat)}`;
}

const fmtQ = (n) => 'Q ' + (parseFloat(n) || 0).toFixed(2);

/** Build a fresh items array for the given PLAN */
function buildItems() {
  return PLAN.flatMap(grp =>
    grp.items.map(sub => ({ categoria: grp.categoria, subcategoria: sub, presupuesto: 0, ejecutado: 0 }))
  );
}

// ── Main component ────────────────────────────────────────────────
export default function GastosSemanales() {
  const toast = useToast();
  const { data: semanas, loading } = useCollection('gastosSemanales', { orderField: 'semana', orderDir: 'desc', limit: 60 });
  const { add, update, saving } = useWrite('gastosSemanales');

  // Semana selector: pick any date, auto-convert to Monday
  const [fechaSel, setFechaSel]   = useState(today);
  const [items, setItems]         = useState(buildItems);
  const [editId, setEditId]       = useState(null);

  const semana = useMemo(() => getMondayOf(fechaSel), [fechaSel]);
  const label  = useMemo(() => weekLabel(semana), [semana]);

  // ── Totals ─────────────────────────────────────────────────────
  const { totalPres, totalEjec, totalDif } = useMemo(() => {
    let totalPres = 0, totalEjec = 0;
    items.forEach(it => {
      totalPres += parseFloat(it.presupuesto) || 0;
      totalEjec += parseFloat(it.ejecutado) || 0;
    });
    return { totalPres, totalEjec, totalDif: totalEjec - totalPres };
  }, [items]);

  // ── Item setters ───────────────────────────────────────────────
  const setItem = (cat, sub, field, val) => {
    setItems(prev => prev.map(it =>
      it.categoria === cat && it.subcategoria === sub ? { ...it, [field]: val } : it
    ));
  };

  // ── Load week ──────────────────────────────────────────────────
  const loadWeek = (rec) => {
    if (!rec) {
      setItems(buildItems());
      setEditId(null);
      return;
    }
    const base = buildItems();
    const merged = base.map(it => {
      const found = (rec.items || []).find(x => x.categoria === it.categoria && x.subcategoria === it.subcategoria);
      return found ? { ...it, presupuesto: found.presupuesto || 0, ejecutado: found.ejecutado || 0 } : it;
    });
    setItems(merged);
    setEditId(rec.id);
  };

  // When week changes: check if saved
  const handleDateChange = (val) => {
    setFechaSel(val);
    const mon = getMondayOf(val);
    const existing = semanas.find(s => s.semana === mon);
    loadWeek(existing || null);
  };

  // ── Save ───────────────────────────────────────────────────────
  const handleSave = async () => {
    const itsParsed = items.map(it => ({
      categoria: it.categoria,
      subcategoria: it.subcategoria,
      presupuesto: parseFloat(it.presupuesto) || 0,
      ejecutado: parseFloat(it.ejecutado) || 0,
    }));
    const payload = {
      semana,
      semanaLabel: label,
      items: itsParsed,
      totalPresupuesto: totalPres,
      totalEjecutado: totalEjec,
      diferencia: totalDif,
      creadoEn: editId ? undefined : new Date().toISOString(),
    };

    if (editId) {
      await update(editId, payload);
      toast('Semana actualizada');
    } else {
      await add({ ...payload, creadoEn: new Date().toISOString() });
      toast('Semana guardada');
    }
    // Refresh editId
    setTimeout(() => {
      const rec = semanas.find(s => s.semana === semana);
      if (rec) setEditId(rec.id);
    }, 600);
  };

  const resetNew = () => {
    setFechaSel(today());
    setItems(buildItems());
    setEditId(null);
  };

  // ── Group items by category for rendering ─────────────────────
  const grouped = useMemo(() => {
    return PLAN.map(grp => ({
      ...grp,
      rows: items.filter(it => it.categoria === grp.categoria),
    }));
  }, [items]);

  // Category subtotals
  const catTotals = useMemo(() => {
    const t = {};
    PLAN.forEach(grp => {
      const rows = items.filter(it => it.categoria === grp.categoria);
      t[grp.categoria] = {
        pres: rows.reduce((s, r) => s + (parseFloat(r.presupuesto) || 0), 0),
        ejec: rows.reduce((s, r) => s + (parseFloat(r.ejecutado) || 0), 0),
      };
    });
    return t;
  }, [items]);

  const difColor = (dif) => {
    if (dif > 0) return T.danger;
    if (dif < 0) return T.secondary;
    return T.textMid;
  };

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: T.primary, margin: 0 }}>
          Gastos Semanales
        </h1>
        <p style={{ fontSize: '.83rem', color: T.textMid, marginTop: 4 }}>
          Control semanal de gastos — presupuesto vs ejecutado. Los reportes mensuales suman semanas.
        </p>
      </div>

      {/* Week selector */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary, marginBottom: 14 }}>
          Semana de gastos
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
          <label style={LS}>
            Seleccionar fecha (se ajusta al lunes)
            <input type="date" value={fechaSel} onChange={e => handleDateChange(e.target.value)} style={{ ...IS, width: 180 }} />
          </label>
          <div style={{ background: T.bgGreen, border: `1.5px solid ${T.secondary}`, borderRadius: 6, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '.62rem', color: T.textMid, textTransform: 'uppercase', letterSpacing: '.07em' }}>Semana</span>
            <span style={{ fontFamily: 'inherit', fontSize: '.88rem', fontWeight: 800, color: T.primary }}>{label}</span>
            {editId && <span style={{ fontSize: '.65rem', background: T.secondary, color: T.white, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>GUARDADA</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={resetNew} style={{ padding: '9px 18px', background: '#F5F5F5', border: `1px solid ${T.border}`, borderRadius: 6, cursor: 'pointer', fontSize: '.82rem', fontWeight: 600, color: T.textMid }}>
            + Nueva semana en blanco
          </button>
        </div>
      </div>

      {/* Plan de cuentas */}
      {grouped.map(grp => {
        const ct = catTotals[grp.categoria] || { pres: 0, ejec: 0 };
        const dif = ct.ejec - ct.pres;
        return (
          <div key={grp.categoria} style={{ ...card, borderTop: `3px solid ${grp.color}` }}>
            {/* Category header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: '.88rem', color: grp.color, letterSpacing: '.04em' }}>{grp.categoria}</span>
              <div style={{ display: 'flex', gap: 16, fontSize: '.78rem', fontWeight: 700 }}>
                <span style={{ color: T.textMid }}>Pres: <span style={{ color: T.textDark }}>{fmtQ(ct.pres)}</span></span>
                <span style={{ color: T.textMid }}>Ejec: <span style={{ color: T.textDark }}>{fmtQ(ct.ejec)}</span></span>
                <span style={{ color: difColor(dif) }}>Dif: {fmtQ(dif)}</span>
              </div>
            </div>

            {/* Rows */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, auto)', gap: '6px 12px', alignItems: 'center' }}>
              {/* Header row */}
              <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textMid }}>Concepto</div>
              <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textMid, textAlign: 'right', minWidth: 100 }}>Presupuesto Q</div>
              <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textMid, textAlign: 'right', minWidth: 100 }}>Ejecutado Q</div>
              <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textMid, textAlign: 'right', minWidth: 90 }}>Diferencia Q</div>

              {grp.rows.map(it => {
                const dif = (parseFloat(it.ejecutado) || 0) - (parseFloat(it.presupuesto) || 0);
                return [
                  <div key={`${it.subcategoria}-lbl`} style={{ fontSize: '.83rem', color: T.textDark, padding: '4px 0' }}>
                    {it.subcategoria}
                  </div>,
                  <input key={`${it.subcategoria}-pres`} type="number" min="0" step="0.01"
                    value={it.presupuesto}
                    onChange={e => setItem(it.categoria, it.subcategoria, 'presupuesto', e.target.value)}
                    style={{ ...IS, textAlign: 'right', width: 100 }}
                  />,
                  <input key={`${it.subcategoria}-ejec`} type="number" min="0" step="0.01"
                    value={it.ejecutado}
                    onChange={e => setItem(it.categoria, it.subcategoria, 'ejecutado', e.target.value)}
                    style={{ ...IS, textAlign: 'right', width: 100 }}
                  />,
                  <div key={`${it.subcategoria}-dif`} style={{ textAlign: 'right', fontSize: '.82rem', fontWeight: 600, color: difColor(dif), padding: '4px 0' }}>
                    {fmtQ(dif)}
                  </div>,
                ];
              })}
            </div>
          </div>
        );
      })}

      {/* Summary totals */}
      <div style={{ ...card, background: T.bgGreen, border: `2px solid ${T.primary}` }}>
        <div style={{ fontWeight: 700, fontSize: '.88rem', color: T.primary, marginBottom: 14 }}>Resumen de la semana</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textMid, marginBottom: 4 }}>Total Presupuesto</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: T.textDark }}>{fmtQ(totalPres)}</div>
          </div>
          <div>
            <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textMid, marginBottom: 4 }}>Total Ejecutado</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: T.textDark }}>{fmtQ(totalEjec)}</div>
          </div>
          <div style={{ borderLeft: `2px solid ${totalDif > 0 ? T.danger : T.secondary}`, paddingLeft: 16 }}>
            <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textMid, marginBottom: 4 }}>
              Diferencia {totalDif > 0 ? '(EXCEDIDO)' : totalDif < 0 ? '(EN LINEA)' : ''}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: difColor(totalDif) }}>{fmtQ(totalDif)}</div>
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '11px 28px', background: saving ? T.textMid : T.primary,
            color: T.white, border: 'none', borderRadius: 6,
            fontWeight: 700, fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Guardando...' : editId ? 'Actualizar semana' : 'Guardar semana'}
          </button>
        </div>
      </div>

      {/* Historial */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.primary, marginBottom: 16 }}>
          Ultimas semanas guardadas
        </div>
        {loading ? <Skeleton rows={5} /> : semanas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: T.textMid, fontSize: '.88rem' }}>
            Sin semanas guardadas
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {semanas.slice(0, 8).map(s => {
              const dif = (s.diferencia != null ? s.diferencia : (s.totalEjecutado || 0) - (s.totalPresupuesto || 0));
              const isActive = editId === s.id;
              return (
                <div key={s.id} onClick={() => { setFechaSel(s.semana); loadWeek(s); }}
                  style={{
                    padding: '14px 16px', borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${isActive ? T.primary : T.border}`,
                    background: isActive ? T.bgGreen : '#FAFAFA',
                    transition: 'all .15s',
                  }}>
                  <div style={{ fontWeight: 700, fontSize: '.82rem', color: T.primary, marginBottom: 8 }}>
                    {s.semanaLabel || weekLabel(s.semana)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: T.textMid }}>
                    <span>Pres: <strong style={{ color: T.textDark }}>{fmtQ(s.totalPresupuesto)}</strong></span>
                    <span>Ejec: <strong style={{ color: T.textDark }}>{fmtQ(s.totalEjecutado)}</strong></span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: '.75rem', fontWeight: 700, color: difColor(dif) }}>
                    Dif: {fmtQ(dif)} {dif > 0 ? '(excedido)' : dif < 0 ? '(ahorro)' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
