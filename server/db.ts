import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';

export type SqlParam = SQLInputValue;

export interface Migrasi {
  /** SQL yang dijalankan (boleh beberapa statement). */
  sql?: string;
  /** Langkah tambahan berbasis kode (dijalankan setelah `sql`). */
  jalankan?: (raw: DatabaseSync) => void;
  /**
   * Matikan foreign key selama migrasi — wajib untuk membangun ulang tabel yang dirujuk tabel lain
   * (prosedur "12 langkah" SQLite). FK diperiksa ulang dengan PRAGMA foreign_key_check sebelum commit.
   */
  matikanFK?: boolean;
}

/** Skema awal (v1) — dipertahankan apa adanya agar database lama dapat dimigrasikan. */
export const SKEMA_V1 = `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    nama TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','operator','mdk')),
    password_hash TEXT NOT NULL,
    aktif INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX ix_sessions_user ON sessions(user_id);

  CREATE TABLE pegawai (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    nip TEXT,
    jabatan TEXT,
    aktif INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX ux_pegawai_nip ON pegawai(nip) WHERE nip IS NOT NULL;

  CREATE TABLE kode_counter (
    prefix TEXT NOT NULL,
    tahun INTEGER NOT NULL,
    terakhir INTEGER NOT NULL,
    PRIMARY KEY (prefix, tahun)
  );

  CREATE TABLE pengajuan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode TEXT NOT NULL UNIQUE,
    kategori TEXT NOT NULL CHECK (kategori IN ('konsumsi','rumah_tangga','perjadin')),
    nama_kegiatan TEXT NOT NULL,
    tanggal_kegiatan TEXT NOT NULL,
    tanggal_selesai TEXT,
    jumlah_orang INTEGER NOT NULL CHECK (jumlah_orang >= 0),
    lokasi_tujuan TEXT,
    mekanisme TEXT NOT NULL CHECK (mekanisme IN ('KO','LS')),
    jenis_uang TEXT CHECK (jenis_uang IS NULL OR jenis_uang IN ('uang_harian','uang_transport')),
    jenis_transport TEXT CHECK (jenis_transport IS NULL OR jenis_transport IN ('dalam_kota','luar_kota')),
    uang_siapa_id INTEGER REFERENCES pegawai(id),
    total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
    catatan TEXT,
    berkas_na TEXT NOT NULL DEFAULT '[]',
    berkas_terpenuhi INTEGER NOT NULL DEFAULT 0,
    berkas_wajib INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','diajukan','dikembalikan','selesai')),
    no_invoice_mdk TEXT,
    tanggal_invoice_mdk TEXT,
    catatan_mdk TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    diajukan_at TEXT,
    diproses_by INTEGER REFERENCES users(id),
    diproses_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX ix_pengajuan_status ON pengajuan(status);
  CREATE INDEX ix_pengajuan_kategori ON pengajuan(kategori);
  CREATE INDEX ix_pengajuan_tanggal ON pengajuan(tanggal_kegiatan);
  CREATE INDEX ix_pengajuan_uang_siapa ON pengajuan(uang_siapa_id);

  CREATE TABLE pengajuan_peserta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pengajuan_id INTEGER NOT NULL REFERENCES pengajuan(id) ON DELETE CASCADE,
    pegawai_id INTEGER NOT NULL REFERENCES pegawai(id),
    nilai INTEGER NOT NULL CHECK (nilai > 0),
    urutan INTEGER NOT NULL,
    UNIQUE (pengajuan_id, pegawai_id)
  );
  CREATE INDEX ix_peserta_pegawai ON pengajuan_peserta(pegawai_id);

  CREATE TABLE berkas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pengajuan_id INTEGER NOT NULL REFERENCES pengajuan(id) ON DELETE CASCADE,
    jenis TEXT NOT NULL,
    nama_berkas TEXT,
    nama_asli TEXT NOT NULL,
    nama_file TEXT NOT NULL UNIQUE,
    mime TEXT NOT NULL,
    ukuran INTEGER NOT NULL,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
  );
  CREATE INDEX ix_berkas_pengajuan ON berkas(pengajuan_id);

  CREATE TABLE riwayat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pengajuan_id INTEGER REFERENCES pengajuan(id) ON DELETE SET NULL,
    kode TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id),
    aksi TEXT NOT NULL,
    keterangan TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX ix_riwayat_pengajuan ON riwayat(pengajuan_id);
  CREATE INDEX ix_riwayat_waktu ON riwayat(created_at);
  `;

/**
 * v2 — Alur PUM: peran mdk → pum (+ pimpinan), status diajukan → diajukan_pum (+ diajukan_mdk),
 * kolom PUM (project hosting, task name, diteruskan), catatan_mdk → catatan_pum,
 * tabel cek_berkas (centang PUM) & notifikasi.
 */
