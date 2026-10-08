// Master data: jenis pengajuan & jenis berkas (berkas wajib), bank, Project Costing & Task Name.
// Dibaca semua peran (konfigurasi form/tampilan); diubah hanya oleh admin (routes/master.ts).
import { JENIS_BERKAS_LAINNYA, LABEL_BERKAS_LAINNYA, type ModelForm } from '../../shared/constants';
import { kodeDariLabel } from '../../shared/konfig';
import type {
  Bank,
  JenisBerkasMaster,
  JenisPengajuan,
  Konfig,
  MasterProjectTask,
} from '../../shared/types';
import type {
  BankBersih,
  JenisBerkasBersih,
  JenisPengajuanBersih,
  ProjectBersih,
  TaskBersih,
} from '../../shared/validation';
import { nowIso, type Db } from '../db-pg';
import { badRequest, conflict, notFound } from '../http';

// ───────────────────────────── Baca konfigurasi ─────────────────────────────

type JenisPengajuanRow = Omit<JenisPengajuan, 'berkas' | 'dipakai'> & { dipakai?: number };

const keJenis = (r: JenisPengajuanRow, berkas: string[]): JenisPengajuan => ({
  kode: r.kode,
  label: r.label,
  label_pendek: r.label_pendek,
  prefix: r.prefix,
  deskripsi: r.deskripsi,
  model: r.model,
  maks_peserta: r.maks_peserta === null ? null : Number(r.maks_peserta),
  kata_kunci_task: r.kata_kunci_task,
  warna: r.warna,
  ikon: r.ikon,
  aktif: r.aktif,
  bawaan: r.bawaan,
  urutan: Number(r.urutan),
  berkas,
  ...(r.dipakai === undefined ? {} : { dipakai: Number(r.dipakai) }),
});

async function petaBerkasWajib(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.all<{ jenis_pengajuan: string; jenis_berkas: string }>(
    'SELECT jenis_pengajuan, jenis_berkas FROM jenis_pengajuan_berkas ORDER BY jenis_pengajuan, urutan, jenis_berkas',
  );
  const peta = new Map<string, string[]>();
  for (const r of rows) peta.set(r.jenis_pengajuan, [...(peta.get(r.jenis_pengajuan) ?? []), r.jenis_berkas]);
  return peta;
}

const KOLOM_JENIS = `jp.kode, jp.label, jp.label_pendek, jp.prefix, jp.deskripsi, jp.model, jp.maks_peserta, jp.kata_kunci_task,
       jp.warna, jp.ikon, jp.aktif, jp.bawaan, jp.urutan`;

export async function daftarJenisPengajuan(db: Db, denganPemakaian = false): Promise<JenisPengajuan[]> {
  const rows = await db.all<JenisPengajuanRow>(
    `SELECT ${KOLOM_JENIS}
            ${denganPemakaian ? ', (SELECT COUNT(*) FROM pengajuan p WHERE p.kategori = jp.kode)::int AS dipakai' : ''}
       FROM jenis_pengajuan jp ORDER BY jp.urutan, jp.kode`,
  );
  const peta = await petaBerkasWajib(db);
  return rows.map((r) => keJenis(r, peta.get(r.kode) ?? []));
}

export async function daftarJenisBerkas(db: Db, denganPemakaian = false): Promise<JenisBerkasMaster[]> {
  const rows = await db.all<Omit<JenisBerkasMaster, 'dipakai'> & { jp: string[] | null; jumlah_berkas: number | null }>(
    `SELECT jb.kode, jb.label, jb.keterangan, jb.aktif, jb.bawaan, jb.urutan
            ${
              denganPemakaian
                ? `, (SELECT array_agg(m.jenis_pengajuan ORDER BY m.jenis_pengajuan) FROM jenis_pengajuan_berkas m
                      WHERE m.jenis_berkas = jb.kode) AS jp,
                   (SELECT COUNT(*) FROM berkas b WHERE b.jenis = jb.kode)::int AS jumlah_berkas`
                : ''
            }
       FROM jenis_berkas jb ORDER BY jb.urutan, jb.label`,
  );
  return rows.map(({ jp, jumlah_berkas, ...r }) => ({
    ...r,
    urutan: Number(r.urutan),
    ...(denganPemakaian ? { dipakai: { jenis_pengajuan: jp ?? [], berkas: Number(jumlah_berkas ?? 0) } } : {}),
  }));
}

