import { Ban, BadgeCheck, Banknote, Bell, BellOff, CheckCheck, ClipboardCheck, Hourglass, Send, Undo2, UserPlus, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Popover } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { JenisNotifikasi } from '../../../shared/constants';
import { waktuRelatif } from '../../../shared/format';
import type { Notifikasi, NotifikasiData } from '../../../shared/types';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';
import { useBacaNotifikasi, useNotifikasi } from '../../lib/queries';
import { Chip } from '../ui/Badge';

const GAYA_JENIS: Record<JenisNotifikasi, { ikon: LucideIcon; warna: string }> = {
  diajukan: { ikon: Send, warna: 'bg-blue-500/12 text-blue-700 dark:text-blue-300' },
  dikembalikan: { ikon: Undo2, warna: 'bg-amber-400/20 text-amber-700 dark:text-amber-300' },
  diteruskan_mdk: { ikon: Hourglass, warna: 'bg-violet-500/12 text-violet-700 dark:text-violet-300' },
  selesai: { ikon: BadgeCheck, warna: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' },
  selesai_dibatalkan: { ikon: Ban, warna: 'bg-red-500/10 text-red-700 dark:text-red-300' },
  registrasi: { ikon: UserPlus, warna: 'bg-sky-500/12 text-sky-700 dark:text-sky-300' },
  dibayarkan: { ikon: Banknote, warna: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' },
  diverifikasi: { ikon: ClipboardCheck, warna: 'bg-cyan-500/12 text-cyan-800 dark:text-cyan-300' },
  diajukan_mdk: { ikon: Hourglass, warna: 'bg-violet-500/12 text-violet-700 dark:text-violet-300' },
};

/** Halaman tujuan notifikasi: detail pengajuan, atau halaman Pengguna untuk pendaftaran akun. */
function tautanNotifikasi(n: Notifikasi): string | null {
  if (n.pengajuan_id) return `/pengajuan/${n.pengajuan_id}`;
  if (n.jenis === 'registrasi') return '/pengguna';
  return null;
}

/** Penanda ringkasan "n notifikasi belum dibaca" sudah ditampilkan untuk user ini di tab ini. */
export const KUNCI_RINGKAS_NOTIF = 'kas-notif-ringkas';

function sudahRingkas(userId: number): boolean {
  try {
    if (sessionStorage.getItem(KUNCI_RINGKAS_NOTIF) === String(userId)) return true;
    sessionStorage.setItem(KUNCI_RINGKAS_NOTIF, String(userId));
  } catch {
    // penyimpanan tidak tersedia → tetap tampilkan ringkasan
  }
  return false;
}

/**
 * Notifikasi otomatis: saat aplikasi dibuka tampil ringkasan belum dibaca (sekali per tab),
 * lalu setiap notifikasi baru (polling 30 detik) muncul sebagai toast.
 */
function usePantauNotifikasi(
  data: NotifikasiData | undefined,
  userId: number | undefined,
  setOpen: (open: boolean) => void,
) {
  const navigate = useNavigate();
  const terakhir = useRef<number | null>(null);

  useEffect(() => {
    if (!data || !userId) return;
    const maks = data.items.reduce((m, n) => Math.max(m, n.id), 0);
    if (terakhir.current === null) {
      terakhir.current = maks;
      if (data.belumDibaca > 0 && !sudahRingkas(userId)) {
        toast.info(`${data.belumDibaca} notifikasi belum dibaca`, {
          id: 'notif-ringkas',
          description: data.items.find((n) => !n.dibaca)?.judul,
          action: { label: 'Lihat', onClick: () => setOpen(true) },
        });
      }
      return;
    }
    const batas = terakhir.current;
    const baru = data.items.filter((n) => n.id > batas && !n.dibaca);
    terakhir.current = Math.max(batas, maks);
    for (const n of baru.slice(0, 3).reverse()) {
      const ke = tautanNotifikasi(n);
      toast.info(n.judul, {
        id: `notif-${n.id}`,
        description: `${n.kode} · ${n.pesan}`,
        duration: 8000,
        action: ke ? { label: 'Buka', onClick: () => navigate(ke) } : undefined,
      });
    }
    if (baru.length > 3) {
      toast.info(`+${baru.length - 3} notifikasi baru lainnya`, {
        action: { label: 'Lihat', onClick: () => setOpen(true) },
      });
    }
  }, [data, userId, navigate, setOpen]);
}

function ItemNotifikasi({ n, onPilih }: { n: Notifikasi; onPilih: (n: Notifikasi) => void }) {
  const gaya = GAYA_JENIS[n.jenis];
  const isi = (
    <>
      <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl', gaya.warna)}>
        <gaya.ikon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn('min-w-0 flex-1 truncate text-sm text-fg', n.dibaca ? 'font-medium' : 'font-bold')}>{n.judul}</p>
          {!n.dibaca && <span className="size-2 shrink-0 rounded-full bg-red-500" aria-label="belum dibaca" />}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">{n.pesan}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <Chip>{n.kode}</Chip>
          <span className="ml-auto shrink-0 text-[11px] text-fg-subtle">{waktuRelatif(n.created_at)}</span>
        </div>
      </div>
    </>
  );
  const kelas = cn(
    'flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-fg/[0.05]',
    !n.dibaca && 'bg-kuning-400/[0.09] dark:bg-kuning-400/[0.06]',
  );
  const ke = tautanNotifikasi(n);
  return ke ? (
    <Link to={ke} onClick={() => onPilih(n)} className={kelas}>
      {isi}
    </Link>
  ) : (
    <button type="button" onClick={() => onPilih(n)} className={kelas}>
      {isi}
    </button>
  );
}

export function NotifikasiMenu() {
  const { user } = useAuth();
  const { data } = useNotifikasi();
  const baca = useBacaNotifikasi();
  const [open, setOpen] = useState(false);
  usePantauNotifikasi(data, user?.id, setOpen);

  // Pimpinan hanya memantau (tidak menerima notifikasi alur).
  if (!user || user.role === 'pimpinan') return null;

  const belum = data?.belumDibaca ?? 0;
  const items = data?.items ?? [];
  const antrian =
    user.role === 'operator'
      ? data?.antrian.dikembalikan
        ? { ke: '/pengajuan?status=dikembalikan', label: `Lihat ${data.antrian.dikembalikan} pengajuan dikembalikan` }
        : null
      : { ke: '/verifikasi', label: 'Buka antrian verifikasi PUM' };

  const pilih = (n: Notifikasi) => {
    setOpen(false);
    if (!n.dibaca) baca.mutate(n.id);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="glass relative grid size-10 place-items-center rounded-xl text-fg-muted transition hover:text-fg"
          aria-label={belum > 0 ? `Notifikasi, ${belum} belum dibaca` : 'Notifikasi'}
        >
          <Bell className={cn('size-[18px]', belum > 0 && 'origin-top animate-goyang')} />
          <AnimatePresence>
            {belum > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-bg"
              >
                {belum > 99 ? '99+' : belum}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          collisionPadding={12}
          aria-label="Notifikasi"
          className="glass-strong anim-pop z-50 w-[min(92vw,390px)] overflow-hidden rounded-2xl shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-bold text-fg">Notifikasi</p>
              <p className="text-xs text-fg-muted">{belum > 0 ? `${belum} belum dibaca` : 'Semua sudah dibaca'}</p>
            </div>
            {belum > 0 && (
              <button
                type="button"
                onClick={() => baca.mutate(undefined)}
                disabled={baca.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-navy-700 transition hover:bg-fg/[0.05] disabled:opacity-60 dark:text-kuning-300"
              >
                <CheckCheck className="size-3.5" /> Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="max-h-[400px] space-y-0.5 overflow-y-auto p-1.5">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <BellOff className="size-8 text-fg-subtle" aria-hidden />
                <p className="text-sm font-semibold text-fg">Belum ada notifikasi</p>
                <p className="text-xs text-fg-muted">
                  {user.role === 'operator'
                    ? 'Anda akan diberi tahu saat PUM mengembalikan, meneruskan ke MDK, atau menyelesaikan pengajuan Anda.'
                    : 'Anda akan diberi tahu saat ada pengajuan baru yang perlu diperiksa.'}
                </p>
              </div>
            ) : (
              items.map((n) => <ItemNotifikasi key={n.id} n={n} onPilih={pilih} />)
            )}
          </div>
          {antrian && (
            <Link
              to={antrian.ke}
              onClick={() => setOpen(false)}
              className="block border-t border-line px-4 py-3 text-center text-[13px] font-semibold text-navy-700 transition hover:bg-fg/[0.04] dark:text-kuning-300"
            >
              {antrian.label}
            </Link>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
