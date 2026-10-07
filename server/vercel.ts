// Titik masuk fungsi serverless Vercel. Dibundel esbuild menjadi api/bundle.mjs (script build:server),
// sehingga folder api/ hanya berisi hasil bundel dan Vercel tidak mengompilasi ulang sumber TypeScript.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app';
import { loadConfig } from './config';
import { getDb } from './db-pg';
import { buatSupabase, konfigSupabaseDariEnv } from './supabase';

let handler: (req: IncomingMessage, res: ServerResponse) => void;
try {
  const cfg = loadConfig();
  const db = getDb();
  const konfig = konfigSupabaseDariEnv(process.env, cfg.storageBucket);
  for (const p of konfig.peringatan) console.warn('[api] Peringatan konfigurasi:', p);
  const { auth, storage } = buatSupabase(konfig);
  handler = createApp({ db, cfg, auth, storage, peringatan: konfig.peringatan });
} catch (error) {
  // Biasanya environment variable belum diisi di Vercel. Pesan hanya menyebut NAMA variabel, bukan nilainya.
  console.error('[api] Inisialisasi gagal:', error);
  const pesan = error instanceof Error ? error.message : String(error);
  handler = (_req, res) => {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ message: `Server belum siap: ${pesan}` }));
  };
}

export default handler;
