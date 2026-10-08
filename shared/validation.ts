// Validasi input — dipakai server (otoritatif) dan client (umpan balik instan).
// Pesan error berbahasa Indonesia; key error = nama field (peserta: "peserta.<i>.<field>").
import {
  IKON_JENIS_LIST,
  JENIS_BERKAS_LAINNYA,
  JENIS_TRANSPORT_LIST,
  JENIS_KONSUMSI_LIST,
  LABEL_BERKAS_LAINNYA,
  MAKS_PESERTA_BATAS,
  MAX_NILAI,
  MEKANISME_LIST,
  MODEL_FORM_LIST,
  ROLE_LIST,
  STATUS_CEK_LIST,
  WARNA_JENIS_PILIHAN,
  modelPeserta,
  type IkonJenis,
  type JenisTransport,
  type JenisKonsumsi,
  type JenisUang,
  type Kategori,
  type Mekanisme,
  type ModelForm,
  type Role,
  type StatusCek,
  type WarnaJenis,
} from './constants.js';
import { lamaHari } from './format.js';
import { maksPeserta } from './konfig.js';
import type { JenisPengajuan, PesertaInput } from './types.js';

export type FieldErrors = Record<string, string>;
export type Hasil<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

export interface PengajuanBersih {
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
  total: number;
  uang_siapa_id: number | null;
  rekening_bank: string | null;
  rekening_nomor: string | null;
  catatan: string | null;
  peserta: PesertaInput[];
}

