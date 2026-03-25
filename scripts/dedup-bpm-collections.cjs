// Deduplicates dt/tl/al/bas/rod collections — keeps first occurrence of each fecha+hora+key
// Run: node scripts/dedup-bpm-collections.cjs
const https = require('https');
const API_KEY    = 'AIzaSyCbYbUyMgNxcmkawV3vtOieUT-Hdgr08iY';
const PROJECT_ID = 'ajuabmp';
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const u   = new URL(`${BASE}/${path}${sep}key=${API_KEY}`);
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

function dedupKey(mod, r) {
  if (mod === 'dt')  return `${r.fecha}|${r.hora}|${r.placa || ''}|${r.conductor || r.resp || ''}`;
  if (mod === 'tl')  return `${r.fecha}|${r.hora}|${r.placa || ''}`;
  if (mod === 'al')  return `${r.fecha}|${r.turno || ''}`;
  if (mod === 'bas') return `${r.fecha}|${r.hora}|${r.resp || r.responsable || ''}`;
  if (mod === 'rod') return `${r.fecha}|${r.hora}|${r.resp || r.responsable || ''}`;
  return `${r.fecha}|${r.hora}`;
}

async function getAllDocs(colName) {
  const docs = [];
  let pageToken = null;
  do {
    const qs = pageToken ? `${colName}?pageSize=300&pageToken=${encodeURIComponent(pageToken)}` : `${colName}?pageSize=300`;
    const res = await req('GET', qs);
    if (res.code !== 200) { console.log('  error reading page:', res.code); break; }
    for (const d of res.data.documents || []) {
      const obj = { _docId: d.name.split('/').pop() };
      for (const [k, fv] of Object.entries(d.fields || {})) obj[k] = fromFV(fv);
      docs.push(obj);
    }
    pageToken = res.data.nextPageToken || null;
  } while (pageToken);
  return docs;
}

async function run() {
  const MODULES = ['dt','tl','al','bas','rod'];
  for (const mod of MODULES) {
    console.log(`\n▶ ${mod}: reading all docs...`);
    const docs = await getAllDocs(mod);
    console.log(`  total docs: ${docs.length}`);

    // Group by dedup key, keep first, mark rest for deletion
    const seen = new Map();
    const toDelete = [];
    for (const doc of docs) {
      const k = dedupKey(mod, doc);
      if (!seen.has(k)) { seen.set(k, doc._docId); }
      else { toDelete.push(doc._docId); }
    }

    console.log(`  unique: ${seen.size} | duplicates to delete: ${toDelete.length}`);
    let deleted = 0;
    for (const docId of toDelete) {
      const res = await req('DELETE', `${mod}/${docId}`);
      if (res.code === 200) deleted++;
      else process.stdout.write(`  ✗ delete ${docId}: ${res.code}\n`);
    }
    console.log(`  ✅ deleted ${deleted} duplicates`);
  }
  console.log('\n🎉 Dedup completo\n');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