/** Semua jenis pengajuan (dengan berkas wajibnya) & jenis berkas — dimuat client sekali setelah login. */
export async function muatKonfig(db: Db): Promise<Konfig> {
  return { jenisPengajuan: await daftarJenisPengajuan(db), jenisBerkas: await daftarJenisBerkas(db) };
}

export async function ambilJenisPengajuan(db: Db, kode: unknown): Promise<JenisPengajuan | undefined> {
  if (typeof kode !== 'string' || !kode) return undefined;
  const row = await db.get<JenisPengajuanRow>(`SELECT ${KOLOM_JENIS} FROM jenis_pengajuan jp WHERE jp.kode = ?`, kode);
  if (!row) return undefined;
  const berkas = await db.all<{ jenis_berkas: string }>(
    'SELECT jenis_berkas FROM jenis_pengajuan_berkas WHERE jenis_pengajuan = ? ORDER BY urutan, jenis_berkas',
    kode,
  );
  return keJenis(row, berkas.map((b) => b.jenis_berkas));
}

/** Label jenis berkas (termasuk "Dokumen Lainnya"); kode tak dikenal → kode itu sendiri. */
export async function labelJenisBerkas(db: Db, kode: string[]): Promise<(k: string) => string> {
  const unik = [...new Set(kode.filter((k) => k !== JENIS_BERKAS_LAINNYA))];
  const rows = unik.length
    ? await db.all<{ kode: string; label: string }>('SELECT kode, label FROM jenis_berkas WHERE kode = ANY(?)', unik)
    : [];
  const peta = new Map(rows.map((r) => [r.kode, r.label]));
  return (k) => (k === JENIS_BERKAS_LAINNYA ? LABEL_BERKAS_LAINNYA : (peta.get(k) ?? k));
}

// ───────────────────────────── Jenis pengajuan ─────────────────────────────

async function pastikanBerkasSah(db: Db, berkas: string[], lama: string[] = []): Promise<void> {
  if (berkas.length === 0) return;
  const rows = await db.all<{ kode: string; label: string; aktif: boolean }>(
    'SELECT kode, label, aktif FROM jenis_berkas WHERE kode = ANY(?)',
    berkas,
  );
  const ada = new Map(rows.map((r) => [r.kode, r]));
  const tidakAda = berkas.filter((b) => !ada.has(b));
  if (tidakAda.length) throw badRequest('Jenis berkas tidak ditemukan', { berkas: `Jenis berkas tidak dikenal: ${tidakAda.join(', ')}` });
  const nonaktif = berkas.filter((b) => !ada.get(b)!.aktif && !lama.includes(b));
  if (nonaktif.length) {
    throw badRequest('Jenis berkas nonaktif tidak dapat dipilih', {
      berkas: `Jenis berkas nonaktif: ${nonaktif.map((b) => ada.get(b)!.label).join(', ')}. Aktifkan dulu di master Jenis Berkas.`,
    });
  }
}

async function pastikanUnikJenis(db: Db, data: JenisPengajuanBersih, kecuali?: string): Promise<void> {
  const errors: Record<string, string> = {};
  const label = await db.get<{ kode: string }>(
    'SELECT kode FROM jenis_pengajuan WHERE lower(label) = lower(?) AND kode <> ?',
    data.label,
    kecuali ?? '',
  );
  if (label) errors.label = 'Nama jenis pengajuan sudah dipakai';
  const prefix = await db.get<{ label: string }>(
    'SELECT label FROM jenis_pengajuan WHERE prefix = ? AND kode <> ?',
    data.prefix,
    kecuali ?? '',
  );
  if (prefix) errors.prefix = `Awalan kode sudah dipakai oleh ${prefix.label}`;
  if (Object.keys(errors).length) throw badRequest('Data jenis pengajuan sudah ada', errors);
}

