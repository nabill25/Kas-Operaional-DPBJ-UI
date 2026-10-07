// Logika inti pengajuan: query, simpan, alur status (PUM), centang berkas, riwayat, notifikasi.
// Semua aturan bisnis mengacu ke CLAUDE.md §3–§5.
// === ASYNC VERSION untuk Supabase/PostgreSQL ===
import {
  BERKAS_WAJIB,
  JENIS_BERKAS_LABEL,
  KATEGORI_INFO,
  KATEGORI_LIST,
  MEKANISME_LIST,
  ROLE_LIHAT_DRAFT,
  ROLE_PENGAJU,
  ROLE_PUM,
  STATUS_LIST,
  type AksiRiwayat,
  type JenisBerkas,
  type JenisNotifikasi,
  type Kategori,
  type Mekanisme,
  type Role,
  type Status,
} from '../../shared/constants';
import { formatRupiah } from '../../shared/format';
import { hitungKelengkapan, parseBerkasNa } from '../../shared/kelengkapan';
import type {
  Berkas,
  CekBerkas,
  Paged,
  PengajuanDetail,
  PengajuanRingkas,
  Peserta,
  Riwayat,
  SaranPum,
} from '../../shared/types';
import {
  isTanggalValid,
  type CekBerkasBersih,
  type DataPumBersih,
  type InvoiceBersih,
  type PengajuanBersih,
  type TeruskanBersih,
} from '../../shared/validation';
import { nowIso, type Db, type SqlParam } from '../db-pg';
import { badRequest, conflict, forbidden, notFound } from '../http';
import type { StorageProvider } from '../providers';
import type { SessionUser } from '../types';

// ───────────────────────────── Hak akses ─────────────────────────────

export const STATUS_BISA_EDIT: readonly Status[] = ['draft', 'dikembalikan'];

export function bolehKelola(user: SessionUser): boolean {
  return ROLE_PENGAJU.includes(user.role);
}

export function bolehProsesPum(user: SessionUser): boolean {
  return ROLE_PUM.includes(user.role);
}

export function bolehLihat(user: SessionUser, status: Status): boolean {
  return status !== 'draft' || ROLE_LIHAT_DRAFT.includes(user.role);
}

// ───────────────────────────── Tipe baris DB ─────────────────────────────

export interface PengajuanRow {
  id: number;
  kode: string;
  kategori: Kategori;
  nama_kegiatan: string;
  tanggal_kegiatan: string;
  tanggal_selesai: string | null;
  jumlah_orang: number;
  lokasi_tujuan: string | null;
  mekanisme: Mekanisme;
  jenis_uang: PengajuanRingkas['jenis_uang'];
  jenis_transport: PengajuanRingkas['jenis_transport'];
  uang_siapa_id: number | null;
  uang_siapa_nama: string | null;
  total: number;
  catatan: string | null;
  berkas_na: string;
  berkas_terpenuhi: number;
  berkas_wajib: number;
  berkas_sesuai: number;
  status: Status;
  no_invoice_mdk: string | null;
  tanggal_invoice_mdk: string | null;
  catatan_pum: string | null;
  project_hosting: string | null;
  task_name: string | null;
  created_by: number;
  created_by_nama: string;
  updated_by_nama: string | null;
  diajukan_at: string | null;
  diteruskan_by: number | null;
  diteruskan_by_nama: string | null;
  diteruskan_at: string | null;
  diproses_by: number | null;
  diproses_by_nama: string | null;
  diproses_at: string | null;
  created_at: string;
  updated_at: string;
}

export const SELECT_PENGAJUAN = `
  SELECT p.*,
         us.nama AS uang_siapa_nama,
         cb.nama AS created_by_nama,
         ub.nama AS updated_by_nama,
         dt.nama AS diteruskan_by_nama,
         dp.nama AS diproses_by_nama,
         (SELECT COUNT(*) FROM cek_berkas ck WHERE ck.pengajuan_id = p.id AND ck.status = 'sesuai')::int AS berkas_sesuai,
         CAST(p.berkas_na AS TEXT) AS berkas_na
    FROM pengajuan p
    LEFT JOIN pegawai us ON us.id = p.uang_siapa_id
    LEFT JOIN users cb ON cb.id = p.created_by
    LEFT JOIN users ub ON ub.id = p.updated_by
    LEFT JOIN users dt ON dt.id = p.diteruskan_by
    LEFT JOIN users dp ON dp.id = p.diproses_by`;

function keRingkas(row: PengajuanRow, pesertaNama: string[]): PengajuanRingkas {
  const penerima = row.kategori === 'konsumsi' ? (row.uang_siapa_nama ?? '-') : pesertaNama.join(', ') || '-';
  // Normalize tanggal dari PostgreSQL (bisa jadi Date object)
  const normTgl = (v: unknown): string | null => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().split('T')[0];
    return String(v);
  };
  const normTs = (v: unknown): string | null => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString();
    return String(v);
  };
  return {
    id: Number(row.id),
    kode: row.kode,
    kategori: row.kategori,
    nama_kegiatan: row.nama_kegiatan,
    tanggal_kegiatan: normTgl(row.tanggal_kegiatan)!,
    tanggal_selesai: normTgl(row.tanggal_selesai),
    jumlah_orang: Number(row.jumlah_orang),
    lokasi_tujuan: row.lokasi_tujuan,
    mekanisme: row.mekanisme,
    jenis_uang: row.jenis_uang,
    jenis_transport: row.jenis_transport,
    uang_siapa_id: row.uang_siapa_id ? Number(row.uang_siapa_id) : null,
    uang_siapa_nama: row.uang_siapa_nama,
    penerima,
    total: Number(row.total),
    status: row.status,
    no_invoice_mdk: row.no_invoice_mdk,
    tanggal_invoice_mdk: normTgl(row.tanggal_invoice_mdk),
    project_hosting: row.project_hosting,
    task_name: row.task_name,
    berkas_terpenuhi: Number(row.berkas_terpenuhi),
    berkas_wajib: Number(row.berkas_wajib),
    berkas_sesuai: Number(row.berkas_sesuai ?? 0),
    created_by: Number(row.created_by),
    created_by_nama: row.created_by_nama ?? '-',
    created_at: normTs(row.created_at)!,
    updated_at: normTs(row.updated_at)!,
    diajukan_at: normTs(row.diajukan_at),
    diteruskan_at: normTs(row.diteruskan_at),
    diproses_at: normTs(row.diproses_at),
  };
}

