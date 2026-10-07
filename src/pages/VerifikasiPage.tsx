import {
  BadgeCheck,
  ClipboardCheck,
  Eye,
  FolderKanban,
  Hourglass,
  Inbox,
  ReceiptText,
  Send,
  Undo2,
  Wallet,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { formatRentangTanggal, formatRupiah, formatRupiahRingkas, formatTanggal, formatWaktu, selisihHari } from '../../shared/format';
import type { PengajuanRingkas } from '../../shared/types';
import { CatatanModal, InvoiceModal, TeruskanModal } from '../components/pengajuan/AksiModal';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { Chip, KategoriBadge, MekanismeBadge } from '../components/ui/Badge';
import { Button, kelasTombol } from '../components/ui/Button';
import { GlassCard } from '../components/ui/GlassCard';
import { Kosong, Skeleton } from '../components/ui/Kosong';
import { PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { ProgressRing } from '../components/ui/ProgressRing';
import { Segmented } from '../components/ui/Segmented';
import { cn } from '../lib/cn';
import { useNotifikasi, usePengajuanDaftar } from '../lib/queries';

type Tab = 'periksa' | 'mdk' | 'dikembalikan' | 'selesai';
const DAFTAR_TAB: Tab[] = ['periksa', 'mdk', 'dikembalikan', 'selesai'];

const FILTER_TAB: Record<Tab, { status: string; sort: string }> = {
  periksa: { status: 'diajukan_pum', sort: 'antrian' },
  mdk: { status: 'diajukan_mdk', sort: 'antrian_mdk' },
  dikembalikan: { status: 'dikembalikan', sort: 'diperbarui' },
  selesai: { status: 'selesai', sort: 'diperbarui' },
};

const KOSONG: Record<Tab, { judul: string; deskripsi: string }> = {
  periksa: {
    judul: 'Tidak ada yang perlu diperiksa',
    deskripsi: 'Semua pengajuan sudah diperiksa. Pengajuan baru dari operator akan muncul di sini (notifikasi otomatis).',
  },
  mdk: {
    judul: 'Tidak ada yang menunggu invoice',
    deskripsi: 'Pengajuan yang sudah diteruskan ke MDK akan muncul di sini sampai No. Invoice MDK diinput.',
  },
  dikembalikan: { judul: 'Tidak ada yang dikembalikan', deskripsi: 'Pengajuan yang dikembalikan ke pengaju akan muncul di sini.' },
  selesai: { judul: 'Belum ada yang selesai', deskripsi: 'Pengajuan yang sudah diinput invoice MDK (paid) akan muncul di sini.' },
};

type JenisAksi = 'teruskan' | 'kembalikan' | 'selesai';

function Lencana({ children, nada }: { children: ReactNode; nada: 'biru' | 'kuning' | 'merah' | 'hijau' | 'ungu' }) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 font-semibold ring-1',
        nada === 'biru' && 'bg-blue-500/10 text-blue-800 ring-blue-500/20 dark:text-blue-200',
        nada === 'kuning' && 'bg-amber-400/15 text-amber-800 ring-amber-500/25 dark:text-amber-200',
        nada === 'merah' && 'bg-red-500/10 text-red-700 ring-red-500/20 dark:text-red-300',
        nada === 'hijau' && 'bg-emerald-500/12 text-emerald-800 ring-emerald-500/20 dark:text-emerald-200',
        nada === 'ungu' && 'bg-violet-500/10 text-violet-800 ring-violet-500/20 dark:text-violet-200',
      )}
    >
      {children}
    </span>
  );
}

