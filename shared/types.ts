// Bentuk data yang dikirim API (server) dan dipakai client.
import type {
  AksiRiwayat,
  IkonJenis,
  JenisBerkas,
  JenisNotifikasi,
  JenisKonsumsi,
  JenisTransport,
  JenisUang,
  Kategori,
  Mekanisme,
  ModelForm,
  Role,
  Status,
  StatusCek,
  WarnaJenis,
} from './constants';

export interface User {
  id: number;
  username: string;
  nama: string;
  role: Role;
  aktif: boolean;
  /** Mendaftar sendiri lewat halaman Daftar dan belum disetujui admin (belum bisa masuk). */
  menunggu_persetujuan: boolean;
  created_at: string;
  updated_at: string;
}

export interface Pegawai {
  id: number;
  nama: string;
  nip: string | null;
  jabatan: string | null;
  /** Rekening pegawai (opsional, berpasangan) — mengisi otomatis rekening "uang siapa" di form Konsumsi. */
  rekening_bank: string | null;
  rekening_nomor: string | null;
  aktif: boolean;
  /** Jumlah pengajuan yang memakai pegawai ini (sebagai uang siapa / peserta). */
  dipakai: number;
  created_at: string;
  updated_at: string;
}

export interface PesertaInput {
  pegawai_id: number;
  /** Rumah Tangga: nilai uang. Perjadin: uang harian + uang transport (dihitung server). */
  nilai: number;
  /** Hanya Perjadin (Rupiah, boleh 0); Rumah Tangga: null. */
  uang_harian?: number | null;
  uang_transport?: number | null;
}

export interface Peserta {
  id: number;
  pegawai_id: number;
  nama: string;
  nip: string | null;
  jabatan: string | null;
  nilai: number;
  /** Perjadin: rincian nilai. Rumah Tangga: null. */
  uang_harian: number | null;
  uang_transport: number | null;
  urutan: number;
  /** Rekening pegawai saat ini (dari master Pegawai), tujuan pembayaran per orang. */
  rekening_bank: string | null;
  rekening_nomor: string | null;
}

export interface Berkas {
  id: number;
  pengajuan_id: number;
  jenis: JenisBerkas;
  nama_berkas: string | null;
  nama_asli: string;
  mime: string;
  ukuran: number;
  uploaded_by: number;
  uploaded_by_nama: string;
  created_at: string;
}

/** Hasil centang/pemeriksaan satu jenis berkas wajib oleh PUM. */
export interface CekBerkas {
  jenis: JenisBerkas;
  status: StatusCek;
  catatan: string | null;
  diperiksa_by: number;
  diperiksa_by_nama: string;
  diperiksa_at: string;
}

export interface KelengkapanItem {
  jenis: JenisBerkas;
  label: string;
  jumlah: number;
  na: boolean;
  terpenuhi: boolean;
  cek: CekBerkas | null;
}

export interface Kelengkapan {
  items: KelengkapanItem[];
  terpenuhi: number;
  total: number;
  lengkap: boolean;
  persen: number;
  /** Jumlah berkas wajib yang sudah dicentang "sesuai" oleh PUM. */
  sesuai: number;
  /** Jumlah berkas wajib yang ditandai "perlu revisi" oleh PUM. */
  revisi: number;
  /** Semua berkas wajib sudah dicentang sesuai → boleh diverifikasi PUM. */
  semuaSesuai: boolean;
}

export interface Riwayat {
  id: number;
  pengajuan_id: number | null;
  kode: string;
  user_id: number | null;
  user_nama: string | null;
  aksi: AksiRiwayat;
  keterangan: string | null;
  created_at: string;
}