async function simpanBerkasWajib(db: Db, kode: string, berkas: string[]): Promise<void> {
  await db.run('DELETE FROM jenis_pengajuan_berkas WHERE jenis_pengajuan = ?', kode);
  for (let i = 0; i < berkas.length; i++) {
    await db.run(
      'INSERT INTO jenis_pengajuan_berkas (jenis_pengajuan, jenis_berkas, urutan) VALUES (?, ?, ?)',
      kode,
      berkas[i],
      i + 1,
    );
  }
}

export async function buatJenisPengajuan(db: Db, data: JenisPengajuanBersih): Promise<string> {
  return db.tx(async (tx) => {
    await pastikanUnikJenis(tx, data);
    await pastikanBerkasSah(tx, data.berkas);
    const kodeAda = (await tx.all<{ kode: string }>('SELECT kode FROM jenis_pengajuan')).map((r) => r.kode);
    const kode = kodeDariLabel(data.label, kodeAda);
    const urutan = (await tx.get<{ m: number | null }>('SELECT MAX(urutan) AS m FROM jenis_pengajuan'))?.m ?? 0;
    const waktu = nowIso();
    await tx.run(
      `INSERT INTO jenis_pengajuan (kode, label, label_pendek, prefix, deskripsi, model, maks_peserta, kata_kunci_task,
         warna, ikon, aktif, bawaan, urutan, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, ?, ?, ?)`,
      kode,
      data.label,
      data.label_pendek,
      data.prefix,
      data.deskripsi,
      data.model,
      data.maks_peserta,
      data.kata_kunci_task,
      data.warna,
      data.ikon,
      data.aktif,
      Number(urutan) + 1,
      waktu,
      waktu,
    );
    await simpanBerkasWajib(tx, kode, data.berkas);
    return kode;
  });
}

/** Mengembalikan true bila daftar berkas wajib berubah (pengajuan draft/dikembalikan perlu disinkronkan). */
export async function ubahJenisPengajuan(db: Db, kode: string, data: JenisPengajuanBersih): Promise<boolean> {
  const lama = await ambilJenisPengajuan(db, kode);
  if (!lama) throw notFound('Jenis pengajuan tidak ditemukan');
  await pastikanUnikJenis(db, data, kode);
  await pastikanBerkasSah(db, data.berkas, lama.berkas);
  if (data.prefix !== lama.prefix) {
    const n = (await db.get<{ c: number }>('SELECT COUNT(*)::int AS c FROM pengajuan WHERE kategori = ?', kode))?.c ?? 0;
    if (n > 0) {
      throw badRequest('Awalan kode tidak dapat diubah', {
        prefix: `Sudah ada ${n} pengajuan berkode ${lama.prefix}-…, sehingga awalan kode tidak dapat diubah`,
      });
    }
  }
  if (lama.aktif && !data.aktif) {
    const lain = (await db.get<{ c: number }>('SELECT COUNT(*)::int AS c FROM jenis_pengajuan WHERE aktif = true AND kode <> ?', kode))?.c ?? 0;
    if (lain === 0) throw conflict('Minimal harus ada satu jenis pengajuan yang aktif');
  }
  await db.run(
    `UPDATE jenis_pengajuan SET label = ?, label_pendek = ?, prefix = ?, deskripsi = ?, maks_peserta = ?, kata_kunci_task = ?,
       warna = ?, ikon = ?, aktif = ?, updated_at = ? WHERE kode = ?`,
    data.label,
    data.label_pendek,
    data.prefix,
    data.deskripsi,
    data.maks_peserta,
    data.kata_kunci_task,
    data.warna,
    data.ikon,
    data.aktif,
    nowIso(),
    kode,
  );
  const berubah = data.berkas.join('|') !== lama.berkas.join('|');
  if (berubah) await simpanBerkasWajib(db, kode, data.berkas);
  return berubah;
}

