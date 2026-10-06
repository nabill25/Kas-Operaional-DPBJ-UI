import { cn } from '../../lib/cn';

export function inisial(nama: string): string {
  const kata = nama
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (kata.length === 0) return '?';
  return (kata[0][0] + (kata.length > 1 ? kata[kata.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ nama, className }: { nama: string; className?: string }) {
  return (
    <span
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-navy-700 to-navy-900 text-[11px] font-bold tracking-wide text-kuning-300 ring-2 ring-white/70 dark:from-navy-500 dark:to-navy-700 dark:ring-white/10',
        className,
      )}
      aria-hidden
    >
      {inisial(nama)}
    </span>
  );
}
