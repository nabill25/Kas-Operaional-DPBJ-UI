import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app';
import { purgeExpiredSessions } from './auth';
import { loadConfig } from './config';
import { getDb } from './db-pg';
import { AKUN_DEMO, seedJikaKosong } from './seed';

async function main() {
  const cfg = loadConfig();
  const db = getDb();

  const seed = await seedJikaKosong(db, cfg);
  if (seed === 'demo') {
    console.log('• Database baru diisi data demo. Akun demo:');
    for (const a of AKUN_DEMO) console.log(`    - ${a.username} / ${a.password}  (${a.role})`);
  } else if (seed === 'minimal') {
    console.log('• Database baru. Akun awal: admin / admin123 — segera ganti password!');
  }

  await purgeExpiredSessions(db);
  setInterval(() => purgeExpiredSessions(db), 60 * 60_000).unref();

  const app = createApp({ db, cfg });
  const server = app.listen(cfg.port, () => {
    console.log(`✓ API Kas Operasional DPBJ berjalan di http://localhost:${cfg.port}/api`);
    if (fs.existsSync(path.join(cfg.distDir, 'index.html'))) {
      console.log(`  Aplikasi (hasil build) tersedia di http://localhost:${cfg.port}`);
    }
    console.log(`  Database: Supabase PostgreSQL`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`✗ Port ${cfg.port} sudah dipakai aplikasi lain.`);
    } else {
      console.error('✗ Server gagal berjalan:', err);
    }
    process.exit(1);
  });

  async function berhenti() {
    server.close();
    try {
      await db.close();
    } catch {
      // abaikan
    }
    process.exit(0);
  }
  process.on('SIGINT', berhenti);
  process.on('SIGTERM', berhenti);
}

main().catch((err) => {
  console.error('✗ Gagal memulai server:', err);
  process.exit(1);
});
