// Format angka & tanggal Indonesia tanpa dependensi (deterministik di server, browser, dan PDF).

export const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export const NAMA_BULAN_PENDEK = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

/** 1250000 → "1.250.000" */
export function formatAngka(n: number | null | undefined): string {
  const v = Math.round(Number(n) || 0);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return v < 0 ? `-${s}` : s;
}

/** 1250000 → "Rp 1.250.000" */
export function formatRupiah(n: number | null | undefined): string {
  const v = Math.round(Number(n) || 0);
  return v < 0 ? `-Rp ${formatAngka(-v)}` : `Rp ${formatAngka(v)}`;
}

function desimal(n: number, maks: number): string {
  const f = Math.pow(10, maks);
  const r = Math.round(n * f) / f;
  const [bulat, pecahan] = String(r).split('.');
  const b = formatAngka(Number(bulat));
  return pecahan ? `${b},${pecahan}` : b;
}

/** Ringkas untuk sumbu chart: 1250000 → "1,3 jt"; 2500000000 → "2,5 M". */
export function formatRupiahRingkas(n: number | null | undefined, maksDesimal = 1): string {
  const v = Math.abs(Number(n) || 0);
  const tanda = (Number(n) || 0) < 0 ? '-' : '';
  if (v >= 1e12) return `${tanda}${desimal(v / 1e12, maksDesimal)} T`;
  if (v >= 1e9) return `${tanda}${desimal(v / 1e9, maksDesimal)} M`;
  if (v >= 1e6) return `${tanda}${desimal(v / 1e6, maksDesimal)} jt`;
  if (v >= 1e3) return `${tanda}${desimal(v / 1e3, maksDesimal)} rb`;
  return `${tanda}${formatAngka(v)}`;
}

const RE_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/;

interface Bagian {
  y: number;
  m: number; // 0-11
  d: number;
  jam?: number;
  menit?: number;
}

function pecah(nilai: string): Bagian | null {
  const m = RE_TANGGAL.exec(nilai);
  if (m) return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
  const dt = new Date(nilai);
  if (Number.isNaN(dt.getTime())) return null;
  return {
    y: dt.getFullYear(),
    m: dt.getMonth(),
    d: dt.getDate(),
    jam: dt.getHours(),
    menit: dt.getMinutes(),
  };
}

/** "2026-10-06" → "6 Oktober 2026" (panjang) / "6 Okt 2026" (pendek). */
export function formatTanggal(
  nilai: string | null | undefined,
  gaya: 'panjang' | 'pendek' = 'panjang',
): string {
  if (!nilai) return '-';
  const b = pecah(nilai);
  if (!b) return '-';
  const bulan = gaya === 'panjang' ? NAMA_BULAN[b.m] : NAMA_BULAN_PENDEK[b.m];
  return `${b.d} ${bulan} ${b.y}`;
}

/** Timestamp ISO → "6 Okt 2026, 14.30" (waktu lokal). */
export function formatWaktu(nilai: string | null | undefined): string {
  if (!nilai) return '-';
  const b = pecah(nilai);
  if (!b) return '-';
  const jam = b.jam ?? 0;
  const menit = b.menit ?? 0;
  return `${b.d} ${NAMA_BULAN_PENDEK[b.m]} ${b.y}, ${String(jam).padStart(2, '0')}.${String(menit).padStart(2, '0')}`;
}

/** Rentang tanggal: "6–8 Okt 2026", "28 Sep – 2 Okt 2026", atau "30 Des 2025 – 2 Jan 2026". */
export function formatRentangTanggal(dari: string, sampai: string | null | undefined): string {
  if (!sampai || sampai === dari) return formatTanggal(dari, 'pendek');
  const a = pecah(dari);
  const b = pecah(sampai);
  if (!a || !b) return formatTanggal(dari, 'pendek');
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${NAMA_BULAN_PENDEK[a.m]} ${a.y}`;
  if (a.y === b.y) return `${a.d} ${NAMA_BULAN_PENDEK[a.m]} – ${b.d} ${NAMA_BULAN_PENDEK[b.m]} ${b.y}`;
  return `${formatTanggal(dari, 'pendek')} – ${formatTanggal(sampai, 'pendek')}`;
}

/** Lama kegiatan inklusif dalam hari ("2026-10-01" s.d. "2026-10-03" → 3). */
export function lamaHari(dari: string, sampai: string | null | undefined): number {
  if (!sampai) return 1;
  const a = RE_TANGGAL.exec(dari);
  const b = RE_TANGGAL.exec(sampai);
  if (!a || !b) return 1;
  const ta = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const tb = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((tb - ta) / 86_400_000) + 1;
}

/** Tanggal lokal (bukan UTC) dalam format YYYY-MM-DD. */
export function tanggalLokalIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "baru saja", "5 menit lalu", "3 jam lalu", "2 hari lalu", atau tanggal pendek. */
export function waktuRelatif(iso: string | null | undefined, sekarang: number = Date.now()): string {
  if (!iso) return '-';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '-';
  const detik = Math.max(0, Math.round((sekarang - t) / 1000));
  if (detik < 60) return 'baru saja';
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  if (hari < 7) return `${hari} hari lalu`;
  return formatTanggal(iso, 'pendek');
}

/** Selisih hari (dibulatkan ke bawah) antara dua timestamp. */
export function selisihHari(dariIso: string, sampaiIso: string | number = Date.now()): number {
  const a = new Date(dariIso).getTime();
  const b = typeof sampaiIso === 'number' ? sampaiIso : new Date(sampaiIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.floor((b - a) / 86_400_000));
}

/** 2_400_000 byte → "2,3 MB" */
export function formatUkuran(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${desimal(bytes / 1024, 1)} KB`;
  return `${desimal(bytes / (1024 * 1024), 1)} MB`;
}
