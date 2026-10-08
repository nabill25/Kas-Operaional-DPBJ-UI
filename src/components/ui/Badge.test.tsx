import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KategoriBadge, MekanismeBadge, StatusBadge } from './Badge';

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

  it('kategori: label panjang & pendek', () => {
    const { rerender } = render(<KategoriBadge kategori="perjadin" />);
    expect(screen.getByText('Transport Perjadin')).toBeTruthy();
    rerender(<KategoriBadge kategori="rumah_tangga" pendek />);
    expect(screen.getByText('Rumah Tangga')).toBeTruthy();
  });

  it('mekanisme', () => {
    render(<MekanismeBadge mekanisme="LS" />);
    expect(screen.getByText('LS')).toBeTruthy();
  });
});
