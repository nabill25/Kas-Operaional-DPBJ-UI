import { useLayoutEffect, useRef, type ComponentProps } from 'react';
import { formatAngka } from '../../../shared/format';
import { cn } from '../../lib/cn';

interface CurrencyInputProps extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
  value: number | null;
  onChange: (nilai: number | null) => void;
  invalid?: boolean;
}

/** Input Rupiah: menampilkan pemisah ribuan saat mengetik, menyimpan bilangan bulat. */
export function CurrencyInput({ value, onChange, invalid, className, id, ...rest }: CurrencyInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const digitSebelumKursor = useRef<number | null>(null);
  const tampil = value === null || Number.isNaN(value) ? '' : formatAngka(value);

  // Pertahankan posisi kursor relatif terhadap jumlah digit (bukan karakter) setelah diformat ulang.
  useLayoutEffect(() => {
    const el = ref.current;
    const target = digitSebelumKursor.current;
    if (!el || target === null || document.activeElement !== el) return;
    let digit = 0;
    let pos = 0;
    while (pos < tampil.length && digit < target) {
      if (/\d/.test(tampil[pos])) digit++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
    digitSebelumKursor.current = null;
  }, [tampil]);

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute top-1/2 z-10 left-3.5 -translate-y-1/2 text-sm font-semibold text-fg-muted"
        aria-hidden
      >
        Rp
      </span>
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn('kontrol angka pl-10.5 font-semibold', className)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && id ? `${id}-error` : undefined}
        value={tampil}
        onChange={(e) => {
          const mentah = e.target.value;
          const kursor = e.target.selectionStart ?? mentah.length;
          digitSebelumKursor.current = mentah.slice(0, kursor).replace(/\D/g, '').length;
          const digit = mentah.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15);
          onChange(digit ? Number(digit) : null);
        }}
        {...rest}
      />
    </div>
  );
}
