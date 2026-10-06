// Konstanta domain — satu-satunya sumber nilai enum untuk server & client.
// Mengubah daftar di sini = mengubah aturan bisnis → perbarui CLAUDE.md & test.

export const KATEGORI_LIST = ['konsumsi', 'rumah_tangga', 'perjadin'] as const;
export type Kategori = (typeof KATEGORI_LIST)[number];

export interface KategoriInfo {
  label: string;
  labelPendek: string;
  jenis: 'konsumsi' | 'transport';
  prefix: string;
  deskripsi: string;
}

export const KATEGORI_INFO: Record<Kategori, KategoriInfo> = {
  konsumsi: {
    label: 'Konsumsi',
    labelPendek: 'Konsumsi',
    jenis: 'konsumsi',
    prefix: 'KSM',
    deskripsi: 'Konsumsi rapat / kegiatan',
  },
  rumah_tangga: {
    label: 'Transport Rumah Tangga',
    labelPendek: 'Rumah Tangga',
    jenis: 'transport',
    prefix: 'TRT',
    deskripsi: 'Transport kegiatan rumah tangga (maks. 2 orang)',
  },
  perjadin: {
    label: 'Transport Perjadin',
    labelPendek: 'Perjadin',
    jenis: 'transport',
    prefix: 'TPD',
    deskripsi: 'Perjalanan dinas dalam / luar kota (maks. 2 orang)',
  },
};

/**
 * Alur: draft → diajukan_pum → (dikembalikan ↺) → diajukan_mdk → selesai (paid).
 * MDK berada di luar sistem: "diajukan_mdk" hanya status menunggu invoice; No. Invoice MDK diinput oleh PUM.
 */
export const STATUS_LIST = ['draft', 'diajukan_pum', 'dikembalikan', 'diajukan_mdk', 'selesai'] as const;
export type Status = (typeof STATUS_LIST)[number];

export const STATUS_INFO: Record<Status, { label: string; deskripsi: string }> = {
  draft: { label: 'Draft', deskripsi: 'Disimpan, belum diajukan' },
  diajukan_pum: { label: 'Diajukan ke PUM', deskripsi: 'Menunggu pemeriksaan berkas oleh PUM' },
  dikembalikan: { label: 'Dikembalikan', deskripsi: 'Perlu revisi sesuai catatan PUM' },
  diajukan_mdk: { label: 'Diajukan ke MDK', deskripsi: 'Diteruskan PUM ke MDK, menunggu invoice' },
  selesai: { label: 'Selesai (Paid)', deskripsi: 'No. Invoice MDK sudah diinput PUM' },
};

export const MEKANISME_LIST = ['KO', 'LS'] as const;
export type Mekanisme = (typeof MEKANISME_LIST)[number];

export const JENIS_UANG_LIST = ['uang_harian', 'uang_transport'] as const;
export type JenisUang = (typeof JENIS_UANG_LIST)[number];
export const JENIS_UANG_LABEL: Record<JenisUang, string> = {
  uang_harian: 'Uang Harian',
  uang_transport: 'Uang Transport',
};

export const JENIS_TRANSPORT_LIST = ['dalam_kota', 'luar_kota'] as const;
export type JenisTransport = (typeof JENIS_TRANSPORT_LIST)[number];
export const JENIS_TRANSPORT_LABEL: Record<JenisTransport, string> = {
  dalam_kota: 'Dalam Kota',
  luar_kota: 'Luar Kota',
};

export const JENIS_BERKAS_LIST = [
  'notulen',
  'undangan',
  'invoice',
  'daftar_hadir',
  'surat_tugas',
  'laporan_kegiatan',
  'invoice_hotel',
  'invoice_tiket',
  'lainnya',
] as const;
export type JenisBerkas = (typeof JENIS_BERKAS_LIST)[number];
export type JenisBerkasWajib = Exclude<JenisBerkas, 'lainnya'>;

export const JENIS_BERKAS_LABEL: Record<JenisBerkas, string> = {
  // Kunci internal tetap `notulen` (sudah tersimpan di DB & dipakai API); label resmi yang tampil: "Notula".
  notulen: 'Notula',
  undangan: 'Undangan',
  invoice: 'Invoice',
  daftar_hadir: 'Daftar Hadir',
  surat_tugas: 'Surat Tugas',
  laporan_kegiatan: 'Laporan Kegiatan',
  invoice_hotel: 'Invoice Hotel',
  invoice_tiket: 'Invoice Tiket',
  lainnya: 'Dokumen Lainnya',
};

