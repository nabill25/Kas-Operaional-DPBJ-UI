import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { KONFIG_UJI_BORONGAN } from '../../../tests/support/konfig-uji';
import { KonfigTetap } from '../../context/KonfigContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { KategoriBadge, MekanismeBadge, StatusBadge } from './Badge';

/** Badge kategori butuh master jenis pengajuan (KonfigContext) & mode tampilan (warna seri). */
function Bungkus({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <KonfigTetap konfig={KONFIG_UJI_BORONGAN}>{children}</KonfigTetap>
    </ThemeProvider>
  );
}

describe('Badge', () => {
  it('status selalu berlabel teks (bukan warna saja)', () => {
    render(
      <>
        <StatusBadge status="draft" />
        <StatusBadge status="diajukan_pum" />
        <StatusBadge status="dikembalikan" />
        <StatusBadge status="diverifikasi_pum" />
        <StatusBadge status="diajukan_mdk" />
        <StatusBadge status="selesai" />
      </>,
    );
    for (const label of ['Draft', 'Diajukan ke PUM', 'Dikembalikan', 'Diverifikasi PUM', 'Diajukan ke MDK', 'Selesai (Paid)']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('kategori: label panjang & pendek dari master jenis pengajuan', () => {
    const { rerender } = render(<KategoriBadge kategori="perjadin" />, { wrapper: Bungkus });
    expect(screen.getByText('Transport Perjadin')).toBeTruthy();
    rerender(<KategoriBadge kategori="rumah_tangga" pendek />);
    expect(screen.getByText('Rumah Tangga')).toBeTruthy();
    // Jenis tambahan dari master & kode yang tidak dikenal (tetap tampil, tidak error).
    rerender(<KategoriBadge kategori="kontrak_borongan" />);
    expect(screen.getByText('Kontrak Borongan')).toBeTruthy();
    rerender(<KategoriBadge kategori="jenis_lama" pendek />);
    expect(screen.getByText('jenis_lama')).toBeTruthy();
  });

  it('mekanisme', () => {
    render(<MekanismeBadge mekanisme="LS" />);
    expect(screen.getByText('LS')).toBeTruthy();
  });
});
