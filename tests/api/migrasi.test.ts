import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { Db, SKEMA_V1, VERSI_SKEMA } from '../../server/db';

let dir = '';
afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = '';
});

/** Buat database skema v1 berisi data (akun mdk, status lama, relasi FK). */
function buatDbV1(): string {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kas-migrasi-'));
  const file = path.join(dir, 'v1.db');
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA foreign_keys = ON;');
  raw.exec(SKEMA_V1);
  raw.exec('PRAGMA user_version = 1');
  const w = new Date().toISOString();
  const tambahUser = raw.prepare(
    'INSERT INTO users (username, nama, role, password_hash, aktif, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
  );
  tambahUser.run('op', 'Operator', 'operator', 'x', w, w);
  tambahUser.run('mdk', 'Petugas MDK', 'mdk', 'x', w, w);
  tambahUser.run('admin', 'Admin', 'admin', 'x', w, w);
  raw.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, 2, ?, ?)').run('t', w, w);
  raw.prepare('INSERT INTO pegawai (nama, aktif, created_at, updated_at) VALUES (?, 1, ?, ?)').run('Pegawai', w, w);
  const tambahP = raw.prepare(
    `INSERT INTO pengajuan (kode, kategori, nama_kegiatan, tanggal_kegiatan, jumlah_orang, mekanisme, uang_siapa_id, total,
       status, catatan_mdk, no_invoice_mdk, created_by, diproses_by, created_at, updated_at)
     VALUES (?, 'konsumsi', 'Rapat', '2026-01-01', 5, 'KO', 1, 1000, ?, ?, ?, 1, ?, ?, ?)`,
  );
  tambahP.run('KSM-2026-0001', 'draft', null, null, null, w, w);
  tambahP.run('KSM-2026-0002', 'diajukan', null, null, null, w, w);
  tambahP.run('KSM-2026-0003', 'dikembalikan', 'Lengkapi notulen', null, 2, w, w);
  tambahP.run('KSM-2026-0004', 'selesai', 'OK', 'INV-1', 2, w, w);
  raw
    .prepare(
      `INSERT INTO berkas (pengajuan_id, jenis, nama_asli, nama_file, mime, ukuran, uploaded_by, created_at)
       VALUES (2, 'notulen', 'n.pdf', 'n.pdf', 'application/pdf', 10, 1, ?)`,
    )
    .run(w);
  raw.prepare(`INSERT INTO riwayat (pengajuan_id, kode, user_id, aksi, created_at) VALUES (2, 'KSM-2026-0002', 1, 'diajukan', ?)`).run(w);
  // id yang pernah dipakai lalu dihapus → urutan AUTOINCREMENT harus dipertahankan
  tambahP.run('X', 'draft', null, null, null, w, w);
  raw.prepare(`DELETE FROM pengajuan WHERE kode = 'X'`).run();
  raw.close();
  return file;
}

describe('Migrasi skema v1 → v2 (alur PUM)', () => {
  it('memetakan peran & status, mempertahankan data/relasi, dan menegakkan constraint baru', () => {
    const file = buatDbV1();
    const db = new Db(file);
    try {
      expect(db.get<{ user_version: number }>('PRAGMA user_version')?.user_version).toBe(VERSI_SKEMA);
      expect(db.all('SELECT username, role FROM users ORDER BY id')).toEqual([
        { username: 'op', role: 'operator' },
        { username: 'mdk', role: 'pum' },
        { username: 'admin', role: 'admin' },
      ]);
      expect(db.all('SELECT kode, status, catatan_pum, no_invoice_mdk FROM pengajuan ORDER BY id')).toEqual([
        { kode: 'KSM-2026-0001', status: 'draft', catatan_pum: null, no_invoice_mdk: null },
        { kode: 'KSM-2026-0002', status: 'diajukan_pum', catatan_pum: null, no_invoice_mdk: null },
        { kode: 'KSM-2026-0003', status: 'dikembalikan', catatan_pum: 'Lengkapi notulen', no_invoice_mdk: null },
        { kode: 'KSM-2026-0004', status: 'selesai', catatan_pum: 'OK', no_invoice_mdk: 'INV-1' },
      ]);
      // Relasi & data anak tetap utuh (tidak ter-cascade saat tabel dibangun ulang)
      expect(db.get<{ c: number }>('SELECT COUNT(*) AS c FROM sessions')?.c).toBe(1);
      expect(db.get<{ c: number }>('SELECT COUNT(*) AS c FROM berkas')?.c).toBe(1);
      expect(db.get<{ c: number }>('SELECT COUNT(*) AS c FROM riwayat')?.c).toBe(1);
      expect(db.all('PRAGMA foreign_key_check')).toEqual([]);
      expect(db.get<{ foreign_keys: number }>('PRAGMA foreign_keys')?.foreign_keys).toBe(1);
      // Tabel & kolom baru
      expect(db.all(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('cek_berkas','notifikasi') ORDER BY name`)).toEqual([
        { name: 'cek_berkas' },
        { name: 'notifikasi' },
      ]);
      const kolom = db.all<{ name: string }>('PRAGMA table_info(pengajuan)').map((k) => k.name);
      expect(kolom).toEqual(expect.arrayContaining(['project_hosting', 'task_name', 'diteruskan_by', 'diteruskan_at', 'catatan_pum']));
      expect(kolom).not.toContain('catatan_mdk');
      // Constraint baru
      expect(() => db.run(`UPDATE pengajuan SET status = 'diajukan' WHERE id = 1`)).toThrow(/CHECK/);
      expect(() => db.run(`UPDATE users SET role = 'mdk' WHERE id = 1`)).toThrow(/CHECK/);
      expect(() => db.run('DELETE FROM users WHERE id = 1')).toThrow(/FOREIGN KEY/);
      // Urutan AUTOINCREMENT dipertahankan (id yang dihapus tidak dipakai ulang)
      const baru = db.run(
        `INSERT INTO pengajuan (kode, kategori, nama_kegiatan, tanggal_kegiatan, jumlah_orang, mekanisme, total, status,
           created_by, created_at, updated_at) VALUES ('Y', 'konsumsi', 'Baru', '2026-01-01', 1, 'KO', 1, 'draft', 1, ?, ?)`,
        new Date().toISOString(),
        new Date().toISOString(),
      );
      expect(baru.lastInsertRowid).toBe(6);
    } finally {
      db.close();
    }
    // Membuka ulang tidak menjalankan migrasi lagi
    const db2 = new Db(file);
    expect(db2.get<{ c: number }>('SELECT COUNT(*) AS c FROM pengajuan')?.c).toBe(5);
    db2.close();
  });

  it('database baru langsung berada di versi terbaru', () => {
    const db = new Db(':memory:');
    expect(db.get<{ user_version: number }>('PRAGMA user_version')?.user_version).toBe(VERSI_SKEMA);
    db.close();
  });
});