/** Baris ringkas untuk daftar/rekap. */
export interface PengajuanRingkas {
  id: number;
  kode: string;
  kategori: Kategori;
  nama_kegiatan: string;
  tanggal_kegiatan: string;
  tanggal_selesai: string | null;
  jumlah_orang: number;
  lokasi_tujuan: string | null;
  mekanisme: Mekanisme;
  jenis_uang: JenisUang | null;
  jenis_transport: JenisTransport | null;
  jenis_konsumsi: JenisKonsumsi | null;
  uang_siapa_id: number | null;
  uang_siapa_nama: string | null;
  /** Rekening "uang siapa" (konsumsi, opsional). */
  rekening_bank: string | null;
  rekening_nomor: string | null;
  /** Konsumsi: kapan & oleh siapa PUM menandai uang sudah dibayarkan ke pemilik uang. */
  dibayar_at: string | null;
  dibayar_by: number | null;
  dibayar_by_nama: string | null;
  /** Nama penerima: "uang siapa" (konsumsi) atau nama peserta (transport), dipisah koma. */
  penerima: string;
  total: number;
  status: Status;
  no_invoice_mdk: string | null;
  tanggal_invoice_mdk: string | null;
  project_hosting: string | null;
  task_name: string | null;
  berkas_terpenuhi: number;
  berkas_wajib: number;
  /** Jumlah berkas wajib yang sudah dicentang sesuai oleh PUM. */
  berkas_sesuai: number;
  created_by: number;
  created_by_nama: string;
  created_at: string;
  updated_at: string;
  diajukan_at: string | null;
  /** Waktu PUM memverifikasi (semua berkas sesuai). */
  diverifikasi_at: string | null;
  /** Waktu PUM menginput No. Invoice MDK = diajukan ke MDK. */
  diajukan_mdk_at: string | null;
  /** Waktu dikembalikan PUM (status dikembalikan) atau ditandai selesai/paid (status selesai). */
  diproses_at: string | null;
}

export interface PengajuanDetail extends PengajuanRingkas {
  catatan: string | null;
  catatan_pum: string | null;
  berkas_na: string[];
  peserta: Peserta[];
  berkas: Berkas[];
  riwayat: Riwayat[];
  kelengkapan: Kelengkapan;
  updated_by_nama: string | null;
  diverifikasi_by: number | null;
  diverifikasi_by_nama: string | null;
  diajukan_mdk_by: number | null;
  diajukan_mdk_by_nama: string | null;
  diproses_by: number | null;
  diproses_by_nama: string | null;
}

export interface PengajuanInput {
  kategori: Kategori;
  nama_kegiatan: string;
  tanggal_kegiatan: string;
  tanggal_selesai?: string | null;
  jumlah_orang?: number | null;
  lokasi_tujuan?: string | null;
  mekanisme: Mekanisme;
  jenis_uang?: JenisUang | null;
  jenis_transport?: JenisTransport | null;
  jenis_konsumsi?: JenisKonsumsi | null;
  total?: number | null;
  uang_siapa_id?: number | null;
  rekening_bank?: string | null;
  rekening_nomor?: string | null;
  catatan?: string | null;
  peserta?: PesertaInput[];
}

export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  /** Jumlah nilai seluruh hasil filter (bukan hanya halaman ini). */
  nilai: number;
}

export interface JumlahNilai {
  jumlah: number;
  nilai: number;
}

export interface DashboardData {
  tahun: number;
  tahunTersedia: number[];
  kpi: {
    /** Semua pengajuan yang sudah diajukan (selain draft). */
    total: JumlahNilai;
    diajukan_pum: JumlahNilai;
    dikembalikan: JumlahNilai;
    diverifikasi_pum: JumlahNilai;
    diajukan_mdk: JumlahNilai;
    selesai: JumlahNilai;
    /** null untuk peran yang tidak melihat draft (PUM, pimpinan). */
    draft: JumlahNilai | null;
    belumLengkap: number;
    /** Rata-rata hari dari diajukan ke PUM hingga selesai (paid). */
    rataProsesHari: number | null;
  };
  /** Nilai per bulan; `perKategori` berisi nilai per kode jenis pengajuan (hanya yang > 0). */
  perBulan: { bulan: number; jumlah: number; nilai: number; perKategori: Record<Kategori, number> }[];
  /** Urut master; berisi jenis aktif + jenis nonaktif yang punya data pada tahun itu. */
  perKategori: { kategori: Kategori; jumlah: number; nilai: number }[];
  perMekanisme: { mekanisme: Mekanisme; jumlah: number; nilai: number }[];
  topPegawai: {
    pegawai_id: number;
    nama: string;
    /** Nilai per kode jenis pengajuan (hanya yang > 0). */
    perKategori: Record<Kategori, number>;
    total: number;
    jumlah: number;
  }[];
  aktivitas: Riwayat[];
  perluTindakan: PengajuanRingkas[];
}

export interface RekapFilter {
  dari?: string;
  sampai?: string;
  kategori?: Kategori | '';
  status?: Status | 'semua' | '';
  mekanisme?: Mekanisme | '';
}

