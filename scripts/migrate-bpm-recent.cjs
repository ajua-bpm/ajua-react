// migrate dt/tl/al/bas/rod from ajua_bpm/main → standalone collections
// Skips records already present (dedup by fecha+hora+placa/resp)
// Run: node scripts/migrate-bpm-recent.cjs
const https = require('https');
const API_KEY    = 'AIzaSyCbYbUyMgNxcmkawV3vtOieUT-Hdgr08iY';
const PROJECT_ID = 'ajuabmp';
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const u    = new URL(`${BASE}/${path}?key=${API_KEY}`);
    const data = body ? JSON.stringify(body) : null;
    const opts = { hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
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
  if (typeof v === 'boolean')  return { booleanValue: v };
  if (typeof v === 'number')   return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string')   return { stringValue: v };
  if (Array.isArray(v))        return { arrayValue: { values: v.map(toFV) } };
  if (typeof v === 'object')   { const f = {}; for (const [k, val] of Object.entries(v)) f[k] = toFV(val); return { mapValue: { fields: f } }; }
  return { stringValue: String(v) };
}

// Fetch ALL docs from a collection (handles pagination)
async function getAllDocs(colName) {
  const docs = [];
  let pageToken = null;
  do {
    const qs = pageToken ? `${colName}?pageSize=300&pageToken=${pageToken}` : `${colName}?pageSize=300`;
    const res = await req('GET', qs);
    if (res.code !== 200) break;
    for (const d of res.data.documents || []) {
      const obj = {};
      for (const [k, fv] of Object.entries(d.fields || {})) obj[k] = fromFV(fv);
      docs.push(obj);
    }
    pageToken = res.data.nextPageToken || null;
  } while (pageToken);
  return docs;
}

// Dedup key per module
function dedupKey(mod, r) {
  if (mod === 'dt')  return `${r.fecha}|${r.hora}|${r.placa || ''}|${r.conductor || r.resp || ''}`;
  if (mod === 'tl')  return `${r.fecha}|${r.hora}|${r.placa || ''}`;
  if (mod === 'al')  return `${r.fecha}|${r.turno || ''}`;
  if (mod === 'bas') return `${r.fecha}|${r.hora}|${r.resp || r.responsable || ''}`;
  if (mod === 'rod') return `${r.fecha}|${r.hora}|${r.resp || r.responsable || ''}`;
  return `${r.fecha}|${r.hora}`;
}

async function run() {
  console.log('\n▶ Leyendo ajua_bpm/main...');
  const mainRes = await req('GET', 'ajua_bpm/main');
  if (mainRes.code !== 200) { console.error('❌ Cannot read main:', mainRes.code); process.exit(1); }

  const main = {};
  for (const [k, fv] of Object.entries(mainRes.data.fields || {})) main[k] = fromFV(fv);

  const MODULES = ['dt','tl','al','bas','rod'];

  for (const mod of MODULES) {
    const arr = Array.isArray(main[mod]) ? main[mod] : [];
    console.log(`\n${mod}: ${arr.length} registros en main`);
    if (!arr.length) { console.log(`  ⚠ sin datos en main`); continue; }

    // Get existing docs to dedup
    console.log(`  ▶ Leyendo colección '${mod}' existente...`);
    const existing = await getAllDocs(mod);
    const existingKeys = new Set(existing.map(r => dedupKey(mod, r)));
    console.log(`  existing: ${existing.length} docs | keys: ${existingKeys.size}`);

    let added = 0, skipped = 0;
    for (const item of arr) {
      if (!item || !item.fecha) { skipped++; continue; }
      const k = dedupKey(mod, item);
      if (existingKeys.has(k)) { skipped++; continue; }

      const fields = {};
      for (const [fk, val] of Object.entries(item)) fields[fk] = toFV(val);
      fields['_migratedFrom'] = toFV('main');
      const res = await req('POST', mod, { fields });
      if (res.code === 200) { added++; existingKeys.add(k); }
      else { skipped++; process.stdout.write(`  ✗ ${JSON.stringify(res.data).slice(0,100)}\n`); }
    }
    console.log(`  ✅ ${mod}: ${added} nuevos migrados | ${skipped} omitidos`);
  }

  console.log('\n🎉 Migración reciente completa\n');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
