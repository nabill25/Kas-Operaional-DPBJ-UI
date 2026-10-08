import { BadgeCheck, Car, ClipboardCheck, Coffee, Hourglass, PencilLine, Plane, Send, Undo2, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { KATEGORI_INFO, STATUS_INFO, type Kategori, type Mekanisme, type Status } from '../../../shared/constants';
import { cn } from '../../lib/cn';

export const IKON_STATUS: Record<Status, LucideIcon> = {
  draft: PencilLine,
  diajukan_pum: Send,
  dikembalikan: Undo2,
  diverifikasi_pum: ClipboardCheck,
  diajukan_mdk: Hourglass,
  selesai: BadgeCheck,
};

const GAYA_STATUS: Record<Status, string> = {
  draft: 'bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/20',
  diajukan_pum:
    'bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:bg-blue-400/12 dark:text-blue-300 dark:ring-blue-400/25',
  diverifikasi_pum:
    'bg-cyan-500/10 text-cyan-800 ring-cyan-600/25 dark:bg-cyan-400/12 dark:text-cyan-300 dark:ring-cyan-400/25',
  diajukan_mdk:
    'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:bg-violet-400/12 dark:text-violet-300 dark:ring-violet-400/25',
  dikembalikan:
    'bg-amber-400/15 text-amber-700 ring-amber-500/25 dark:bg-amber-400/12 dark:text-amber-300 dark:ring-amber-400/25',
  selesai:
    'bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/12 dark:text-emerald-300 dark:ring-emerald-400/25',
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const Ikon = IKON_STATUS[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        GAYA_STATUS[status],
        className,
      )}
    >
      <Ikon className="size-3.5" aria-hidden />
      {STATUS_INFO[status].label}
    </span>
  );
}

export const IKON_KATEGORI: Record<Kategori, LucideIcon> = {
  konsumsi: Coffee,
  rumah_tangga: Car,
  perjadin: Plane,
};

/** Warna seri kategori (tervalidasi) — dipakai untuk penanda/mark, BUKAN untuk teks. */
export const WARNA_KATEGORI: Record<Kategori, string> = {
  konsumsi: 'var(--seri-konsumsi)',
  rumah_tangga: 'var(--seri-rt)',
  perjadin: 'var(--seri-pd)',
};

export function KategoriBadge({
  kategori,
  pendek = false,
  className,
}: {
  kategori: Kategori;
  pendek?: boolean;
  className?: string;
}) {
  const Ikon = IKON_KATEGORI[kategori];
  const info = KATEGORI_INFO[kategori];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-fg/[0.05] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-fg ring-1 ring-fg/10 ring-inset',
        className,
      )}
    >
      <span className="grid size-4 place-items-center rounded-full" style={{ background: WARNA_KATEGORI[kategori] }} aria-hidden>
        <Ikon className="size-2.5 text-white" strokeWidth={2.75} />
      </span>
      {pendek ? info.labelPendek : info.label}
    </span>
  );
}

export function MekanismeBadge({ mekanisme }: { mekanisme: Mekanisme }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tracking-wide ring-1 ring-inset',
        mekanisme === 'KO'
          ? 'bg-navy-900/[0.06] text-navy-800 ring-navy-900/15 dark:bg-white/10 dark:text-navy-100 dark:ring-white/15'
          : 'bg-kuning-400/20 text-kuning-900 ring-kuning-600/30 dark:bg-kuning-400/15 dark:text-kuning-200 dark:ring-kuning-400/25',
      )}
    >
      {mekanisme}
    </span>
  );
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-lg bg-fg/[0.05] px-2 py-0.5 font-mono text-[11.5px] font-semibold whitespace-nowrap text-fg-muted ring-1 ring-fg/10 ring-inset',
        className,
      )}
    >
      {children}
    </span>
  );
}
