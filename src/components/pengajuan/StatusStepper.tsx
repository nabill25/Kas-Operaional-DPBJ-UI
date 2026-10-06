import { BadgeCheck, Check, Hourglass, PencilLine, Send, Undo2 } from 'lucide-react';
import { motion } from 'motion/react';
import { formatWaktu } from '../../../shared/format';
import type { PengajuanDetail } from '../../../shared/types';
import { cn } from '../../lib/cn';

type Keadaan = 'selesai' | 'aktif' | 'peringatan' | 'menunggu';

/** Tahapan: Draft → Diajukan ke PUM → Diajukan ke MDK (di luar sistem) → Selesai (paid). */
export function StatusStepper({ p }: { p: PengajuanDetail }) {
  const kembali = p.status === 'dikembalikan';
  const lewatPum = p.status === 'diajukan_mdk' || p.status === 'selesai';
  const langkah: { judul: string; ket: string; ikon: typeof Send; keadaan: Keadaan }[] = [
    {
      judul: 'Draft dibuat',
      ket: formatWaktu(p.created_at),
      ikon: PencilLine,
      keadaan: p.status === 'draft' ? 'aktif' : 'selesai',
    },
    {
      judul: kembali ? 'Dikembalikan PUM' : 'Diajukan ke PUM',
      ket: kembali
        ? formatWaktu(p.diproses_at)
        : p.diajukan_at
          ? formatWaktu(p.diajukan_at)
          : 'Belum diajukan',
      ikon: kembali ? Undo2 : Send,
      keadaan: kembali ? 'peringatan' : p.status === 'diajukan_pum' ? 'aktif' : lewatPum ? 'selesai' : 'menunggu',
    },
    {
      judul: 'Diajukan ke MDK',
      ket: p.diteruskan_at && lewatPum ? formatWaktu(p.diteruskan_at) : 'Menunggu verifikasi PUM',
      ikon: Hourglass,
      keadaan: p.status === 'diajukan_mdk' ? 'aktif' : p.status === 'selesai' ? 'selesai' : 'menunggu',
    },
    {
      judul: 'Selesai (Paid)',
      ket: p.status === 'selesai' ? formatWaktu(p.diproses_at) : 'Menunggu invoice MDK',
      ikon: BadgeCheck,
      keadaan: p.status === 'selesai' ? 'selesai' : 'menunggu',
    },
  ];
  const indeksAktif = p.status === 'draft' ? 0 : p.status === 'selesai' ? 3 : p.status === 'diajukan_mdk' ? 2 : 1;

  return (
    <ol className="relative grid grid-cols-4 gap-1 sm:gap-2" aria-label="Tahapan pengajuan">
      <div className="absolute top-5 right-[12.5%] left-[12.5%] h-0.5 rounded-full bg-fg/10" aria-hidden>
        <motion.div
          className={cn('h-full origin-left rounded-full', kembali ? 'bg-amber-500' : 'bg-linear-to-r from-kuning-500 to-emerald-500')}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: indeksAktif / 3 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </div>
      {langkah.map((l, i) => (
        <li key={l.judul} className="relative flex flex-col items-center text-center" aria-current={i === indeksAktif ? 'step' : undefined}>
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 380, damping: 22 }}
            className={cn(
              'relative z-10 grid size-10 place-items-center rounded-full ring-4 ring-bg',
              l.keadaan === 'selesai' && 'bg-emerald-500 text-white',
              l.keadaan === 'aktif' && 'bg-linear-to-b from-kuning-300 to-kuning-500 text-navy-950 shadow-lg shadow-kuning-500/30',
              l.keadaan === 'peringatan' && 'bg-amber-500 text-white shadow-lg shadow-amber-500/30',
              l.keadaan === 'menunggu' && 'bg-surface text-fg-subtle ring-fg/10',
            )}
          >
            {l.keadaan === 'selesai' ? <Check className="size-4.5" strokeWidth={3} /> : <l.ikon className="size-4.5" />}
            {l.keadaan === 'aktif' && <span className="absolute inset-0 animate-ping rounded-full bg-kuning-400/40" aria-hidden />}
          </motion.span>
          <p className={cn('mt-2 text-[11px] leading-tight font-bold sm:text-[13px]', l.keadaan === 'menunggu' ? 'text-fg-subtle' : 'text-fg')}>
            {l.judul}
          </p>
          <p className="mt-0.5 hidden text-[11px] text-fg-muted sm:block">{l.ket}</p>
        </li>
      ))}
    </ol>
  );
}
