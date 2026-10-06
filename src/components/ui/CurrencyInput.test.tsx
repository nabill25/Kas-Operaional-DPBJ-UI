import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CurrencyInput } from './CurrencyInput';

function Wadah({ awal = null, onUbah }: { awal?: number | null; onUbah?: (v: number | null) => void }) {
  const [nilai, setNilai] = useState<number | null>(awal);
  return (
    <CurrencyInput
      id="uang"
      aria-label="Nilai"
      value={nilai}
      onChange={(v) => {
        setNilai(v);
        onUbah?.(v);
      }}
    />
  );
}

describe('CurrencyInput', () => {
  it('menampilkan nilai dengan pemisah ribuan & prefiks Rp', () => {
    render(<Wadah awal={1250000} />);
    const input = screen.getByLabelText('Nilai') as HTMLInputElement;
    expect(input.value).toBe('1.250.000');
    expect(screen.getByText('Rp')).toBeTruthy();
    expect(input.getAttribute('inputmode')).toBe('numeric');
  });

  it('mengetik angka → onChange menerima bilangan bulat', () => {
    const onUbah = vi.fn();
    render(<Wadah onUbah={onUbah} />);
    const input = screen.getByLabelText('Nilai') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '150000' } });
    expect(onUbah).toHaveBeenLastCalledWith(150000);
    expect(input.value).toBe('150.000');
  });

  it('mengabaikan karakter non-angka & nol di depan', () => {
    const onUbah = vi.fn();
    render(<Wadah onUbah={onUbah} />);
    const input = screen.getByLabelText('Nilai') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Rp 0075.0a0' } });
    // digit yang tersisa: 007500 → nol di depan dibuang → 7500
    expect(onUbah).toHaveBeenLastCalledWith(7500);
    expect(input.value).toBe('7.500');
  });

  it('mengosongkan → null', () => {
    const onUbah = vi.fn();
    render(<Wadah awal={5000} onUbah={onUbah} />);
    fireEvent.change(screen.getByLabelText('Nilai'), { target: { value: '' } });
    expect(onUbah).toHaveBeenLastCalledWith(null);
  });

  it('menandai invalid untuk aksesibilitas', () => {
    render(<CurrencyInput id="x" aria-label="X" value={null} onChange={() => {}} invalid />);
    const input = screen.getByLabelText('X');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('x-error');
  });
});
