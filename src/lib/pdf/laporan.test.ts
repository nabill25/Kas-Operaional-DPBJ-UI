import { describe, expect, it } from 'vitest';
import { bersihkan } from './laporan';

describe('sanitasi teks PDF (font standar Latin-1)', () => {
  it('mengganti tanda baca tipografi', () => {
    expect(bersihkan('“Rapat” ‘HPS’ – final — v2… ')).toBe('"Rapat" \'HPS\' - final - v2... ');
    expect(bersihkan('Nilai Rp 1.000 → Rp 2.000')).toBe('Nilai Rp 1.000 -> Rp 2.000');
  });

  it('mempertahankan huruf Latin-1 & mengganti karakter di luar jangkauan', () => {
    expect(bersihkan('Café Ünïcode')).toBe('Café Ünïcode');
    expect(bersihkan('Emoji 👋 & 中文')).toBe('Emoji ? & ??');
  });
});
