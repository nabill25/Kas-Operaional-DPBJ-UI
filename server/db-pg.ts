/**
 * Lapisan database PostgreSQL (Supabase).
 *
 * Interface `Db` bersifat async. Placeholder `?` di SQL otomatis diubah menjadi $1, $2, ...
 * (di luar literal string). `run()` hanya mengembalikan `lastInsertRowid` bila SQL memakai
 * `RETURNING id` secara eksplisit, karena tidak semua tabel punya kolom id.
 */

import { Pool, types, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { bacaEnv } from './env';

// bigint (int8) dan numeric dikembalikan sebagai number. Nilai rupiah maks. 1e12 aman di bawah 2^53.
types.setTypeParser(20, (v: string) => Number(v));
types.setTypeParser(1700, (v: string) => Number(v));
// Tanggal kalender tetap 'YYYY-MM-DD' agar tidak bergeser oleh zona waktu.
types.setTypeParser(1082, (v: string) => v);
// timestamptz dikembalikan sebagai ISO string (UTC), konsisten dengan nilai ISO yang ditulis aplikasi.
const parseTimestamptz = types.getTypeParser(1184, 'text') as (v: string) => Date;
types.setTypeParser(1184, (v: string) => parseTimestamptz(v).toISOString());

export function nowIso(): string {
  return new Date().toISOString();
}

export type SqlParam = string | number | boolean | null | object;

type Row = Record<string, unknown>;

/** Ubah `?` (di luar literal string) menjadi $1, $2, ... */
export function toPgQuery(sql: string): string {
  let idx = 0;
  let dalamString = false;
  let hasil = '';
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") dalamString = !dalamString;
    if (c === '?' && !dalamString) hasil += `$${++idx}`;
    else hasil += c;
  }
  return hasil;
}

function hasilRun(result: QueryResult): { changes: number; lastInsertRowid: number } {
  const id = result.rows[0]?.id;
  return { changes: result.rowCount ?? 0, lastInsertRowid: id != null ? Number(id) : 0 };
}

export interface IDb {
  all<T extends QueryResultRow = Row>(sql: string, ...params: SqlParam[]): Promise<T[]>;
  get<T extends QueryResultRow = Row>(sql: string, ...params: SqlParam[]): Promise<T | undefined>;
  run(sql: string, ...params: SqlParam[]): Promise<{ changes: number; lastInsertRowid: number }>;
  exec(sql: string): Promise<void>;
  tx<T>(fn: (db: IDb) => Promise<T>): Promise<T>;
}

export type Db = IDb;

export function buatPool(connectionString: string, ssl: boolean): Pool {
  const pool = new Pool({
    connectionString,
    // Supabase mewajibkan SSL. Sertifikat pooler ditangani tanpa verifikasi CA (sama seperti dokumentasi Supabase untuk serverless).
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
    // Fungsi serverless: pool kecil, cepat dilepas.
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  });
  pool.on('error', (err) => {
    console.error('[db] Pool error:', err.message);
  });
  return pool;
}

class DbPgPool implements IDb {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async all<T extends QueryResultRow = Row>(sql: string, ...params: SqlParam[]): Promise<T[]> {
    const result = await this.pool.query<T>(toPgQuery(sql), params as unknown[]);
    return result.rows;
  }

  async get<T extends QueryResultRow = Row>(sql: string, ...params: SqlParam[]): Promise<T | undefined> {
    return (await this.all<T>(sql, ...params))[0];
  }

  async run(sql: string, ...params: SqlParam[]): Promise<{ changes: number; lastInsertRowid: number }> {
    return hasilRun(await this.pool.query(toPgQuery(sql), params as unknown[]));
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async tx<T>(fn: (db: IDb) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const hasil = await fn(new DbPgClient(client));
      await client.query('COMMIT');
      return hasil;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async tutup(): Promise<void> {
    await this.pool.end();
  }
}

/** Implementasi di dalam transaksi: satu koneksi, transaksi bersarang memakai savepoint. */
class DbPgClient implements IDb {
  private readonly client: PoolClient;
  private savepointSeq = 0;

  constructor(client: PoolClient) {
    this.client = client;
  }

  async all<T extends QueryResultRow = Row>(sql: string, ...params: SqlParam[]): Promise<T[]> {
    const result = await this.client.query<T>(toPgQuery(sql), params as unknown[]);
    return result.rows;
  }

  async get<T extends QueryResultRow = Row>(sql: string, ...params: SqlParam[]): Promise<T | undefined> {
    return (await this.all<T>(sql, ...params))[0];
  }

  async run(sql: string, ...params: SqlParam[]): Promise<{ changes: number; lastInsertRowid: number }> {
    return hasilRun(await this.client.query(toPgQuery(sql), params as unknown[]));
  }

  async exec(sql: string): Promise<void> {
    await this.client.query(sql);
  }

  async tx<T>(fn: (db: IDb) => Promise<T>): Promise<T> {
    const sp = `sp_${++this.savepointSeq}`;
    await this.client.query(`SAVEPOINT ${sp}`);
    try {
      const hasil = await fn(this);
      await this.client.query(`RELEASE SAVEPOINT ${sp}`);
      return hasil;
    } catch (err) {
      await this.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      throw err;
    }
  }
}

/** Buat koneksi database baru (dipakai aplikasi dan pengujian). */
export function buatDb(connectionString: string, ssl = true): Db & { tutup(): Promise<void> } {
  return new DbPgPool(buatPool(connectionString, ssl));
}

/** Transaction pooler (IPv4) project Supabase DPBJ — region ap-southeast-2 (Sydney). Bisa ditimpa SUPABASE_POOLER_HOST. */
const POOLER_BAWAAN = 'aws-0-ap-southeast-2.pooler.supabase.com';

/**
 * Host direct db.<ref>.supabase.co hanya punya alamat IPv6 sehingga tidak terjangkau dari Vercel.
 * URL seperti itu dialihkan ke Transaction pooler (IPv4, port 6543, user postgres.<ref>); URL lain tidak diubah.
 */
export function urlLewatPooler(url: string, poolerHost: string = POOLER_BAWAAN): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const m = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(u.hostname);
  if (!m) return url;
  if (u.username === 'postgres') u.username = `postgres.${m[1]}`;
  u.hostname = poolerHost;
  u.port = '6543';
  return u.toString();
}

let _db: (Db & { tutup(): Promise<void> }) | null = null;

/** Singleton untuk server (DATABASE_URL dari environment). */
export function getDb(): Db & { tutup(): Promise<void> } {
  if (!_db) {
    const mentah = bacaEnv(process.env, 'DATABASE_URL');
    if (!mentah) {
      throw new Error(
        'DATABASE_URL belum diisi. Pakai connection string "Transaction pooler" dari Supabase ' +
          '(Connect → Connection string → Transaction pooler), lalu Redeploy.',
      );
    }
    const url = urlLewatPooler(mentah, bacaEnv(process.env, 'SUPABASE_POOLER_HOST'));
    if (url !== mentah) console.warn('[db] DATABASE_URL memakai host direct Supabase (IPv6) — dialihkan ke Transaction pooler (IPv4).');
    _db = buatDb(url, bacaEnv(process.env, 'DATABASE_SSL') !== 'false');
  }
  return _db;
}
