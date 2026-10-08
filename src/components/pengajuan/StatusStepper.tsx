import { BadgeCheck, Check, ClipboardCheck, Hourglass, PencilLine, Send, Undo2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { Status } from '../../../shared/constants';
import { formatWaktu } from '../../../shared/format';
import type { PengajuanDetail } from '../../../shared/types';
import { cn } from '../../lib/cn';

type Keadaan = 'selesai' | 'aktif' | 'peringatan' | 'menunggu';

/** Indeks tahap yang sedang berjalan per status (dikembalikan = kembali ke tahap PUM). */
const INDEKS_TAHAP: Record<Status, number> = { draft: 0, diajukan_pum: 1, dikembalikan: 1, diverifikasi_pum: 2, diajukan_mdk: 3, selesai: 4 };
const JUMLAH_TAHAP = 5;

/** Tahapan: Draft → Diajukan ke PUM → Verifikasi PUM → Diajukan ke MDK (di luar sistem) → Paid. */
export function StatusStepper({ p }: { p: PengajuanDetail }) {
  const kembali = p.status === 'dikembalikan';
  const indeksAktif = INDEKS_TAHAP[p.status];
  // Tahap sebelum tahap berjalan = sudah lewat; tahap berjalan = aktif; "Paid" langsung selesai.
  const keadaan = (i: number): Keadaan =>
    i < indeksAktif || (i === indeksAktif && p.status === 'selesai') ? 'selesai' : i === indeksAktif ? 'aktif' : 'menunggu';
  const sudah = (i: number) => i <= indeksAktif && !kembali;

  const langkah: { judul: string; ket: string; ikon: typeof Send; keadaan: Keadaan }[] = [
    {
      judul: 'Draft dibuat',
      ket: formatWaktu(p.created_at),
      ikon: PencilLine,
      keadaan: keadaan(0),
    },
    {
      // Tanda pisah lunak: di HP kata panjang ini dipenggal "Dikem-balikan" alih-alih menimpa tahap sebelahnya.
      judul: kembali ? 'Dikem\u00ADbalikan PUM' : 'Diajukan ke PUM',
      ket: kembali ? formatWaktu(p.diproses_at) : p.diajukan_at ? formatWaktu(p.diajukan_at) : 'Belum diajukan',
      ikon: kembali ? Undo2 : Send,
      keadaan: kembali ? 'peringatan' : keadaan(1),
    },
    {
      judul: 'Verifikasi PUM',
      ket: sudah(2) && p.diverifikasi_at ? formatWaktu(p.diverifikasi_at) : 'Menunggu verifikasi PUM',
      ikon: ClipboardCheck,
      keadaan: keadaan(2),
    },
    {
      judul: 'Diajukan ke MDK',
      ket: sudah(3) && p.diajukan_mdk_at ? formatWaktu(p.diajukan_mdk_at) : 'Menunggu input invoice',
      ikon: Hourglass,
      keadaan: keadaan(3),
    },
    {
      judul: 'Paid',
      ket: p.status === 'selesai' ? formatWaktu(p.diproses_at) : 'Menunggu verifikasi MDK',
      ikon: BadgeCheck,
      keadaan: keadaan(4),
    },
  ];

  return (
    <ol className="relative grid grid-cols-5 gap-1 sm:gap-2" aria-label="Tahapan pengajuan">
      <div className="absolute top-[18px] right-[10%] left-[10%] h-0.5 rounded-full bg-fg/10 sm:top-5" aria-hidden>
        <motion.div
          className={cn('h-full origin-left rounded-full', kembali ? 'bg-amber-500' : 'bg-linear-to-r from-kuning-500 to-emerald-500')}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: indeksAktif / (JUMLAH_TAHAP - 1) }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </div>
      {langkah.map((l, i) => (
        <li key={l.judul} className="relative flex min-w-0 flex-col items-center text-center" aria-current={i === indeksAktif ? 'step' : undefined}>
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 380, damping: 22 }}
            className={cn(
              'relative z-10 grid size-9 place-items-center rounded-full ring-4 ring-bg sm:size-10',
              l.keadaan === 'selesai' && 'bg-emerald-500 text-white',
              l.keadaan === 'aktif' && 'bg-linear-to-b from-kuning-300 to-kuning-500 text-navy-950 shadow-lg shadow-kuning-500/30',
              l.keadaan === 'peringatan' && 'bg-amber-500 text-white shadow-lg shadow-amber-500/30',
              l.keadaan === 'menunggu' && 'bg-surface text-fg-subtle ring-fg/10',
            )}
          >
            {l.keadaan === 'selesai' ? <Check className="size-4 sm:size-4.5" strokeWidth={3} /> : <l.ikon className="size-4 sm:size-4.5" />}
            {l.keadaan === 'aktif' && <span className="absolute inset-0 animate-ping rounded-full bg-kuning-400/40" aria-hidden />}
          </motion.span>
          <p
            className={cn(
              'mt-2 text-[10.5px] leading-tight font-bold sm:text-[13px]',
              l.keadaan === 'menunggu' ? 'text-fg-subtle' : 'text-fg',
            )}
          >
            {l.judul}
          </p>
          <p className="mt-0.5 hidden text-[11px] text-fg-muted sm:block">{l.ket}</p>
        </li>
      ))}
    </ol>
  );
}
