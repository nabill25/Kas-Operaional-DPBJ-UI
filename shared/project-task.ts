// Project Costing & Task Name — master data dari Kasubdit (tabel master_project, master_task, master_project_task;
// dikelola admin di menu Master Data → Project & Task). Daftar awalnya (15 project, 18 task, 38 pasangan) ada di
// blok seed supabase/schema.sql dan migrasi 2026-10-08-master-data.sql.
// Nilai yang disimpan di pengajuan (nama kolom tetap): project_hosting = "<kode project>:<nama project>",
// task_name = "<kode task>_<nama task>". Nilai lama yang sudah tersimpan tetap sah walaupun tidak ada lagi di master.
import type { MasterProjectTask } from './types.js';

export interface OpsiTask {
  /** Nilai Task Name yang disimpan: "<kode>_<nama>" */
  task: string;
  kode: string;
  nama: string;
}

export interface OpsiProject {
  /** Nilai Project Costing yang disimpan (kolom project_hosting): "<kode>:<nama>" */
  project: string;
  kode: string;
  nama: string;
  /** Task aktif yang sah untuk project ini, urut kode task. */
  tasks: OpsiTask[];
}

export interface DaftarProjectTask {
  project: OpsiProject[];
  task: OpsiTask[];
}

export const nilaiProject = (kode: string, nama: string) => `${kode}:${nama}`;
export const nilaiTask = (kode: string, nama: string) => `${kode}_${nama}`;

const urutKode = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

/** Susun pilihan project (aktif, urut kode) beserta task aktifnya, dan daftar semua task aktif. */
export function susunProjectTask(m: MasterProjectTask): DaftarProjectTask {
  const taskAktif = new Map(
    m.task.filter((t) => t.aktif).map((t) => [t.id, { task: nilaiTask(t.kode, t.nama), kode: t.kode, nama: t.nama }]),
  );
  const project = m.project
    .filter((p) => p.aktif)
    .map((p) => ({
      project: nilaiProject(p.kode, p.nama),
      kode: p.kode,
      nama: p.nama,
      tasks: p.task_ids
        .map((id) => taskAktif.get(id))
        .filter((t): t is OpsiTask => t !== undefined)
        .sort((a, b) => urutKode(a.kode, b.kode)),
    }))
    .sort((a, b) => urutKode(a.kode, b.kode));
  const task = [...taskAktif.values()].sort((a, b) => urutKode(a.kode, b.kode));
  return { project, task };
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

/**
 * Task yang otomatis dipilih saat project dipilih: satu-satunya task project itu yang cocok dengan kata kunci
 * jenis pengajuan. null bila tidak ada atau lebih dari satu (mis. Perjadin: uang harian, tiket, penginapan, transportasi).
 */
export function taskOtomatis(daftar: DaftarProjectTask, kataKunci: string | null | undefined, project: string): string | null {
  const cocok = cariProject(daftar, project)?.tasks.filter((t) => cocokKataKunci(kataKunci, t.nama)) ?? [];
  return cocok.length === 1 ? cocok[0].task : null;
}
