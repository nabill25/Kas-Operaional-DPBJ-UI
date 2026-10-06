import { loadConfig } from '../config';
import { getDb } from '../db-pg';
import { seedMinimal } from '../seed';
import { hapusDataLama } from './reset';

const cfg = loadConfig();
hapusDataLama(cfg);
async function run() {
  const db = getDb();
  await seedMinimal(db);
  await db.close();
  console.log(`✓ Database direset kosong`);
  console.log('    Akun awal: admin / admin123 — segera ganti password setelah masuk.');
}
run();
