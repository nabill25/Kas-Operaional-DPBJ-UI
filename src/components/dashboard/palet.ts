import type { Kategori, WarnaJenis } from '../../../shared/constants';
import { useKamus } from '../../context/KonfigContext';
import { useTema, type Tema, type Warna } from '../../context/ThemeContext';

/**
 * Warna netral chart per mode (nilai sama dengan token CSS di index.css). Dipakai di atribut SVG (Recharts),
 * karena var() CSS tidak andal di atribut presentasi SVG.
 */
export const PALET = {
  terang: {
    netral: '#6b7590',
    jalur: '#dfe4ef',
    grid: 'rgba(10, 26, 63, 0.08)',
    sumbu: '#6b7590',
    aksen: '#e6a800',
    kursor: 'rgba(10, 26, 63, 0.05)',
  },
  gelap: {
    netral: '#8a93ab',
    jalur: '#1f2b4a',
    grid: 'rgba(255, 255, 255, 0.07)',
    sumbu: '#8a93ab',
    aksen: '#ffd100',
    kursor: 'rgba(255, 255, 255, 0.05)',
  },
} as const satisfies Record<Tema, Record<string, string>>;

/**
 * Warna seri jenis pengajuan (dipilih admin di master Jenis Pengajuan). Kuning/biru/hijau = palet lama Konsumsi,
 * Rumah Tangga, Perjadin (tervalidasi skrip dataviz, lihat CLAUDE.md §10); sisanya diambil dari palet ramah buta warna
 * (Okabe–Ito: vermilion, ungu kemerahan) + toska & abu-abu, kontras penanda ≥ 3:1 terhadap latar terang & gelap.
 * SENGAJA sama di semua tema warna agar arti warna data tidak berubah. Teks tidak pernah memakai warna seri.
 */
export const WARNA_SERI: Record<WarnaJenis, Record<Tema, string>> = {
  kuning: { terang: '#eda100', gelap: '#c98500' },
  biru: { terang: '#2a78d6', gelap: '#3987e5' },
  hijau: { terang: '#1baf7a', gelap: '#199e70' },
  merah: { terang: '#c8521a', gelap: '#e0703a' },
  ungu: { terang: '#a8558a', gelap: '#c77aa8' },
  toska: { terang: '#0b8fa3', gelap: '#1fb3c4' },
  abu: { terang: '#64748b', gelap: '#94a3b8' },
};

type Palet = { readonly [K in keyof (typeof PALET)['terang']]: string };

/**
 * Tema warna selain bawaan: netral & aksen chart mengikuti tema; warna seri tidak berubah.
 * "Kuning UI" = netral hangat (hitam arang) & kuning resmi; "Pink" = netral plum & aksen pink (≥ 3:1 terhadap latar).
 */
const NETRAL_TEMA: Partial<Record<Warna, Record<Tema, Partial<Palet>>>> = {
  ui: {
    terang: {
      netral: '#6f6c63',
      jalur: '#e6e4dc',
      grid: 'rgba(23, 22, 18, 0.08)',
      sumbu: '#6f6c63',
      aksen: '#c2a600',
      kursor: 'rgba(23, 22, 18, 0.05)',
    },
    gelap: {
      netral: '#8e8b81',
      jalur: '#2a2926',
      grid: 'rgba(255, 255, 255, 0.07)',
      sumbu: '#8e8b81',
      aksen: '#f6db00',
      kursor: 'rgba(255, 255, 255, 0.05)',
    },
  },
  pink: {
    terang: {
      netral: '#75606d',
      jalur: '#f0dfe8',
      grid: 'rgba(42, 15, 32, 0.08)',
      sumbu: '#75606d',
      aksen: '#e0418c',
      kursor: 'rgba(42, 15, 32, 0.05)',
    },
    gelap: {
      netral: '#9b8693',
      jalur: '#2e1a26',
      grid: 'rgba(255, 255, 255, 0.07)',
      sumbu: '#9b8693',
      aksen: '#fb83bb',
      kursor: 'rgba(255, 255, 255, 0.05)',
    },
  },
};

/** Nama warna aksen chart per tema warna (untuk keterangan, mis. "titik kuning = bulan berjalan"). */
export const NAMA_AKSEN: Record<Warna, string> = { dpbj: 'kuning', ui: 'kuning', pink: 'pink' };

export function paletChart(tema: Tema, warna: Warna): Palet {
  return { ...PALET[tema], ...NETRAL_TEMA[warna]?.[tema] };
}

/** Palet chart (warna netral) untuk mode & tema warna yang sedang aktif. */
export function usePaletChart(): Palet {
  const { tema, warna } = useTema();
  return paletChart(tema, warna);
}

/** Warna seri satu jenis pengajuan untuk mode terang/gelap. */
export function warnaSeri(tema: Tema, warna: WarnaJenis): string {
  return (WARNA_SERI[warna] ?? WARNA_SERI.abu)[tema];
}

/** Warna seri per kode jenis pengajuan (mengikuti master & mode tampilan aktif). */
export function useWarnaKategori(): (kategori: Kategori) => string {
  const { tema } = useTema();
  const kamus = useKamus();
  return (k) => warnaSeri(tema, kamus.jenis(k).warna);
}
