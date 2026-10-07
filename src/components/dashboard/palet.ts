import type { Kategori } from '../../../shared/constants';
import { useTema, type Tema, type Warna } from '../../context/ThemeContext';

/**
 * Warna chart per mode (nilai sama dengan token CSS di index.css).
 * Palet kategori tervalidasi skrip dataviz (CVD & normal-vision, all-pairs) — lihat CLAUDE.md §10 —
 * dan SENGAJA sama di semua tema warna agar arti warna data tidak berubah.
 * Dipakai di atribut SVG (Recharts), karena var() CSS tidak andal di atribut presentasi SVG.
 */
export const PALET = {
  terang: {
    konsumsi: '#eda100',
    rumah_tangga: '#2a78d6',
    perjadin: '#1baf7a',
    netral: '#6b7590',
    jalur: '#dfe4ef',
    grid: 'rgba(10, 26, 63, 0.08)',
    sumbu: '#6b7590',
    aksen: '#e6a800',
    kursor: 'rgba(10, 26, 63, 0.05)',
  },
  gelap: {
    konsumsi: '#c98500',
    rumah_tangga: '#3987e5',
    perjadin: '#199e70',
    netral: '#8a93ab',
    jalur: '#1f2b4a',
    grid: 'rgba(255, 255, 255, 0.07)',
    sumbu: '#8a93ab',
    aksen: '#ffd100',
    kursor: 'rgba(255, 255, 255, 0.05)',
  },
} as const satisfies Record<Tema, Record<string, string>>;

type Palet = { readonly [K in keyof (typeof PALET)['terang']]: string };

/** Tema "Kuning UI": netral hangat (hitam arang) & aksen kuning resmi; warna kategori tidak berubah. */
const NETRAL_UI: Record<Tema, Partial<Palet>> = {
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
};

export function paletChart(tema: Tema, warna: Warna): Palet {
  return warna === 'ui' ? { ...PALET[tema], ...NETRAL_UI[tema] } : PALET[tema];
}

/** Palet chart untuk mode & tema warna yang sedang aktif. */
export function usePaletChart(): Palet {
  const { tema, warna } = useTema();
  return paletChart(tema, warna);
}

export function warnaKategori(tema: Tema, k: Kategori): string {
  return PALET[tema][k];
}
