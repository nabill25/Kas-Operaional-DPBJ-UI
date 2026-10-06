import { loadConfig } from '../config';
import { getDb } from '../db-pg';
import { AKUN_DEMO, seedDemo } from '../seed';
import { hapusDataLama } from './reset';

const cfg = loadConfig();
hapusDataLama(cfg);
async function run() {
  const db = getDb();
  await seedDemo(db, cfg.uploadDir);
  const row = await db.get<{ c: number }>('SELECT COUNT(*)::int AS c FROM pengajuan');
  const c = row?.c ?? 0;
  await db.close();
  console.log(`✓ Database direset & diisi data demo (${c} pengajuan)`);
  for (const a of AKUN_DEMO) console.log(`    - ${a.username} / ${a.password}  (${a.role})`);
}
run();