/** Berkas wajib per kategori (urutan = urutan tampil). "lainnya" selalu opsional. */
export const BERKAS_WAJIB: Record<Kategori, readonly JenisBerkasWajib[]> = {
  konsumsi: ['notulen', 'undangan', 'invoice', 'daftar_hadir'],
  rumah_tangga: ['surat_tugas', 'laporan_kegiatan'],
  perjadin: ['surat_tugas', 'laporan_kegiatan', 'invoice_hotel', 'invoice_tiket'],
};

/** Hasil pemeriksaan (centang) berkas oleh PUM. */
export const STATUS_CEK_LIST = ['sesuai', 'revisi'] as const;
export type StatusCek = (typeof STATUS_CEK_LIST)[number];

export const ROLE_LIST = ['operator', 'pum', 'pimpinan', 'admin'] as const;
export type Role = (typeof ROLE_LIST)[number];
export const ROLE_LABEL: Record<Role, string> = {
  operator: 'Operator / Pengaju',
  pum: 'PUM',
  pimpinan: 'Pimpinan',
  admin: 'Administrator',
};
export const ROLE_KETERANGAN: Record<Role, string> = {
  operator: 'Membuat pengajuan, mengunggah berkas, dan mengajukan ke PUM',
  pum: 'Memeriksa & mencentang berkas, mengembalikan, meneruskan ke MDK, dan menginput No. Invoice MDK',
  pimpinan: 'Memantau dashboard, daftar pengajuan, serta rekap & laporan (hanya lihat)',
  admin: 'Semua akses termasuk kelola pengguna & master data',
};

/** Peran yang boleh melihat pengajuan berstatus draft. */
export const ROLE_LIHAT_DRAFT: readonly Role[] = ['operator', 'admin'];
/** Peran yang membuat & mengelola pengajuan (operator/pengaju). */
export const ROLE_PENGAJU: readonly Role[] = ['operator', 'admin'];
/** Peran yang memeriksa berkas & memproses (PUM). */
export const ROLE_PUM: readonly Role[] = ['pum', 'admin'];

export const MAX_PESERTA_TRANSPORT = 2;
export const MAX_NILAI = 1_000_000_000_000;
export const MAX_UPLOAD_MB = 10;

/** Ekstensi & MIME yang boleh diunggah sebagai berkas. */
export const UPLOAD_DIIZINKAN: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};
export const UPLOAD_ACCEPT = Object.keys(UPLOAD_DIIZINKAN).join(',');

export const AKSI_RIWAYAT_LIST = [
  'dibuat',
  'diubah',
  'dihapus',
  'berkas_diunggah',
  'berkas_dihapus',
  'berkas_na',
  'berkas_na_batal',
  'diajukan',
  'ditarik',
  'berkas_dicek',
  'berkas_revisi',
  'berkas_cek_batal',
  'dikembalikan',
  'diteruskan_mdk',
  'data_pum_diubah',
  'selesai',
  'invoice_diubah',
  'selesai_dibatalkan',
] as const;
export type AksiRiwayat = (typeof AKSI_RIWAYAT_LIST)[number];

export const AKSI_RIWAYAT_LABEL: Record<AksiRiwayat, string> = {
  dibuat: 'Pengajuan dibuat',
  diubah: 'Data diperbarui',
  dihapus: 'Pengajuan dihapus',
  berkas_diunggah: 'Berkas diunggah',
  berkas_dihapus: 'Berkas dihapus',
  berkas_na: 'Berkas ditandai tidak diperlukan',
  berkas_na_batal: 'Tanda "tidak diperlukan" dibatalkan',
  diajukan: 'Diajukan ke PUM',
  ditarik: 'Ditarik kembali ke draft',
  berkas_dicek: 'Berkas dicentang sesuai oleh PUM',
  berkas_revisi: 'Berkas ditandai perlu revisi',
  berkas_cek_batal: 'Centang berkas dibatalkan',
  dikembalikan: 'Dikembalikan oleh PUM',
  diteruskan_mdk: 'Diteruskan ke MDK',
  data_pum_diubah: 'Project hosting / task name diperbarui',
  selesai: 'Invoice MDK diinput — selesai (paid)',
  invoice_diubah: 'Data invoice MDK diubah',
  selesai_dibatalkan: 'Status selesai dibatalkan',
};

export const JENIS_NOTIFIKASI_LIST = ['diajukan', 'dikembalikan', 'diteruskan_mdk', 'selesai', 'selesai_dibatalkan'] as const;
export type JenisNotifikasi = (typeof JENIS_NOTIFIKASI_LIST)[number];
