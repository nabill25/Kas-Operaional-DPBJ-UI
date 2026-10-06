import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface OpsiSegmen<T extends string> {
  value: T;
  label: ReactNode;
  ikon?: ReactNode;
  jumlah?: number;
}

/** Kontrol segmen dengan "pil" kuning yang meluncur (shared layout animation). */
export function Segmented<T extends string>({
  value,
  onChange,
  opsi,
  layoutId,
  ukuran = 'md',
  penuh = false,
  label,
  className,
  id,
  invalid = false,
}: {
  value: T;
  onChange: (v: T) => void;
  opsi: OpsiSegmen<T>[];
  layoutId: string;
  ukuran?: 'sm' | 'md';
  penuh?: boolean;
  label?: string;
  className?: string;
  id?: string;
  invalid?: boolean;
}) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && id ? `${id}-error` : undefined}
      className={cn(
        'glass inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1 [scrollbar-width:none]',
        penuh && 'flex w-full',
        invalid && 'ring-2 ring-red-500/60',
        className,
      )}
    >
      {opsi.map((o) => {
        const aktif = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={aktif}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex shrink-0 items-center justify-center gap-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-kuning-500',
              ukuran === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-3.5 text-[13px]',
              penuh && 'flex-1',
              aktif ? 'text-navy-950' : 'text-fg-muted hover:bg-fg/[0.05] hover:text-fg',
            )}
          >
            {aktif && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-linear-to-b from-kuning-300 to-kuning-500 shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_6px_16px_-8px_rgb(230_170_0/0.9)]"
                transition={{ type: 'spring', stiffness: 430, damping: 34 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5 [&>svg]:size-4">
              {o.ikon}
              {o.label}
              {o.jumlah !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-px text-[10.5px] leading-4 font-bold',
                    aktif ? 'bg-navy-950/12 text-navy-950' : 'bg-fg/[0.07] text-fg-muted',
                  )}
                >
                  {o.jumlah}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
