import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Root project (folder di atas /server). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface AppConfig {
  port: number;
  dbPath: string;
  uploadDir: string;
  distDir: string;
  cookieSecure: boolean;
  sessionDays: number;
  seed: 'demo' | 'minimal';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const dataDir = path.join(ROOT, 'data');
  return {
    port: Number(env.PORT ?? 5211),
    dbPath: env.KAS_DB_PATH ? path.resolve(env.KAS_DB_PATH) : path.join(dataDir, 'kas-dpbj.db'),
    uploadDir: env.KAS_UPLOAD_DIR ? path.resolve(env.KAS_UPLOAD_DIR) : (env.VERCEL ? '/tmp/uploads' : path.join(dataDir, 'uploads')),
    distDir: path.join(ROOT, 'dist'),
    cookieSecure: env.COOKIE_SECURE === 'true',
    sessionDays: 7,
    seed: env.KAS_SEED === 'minimal' ? 'minimal' : 'demo',
  };
}
