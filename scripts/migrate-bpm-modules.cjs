// migrate dt/tl/al/bas/rod from ajua_bpm/backup_auto → standalone collections
// Run once: node scripts/migrate-bpm-modules.cjs
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

async function migrateArray(arr, colName) {
  let ok = 0, err = 0;
  for (const item of arr) {
    if (!item || !item.fecha) { err++; continue; }
    const fields = {};
    for (const [k, val] of Object.entries(item)) fields[k] = toFV(val);
    fields['_migratedFrom'] = toFV('backup_auto');
    const res = await req('POST', colName, { fields });
    if (res.code === 200) ok++;
    else { err++; process.stdout.write(`  ✗ ${JSON.stringify(res.data).slice(0,120)}\n`); }
  }
  return { ok, err };
}

async function run() {
  console.log('\n▶ Leyendo ajua_bpm/backup_auto...');
  const bak = await req('GET', 'ajua_bpm/backup_auto');
  if (bak.code !== 200) { console.error('❌ Cannot read backup_auto:', bak.code); process.exit(1); }

  const DB = {};
  for (const [k, fv] of Object.entries(bak.data.fields || {})) DB[k] = fromFV(fv);

  const MODULES = ['dt','tl','al','bas','rod'];
  for (const mod of MODULES) {
    const arr = DB[mod] || [];
    console.log(`\n${mod}: ${arr.length} registros en backup_auto`);
    if (!arr.length) { console.log(`  ⚠ sin datos`); continue; }

    // Check if collection already has docs
    const check = await req('GET', `${mod}?pageSize=1`);
    if (check.data.documents?.length) {
      console.log(`  ⚠ ${mod} ya tiene datos — agregando igualmente (sin dedup)`);
    }

    console.log(`  ▶ Migrando ${arr.length} docs a '${mod}'...`);
    const { ok, err } = await migrateArray(arr, mod);
    console.log(`  ✅ ${mod}: ${ok} migrados | ${err} errores/sin fecha`);
  }

  console.log('\n🎉 Migración completa\n');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
