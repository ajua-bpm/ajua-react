import { useMemo, useRef, useState } from 'react';
import { db, collection, addDoc, doc, setDoc } from '../../firebase';
import { useCollection } from '../../hooks/useFirestore';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { parseFEL, nitDigits } from './felParser';

// Ventas por XML/FEL. Sube facturas emitidas → auto-matchea (o crea) el cliente
// por NIT (o nombre) → las guarda como despacho en cuentasClientes (CxC).
// Idempotente: el id del despacho es fel_<uuid>, así re-subir el mismo XML no duplica.
const T = {
  bg: '#F8F3E9', paper: '#FFFFFF', ink: '#1A1A18', forest: '#1F3A2C',
  canopy: '#2D6645', ochre: '#A8835A', muted: '#6B6B60', rule: 'rgba(26,26,24,.10)',
  ok: '#2E7D32', warn: '#B26A00', err: '#B00020', sand: '#E7DDC9', blue: '#1565C0',
};
const fmt = (n) => Number.isFinite(n) ? n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
const LS_NIT = 'ajua_nit_empresa';
const normName = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

export default function FinanzasVentas() {
  const { user } = useAuth();
  const toast = useToast();
  const fileRef = useRef();

  const { data: clientes, loading: lcli } = useCollection('clientes', { orderField: 'nombre', limit: 100000 });
  const { data: cxCli, loading: lcx } = useCollection('cuentasClientes', { limit: 100000 });

  const [nit, setNit] = useState(localStorage.getItem(LS_NIT) || '');
  const [parsed, setParsed] = useState([]);
  const [errores, setErrores] = useState([]);
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Índices de cliente: por NIT/RTU y por nombre (fallback para clientes sin RTU)
  const { clienteByNit, clienteByName } = useMemo(() => {
    const byNit = {}, byName = {};
    for (const c of (clientes || [])) {
      const k = nitDigits(c.nit || c.rtu);
      if (k) byNit[k] = c;
      const n = normName(c.nombre);
      if (n && !byName[n]) byName[n] = c;
    }
    return { clienteByNit: byNit, clienteByName: byName };
  }, [clientes]);

  const uuidsCargados = useMemo(() => {
    const s = new Set();
    for (const m of (cxCli || [])) if (m.felUuid) s.add(m.felUuid);
    return s;
  }, [cxCli]);

  const handleNit = (v) => { setNit(v); localStorage.setItem(LS_NIT, v); };

  const dedupe = (list) => {
    const seen = new Set(); const out = [];
    for (const f of list) { if (seen.has(f.uuid)) continue; seen.add(f.uuid); out.push(f); }
    return out;
  };

  const handleFiles = (files) => {
    setResultado(null);
    if (!nit.trim()) { toast('Primero poné el NIT de tu empresa', 'error'); return; }
    const arr = Array.from(files);
    const nuevas = []; const errs = [];
    let done = 0;
    arr.forEach(f => {
      const reader = new FileReader();
      reader.onload = e => {
        const fel = parseFEL(e.target.result, nit);
        if (fel && fel.tipoFEL === 'emitida') nuevas.push(fel);
        else if (!fel) errs.push(f.name);
        done++;
        if (done === arr.length) {
          setParsed(prev => dedupe([...prev, ...nuevas]));
          setErrores(errs);
        }
      };
      reader.readAsText(f, 'utf-8');
    });
  };

  // Resolver cliente de una factura (solo lectura, para preview)
  const resolverCli = (f) => {
    const k = nitDigits(f.receptorNIT);
    if (k && clienteByNit[k]) return clienteByNit[k];
    const n = normName(f.receptorNombre);
    if (n && clienteByName[n]) return clienteByName[n];
    return null;
  };

  const filas = useMemo(() => parsed.map(f => {
    const cli = resolverCli(f);
    return { ...f, _cli: cli, _nuevo: !cli, _dup: uuidsCargados.has(f.uuid) };
  }), [parsed, clienteByNit, clienteByName, uuidsCargados]);

  const cargables = filas.filter(f => !f._dup);

  const cargar = async () => {
    if (lcli || lcx) { toast('Esperá a que terminen de cargar los datos…', 'error'); return; }
    if (saving) return;
    if (cargables.length === 0) { toast('No hay ventas nuevas para cargar', 'error'); return; }
    setSaving(true);
    const stamp = { creadoEn: new Date().toISOString(), creadoPor: user?.usuario || 'unknown', origen: 'fel' };
    let cargadas = 0, creados = 0;
    const nuevoCliCache = {}; // cacheKey → clienteId (clientes creados en este lote)
    try {
      for (const f of cargables) {
        const nitKey = nitDigits(f.receptorNIT);
        const nameKey = normName(f.receptorNombre);
        // 1) match existente por NIT, luego por nombre
        let cli = (nitKey && clienteByNit[nitKey]) || (nameKey && clienteByName[nameKey]) || null;
        let clienteId = cli?.id;
        // 2) cache de creados en este lote (agrupa CF y repetidos)
        const cacheKey = nitKey || (nameKey ? 'n:' + nameKey : 'CF');
        if (!clienteId) clienteId = nuevoCliCache[cacheKey];
        // 3) crear si no existe (solo rtu, sin campo nit fantasma)
        if (!clienteId) {
          const ref = await addDoc(collection(db, 'clientes'), {
            nombre: f.receptorNombre || 'Consumidor Final',
            rtu: f.receptorNIT || '',
            ...stamp,
          });
          clienteId = ref.id;
          nuevoCliCache[cacheKey] = clienteId;
          creados++;
        }
        // 4) guardar venta con id determinístico → idempotente (no duplica al re-subir)
        await setDoc(doc(db, 'cuentasClientes', 'fel_' + f.uuid), {
          tipo: 'despacho', clienteId,
          totalVenta: f.montoTotal, fecha: f.fecha,
          descripcion: 'Factura FEL ' + (f.uuid || '').slice(0, 8),
          felUuid: f.uuid, felNeto: f.montoNeto, felIva: f.iva, felIvaRetenido: f.ivaRetenido,
          receptorNombre: f.receptorNombre || '', receptorNIT: f.receptorNIT || '',
          ...stamp,
        });
        cargadas++;
      }
      setResultado({ cargadas, creados });
      setParsed([]);
      toast(`✓ ${cargadas} ventas cargadas${creados ? ` · ${creados} clientes nuevos` : ''}`);
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    setSaving(false);
  };

  const totalCargable = cargables.reduce((s, f) => s + f.montoTotal, 0);
  const cargandoDatos = lcli || lcx;

  return (
    <div>
      <div style={{ fontSize: '.82rem', color: T.muted, marginBottom: 4 }}>Finanzas · Ventas</div>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.55rem', fontWeight: 600, color: T.forest }}>Ventas — subir facturas (FEL)</h1>
      <div style={{ fontSize: '.85rem', color: T.muted, marginBottom: 18 }}>
        Subí los XML de tus facturas emitidas. Cada una se conecta al cliente (por NIT o nombre; lo crea si no existe) y suma a Cuentas por Cobrar.
        Para una venta suelta usá <b>Movimientos → Registrar → Venta</b>.
      </div>

      <div style={{ background: T.paper, border: `1px solid ${T.rule}`, padding: 18, marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.muted, marginBottom: 4 }}>
          NIT de tu empresa (para detectar las emitidas)
        </label>
        <input value={nit} onChange={e => handleNit(e.target.value)} placeholder="Ej: 12345678-9"
          style={{ padding: '8px 11px', border: `1.5px solid ${T.rule}`, borderRadius: 4, fontSize: '.9rem', width: '100%', maxWidth: 220, boxSizing: 'border-box', marginBottom: 12 }} />

        <div onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          style={{ border: `2px dashed ${T.rule}`, borderRadius: 8, padding: '26px 20px', textAlign: 'center', cursor: 'pointer', background: '#FAFAF7' }}>
          <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>📑</div>
          <div style={{ fontSize: '.86rem', color: T.muted }}>Arrastrá uno o varios XML aquí o <b>hacé clic</b></div>
          <div style={{ fontSize: '.74rem', color: T.muted, marginTop: 4 }}>Solo se cargan las facturas EMITIDAS (ventas)</div>
          <input ref={fileRef} type="file" accept=".xml" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
        </div>

        {errores.length > 0 && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(178,106,0,.08)', border: `1px solid ${T.warn}`, borderRadius: 6, fontSize: '.82rem', color: T.warn }}>
            ⚠ No se pudo leer: {errores.join(', ')}
          </div>
        )}
        {resultado && (
          <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(46,125,50,.08)', border: `1px solid ${T.ok}`, borderRadius: 6, fontSize: '.86rem', color: T.ok, fontWeight: 600 }}>
            ✅ {resultado.cargadas} ventas cargadas{resultado.creados ? ` · ${resultado.creados} clientes creados` : ''}
          </div>
        )}
      </div>

      {filas.length > 0 && (
        <div style={{ background: T.paper, border: `1px solid ${T.rule}`, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 700, color: T.forest, fontSize: '.9rem' }}>
              {cargables.length} ventas nuevas · Q {fmt(totalCargable)}
              {filas.length - cargables.length > 0 && <span style={{ color: T.muted, fontWeight: 400 }}> · {filas.length - cargables.length} ya cargadas</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setParsed([]); setErrores([]); }} style={btnGhost}>Limpiar</button>
              <button onClick={cargar} disabled={saving || cargandoDatos || cargables.length === 0} style={{ ...btnPrimary, opacity: (saving || cargandoDatos || cargables.length === 0) ? 0.5 : 1 }}>
                {saving ? 'Cargando…' : cargandoDatos ? 'Cargando datos…' : `⬆ Cargar ${cargables.length} ventas`}
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem', minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={thL}>Fecha</th>
                  <th style={thL}>Cliente (receptor)</th>
                  <th style={thL}>NIT</th>
                  <th style={{ ...thL, textAlign: 'right' }}>Total</th>
                  <th style={thL}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={f.uuid} style={{ background: f._dup ? 'rgba(107,107,96,.06)' : (i % 2 ? '#FAFAF7' : T.paper), opacity: f._dup ? 0.6 : 1 }}>
                    <td style={td}>{f.fecha}</td>
                    <td style={{ ...td, fontWeight: 600, color: T.forest }}>{f.receptorNombre || 'Consumidor Final'}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: '.78rem' }}>{f.receptorNIT || 'CF'}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>Q {fmt(f.montoTotal)}</td>
                    <td style={td}>
                      {f._dup
                        ? <Badge txt="Ya cargada" c={T.muted} bg="rgba(107,107,96,.12)" />
                        : f._nuevo
                          ? <Badge txt="Cliente nuevo" c={T.ochre} bg="rgba(168,131,90,.14)" />
                          : <Badge txt="Cliente existe" c={T.ok} bg="rgba(46,125,50,.12)" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ txt, c, bg }) {
  return <span style={{ padding: '2px 8px', borderRadius: 2, fontSize: '.66rem', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', background: bg, color: c }}>{txt}</span>;
}

const btnPrimary = { padding: '9px 16px', borderRadius: 3, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', border: `1.5px solid ${T.forest}`, background: T.forest, color: 'white' };
const btnGhost = { padding: '9px 14px', borderRadius: 3, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', border: `1.5px solid ${T.rule}`, background: 'white', color: T.forest };
const thL = { background: T.forest, color: 'white', textAlign: 'left', padding: '8px 10px', fontSize: '.66rem', letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 600 };
const td = { padding: '8px 10px', borderBottom: `1px solid ${T.rule}`, verticalAlign: 'top' };