async function namaPesertaMap(db: Db, ids: number[]): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (ids.length === 0) return map;
  for (let i = 0; i < ids.length; i += 500) {
    const potong = ids.slice(i, i + 500);
    const rows = await db.all<{ pengajuan_id: number; nama: string }>(
      `SELECT ps.pengajuan_id, pg.nama
         FROM pengajuan_peserta ps JOIN pegawai pg ON pg.id = ps.pegawai_id
        WHERE ps.pengajuan_id IN (${potong.map(() => '?').join(',')})
        ORDER BY ps.pengajuan_id, ps.urutan`,
      ...potong,
    );
    for (const r of rows) {
      const arr = map.get(Number(r.pengajuan_id)) ?? [];
      arr.push(r.nama);
      map.set(Number(r.pengajuan_id), arr);
    }
  }
  return map;
}

export async function rowsKeRingkas(db: Db, rows: PengajuanRow[]): Promise<PengajuanRingkas[]> {
  const peserta = await namaPesertaMap(
    db,
    rows.filter((r) => r.kategori !== 'konsumsi').map((r) => Number(r.id)),
  );
  return rows.map((r) => keRingkas(r, peserta.get(Number(r.id)) ?? []));
}

// ───────────────────────────── Filter daftar ─────────────────────────────

export interface FilterPengajuan {
  kategori?: string;
  status?: string;
  mekanisme?: string;
  q?: string;
  dari?: string;
  sampai?: string;
  tahun?: string;
  pegawai_id?: string;
  kelengkapan?: string;
  sort?: string;
  page?: string;
  limit?: string;
}

export function bangunWhere(user: SessionUser, f: FilterPengajuan): { where: string; params: SqlParam[] } {
  const kondisi: string[] = [];
  const params: SqlParam[] = [];

  if (!ROLE_LIHAT_DRAFT.includes(user.role)) kondisi.push(`p.status <> 'draft'`);

  if (f.kategori === 'transport') {
    kondisi.push(`p.kategori IN ('rumah_tangga','perjadin')`);
  } else if (f.kategori && (KATEGORI_LIST as readonly string[]).includes(f.kategori)) {
    kondisi.push('p.kategori = ?');
    params.push(f.kategori);
  }

  if (f.status && f.status !== 'semua') {
    const daftar = f.status.split(',').filter((s) => (STATUS_LIST as readonly string[]).includes(s));
    if (daftar.length > 0) {
      kondisi.push(`p.status = ANY(?)`);
      params.push(daftar);
    }
  } else if (f.status === 'semua') {
    kondisi.push(`p.status <> 'draft'`);
  }

  if (f.mekanisme && (MEKANISME_LIST as readonly string[]).includes(f.mekanisme)) {
    kondisi.push('p.mekanisme = ?');
    params.push(f.mekanisme);
  }

  if (f.dari && isTanggalValid(f.dari)) {
    kondisi.push('p.tanggal_kegiatan >= ?');
    params.push(f.dari);
  }
  if (f.sampai && isTanggalValid(f.sampai)) {
    kondisi.push('p.tanggal_kegiatan <= ?');
    params.push(f.sampai);
  }
  if (f.tahun && /^\d{4}$/.test(f.tahun)) {
    kondisi.push("EXTRACT(YEAR FROM p.tanggal_kegiatan) = ?");
    params.push(Number(f.tahun));
  }

  const pegawaiId = Number(f.pegawai_id);
  if (f.pegawai_id && Number.isSafeInteger(pegawaiId) && pegawaiId > 0) {
    kondisi.push(
      `(p.uang_siapa_id = ? OR EXISTS (SELECT 1 FROM pengajuan_peserta x WHERE x.pengajuan_id = p.id AND x.pegawai_id = ?))`,
    );
    params.push(pegawaiId, pegawaiId);
  }

  if (f.kelengkapan === 'belum_lengkap') kondisi.push('p.berkas_terpenuhi < p.berkas_wajib');
  else if (f.kelengkapan === 'lengkap') kondisi.push('p.berkas_terpenuhi >= p.berkas_wajib');

  const kata = (f.q ?? '').trim();
  if (kata) {
    const like = `%${kata.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    kondisi.push(`(
      p.kode ILIKE ? OR p.nama_kegiatan ILIKE ? OR p.lokasi_tujuan ILIKE ?
      OR p.no_invoice_mdk ILIKE ? OR p.project_hosting ILIKE ? OR p.task_name ILIKE ?
      OR EXISTS (SELECT 1 FROM pegawai g WHERE g.id = p.uang_siapa_id AND g.nama ILIKE ?)
      OR EXISTS (SELECT 1 FROM pengajuan_peserta x JOIN pegawai g ON g.id = x.pegawai_id
                 WHERE x.pengajuan_id = p.id AND g.nama ILIKE ?)
    )`);
    params.push(like, like, like, like, like, like, like, like);
  }

  return { where: kondisi.length ? `WHERE ${kondisi.join(' AND ')}` : '', params };
}

const URUTAN: Record<string, string> = {
  terbaru: 'p.tanggal_kegiatan DESC, p.id DESC',
  terlama: 'p.tanggal_kegiatan ASC, p.id ASC',
  nilai_tertinggi: 'p.total DESC, p.id DESC',
  nilai_terendah: 'p.total ASC, p.id ASC',
  antrian: 'p.diajukan_at ASC, p.id ASC',
  antrian_mdk: 'p.diteruskan_at ASC, p.id ASC',
  diperbarui: 'p.updated_at DESC, p.id DESC',
};

export async function listPengajuan(db: Db, user: SessionUser, f: FilterPengajuan): Promise<Paged<PengajuanRingkas>> {
  const { where, params } = bangunWhere(user, f);
  const limit = Math.min(Math.max(Number(f.limit) || 20, 1), 100);
  const page = Math.max(Number(f.page) || 1, 1);
  const order = URUTAN[f.sort ?? ''] ?? URUTAN.terbaru;

  const agg = await db.get<{ jumlah: number; nilai: number | null }>(
    `SELECT COUNT(*)::int AS jumlah, SUM(p.total) AS nilai FROM pengajuan p ${where}`,
    ...params,
  ) ?? { jumlah: 0, nilai: 0 };

  const rows = await db.all<PengajuanRow>(
    `${SELECT_PENGAJUAN} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...params,
    limit,
    (page - 1) * limit,
  );
  return { data: await rowsKeRingkas(db, rows), total: Number(agg.jumlah), page, limit, nilai: Number(agg.nilai ?? 0) };
}

