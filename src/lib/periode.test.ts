import { describe, expect, it } from 'vitest';
import { hitungPeriode } from './periode';

const acuan = new Date(2026, 9, 6, 10, 0); // 6 Oktober 2026

describe('hitungPeriode', () => {
  it('bulan ini & tahun ini', () => {
    expect(hitungPeriode('bulan_ini', {}, acuan)).toEqual({ dari: '2026-10-01', sampai: '2026-10-31', label: 'Oktober 2026' });
    expect(hitungPeriode('tahun_ini', {}, acuan)).toEqual({ dari: '2026-01-01', sampai: '2026-12-31', label: 'Tahun 2026' });
    expect(hitungPeriode('tahun_lalu', {}, acuan)).toEqual({ dari: '2025-01-01', sampai: '2025-12-31', label: 'Tahun 2025' });
  });

  it('bulan lalu melintasi tahun & februari kabisat', () => {
    expect(hitungPeriode('bulan_lalu', {}, new Date(2026, 0, 15))).toEqual({
      dari: '2025-12-01',
      sampai: '2025-12-31',
      label: 'Desember 2025',
    });
    expect(hitungPeriode('bulan_lalu', {}, new Date(2028, 2, 31))).toEqual({
      dari: '2028-02-01',
      sampai: '2028-02-29',
      label: 'Februari 2028',
    });
  });

  it('semua & kustom', () => {
    expect(hitungPeriode('semua', {}, acuan)).toEqual({ dari: '', sampai: '', label: 'Semua periode' });
    expect(hitungPeriode('kustom', { dari: '2026-03-01', sampai: '2026-03-31' }, acuan).label).toBe('1 Mar 2026 - 31 Mar 2026');
    expect(hitungPeriode('kustom', { dari: '2026-03-01' }, acuan).label).toBe('Sejak 1 Mar 2026');
    expect(hitungPeriode('kustom', { sampai: '2026-03-31' }, acuan).label).toBe('Hingga 31 Mar 2026');
    expect(hitungPeriode('kustom', {}, acuan).label).toBe('Semua periode');
  });
});
