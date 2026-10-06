import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { requireAuth, sessionMiddleware } from './auth';
import type { AppConfig } from './config';
import type { Db } from './db-pg';
import { HttpError } from './http';
import { authRoutes } from './routes/auth';
import { laporanRoutes } from './routes/laporan';
import { pegawaiRoutes } from './routes/pegawai';
import { berkasRoutes, pengajuanRoutes } from './routes/pengajuan';
import { usersRoutes } from './routes/users';
import './types';

export function createApp({ db, cfg }: { db: Db; cfg: AppConfig }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, aplikasi: 'Kas Operasional DPBJ UI', waktu: new Date().toISOString() });
  });

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', sessionMiddleware(db));
  app.use('/api/auth', authRoutes(db, cfg));
  app.use('/api', requireAuth);
  app.use('/api/pegawai', pegawaiRoutes(db));
  app.use('/api/users', usersRoutes(db));
  app.use('/api/pengajuan', pengajuanRoutes(db, cfg));
  app.use('/api/berkas', berkasRoutes(db, cfg));
  app.use('/api', laporanRoutes(db));
  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'Endpoint tidak ditemukan' });
  });

  // Mode produksi: sajikan hasil build frontend (dist/) + fallback SPA.
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
    if (typeof e?.message === 'string' && e.message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ message: 'Data duplikat: nilai yang sama sudah tersimpan' });
      return;
    }
    console.error('[server] Error tak terduga:', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server. Silakan coba lagi.' });
  });

  return app;
}
