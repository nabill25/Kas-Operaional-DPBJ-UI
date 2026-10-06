import type { Kategori } from '../../../shared/constants';
import type { Tema } from '../../context/ThemeContext';

/**
 * Warna chart per tema (nilai sama dengan token CSS di index.css).
 * Palet kategori tervalidasi skrip dataviz (CVD & normal-vision, all-pairs) — lihat CLAUDE.md §10.
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

export function warnaKategori(tema: Tema, k: Kategori): string {
  return PALET[tema][k];
}
