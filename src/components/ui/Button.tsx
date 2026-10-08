import { LoaderCircle } from 'lucide-react';
import { motion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '../../lib/cn';

export type Varian = 'utama' | 'kedua' | 'hantu' | 'bahaya' | 'navy' | 'sukses';
export type Ukuran = 'sm' | 'md' | 'lg' | 'ikon' | 'ikon-sm';

const DASAR =
  'relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold tracking-[-0.01em] transition-[filter,background-color,color,box-shadow,opacity] duration-200 disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kuning-500';

const VARIAN: Record<Varian, string> = {
  utama:
    'text-navy-950 bg-linear-to-b from-kuning-300 via-kuning-400 to-kuning-500 shadow-[inset_0_1px_0_rgb(255_255_255/0.7),inset_0_-1px_0_rgb(var(--aksen-tepi)/0.35),0_10px_24px_-12px_rgb(var(--aksen-kilau)/0.95)] hover:brightness-[1.05] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.75),inset_0_-1px_0_rgb(var(--aksen-tepi)/0.35),0_14px_28px_-12px_rgb(var(--aksen-kilau)/1)]',
  kedua: 'glass text-fg hover:bg-white/50 dark:hover:bg-white/[0.08]',
  hantu: 'text-fg-muted hover:bg-fg/[0.06] hover:text-fg',
  bahaya:
    'text-white bg-linear-to-b from-red-500 to-red-600 shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_10px_22px_-12px_rgb(220_38_38/0.9)] hover:brightness-110',
  navy: 'text-white bg-linear-to-b from-navy-700 to-navy-900 shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_10px_22px_-12px_rgb(10_26_63/0.9)] hover:brightness-125 dark:from-navy-500 dark:to-navy-700',
  sukses:
    'text-white bg-linear-to-b from-emerald-500 to-emerald-600 shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_10px_22px_-12px_rgb(5_150_105/0.9)] hover:brightness-110',
};

const UKURAN: Record<Ukuran, string> = {
  sm: 'h-9 gap-1.5 rounded-xl px-3.5 text-[13px]',
  md: 'h-11 gap-2 rounded-xl px-4.5 text-sm',
  lg: 'h-12 gap-2.5 rounded-2xl px-6 text-[15px]',
  ikon: 'size-10 rounded-xl',
  'ikon-sm': 'size-8 rounded-lg',
};

export function kelasTombol(varian: Varian = 'utama', ukuran: Ukuran = 'md', className?: string): string {
  return cn(DASAR, VARIAN[varian], UKURAN[ukuran], className);
}

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  varian?: Varian;
  ukuran?: Ukuran;
  memuat?: boolean;
  ikon?: ReactNode;
  children?: ReactNode;
}

export function Button({
  varian = 'utama',
  ukuran = 'md',
  memuat = false,
  ikon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const nonaktif = disabled || memuat;
  return (
    <motion.button
      type={type}
      whileTap={nonaktif ? undefined : { scale: 0.965 }}
      transition={{ type: 'spring', stiffness: 520, damping: 30 }}
      disabled={nonaktif}
      aria-busy={memuat || undefined}
      className={kelasTombol(varian, ukuran, className)}
      {...rest}
    >
      {memuat ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : ikon}
      {children}
    </motion.button>
  );
}

interface TautanTombolProps extends LinkProps {
  varian?: Varian;
  ukuran?: Ukuran;
  ikon?: ReactNode;
}

export function TautanTombol({ varian = 'utama', ukuran = 'md', ikon, className, children, ...rest }: TautanTombolProps) {
  return (
    <Link className={kelasTombol(varian, ukuran, typeof className === 'string' ? className : undefined)} {...rest}>
      {ikon}
      {children}
    </Link>
  );
}
