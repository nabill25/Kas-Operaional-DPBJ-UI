import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { GlassCard } from '../ui/GlassCard';

const NADA = {
  biru: 'bg-blue-500/12 text-blue-700 ring-blue-500/20 dark:text-blue-300',
  ungu: 'bg-violet-500/12 text-violet-700 ring-violet-500/20 dark:text-violet-300',
  kuning: 'bg-amber-400/20 text-amber-700 ring-amber-500/25 dark:text-amber-300',
  hijau: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
  abu: 'bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300',
  merah: 'bg-red-500/10 text-red-600 ring-red-500/20 dark:text-red-400',
  navy: 'bg-navy-900/[0.07] text-navy-800 ring-navy-900/15 dark:bg-white/10 dark:text-kuning-300 dark:ring-white/15',
} as const;

export function KpiTile({
  label,
  nilai,
  format,
  sub,
  ikon,
  nada,
  ke,
  indeks = 0,
  akhiran,
}: {
  label: string;
  nilai: number;
  format?: (n: number) => string;
  sub?: ReactNode;
  ikon: ReactNode;
  nada: keyof typeof NADA;
  ke?: string;
  indeks?: number;
  akhiran?: string;
}) {
  const isi = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={cn('grid size-10 place-items-center rounded-2xl ring-1 [&>svg]:size-[18px]', NADA[nada])}>{ikon}</span>
        {ke && (
          <ArrowUpRight
            className="size-4 text-fg-subtle transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg"
            aria-hidden
          />
        )}
      </div>
      <p className="mt-4 text-[13px] font-semibold text-fg-muted">{label}</p>
      <p className="mt-0.5 text-[28px] leading-tight font-extrabold tracking-[-0.03em] text-fg">
        <AnimatedNumber value={nilai} format={format} />
        {akhiran && <span className="ml-1 text-base font-bold text-fg-muted">{akhiran}</span>}
      </p>
      {sub && <p className="mt-0.5 truncate text-xs text-fg-muted">{sub}</p>}
    </>
  );
  return (
    <GlassCard
      interaktif
      className="group h-full p-0"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * indeks, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {ke ? (
        <Link to={ke} className="block h-full rounded-3xl p-5 outline-offset-2">
          {isi}
        </Link>
      ) : (
        <div className="h-full p-5">{isi}</div>
      )}
    </GlassCard>
  );
}
