import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../../server/app';
import { hashPassword } from '../../server/auth';
import type { AppConfig } from '../../server/config';
import { Db, nowIso } from '../../server/db';
import { AKUN_DEMO, seedDemo } from '../../server/seed';

export const PASSWORD: Record<string, string> = Object.fromEntries(AKUN_DEMO.map((a) => [a.username, a.password]));

export interface Konteks {
  db: Db;
  app: ReturnType<typeof createApp>;
  cfg: AppConfig;
  pegawai: number[];
  tutup: () => void;
}

/** App + DB in-memory terisolasi. `demo: true` → data demo lengkap; selain itu 3 akun + 5 pegawai. */
export function buatKonteks(opsi: { demo?: boolean } = {}): Konteks {
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kas-test-'));
  const db = new Db(':memory:');
  const cfg: AppConfig = {
    port: 0,
    dbPath: ':memory:',
    uploadDir,
    distDir: path.join(uploadDir, '__tidak_ada_dist__'),
    cookieSecure: false,
    sessionDays: 7,
    seed: 'demo',
  };
  const pegawai: number[] = [];
  if (opsi.demo) {
    // Tanggal acuan tetap (6 Okt tahun berjalan) agar data tahun berjalan selalu lengkap kapan pun test dijalankan.
    seedDemo(db, uploadDir, new Date(new Date().getFullYear(), 9, 6, 12, 0, 0));
    pegawai.push(...db.all<{ id: number }>('SELECT id FROM pegawai WHERE aktif = 1 ORDER BY id').map((r) => r.id));
  } else {
    const w = nowIso();
    for (const a of AKUN_DEMO) {
      db.run(
        'INSERT INTO users (username, nama, role, password_hash, aktif, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
        a.username,
        a.nama,
        a.role,
        hashPassword(a.password),
        w,
        w,
      );
    }
    for (const nama of ['Ahmad Fauzan', 'Rizky Pratama', 'Nurul Hidayah', 'Bambang Sutrisno', 'Fitri Handayani']) {
      pegawai.push(
        db.run('INSERT INTO pegawai (nama, aktif, created_at, updated_at) VALUES (?, 1, ?, ?)', nama, w, w).lastInsertRowid,
      );
    }
  }
  const app = createApp({ db, cfg });
  return {
    db,
    app,
    cfg,
    pegawai,
    tutup: () => {
      db.close();
      fs.rmSync(uploadDir, { recursive: true, force: true });
    },
  };
}

export type Agent = ReturnType<typeof request.agent>;

export async function masuk(ctx: Konteks, username: 'admin' | 'operator' | 'pum' | 'pimpinan'): Promise<Agent> {
  const agent = request.agent(ctx.app);
  const res = await agent.post('/api/auth/login').send({ username, password: PASSWORD[username] });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return agent;
}

export const TAHUN_INI = new Date().getFullYear();

export function dataKonsumsi(uangSiapaId: number, ubah: Record<string, unknown> = {}) {
  return {
    kategori: 'konsumsi',
    nama_kegiatan: 'Rapat Koordinasi Pengadaan',
    tanggal_kegiatan: `${TAHUN_INI}-03-10`,
    jumlah_orang: 12,
    total: 1_250_000,
    uang_siapa_id: uangSiapaId,
    mekanisme: 'KO',
    catatan: 'Snack dan makan siang',
    ...ubah,
  };
}

export function dataRumahTangga(peserta: { pegawai_id: number; nilai: number }[], ubah: Record<string, unknown> = {}) {
  return {
    kategori: 'rumah_tangga',
    nama_kegiatan: 'Pengantaran Dokumen ke Rektorat',
    tanggal_kegiatan: `${TAHUN_INI}-04-02`,
    lokasi_tujuan: 'Gedung Rektorat UI, Depok',
    mekanisme: 'LS',
    peserta,
    ...ubah,
  };
}

export function dataPerjadin(peserta: { pegawai_id: number; nilai: number }[], ubah: Record<string, unknown> = {}) {
  return {
    kategori: 'perjadin',
    nama_kegiatan: 'Bimbingan Teknis Pengadaan',
    tanggal_kegiatan: `${TAHUN_INI}-05-12`,
    tanggal_selesai: `${TAHUN_INI}-05-14`,
    lokasi_tujuan: 'Bandung',
    mekanisme: 'KO',
    jenis_uang: 'uang_harian',
    jenis_transport: 'luar_kota',
    peserta,
    ...ubah,
  };
}

/** Isi file minimal yang valid per ekstensi (sesuai pemeriksaan tanda tangan byte di server). */
export const FILE_CONTOH = {
  pdf: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1'),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]),
  jpg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]),
  docx: Buffer.from([0x50, 0x4b, 0x03, 0x04, 20, 0, 6, 0, 8, 0, 0, 0]),
};

export function jumlahFileUpload(ctx: Konteks): number {
  return fs.readdirSync(ctx.cfg.uploadDir).length;
}
