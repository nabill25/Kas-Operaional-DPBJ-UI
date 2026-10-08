import {
  MEKANISME_LIST,
  ROLE_LIHAT_DRAFT,
  STATUS_LIST,
  type Kategori,
  type Mekanisme,
  type Status,
} from '../../shared/constants';
import type {
  DashboardData,
  JumlahNilai,
  Notifikasi,
  NotifikasiData,
  Pegawai,
  RekapPegawaiData,
  RekapPegawaiDetail,
  RekapPegawaiDetailItem,
  RekapPegawaiRow,
  RekapPengajuanData,
  Riwayat,
} from '../../shared/types';
import { nowIso, type Db, type SqlParam } from '../db-pg';
import { notFound } from '../http';
import type { SessionUser } from '../types';
import { daftarJenisPengajuan } from './master';
import {
  SELECT_PENGAJUAN,
  bangunWhere,
  rowsKeRingkas,
  semuaPengajuan,
  type FilterPengajuan,
  type PengajuanRow,
} from './pengajuan';

const kosong = (): JumlahNilai => ({ jumlah: 0, nilai: 0 });

function lihatDraft(user: SessionUser): boolean {
  return ROLE_LIHAT_DRAFT.includes(user.role);
}

function filterRekap(f: FilterPengajuan, user: SessionUser): FilterPengajuan {
  let status = f.status || 'semua';
  if (!lihatDraft(user) && status === 'draft') status = 'semua';
  return { kategori: f.kategori, status, mekanisme: f.mekanisme, dari: f.dari, sampai: f.sampai, tahun: f.tahun };
}

export async function rekapPengajuan(db: Db, user: SessionUser, f: FilterPengajuan): Promise<RekapPengajuanData> {
  const rows = await semuaPengajuan(db, user, filterRekap(f, user));
  const perKategori: Record<Kategori, JumlahNilai> = Object.fromEntries(
    (await daftarJenisPengajuan(db)).map((j) => [j.kode, kosong()]),
  );
  const perStatus = Object.fromEntries(STATUS_LIST.map((s) => [s, kosong()])) as Record<Status, JumlahNilai>;
  const perMekanisme = Object.fromEntries(MEKANISME_LIST.map((m) => [m, kosong()])) as Record<Mekanisme, JumlahNilai>;
  let nilai = 0;
  for (const r of rows) {
    nilai += r.total;
    perKategori[r.kategori] ??= kosong();
    perKategori[r.kategori].jumlah++;
    perKategori[r.kategori].nilai += r.total;
    perStatus[r.status].jumlah++;
    perStatus[r.status].nilai += r.total;
    perMekanisme[r.mekanisme].jumlah++;
    perMekanisme[r.mekanisme].nilai += r.total;
  }
  return { rows, ringkasan: { jumlah: rows.length, nilai, perKategori, perStatus, perMekanisme } };
}

/**
 * Nilai yang diterima tiap pegawai: model Konsumsi lewat "uang siapa" (nilai = total), model lain lewat peserta
 * (nilai per orang). Jumlah seluruh kontribusi = jumlah total pengajuan.
 */
function cteKontribusi(where: string): string {
  return `
    WITH base AS (SELECT p.* FROM pengajuan p ${where}),
    x AS (
      SELECT b.id AS pengajuan_id, b.uang_siapa_id AS pegawai_id, b.total AS nilai, b.kategori
        FROM base b JOIN jenis_pengajuan jp ON jp.kode = b.kategori
       WHERE jp.model = 'konsumsi' AND b.uang_siapa_id IS NOT NULL
      UNION ALL
      SELECT b.id, ps.pegawai_id, ps.nilai, b.kategori
        FROM base b JOIN pengajuan_peserta ps ON ps.pengajuan_id = b.id
    )`;
}

/** Rincian nilai per jenis pengajuan untuk sejumlah pegawai (hanya yang > 0). */
async function perKategoriPegawai(
  db: Db,
  where: string,
  params: SqlParam[],
  pegawaiIds: number[],
): Promise<Map<number, Record<Kategori, number>>> {
  const peta = new Map<number, Record<Kategori, number>>();
  if (pegawaiIds.length === 0) return peta;
  const rows = await db.all<{ pegawai_id: number; kategori: Kategori; nilai: number }>(
    `${cteKontribusi(where)}
     SELECT x.pegawai_id, x.kategori, SUM(x.nilai)::bigint AS nilai
       FROM x WHERE x.pegawai_id = ANY(?) GROUP BY x.pegawai_id, x.kategori`,
    ...params,
    pegawaiIds,
  );
  for (const r of rows) {
    const id = Number(r.pegawai_id);
    const isi = peta.get(id) ?? {};
    if (Number(r.nilai) > 0) isi[r.kategori] = Number(r.nilai);
    peta.set(id, isi);
  }
  return peta;
}

