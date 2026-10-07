/**
 * Server khusus E2E (Playwright): PostgreSQL lokal (TEST_DATABASE_URL) berisi data demo,
 * Supabase Auth tiruan, dan Supabase Storage tiruan yang dilayani lewat HTTP di server yang sama
 * (meniru unggah PUT ke URL bertanda tangan & unduh lewat URL sementara).
 */
import express from 'express';
import { MAX_UPLOAD_MB, UPLOAD_DIIZINKAN } from '../../shared/constants';
import { createApp } from '../../server/app';
import { loadConfig } from '../../server/config';
import { buatDb } from '../../server/db-pg';
import type { StorageProvider } from '../../server/providers';
import { AuthPalsu } from '../support/palsu';
import { buatDatabaseTest, siapkanTemplate } from '../support/pg';
import { seedDemo } from '../support/seed-demo';

const PORT = Number(process.env.PORT ?? 5212);
const BASE = `http://localhost:${PORT}`;
const MIME_DIIZINKAN = new Set(Object.values(UPLOAD_DIIZINKAN).flat());

class StorageHttpPalsu implements StorageProvider {
  readonly objek = new Map<string, { isi: Buffer; tipe: string }>();

  async buatUrlUnggah(key: string): Promise<string> {
    return `${BASE}/__storage/upload/${key}?token=uji`;
  }

  async baca(key: string): Promise<Buffer | null> {
    return this.objek.get(key)?.isi ?? null;
  }

  async urlUnduh(key: string, namaUnduh: string | null, detik: number): Promise<string | null> {
    if (!this.objek.has(key)) return null;
    const url = `${BASE}/__storage/object/${key}?token=uji&detik=${detik}`;
    return namaUnduh ? `${url}&download=${encodeURIComponent(namaUnduh)}` : url;
  }

  async hapus(keys: string[]): Promise<void> {
    for (const k of keys) this.objek.delete(k);
  }
}

await siapkanTemplate();
const db = buatDb(await buatDatabaseTest(), false);
const storage = new StorageHttpPalsu();
await seedDemo(db, (key, isi) => storage.objek.set(key, { isi, tipe: 'application/pdf' }));
const cfg = { ...loadConfig(), port: PORT, cookieSecure: false };

const app = express();
const kunciDari = (p: string | string[]) => (Array.isArray(p) ? p.join('/') : p);

app.put('/__storage/upload/*key', express.raw({ type: () => true, limit: `${MAX_UPLOAD_MB + 2}mb` }), (req, res) => {
  const key = kunciDari(req.params.key);
  const tipe = String(req.headers['content-type'] ?? '');
  const isi = req.body as Buffer;
  if (!MIME_DIIZINKAN.has(tipe)) {
    res.status(400).json({ statusCode: '415', error: 'invalid_mime_type', message: `mime type ${tipe} is not supported` });
    return;
  }
  if (isi.length > MAX_UPLOAD_MB * 1024 * 1024) {
    res.status(413).json({ statusCode: '413', error: 'Payload too large' });
    return;
  }
  if (storage.objek.has(key)) {
    res.status(400).json({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
    return;
  }
  storage.objek.set(key, { isi, tipe });
  res.json({ Key: `berkas/${key}` });
});

app.get('/__storage/object/*key', (req, res) => {
  const o = storage.objek.get(kunciDari(req.params.key));
  if (!o) {
    res.status(400).json({ statusCode: '404', error: 'not_found', message: 'Object not found' });
    return;
  }
  const nama = typeof req.query.download === 'string' ? req.query.download : null;
  res.setHeader('Content-Type', o.tipe);
  if (nama) res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(nama)}`);
  res.end(o.isi);
});

app.use(createApp({ db, cfg, auth: new AuthPalsu(db), storage }));
app.listen(PORT, () => console.log(`✓ Server E2E di ${BASE} (PostgreSQL lokal + Supabase tiruan)`));
