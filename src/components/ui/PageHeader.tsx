import { ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export function PageHeader({
  judul,
  deskripsi,
  aksi,
  kembali,
  atas,
}: {
  judul: ReactNode;
  deskripsi?: ReactNode;
  aksi?: ReactNode;
  kembali?: { ke: string; label: string };
  atas?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {kembali && (
          <Link
            to={kembali.ke}
            className="group mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-muted transition hover:text-fg"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
            {kembali.label}
          </Link>
        )}
        {atas && <div className="mb-2 flex flex-wrap items-center gap-2">{atas}</div>}
        <motion.h1
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="text-2xl font-extrabold tracking-[-0.025em] text-balance text-fg sm:text-[28px]"
        >
          {judul}
        </motion.h1>
        {deskripsi && <p className="mt-1 max-w-2xl text-sm text-fg-muted">{deskripsi}</p>}
      </div>
      {aksi && <div className="flex flex-wrap items-center gap-2">{aksi}</div>}
    </div>
  );
}