export async function rekapPegawai(db: Db, user: SessionUser, f: FilterPengajuan): Promise<RekapPegawaiData> {
  const { where, params } = bangunWhere(user, filterRekap(f, user));
  const rows = await db.all<Omit<RekapPegawaiRow, 'perKategori'>>(
    `${cteKontribusi(where)}
     SELECT g.id AS pegawai_id, g.nama, g.nip, g.jabatan,
            COUNT(DISTINCT x.pengajuan_id)::int AS jumlah,
            SUM(x.nilai)::bigint AS total
       FROM x JOIN pegawai g ON g.id = x.pegawai_id
      GROUP BY g.id
      ORDER BY total DESC, g.nama ASC`,
    ...params,
  );
  const rincian = await perKategoriPegawai(db, where, params, rows.map((r) => Number(r.pegawai_id)));
  return {
    rows: rows.map((r) => ({ ...r, pegawai_id: Number(r.pegawai_id), perKategori: rincian.get(Number(r.pegawai_id)) ?? {} })),
    total: rows.reduce((s, r) => s + r.total, 0),
  };
}

export async function getPegawai(db: Db, id: number): Promise<Pegawai | undefined> {
  const row = await db.get<Omit<Pegawai, 'aktif'> & { aktif: boolean | number }>(
    `SELECT g.*,
            (SELECT COUNT(*) FROM pengajuan p WHERE p.uang_siapa_id = g.id)::int
          + (SELECT COUNT(*) FROM pengajuan_peserta ps WHERE ps.pegawai_id = g.id)::int AS dipakai
       FROM pegawai g WHERE g.id = ?`,
    id,
  );
  return row ? { ...row, id: Number(row.id), aktif: row.aktif === true || (row.aktif as number) === 1 } : undefined;
}

export async function rekapPegawaiDetail(db: Db, user: SessionUser, pegawaiId: number, f: FilterPengajuan): Promise<RekapPegawaiDetail> {
  const pegawai = await getPegawai(db, pegawaiId);
  if (!pegawai) throw notFound('Pegawai tidak ditemukan');
  const { where, params } = bangunWhere(user, filterRekap(f, user));
  const items = await db.all<RekapPegawaiDetailItem>(
    `WITH base AS (SELECT p.* FROM pengajuan p ${where})
     SELECT b.id AS pengajuan_id, b.kode, b.kategori, b.nama_kegiatan, b.tanggal_kegiatan, b.tanggal_selesai,
            b.lokasi_tujuan, b.mekanisme, b.status, 'uang_siapa' AS peran, b.total AS nilai, b.no_invoice_mdk
       FROM base b JOIN jenis_pengajuan jp ON jp.kode = b.kategori WHERE jp.model = 'konsumsi' AND b.uang_siapa_id = ?
     UNION ALL
     SELECT b.id, b.kode, b.kategori, b.nama_kegiatan, b.tanggal_kegiatan, b.tanggal_selesai,
            b.lokasi_tujuan, b.mekanisme, b.status, 'peserta', ps.nilai, b.no_invoice_mdk
       FROM base b JOIN pengajuan_peserta ps ON ps.pengajuan_id = b.id WHERE ps.pegawai_id = ?
     ORDER BY 5 ASC, 1 ASC`,
    ...params,
    pegawaiId,
    pegawaiId,
  );
  
  // Normalize dates for Postgres
  const mappedItems = items.map(i => ({
    ...i,
    pengajuan_id: Number(i.pengajuan_id),
    nilai: Number(i.nilai),
    tanggal_kegiatan: (i.tanggal_kegiatan as any) instanceof Date ? (i.tanggal_kegiatan as any).toISOString().split('T')[0] : i.tanggal_kegiatan,
    tanggal_selesai: (i.tanggal_selesai as any) instanceof Date ? (i.tanggal_selesai as any).toISOString().split('T')[0] : i.tanggal_selesai,
  }));
  
  return { pegawai, items: mappedItems, total: mappedItems.reduce((s, i) => s + i.nilai, 0) };
}