const RE_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isTanggalValid(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = RE_TANGGAL.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function objek(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Teks satu baris: trim + rapikan spasi berlebih. */
function teks(v: unknown): string {
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
}

/** Teks multi-baris: hanya trim. */
function teksPanjang(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** null = kosong; NaN = tidak valid; selain itu bilangan bulat aman. */
function keInteger(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isSafeInteger(v) ? v : Number.NaN;
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) {
    const n = Number(v.trim());
    return Number.isSafeInteger(n) ? n : Number.NaN;
  }
  return Number.NaN;
}

function termasuk<T extends string>(daftar: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (daftar as readonly string[]).includes(v);
}

/** Rekening (bank + nomor): opsional, tetapi harus diisi berpasangan. Spasi/titik/strip pada nomor dibuang. */
function validasiRekening(
  bankRaw: unknown,
  nomorRaw: unknown,
  e: FieldErrors,
  kunci: { bank: string; nomor: string } = { bank: 'rekening_bank', nomor: 'rekening_nomor' },
): { bank: string | null; nomor: string | null } {
  const bank = teks(bankRaw);
  const nomor = teks(nomorRaw).replace(/[\s.-]/g, '');
  if (!bank && !nomor) return { bank: null, nomor: null };
  let hasilBank: string | null = null;
  let hasilNomor: string | null = null;
  if (!bank) e[kunci.bank] = 'Isi nama bank';
  else if (bank.length < 2) e[kunci.bank] = 'Nama bank minimal 2 karakter';
  else if (bank.length > 60) e[kunci.bank] = 'Nama bank maksimal 60 karakter';
  else hasilBank = bank;

  if (!nomor) e[kunci.nomor] = 'Isi nomor rekening';
  else if (!/^\d+$/.test(nomor)) e[kunci.nomor] = 'Nomor rekening hanya boleh berisi angka';
  else if (nomor.length < 5 || nomor.length > 30) e[kunci.nomor] = 'Nomor rekening harus 5–30 digit';
  else hasilNomor = nomor;
  return { bank: hasilBank, nomor: hasilNomor };
}

/**
 * Validasi pengajuan sesuai model form jenis pengajuannya (master Jenis Pengajuan).
 * `jenis` = info jenis pengajuan untuk `kategori` yang dikirim (undefined → kategori tidak dikenal).
 */
export function validatePengajuan(raw: unknown, jenis: JenisPengajuan | undefined | null): Hasil<PengajuanBersih> {
  const r = objek(raw);
  const e: FieldErrors = {};

  if (typeof r.kategori !== 'string' || !jenis || jenis.kode !== r.kategori) {
    return { ok: false, errors: { kategori: 'Jenis pengajuan tidak valid' } };
  }
  const kategori = jenis.kode;
  const model = jenis.model;

  const nama_kegiatan = teks(r.nama_kegiatan);
  if (!nama_kegiatan) e.nama_kegiatan = 'Nama kegiatan wajib diisi';
  else if (nama_kegiatan.length < 3) e.nama_kegiatan = 'Nama kegiatan minimal 3 karakter';
  else if (nama_kegiatan.length > 200) e.nama_kegiatan = 'Nama kegiatan maksimal 200 karakter';

  const tanggal_kegiatan = r.tanggal_kegiatan;
  if (tanggal_kegiatan === undefined || tanggal_kegiatan === null || tanggal_kegiatan === '') {
    e.tanggal_kegiatan =
      model === 'perjadin' ? 'Tanggal mulai (dari) wajib diisi' : model === 'umum' ? 'Tanggal wajib diisi' : 'Tanggal kegiatan wajib diisi';
  } else if (!isTanggalValid(tanggal_kegiatan)) {
    e.tanggal_kegiatan = 'Tanggal tidak valid';
  }

  if (!termasuk(MEKANISME_LIST, r.mekanisme)) e.mekanisme = 'Pilih mekanisme KO atau LS';

  const catatan = teksPanjang(r.catatan);
  if (catatan.length > 1000) e.catatan = 'Catatan maksimal 1000 karakter';

  let total = 0;
  let jumlah_orang = 0;
  let uang_siapa_id: number | null = null;
  let rekening_bank: string | null = null;
  let rekening_nomor: string | null = null;
  let lokasi_tujuan: string | null = null;
  let tanggal_selesai: string | null = null;
  // Jenis uang tidak dipilih lagi: Perjadin mengisi uang harian & uang transport per orang.
  const jenis_uang: JenisUang | null = null;
  let jenis_transport: JenisTransport | null = null;
  let jenis_konsumsi: JenisKonsumsi | null = null;
  const peserta: PesertaInput[] = [];

  if (model === 'konsumsi') {
    if (!termasuk(JENIS_KONSUMSI_LIST, r.jenis_konsumsi)) e.jenis_konsumsi = 'Pilih jenis konsumsi';
    else jenis_konsumsi = r.jenis_konsumsi;

    const jo = keInteger(r.jumlah_orang);
    if (jo === null) e.jumlah_orang = 'Jumlah orang wajib diisi';
    else if (Number.isNaN(jo) || jo < 1) e.jumlah_orang = 'Jumlah orang minimal 1';
    else if (jo > 100_000) e.jumlah_orang = 'Jumlah orang terlalu besar';
    else jumlah_orang = jo;

    const t = keInteger(r.total);
    if (t === null) e.total = 'Jumlah uang wajib diisi';
    else if (Number.isNaN(t) || t <= 0) e.total = 'Jumlah uang harus lebih dari 0';
    else if (t > MAX_NILAI) e.total = 'Jumlah uang melebihi batas maksimal';
    else total = t;

    const us = keInteger(r.uang_siapa_id);
    if (us === null || Number.isNaN(us) || us <= 0) e.uang_siapa_id = 'Pilih uang siapa yang digunakan';
    else uang_siapa_id = us;

    // Rekening pemilik uang: opsional, tetapi bank & nomor harus diisi berpasangan.
    const rek = validasiRekening(r.rekening_bank, r.rekening_nomor, e);
    rekening_bank = rek.bank;
    rekening_nomor = rek.nomor;
  } else {
    if (model === 'rumah_tangga' || model === 'perjadin') {
      const lok = teks(r.lokasi_tujuan);
      if (!lok) e.lokasi_tujuan = 'Lokasi tujuan wajib diisi';
      else if (lok.length < 2) e.lokasi_tujuan = 'Lokasi tujuan minimal 2 karakter';
      else if (lok.length > 200) e.lokasi_tujuan = 'Lokasi tujuan maksimal 200 karakter';
      else lokasi_tujuan = lok;
    }

    const maks = maksPeserta(jenis);
    const daftar = Array.isArray(r.peserta) ? r.peserta : [];
    if (daftar.length === 0) {
      e.peserta = 'Tambahkan minimal 1 orang';
    } else if (daftar.length > maks) {
      e.peserta = `Maksimal ${maks} orang per pengajuan`;
    } else {
      const sudah = new Set<number>();
      const perjadin = model === 'perjadin';
      daftar.forEach((item, i) => {
        const o = objek(item);
        const pid = keInteger(o.pegawai_id);
        let valid = true;
        if (pid === null || Number.isNaN(pid) || pid <= 0) {
          e[`peserta.${i}.pegawai_id`] = 'Pilih nama pegawai';
          valid = false;
        } else if (sudah.has(pid)) {
          e[`peserta.${i}.pegawai_id`] = 'Pegawai ini sudah dipilih';
          valid = false;
        } else {
          sudah.add(pid);
        }
        if (perjadin) {
          // Perjadin: uang harian + uang transport per orang (kosong = 0, minimal salah satu diisi).
          let uangValid = true;
          const uang = (field: 'uang_harian' | 'uang_transport', label: string): number => {
            const v = keInteger(o[field]);
            if (v === null) return 0;
            let salah = '';
            if (Number.isNaN(v)) salah = `${label} harus berupa angka`;
            else if (v < 0) salah = `${label} tidak boleh negatif`;
            else if (v > MAX_NILAI) salah = `${label} melebihi batas maksimal`;
            if (!salah) return v;
            e[`peserta.${i}.${field}`] = salah;
            uangValid = false;
            return 0;
          };
          const uang_harian = uang('uang_harian', 'Uang harian');
          const uang_transport = uang('uang_transport', 'Uang transport');
          const nilai = uang_harian + uang_transport;
          if (uangValid && nilai <= 0) {
            e[`peserta.${i}.uang_harian`] = 'Isi uang harian dan/atau uang transport';
            uangValid = false;
          } else if (uangValid && nilai > MAX_NILAI) {
            e[`peserta.${i}.uang_harian`] = 'Jumlah uang melebihi batas maksimal';
            uangValid = false;
          }
          if (valid && uangValid && pid !== null) peserta.push({ pegawai_id: pid, nilai, uang_harian, uang_transport });
          return;
        }
        const nilai = keInteger(o.nilai);
        if (nilai === null) {
          e[`peserta.${i}.nilai`] = 'Nilai uang wajib diisi';
          valid = false;
        } else if (Number.isNaN(nilai) || nilai <= 0) {
          e[`peserta.${i}.nilai`] = 'Nilai uang harus lebih dari 0';
          valid = false;
        } else if (nilai > MAX_NILAI) {
          e[`peserta.${i}.nilai`] = 'Nilai uang melebihi batas maksimal';
          valid = false;
        }
        if (valid && pid !== null && nilai !== null) {
          peserta.push({ pegawai_id: pid, nilai, uang_harian: null, uang_transport: null });
        }
      });
      jumlah_orang = daftar.length;
      total = peserta.reduce((s, p) => s + p.nilai, 0);
      if (total > MAX_NILAI) e.peserta = 'Total nilai melebihi batas maksimal';
    }

    // Perjadin: tanggal sampai wajib. Umum: boleh berupa periode (sampai opsional).
    if (model === 'perjadin' || model === 'umum') {
      const ts = r.tanggal_selesai;
      const kosong = ts === undefined || ts === null || ts === '';
      if (kosong) {
        if (model === 'perjadin') e.tanggal_selesai = 'Tanggal selesai (sampai) wajib diisi';
      } else if (!isTanggalValid(ts)) {
        e.tanggal_selesai = 'Tanggal tidak valid';
      } else if (isTanggalValid(tanggal_kegiatan) && ts < tanggal_kegiatan) {
        e.tanggal_selesai = 'Tanggal selesai tidak boleh sebelum tanggal mulai';
      } else if (isTanggalValid(tanggal_kegiatan) && lamaHari(tanggal_kegiatan, ts) > 366) {
        e.tanggal_selesai = model === 'perjadin' ? 'Lama kegiatan maksimal 366 hari' : 'Periode maksimal 366 hari';
      } else {
        tanggal_selesai = ts;
      }
    }

    if (model === 'perjadin') {
      if (!termasuk(JENIS_TRANSPORT_LIST, r.jenis_transport)) e.jenis_transport = 'Pilih jenis transport';
      else jenis_transport = r.jenis_transport;
    }
  }

  if (Object.keys(e).length > 0) return { ok: false, errors: e };

  return {
    ok: true,
    data: {
      kategori,
      nama_kegiatan,
      tanggal_kegiatan: tanggal_kegiatan as string,
      tanggal_selesai,
      jumlah_orang,
      lokasi_tujuan,
      mekanisme: r.mekanisme as Mekanisme,
      jenis_uang,
      jenis_transport,
      jenis_konsumsi,
      total,
      uang_siapa_id,
      rekening_bank,
      rekening_nomor,
      catatan: catatan || null,
      peserta,
    },
  };
}

export interface PegawaiBersih {
  nama: string;
  nip: string | null;
  jabatan: string | null;
  rekening_bank: string | null;
  rekening_nomor: string | null;
}

export function validatePegawai(raw: unknown): Hasil<PegawaiBersih> {
  const r = objek(raw);
  const e: FieldErrors = {};
  const nama = teks(r.nama);
  if (!nama) e.nama = 'Nama wajib diisi';
  else if (nama.length < 2) e.nama = 'Nama minimal 2 karakter';
  else if (nama.length > 120) e.nama = 'Nama maksimal 120 karakter';

  const nip = teks(r.nip).replace(/\s+/g, '');
  if (nip && !/^\d{1,30}$/.test(nip)) e.nip = 'NIP/NUP hanya boleh berisi angka (maks. 30 digit)';

  const jabatan = teks(r.jabatan);
  if (jabatan.length > 120) e.jabatan = 'Jabatan maksimal 120 karakter';

  const rek = validasiRekening(r.rekening_bank, r.rekening_nomor, e);

  if (Object.keys(e).length > 0) return { ok: false, errors: e };
  return {
    ok: true,
    data: { nama, nip: nip || null, jabatan: jabatan || null, rekening_bank: rek.bank, rekening_nomor: rek.nomor },
  };
}

export interface UserBersih {
  username: string;
  nama: string;
  role: Role;
  password: string | null;
  aktif: boolean;
}

/** Email = username login (akun dikelola di Supabase Auth). */
export const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function validateUser(raw: unknown, mode: 'buat' | 'ubah'): Hasil<UserBersih> {
  const r = objek(raw);
  const e: FieldErrors = {};
  const username = teks(r.username).toLowerCase();
  if (!username) e.username = 'Email wajib diisi';
  else if (username.length > 254 || !EMAIL_RE.test(username))
    e.username = 'Format email tidak valid (contoh: nama@instansi.go.id)';

  const nama = teks(r.nama);
  if (!nama) e.nama = 'Nama wajib diisi';
  else if (nama.length < 2) e.nama = 'Nama minimal 2 karakter';
  else if (nama.length > 120) e.nama = 'Nama maksimal 120 karakter';

  if (!termasuk(ROLE_LIST, r.role)) e.role = 'Pilih peran pengguna';

  const password = typeof r.password === 'string' ? r.password : '';
  if (mode === 'buat' || password) {
    if (!password) e.password = 'Password wajib diisi';
    else if (password.length < 6) e.password = 'Password minimal 6 karakter';
    else if (password.length > 100) e.password = 'Password maksimal 100 karakter';
  }

  const aktif = r.aktif === undefined ? true : r.aktif === true || r.aktif === 1 || r.aktif === '1';

  if (Object.keys(e).length > 0) return { ok: false, errors: e };
  return {
    ok: true,
    data: { username, nama, role: r.role as Role, password: password || null, aktif },
  };
}

export interface DaftarBersih {
  nama: string;
  username: string;
  password: string;
}

/** Pendaftaran mandiri. Peran TIDAK dipilih pendaftar — ditentukan admin saat menyetujui. */
export function validateDaftar(raw: unknown): Hasil<DaftarBersih> {
  const r = objek(raw);
  const e: FieldErrors = {};
  const nama = teks(r.nama);
  if (!nama) e.nama = 'Nama wajib diisi';
  else if (nama.length < 2) e.nama = 'Nama minimal 2 karakter';
  else if (nama.length > 120) e.nama = 'Nama maksimal 120 karakter';

  const username = teks(r.username).toLowerCase();
  if (!username) e.username = 'Email wajib diisi';
  else if (username.length > 254 || !EMAIL_RE.test(username))
    e.username = 'Format email tidak valid (contoh: nama@instansi.go.id)';

  const password = typeof r.password === 'string' ? r.password : '';
  if (!password) e.password = 'Password wajib diisi';
  else if (password.length < 6) e.password = 'Password minimal 6 karakter';
  else if (password.length > 100) e.password = 'Password maksimal 100 karakter';

  if (Object.keys(e).length > 0) return { ok: false, errors: e };
  return { ok: true, data: { nama, username, password } };
}

export interface InvoiceBersih {
  no_invoice_mdk: string;
  tanggal_invoice_mdk: string;
  catatan: string | null;
}

/** No. Invoice MDK (diinput PUM saat mengajukan ke MDK, atau saat mengubah data invoice). */
export function validateInvoice(raw: unknown): Hasil<InvoiceBersih> {
  const r = objek(raw);
  const e: FieldErrors = {};
  const no = teks(r.no_invoice_mdk);
  if (!no) e.no_invoice_mdk = 'No. Invoice MDK wajib diisi';
  else if (no.length > 100) e.no_invoice_mdk = 'No. Invoice MDK maksimal 100 karakter';

  const tgl = r.tanggal_invoice_mdk;
  if (tgl === undefined || tgl === null || tgl === '') e.tanggal_invoice_mdk = 'Tanggal invoice wajib diisi';
  else if (!isTanggalValid(tgl)) e.tanggal_invoice_mdk = 'Tanggal tidak valid';

  const catatan = teksPanjang(r.catatan);
  if (catatan.length > 1000) e.catatan = 'Catatan maksimal 1000 karakter';

  if (Object.keys(e).length > 0) return { ok: false, errors: e };
  return {
    ok: true,
    data: { no_invoice_mdk: no, tanggal_invoice_mdk: tgl as string, catatan: catatan || null },
  };
}

/** Catatan/alasan wajib (mis. saat MDK mengembalikan pengajuan). */
export function validateCatatanWajib(raw: unknown, label = 'Catatan'): Hasil<{ catatan: string }> {
  const r = objek(raw);
  const catatan = teksPanjang(r.catatan);
  if (!catatan) return { ok: false, errors: { catatan: `${label} wajib diisi` } };
  if (catatan.length < 3) return { ok: false, errors: { catatan: `${label} minimal 3 karakter` } };
  if (catatan.length > 1000) return { ok: false, errors: { catatan: `${label} maksimal 1000 karakter` } };
  return { ok: true, data: { catatan } };
}

export function validateGantiPassword(
  raw: unknown,
): Hasil<{ password_lama: string; password_baru: string }> {
  const r = objek(raw);
  const e: FieldErrors = {};
  const lama = typeof r.password_lama === 'string' ? r.password_lama : '';
  const baru = typeof r.password_baru === 'string' ? r.password_baru : '';
  if (!lama) e.password_lama = 'Password lama wajib diisi';
  if (!baru) e.password_baru = 'Password baru wajib diisi';
  else if (baru.length < 6) e.password_baru = 'Password baru minimal 6 karakter';
  else if (baru.length > 100) e.password_baru = 'Password baru maksimal 100 karakter';
  else if (baru === lama) e.password_baru = 'Password baru harus berbeda dari password lama';
  if (Object.keys(e).length > 0) return { ok: false, errors: e };
  return { ok: true, data: { password_lama: lama, password_baru: baru } };
}

export interface DataPumBersih {
  project_hosting: string | null;
  task_name: string | null;
}

/** Project costing (kolom project_hosting) & task name (diisi PUM) — keduanya opsional, maks. 150 karakter. */
export function validateDataPum(raw: unknown): Hasil<DataPumBersih> {
  const r = objek(raw);
  const e: FieldErrors = {};
  const project = teks(r.project_hosting);
  const task = teks(r.task_name);
  if (project.length > 150) e.project_hosting = 'Project costing maksimal 150 karakter';
  if (task.length > 150) e.task_name = 'Task name maksimal 150 karakter';
  if (Object.keys(e).length > 0) return { ok: false, errors: e };
  return { ok: true, data: { project_hosting: project || null, task_name: task || null } };
}

export interface VerifikasiBersih extends DataPumBersih {
  catatan: string | null;
}

/** Verifikasi PUM: project costing, task name, catatan untuk pengaju (semua opsional). */
export function validateVerifikasi(raw: unknown): Hasil<VerifikasiBersih> {
  const r = objek(raw);
  const pum = validateDataPum(raw);
  const catatan = teksPanjang(r.catatan);
  const e: FieldErrors = pum.ok ? {} : { ...pum.errors };
  if (catatan.length > 1000) e.catatan = 'Catatan maksimal 1000 karakter';
  if (Object.keys(e).length > 0 || !pum.ok) return { ok: false, errors: e };
  return { ok: true, data: { ...pum.data, catatan: catatan || null } };
}

export interface CekBerkasBersih {
  jenis: string;
  /** null = batalkan centang (kembali "belum diperiksa"). */
  status: StatusCek | null;
  catatan: string | null;
}

/** Centang PUM: "sesuai", "revisi" (catatan wajib), atau null untuk membatalkan. */
export function validateCekBerkas(raw: unknown): Hasil<CekBerkasBersih> {
  const r = objek(raw);
  const e: FieldErrors = {};
  const jenis = typeof r.jenis === 'string' ? r.jenis : '';
  if (!jenis) e.jenis = 'Jenis berkas wajib diisi';
  let status: StatusCek | null = null;
  if (r.status === null || r.status === undefined || r.status === '') status = null;
  else if (termasuk(STATUS_CEK_LIST, r.status)) status = r.status;
  else e.status = 'Status pemeriksaan tidak valid';
  const catatan = teksPanjang(r.catatan);
  if (status === 'revisi') {
    if (!catatan) e.catatan = 'Tuliskan apa yang perlu direvisi';
    else if (catatan.length < 3) e.catatan = 'Catatan minimal 3 karakter';
  }
  if (catatan.length > 500) e.catatan = 'Catatan maksimal 500 karakter';
  if (Object.keys(e).length > 0) return { ok: false, errors: e };
  return { ok: true, data: { jenis, status, catatan: status === 'revisi' ? catatan : null } };
}

export function validateDibayarkan(raw: unknown): Hasil<{ dibayarkan: boolean }> {
  const r = objek(raw);
  if (typeof r.dibayarkan !== 'boolean') return { ok: false, errors: { dibayarkan: 'Nilai dibayarkan harus true atau false' } };
  return { ok: true, data: { dibayarkan: r.dibayarkan } };
}

// ───────────────────────────── Master data (hanya admin) ─────────────────────────────

/** Nilai boolean opsional (default true); selain true/false dianggap tidak valid. */
function bacaAktif(v: unknown, e: FieldErrors): boolean {
  if (v === undefined) return true;
  if (typeof v !== 'boolean') {
    e.aktif = 'Nilai aktif harus true/false';
    return true;
  }
  return v;
}

export interface JenisPengajuanBersih {
  label: string;
  label_pendek: string;
  prefix: string;
  deskripsi: string | null;
  model: ModelForm;
  maks_peserta: number | null;
  kata_kunci_task: string | null;
  warna: WarnaJenis;
  ikon: IkonJenis;
  aktif: boolean;
  /** Kode jenis berkas wajib, urut tampil. */
  berkas: string[];
}

/**
 * Jenis pengajuan (master). `modelTetap` = model jenis yang sudah ada saat diubah: model form tidak dapat diganti
 * setelah dibuat (data pengajuan lama mengikuti model itu).
 */
export function validateJenisPengajuan(raw: unknown, modelTetap?: ModelForm): Hasil<JenisPengajuanBersih> {
  const r = objek(raw);
  const e: FieldErrors = {};
  const label = teks(r.label);
  if (!label) e.label = 'Nama jenis pengajuan wajib diisi';
  else if (label.length < 3) e.label = 'Nama minimal 3 karakter';
  else if (label.length > 60) e.label = 'Nama maksimal 60 karakter';

  let label_pendek = teks(r.label_pendek);
  if (!label_pendek && label.length >= 2 && label.length <= 24) label_pendek = label;
  if (!label_pendek) e.label_pendek = 'Nama singkat wajib diisi (maks. 24 karakter)';
  else if (label_pendek.length < 2) e.label_pendek = 'Nama singkat minimal 2 karakter';
  else if (label_pendek.length > 24) e.label_pendek = 'Nama singkat maksimal 24 karakter';

  const prefix = teks(r.prefix).toUpperCase();
  if (!prefix) e.prefix = 'Awalan kode wajib diisi';
  else if (!/^[A-Z]{2,5}$/.test(prefix)) e.prefix = 'Awalan kode 2–5 huruf A–Z, mis. KBR';

  const deskripsi = teks(r.deskripsi);
  if (deskripsi.length > 160) e.deskripsi = 'Deskripsi maksimal 160 karakter';

  let model: ModelForm = 'umum';
  if (modelTetap) model = modelTetap;
  else if (termasuk(MODEL_FORM_LIST, r.model)) model = r.model;
  else e.model = 'Pilih model form';

  let maks_peserta: number | null = null;
  if (modelPeserta(model)) {
    const m = keInteger(r.maks_peserta);
    if (m === null) e.maks_peserta = 'Isi batas jumlah orang per pengajuan';
    else if (Number.isNaN(m) || m < 1 || m > MAKS_PESERTA_BATAS) e.maks_peserta = `Batas jumlah orang 1–${MAKS_PESERTA_BATAS}`;
    else maks_peserta = m;
  }

  const kata_kunci_task = teks(r.kata_kunci_task);
  if (kata_kunci_task.length > 100) e.kata_kunci_task = 'Kata kunci maksimal 100 karakter';

  let warna: WarnaJenis = 'abu';
  if (termasuk(WARNA_JENIS_PILIHAN, r.warna)) warna = r.warna;
  else e.warna = 'Pilih warna';
  let ikon: IkonJenis = 'file-text';
  if (termasuk(IKON_JENIS_LIST, r.ikon)) ikon = r.ikon;
  else e.ikon = 'Pilih ikon';

  const aktif = bacaAktif(r.aktif, e);

  const berkas: string[] = [];
  const daftar = r.berkas === undefined ? [] : r.berkas;
  if (!Array.isArray(daftar)) {
    e.berkas = 'Daftar berkas wajib tidak valid';
  } else {
    for (const b of daftar) {
      if (typeof b !== 'string' || !b.trim()) {
        e.berkas = 'Daftar berkas wajib tidak valid';
        break;
      }
      if (b === JENIS_BERKAS_LAINNYA) {
        e.berkas = 'Dokumen Lainnya selalu tersedia sebagai berkas opsional, tidak perlu dipilih';
        break;
      }
      if (berkas.includes(b)) {
        e.berkas = 'Ada jenis berkas yang dipilih dua kali';
        break;
      }
      berkas.push(b);
    }
    if (!e.berkas && berkas.length > 20) e.berkas = 'Maksimal 20 berkas wajib';
  }

  if (Object.keys(e).length > 0) return { ok: false, errors: e };
  return {
    ok: true,
    data: {
      label,
      label_pendek,
      prefix,
      deskripsi: deskripsi || null,
      model,
      maks_peserta,
      kata_kunci_task: kata_kunci_task || null,
      warna,
      ikon,
      aktif,
      berkas,
    },
  };
}

export interface JenisBerkasBersih {
  label: string;
  keterangan: string | null;
  aktif: boolean;
}

export function validateJenisBerkas(raw: unknown): Hasil<JenisBerkasBersih> {
  const r = objek(raw);
  const e: FieldErrors = {};
  const label = teks(r.label);
  if (!label) e.label = 'Nama jenis berkas wajib diisi';
  else if (label.length < 2) e.label = 'Nama minimal 2 karakter';
  else if (label.length > 60) e.label = 'Nama maksimal 60 karakter';
  else if (label.toLowerCase() === LABEL_BERKAS_LAINNYA.toLowerCase()) e.label = `"${LABEL_BERKAS_LAINNYA}" sudah tersedia untuk semua pengajuan`;
  const keterangan = teks(r.keterangan);
  if (keterangan.length > 200) e.keterangan = 'Keterangan maksimal 200 karakter';
  const aktif = bacaAktif(r.aktif, e);
  if (Object.keys(e).length > 0) return { ok: false, errors: e };
  return { ok: true, data: { label, keterangan: keterangan || null, aktif } };
}

export interface BankBersih {
  nama: string;
  aktif: boolean;
}

export function validateBank(raw: unknown): Hasil<BankBersih> {
  const r = objek(raw);
  const e: FieldErrors = {};
  const nama = teks(r.nama);
  if (!nama) e.nama = 'Nama bank wajib diisi';
  else if (nama.length < 2) e.nama = 'Nama bank minimal 2 karakter';
  else if (nama.length > 60) e.nama = 'Nama bank maksimal 60 karakter';
  const aktif = bacaAktif(r.aktif, e);
  if (Object.keys(e).length > 0) return { ok: false, errors: e };
  return { ok: true, data: { nama, aktif } };
}

export interface ProjectBersih {
  kode: string;
  nama: string;
  aktif: boolean;
  task_ids: number[];
}

/** Project Costing: disimpan di pengajuan sebagai "<kode>:<nama>" (maks. 150) — kode tidak boleh memuat ":". */
export function validateProject(raw: unknown): Hasil<ProjectBersih> {
  const r = objek(raw);
  const e: FieldErrors = {};
  const kode = teks(r.kode).replace(/\s+/g, '');
  if (!kode) e.kode = 'Kode project wajib diisi';
  else if (!/^[A-Za-z0-9][A-Za-z0-9./-]{0,39}$/.test(kode)) e.kode = 'Kode project hanya huruf, angka, titik, strip, atau garis miring (maks. 40)';
  const nama = teks(r.nama);
  if (!nama) e.nama = 'Nama project wajib diisi';
  else if (nama.length < 2) e.nama = 'Nama project minimal 2 karakter';
  else if (nama.length > 120) e.nama = 'Nama project maksimal 120 karakter';
  else if (!e.kode && kode.length + 1 + nama.length > 150) e.nama = 'Kode + nama project maksimal 150 karakter';
  const aktif = bacaAktif(r.aktif, e);
  const task_ids: number[] = [];
  const daftar = r.task_ids === undefined ? [] : r.task_ids;
  if (!Array.isArray(daftar)) e.task_ids = 'Daftar task tidak valid';
  else {
    for (const v of daftar) {
      const id = keInteger(v);
      if (id === null || Number.isNaN(id) || id <= 0) {
        e.task_ids = 'Daftar task tidak valid';
        break;
      }
      if (!task_ids.includes(id)) task_ids.push(id);
    }
    if (!e.task_ids && task_ids.length > 200) e.task_ids = 'Terlalu banyak task';
  }
  if (Object.keys(e).length > 0) return { ok: false, errors: e };
  return { ok: true, data: { kode, nama, aktif, task_ids } };
}

export interface TaskBersih {
  kode: string;
  nama: string;
  aktif: boolean;
}

/** Task Name: disimpan di pengajuan sebagai "<kode>_<nama>" (maks. 150) — kode tidak boleh memuat "_". */
export function validateTask(raw: unknown): Hasil<TaskBersih> {
  const r = objek(raw);
  const e: FieldErrors = {};
  const kode = teks(r.kode).replace(/\s+/g, '');
  if (!kode) e.kode = 'Kode task wajib diisi';
  else if (!/^[A-Za-z0-9][A-Za-z0-9./-]{0,29}$/.test(kode)) e.kode = 'Kode task hanya huruf, angka, titik, strip, atau garis miring (maks. 30)';
  const nama = teks(r.nama);
  if (!nama) e.nama = 'Nama task wajib diisi';
  else if (nama.length < 2) e.nama = 'Nama task minimal 2 karakter';
  else if (nama.length > 120) e.nama = 'Nama task maksimal 120 karakter';
  else if (!e.kode && kode.length + 1 + nama.length > 150) e.nama = 'Kode + nama task maksimal 150 karakter';
  const aktif = bacaAktif(r.aktif, e);
  if (Object.keys(e).length > 0) return { ok: false, errors: e };
  return { ok: true, data: { kode, nama, aktif } };
}