export async function hapusJenisPengajuan(db: Db, kode: string): Promise<void> {
  const j = await ambilJenisPengajuan(db, kode);
  if (!j) throw notFound('Jenis pengajuan tidak ditemukan');
  if (j.bawaan) throw conflict(`${j.label} adalah jenis bawaan sistem sehingga tidak dapat dihapus. Nonaktifkan saja bila tidak dipakai.`);
  const n = (await db.get<{ c: number }>('SELECT COUNT(*)::int AS c FROM pengajuan WHERE kategori = ?', kode))?.c ?? 0;
  if (n > 0) throw conflict(`${j.label} sudah dipakai ${n} pengajuan sehingga tidak dapat dihapus. Nonaktifkan saja agar data tetap utuh.`);
  const lain = (await db.get<{ c: number }>('SELECT COUNT(*)::int AS c FROM jenis_pengajuan WHERE aktif = true AND kode <> ?', kode))?.c ?? 0;
  if (j.aktif && lain === 0) throw conflict('Minimal harus ada satu jenis pengajuan yang aktif');
  await db.run('DELETE FROM jenis_pengajuan WHERE kode = ?', kode);
}

// ───────────────────────────── Jenis berkas ─────────────────────────────

async function pastikanLabelBerkasUnik(db: Db, label: string, kecuali?: string): Promise<void> {
  const ada = await db.get<{ kode: string }>(
    'SELECT kode FROM jenis_berkas WHERE lower(label) = lower(?) AND kode <> ?',
    label,
    kecuali ?? '',
  );
  if (ada) throw badRequest('Nama jenis berkas sudah ada', { label: 'Nama jenis berkas sudah dipakai' });
}

async function jenisPengajuanPemakai(db: Db, kodeBerkas: string): Promise<string[]> {
  return (
    await db.all<{ label: string }>(
      `SELECT jp.label FROM jenis_pengajuan_berkas m JOIN jenis_pengajuan jp ON jp.kode = m.jenis_pengajuan
        WHERE m.jenis_berkas = ? ORDER BY jp.urutan, jp.label`,
      kodeBerkas,
    )
  ).map((r) => r.label);
}

export async function buatJenisBerkas(db: Db, data: JenisBerkasBersih): Promise<string> {
  return db.tx(async (tx) => {
    await pastikanLabelBerkasUnik(tx, data.label);
    const kodeAda = (await tx.all<{ kode: string }>('SELECT kode FROM jenis_berkas')).map((r) => r.kode);
    const kode = kodeDariLabel(data.label, kodeAda);
    const urutan = (await tx.get<{ m: number | null }>('SELECT MAX(urutan) AS m FROM jenis_berkas'))?.m ?? 0;
    const waktu = nowIso();
    await tx.run(
      `INSERT INTO jenis_berkas (kode, label, keterangan, aktif, bawaan, urutan, created_at, updated_at)
       VALUES (?, ?, ?, ?, false, ?, ?, ?)`,
      kode,
      data.label,
      data.keterangan,
      data.aktif,
      Number(urutan) + 1,
      waktu,
      waktu,
    );
    return kode;
  });
}

export async function ubahJenisBerkas(db: Db, kode: string, data: JenisBerkasBersih): Promise<void> {
  const lama = await db.get<{ aktif: boolean }>('SELECT aktif FROM jenis_berkas WHERE kode = ?', kode);
  if (!lama) throw notFound('Jenis berkas tidak ditemukan');
  await pastikanLabelBerkasUnik(db, data.label, kode);
  if (lama.aktif && !data.aktif) {
    const pemakai = await jenisPengajuanPemakai(db, kode);
    if (pemakai.length) {
      throw conflict(`Jenis berkas ini masih wajib pada: ${pemakai.join(', ')}. Hapus dari jenis pengajuan tersebut terlebih dahulu.`);
    }
  }
  await db.run(
    'UPDATE jenis_berkas SET label = ?, keterangan = ?, aktif = ?, updated_at = ? WHERE kode = ?',
    data.label,
    data.keterangan,
    data.aktif,
    nowIso(),
    kode,
  );
}

