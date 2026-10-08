// Konstanta domain — satu-satunya sumber nilai enum untuk server & client.
// Mengubah daftar di sini = mengubah aturan bisnis → perbarui CLAUDE.md & test.

/**
 * Kategori = kode jenis pengajuan. Daftarnya master data (tabel jenis_pengajuan, menu Master Data → Jenis Pengajuan),
 * bukan konstanta: admin bisa menambah jenis baru (mis. Kontrak Borongan). Tiga jenis bawaan di bawah ini selalu ada.
 */
export type Kategori = string;
export const KATEGORI_BAWAAN = ['konsumsi', 'rumah_tangga', 'perjadin'] as const;

/**
 * Model form jenis pengajuan — menentukan isian & aturan validasi:
 * - konsumsi: jenis konsumsi, jumlah orang, jumlah uang, "uang siapa" (+ rekening), tanda sudah dibayarkan
 * - rumah_tangga: lokasi tujuan + penerima per orang (nilai uang)
 * - perjadin: tanggal dari–sampai, lokasi, jenis transport + uang harian & uang transport per orang
 * - umum: tanggal (opsional sampai) + pegawai & nilai per orang — untuk jenis baru yang intinya mengumpulkan berkas
 */
export const MODEL_FORM_LIST = ['konsumsi', 'rumah_tangga', 'perjadin', 'umum'] as const;
export type ModelForm = (typeof MODEL_FORM_LIST)[number];
export const MODEL_FORM_INFO: Record<ModelForm, { label: string; deskripsi: string; grup: string }> = {
  konsumsi: {
    label: 'Seperti Konsumsi',
    deskripsi: 'Jenis konsumsi, jumlah orang, jumlah uang, dan "uang siapa" beserta rekeningnya',
    grup: 'Konsumsi',
  },
  rumah_tangga: {
    label: 'Seperti Transport Rumah Tangga',
    deskripsi: 'Lokasi tujuan dan nilai uang per orang',
    grup: 'Transport',
  },
  perjadin: {
    label: 'Seperti Transport Perjadin',
    deskripsi: 'Tanggal dari–sampai, lokasi, jenis transport, uang harian & uang transport per orang',
    grup: 'Transport',
  },
  umum: {
    label: 'Umum (pegawai + nilai per orang)',
    deskripsi: 'Tanggal (bisa berupa periode) dan nilai per pegawai — cocok untuk pengajuan yang intinya mengumpulkan berkas',
    grup: 'Umum',
  },
};

/** Model form yang mencatat penerima per orang (tabel pengajuan_peserta). Konsumsi memakai "uang siapa". */
export function modelPeserta(model: ModelForm): boolean {
  return model !== 'konsumsi';
}

/**
 * Palet warna jenis pengajuan (penanda chart/badge, bukan teks). Nilai warnanya di src/components/dashboard/palet.ts.
 * `abu` hanya cadangan untuk kode yang tidak dikenal — tidak dapat dipilih admin (terlalu mirip warna lain bagi buta warna).
 */
export const WARNA_JENIS_LIST = ['kuning', 'biru', 'hijau', 'merah', 'ungu', 'toska', 'abu'] as const;
export type WarnaJenis = (typeof WARNA_JENIS_LIST)[number];
export const WARNA_JENIS_PILIHAN: readonly WarnaJenis[] = ['kuning', 'biru', 'hijau', 'merah', 'ungu', 'toska'];
export const WARNA_JENIS_LABEL: Record<WarnaJenis, string> = {
  kuning: 'Kuning',
  biru: 'Biru',
  hijau: 'Hijau',
  merah: 'Merah bata',
  ungu: 'Ungu',
  toska: 'Toska',
  abu: 'Abu-abu (cadangan)',
};

/** Ikon jenis pengajuan (nama ikon lucide; petanya di src/components/ui/Badge.tsx). */
export const IKON_JENIS_LIST = [
  'coffee',
  'car',
  'plane',
  'briefcase',
  'hard-hat',
  'clipboard-list',
  'file-text',
  'users',
  'wrench',
  'package',
  'graduation-cap',
  'receipt',
] as const;
export type IkonJenis = (typeof IKON_JENIS_LIST)[number];

/**
 * Alur: draft → diajukan_pum → (dikembalikan ↺) → diverifikasi_pum → diajukan_mdk → selesai (paid).
 * MDK berada di luar sistem: PUM menginput No. Invoice MDK saat mengajukan ke MDK (status "diajukan_mdk",
 * menunggu verifikasi MDK), lalu menekan "Selesai" setelah proses di MDK selesai.
 */
export const STATUS_LIST = ['draft', 'diajukan_pum', 'dikembalikan', 'diverifikasi_pum', 'diajukan_mdk', 'selesai'] as const;
export type Status = (typeof STATUS_LIST)[number];

export const STATUS_INFO: Record<Status, { label: string; deskripsi: string }> = {
  draft: { label: 'Draft', deskripsi: 'Disimpan, belum diajukan' },
  diajukan_pum: { label: 'Diajukan ke PUM', deskripsi: 'Menunggu pemeriksaan berkas oleh PUM' },
  dikembalikan: { label: 'Dikembalikan', deskripsi: 'Perlu revisi sesuai catatan PUM' },
  diverifikasi_pum: { label: 'Diverifikasi PUM', deskripsi: 'Berkas sudah diverifikasi PUM, menunggu input invoice MDK' },
  diajukan_mdk: { label: 'Diajukan ke MDK', deskripsi: 'Invoice sudah diinput PUM, menunggu verifikasi MDK' },
  selesai: { label: 'Selesai (Paid)', deskripsi: 'Proses MDK selesai, ditandai selesai oleh PUM' },
};