const SKEMA_V2 = `
  CREATE TABLE users_baru (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    nama TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','operator','pum','pimpinan')),
    password_hash TEXT NOT NULL,
    aktif INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  INSERT INTO users_baru (id, username, nama, role, password_hash, aktif, created_at, updated_at)
    SELECT id, username, nama, CASE role WHEN 'mdk' THEN 'pum' ELSE role END, password_hash, aktif, created_at, updated_at
      FROM users;
  DROP TABLE users;
  ALTER TABLE users_baru RENAME TO users;

  CREATE TABLE pengajuan_baru (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode TEXT NOT NULL UNIQUE,
    kategori TEXT NOT NULL CHECK (kategori IN ('konsumsi','rumah_tangga','perjadin')),
    nama_kegiatan TEXT NOT NULL,
    tanggal_kegiatan TEXT NOT NULL,
    tanggal_selesai TEXT,
    jumlah_orang INTEGER NOT NULL CHECK (jumlah_orang >= 0),
    lokasi_tujuan TEXT,
    mekanisme TEXT NOT NULL CHECK (mekanisme IN ('KO','LS')),
    jenis_uang TEXT CHECK (jenis_uang IS NULL OR jenis_uang IN ('uang_harian','uang_transport')),
    jenis_transport TEXT CHECK (jenis_transport IS NULL OR jenis_transport IN ('dalam_kota','luar_kota')),
    uang_siapa_id INTEGER REFERENCES pegawai(id),
    total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
    catatan TEXT,
    berkas_na TEXT NOT NULL DEFAULT '[]',
    berkas_terpenuhi INTEGER NOT NULL DEFAULT 0,
    berkas_wajib INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft','diajukan_pum','dikembalikan','diajukan_mdk','selesai')),
    no_invoice_mdk TEXT,
    tanggal_invoice_mdk TEXT,
    catatan_pum TEXT,
    project_hosting TEXT,
    task_name TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    diajukan_at TEXT,
    diteruskan_by INTEGER REFERENCES users(id),
    diteruskan_at TEXT,
    diproses_by INTEGER REFERENCES users(id),
    diproses_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  INSERT INTO pengajuan_baru (
    id, kode, kategori, nama_kegiatan, tanggal_kegiatan, tanggal_selesai, jumlah_orang, lokasi_tujuan, mekanisme,
    jenis_uang, jenis_transport, uang_siapa_id, total, catatan, berkas_na, berkas_terpenuhi, berkas_wajib, status,
    no_invoice_mdk, tanggal_invoice_mdk, catatan_pum, project_hosting, task_name, created_by, updated_by,
    diajukan_at, diteruskan_by, diteruskan_at, diproses_by, diproses_at, created_at, updated_at)
  SELECT
    id, kode, kategori, nama_kegiatan, tanggal_kegiatan, tanggal_selesai, jumlah_orang, lokasi_tujuan, mekanisme,
    jenis_uang, jenis_transport, uang_siapa_id, total, catatan, berkas_na, berkas_terpenuhi, berkas_wajib,
    CASE status WHEN 'diajukan' THEN 'diajukan_pum' ELSE status END,
    no_invoice_mdk, tanggal_invoice_mdk, catatan_mdk, NULL, NULL, created_by, updated_by,
    diajukan_at, NULL, NULL, diproses_by, diproses_at, created_at, updated_at
  FROM pengajuan;
  DROP TABLE pengajuan;
  ALTER TABLE pengajuan_baru RENAME TO pengajuan;
  CREATE INDEX ix_pengajuan_status ON pengajuan(status);
  CREATE INDEX ix_pengajuan_kategori ON pengajuan(kategori);
  CREATE INDEX ix_pengajuan_tanggal ON pengajuan(tanggal_kegiatan);
  CREATE INDEX ix_pengajuan_uang_siapa ON pengajuan(uang_siapa_id);

  CREATE TABLE cek_berkas (
    pengajuan_id INTEGER NOT NULL REFERENCES pengajuan(id) ON DELETE CASCADE,
    jenis TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sesuai','revisi')),
    catatan TEXT,
    diperiksa_by INTEGER NOT NULL REFERENCES users(id),
    diperiksa_at TEXT NOT NULL,
    PRIMARY KEY (pengajuan_id, jenis)
  );

  CREATE TABLE notifikasi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pengajuan_id INTEGER REFERENCES pengajuan(id) ON DELETE SET NULL,
    kode TEXT NOT NULL,
    jenis TEXT NOT NULL,
    judul TEXT NOT NULL,
    pesan TEXT NOT NULL,
    dibaca_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX ix_notifikasi_user ON notifikasi(user_id, dibaca_at, id);
`;

