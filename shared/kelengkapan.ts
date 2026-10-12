import type { JenisBerkas } from './constants';
import type { BerkasDaftar, CekBerkas, Kelengkapan } from './types';

/**
 * Hitung kelengkapan berkas sebuah pengajuan.
 * - `daftar`: berkas pengajuan ini (snapshot `berkas_daftar`, atau master jenisnya) beserta sifatnya, urut tampil.
 * - Hitungan terpenuhi/total/sesuai hanya untuk berkas wajib. Terpenuhi: sudah ada ≥1 file, atau ditandai
 *   "tidak diperlukan" (N/A) oleh pengaju — tanda N/A hanya berlaku untuk berkas wajib.
 * - Sesuai/revisi: hasil centang pemeriksaan PUM per jenis berkas (berkas opsional juga boleh diperiksa).
 * - Boleh diverifikasi: semua berkas wajib sesuai dan tidak ada berkas (wajib/opsional) yang ditandai revisi.
 */
export function hitungKelengkapan(
  daftar: readonly BerkasDaftar[],
  label: (kode: JenisBerkas) => string,
  berkas: readonly { jenis: string }[],
  berkasNa: readonly string[],
  cek: readonly CekBerkas[] = [],
): Kelengkapan {
  const items = daftar.map(({ kode: jenis, wajib }) => {
    const jumlah = berkas.filter((b) => b.jenis === jenis).length;
    const na = wajib && jumlah === 0 && berkasNa.includes(jenis);
    return {
      jenis,
      label: label(jenis),
      wajib,
      jumlah,
      na,
      terpenuhi: jumlah > 0 || na,
      cek: cek.find((c) => c.jenis === jenis) ?? null,
    };
  });
  const wajib = items.filter((i) => i.wajib);
  const terpenuhi = wajib.filter((i) => i.terpenuhi).length;
  const total = wajib.length;
  const sesuai = wajib.filter((i) => i.cek?.status === 'sesuai').length;
  const revisi = items.filter((i) => i.cek?.status === 'revisi').length;
  const semuaSesuai = sesuai === total;
  return {
    items,
    terpenuhi,
    total,
    lengkap: terpenuhi === total,
    persen: total === 0 ? 100 : Math.round((terpenuhi / total) * 100),
    sesuai,
    revisi,
    semuaSesuai,
    bisaVerifikasi: semuaSesuai && revisi === 0,
  };
}

/** Parse kolom JSON `berkas_na` dengan aman. */
export function parseBerkasNa(json: string | null | undefined): string[] {
  try {
    const v: unknown = JSON.parse(json ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Parse kolom JSON `berkas_daftar`; null bila belum dicatat (ikut master jenis pengajuannya).
 * Format: `[{ "kode": "notulen", "wajib": true }, …]`. Data lama berupa daftar kode (`["notulen", …]`) = semua wajib.
 */
export function parseBerkasDaftar(json: string | null | undefined): BerkasDaftar[] | null {
  if (json === null || json === undefined) return null;
  try {
    const v: unknown = JSON.parse(json);
    if (!Array.isArray(v)) return null;
    const hasil: BerkasDaftar[] = [];
    for (const x of v) {
      if (typeof x === 'string') hasil.push({ kode: x, wajib: true });
      else if (x && typeof x === 'object' && typeof (x as { kode?: unknown }).kode === 'string') {
        hasil.push({ kode: (x as { kode: string }).kode, wajib: (x as { wajib?: unknown }).wajib !== false });
      }
    }
    return hasil;
  } catch {
    return null;
  }
}

/** Daftar berkas sama persis (kode, sifat wajib/opsional, dan urutan)? */
export function samaDaftarBerkas(a: readonly BerkasDaftar[], b: readonly BerkasDaftar[]): boolean {
  return a.length === b.length && a.every((x, i) => x.kode === b[i].kode && x.wajib === b[i].wajib);
}

/** Kode berkas wajib saja dari sebuah daftar. */
export function kodeWajib(daftar: readonly BerkasDaftar[]): JenisBerkas[] {
  return daftar.filter((b) => b.wajib).map((b) => b.kode);
}
