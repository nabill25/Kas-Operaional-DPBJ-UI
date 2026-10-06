import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Kosong({
  ikon,
  judul,
  deskripsi,
  aksi,
  className,
}: {
  ikon: ReactNode;
  judul: ReactNode;
  deskripsi?: ReactNode;
  aksi?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center px-6 py-12 text-center', className)}
    >
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-3xl bg-kuning-400/30 blur-xl" aria-hidden />
        <div className="glass relative grid size-16 place-items-center rounded-3xl text-navy-700 dark:text-kuning-300 [&>svg]:size-7">
          {ikon}
        </div>
      </div>
      <h3 className="text-base font-bold text-fg">{judul}</h3>
      {deskripsi && <p className="mt-1 max-w-sm text-sm text-fg-muted">{deskripsi}</p>}
      {aksi && <div className="mt-5">{aksi}</div>}
    </motion.div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}