export interface RekapPengajuanData {
  rows: PengajuanRingkas[];
  ringkasan: {
    jumlah: number;
    nilai: number;
    /** Per kode jenis pengajuan: semua jenis di master + kode lain yang muncul di data. */
    perKategori: Record<Kategori, JumlahNilai>;
    perStatus: Record<Status, JumlahNilai>;
    perMekanisme: Record<Mekanisme, JumlahNilai>;
  };
}

export interface RekapPegawaiRow {
  pegawai_id: number;
  nama: string;
  nip: string | null;
  jabatan: string | null;
  jumlah: number;
  /** Nilai per kode jenis pengajuan (hanya yang > 0). Jumlahnya = total. */
  perKategori: Record<Kategori, number>;
  total: number;
}

export interface RekapPegawaiData {
  rows: RekapPegawaiRow[];
  total: number;
}

export interface RekapPegawaiDetailItem {
  pengajuan_id: number;
  kode: string;
  kategori: Kategori;
  nama_kegiatan: string;
  tanggal_kegiatan: string;
  tanggal_selesai: string | null;
  lokasi_tujuan: string | null;
  mekanisme: Mekanisme;
  status: Status;
  peran: 'uang_siapa' | 'peserta';
  nilai: number;
  no_invoice_mdk: string | null;
}

export interface RekapPegawaiDetail {
  pegawai: Pegawai;
  items: RekapPegawaiDetailItem[];
  total: number;
}

export interface Notifikasi {
  id: number;
  pengajuan_id: number | null;
  kode: string;
  jenis: JenisNotifikasi;
  judul: string;
  pesan: string;
  dibaca: boolean;
  created_at: string;
}

export interface NotifikasiData {
  belumDibaca: number;
  items: Notifikasi[];
  /** Jumlah pengajuan per tahap yang relevan untuk peran (badge menu). */
  antrian: {
    diajukan_pum: number;
    diverifikasi_pum: number;
    diajukan_mdk: number;
    dikembalikan: number;
    /** Pendaftaran akun yang menunggu persetujuan (hanya untuk admin). */
    pendaftar: number;
  };
}

export interface SaranPum {
  project_hosting: string[];
  task_name: string[];
}

// ───────────── Master data ─────────────

export interface JenisPengajuan {
  kode: Kategori;
  label: string;
  label_pendek: string;
  /** Awalan kode pengajuan, mis. "KSM" → KSM-2026-0001. */
  prefix: string;
  deskripsi: string | null;
  model: ModelForm;
  /** Batas orang per pengajuan (model selain konsumsi). */
  maks_peserta: number | null;
  /** Kata kunci nama task untuk saran Task Name otomatis, mis. "konsumsi". */
  kata_kunci_task: string | null;
  warna: WarnaJenis;
  ikon: IkonJenis;
  aktif: boolean;
  /** Jenis bawaan sistem: tidak dapat dihapus, model & kode tetap. */
  bawaan: boolean;
  urutan: number;
  /** Kode jenis berkas wajib, urut tampil. */
  berkas: JenisBerkas[];
  /** Jumlah pengajuan berjenis ini (hanya pada daftar master). */
  dipakai?: number;
}

export interface JenisBerkasMaster {
  kode: JenisBerkas;
  label: string;
  keterangan: string | null;
  aktif: boolean;
  bawaan: boolean;
  urutan: number;
  /** Pemakaian (hanya pada daftar master): jenis pengajuan yang mewajibkan & jumlah file terunggah. */
  dipakai?: { jenis_pengajuan: string[]; berkas: number };
}

/** Konfigurasi master yang dibutuhkan semua halaman (dimuat sekali setelah login). */
export interface Konfig {
  jenisPengajuan: JenisPengajuan[];
  jenisBerkas: JenisBerkasMaster[];
}

export interface Bank {
  id: number;
  nama: string;
  aktif: boolean;
  /** Jumlah pemakaian nama bank ini (rekening pengajuan & pegawai) — hanya informasi. */
  dipakai: number;
}

export interface MasterProject {
  id: number;
  kode: string;
  nama: string;
  aktif: boolean;
  /** Id task yang sah untuk project ini. */
  task_ids: number[];
}

export interface MasterTask {
  id: number;
  kode: string;
  nama: string;
  aktif: boolean;
}

export interface MasterProjectTask {
  project: MasterProject[];
  task: MasterTask[];
}

export interface ApiErrorBody {
  message: string;
  errors?: Record<string, string>;
}
