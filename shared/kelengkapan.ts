import { BERKAS_WAJIB, JENIS_BERKAS_LABEL, type Kategori } from './constants';
import type { CekBerkas, Kelengkapan } from './types';

/**
 * Hitung kelengkapan berkas wajib sebuah pengajuan.
 * - Terpenuhi: sudah ada ≥1 file, atau ditandai "tidak diperlukan" (N/A) oleh pengaju.
 * - Sesuai/revisi: hasil centang pemeriksaan PUM per jenis berkas.
 */
export function hitungKelengkapan(
  kategori: Kategori,
  berkas: readonly { jenis: string }[],
  berkasNa: readonly string[],
  cek: readonly CekBerkas[] = [],
): Kelengkapan {
  const items = BERKAS_WAJIB[kategori].map((jenis) => {
    const jumlah = berkas.filter((b) => b.jenis === jenis).length;
    const na = jumlah === 0 && berkasNa.includes(jenis);
    return {
      jenis,
      label: JENIS_BERKAS_LABEL[jenis],
      jumlah,
      na,
      terpenuhi: jumlah > 0 || na,
      cek: cek.find((c) => c.jenis === jenis) ?? null,
    };
  });
  const terpenuhi = items.filter((i) => i.terpenuhi).length;
  const total = items.length;
  const sesuai = items.filter((i) => i.cek?.status === 'sesuai').length;
  const revisi = items.filter((i) => i.cek?.status === 'revisi').length;
  return {
    items,
    terpenuhi,
    total,
    lengkap: terpenuhi === total,
    persen: total === 0 ? 100 : Math.round((terpenuhi / total) * 100),
    sesuai,
    revisi,
    semuaSesuai: sesuai === total,
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
