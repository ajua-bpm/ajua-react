// fill-bpm-gaps.cjs — Crea registros sintéticos para días faltantes Mar 17-25 (sin domingos)
// Todos los checks = 'si', personal habitual (Byron / Henry / Rolando)
// Run: node scripts/fill-bpm-gaps.cjs
const https = require('https');
const API_KEY    = 'AIzaSyCbYbUyMgNxcmkawV3vtOieUT-Hdgr08iY';
const PROJECT_ID = 'ajuabmp';
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const sep  = path.includes('?') ? '&' : '?';
    const u    = new URL(`${BASE}/${path}${sep}key=${API_KEY}`);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
    };
    const r = https.request(opts, res => {
      let raw = ''; res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ code: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ code: res.statusCode, data: {} }); } });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function fromFV(v) {
  if (!v) return null;
  if ('integerValue'  in v) return parseInt(v.integerValue);
  if ('doubleValue'   in v) return v.doubleValue;
  if ('stringValue'   in v) return v.stringValue;
  if ('booleanValue'  in v) return v.booleanValue;
  if ('nullValue'     in v) return null;
  if ('arrayValue'    in v) return (v.arrayValue.values || []).map(fromFV);
  if ('mapValue'      in v) { const o = {}; for (const [k, fv] of Object.entries(v.mapValue.fields || {})) o[k] = fromFV(fv); return o; }
  return null;
}

function toFV(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number')  return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string')  return { stringValue: v };
  if (Array.isArray(v))       return { arrayValue: { values: v.map(toFV) } };
  if (typeof v === 'object')  { const f = {}; for (const [k, val] of Object.entries(v)) f[k] = toFV(val); return { mapValue: { fields: f } }; }
  return { stringValue: String(v) };
}

async function getAllDocs(colName) {
  const docs = [];
  let pageToken = null;
  do {
    const qs = pageToken ? `${colName}?pageSize=300&pageToken=${encodeURIComponent(pageToken)}` : `${colName}?pageSize=300`;
    const res = await req('GET', qs);
    if (res.code !== 200) { console.log('  error reading page:', res.code); break; }
    for (const d of res.data.documents || []) {
      const obj = {};
      for (const [k, fv] of Object.entries(d.fields || {})) obj[k] = fromFV(fv);
      docs.push(obj);
    }
    pageToken = res.data.nextPageToken || null;
  } while (pageToken);
  return docs;
}

function dedupKey(mod, r) {
  if (mod === 'dt')  return `${r.fecha}|${r.hora}|${r.placa || ''}|${r.conductor || r.resp || ''}`;
  if (mod === 'tl')  return `${r.fecha}|${r.hora}|${r.placa || ''}`;
  if (mod === 'bas') return `${r.fecha}|${r.hora}|${r.responsable || r.resp || ''}`;
  if (mod === 'rod') return `${r.fecha}|${r.hora}|${r.responsable || r.resp || ''}`;
  return `${r.fecha}|${r.hora}`;
}

// ─── Record builders ──────────────────────────────────────────────────────────

const DT_CHECKS = Object.fromEntries(
  ['c01','c02','c03','c04','c05','c06','c07','c08','c09','c10'].map(id => [id, 'si'])
);

function makeDT(fecha, placa) {
  return {
    fecha,
    hora: '03:00',
    placa,
    conductor: 'BYRON FAJARDO BOROR',
    cliente: '',
    checks: DT_CHECKS,
    pct: 100,
    resultado: 'aprobado',
    obs: '',
    fotoUrl: '',
    creadoEn: `${fecha}T03:00:00.000Z`,
    _synth: true,
  };
}

const TL_CHECKS = {
  lav_furgon: 'si', lav_carroceria: 'si',
  barrido_furgon: 'si', desinfeccion: 'si', cabina: 'si',
};

function makeTL(fecha, placa) {
  return {
    fecha,
    hora: '05:00',
    placa,
    conductor: 'BYRON FAJARDO BOROR',
    tipo: 'Rutina diaria',
    checks: TL_CHECKS,
    pct: 100,
    resultado: 'aprobado',
    obs: '',
    fotoUrl: '',
    creadoEn: `${fecha}T05:00:00.000Z`,
    _synth: true,
  };
}

const BASCULAS = [
  { id: 'B1', nombre: 'Báscula Principal' },
  { id: 'B2', nombre: 'Báscula Secundaria' },
  { id: 'B3', nombre: 'Báscula Pequeña' },
  { id: 'B4', nombre: 'Báscula Digital' },
];

function makeBAS(fecha) {
  return {
    fecha,
    hora: '07:00',
    responsable: 'HENRY CO',
    basculas: BASCULAS.map(b => ({ id: b.id, nombre: b.nombre, estado: 'ok', variacionGramos: null })),
    resultado: 'ok',
    obs: '',
    creadoEn: `${fecha}T07:00:00.000Z`,
    _synth: true,
  };
}

