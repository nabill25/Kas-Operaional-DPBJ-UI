import { useId } from 'react';
import { cn } from '../../lib/cn';

/**
 * Logo aplikasi (sama dengan public/logo.svg) yang warnanya mengikuti tema warna aktif.
 * Warna lewat `style` karena var() CSS tidak andal di atribut presentasi SVG.
 */
export function Logo({ className }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg viewBox="0 0 64 64" className={cn('shrink-0', className)} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${id}-latar`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-navy-700)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-navy-950)' }} />
        </linearGradient>
        <linearGradient id={`${id}-isi`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-kuning-300)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-kuning-500)' }} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id}-latar)`} />
      <rect x="10" y="17" width="44" height="31" rx="8" fill={`url(#${id}-isi)`} />
      <rect x="10" y="17" width="44" height="10" rx="5" style={{ fill: 'var(--color-kuning-50)' }} opacity="0.55" />
      <rect x="35" y="27.5" width="19" height="12" rx="6" style={{ fill: 'var(--color-navy-900)' }} />
      <circle cx="42" cy="33.5" r="2.7" style={{ fill: 'var(--color-kuning-500)' }} />
      <rect x="15" y="40" width="14" height="3" rx="1.5" style={{ fill: 'var(--color-navy-900)' }} opacity="0.35" />
    </svg>
  );
}