export async function semuaPengajuan(db: Db, user: SessionUser, f: FilterPengajuan): Promise<PengajuanRingkas[]> {
  const { where, params } = bangunWhere(user, f);
  const rows = await db.all<PengajuanRow>(
    `${SELECT_PENGAJUAN} ${where} ORDER BY p.tanggal_kegiatan ASC, p.id ASC`,
    ...params,
  );
  return rowsKeRingkas(db, rows);
}

// ───────────────────────────── Detail ─────────────────────────────

async function ambilRow(db: Db, id: number): Promise<PengajuanRow | undefined> {
  return db.get<PengajuanRow>(`${SELECT_PENGAJUAN} WHERE p.id = ?`, id);
}

export async function ambilPengajuan(db: Db, user: SessionUser, id: number): Promise<PengajuanRow> {
  const row = await ambilRow(db, id);
  if (!row || !bolehLihat(user, row.status)) throw notFound('Pengajuan tidak ditemukan');
  return row;
}

export async function getPeserta(db: Db, pengajuanId: number): Promise<Peserta[]> {
  return db.all<Peserta>(
    `SELECT ps.id, ps.pegawai_id, pg.nama, pg.nip, pg.jabatan, ps.nilai::bigint AS nilai, ps.urutan
       FROM pengajuan_peserta ps JOIN pegawai pg ON pg.id = ps.pegawai_id
      WHERE ps.pengajuan_id = ? ORDER BY ps.urutan`,
    pengajuanId,
  );
}

export async function getBerkasList(db: Db, pengajuanId: number): Promise<Berkas[]> {
  return db.all<Berkas>(
    `SELECT b.id, b.pengajuan_id, b.jenis, b.nama_berkas, b.nama_asli, b.mime, b.ukuran::bigint AS ukuran,
            b.uploaded_by, COALESCE(u.nama, '-') AS uploaded_by_nama, b.created_at
       FROM berkas b LEFT JOIN users u ON u.id = b.uploaded_by
      WHERE b.pengajuan_id = ? ORDER BY b.id`,
    pengajuanId,
  );
}

export async function getCekBerkas(db: Db, pengajuanId: number): Promise<CekBerkas[]> {
  return db.all<CekBerkas>(
    `SELECT c.jenis, c.status, c.catatan, c.diperiksa_by, COALESCE(u.nama, '-') AS diperiksa_by_nama, c.diperiksa_at
       FROM cek_berkas c LEFT JOIN users u ON u.id = c.diperiksa_by
      WHERE c.pengajuan_id = ?`,
    pengajuanId,
  );
}

export async function getRiwayat(db: Db, pengajuanId: number): Promise<Riwayat[]> {
  return db.all<Riwayat>(
    `SELECT r.id, r.pengajuan_id, r.kode, r.user_id, u.nama AS user_nama, r.aksi, r.keterangan, r.created_at
       FROM riwayat r LEFT JOIN users u ON u.id = r.user_id
      WHERE r.pengajuan_id = ? ORDER BY r.created_at DESC, r.id DESC`,
    pengajuanId,
  );
}

export async function getDetail(db: Db, user: SessionUser, id: number): Promise<PengajuanDetail> {
  const row = await ambilPengajuan(db, user, id);
  const peserta = await getPeserta(db, id);
  const berkas = await getBerkasList(db, id);
  const berkasNa = parseBerkasNa(typeof row.berkas_na === 'string' ? row.berkas_na : JSON.stringify(row.berkas_na));
  const cekList = await getCekBerkas(db, id);
  return {
    ...keRingkas(row, peserta.map((p) => p.nama)),
    catatan: row.catatan,
    catatan_pum: row.catatan_pum,
    berkas_na: berkasNa,
    peserta,
    berkas,
    riwayat: await getRiwayat(db, id),
    kelengkapan: hitungKelengkapan(row.kategori, berkas, berkasNa, cekList),
    updated_by_nama: row.updated_by_nama,
    diteruskan_by: row.diteruskan_by ? Number(row.diteruskan_by) : null,
    diteruskan_by_nama: row.diteruskan_by_nama,
    diproses_by: row.diproses_by ? Number(row.diproses_by) : null,
    diproses_by_nama: row.diproses_by_nama,
  };
}

export async function saranPum(db: Db): Promise<SaranPum> {
  const ambil = async (kolom: 'project_hosting' | 'task_name') =>
    (await db.all<{ v: string }>(
      `SELECT ${kolom} AS v FROM pengajuan WHERE ${kolom} IS NOT NULL AND ${kolom} <> ''
        GROUP BY ${kolom} ORDER BY MAX(updated_at) DESC LIMIT 30`,
    )).map((r) => r.v);
  return { project_hosting: await ambil('project_hosting'), task_name: await ambil('task_name') };
}

// ───────────────────────────── Riwayat, notifikasi & util ─────────────────────────────

export async function catatRiwayat(
  db: Db,
  p: { id: number | null; kode: string },
  userId: number | null,
  aksi: AksiRiwayat,
  keterangan: string | null = null,
  waktu: string = nowIso(),
): Promise<void> {
  await db.run(
    'INSERT INTO riwayat (pengajuan_id, kode, user_id, aksi, keterangan, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    p.id,
    p.kode,
    userId,
    aksi,
    keterangan,
    waktu,
  );
}

export async function idPenggunaAktif(db: Db, peran: readonly Role[]): Promise<number[]> {
  if (peran.length === 0) return [];
  return (await db.all<{ id: number }>(
    `SELECT id FROM users WHERE aktif = true AND role = ANY(?) ORDER BY id`,
    peran,
  )).map((r) => Number(r.id));
}

