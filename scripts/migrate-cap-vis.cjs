// migrate cap + vis from ajua_bpm/backup_auto → standalone collections
// Run once: node scripts/migrate-cap-vis.js
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
      res.on('end', () => resolve({ code: res.statusCode, data: JSON.parse(raw) }));
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
  let ok = 0;
  for (const item of arr) {
    const fields = {};
    for (const [k, val] of Object.entries(item)) fields[k] = toFV(val);
    fields['_migratedFrom'] = toFV('backup_auto');
    fields['_ts'] = toFV(new Date().toISOString());
    const res = await req('POST', colName, { fields });
    if (res.code === 200) { ok++; process.stdout.write(`  ✓ ${colName} doc saved\n`); }
    else process.stdout.write(`  ✗ Error: ${JSON.stringify(res.data).slice(0, 100)}\n`);
  }
  return ok;
}

async function run() {
  console.log('\n▶ Leyendo ajua_bpm/backup_auto...');
  const bak = await req('GET', 'ajua_bpm/backup_auto');
  if (bak.code !== 200) { console.error('❌ Cannot read backup_auto:', bak.code); process.exit(1); }

  const DB = {};
  for (const [k, fv] of Object.entries(bak.data.fields || {})) DB[k] = fromFV(fv);

  const cap = DB.cap || [];
  const vis = DB.vis || [];
  console.log(`cap: ${cap.length} registros | vis: ${vis.length} registros\n`);

  // Check targets are empty first
  const capCheck = await req('GET', 'cap?pageSize=1');
  const visCheck = await req('GET', 'vis?pageSize=1');
  if (capCheck.data.documents?.length) { console.log('⚠ cap ya tiene docs — saltando'); }
  else {
    console.log(`▶ Migrando cap (${cap.length} docs)...`);
    const n = await migrateArray(cap, 'cap');
    console.log(`✅ cap: ${n} docs migrados`);
  }
  if (visCheck.data.documents?.length) { console.log('⚠ vis ya tiene docs — saltando'); }
  else {
    console.log(`▶ Migrando vis (${vis.length} docs)...`);
    const n = await migrateArray(vis, 'vis');
    console.log(`✅ vis: ${n} docs migrados`);
  }
  console.log('\n✅ Migración completa\n');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
