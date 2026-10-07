import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { requireAuth, sessionMiddleware } from './auth.js';
import type { AppConfig } from './config.js';
import type { Db } from './db-pg.js';
import type { AuthProvider, StorageProvider } from './providers';
import { HttpError } from './http.js';
import { authRoutes } from './routes/auth.js';
import { laporanRoutes } from './routes/laporan.js';
import { pegawaiRoutes } from './routes/pegawai.js';
import { berkasRoutes, pengajuanRoutes } from './routes/pengajuan.js';
import { usersRoutes } from './routes/users.js';
import './types';

export interface Dependensi {
  db: Db;
  cfg: AppConfig;
  auth: AuthProvider;
  storage: StorageProvider;
}

export function createApp({ db, cfg, auth, storage }: Dependensi) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    const waktu = new Date().toISOString();
    try {
      await db.get('SELECT 1 AS ok');
      res.json({ ok: true, aplikasi: 'Kas Operasional DPBJ UI', database: 'terhubung', waktu });
    } catch (err) {
      console.error('[health] database tidak terhubung:', (err as Error).message);
      res.status(503).json({ ok: false, aplikasi: 'Kas Operasional DPBJ UI', database: 'tidak terhubung', waktu });
    }
  });

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', sessionMiddleware(db));
  app.use('/api/auth', authRoutes(db, cfg, auth));
  app.use('/api', requireAuth);
  app.use('/api/pegawai', pegawaiRoutes(db));
  app.use('/api/users', usersRoutes(db, auth));
  app.use('/api/pengajuan', pengajuanRoutes(db, storage));
  app.use('/api/berkas', berkasRoutes(db, storage));
  app.use('/api', laporanRoutes(db));
  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'Endpoint tidak ditemukan' });
  });

  // Mode produksi lokal: sajikan hasil build frontend (dist/) + fallback SPA.
  const indexHtml = path.join(cfg.distDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(
      '/assets',
      express.static(path.join(cfg.distDir, 'assets'), { immutable: true, maxAge: '365d', fallthrough: false }),
    );
    app.use(express.static(cfg.distDir, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ message: err.message, ...(err.errors ? { errors: err.errors } : {}) });
      return;
    }
    const e = err as { type?: string; status?: number; code?: string; message?: string };
    if (e?.type === 'entity.parse.failed') {
      res.status(400).json({ message: 'Format data tidak valid' });
      return;
    }
    if (e?.type === 'entity.too.large') {
      res.status(413).json({ message: 'Data yang dikirim terlalu besar' });
      return;
    }
    if (e?.status === 404) {
      res.status(404).json({ message: 'Tidak ditemukan' });
      return;
    }
    // Kode error PostgreSQL: 23505 unique, 23503 foreign key, 22P02 format input, 22003 di luar rentang.
    if (e?.code === '23505') {
      res.status(409).json({ message: 'Data duplikat: nilai yang sama sudah tersimpan' });
      return;
    }
    if (e?.code === '23503') {
      res.status(409).json({ message: 'Data masih terhubung dengan data lain' });
      return;
    }
    if (e?.code === '22P02' || e?.code === '22003') {
      res.status(400).json({ message: 'Data tidak valid' });
      return;
    }
    console.error('[server] Error tak terduga:', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server. Silakan coba lagi.' });
  });

  return app;
}
