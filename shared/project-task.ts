// Master Project Hosting (Project Costing) & Task Name dari Kasubdit — sumber field cari PUM.
// Format baris asli: <kode project>:<nama project>_<kode task>_<nama task>.
// Nilai yang disimpan: project_hosting = "<kode project>:<nama project>", task_name = "<kode task>_<nama task>".
// Memperbarui daftar: ganti isi DATA_MENTAH (satu baris per pasangan project–task) lalu deploy.
// Nilai lama yang sudah tersimpan tetap sah walaupun tidak ada lagi di daftar ini.
import type { Kategori } from './constants.js';

const DATA_MENTAH = `
D0030.07.01.6.001:Sosialisasi Revisi PRPBJ dan E-Proc_723207_Beban Konsumsi
D0030.09.01.6.002:Koordinasi Tata Kelola Pengadaan_723216_Beban Transportasi Rumah Tangga
D0072.11.01.6.001:Operasional Administrasi Kantor_723216_Beban Transportasi Rumah Tangga
D0030.06.01.6.001:Penguatan Manajemen Kontrak_721707_Honor Tenaga Lepas
D0030.10.01.6.002:Koordinasi Perencanaan dan Pengadaan Langsung_723207_Beban Konsumsi
D0030.10.01.6.003:Survei Pengelolaan Kontrak_722111_Beban Uang Harian - Perjadin Luar Kota
D0030.09.01.6.002:Koordinasi Tata Kelola Pengadaan_723207_Beban Konsumsi
D0030.10.01.6.003:Survei Pengelolaan Kontrak_722114_Beban Transportasi Perjadin - Perjadin Luar Kota
D0030.12.01.6.001:Survei Perencanaan dan Pengadaan Langsung_723216_Beban Transportasi Rumah Tangga
D0030.10.01.6.001:Rapat Koordinasi Lintas Bidang Pengadaan Barang&Jasa_723216_Beban Transportasi Rumah Tangga
D0030.09.01.6.003:Penyusunan Laporan Pengadaan Barang dan Jasa_723705_Beban Foto Copy/Penjilidan
D0030.10.01.6.003:Survei Pengelolaan Kontrak_723216_Beban Transportasi Rumah Tangga
D0072.11.01.6.001:Operasional Administrasi Kantor_723202_Beban Pengiriman Surat/Dokumen
D0030.09.01.6.004:Pengelolaan Sistem Informasi dan Penyedia Pengadaan B_721707_Honor Tenaga Lepas
D0030.09.01.6.001:Benchmarking Pengadaan Barang dan Jasa_722123_Beban Tiket - Perjadin Luar Negeri
D0030.09.01.6.002:Koordinasi Tata Kelola Pengadaan_722113_Beban Tiket - Perjadin Luar Kota
D0030.09.01.6.001:Benchmarking Pengadaan Barang dan Jasa_722121_Beban Uang Harian - Perjadin Luar Negeri
D0030.12.01.6.001:Survei Perencanaan dan Pengadaan Langsung_722112_Beban Penginapan - Perjadin Luar Kota
D0030.10.01.6.001:Rapat Koordinasi Lintas Bidang Pengadaan Barang&Jasa_723207_Beban Konsumsi
D0030.07.01.6.001:Sosialisasi Revisi PRPBJ dan E-Proc_721702_Honor Moderator/Pembicara/Fasilitator
D0030.09.01.6.002:Koordinasi Tata Kelola Pengadaan_722114_Beban Transportasi Perjadin - Perjadin Luar Kota
D0030.09.01.6.002:Koordinasi Tata Kelola Pengadaan_722111_Beban Uang Harian - Perjadin Luar Kota
D0030.06.01.6.002:Penguatan Perencanaan, Pelaksanaan, dan Pengendalian_723207_Beban Konsumsi
D0030.10.01.6.003:Survei Pengelolaan Kontrak_722113_Beban Tiket - Perjadin Luar Kota
D0030.09.01.6.002:Koordinasi Tata Kelola Pengadaan_722112_Beban Penginapan - Perjadin Luar Kota
D0030.09.01.6.002:Koordinasi Tata Kelola Pengadaan_723601_Beban Perizinan
D0030.12.01.6.001:Survei Perencanaan dan Pengadaan Langsung_722114_Beban Transportasi Perjadin - Perjadin Luar Kota
D0030.12.01.6.001:Survei Perencanaan dan Pengadaan Langsung_722113_Beban Tiket - Perjadin Luar Kota
D0030.10.01.6.003:Survei Pengelolaan Kontrak_722112_Beban Penginapan - Perjadin Luar Kota
D0030.12.01.6.001:Survei Perencanaan dan Pengadaan Langsung_722111_Beban Uang Harian - Perjadin Luar Kota
D0030.09.01.6.001:Benchmarking Pengadaan Barang dan Jasa_722124_Beban Transportasi Perjadin - Perjadin Luar Negeri
D0030.09.01.6.003:Penyusunan Laporan Pengadaan Barang dan Jasa_722209_Beban Jasa Cetak
D0030.06.01.6.002:Penguatan Perencanaan, Pelaksanaan, dan Pengendalian_721707_Honor Tenaga Lepas
D0030.10.01.6.005:Undangan, penugasan, koordinasi kelembagaan & temuan_723216_Beban Transportasi Rumah Tangga
D0030.09.01.6.001:Benchmarking Pengadaan Barang dan Jasa_722122_Beban Penginapan - Perjadin Luar Negeri
D0030.10.01.6.004:Koordinasi Pengelolaan Kontrak_723207_Beban Konsumsi
D0030.06.01.6.003:Perancangan dan Persiapan SCM_722214_Beban Jasa Orang Pribadi
D0030.06.01.6.003:Perancangan dan Persiapan SCM_722201_Beban Jasa Konsultan
`;

