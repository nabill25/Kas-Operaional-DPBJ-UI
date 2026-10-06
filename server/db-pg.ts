/**
 * Lapisan database PostgreSQL/Supabase.
 * Menggantikan server/db.ts yang berbasis node:sqlite.
 * 
 * Interface: DbPg — async, menggunakan node-postgres (pg).
 * Semua query menggunakan $1, $2... (konversi otomatis dari ?)
 */

import { Pool, type PoolClient, type QueryResultRow } from 'pg';

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL tidak diset. Isi di .env atau Vercel Environment Variables.\n' +
        'Format: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres'
      );
    }
    _pool = new Pool({
      connectionString: url,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    _pool.on('error', (err) => {
      console.error('[db] Pool error:', err);
    });
  }
  return _pool;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export type SqlParam = string | number | boolean | null | object;

/** Konversi query dengan ? placeholder ke $1, $2, ... (format PostgreSQL) */
function toPgQuery(sql: string): string {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

/** Apakah query ini INSERT? */
function isInsertQuery(sql: string): boolean {
  return /^\s*INSERT/i.test(sql);
}

/** Tambahkan RETURNING id ke INSERT jika belum ada */
function withReturning(sql: string): string {
  if (isInsertQuery(sql) && !/RETURNING/i.test(sql)) {
    return `${sql} RETURNING id`;
  }
  return sql;
}

/** Baris hasil query */
type Row = Record<string, unknown>;

export interface IDb {
  all<T extends QueryResultRow = Row>(sql: string, ...params: SqlParam[]): Promise<T[]>;
  get<T extends QueryResultRow = Row>(sql: string, ...params: SqlParam[]): Promise<T | undefined>;
  run(sql: string, ...params: SqlParam[]): Promise<{ changes: number; lastInsertRowid: number }>;
  exec(sql: string): Promise<void>;
  tx<T>(fn: (db: IDb) => Promise<T>): Promise<T>;
}

/** Implementasi menggunakan Pool (koneksi bebas) */
export class DbPg implements IDb {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  async all<T extends QueryResultRow = Row>(sql: string, ...params: SqlParam[]): Promise<T[]> {
    const pgSql = toPgQuery(sql);
    const result = await this.pool.query<T>(pgSql, params as unknown[]);
    return result.rows;
  }

  async get<T extends QueryResultRow = Row>(sql: string, ...params: SqlParam[]): Promise<T | undefined> {
    const rows = await this.all<T>(sql, ...params);
    return rows[0];
  }

  async run(sql: string, ...params: SqlParam[]): Promise<{ changes: number; lastInsertRowid: number }> {
    const pgSql = toPgQuery(withReturning(sql));
    const result = await this.pool.query(pgSql, params as unknown[]);
    const lastInsertRowid = result.rows[0]?.id != null ? Number(result.rows[0].id) : 0;
    return { changes: result.rowCount ?? 0, lastInsertRowid };
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async tx<T>(fn: (db: IDb) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txDb = new DbPgClient(client);
      const result = await fn(txDb);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    _pool = null;
  }
}

/** Implementasi menggunakan PoolClient (dalam transaksi) */
class DbPgClient implements IDb {
  private client: PoolClient;
  constructor(client: PoolClient) {
    this.client = client;
  }

  async all<T extends QueryResultRow = Row>(sql: string, ...params: SqlParam[]): Promise<T[]> {
    const pgSql = toPgQuery(sql);
    const result = await this.client.query<T>(pgSql, params as unknown[]);
    return result.rows;
  }

  async get<T extends QueryResultRow = Row>(sql: string, ...params: SqlParam[]): Promise<T | undefined> {
    const rows = await this.all<T>(sql, ...params);
    return rows[0];
  }

  async run(sql: string, ...params: SqlParam[]): Promise<{ changes: number; lastInsertRowid: number }> {
    const pgSql = toPgQuery(withReturning(sql));
    const result = await this.client.query(pgSql, params as unknown[]);
    const lastInsertRowid = result.rows[0]?.id != null ? Number(result.rows[0].id) : 0;
    return { changes: result.rowCount ?? 0, lastInsertRowid };
  }

  async exec(sql: string): Promise<void> {
    await this.client.query(sql);
  }

  async tx<T>(fn: (db: IDb) => Promise<T>): Promise<T> {
    // Savepoint untuk nested transaction
    const sp = `sp_${Date.now()}`;
    await this.client.query(`SAVEPOINT ${sp}`);
    try {
      const result = await fn(this);
      await this.client.query(`RELEASE SAVEPOINT ${sp}`);
      return result;
    } catch (err) {
      await this.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      throw err;
    }
  }
}

/** Singleton DB instance */
let _db: DbPg | null = null;

export function getDb(): DbPg {
  if (!_db) _db = new DbPg();
  return _db;
}

/** Type alias untuk backward compat */
export type Db = IDb;