export async function kirimNotifikasi(
  db: Db,
  penerima: number[],
  pelakuId: number | null,
  n: { pengajuan_id: number | null; kode: string; jenis: JenisNotifikasi; judul: string; pesan: string },
  waktu: string = nowIso(),
): Promise<void> {
  for (const userId of new Set(penerima)) {
    if (userId === pelakuId) continue;
    await db.run(
      `INSERT INTO notifikasi (user_id, pengajuan_id, kode, jenis, judul, pesan, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      userId,
      n.pengajuan_id,
      n.kode,
      n.jenis,
      n.judul,
      n.pesan,
      waktu,
    );
  }
}

async function penerimaPengaju(db: Db, row: PengajuanRow): Promise<number[]> {
  const user = await db.get<{ aktif: boolean }>('SELECT aktif FROM users WHERE id = ?', row.created_by);
  const aktif = user?.aktif === true;
  return aktif ? [Number(row.created_by)] : idPenggunaAktif(db, ['operator']);
}

async function penerimaPum(db: Db): Promise<number[]> {
  const pum = await idPenggunaAktif(db, ['pum']);
  return pum.length > 0 ? pum : idPenggunaAktif(db, ['admin']);
}

export async function segarkanKelengkapan(db: Db, pengajuanId: number): Promise<void> {
  const row = await db.get<{ kategori: Kategori; berkas_na: unknown }>(
    'SELECT kategori, CAST(berkas_na AS TEXT) AS berkas_na FROM pengajuan WHERE id = ?',
    pengajuanId,
  );
  if (!row) return;
  const berkas = await db.all<{ jenis: string }>('SELECT jenis FROM berkas WHERE pengajuan_id = ?', pengajuanId);
  const berkasNaStr = typeof row.berkas_na === 'string' ? row.berkas_na : JSON.stringify(row.berkas_na);
  const k = hitungKelengkapan(row.kategori, berkas, parseBerkasNa(berkasNaStr));
  await db.run(
    'UPDATE pengajuan SET berkas_terpenuhi = ?, berkas_wajib = ? WHERE id = ?',
    k.terpenuhi,
    k.total,
    pengajuanId,
  );
}

export async function kodeBerikutnya(db: Db, kategori: Kategori, tahun: number): Promise<string> {
  const prefix = KATEGORI_INFO[kategori].prefix;
  await db.run(
    `INSERT INTO kode_counter (prefix, tahun, terakhir) VALUES (?, ?, 1)
     ON CONFLICT (prefix, tahun) DO UPDATE SET terakhir = kode_counter.terakhir + 1`,
    prefix,
    tahun,
  );
  const row = await db.get<{ terakhir: number }>(
    'SELECT terakhir FROM kode_counter WHERE prefix = ? AND tahun = ?',
    prefix,
    tahun,
  );
  return `${prefix}-${tahun}-${String(row!.terakhir).padStart(4, '0')}`;
}

async function cekPegawai(db: Db, data: PengajuanBersih, sebelumnya: Set<number>): Promise<void> {
  const errors: Record<string, string> = {};
  const cek = async (id: number, key: string) => {
    const pg = await db.get<{ aktif: boolean }>('SELECT aktif FROM pegawai WHERE id = ?', id);
    if (!pg) errors[key] = 'Pegawai tidak ditemukan';
    else if (!pg.aktif && !sebelumnya.has(id)) errors[key] = 'Pegawai sudah nonaktif';
  };
  if (data.kategori === 'konsumsi' && data.uang_siapa_id !== null) await cek(data.uang_siapa_id, 'uang_siapa_id');
  for (let i = 0; i < data.peserta.length; i++) {
    await cek(data.peserta[i].pegawai_id, `peserta.${i}.pegawai_id`);
  }
  if (Object.keys(errors).length > 0) throw badRequest('Data belum valid, periksa kembali isian Anda', errors);
}

async function simpanPeserta(db: Db, pengajuanId: number, data: PengajuanBersih): Promise<void> {
  await db.run('DELETE FROM pengajuan_peserta WHERE pengajuan_id = ?', pengajuanId);
  for (let i = 0; i < data.peserta.length; i++) {
    const p = data.peserta[i];
    await db.run(
      'INSERT INTO pengajuan_peserta (pengajuan_id, pegawai_id, nilai, urutan) VALUES (?, ?, ?, ?)',
      pengajuanId,
      p.pegawai_id,
      p.nilai,
      i + 1,
    );
  }
}

// ───────────────────────────── Buat / ubah / hapus (pengaju) ─────────────────────────────

export async function buatPengajuan(db: Db, user: SessionUser, data: PengajuanBersih): Promise<number> {
  if (!bolehKelola(user)) throw forbidden('Hanya operator/pengaju atau admin yang dapat membuat pengajuan');
  return db.tx(async (txDb) => {
    await cekPegawai(txDb, data, new Set());
    const waktu = nowIso();
    const kode = await kodeBerikutnya(txDb, data.kategori, new Date().getFullYear());
    const { lastInsertRowid: id } = await txDb.run(
      `INSERT INTO pengajuan (kode, kategori, nama_kegiatan, tanggal_kegiatan, tanggal_selesai, jumlah_orang,
         lokasi_tujuan, mekanisme, jenis_uang, jenis_transport, uang_siapa_id, total, catatan,
         berkas_na, berkas_terpenuhi, berkas_wajib, status, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 0, ?, 'draft', ?, ?, ?, ?) RETURNING id`,
      kode,
      data.kategori,
      data.nama_kegiatan,
      data.tanggal_kegiatan,
      data.tanggal_selesai,
      data.jumlah_orang,
      data.lokasi_tujuan,
      data.mekanisme,
      data.jenis_uang,
      data.jenis_transport,
      data.uang_siapa_id,
      data.total,
      data.catatan,
      BERKAS_WAJIB[data.kategori].length,
      user.id,
      user.id,
      waktu,
      waktu,
    );
    await simpanPeserta(txDb, id, data);
    await catatRiwayat(txDb, { id, kode }, user.id, 'dibuat', `${KATEGORI_INFO[data.kategori].label} · ${formatRupiah(data.total)}`, waktu);
    return id;
  });
}

function pastikanBisaEdit(user: SessionUser, row: PengajuanRow): void {
  if (!bolehKelola(user)) throw forbidden('Hanya operator/pengaju atau admin yang dapat mengubah pengajuan');
  if (!STATUS_BISA_EDIT.includes(row.status)) {
    throw conflict(
      row.status === 'diajukan_pum'
        ? 'Pengajuan sedang diperiksa PUM sehingga tidak dapat diubah. Tarik kembali terlebih dahulu.'
        : row.status === 'diajukan_mdk'
          ? 'Pengajuan sudah diteruskan ke MDK sehingga tidak dapat diubah.'
          : 'Pengajuan yang sudah selesai tidak dapat diubah',
    );
  }
}

export async function ubahPengajuan(db: Db, user: SessionUser, id: number, data: PengajuanBersih): Promise<void> {
  await db.tx(async (txDb) => {
    const row = await ambilPengajuan(txDb, user, id);
    pastikanBisaEdit(user, row);
    if (data.kategori !== row.kategori) {
      throw badRequest('Kategori pengajuan tidak dapat diubah. Hapus draft lalu buat pengajuan baru.', {
        kategori: 'Kategori tidak dapat diubah',
      });
    }
    const sebelumnya = new Set<number>(
      (await txDb.all<{ pegawai_id: number }>('SELECT pegawai_id FROM pengajuan_peserta WHERE pengajuan_id = ?', id)).map(
        (r) => Number(r.pegawai_id),
      ),
    );
    if (row.uang_siapa_id !== null) sebelumnya.add(Number(row.uang_siapa_id));
    await cekPegawai(txDb, data, sebelumnya);

    const waktu = nowIso();
    await txDb.run(
      `UPDATE pengajuan SET nama_kegiatan = ?, tanggal_kegiatan = ?, tanggal_selesai = ?, jumlah_orang = ?,
         lokasi_tujuan = ?, mekanisme = ?, jenis_uang = ?, jenis_transport = ?, uang_siapa_id = ?, total = ?,
         catatan = ?, updated_by = ?, updated_at = ?
       WHERE id = ?`,
      data.nama_kegiatan,
      data.tanggal_kegiatan,
      data.tanggal_selesai,
      data.jumlah_orang,
      data.lokasi_tujuan,
      data.mekanisme,
      data.jenis_uang,
      data.jenis_transport,
      data.uang_siapa_id,
      data.total,
      data.catatan,
      user.id,
      waktu,
      id,
    );
    await simpanPeserta(txDb, id, data);
    const ket = Number(row.total) !== data.total ? `Nilai ${formatRupiah(Number(row.total))} → ${formatRupiah(data.total)}` : null;
    await catatRiwayat(txDb, row, user.id, 'diubah', ket, waktu);
  });
}

/** Hapus pengajuan beserta berkasnya di database. Mengembalikan kunci objek storage yang harus dihapus. */
export async function hapusPengajuan(db: Db, user: SessionUser, id: number): Promise<string[]> {
  const files = await db.tx(async (txDb) => {
    const row = await ambilPengajuan(txDb, user, id);
    pastikanBisaEdit(user, row);
    const daftar = await txDb.all<{ nama_file: string }>('SELECT nama_file FROM berkas WHERE pengajuan_id = ?', id);
    await catatRiwayat(txDb, row, user.id, 'dihapus', `${row.nama_kegiatan} · ${formatRupiah(Number(row.total))}`);
    await txDb.run('DELETE FROM pengajuan WHERE id = ?', id);
    return daftar;
  });
  return files.map((f) => f.nama_file);
}

// ───────────────────────────── Alur status ─────────────────────────────

export async function ajukan(db: Db, user: SessionUser, id: number): Promise<void> {
  await db.tx(async (txDb) => {
    const row = await ambilPengajuan(txDb, user, id);
    if (!bolehKelola(user)) throw forbidden('Hanya operator/pengaju atau admin yang dapat mengajukan');
    if (!STATUS_BISA_EDIT.includes(row.status)) {
      throw conflict('Hanya pengajuan berstatus Draft atau Dikembalikan yang dapat diajukan ke PUM');
    }
    const waktu = nowIso();
    await txDb.run(
      `UPDATE pengajuan SET status = 'diajukan_pum', diajukan_at = ?, diproses_by = NULL, diproses_at = NULL,
         updated_by = ?, updated_at = ? WHERE id = ?`,
      waktu,
      user.id,
      waktu,
      id,
    );
    const ulang = row.status === 'dikembalikan';
    const ket = `${ulang ? 'Diajukan ulang · ' : ''}Berkas ${Number(row.berkas_terpenuhi) < Number(row.berkas_wajib) ? 'belum lengkap' : 'lengkap'} (${row.berkas_terpenuhi}/${row.berkas_wajib})`;
    await catatRiwayat(txDb, row, user.id, 'diajukan', ket, waktu);
    await kirimNotifikasi(
      txDb,
      await penerimaPum(txDb),
      user.id,
      {
        pengajuan_id: id,
        kode: row.kode,
        jenis: 'diajukan',
        judul: ulang ? 'Pengajuan diajukan ulang' : 'Pengajuan baru menunggu pemeriksaan',
        pesan: `${row.nama_kegiatan} · ${formatRupiah(Number(row.total))} · oleh ${user.nama}`,
      },
      waktu,
    );
  });
}

export async function tarikKembali(db: Db, user: SessionUser, id: number): Promise<void> {
  await db.tx(async (txDb) => {
    const row = await ambilPengajuan(txDb, user, id);
    if (!bolehKelola(user)) throw forbidden('Hanya operator/pengaju atau admin yang dapat menarik pengajuan');
    if (row.status !== 'diajukan_pum') {
      throw conflict('Hanya pengajuan yang masih di PUM (belum diteruskan ke MDK) yang dapat ditarik kembali');
    }
    const waktu = nowIso();
    await txDb.run(
      `UPDATE pengajuan SET status = 'draft', diajukan_at = NULL, updated_by = ?, updated_at = ? WHERE id = ?`,
      user.id,
      waktu,
      id,
    );
    await catatRiwayat(txDb, row, user.id, 'ditarik', null, waktu);
  });
}

export async function cekBerkas(db: Db, user: SessionUser, id: number, data: CekBerkasBersih): Promise<void> {
  await db.tx(async (txDb) => {
    const row = await ambilPengajuan(txDb, user, id);
    if (!bolehProsesPum(user)) throw forbidden('Hanya PUM atau admin yang dapat memeriksa berkas');
    if (row.status !== 'diajukan_pum') {
      throw conflict('Berkas hanya dapat dicentang saat pengajuan berstatus Diajukan ke PUM');
    }
    if (!(BERKAS_WAJIB[row.kategori] as readonly string[]).includes(data.jenis)) {
      throw badRequest('Jenis berkas tidak termasuk berkas wajib kategori ini', { jenis: 'Jenis berkas tidak valid' });
    }
    const label = JENIS_BERKAS_LABEL[data.jenis as JenisBerkas];
    const lama = await txDb.get<{ status: string; catatan: string | null }>(
      'SELECT status, catatan FROM cek_berkas WHERE pengajuan_id = ? AND jenis = ?',
      id,
      data.jenis,
    );
    if (!data.status && !lama) return;
    if (lama && data.status === lama.status && (data.catatan ?? null) === (lama.catatan ?? null)) return;
    const waktu = nowIso();
    if (!data.status) {
      await txDb.run('DELETE FROM cek_berkas WHERE pengajuan_id = ? AND jenis = ?', id, data.jenis);
      await catatRiwayat(txDb, row, user.id, 'berkas_cek_batal', label, waktu);
    } else {
      await txDb.run(
        `INSERT INTO cek_berkas (pengajuan_id, jenis, status, catatan, diperiksa_by, diperiksa_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (pengajuan_id, jenis) DO UPDATE SET status = excluded.status, catatan = excluded.catatan,
           diperiksa_by = excluded.diperiksa_by, diperiksa_at = excluded.diperiksa_at`,
        id,
        data.jenis,
        data.status,
        data.catatan,
        user.id,
        waktu,
      );
      await catatRiwayat(
        txDb,
        row,
        user.id,
        data.status === 'sesuai' ? 'berkas_dicek' : 'berkas_revisi',
        data.status === 'sesuai' ? label : `${label}: ${data.catatan}`,
        waktu,
      );
    }
    await txDb.run('UPDATE pengajuan SET updated_by = ?, updated_at = ? WHERE id = ?', user.id, waktu, id);
  });
}

export async function kembalikan(db: Db, user: SessionUser, id: number, catatan: string): Promise<void> {
  await db.tx(async (txDb) => {
    const row = await ambilPengajuan(txDb, user, id);
    if (!bolehProsesPum(user)) throw forbidden('Hanya PUM atau admin yang dapat mengembalikan pengajuan');
    if (row.status !== 'diajukan_pum' && row.status !== 'diajukan_mdk') {
      throw conflict('Hanya pengajuan yang sedang diproses PUM/MDK yang dapat dikembalikan');
    }
    const waktu = nowIso();
    await txDb.run(
      `UPDATE pengajuan SET status = 'dikembalikan', catatan_pum = ?, diproses_by = ?, diproses_at = ?,
         updated_by = ?, updated_at = ? WHERE id = ?`,
      catatan,
      user.id,
      waktu,
      user.id,
      waktu,
      id,
    );
    const revisi = (await txDb.all<{ jenis: JenisBerkas; catatan: string | null }>(
      `SELECT jenis, catatan FROM cek_berkas WHERE pengajuan_id = ? AND status = 'revisi'`,
      id,
    )).map((r) => `${JENIS_BERKAS_LABEL[r.jenis]}${r.catatan ? ` (${r.catatan})` : ''}`);
    const rincian = revisi.length ? ` · Berkas perlu revisi: ${revisi.join('; ')}` : '';
    await catatRiwayat(txDb, row, user.id, 'dikembalikan', `${catatan}${rincian}`, waktu);
    await kirimNotifikasi(
      txDb,
      await penerimaPengaju(txDb, row),
      user.id,
      {
        pengajuan_id: id,
        kode: row.kode,
        jenis: 'dikembalikan',
        judul: 'Pengajuan dikembalikan PUM',
        pesan: `${catatan}${rincian}`,
      },
      waktu,
    );
  });
}

export async function teruskanMdk(db: Db, user: SessionUser, id: number, data: TeruskanBersih): Promise<void> {
  await db.tx(async (txDb) => {
    const row = await ambilPengajuan(txDb, user, id);
    if (!bolehProsesPum(user)) throw forbidden('Hanya PUM atau admin yang dapat meneruskan ke MDK');
    if (row.status !== 'diajukan_pum') {
      throw conflict('Hanya pengajuan berstatus Diajukan ke PUM yang dapat diteruskan ke MDK');
    }
    const berkasNaStr = typeof row.berkas_na === 'string' ? row.berkas_na : JSON.stringify(row.berkas_na);
    const k = hitungKelengkapan(
      row.kategori,
      await getBerkasList(txDb, id),
      parseBerkasNa(berkasNaStr),
      await getCekBerkas(txDb, id),
    );
    if (!k.semuaSesuai) {
      throw conflict(
        `Centang semua berkas wajib sebagai "sesuai" sebelum meneruskan ke MDK (baru ${k.sesuai}/${k.total}).`,
      );
    }
    const waktu = nowIso();
    await txDb.run(
      `UPDATE pengajuan SET status = 'diajukan_mdk', project_hosting = ?, task_name = ?, catatan_pum = ?,
         diteruskan_by = ?, diteruskan_at = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
      data.project_hosting,
      data.task_name,
      data.catatan,
      user.id,
      waktu,
      user.id,
      waktu,
      id,
    );
    const ket = [
      `Berkas ${k.sesuai}/${k.total} sesuai`,
      data.project_hosting ? `Project: ${data.project_hosting}` : null,
      data.task_name ? `Task: ${data.task_name}` : null,
    ].filter(Boolean).join(' · ');
    await catatRiwayat(txDb, row, user.id, 'diteruskan_mdk', ket, waktu);
    await kirimNotifikasi(
      txDb,
      await penerimaPengaju(txDb, row),
      user.id,
      {
        pengajuan_id: id,
        kode: row.kode,
        jenis: 'diteruskan_mdk',
        judul: 'Berkas disetujui PUM & diteruskan ke MDK',
        pesan: `${row.nama_kegiatan} · menunggu invoice MDK`,
      },
      waktu,
    );
  });
}

