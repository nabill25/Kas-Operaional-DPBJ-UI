/**
 * Supabase client untuk server (backend).
 * Menggunakan postgres package untuk koneksi langsung ke database
 * melalui DATABASE_URL (connection string dari Supabase).
 */
import postgres from 'postgres';

let _sql: postgres.Sql | null = null;

export function getSql(): postgres.Sql {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL tidak diset. Isi di .env atau environment variable Vercel/server.');
    }
    _sql = postgres(url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 30,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return _sql;
}

export type Sql = postgres.Sql;
export type { Row } from 'postgres';
