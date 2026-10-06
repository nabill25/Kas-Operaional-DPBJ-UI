import { NAMA_BULAN, formatTanggal, tanggalLokalIso } from '../../shared/format';

export type PresetPeriode = 'bulan_ini' | 'bulan_lalu' | 'tahun_ini' | 'tahun_lalu' | 'semua' | 'kustom';

export const LABEL_PRESET: Record<PresetPeriode, string> = {
  bulan_ini: 'Bulan ini',
  bulan_lalu: 'Bulan lalu',
  tahun_ini: 'Tahun ini',
  tahun_lalu: 'Tahun lalu',
  semua: 'Semua',
  kustom: 'Kustom',
};

export interface RentangPeriode {
  dari: string;
  sampai: string;
  label: string;
}

/** Hitung rentang tanggal (YYYY-MM-DD, waktu lokal) untuk preset periode. */
export function hitungPeriode(preset: PresetPeriode, kustom: { dari?: string; sampai?: string } = {}, acuan = new Date()): RentangPeriode {
  const y = acuan.getFullYear();
  const m = acuan.getMonth();
  const awalBulan = (th: number, bl: number) => tanggalLokalIso(new Date(th, bl, 1));
  const akhirBulan = (th: number, bl: number) => tanggalLokalIso(new Date(th, bl + 1, 0));
  switch (preset) {
    case 'bulan_ini':
      return { dari: awalBulan(y, m), sampai: akhirBulan(y, m), label: `${NAMA_BULAN[m]} ${y}` };
    case 'bulan_lalu': {
      const d = new Date(y, m - 1, 1);
      return {
        dari: awalBulan(d.getFullYear(), d.getMonth()),
        sampai: akhirBulan(d.getFullYear(), d.getMonth()),
        label: `${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`,
      };
    }
    case 'tahun_ini':
      return { dari: `${y}-01-01`, sampai: `${y}-12-31`, label: `Tahun ${y}` };
    case 'tahun_lalu':
      return { dari: `${y - 1}-01-01`, sampai: `${y - 1}-12-31`, label: `Tahun ${y - 1}` };
    case 'semua':
      return { dari: '', sampai: '', label: 'Semua periode' };
    case 'kustom': {
      const dari = kustom.dari ?? '';
      const sampai = kustom.sampai ?? '';
      let label = 'Semua periode';
      if (dari && sampai) label = `${formatTanggal(dari, 'pendek')} - ${formatTanggal(sampai, 'pendek')}`;
      else if (dari) label = `Sejak ${formatTanggal(dari, 'pendek')}`;
      else if (sampai) label = `Hingga ${formatTanggal(sampai, 'pendek')}`;
      return { dari, sampai, label };
    }
  }
}
