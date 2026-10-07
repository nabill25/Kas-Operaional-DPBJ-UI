/**
 * Database PostgreSQL untuk test API.
 *
 * TEST_DATABASE_URL menunjuk ke server PostgreSQL LOKAL (database "postgres"), contoh:
 *   postgres://postgres:password@127.0.0.1:5432/postgres
 * Test membuat database sendiri (kas_template + kas_test_*) lalu menghapusnya. Jangan arahkan ke Supabase.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const TEMPLATE_DB = 'kas_template';
export const AWALAN_DB = 'kas_test_';

export function urlServerTest(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL belum diisi. Test API butuh PostgreSQL lokal, contoh:\n' +
        '  TEST_DATABASE_URL=postgres://postgres:password@127.0.0.1:5432/postgres npm run test:api',
    );
  }
  if (/supabase\.(co|com)/i.test(url)) throw new Error('TEST_DATABASE_URL tidak boleh mengarah ke Supabase.');
  return url;
}

export function urlDatabase(nama: string): string {
  const u = new URL(urlServerTest());
  u.pathname = `/${nama}`;
  return u.toString();
}

async function denganServer<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: urlServerTest() });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** Hapus semua database sisa test lalu bangun template dari supabase/schema.sql (+ stub objek Supabase). */
export async function siapkanTemplate(): Promise<void> {
  await hapusDatabaseTest();
  await denganServer(async (c) => {
    await c.query(`DROP DATABASE IF EXISTS ${TEMPLATE_DB}`);
    await c.query(`CREATE DATABASE ${TEMPLATE_DB}`);
  });
  const t = new pg.Client({ connectionString: urlDatabase(TEMPLATE_DB) });
  await t.connect();
  try {
    await t.query(fs.readFileSync(path.join(ROOT, 'tests/support/supabase-stubs.sql'), 'utf8'));
    await t.query(fs.readFileSync(path.join(ROOT, 'supabase/schema.sql'), 'utf8'));
  } finally {
    await t.end();
  }
}

export async function buatDatabaseTest(): Promise<string> {
  const nama = `${AWALAN_DB}${process.pid}_${Date.now().toString(36)}`;
  await denganServer((c) => c.query(`CREATE DATABASE ${nama} TEMPLATE ${TEMPLATE_DB}`));
  return urlDatabase(nama);
}

export async function hapusDatabaseTest(): Promise<void> {
  await denganServer(async (c) => {
    const { rows } = await c.query<{ datname: string }>(
      `SELECT datname FROM pg_database WHERE datname LIKE '${AWALAN_DB}%'`,
    );
    for (const r of rows) await c.query(`DROP DATABASE IF EXISTS ${r.datname} WITH (FORCE)`);
  });
}