export async function hapusJenisBerkas(db: Db, kode: string): Promise<void> {
  const jb = await db.get<{ label: string; bawaan: boolean }>('SELECT label, bawaan FROM jenis_berkas WHERE kode = ?', kode);
  if (!jb) throw notFound('Jenis berkas tidak ditemukan');
  if (jb.bawaan) throw conflict(`${jb.label} adalah jenis berkas bawaan sistem sehingga tidak dapat dihapus. Nonaktifkan saja bila tidak dipakai.`);
  const pemakai = await jenisPengajuanPemakai(db, kode);
  if (pemakai.length) throw conflict(`${jb.label} masih wajib pada: ${pemakai.join(', ')}. Hapus dari jenis pengajuan tersebut terlebih dahulu.`);
  const dipakai = await db.get<{ c: number }>(
    `SELECT ((SELECT COUNT(*) FROM berkas WHERE jenis = ?)
           + (SELECT COUNT(*) FROM cek_berkas WHERE jenis = ?)
           + (SELECT COUNT(*) FROM pengajuan WHERE berkas_daftar @> jsonb_build_array(?::text)))::int AS c`,
    kode,
    kode,
    kode,
  );
  if ((dipakai?.c ?? 0) > 0) {
    throw conflict(`${jb.label} sudah tercatat pada pengajuan sehingga tidak dapat dihapus. Nonaktifkan saja agar data tetap utuh.`);
  }
  await db.run('DELETE FROM jenis_berkas WHERE kode = ?', kode);
}

// ───────────────────────────── Bank ─────────────────────────────

export async function daftarBank(db: Db): Promise<Bank[]> {
  const rows = await db.all<Bank>(
    `SELECT b.id, b.nama, b.aktif,
            ((SELECT COUNT(*) FROM pengajuan p WHERE lower(p.rekening_bank) = lower(b.nama))
           + (SELECT COUNT(*) FROM pegawai g WHERE lower(g.rekening_bank) = lower(b.nama)))::int AS dipakai
       FROM bank b ORDER BY b.id`,
  );
  return rows.map((r) => ({ ...r, id: Number(r.id), dipakai: Number(r.dipakai) }));
}

async function pastikanBankUnik(db: Db, nama: string, kecuali = 0): Promise<void> {
  const ada = await db.get('SELECT id FROM bank WHERE lower(nama) = lower(?) AND id <> ?', nama, kecuali);
  if (ada) throw badRequest('Nama bank sudah ada', { nama: 'Nama bank sudah terdaftar' });
}

export async function buatBank(db: Db, data: BankBersih): Promise<number> {
  await pastikanBankUnik(db, data.nama);
  const waktu = nowIso();
  const { lastInsertRowid } = await db.run(
    'INSERT INTO bank (nama, aktif, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING id',
    data.nama,
    data.aktif,
    waktu,
    waktu,
  );
  return lastInsertRowid;
}

export async function ubahBank(db: Db, id: number, data: BankBersih): Promise<void> {
  if (!(await db.get('SELECT id FROM bank WHERE id = ?', id))) throw notFound('Bank tidak ditemukan');
  await pastikanBankUnik(db, data.nama, id);
  await db.run('UPDATE bank SET nama = ?, aktif = ?, updated_at = ? WHERE id = ?', data.nama, data.aktif, nowIso(), id);
}

/** Rekening tersimpan sebagai teks: menghapus nama bank dari master tidak mengubah data rekening yang sudah ada. */
export async function hapusBank(db: Db, id: number): Promise<void> {
  const { changes } = await db.run('DELETE FROM bank WHERE id = ?', id);
  if (changes === 0) throw notFound('Bank tidak ditemukan');
}

// ───────────────────────────── Project Costing & Task Name ─────────────────────────────

export async function daftarProjectTask(db: Db): Promise<MasterProjectTask> {
  const project = await db.all<{ id: number; kode: string; nama: string; aktif: boolean; task_ids: number[] | null }>(
    `SELECT p.id, p.kode, p.nama, p.aktif,
            (SELECT array_agg(pt.task_id ORDER BY pt.task_id) FROM master_project_task pt WHERE pt.project_id = p.id) AS task_ids
       FROM master_project p ORDER BY p.kode`,
  );
  const task = await db.all<{ id: number; kode: string; nama: string; aktif: boolean }>(
    'SELECT id, kode, nama, aktif FROM master_task ORDER BY kode',
  );
  return {
    project: project.map((p) => ({ ...p, id: Number(p.id), task_ids: (p.task_ids ?? []).map(Number) })),
    task: task.map((t) => ({ ...t, id: Number(t.id) })),
  };
}

