// Konfigurasi master untuk unit/komponen test — sama dengan seed master di supabase/schema.sql
// (3 jenis pengajuan bawaan + jenis berkas), plus satu jenis contoh bermodel Umum (Kontrak Borongan).
import type { JenisBerkasMaster, JenisPengajuan, Konfig, MasterProjectTask } from '../../shared/types';
import { PROJECT_TASK_AWAL } from './project-task-awal';

const jb = (kode: string, label: string, urutan: number, bawaan = true): JenisBerkasMaster => ({
  kode,
  label,
  keterangan: null,
  aktif: true,
  bawaan,
  urutan,
});

export const JENIS_BERKAS_UJI: JenisBerkasMaster[] = [
  jb('notulen', 'Notula', 1),
  jb('undangan', 'Undangan', 2),
  jb('invoice', 'Invoice', 3),
  jb('daftar_hadir', 'Daftar Hadir', 4),
  jb('surat_tugas', 'Surat Tugas', 5),
  jb('laporan_kegiatan', 'Laporan Kegiatan', 6),
  jb('invoice_hotel', 'Invoice Hotel', 7),
  jb('invoice_tiket', 'Invoice Tiket', 8),
  jb('laporan_pekerjaan', 'Laporan Pekerjaan', 9, false),
  jb('presensi', 'Presensi', 10, false),
  jb('kontrak', 'Kontrak', 11, false),
];

export const JENIS_BAWAAN_UJI: JenisPengajuan[] = [
  {
    kode: 'konsumsi',
    label: 'Konsumsi',
    label_pendek: 'Konsumsi',
    prefix: 'KSM',
    deskripsi: 'Konsumsi rapat / kegiatan',
    model: 'konsumsi',
    maks_peserta: null,
    kata_kunci_task: 'konsumsi',
    warna: 'kuning',
    ikon: 'coffee',
    aktif: true,
    bawaan: true,
    urutan: 1,
    berkas: ['notulen', 'undangan', 'invoice', 'daftar_hadir'],
  },
  {
    kode: 'rumah_tangga',
    label: 'Transport Rumah Tangga',
    label_pendek: 'Rumah Tangga',
    prefix: 'TRT',
    deskripsi: 'Transport kegiatan rumah tangga',
    model: 'rumah_tangga',
    maks_peserta: 2,
    kata_kunci_task: 'transportasi rumah tangga',
    warna: 'biru',
    ikon: 'car',
    aktif: true,
    bawaan: true,
    urutan: 2,
    berkas: ['surat_tugas', 'laporan_kegiatan'],
  },
  {
    kode: 'perjadin',
    label: 'Transport Perjadin',
    label_pendek: 'Perjadin',
    prefix: 'TPD',
    deskripsi: 'Perjalanan dinas dalam / luar kota',
    model: 'perjadin',
    maks_peserta: 2,
    kata_kunci_task: 'perjadin',
    warna: 'hijau',
    ikon: 'plane',
    aktif: true,
    bawaan: true,
    urutan: 3,
    berkas: ['surat_tugas', 'laporan_kegiatan', 'invoice_hotel', 'invoice_tiket'],
  },
];

export const JENIS_BORONGAN_UJI: JenisPengajuan = {
  kode: 'kontrak_borongan',
  label: 'Kontrak Borongan',
  label_pendek: 'Borongan',
  prefix: 'KBR',
  deskripsi: 'Honor pegawai kontrak borongan',
  model: 'umum',
  maks_peserta: 3,
  kata_kunci_task: 'tenaga lepas',
  warna: 'ungu',
  ikon: 'hard-hat',
  aktif: true,
  bawaan: false,
  urutan: 4,
  berkas: ['laporan_pekerjaan', 'presensi', 'kontrak'],
};

/** Konfigurasi bawaan (seperti database baru). */
export const KONFIG_UJI: Konfig = { jenisPengajuan: JENIS_BAWAAN_UJI, jenisBerkas: JENIS_BERKAS_UJI };

/** Konfigurasi dengan jenis tambahan Kontrak Borongan. */
export const KONFIG_UJI_BORONGAN: Konfig = {
  jenisPengajuan: [...JENIS_BAWAAN_UJI, JENIS_BORONGAN_UJI],
  jenisBerkas: JENIS_BERKAS_UJI,
};

export function jenisUji(kode: string): JenisPengajuan | undefined {
  return KONFIG_UJI_BORONGAN.jenisPengajuan.find((j) => j.kode === kode);
}

/** Master Project & Task seperti di database (id berurutan) dari daftar asli Kasubdit. */
export function masterProjectTaskUji(): MasterProjectTask {
  const project = new Map<string, { id: number; kode: string; nama: string; aktif: boolean; task_ids: number[] }>();
  const task = new Map<string, { id: number; kode: string; nama: string; aktif: boolean }>();
  for (const pt of PROJECT_TASK_AWAL) {
    if (!task.has(pt.taskKode)) task.set(pt.taskKode, { id: task.size + 1, kode: pt.taskKode, nama: pt.taskNama, aktif: true });
    if (!project.has(pt.projectKode)) {
      project.set(pt.projectKode, { id: project.size + 1, kode: pt.projectKode, nama: pt.projectNama, aktif: true, task_ids: [] });
    }
    project.get(pt.projectKode)!.task_ids.push(task.get(pt.taskKode)!.id);
  }
  return { project: [...project.values()], task: [...task.values()] };
}
