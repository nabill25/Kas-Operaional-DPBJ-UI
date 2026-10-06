import { motion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';
import { useSpotlight } from '../../hooks/useSpotlight';
import { cn } from '../../lib/cn';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  /** Sorotan cahaya mengikuti kursor + sedikit terangkat saat hover. */
  interaktif?: boolean;
  children?: ReactNode;
}

export function GlassCard({ interaktif = false, className, children, onPointerMove, ...rest }: GlassCardProps) {
  const sorot = useSpotlight();
  return (
    <motion.div
      className={cn('glass rounded-3xl', interaktif && 'transition-shadow duration-300 hover:shadow-xl', className)}
      onPointerMove={(e) => {
        if (interaktif) sorot(e);
        onPointerMove?.(e);
      }}
      whileHover={interaktif ? { y: -3 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      {...rest}
    >
      {interaktif && <span className="glass-spot" aria-hidden />}
      {children}
    </motion.div>
  );
}

export function JudulKartu({
  judul,
  deskripsi,
  ikon,
  aksi,
  className,
}: {
  judul: ReactNode;
  deskripsi?: ReactNode;
  ikon?: ReactNode;
  aksi?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {ikon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-navy-900/[0.06] text-navy-800 ring-1 ring-navy-900/10 dark:bg-white/[0.07] dark:text-kuning-300 dark:ring-white/10">
            {ikon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[15px] leading-tight font-bold tracking-[-0.01em] text-fg">{judul}</h2>
          {deskripsi && <p className="mt-0.5 text-xs text-fg-muted">{deskripsi}</p>}
        </div>
      </div>
      {aksi && <div className="flex shrink-0 items-center gap-2">{aksi}</div>}
    </div>
  );
}