async function pastikanTaskAda(db: Db, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const ada = await db.all<{ id: number }>('SELECT id FROM master_task WHERE id = ANY(?)', ids);
  if (ada.length !== ids.length) throw badRequest('Task tidak ditemukan', { task_ids: 'Ada task yang tidak ditemukan' });
}

async function simpanTaskProject(db: Db, projectId: number, ids: number[]): Promise<void> {
  await db.run('DELETE FROM master_project_task WHERE project_id = ?', projectId);
  for (const id of ids) await db.run('INSERT INTO master_project_task (project_id, task_id) VALUES (?, ?)', projectId, id);
}

async function pastikanKodeUnik(db: Db, tabel: 'master_project' | 'master_task', kode: string, kecuali = 0): Promise<void> {
  const ada = await db.get(`SELECT id FROM ${tabel} WHERE lower(kode) = lower(?) AND id <> ?`, kode, kecuali);
  if (ada) throw badRequest('Kode sudah terdaftar', { kode: `Kode ${tabel === 'master_project' ? 'project' : 'task'} sudah terdaftar` });
}

export async function buatProject(db: Db, data: ProjectBersih): Promise<number> {
  return db.tx(async (tx) => {
    await pastikanKodeUnik(tx, 'master_project', data.kode);
    await pastikanTaskAda(tx, data.task_ids);
    const waktu = nowIso();
    const { lastInsertRowid: id } = await tx.run(
      'INSERT INTO master_project (kode, nama, aktif, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id',
      data.kode,
      data.nama,
      data.aktif,
      waktu,
      waktu,
    );
    await simpanTaskProject(tx, id, data.task_ids);
    return id;
  });
}

export async function ubahProject(db: Db, id: number, data: ProjectBersih): Promise<void> {
  await db.tx(async (tx) => {
    if (!(await tx.get('SELECT id FROM master_project WHERE id = ?', id))) throw notFound('Project tidak ditemukan');
    await pastikanKodeUnik(tx, 'master_project', data.kode, id);
    await pastikanTaskAda(tx, data.task_ids);
    await tx.run(
      'UPDATE master_project SET kode = ?, nama = ?, aktif = ?, updated_at = ? WHERE id = ?',
      data.kode,
      data.nama,
      data.aktif,
      nowIso(),
      id,
    );
    await simpanTaskProject(tx, id, data.task_ids);
  });
}

/** Project Costing di pengajuan tersimpan sebagai teks: menghapus master tidak mengubah pengajuan yang sudah ada. */
export async function hapusProject(db: Db, id: number): Promise<void> {
  const { changes } = await db.run('DELETE FROM master_project WHERE id = ?', id);
  if (changes === 0) throw notFound('Project tidak ditemukan');
}

export async function buatTask(db: Db, data: TaskBersih): Promise<number> {
  await pastikanKodeUnik(db, 'master_task', data.kode);
  const waktu = nowIso();
  const { lastInsertRowid } = await db.run(
    'INSERT INTO master_task (kode, nama, aktif, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id',
    data.kode,
    data.nama,
    data.aktif,
    waktu,
    waktu,
  );
  return lastInsertRowid;
}

export async function ubahTask(db: Db, id: number, data: TaskBersih): Promise<void> {
  if (!(await db.get('SELECT id FROM master_task WHERE id = ?', id))) throw notFound('Task tidak ditemukan');
  await pastikanKodeUnik(db, 'master_task', data.kode, id);
  await db.run(
    'UPDATE master_task SET kode = ?, nama = ?, aktif = ?, updated_at = ? WHERE id = ?',
    data.kode,
    data.nama,
    data.aktif,
    nowIso(),
    id,
  );
}

export async function hapusTask(db: Db, id: number): Promise<void> {
  const { changes } = await db.run('DELETE FROM master_task WHERE id = ?', id);
  if (changes === 0) throw notFound('Task tidak ditemukan');
}

/** Model form jenis pengajuan (untuk validasi saat ubah: model tidak dapat diganti). */
export async function modelJenis(db: Db, kode: string): Promise<ModelForm | undefined> {
  return (await db.get<{ model: ModelForm }>('SELECT model FROM jenis_pengajuan WHERE kode = ?', kode))?.model;
}