/** Simpan & pulihkan urutan AUTOINCREMENT agar id yang pernah dipakai tidak terpakai ulang setelah tabel dibangun ulang. */
function pertahankanSequence(raw: DatabaseSync, tabel: string[], langkah: () => void): void {
  const ph = tabel.map(() => '?').join(',');
  const lama = raw
    .prepare(`SELECT name, seq FROM sqlite_sequence WHERE name IN (${ph})`)
    .all(...tabel) as { name: string; seq: number }[];
  langkah();
  for (const { name, seq } of lama) {
    const kini = raw.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?').get(name) as { seq: number } | undefined;
    if (!kini) raw.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)').run(name, seq);
    else if (kini.seq < seq) raw.prepare('UPDATE sqlite_sequence SET seq = ? WHERE name = ?').run(seq, name);
  }
}

/**
 * Migrasi skema berurutan. Index array + 1 = PRAGMA user_version.
 * JANGAN mengubah migrasi yang sudah ada — tambahkan migrasi baru di akhir.
 */
export const MIGRASI: Migrasi[] = [
  { sql: SKEMA_V1 },
  {
    matikanFK: true,
    jalankan: (raw) => pertahankanSequence(raw, ['users', 'pengajuan'], () => raw.exec(SKEMA_V2)),
  },
];

export const VERSI_SKEMA = MIGRASI.length;

export function nowIso(): string {
  return new Date().toISOString();
}

/** Pembungkus tipis `node:sqlite` dengan cache statement & transaksi bersarang (savepoint). */
export class Db {
  readonly raw: DatabaseSync;
  private readonly cache = new Map<string, StatementSync>();
  private kedalaman = 0;

  constructor(file: string) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.raw = new DatabaseSync(file);
    this.raw.exec('PRAGMA foreign_keys = ON;');
    this.raw.exec('PRAGMA busy_timeout = 5000;');
    if (file !== ':memory:') this.raw.exec('PRAGMA journal_mode = WAL;');
    this.migrasi();
  }

  private stmt(sql: string): StatementSync {
    let s = this.cache.get(sql);
    if (!s) {
      s = this.raw.prepare(sql);
      this.cache.set(sql, s);
    }
    return s;
  }

  all<T>(sql: string, ...params: SqlParam[]): T[] {
    return this.stmt(sql).all(...params) as T[];
  }

  get<T>(sql: string, ...params: SqlParam[]): T | undefined {
    return this.stmt(sql).get(...params) as T | undefined;
  }

  run(sql: string, ...params: SqlParam[]): { changes: number; lastInsertRowid: number } {
    const r = this.stmt(sql).run(...params);
    return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  /** Jalankan fn dalam transaksi. Fungsi HARUS sinkron. Bersarang → savepoint. */
  tx<T>(fn: () => T): T {
    const sp = `sp_${this.kedalaman}`;
    this.raw.exec(this.kedalaman === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${sp}`);
    this.kedalaman++;
    try {
      const hasil = fn();
      this.kedalaman--;
      this.raw.exec(this.kedalaman === 0 ? 'COMMIT' : `RELEASE ${sp}`);
      return hasil;
    } catch (err) {
      this.kedalaman--;
      if (this.kedalaman === 0) this.raw.exec('ROLLBACK');
      else this.raw.exec(`ROLLBACK TO ${sp}; RELEASE ${sp}`);
      throw err;
    }
  }

  close(): void {
    this.cache.clear();
    this.raw.close();
  }

  private migrasi(): void {
    const { user_version } = this.get<{ user_version: number }>('PRAGMA user_version') ?? { user_version: 0 };
    for (let v = user_version; v < MIGRASI.length; v++) {
      const m = MIGRASI[v];
      // PRAGMA foreign_keys tidak berpengaruh di dalam transaksi → atur sebelum BEGIN.
      if (m.matikanFK) this.raw.exec('PRAGMA foreign_keys = OFF;');
      try {
        this.tx(() => {
          if (m.sql) this.raw.exec(m.sql);
          m.jalankan?.(this.raw);
          if (m.matikanFK) {
            const salah = this.raw.prepare('PRAGMA foreign_key_check').all();
            if (salah.length > 0) {
              throw new Error(`Migrasi v${v + 1} gagal: ${salah.length} pelanggaran foreign key`);
            }
          }
          this.raw.exec(`PRAGMA user_version = ${v + 1}`);
        });
      } finally {
        if (m.matikanFK) this.raw.exec('PRAGMA foreign_keys = ON;');
      }
      // Statement yang di-cache mungkin merujuk skema lama.
      this.cache.clear();
    }
  }
}
