// Validasi input — dipakai server (otoritatif) dan client (umpan balik instan).
// Pesan error berbahasa Indonesia; key error = nama field (peserta: "peserta.<i>.<field>").
import {
  JENIS_TRANSPORT_LIST,
  JENIS_UANG_LIST,
  KATEGORI_LIST,
  MAX_NILAI,
  MAX_PESERTA_TRANSPORT,
  MEKANISME_LIST,
  ROLE_LIST,
  STATUS_CEK_LIST,
  type JenisTransport,
  type JenisUang,
  type Kategori,
  type Mekanisme,
  type Role,
  type StatusCek,
} from './constants.js';
import { lamaHari } from './format.js';
import type { PesertaInput } from './types.js';

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
  total: number;
  uang_siapa_id: number | null;
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

export function validatePengajuan(raw: unknown): Hasil<PengajuanBersih> {
  const r = objek(raw);
  const e: FieldErrors = {};

  if (!termasuk(KATEGORI_LIST, r.kategori)) {
    return { ok: false, errors: { kategori: 'Kategori tidak valid' } };
  }
  const kategori = r.kategori;

  const nama_kegiatan = teks(r.nama_kegiatan);
  if (!nama_kegiatan) e.nama_kegiatan = 'Nama kegiatan wajib diisi';
  else if (nama_kegiatan.length < 3) e.nama_kegiatan = 'Nama kegiatan minimal 3 karakter';
  else if (nama_kegiatan.length > 200) e.nama_kegiatan = 'Nama kegiatan maksimal 200 karakter';

  const tanggal_kegiatan = r.tanggal_kegiatan;
  if (tanggal_kegiatan === undefined || tanggal_kegiatan === null || tanggal_kegiatan === '') {
    e.tanggal_kegiatan =
      kategori === 'perjadin' ? 'Tanggal mulai (dari) wajib diisi' : 'Tanggal kegiatan wajib diisi';
  } else if (!isTanggalValid(tanggal_kegiatan)) {
    e.tanggal_kegiatan = 'Tanggal tidak valid';
  }

  if (!termasuk(MEKANISME_LIST, r.mekanisme)) e.mekanisme = 'Pilih mekanisme KO atau LS';

  const catatan = teksPanjang(r.catatan);
  if (catatan.length > 1000) e.catatan = 'Catatan maksimal 1000 karakter';

  let total = 0;
  let jumlah_orang = 0;
  let uang_siapa_id: number | null = null;
  let lokasi_tujuan: string | null = null;
  let tanggal_selesai: string | null = null;
  let jenis_uang: JenisUang | null = null;
  let jenis_transport: JenisTransport | null = null;
  const peserta: PesertaInput[] = [];

  if (kategori === 'konsumsi') {
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
  } else {
    const lok = teks(r.lokasi_tujuan);
    if (!lok) e.lokasi_tujuan = 'Lokasi tujuan wajib diisi';
    else if (lok.length < 2) e.lokasi_tujuan = 'Lokasi tujuan minimal 2 karakter';
    else if (lok.length > 200) e.lokasi_tujuan = 'Lokasi tujuan maksimal 200 karakter';
    else lokasi_tujuan = lok;

    const daftar = Array.isArray(r.peserta) ? r.peserta : [];
    if (daftar.length === 0) {
      e.peserta = 'Tambahkan minimal 1 orang';
    } else if (daftar.length > MAX_PESERTA_TRANSPORT) {
      e.peserta = `Maksimal ${MAX_PESERTA_TRANSPORT} orang per pengajuan`;
    } else {
      const sudah = new Set<number>();
      daftar.forEach((item, i) => {
        const o = objek(item);
        const pid = keInteger(o.pegawai_id);
        const nilai = keInteger(o.nilai);
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
        if (valid && pid !== null && nilai !== null) peserta.push({ pegawai_id: pid, nilai });
      });
      jumlah_orang = daftar.length;
      total = peserta.reduce((s, p) => s + p.nilai, 0);
      if (total > MAX_NILAI) e.peserta = 'Total nilai melebihi batas maksimal';
    }

    if (kategori === 'perjadin') {
      const ts = r.tanggal_selesai;
      if (ts === undefined || ts === null || ts === '') {
        e.tanggal_selesai = 'Tanggal selesai (sampai) wajib diisi';
      } else if (!isTanggalValid(ts)) {
        e.tanggal_selesai = 'Tanggal tidak valid';
      } else if (isTanggalValid(tanggal_kegiatan) && ts < tanggal_kegiatan) {
        e.tanggal_selesai = 'Tanggal selesai tidak boleh sebelum tanggal mulai';
      } else if (isTanggalValid(tanggal_kegiatan) && lamaHari(tanggal_kegiatan, ts) > 366) {
        e.tanggal_selesai = 'Lama kegiatan maksimal 366 hari';
      } else {
        tanggal_selesai = ts;
      }

      if (!termasuk(JENIS_UANG_LIST, r.jenis_uang)) e.jenis_uang = 'Pilih jenis uang';
      else jenis_uang = r.jenis_uang;

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
      total,
      uang_siapa_id,
      catatan: catatan || null,
      peserta,
    },
  };
}

export interface PegawaiBersih {
  nama: string;
  nip: string | null;
  jabatan: string | null;
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

  if (Object.keys(e).length > 0) return { ok: false, errors: e };
  return { ok: true, data: { nama, nip: nip || null, jabatan: jabatan || null } };
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

/** Project hosting & task name (diisi PUM) — keduanya opsional, maks. 150 karakter. */
export function validateDataPum(raw: unknown): Hasil<DataPumBersih> {
  const r = objek(raw);
  const e: FieldErrors = {};
  const project = teks(r.project_hosting);
  const task = teks(r.task_name);
  if (project.length > 150) e.project_hosting = 'Project hosting maksimal 150 karakter';
  if (task.length > 150) e.task_name = 'Task name maksimal 150 karakter';
  if (Object.keys(e).length > 0) return { ok: false, errors: e };
  return { ok: true, data: { project_hosting: project || null, task_name: task || null } };
}

export interface TeruskanBersih extends DataPumBersih {
  catatan: string | null;
}

/** Teruskan ke MDK: project hosting, task name, catatan (semua opsional). */
export function validateTeruskan(raw: unknown): Hasil<TeruskanBersih> {
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
