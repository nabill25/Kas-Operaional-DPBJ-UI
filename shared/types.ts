// Bentuk data yang dikirim API (server) dan dipakai client.
import type {
  AksiRiwayat,
  JenisBerkas,
  JenisBerkasWajib,
  JenisNotifikasi,
  JenisTransport,
  JenisUang,
  Kategori,
  Mekanisme,
  Role,
  Status,
  StatusCek,
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
  aktif: boolean;
  /** Jumlah pengajuan yang memakai pegawai ini (sebagai uang siapa / peserta). */
  dipakai: number;
  created_at: string;
  updated_at: string;
}

export interface PesertaInput {
  pegawai_id: number;
  nilai: number;
}

export interface Peserta {
  id: number;
  pegawai_id: number;
  nama: string;
  nip: string | null;
  jabatan: string | null;
  nilai: number;
  urutan: number;
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
  jenis: JenisBerkasWajib;
  status: StatusCek;
  catatan: string | null;
  diperiksa_by: number;
  diperiksa_by_nama: string;
  diperiksa_at: string;
}

export interface KelengkapanItem {
  jenis: JenisBerkasWajib;
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
  /** Semua berkas wajib sudah dicentang sesuai → boleh diteruskan ke MDK. */
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
  uang_siapa_id: number | null;
  uang_siapa_nama: string | null;
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
  diteruskan_at: string | null;
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
  diteruskan_by: number | null;
  diteruskan_by_nama: string | null;
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
  total?: number | null;
  uang_siapa_id?: number | null;
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
    diajukan_mdk: JumlahNilai;
    selesai: JumlahNilai;
    /** null untuk peran yang tidak melihat draft (PUM, pimpinan). */
    draft: JumlahNilai | null;
    belumLengkap: number;
    /** Rata-rata hari dari diajukan ke PUM hingga selesai (paid). */
    rataProsesHari: number | null;
  };
  perBulan: { bulan: number; konsumsi: number; rumah_tangga: number; perjadin: number; jumlah: number }[];
  perKategori: { kategori: Kategori; jumlah: number; nilai: number }[];
  perMekanisme: { mekanisme: Mekanisme; jumlah: number; nilai: number }[];
  topPegawai: {
    pegawai_id: number;
    nama: string;
    konsumsi: number;
    rumah_tangga: number;
    perjadin: number;
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
  konsumsi: number;
  rumah_tangga: number;
  perjadin: number;
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

export interface ApiErrorBody {
  message: string;
  errors?: Record<string, string>;
}
