/**
 * AJÚA BPM — Migración de datos históricos a colecciones individuales
 * Lee el backup JSON más reciente y escribe cada array a su colección Firestore.
 * NO sobreescribe documentos existentes (skip si ya existe).
 * Uso: node scripts/migrate-to-collections.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ─── Firebase config ───────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyCbYbUyMgNxcmkawV3vtOieUT-Hdgr08iY',
  authDomain:        'ajuabmp.firebaseapp.com',
  projectId:         'ajuabmp',
  storageBucket:     'ajuabmp.firebasestorage.app',
  messagingSenderId: '681963417089',
  appId:             '1:681963417089:web:96b3b75e8d995b0e501a00',
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ─── Backup a usar ─────────────────────────────────────────────────────────
const BACKUP_PATH = 'C:/Users/PC/Downloads/ajua_backup_2026-03-19 (1).json';

// Mapeo backup-key → nombre colección Firestore
const COLLECTIONS = {
  tl:             'tl',
  dt:             'dt',
  bas:            'bas',
  rod:            'rod',
  al:             'al',
  fum:            'fum',
  vyp:            'vyp',
  limp:           'limp',
  bl:             'bl',
  parq:           'parq',
  ientradas:      'ientradas',
  isalidas:       'isalidas',
  vgtVentas:      'vgtVentas',
  vintVentas:     'vintVentas',
  cotizaciones:   'cotizadorRapido',   // React usa 'cotizadorRapido'
  gastosSemanales:'gastosSemanales',
  gastosDiarios:  'gastosDiarios',
  pedidosWalmart: 'pedidosWalmart',
  proveedores:    'proveedores',
  iproductos:     'iProductos',
  ipresentaciones:'iPresentaciones',
  iclientes:      'iclientes',
  empleados:      'empleados',
  conductores:    'conductores',
  usuarios:       'usuarios',
  gcConcursos:    'gcConcursos',
  calibraciones:  'bas_calibraciones',
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

async function migrateCollection(backupKey, colName, records) {
  if (!Array.isArray(records) || records.length === 0) {
    console.log(`  ${colName}: vacío — omitido`);
    return { migrated: 0, skipped: 0, total: 0 };
  }

  let migrated = 0;
  let skipped  = 0;
  const total  = records.length;

  for (const record of records) {
    const docId  = record.id || uid();
    const docRef = doc(db, colName, String(docId));

    // No sobreescribir si ya existe
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      skipped++;
      continue;
    }

    await setDoc(docRef, {
      ...record,
      id: String(docId),
      _migratedFrom: 'ajua_bpm/main',
      _migratedAt:   new Date().toISOString(),
    });
    migrated++;

    // Log de progreso cada 10 docs
    if ((migrated + skipped) % 10 === 0 || (migrated + skipped) === total) {
      process.stdout.write(`\r  ${colName}: ${migrated + skipped}/${total} ...`);
    }
  }

  console.log(`\r  ${colName}: ${migrated} migrados, ${skipped} ya existían (total ${total})`);
  return { migrated, skipped, total };
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  AJÚA BPM — Migración de datos históricos');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Backup: ${BACKUP_PATH}\n`);

  const backup = JSON.parse(readFileSync(BACKUP_PATH, 'utf8'));

  const results = {};
  let totalMigrated = 0;
  let totalSkipped  = 0;

  for (const [backupKey, colName] of Object.entries(COLLECTIONS)) {
    const records = backup[backupKey];
    const r = await migrateCollection(backupKey, colName, records);
    results[colName] = r;
    totalMigrated += r.migrated;
    totalSkipped  += r.skipped;
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  RESUMEN FINAL');
  console.log('═══════════════════════════════════════════════════');
  for (const [col, r] of Object.entries(results)) {
    if (r.total > 0) {
      console.log(`  ✓ ${col.padEnd(20)} ${r.migrated} migrados  ${r.skipped} existentes`);
    }
  }
  console.log('───────────────────────────────────────────────────');
  console.log(`  TOTAL: ${totalMigrated} documentos migrados, ${totalSkipped} ya existían`);
  console.log('═══════════════════════════════════════════════════');

  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ ERROR:', err.message);
  process.exit(1);
});