export interface ProjectTask {
  /** Nilai Project Hosting yang disimpan: "<kode>:<nama>" */
  project: string;
  projectKode: string;
  projectNama: string;
  /** Nilai Task Name yang disimpan: "<kode>_<nama>" */
  task: string;
  taskKode: string;
  taskNama: string;
}

export interface ProjectMaster {
  project: string;
  kode: string;
  nama: string;
  /** Task yang sah untuk project ini, urut kode task. */
  tasks: ProjectTask[];
}

const RE_BARIS = /^([^:]+):(.+)_(\d{6})_(.+)$/;

/** Semua pasangan project–task (urutan sesuai data asli). */
export const DAFTAR_PROJECT_TASK: readonly ProjectTask[] = DATA_MENTAH.split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => {
    const m = RE_BARIS.exec(l);
    if (!m) throw new Error(`Baris project/task tidak valid: ${l}`);
    return {
      project: `${m[1]}:${m[2]}`,
      projectKode: m[1],
      projectNama: m[2],
      task: `${m[3]}_${m[4]}`,
      taskKode: m[3],
      taskNama: m[4],
    };
  });

const urutKode = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

/** Project unik (urut kode) beserta task-nya. */
export const DAFTAR_PROJECT: readonly ProjectMaster[] = (() => {
  const peta = new Map<string, ProjectMaster>();
  for (const pt of DAFTAR_PROJECT_TASK) {
    const pr = peta.get(pt.project) ?? { project: pt.project, kode: pt.projectKode, nama: pt.projectNama, tasks: [] };
    if (!pr.tasks.some((t) => t.task === pt.task)) pr.tasks.push(pt);
    peta.set(pt.project, pr);
  }
  const hasil = [...peta.values()].sort((a, b) => urutKode(a.kode, b.kode));
  for (const pr of hasil) pr.tasks.sort((a, b) => urutKode(a.taskKode, b.taskKode));
  return hasil;
})();

/** Task unik (urut kode) — dipakai bila project belum dipilih atau di luar daftar. */
export const DAFTAR_TASK: readonly ProjectTask[] = (() => {
  const peta = new Map<string, ProjectTask>();
  for (const pt of DAFTAR_PROJECT_TASK) if (!peta.has(pt.task)) peta.set(pt.task, pt);
  return [...peta.values()].sort((a, b) => urutKode(a.taskKode, b.taskKode));
})();

const POLA_TASK: Record<Kategori, RegExp> = {
  konsumsi: /konsumsi/i,
  rumah_tangga: /transportasi rumah tangga/i,
  perjadin: /perjadin/i,
};

/** Task yang sesuai kategori pengajuan (mis. Konsumsi → "Beban Konsumsi"). */
export function taskSesuaiKategori(kategori: Kategori, taskNama: string): boolean {
  return POLA_TASK[kategori].test(taskNama);
}

export function cariProject(project: string): ProjectMaster | undefined {
  return DAFTAR_PROJECT.find((p) => p.project === project);
}

/**
 * Task yang otomatis dipilih saat project dipilih: satu-satunya task project itu yang sesuai kategori.
 * null bila tidak ada atau lebih dari satu (mis. Perjadin: uang harian, tiket, penginapan, transportasi).
 */
export function taskOtomatis(kategori: Kategori, project: string): string | null {
  const cocok = cariProject(project)?.tasks.filter((t) => taskSesuaiKategori(kategori, t.taskNama)) ?? [];
  return cocok.length === 1 ? cocok[0].task : null;
}
