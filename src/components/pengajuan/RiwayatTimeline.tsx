import {
  Ban,
  BadgeCheck,
  Banknote,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Hourglass,
  ListChecks,
  CloudUpload,
  FilePlus,
  PencilLine,
  ReceiptText,
  RotateCcw,
  Send,
  Trash,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { AKSI_RIWAYAT_LABEL, type AksiRiwayat } from '../../../shared/constants';
import { formatWaktu, waktuRelatif } from '../../../shared/format';
import type { Riwayat } from '../../../shared/types';
import { cn } from '../../lib/cn';

const GAYA: Record<AksiRiwayat, { ikon: LucideIcon; warna: string }> = {
  dibuat: { ikon: FilePlus, warna: 'bg-navy-900 text-kuning-300 dark:bg-white/15 dark:text-kuning-300' },
  diubah: { ikon: PencilLine, warna: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  dihapus: { ikon: Trash, warna: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  berkas_diunggah: { ikon: CloudUpload, warna: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  berkas_dihapus: { ikon: Trash, warna: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  berkas_na: { ikon: Ban, warna: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  berkas_na_batal: { ikon: RotateCcw, warna: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  diajukan: { ikon: Send, warna: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  ditarik: { ikon: RotateCcw, warna: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  berkas_dicek: { ikon: CircleCheck, warna: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  berkas_revisi: { ikon: CircleX, warna: 'bg-amber-400/25 text-amber-700 dark:text-amber-300' },
  berkas_cek_batal: { ikon: RotateCcw, warna: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  dikembalikan: { ikon: Undo2, warna: 'bg-amber-400/25 text-amber-700 dark:text-amber-300' },
  diteruskan_mdk: { ikon: Hourglass, warna: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  data_pum_diubah: { ikon: ListChecks, warna: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  selesai: { ikon: BadgeCheck, warna: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  invoice_diubah: { ikon: ReceiptText, warna: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  selesai_dibatalkan: { ikon: Ban, warna: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  dibayarkan: { ikon: Banknote, warna: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  dibayarkan_batal: { ikon: RotateCcw, warna: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  diverifikasi: { ikon: ClipboardCheck, warna: 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300' },
  diajukan_mdk: { ikon: Hourglass, warna: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
};

export function gayaAksi(aksi: AksiRiwayat) {
  return GAYA[aksi] ?? GAYA.diubah;
}

export function RiwayatTimeline({ items, tampilKode = false }: { items: Riwayat[]; tampilKode?: boolean }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-fg-muted">Belum ada aktivitas.</p>;
  return (
    <ol className="relative space-y-1">
      <span className="absolute top-3 bottom-3 left-[17px] w-px bg-line" aria-hidden />
      {items.map((r, i) => {
        const g = gayaAksi(r.aksi);
        return (
          <motion.li
            key={r.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i, 12) * 0.04, duration: 0.3 }}
            className="relative flex gap-3 rounded-xl py-2"
          >
            <span className={cn('relative z-10 grid size-[35px] shrink-0 place-items-center rounded-full ring-4 ring-surface/0', g.warna)}>
              <g.ikon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] leading-snug font-semibold text-fg">
                {tampilKode &&
                  (r.pengajuan_id ? (
                    <Link
                      to={`/pengajuan/${r.pengajuan_id}`}
                      className="mr-1.5 font-mono text-[11.5px] text-navy-700 hover:underline dark:text-kuning-300"
                    >
                      {r.kode}
                    </Link>
                  ) : (
                    <span className="mr-1.5 font-mono text-[11.5px] text-fg-muted">{r.kode}</span>
                  ))}
                {AKSI_RIWAYAT_LABEL[r.aksi] ?? r.aksi}
              </p>
              {r.keterangan && <p className="mt-0.5 text-xs break-words text-fg-muted">{r.keterangan}</p>}
              <p className="mt-0.5 text-[11px] text-fg-subtle" title={formatWaktu(r.created_at)}>
                {r.user_nama ?? 'Sistem'} · {waktuRelatif(r.created_at)}
              </p>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
