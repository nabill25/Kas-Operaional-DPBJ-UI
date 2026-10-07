import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app';
import { purgeExpiredSessions } from './auth';
import { loadConfig } from './config';
import { getDb } from './db-pg';
import { buatSupabase, konfigSupabaseDariEnv } from './supabase';

async function main() {
  const cfg = loadConfig();
  const db = getDb();
  const konfig = konfigSupabaseDariEnv(process.env, cfg.storageBucket);
  for (const p of konfig.peringatan) console.warn('⚠ ', p);
  const { auth, storage } = buatSupabase(konfig);

  await purgeExpiredSessions(db);
  setInterval(() => purgeExpiredSessions(db).catch(() => undefined), 60 * 60_000).unref();

  const app = createApp({ db, cfg, auth, storage, peringatan: konfig.peringatan });
  const server = app.listen(cfg.port, () => {
    console.log(`✓ API Kas Operasional DPBJ berjalan di http://localhost:${cfg.port}/api`);
    if (fs.existsSync(path.join(cfg.distDir, 'index.html'))) {
      console.log(`  Aplikasi (hasil build) tersedia di http://localhost:${cfg.port}`);
    }
    console.log('  Database: Supabase PostgreSQL · Login: Supabase Auth · Berkas: Supabase Storage');
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
      await db.tutup();
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