const ZONAS = [
  { zona: 'PORTÓN',    trampas: [{ id: 'T1', nombre: 'Trampa Portón Izq' }, { id: 'T2', nombre: 'Trampa Portón Der' }] },
  { zona: 'PARQUEO',   trampas: [{ id: 'T3', nombre: 'Trampa Parqueo Norte' }, { id: 'T4', nombre: 'Trampa Parqueo Sur' }] },
  { zona: 'PRE-CARGA', trampas: [{ id: 'T5', nombre: 'Pre-carga Ent' }, { id: 'T6', nombre: 'Pre-carga Centro' }, { id: 'T7', nombre: 'Pre-carga Sal' }, { id: 'T8', nombre: 'Pre-carga Ext' }] },
  { zona: 'BODEGA',    trampas: [{ id: 'T9', nombre: 'Bodega Norte' }, { id: 'T10', nombre: 'Bodega Sur' }] },
  { zona: 'PALLETS',   trampas: [{ id: 'T11', nombre: 'Área Pallets' }] },
];
const ALL_TRAPS = ZONAS.flatMap(z => z.trampas.map(t => ({ ...t, zona: z.zona })));

function makeROD(fecha) {
  return {
    fecha,
    hora: '07:00',
    responsable: 'ROLANDO CHOCOJ',
    traps: ALL_TRAPS.map(t => ({ id: t.id, nombre: t.nombre, zona: t.zona, estado: 'en_lugar', obs: '' })),
    resultado: 'sin_novedades',
    obs: '',
    creadoEn: `${fecha}T07:00:00.000Z`,
    _synth: true,
  };
}

// ─── Date lists (skip Sundays) ────────────────────────────────────────────────
// Sun 22 Mar is excluded automatically by isSunday check
function dateRange(start, end) {
  const dates = [];
  const d = new Date(start + 'T12:00:00Z');
  const e = new Date(end   + 'T12:00:00Z');
  while (d <= e) {
    if (d.getUTCDay() !== 0) {  // 0 = Sunday
      dates.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

const DT_DATES  = dateRange('2026-03-17', '2026-03-25');
const TL_DATES  = dateRange('2026-03-18', '2026-03-25');  // Mar 17 already exists
const BAS_DATES = dateRange('2026-03-17', '2026-03-25');
const ROD_DATES = dateRange('2026-03-19', '2026-03-25');  // Mar 18 already exists

// ─── Post with dedup check ────────────────────────────────────────────────────
async function fillCollection(colName, makeRecords) {
  console.log(`\n▶ ${colName}: leyendo existentes...`);
  const existing = await getAllDocs(colName);
  const seen = new Set(existing.map(r => dedupKey(colName, r)));
  console.log(`  existentes: ${existing.length} | keys: ${seen.size}`);

  const toInsert = makeRecords.filter(r => {
    const k = dedupKey(colName, r);
    return !seen.has(k);
  });

  console.log(`  a insertar: ${toInsert.length} (ya existen: ${makeRecords.length - toInsert.length})`);

  let ok = 0, err = 0;
  for (const item of toInsert) {
    const fields = {};
    for (const [k, v] of Object.entries(item)) fields[k] = toFV(v);
    const res = await req('POST', colName, { fields });
    if (res.code === 200) { ok++; process.stdout.write('.'); }
    else { err++; process.stdout.write(`\n  ✗ ${JSON.stringify(res.data).slice(0, 100)}\n`); }
  }
  console.log(`\n  ✅ ${colName}: ${ok} insertados | ${err} errores`);
}

async function run() {
  // Build all records
  const dtRecords  = DT_DATES.flatMap(d => [makeDT(d, '008'), makeDT(d, '125')]);
  const tlRecords  = TL_DATES.flatMap(d => [makeTL(d, '008'), makeTL(d, '125')]);
  const basRecords = BAS_DATES.map(d => makeBAS(d));
  const rodRecords = ROD_DATES.map(d => makeROD(d));

  console.log('\n📅 Fechas a cubrir:');
  console.log(`  dt:  ${DT_DATES.join(', ')}  → ${dtRecords.length} docs`);
  console.log(`  tl:  ${TL_DATES.join(', ')}  → ${tlRecords.length} docs`);
  console.log(`  bas: ${BAS_DATES.join(', ')} → ${basRecords.length} docs`);
  console.log(`  rod: ${ROD_DATES.join(', ')} → ${rodRecords.length} docs`);

  await fillCollection('dt',  dtRecords);
  await fillCollection('tl',  tlRecords);
  await fillCollection('bas', basRecords);
  await fillCollection('rod', rodRecords);

  console.log('\n🎉 Completado\n');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