export default function VerifikasiPage() {
  const [params, setParams] = useSearchParams();
  const tab = (DAFTAR_TAB.includes(params.get('tab') as Tab) ? params.get('tab') : 'periksa') as Tab;
  const page = Number(params.get('page')) || 1;
  const { data, isLoading, isFetching } = usePengajuanDaftar({ ...FILTER_TAB[tab], page, limit: 12 });
  const { data: notif } = useNotifikasi();
  // target tetap tersimpan setelah modal ditutup agar animasi keluar modal berjalan mulus.
  const [target, setTarget] = useState<PengajuanRingkas | null>(null);
  const [jenisAksi, setJenisAksi] = useState<JenisAksi | null>(null);
  const setAksi = (p: PengajuanRingkas, jenis: JenisAksi) => {
    setTarget(p);
    setJenisAksi(jenis);
  };

  const ganti = (t: Tab) => setParams(t === 'periksa' ? {} : { tab: t }, { replace: true });
  const daftar = data?.data ?? [];
  const acuanTunggu = (p: PengajuanRingkas) => (tab === 'mdk' ? p.diteruskan_at : p.diajukan_at);
  const awal = daftar[0] ? acuanTunggu(daftar[0]) : null;
  const tertua = (tab === 'periksa' || tab === 'mdk') && page === 1 && awal ? selisihHari(awal) : null;

  const statistik = [
    {
      label: 'Perlu diperiksa',
      nilai: notif?.antrian.diajukan_pum ?? 0,
      ikon: <Inbox className="size-[18px]" />,
      nada: 'bg-blue-500/12 text-blue-700 ring-blue-500/20 dark:text-blue-300',
    },
    {
      label: 'Menunggu invoice MDK',
      nilai: notif?.antrian.diajukan_mdk ?? 0,
      ikon: <Hourglass className="size-[18px]" />,
      nada: 'bg-violet-500/12 text-violet-700 ring-violet-500/20 dark:text-violet-300',
    },
    {
      label: 'Nilai pada tab ini',
      nilai: data?.nilai ?? 0,
      // Ringkas agar muat di kartu sempit; nilai lengkap di baris bawah.
      format: (n: number) => `Rp ${formatRupiahRingkas(n, 1)}`,
      sub: formatRupiah(data?.nilai ?? 0),
      ikon: <Wallet className="size-[18px]" />,
      nada: 'bg-navy-900/[0.07] text-navy-800 ring-navy-900/15 dark:bg-white/10 dark:text-kuning-300 dark:ring-white/15',
    },
    {
      label: tab === 'mdk' ? 'Invoice ditunggu terlama' : 'Menunggu terlama',
      nilai: tertua ?? 0,
      akhiran: tertua === null ? undefined : 'hari',
      format: tertua === null ? () => '–' : undefined,
      ikon: <Hourglass className="size-[18px]" />,
      nada: 'bg-amber-400/20 text-amber-700 ring-amber-500/25 dark:text-amber-300',
    },
  ];

  return (
    <div>
      <PageHeader
        judul="Verifikasi PUM"
        deskripsi="Periksa & centang berkas pengajuan, teruskan ke MDK, lalu input No. Invoice setelah invoice dari MDK diterima."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {statistik.map((s, i) => (
          <GlassCard
            key={s.label}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <span className={cn('grid size-10 shrink-0 place-items-center rounded-2xl ring-1 sm:size-11', s.nada)}>{s.ikon}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-fg-muted sm:truncate">{s.label}</p>
              <p className="truncate text-xl font-extrabold tracking-[-0.03em] text-fg sm:text-2xl">
                <AnimatedNumber value={s.nilai} format={s.format} />
                {s.akhiran && <span className="ml-1 text-sm font-bold text-fg-muted">{s.akhiran}</span>}
              </p>
              {s.sub && <p className="angka truncate text-[11px] text-fg-muted">{s.sub}</p>}
            </div>
          </GlassCard>
        ))}
      </div>

      <Segmented
        label="Tab verifikasi"
        layoutId="seg-verifikasi"
        value={tab}
        onChange={ganti}
        // Ponsel: 2×2 agar keempat tab terlihat tanpa geser; layar lebar: satu baris.
        className="mb-5 grid w-full grid-cols-2 sm:inline-flex sm:w-auto"
        opsi={[
          { value: 'periksa', label: 'Perlu diperiksa', ikon: <ClipboardCheck />, jumlah: notif?.antrian.diajukan_pum },
          { value: 'mdk', label: 'Menunggu invoice', ikon: <Hourglass />, jumlah: notif?.antrian.diajukan_mdk },
          { value: 'dikembalikan', label: 'Dikembalikan', ikon: <Undo2 /> },
          { value: 'selesai', label: 'Selesai (Paid)', ikon: <BadgeCheck /> },
        ]}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-3xl" />
          ))}
        </div>
      ) : daftar.length === 0 ? (
        <GlassCard>
          <Kosong ikon={tab === 'periksa' ? <ClipboardCheck /> : <Inbox />} judul={KOSONG[tab].judul} deskripsi={KOSONG[tab].deskripsi} />
        </GlassCard>
      ) : (
        <div className={cn('grid grid-cols-1 gap-4 transition-opacity md:grid-cols-2 2xl:grid-cols-3', isFetching && 'opacity-60')}>
          <AnimatePresence mode="popLayout">
            {daftar.map((p, i) => {
              const acuan = acuanTunggu(p);
              const tunggu = acuan ? selisihHari(acuan) : 0;
              const lengkap = p.berkas_terpenuhi >= p.berkas_wajib;
              const semuaSesuai = p.berkas_wajib > 0 && p.berkas_sesuai >= p.berkas_wajib;
              return (
                <GlassCard
                  key={p.id}
                  layout
                  interaktif
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: Math.min(i, 9) * 0.04 }}
                  className="flex flex-col p-5"
                  data-kode={p.kode}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip>{p.kode}</Chip>
                      <KategoriBadge kategori={p.kategori} pendek className="py-0.5" />
                    </div>
                    {tab === 'periksa' ? (
                      <ProgressRing nilai={p.berkas_sesuai} total={p.berkas_wajib} ukuran={40} judul="Dicentang sesuai PUM" />
                    ) : (
                      <ProgressRing nilai={p.berkas_terpenuhi} total={p.berkas_wajib} ukuran={40} />
                    )}
                  </div>
                  <Link to={`/pengajuan/${p.id}`} className="mt-3 line-clamp-2 text-[15px] leading-snug font-bold text-fg hover:underline">
                    {p.nama_kegiatan}
                  </Link>
                  <p className="mt-1 truncate text-xs text-fg-muted">
                    {formatRentangTanggal(p.tanggal_kegiatan, p.tanggal_selesai)} · {p.penerima}
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold tracking-wider text-fg-subtle uppercase">Nilai</p>
                      <p className="angka text-xl font-extrabold tracking-[-0.02em] text-fg">{formatRupiah(p.total)}</p>
                    </div>
                    <MekanismeBadge mekanisme={p.mekanisme} />
                  </div>

                  {tab === 'periksa' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <Lencana nada={tunggu >= 7 ? 'kuning' : 'biru'}>
                        {tunggu === 0 ? 'Diajukan hari ini' : `Menunggu ${tunggu} hari`}
                      </Lencana>
                      {!lengkap && (
                        <Lencana nada="merah">
                          Berkas {p.berkas_terpenuhi}/{p.berkas_wajib}
                        </Lencana>
                      )}
                      <Lencana nada={semuaSesuai ? 'hijau' : 'ungu'}>
                        Dicek {p.berkas_sesuai}/{p.berkas_wajib} sesuai
                      </Lencana>
                    </div>
                  )}
                  {tab === 'mdk' && (
                    <div className="mt-3 space-y-2 text-xs">
                      <Lencana nada={tunggu >= 14 ? 'kuning' : 'ungu'}>
                        {tunggu === 0 ? 'Diteruskan hari ini' : `Menunggu invoice ${tunggu} hari`}
                      </Lencana>
                      <p className="flex items-center gap-1.5 truncate text-fg-muted">
                        <FolderKanban className="size-3.5 shrink-0" />
                        {p.project_hosting || p.task_name ? (
                          <span className="truncate">
                            <b className="text-fg">{p.project_hosting ?? '-'}</b> · {p.task_name ?? '-'}
                          </span>
                        ) : (
                          'Project costing / task name belum diisi'
                        )}
                      </p>
                    </div>
                  )}
                  {tab === 'dikembalikan' && (
                    <p className="mt-3 text-xs text-fg-muted">Menunggu perbaikan pengaju · {formatWaktu(p.updated_at)}</p>
                  )}
                  {tab === 'selesai' && (
                    <p className="mt-3 flex items-center gap-1.5 truncate text-xs text-fg-muted">
                      <ReceiptText className="size-3.5 shrink-0" />
                      <span className="truncate font-mono font-semibold text-fg">{p.no_invoice_mdk}</span>·{' '}
                      {formatTanggal(p.tanggal_invoice_mdk, 'pendek')}
                    </p>
                  )}

                  <div className="mt-auto flex gap-2 pt-4">
                    {tab === 'periksa' ? (
                      <>
                        <Link
                          to={`/pengajuan/${p.id}`}
                          className={kelasTombol(semuaSesuai ? 'kedua' : 'utama', 'sm', 'flex-1')}
                        >
                          <ClipboardCheck className="size-4" /> Periksa berkas
                        </Link>
                        <Button varian="kedua" ukuran="sm" onClick={() => setAksi(p, 'kembalikan')} aria-label={`Kembalikan ${p.kode}`} title="Kembalikan ke pengaju">
                          <Undo2 className="size-4" />
                        </Button>
                        {semuaSesuai && (
                          <Button ukuran="sm" className="flex-1" ikon={<Send className="size-4" />} onClick={() => setAksi(p, 'teruskan')}>
                            Teruskan
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Link to={`/pengajuan/${p.id}`} className={kelasTombol('kedua', 'sm', 'flex-1')}>
                          <Eye className="size-4" /> Detail
                        </Link>
                        {tab === 'mdk' && (
                          <Button
                            varian="sukses"
                            ukuran="sm"
                            className="flex-1"
                            ikon={<ReceiptText className="size-4" />}
                            onClick={() => setAksi(p, 'selesai')}
                          >
                            Input invoice
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {data && data.total > data.limit && (
        <motion.div layout className="mt-5">
          <Pagination
            page={data.page}
            limit={data.limit}
            total={data.total}
            onChange={(pg) => {
              const p = new URLSearchParams(params);
              p.set('page', String(pg));
              setParams(p, { replace: true });
            }}
          />
        </motion.div>
      )}

      {target && (
        <>
          <TeruskanModal p={target} open={jenisAksi === 'teruskan'} onOpenChange={(o) => !o && setJenisAksi(null)} />
          <InvoiceModal p={target} mode="selesai" open={jenisAksi === 'selesai'} onOpenChange={(o) => !o && setJenisAksi(null)} />
          <CatatanModal p={target} mode="kembalikan" open={jenisAksi === 'kembalikan'} onOpenChange={(o) => !o && setJenisAksi(null)} />
        </>
      )}
    </div>
  );
}