export async function ubahDataPum(db: Db, user: SessionUser, id: number, data: DataPumBersih): Promise<void> {
  await db.tx(async (txDb) => {
    const row = await ambilPengajuan(txDb, user, id);
    if (!bolehProsesPum(user)) throw forbidden('Hanya PUM atau admin yang dapat mengubah data PUM');
    if (row.status !== 'diajukan_pum' && row.status !== 'diajukan_mdk' && row.status !== 'selesai') {
      throw conflict('Data PUM hanya dapat diubah setelah pengajuan diajukan ke PUM');
    }
    if (row.project_hosting === data.project_hosting && row.task_name === data.task_name) return;
    const waktu = nowIso();
    await txDb.run(
      'UPDATE pengajuan SET project_hosting = ?, task_name = ?, updated_by = ?, updated_at = ? WHERE id = ?',
      data.project_hosting,
      data.task_name,
      user.id,
      waktu,
      id,
    );
    await catatRiwayat(
      txDb,
      row,
      user.id,
      'data_pum_diubah',
      `Project: ${data.project_hosting ?? '-'} · Task: ${data.task_name ?? '-'}`,
      waktu,
    );
  });
}

export async function selesaikan(db: Db, user: SessionUser, id: number, inv: InvoiceBersih): Promise<void> {
  await db.tx(async (txDb) => {
    const row = await ambilPengajuan(txDb, user, id);
    if (!bolehProsesPum(user)) throw forbidden('Hanya PUM atau admin yang dapat menginput invoice MDK');
    if (row.status !== 'diajukan_mdk') {
      throw conflict('Invoice MDK hanya dapat diinput untuk pengajuan berstatus Diajukan ke MDK');
    }
    const waktu = nowIso();
    await txDb.run(
      `UPDATE pengajuan SET status = 'selesai', no_invoice_mdk = ?, tanggal_invoice_mdk = ?, catatan_pum = ?,
         diproses_by = ?, diproses_at = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
      inv.no_invoice_mdk,
      inv.tanggal_invoice_mdk,
      inv.catatan,
      user.id,
      waktu,
      user.id,
      waktu,
      id,
    );
    await catatRiwayat(txDb, row, user.id, 'selesai', `No. Invoice MDK: ${inv.no_invoice_mdk}`, waktu);
    await kirimNotifikasi(
      txDb,
      await penerimaPengaju(txDb, row),
      user.id,
      {
        pengajuan_id: id,
        kode: row.kode,
        jenis: 'selesai',
        judul: 'Pengajuan selesai (paid)',
        pesan: `No. Invoice MDK: ${inv.no_invoice_mdk} · ${formatRupiah(Number(row.total))}`,
      },
      waktu,
    );
  });
}

export async function ubahInvoice(db: Db, user: SessionUser, id: number, inv: InvoiceBersih): Promise<void> {
  await db.tx(async (txDb) => {
    const row = await ambilPengajuan(txDb, user, id);
    if (!bolehProsesPum(user)) throw forbidden('Hanya PUM atau admin yang dapat mengubah data invoice');
    if (row.status !== 'selesai') throw conflict('Data invoice hanya dapat diubah pada pengajuan berstatus Selesai');
    const waktu = nowIso();
    await txDb.run(
      `UPDATE pengajuan SET no_invoice_mdk = ?, tanggal_invoice_mdk = ?, catatan_pum = ?, updated_by = ?, updated_at = ?
       WHERE id = ?`,
      inv.no_invoice_mdk,
      inv.tanggal_invoice_mdk,
      inv.catatan,
      user.id,
      waktu,
      id,
    );
    const ket =
      row.no_invoice_mdk !== inv.no_invoice_mdk
        ? `No. Invoice: ${row.no_invoice_mdk ?? '-'} → ${inv.no_invoice_mdk}`
        : 'Tanggal/catatan invoice diperbarui';
    await catatRiwayat(txDb, row, user.id, 'invoice_diubah', ket, waktu);
  });
}

export async function batalkanSelesai(db: Db, user: SessionUser, id: number, alasan: string): Promise<void> {
  await db.tx(async (txDb) => {
    const row = await ambilPengajuan(txDb, user, id);
    if (!bolehProsesPum(user)) throw forbidden('Hanya PUM atau admin yang dapat membatalkan status selesai');
    if (row.status !== 'selesai') throw conflict('Hanya pengajuan berstatus Selesai yang dapat dibatalkan');
    const waktu = nowIso();
    await txDb.run(
      `UPDATE pengajuan SET status = 'diajukan_mdk', no_invoice_mdk = NULL, tanggal_invoice_mdk = NULL, catatan_pum = NULL,
         diproses_by = NULL, diproses_at = NULL, updated_by = ?, updated_at = ? WHERE id = ?`,
      user.id,
      waktu,
      id,
    );
    await catatRiwayat(txDb, row, user.id, 'selesai_dibatalkan', `${alasan} (invoice sebelumnya: ${row.no_invoice_mdk ?? '-'})`, waktu);
    await kirimNotifikasi(
      txDb,
      await penerimaPengaju(txDb, row),
      user.id,
      {
        pengajuan_id: id,
        kode: row.kode,
        jenis: 'selesai_dibatalkan',
        judul: 'Status selesai dibatalkan PUM',
        pesan: alasan,
      },
      waktu,
    );
  });
}

// ───────────────────────────── Berkas (pengaju) ─────────────────────────────

export async function pastikanBisaKelolaBerkas(db: Db, user: SessionUser, pengajuanId: number): Promise<PengajuanRow> {
  const row = await ambilPengajuan(db, user, pengajuanId);
  if (!bolehKelola(user)) throw forbidden('Hanya operator/pengaju atau admin yang dapat mengelola berkas');
  if (!STATUS_BISA_EDIT.includes(row.status)) {
    throw conflict('Berkas hanya dapat diubah saat pengajuan berstatus Draft atau Dikembalikan');
  }
  return row;
}

export function jenisBerkasValid(kategori: Kategori, jenis: string): jenis is JenisBerkas {
  return jenis === 'lainnya' || (BERKAS_WAJIB[kategori] as readonly string[]).includes(jenis);
}

async function resetCek(db: Db, pengajuanId: number, jenis: string): Promise<void> {
  await db.run('DELETE FROM cek_berkas WHERE pengajuan_id = ? AND jenis = ?', pengajuanId, jenis);
}

export async function tambahBerkas(
  db: Db,
  user: SessionUser,
  pengajuanId: number,
  b: { jenis: JenisBerkas; nama_berkas: string | null; nama_asli: string; nama_file: string; mime: string; ukuran: number },
): Promise<number> {
  return db.tx(async (txDb) => {
    const row = await pastikanBisaKelolaBerkas(txDb, user, pengajuanId);
    const waktu = nowIso();
    const { lastInsertRowid: id } = await txDb.run(
      `INSERT INTO berkas (pengajuan_id, jenis, nama_berkas, nama_asli, nama_file, mime, ukuran, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      pengajuanId,
      b.jenis,
      b.nama_berkas,
      b.nama_asli,
      b.nama_file,
      b.mime,
      b.ukuran,
      user.id,
      waktu,
    );
    const berkasNaStr = typeof row.berkas_na === 'string' ? row.berkas_na : JSON.stringify(row.berkas_na);
    const na = parseBerkasNa(berkasNaStr).filter((j) => j !== b.jenis);
    await txDb.run('UPDATE pengajuan SET berkas_na = ?, updated_by = ?, updated_at = ? WHERE id = ?', JSON.stringify(na), user.id, waktu, pengajuanId);
    await resetCek(txDb, pengajuanId, b.jenis);
    await segarkanKelengkapan(txDb, pengajuanId);
    const label = b.jenis === 'lainnya' && b.nama_berkas ? b.nama_berkas : JENIS_BERKAS_LABEL[b.jenis];
    await catatRiwayat(txDb, row, user.id, 'berkas_diunggah', `${label}: ${b.nama_asli}`, waktu);
    return id;
  });
}

export interface BerkasRow {
  id: number;
  pengajuan_id: number;
  jenis: JenisBerkas;
  nama_berkas: string | null;
  nama_asli: string;
  nama_file: string;
  mime: string;
  ukuran: number;
}

export async function ambilBerkas(db: Db, user: SessionUser, berkasId: number): Promise<BerkasRow> {
  const b = await db.get<BerkasRow>('SELECT * FROM berkas WHERE id = ?', berkasId);
  if (!b) throw notFound('Berkas tidak ditemukan');
  await ambilPengajuan(db, user, Number(b.pengajuan_id));
  return b;
}

/** Hapus satu berkas dari database. Pemanggil bertanggung jawab menghapus objek storage `namaFile`. */
export async function hapusBerkas(db: Db, user: SessionUser, berkasId: number): Promise<{ pengajuanId: number; namaFile: string }> {
  return db.tx(async (txDb) => {
    const b = await ambilBerkas(txDb, user, berkasId);
    const row = await pastikanBisaKelolaBerkas(txDb, user, Number(b.pengajuan_id));
    const waktu = nowIso();
    await txDb.run('DELETE FROM berkas WHERE id = ?', berkasId);
    await txDb.run('UPDATE pengajuan SET updated_by = ?, updated_at = ? WHERE id = ?', user.id, waktu, b.pengajuan_id);
    await resetCek(txDb, Number(b.pengajuan_id), b.jenis);
    await segarkanKelengkapan(txDb, Number(b.pengajuan_id));
    const label = b.jenis === 'lainnya' && b.nama_berkas ? b.nama_berkas : JENIS_BERKAS_LABEL[b.jenis];
    await catatRiwayat(txDb, row, user.id, 'berkas_dihapus', `${label}: ${b.nama_asli}`, waktu);
    return { pengajuanId: Number(b.pengajuan_id), namaFile: b.nama_file };
  });
}

export async function setBerkasNa(db: Db, user: SessionUser, pengajuanId: number, jenis: string, na: boolean): Promise<void> {
  await db.tx(async (txDb) => {
    const row = await pastikanBisaKelolaBerkas(txDb, user, pengajuanId);
    if (!(BERKAS_WAJIB[row.kategori] as readonly string[]).includes(jenis)) {
      throw badRequest('Jenis berkas tidak termasuk berkas wajib kategori ini', { jenis: 'Jenis berkas tidak valid' });
    }
    const label = JENIS_BERKAS_LABEL[jenis as JenisBerkas];
    if (na) {
      const ada = await txDb.get<{ c: number }>('SELECT COUNT(*)::int AS c FROM berkas WHERE pengajuan_id = ? AND jenis = ?', pengajuanId, jenis);
      if ((ada?.c ?? 0) > 0) {
        throw conflict(`${label} sudah memiliki file. Hapus file terlebih dahulu bila memang tidak diperlukan.`);
      }
    }
    const berkasNaStr = typeof row.berkas_na === 'string' ? row.berkas_na : JSON.stringify(row.berkas_na);
    const daftar = new Set(parseBerkasNa(berkasNaStr));
    const sebelum = daftar.has(jenis);
    if (na) daftar.add(jenis);
    else daftar.delete(jenis);
    if (sebelum === na) return;
    const waktu = nowIso();
    await txDb.run(
      'UPDATE pengajuan SET berkas_na = ?, updated_by = ?, updated_at = ? WHERE id = ?',
      JSON.stringify([...daftar]),
      user.id,
      waktu,
      pengajuanId,
    );
    await resetCek(txDb, pengajuanId, jenis);
    await segarkanKelengkapan(txDb, pengajuanId);
    await catatRiwayat(txDb, row, user.id, na ? 'berkas_na' : 'berkas_na_batal', label, waktu);
  });
}

/** Hapus objek di storage; kegagalan hanya dicatat karena data database sudah berubah. */
export async function hapusObjekAman(storage: StorageProvider, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await storage.hapus(keys);
  } catch (err) {
    console.warn(`[berkas] Gagal menghapus ${keys.length} objek storage:`, (err as Error).message);
  }
}
