import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Root project (folder di atas /server). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface AppConfig {
  port: number;
  distDir: string;
  cookieSecure: boolean;
  sessionDays: number;
  /** Nama bucket Supabase Storage untuk berkas pengajuan (privat). */
  storageBucket: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 5211),
    distDir: path.join(ROOT, 'dist'),
    // Di Vercel (HTTPS) cookie sesi selalu Secure, kecuali COOKIE_SECURE diisi eksplisit.
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : Boolean(env.VERCEL),
    sessionDays: 7,
    storageBucket: 'berkas',
  };
}