async function aktivitasTerbaru(db: Db, user: SessionUser, batas: number): Promise<Riwayat[]> {
  let rows: Riwayat[];
  if (lihatDraft(user)) {
    rows = await db.all<Riwayat>(
      `SELECT r.id, r.pengajuan_id, r.kode, r.user_id, u.nama AS user_nama, r.aksi, r.keterangan, r.created_at
         FROM riwayat r LEFT JOIN users u ON u.id = r.user_id
        ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
      batas,
    );
  } else {
    rows = await db.all<Riwayat>(
      `SELECT r.id, r.pengajuan_id, r.kode, r.user_id, u.nama AS user_nama, r.aksi, r.keterangan, r.created_at
         FROM riwayat r
         JOIN pengajuan p ON p.id = r.pengajuan_id AND p.status <> 'draft'
         LEFT JOIN users u ON u.id = r.user_id
        ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
      batas,
    );
  }
  return rows.map(r => ({
    ...r,
    id: Number(r.id),
    pengajuan_id: Number(r.pengajuan_id),
    user_id: r.user_id ? Number(r.user_id) : null,
    created_at: (r.created_at as any) instanceof Date ? (r.created_at as any).toISOString() : r.created_at
  }));
}

export async function dashboard(db: Db, user: SessionUser, tahunInput: number): Promise<DashboardData> {
  const draftTerlihat = lihatDraft(user);
  const tahunIni = new Date().getFullYear();
  const tahun = Number.isInteger(tahunInput) && tahunInput >= 2000 && tahunInput <= 2100 ? tahunInput : tahunIni;

  const tersediaResult = await db.all<{ t: number }>(
    `SELECT DISTINCT EXTRACT(YEAR FROM tanggal_kegiatan)::int AS t FROM pengajuan ${draftTerlihat ? '' : `WHERE status <> 'draft'`}`,
  );
  
  const tahunTersedia = new Set<number>(tersediaResult.map((r) => Number(r.t)));
  tahunTersedia.add(tahunIni);
  tahunTersedia.add(tahun);

  const perStatus = Object.fromEntries(STATUS_LIST.map((s) => [s, kosong()])) as Record<Status, JumlahNilai>;
  const statusRows = await db.all<{ status: Status; jumlah: number; nilai: number }>(
    `SELECT status, COUNT(*)::int AS jumlah, COALESCE(SUM(total), 0)::bigint AS nilai
       FROM pengajuan WHERE EXTRACT(YEAR FROM tanggal_kegiatan) = ? GROUP BY status`,
    tahun,
  );
  
  for (const r of statusRows) {
    perStatus[r.status] = { jumlah: r.jumlah, nilai: r.nilai };
  }
  
  const tahapAktif: Status[] = ['diajukan_pum', 'dikembalikan', 'diverifikasi_pum', 'diajukan_mdk', 'selesai'];
  const total: JumlahNilai = {
    jumlah: tahapAktif.reduce((s, st) => s + perStatus[st].jumlah, 0),
    nilai: tahapAktif.reduce((s, st) => s + perStatus[st].nilai, 0),
  };

  const statusBelumLengkap = draftTerlihat ? `('draft','diajukan_pum','dikembalikan')` : `('diajukan_pum','dikembalikan')`;
  const belumLengkapRow = await db.get<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM pengajuan
      WHERE EXTRACT(YEAR FROM tanggal_kegiatan) = ? AND status IN ${statusBelumLengkap} AND berkas_terpenuhi < berkas_wajib`,
    tahun,
  );
  const belumLengkap = belumLengkapRow?.c ?? 0;

  const rataRow = await db.get<{ r: number | null }>(
    `SELECT AVG(EXTRACT(EPOCH FROM (diproses_at - diajukan_at))/86400) AS r FROM pengajuan
      WHERE status = 'selesai' AND diajukan_at IS NOT NULL AND diproses_at IS NOT NULL
        AND EXTRACT(YEAR FROM tanggal_kegiatan) = ?`,
    tahun,
  );
  const rata = rataRow?.r;

  const perBulan: DashboardData['perBulan'] = Array.from({ length: 12 }, (_, i) => ({
    bulan: i + 1,
    jumlah: 0,
    nilai: 0,
    perKategori: {},
  }));

  const jenisMaster = await daftarJenisPengajuan(db);
  const perKategoriMap: Record<Kategori, JumlahNilai> = {};
  const bulanRows = await db.all<{ bulan: number; kategori: Kategori; jumlah: number; nilai: number }>(
    `SELECT EXTRACT(MONTH FROM tanggal_kegiatan)::int AS bulan, kategori,
            COUNT(*)::int AS jumlah, COALESCE(SUM(total), 0)::bigint AS nilai
       FROM pengajuan WHERE status <> 'draft' AND EXTRACT(YEAR FROM tanggal_kegiatan) = ?
      GROUP BY bulan, kategori`,
    tahun,
  );

  for (const r of bulanRows) {
    const b = perBulan[r.bulan - 1];
    if (!b) continue;
    if (r.nilai > 0) b.perKategori[r.kategori] = (b.perKategori[r.kategori] ?? 0) + r.nilai;
    b.nilai += r.nilai;
    b.jumlah += r.jumlah;
    perKategoriMap[r.kategori] ??= kosong();
    perKategoriMap[r.kategori].jumlah += r.jumlah;
    perKategoriMap[r.kategori].nilai += r.nilai;
  }
  // Urut master: jenis aktif selalu tampil; jenis nonaktif / tak dikenal hanya bila punya data.
  const perKategori: DashboardData['perKategori'] = [
    ...jenisMaster
      .filter((j) => j.aktif || perKategoriMap[j.kode])
      .map((j) => ({ kategori: j.kode, ...(perKategoriMap[j.kode] ?? kosong()) })),
    ...Object.keys(perKategoriMap)
      .filter((k) => !jenisMaster.some((j) => j.kode === k))
      .map((k) => ({ kategori: k, ...perKategoriMap[k] })),
  ];

  const perMekanismeMap = Object.fromEntries(MEKANISME_LIST.map((m) => [m, kosong()])) as Record<Mekanisme, JumlahNilai>;
  const mekanismeRows = await db.all<{ mekanisme: Mekanisme; jumlah: number; nilai: number }>(
    `SELECT mekanisme, COUNT(*)::int AS jumlah, COALESCE(SUM(total), 0)::bigint AS nilai
       FROM pengajuan WHERE status <> 'draft' AND EXTRACT(YEAR FROM tanggal_kegiatan) = ? GROUP BY mekanisme`,
    tahun,
  );
  
  for (const r of mekanismeRows) {
    perMekanismeMap[r.mekanisme] = { jumlah: r.jumlah, nilai: r.nilai };
  }

  const { where, params } = bangunWhere(user, { status: 'semua', tahun: String(tahun) });
  const topPegawaiRows = await db.all<Omit<DashboardData['topPegawai'][number], 'perKategori'>>(
    `${cteKontribusi(where)}
     SELECT g.id AS pegawai_id, g.nama,
            SUM(x.nilai)::bigint AS total,
            COUNT(DISTINCT x.pengajuan_id)::int AS jumlah
       FROM x JOIN pegawai g ON g.id = x.pegawai_id
      GROUP BY g.id ORDER BY total DESC, g.nama ASC LIMIT 5`,
    ...params,
  );
  const rincianTop = await perKategoriPegawai(db, where, params, topPegawaiRows.map((r) => Number(r.pegawai_id)));
  const topPegawai = topPegawaiRows.map((r) => ({
    ...r,
    pegawai_id: Number(r.pegawai_id),
    perKategori: rincianTop.get(Number(r.pegawai_id)) ?? {},
  }));

  // Acuan lama menunggu sesuai tahap (dipakai untuk mengurutkan: terlama di atas).
  const acuanTunggu = `COALESCE(CASE p.status WHEN 'diverifikasi_pum' THEN p.diverifikasi_at
                                              WHEN 'diajukan_mdk' THEN p.diajukan_mdk_at
                                              ELSE p.diajukan_at END, p.updated_at)`;
  let tindakan: string;
  switch (user.role) {
    case 'pum':
      tindakan = `WHERE p.status IN ('diajukan_pum','diverifikasi_pum','diajukan_mdk')
                  ORDER BY CASE p.status WHEN 'diajukan_pum' THEN 0 WHEN 'diverifikasi_pum' THEN 1 ELSE 2 END,
                           ${acuanTunggu} ASC`;
      break;
    case 'operator':
      tindakan = `WHERE p.status IN ('dikembalikan','draft')
                  ORDER BY CASE p.status WHEN 'dikembalikan' THEN 0 ELSE 1 END, p.updated_at DESC`;
      break;
    case 'pimpinan':
      tindakan = `WHERE p.status IN ('diajukan_pum','diverifikasi_pum','diajukan_mdk','dikembalikan')
                  ORDER BY COALESCE(p.diajukan_at, p.updated_at) ASC`;
      break;
    default:
      tindakan = `WHERE p.status IN ('dikembalikan','diajukan_pum','diverifikasi_pum','diajukan_mdk')
                  ORDER BY CASE p.status WHEN 'dikembalikan' THEN 0 WHEN 'diajukan_pum' THEN 1
                                         WHEN 'diverifikasi_pum' THEN 2 ELSE 3 END,
                           ${acuanTunggu} ASC`;
  }
  const tindakanRows = await db.all<PengajuanRow>(`${SELECT_PENGAJUAN} ${tindakan} LIMIT 6`);

  return {
    tahun,
    tahunTersedia: [...tahunTersedia].sort((a, b) => b - a),
    kpi: {
      total,
      diajukan_pum: perStatus.diajukan_pum,
      dikembalikan: perStatus.dikembalikan,
      diverifikasi_pum: perStatus.diverifikasi_pum,
      diajukan_mdk: perStatus.diajukan_mdk,
      selesai: perStatus.selesai,
      draft: draftTerlihat ? perStatus.draft : null,
      belumLengkap,
      rataProsesHari: rata === null || rata === undefined ? null : Math.round(Number(rata) * 10) / 10,
    },
    perBulan,
    perKategori,
    perMekanisme: MEKANISME_LIST.map((m) => ({ mekanisme: m, ...perMekanismeMap[m] })),
    topPegawai,
    aktivitas: await aktivitasTerbaru(db, user, 8),
    perluTindakan: await rowsKeRingkas(db, tindakanRows),
  };
}

async function antrian(db: Db, user: SessionUser): Promise<NotifikasiData['antrian']> {
  const hitung = async (s: Status) => (await db.get<{ c: number }>('SELECT COUNT(*)::int AS c FROM pengajuan WHERE status = ?', s))?.c ?? 0;
  const pum = user.role === 'pum' || user.role === 'admin';
  const pengaju = user.role === 'operator' || user.role === 'admin';
  const pendaftar =
    user.role === 'admin'
      ? ((await db.get<{ c: number }>('SELECT COUNT(*)::int AS c FROM users WHERE menunggu_persetujuan = true'))?.c ?? 0)
      : 0;
  return {
    diajukan_pum: pum ? await hitung('diajukan_pum') : 0,
    diverifikasi_pum: pum ? await hitung('diverifikasi_pum') : 0,
    diajukan_mdk: pum ? await hitung('diajukan_mdk') : 0,
    dikembalikan: pengaju ? await hitung('dikembalikan') : 0,
    pendaftar,
  };
}

export async function notifikasi(db: Db, user: SessionUser): Promise<NotifikasiData> {
  const belumDibacaRow = await db.get<{ c: number }>('SELECT COUNT(*)::int AS c FROM notifikasi WHERE user_id = ? AND dibaca_at IS NULL', user.id);
  const belumDibaca = belumDibacaRow?.c ?? 0;
  
  const rows = await db.all<Omit<Notifikasi, 'dibaca'> & { dibaca_at: string | null }>(
    `SELECT id, pengajuan_id, kode, jenis, judul, pesan, dibaca_at, created_at
       FROM notifikasi WHERE user_id = ? ORDER BY id DESC LIMIT 20`,
    user.id,
  );
  
  return {
    belumDibaca,
    items: rows.map(({ dibaca_at, ...n }) => ({ 
      ...n, 
      id: Number(n.id),
      pengajuan_id: n.pengajuan_id ? Number(n.pengajuan_id) : null,
      dibaca: dibaca_at !== null,
      created_at: (n.created_at as any) instanceof Date ? (n.created_at as any).toISOString() : n.created_at
    })),
    antrian: await antrian(db, user),
  };
}

export async function tandaiDibaca(db: Db, user: SessionUser, id?: number): Promise<void> {
  const waktu = nowIso();
  if (id) {
    await db.run('UPDATE notifikasi SET dibaca_at = ? WHERE id = ? AND user_id = ? AND dibaca_at IS NULL', waktu, id, user.id);
  } else {
    await db.run('UPDATE notifikasi SET dibaca_at = ? WHERE user_id = ? AND dibaca_at IS NULL', waktu, user.id);
  }
}