/** Status yang sudah melewati verifikasi PUM (berkas & data terkunci, project costing/task bisa diubah PUM). */
export const STATUS_LEWAT_VERIFIKASI: readonly Status[] = ['diverifikasi_pum', 'diajukan_mdk', 'selesai'];

export const MEKANISME_LIST = ['KO', 'LS'] as const;
export type Mekanisme = (typeof MEKANISME_LIST)[number];

/** Data lama Perjadin (sebelum uang harian & uang transport diisi terpisah per orang). Tidak diisi lagi. */
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

/** Jenis konsumsi (wajib untuk kategori Konsumsi). */
export const JENIS_KONSUMSI_LIST = ['kudapan', 'makan_siang', 'kudapan_makan_siang'] as const;
export type JenisKonsumsi = (typeof JENIS_KONSUMSI_LIST)[number];
export const JENIS_KONSUMSI_LABEL: Record<JenisKonsumsi, string> = {
  kudapan: 'Kudapan',
  makan_siang: 'Makan Siang',
  kudapan_makan_siang: 'Kudapan + Makan Siang',
};

/**
 * Jenis berkas = kode master data (tabel jenis_berkas, menu Master Data → Jenis Berkas); berkas wajib tiap jenis
 * pengajuan diatur di master Jenis Pengajuan. "lainnya" (Dokumen Lainnya) bukan bagian master: selalu opsional,
 * boleh banyak, dan diberi nama sendiri. Kunci bawaan `notulen` tetap (label tampil "Notula").
 */
export type JenisBerkas = string;
export const JENIS_BERKAS_LAINNYA = 'lainnya';
export const LABEL_BERKAS_LAINNYA = 'Dokumen Lainnya';

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
  pum: 'Memeriksa & mencentang berkas, mengembalikan, memverifikasi, menginput No. Invoice MDK, dan menandai selesai',
  pimpinan: 'Memantau dashboard, daftar pengajuan, serta rekap & laporan (hanya lihat)',
  admin: 'Semua akses termasuk kelola pengguna & master data',
};

/** Peran yang boleh melihat pengajuan berstatus draft. */
export const ROLE_LIHAT_DRAFT: readonly Role[] = ['operator', 'admin'];
/** Peran yang membuat & mengelola pengajuan (operator/pengaju). */
export const ROLE_PENGAJU: readonly Role[] = ['operator', 'admin'];
/** Peran yang memeriksa berkas & memproses (PUM). */
export const ROLE_PUM: readonly Role[] = ['pum', 'admin'];

/** Status saat PUM boleh menandai uang konsumsi "sudah dibayarkan" ke pemilik uang. */
export const STATUS_BISA_DIBAYARKAN: readonly Status[] = ['diajukan_pum', 'diverifikasi_pum', 'diajukan_mdk', 'selesai'];

export const CATATAN_BIAYA_TRANSFER = 'Jika bukan Bank Mandiri, biaya transfer akan dibebankan kepada pemilik rekening.';

/** Rekening Bank Mandiri (bebas biaya transfer). "Mandiri Syariah" lama kini BSI, jadi tidak dihitung. */
export function isBankMandiri(bank: string | null | undefined): boolean {
  return !!bank && /\bmandiri\b/i.test(bank) && !/syariah/i.test(bank);
}

/** Batas orang per pengajuan bila master jenis pengajuan tidak mengaturnya (Transport bawaan: 2). */
export const MAX_PESERTA_TRANSPORT = 2;
/** Batas orang bawaan untuk jenis pengajuan baru (bisa diubah admin, 1–50). */
export const MAKS_PESERTA_BARU = 10;
export const MAKS_PESERTA_BATAS = 50;
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
  'dibayarkan',
  'dibayarkan_batal',
  'diverifikasi',
  'diajukan_mdk',
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
  // Data lama (alur sebelum Okt 2026): PUM menyetujui berkas & meneruskan ke MDK sekaligus.
  diteruskan_mdk: 'Diteruskan ke MDK',
  data_pum_diubah: 'Project costing / task name diperbarui',
  selesai: 'Selesai (paid)',
  invoice_diubah: 'Data invoice MDK diubah',
  selesai_dibatalkan: 'Status selesai dibatalkan',
  dibayarkan: 'Uang ditandai sudah dibayarkan',
  dibayarkan_batal: 'Tanda sudah dibayarkan dibatalkan',
  diverifikasi: 'Diverifikasi PUM',
  diajukan_mdk: 'Diajukan ke MDK (invoice diinput)',
};

export const JENIS_NOTIFIKASI_LIST = [
  'diajukan',
  'dikembalikan',
  /** Data lama (alur sebelum Okt 2026). */
  'diteruskan_mdk',
  'selesai',
  'selesai_dibatalkan',
  /** Pendaftaran akun mandiri menunggu persetujuan (ke admin). */
  'registrasi',
  /** Uang konsumsi sudah dibayarkan PUM ke pemilik uang (ke pengaju). */
  'dibayarkan',
  /** Berkas diverifikasi PUM (ke pengaju). */
  'diverifikasi',
  /** Invoice diinput PUM → diajukan ke MDK (ke pengaju). */
  'diajukan_mdk',
] as const;
export type JenisNotifikasi = (typeof JENIS_NOTIFIKASI_LIST)[number];
