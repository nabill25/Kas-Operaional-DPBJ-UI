// Daftar asli Project Costing & Task Name dari Kasubdit (38 pasangan, urutan asli) — dulu tertanam di
// shared/project-task.ts, kini master data di database. Dipakai test: data demo memilih pasangan secara
// deterministik dari urutan ini, dan test memastikan seed master di supabase/schema.sql sama persis.
// Format baris: <kode project>:<nama project>_<kode task>_<nama task>.
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

export interface PasanganProjectTask {
  /** Nilai Project Costing yang disimpan: "<kode>:<nama>" */
  project: string;
  projectKode: string;
  projectNama: string;
  /** Nilai Task Name yang disimpan: "<kode>_<nama>" */
  task: string;
  taskKode: string;
  taskNama: string;
}

const RE_BARIS = /^([^:]+):(.+)_(\d{6})_(.+)$/;

export const PROJECT_TASK_AWAL: readonly PasanganProjectTask[] = DATA_MENTAH.split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => {
    const m = RE_BARIS.exec(l);
    if (!m) throw new Error(`Baris project/task tidak valid: ${l}`);
    return { project: `${m[1]}:${m[2]}`, projectKode: m[1], projectNama: m[2], task: `${m[3]}_${m[4]}`, taskKode: m[3], taskNama: m[4] };
  });
