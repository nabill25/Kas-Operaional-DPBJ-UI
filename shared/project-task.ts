// Project Costing & Task Name — master data dari Kasubdit, dikelompokkan per tahun anggaran (tabel master_project,
// master_task, master_project_task; dikelola admin di menu Master Data → Project & Task). Setiap pasangan project–task
// (satu baris anggaran) punya kode dana, mis. 51 = Dana Masyarakat (BP) - Tidak Terikat (laporan sisa anggaran).
// Daftar awal 2026 (15 project, 18 task, 38 pasangan) ada di blok seed supabase/schema.sql dan migrasi.
// Nilai yang disimpan di pengajuan (nama kolom tetap): project_hosting = "<kode project>:<nama project>",
// task_name = "<kode task>_<nama task>", kode_dana = kode dana pasangannya. Nilai lama tetap sah walaupun master berubah.
import type { MasterProjectTask } from './types.js';

export interface OpsiTask {
  /** Nilai Task Name yang disimpan: "<kode>_<nama>" */
  task: string;
  kode: string;
  nama: string;
}

/** Task pada suatu project (satu baris anggaran) beserta kode dananya. */
export interface OpsiPasangan extends OpsiTask {
  kode_dana: string | null;
}

export interface OpsiProject {
  /** Nilai Project Costing yang disimpan (kolom project_hosting): "<kode>:<nama>" */
  project: string;
  kode: string;
  nama: string;
  /** Task aktif yang sah untuk project ini, urut kode task. */
  tasks: OpsiPasangan[];
}

/** Pilihan project & task satu tahun anggaran. */
export interface DaftarProjectTask {
  tahun: number;
  project: OpsiProject[];
  task: OpsiTask[];
}

export const nilaiProject = (kode: string, nama: string) => `${kode}:${nama}`;
export const nilaiTask = (kode: string, nama: string) => `${kode}_${nama}`;

const urutKode = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

/** Tahun anggaran yang punya project/task aktif, urut naik. */
export function tahunMaster(m: MasterProjectTask): number[] {
  const ada = new Set<number>();
  for (const p of m.project) if (p.aktif) ada.add(p.tahun);
  for (const t of m.task) if (t.aktif) ada.add(t.tahun);
  return [...ada].sort((a, b) => a - b);
}

/**
 * Tahun master yang dipakai saat PUM memilih project/task: tahun kegiatan bila ada di master; bila tidak, tahun master
 * terakhir sebelum tahun kegiatan; bila tidak ada juga, tahun master paling awal.
 */
export function tahunUntuk(m: MasterProjectTask, tahunKegiatan: number): number {
  const ada = tahunMaster(m);
  if (ada.length === 0 || ada.includes(tahunKegiatan)) return tahunKegiatan;
  const sebelum = ada.filter((t) => t < tahunKegiatan);
  return sebelum.length > 0 ? sebelum[sebelum.length - 1] : ada[0];
}

/** Susun pilihan project (aktif, urut kode) beserta task aktifnya untuk satu tahun, dan daftar task aktif tahun itu. */
export function susunProjectTask(m: MasterProjectTask, tahun: number): DaftarProjectTask {
  const taskAktif = new Map(
    m.task
      .filter((t) => t.aktif && t.tahun === tahun)
      .map((t) => [t.id, { task: nilaiTask(t.kode, t.nama), kode: t.kode, nama: t.nama }]),
  );
  const project = m.project
    .filter((p) => p.aktif && p.tahun === tahun)
    .map((p) => ({
      project: nilaiProject(p.kode, p.nama),
      kode: p.kode,
      nama: p.nama,
      tasks: p.tasks
        .map((x): OpsiPasangan | undefined => {
          const t = taskAktif.get(x.id);
          return t ? { ...t, kode_dana: x.kode_dana } : undefined;
        })
        .filter((t): t is OpsiPasangan => t !== undefined)
        .sort((a, b) => urutKode(a.kode, b.kode)),
    }))
    .sort((a, b) => urutKode(a.kode, b.kode));
  const task = [...taskAktif.values()].sort((a, b) => urutKode(a.kode, b.kode));
  return { tahun, project, task };
}

/**
 * Task cocok dengan kata kunci jenis pengajuan (master Jenis Pengajuan → "kata kunci task")?
 * Beberapa kata kunci dipisah koma; cukup salah satu yang ada di nama task (tanpa membedakan huruf besar/kecil).
 */
export function cocokKataKunci(kataKunci: string | null | undefined, namaTask: string): boolean {
  const nama = namaTask.toLowerCase();
  return (kataKunci ?? '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .some((k) => k.length > 0 && nama.includes(k));
}

export function cariProject(daftar: DaftarProjectTask, project: string): OpsiProject | undefined {
  return daftar.project.find((p) => p.project === project);
}

/** Project yang memiliki task tertentu (urut kode). */
export function projectDenganTask(daftar: DaftarProjectTask, task: string): OpsiProject[] {
  return daftar.project.filter((p) => p.tasks.some((t) => t.task === task));
}

/** Kode dana pasangan project–task; null bila pasangan tidak ada di master atau belum diberi kode dana. */
export function kodeDanaPasangan(daftar: DaftarProjectTask, project: string, task: string): string | null {
  return cariProject(daftar, project)?.tasks.find((t) => t.task === task)?.kode_dana ?? null;
}

/**
 * Task yang otomatis dipilih saat isian dibuka (Task Name diisi lebih dulu): satu-satunya task yang dipakai suatu project
 * dan cocok dengan kata kunci jenis pengajuan. null bila tidak ada atau lebih dari satu (mis. Perjadin: uang harian,
 * tiket, penginapan, transportasi).
 */
export function taskOtomatis(daftar: DaftarProjectTask, kataKunci: string | null | undefined): string | null {
  const dipakai = new Set(daftar.project.flatMap((p) => p.tasks.map((t) => t.task)));
  const cocok = daftar.task.filter((t) => dipakai.has(t.task) && cocokKataKunci(kataKunci, t.nama));
  return cocok.length === 1 ? cocok[0].task : null;
}

/** Project yang otomatis dipilih setelah task dipilih: satu-satunya project yang memiliki task itu. */
export function projectOtomatis(daftar: DaftarProjectTask, task: string): string | null {
  const p = projectDenganTask(daftar, task);
  return p.length === 1 ? p[0].project : null;
}
