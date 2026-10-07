import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { expect } from 'vitest';
import type { Role } from '../../shared/constants';
import { createApp } from '../../server/app';
import type { AppConfig } from '../../server/config';
import { buatDb, nowIso, type Db } from '../../server/db-pg';
import { AuthPalsu, StoragePalsu } from '../support/palsu';
import { buatDatabaseTest } from '../support/pg';
import { AKUN_DEMO, seedDemo } from '../support/seed-demo';

export const EMAIL = Object.fromEntries(AKUN_DEMO.map((a) => [a.role, a.username])) as Record<Role, string>;
export const PASSWORD = Object.fromEntries(AKUN_DEMO.map((a) => [a.role, a.password])) as Record<Role, string>;

export interface Konteks {
  db: Db;
  app: ReturnType<typeof createApp>;
  cfg: AppConfig;
  auth: AuthPalsu;
  storage: StoragePalsu;
  pegawai: number[];
  tutup: () => Promise<void>;
}

/** Satu database PostgreSQL per file test (dibuat dari template), dikosongkan setiap buatKonteks(). */
let urlDb: string | null = null;

const TABEL_APLIKASI = [
  'notifikasi',
  'cek_berkas',
  'riwayat',
  'berkas',
  'pengajuan_peserta',
  'pengajuan',
  'kode_counter',
  'sessions',
  'pegawai',
  'users',
];

/** App + DB bersih. `demo: true` → data demo lengkap; selain itu 4 akun + 5 pegawai. */
export async function buatKonteks(opsi: { demo?: boolean } = {}): Promise<Konteks> {
  urlDb ??= await buatDatabaseTest();
  const db = buatDb(urlDb, false);
  await db.exec(`TRUNCATE ${TABEL_APLIKASI.join(', ')}, auth.users RESTART IDENTITY CASCADE`);
  const auth = new AuthPalsu(db);
  const storage = new StoragePalsu();
  const cfg: AppConfig = {
    port: 0,
    distDir: path.join(os.tmpdir(), '__kas_tidak_ada_dist__'),
    cookieSecure: false,
    sessionDays: 7,
    storageBucket: 'berkas',
  };
  const pegawai: number[] = [];
  if (opsi.demo) {
    // Tanggal acuan tetap (6 Okt tahun berjalan) agar data tahun berjalan selalu lengkap kapan pun test dijalankan.
    await seedDemo(db, (key, isi) => storage.taruh(key, isi), new Date(new Date().getFullYear(), 9, 6, 12, 0, 0));
    const rows = await db.all<{ id: number }>('SELECT id FROM pegawai WHERE aktif = true ORDER BY id');
    pegawai.push(...rows.map((r) => r.id));
  } else {
    const w = nowIso();
    for (const a of AKUN_DEMO) {
      const akun = await auth.buat(a.username, a.password);
      await db.run(
        'INSERT INTO users (auth_id, username, nama, role, aktif, created_at, updated_at) VALUES (?, ?, ?, ?, true, ?, ?)',
        akun.id,
        a.username,
        a.nama,
        a.role,
        w,
        w,
      );
    }
    for (const nama of ['Ahmad Fauzan', 'Rizky Pratama', 'Nurul Hidayah', 'Bambang Sutrisno', 'Fitri Handayani']) {
      const { lastInsertRowid } = await db.run(
        'INSERT INTO pegawai (nama, aktif, created_at, updated_at) VALUES (?, true, ?, ?) RETURNING id',
        nama,
        w,
        w,
      );
      pegawai.push(lastInsertRowid);
    }
  }
  const app = createApp({ db, cfg, auth, storage });
  return { db, app, cfg, auth, storage, pegawai, tutup: () => db.tutup() };
}

export type Agent = ReturnType<typeof request.agent>;

export async function masuk(ctx: Konteks, peran: Role): Promise<Agent> {
  const agent = request.agent(ctx.app);
  const res = await agent.post('/api/auth/login').send({ username: EMAIL[peran], password: PASSWORD[peran] });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return agent;
}

/**
 * Unggah berkas seperti browser: siapkan → PUT ke storage (ditiru) → konfirmasi.
 * Mengembalikan respons langkah yang gagal, atau respons konfirmasi bila semuanya berhasil.
 */
export async function unggah(
  ctx: Konteks,
  agent: Agent,
  pengajuanId: number,
  jenis: string,
  file: Buffer,
  nama: string,
  namaBerkas?: string,
) {
  const siap = await agent
    .post(`/api/pengajuan/${pengajuanId}/berkas/siapkan`)
    .send({ jenis, nama_berkas: namaBerkas, nama_asli: nama, ukuran: file.length });
  if (siap.status !== 200) return siap;
  ctx.storage.taruh(siap.body.key as string, file);
  return agent
    .post(`/api/pengajuan/${pengajuanId}/berkas/konfirmasi`)
    .send({ key: siap.body.key, jenis, nama_berkas: namaBerkas, nama_asli: nama });
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
    jenis_konsumsi: 'kudapan_makan_siang',
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

export function jumlahObjekStorage(ctx: Konteks): number {
  return ctx.storage.objek.size;
}
