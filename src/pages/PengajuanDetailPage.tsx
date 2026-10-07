import {
  Ban,
  CalendarDays,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  ClipboardList,
  Ellipsis,
  FileDown,
  FileQuestion,
  FolderKanban,
  History,
  Hourglass,
  Info,
  MapPin,
  PencilLine,
  ReceiptText,
  RotateCcw,
  Send,
  Trash,
  Undo2,
  Users,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { JENIS_KONSUMSI_LABEL, JENIS_TRANSPORT_LABEL, JENIS_UANG_LABEL, KATEGORI_INFO } from '../../shared/constants';
import { formatAngka, formatRentangTanggal, formatRupiah, formatTanggal, formatWaktu, lamaHari, selisihHari } from '../../shared/format';
import type { PengajuanDetail } from '../../shared/types';
import { CatatanModal, DataPumModal, InvoiceModal, TeruskanModal } from '../components/pengajuan/AksiModal';
import { BerkasPanel } from '../components/pengajuan/BerkasPanel';
import { RiwayatTimeline } from '../components/pengajuan/RiwayatTimeline';
import { StatusStepper } from '../components/pengajuan/StatusStepper';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { Avatar } from '../components/ui/Avatar';
import { Chip, KategoriBadge, MekanismeBadge, StatusBadge } from '../components/ui/Badge';
import { Button, TautanTombol } from '../components/ui/Button';
import { GlassCard, JudulKartu } from '../components/ui/GlassCard';
import { Kosong } from '../components/ui/Kosong';
import { Menu, MenuItem } from '../components/ui/Menu';
import { MuatHalaman } from '../components/ui/MuatHalaman';
import { PageHeader } from '../components/ui/PageHeader';
import { ProgressRing } from '../components/ui/ProgressRing';
import { useAuth, useUser } from '../context/AuthContext';
import { useKonfirmasi } from '../context/KonfirmasiContext';
import { ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { useAksiPengajuan, useBacaNotifikasi, useHapusPengajuan, useNotifikasi, usePengajuan } from '../lib/queries';

type ModalAksi = 'teruskan' | 'data-pum' | 'selesai' | 'ubah' | 'kembalikan' | 'batal-selesai';

function Info2({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-bold tracking-wider text-fg-subtle uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-fg">{children}</dd>
    </div>
  );
}

/** Notifikasi milik user tentang pengajuan ini otomatis ditandai dibaca saat detailnya dibuka. */
function useTandaiNotifikasiDibaca(pengajuanId: number) {
  const { data } = useNotifikasi();
  const { mutate } = useBacaNotifikasi();
  const diminta = useRef(new Set<number>());
  useEffect(() => {
    for (const n of data?.items ?? []) {
      if (n.pengajuan_id === pengajuanId && !n.dibaca && !diminta.current.has(n.id)) {
        diminta.current.add(n.id);
        mutate(n.id);
      }
    }
  }, [data, pengajuanId, mutate]);
}

export default function PengajuanDetailPage() {
  const id = Number(useParams().id);
  const { data: p, isLoading, isError, error } = usePengajuan(id);

  if (isLoading) return <MuatHalaman />;
  if (isError || !p) {
    return (
      <GlassCard className="mx-auto mt-10 max-w-xl">
        <Kosong
          ikon={<FileQuestion />}
          judul="Pengajuan tidak ditemukan"
          deskripsi={
            error instanceof ApiError && error.status === 404
              ? 'Pengajuan mungkin sudah dihapus, atau Anda tidak memiliki akses untuk melihatnya.'
              : error instanceof Error
                ? error.message
                : 'Terjadi kesalahan'
          }
          aksi={<TautanTombol to="/pengajuan">Kembali ke daftar</TautanTombol>}
        />
      </GlassCard>
    );
  }
  return <Detail p={p} />;
}

function Detail({ p }: { p: PengajuanDetail }) {
  const user = useUser();
  const { punyaPeran } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const baru = (location.state as { baru?: boolean } | null)?.baru === true;
  const konfirmasi = useKonfirmasi();
  const aksi = useAksiPengajuan(p.id);
  const hapus = useHapusPengajuan();
  const [modal, setModal] = useState<ModalAksi | null>(null);
  const [unduhPdf, setUnduhPdf] = useState(false);
  useTandaiNotifikasiDibaca(p.id);

  const kelola = punyaPeran('operator', 'admin');
  const pum = punyaPeran('pum', 'admin');
  const bisaEdit = kelola && (p.status === 'draft' || p.status === 'dikembalikan');
  const bisaCek = pum && p.status === 'diajukan_pum';
  const lewatPum = p.status === 'diajukan_mdk' || p.status === 'selesai';
  const bisaDataPum = pum && (p.status === 'diajukan_pum' || lewatPum);
  const transport = p.kategori !== 'konsumsi';
  const k = p.kelengkapan;
  const revisi = k.items.filter((i) => i.cek?.status === 'revisi');

  const jalankan = async (fn: () => Promise<unknown>, sukses: string, deskripsi?: string) => {
    try {
      await fn();
      toast.success(sukses, { description: deskripsi });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Aksi gagal');
    }
  };

  const ajukan = async () => {
    const ok = await konfirmasi({
      judul: p.status === 'dikembalikan' ? 'Ajukan ulang ke PUM?' : 'Ajukan ke PUM?',
      pesan: k.lengkap ? (
        <>Data dan berkas akan terkunci selama diperiksa PUM. Pastikan semua isian sudah benar.</>
      ) : (
        <>
          <span className="mb-2 flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
            <Info className="size-4" /> Berkas wajib baru {k.terpenuhi} dari {k.total}.
          </span>
          Berkas yang belum lengkap: {k.items.filter((i) => !i.terpenuhi).map((i) => i.label).join(', ')}. Tetap ajukan
          sekarang? PUM dapat mengembalikan pengajuan bila berkas kurang.
        </>
      ),
      teksYa: k.lengkap ? 'Ajukan sekarang' : 'Tetap ajukan',
    });
    if (ok) {
      await jalankan(() => aksi.mutateAsync({ aksi: 'ajukan' }), `${p.kode} diajukan ke PUM`, 'PUM menerima notifikasi otomatis.');
    }
  };

  const tarik = async () => {
    const ok = await konfirmasi({
      judul: 'Tarik kembali pengajuan?',
      pesan: 'Pengajuan ditarik dari PUM dan kembali menjadi Draft sehingga dapat diubah. Ajukan lagi setelah selesai.',
      teksYa: 'Tarik kembali',
    });
    if (ok) await jalankan(() => aksi.mutateAsync({ aksi: 'tarik' }), 'Pengajuan ditarik kembali ke draft');
  };

  const hapusPengajuan = async () => {
    const ok = await konfirmasi({
      judul: `Hapus ${p.kode}?`,
      pesan: 'Pengajuan beserta seluruh berkasnya akan dihapus permanen. Riwayat penghapusan tetap tercatat.',
      teksYa: 'Hapus pengajuan',
      varian: 'bahaya',
    });
    if (!ok) return;
    try {
      await hapus.mutateAsync(p.id);
      toast.success(`${p.kode} dihapus`);
      navigate('/pengajuan', { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal menghapus');
    }
  };

  const pdf = async () => {
    setUnduhPdf(true);
    try {
      const { pdfBuktiPengajuan } = await import('../lib/pdf/laporan');
      await pdfBuktiPengajuan(p, user.nama);
      toast.success('PDF berhasil dibuat');
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuat PDF');
    } finally {
      setUnduhPdf(false);
    }
  };

  const menunggu =
    p.status === 'diajukan_pum' && p.diajukan_at
      ? { hari: selisihHari(p.diajukan_at), teks: 'Menunggu pemeriksaan PUM' }
      : p.status === 'diajukan_mdk' && p.diteruskan_at
        ? { hari: selisihHari(p.diteruskan_at), teks: 'Menunggu invoice MDK' }
        : null;

  return (
    <div>
      <PageHeader
        kembali={pum && !kelola ? { ke: '/verifikasi', label: 'Verifikasi PUM' } : { ke: '/pengajuan', label: 'Daftar pengajuan' }}
        atas={
          <>
            <Chip>{p.kode}</Chip>
            <KategoriBadge kategori={p.kategori} />
            <StatusBadge status={p.status} />
          </>
        }
        judul={p.nama_kegiatan}
        aksi={
          <>
            <Button varian="kedua" ikon={<FileDown className="size-4" />} memuat={unduhPdf} onClick={pdf}>
              PDF
            </Button>
            {bisaEdit && (
              <>
                <Button varian="hantu" ikon={<Trash className="size-4" />} onClick={hapusPengajuan} className="text-red-600 hover:text-red-700 dark:text-red-400">
                  Hapus
                </Button>
                <TautanTombol to={`/pengajuan/${p.id}/ubah`} varian="kedua" ikon={<PencilLine className="size-4" />}>
                  Ubah
                </TautanTombol>
                <Button ikon={<Send className="size-4" />} onClick={ajukan} memuat={aksi.isPending}>
                  {p.status === 'dikembalikan' ? 'Ajukan ulang ke PUM' : 'Ajukan ke PUM'}
                </Button>
              </>
            )}
            {kelola && p.status === 'diajukan_pum' && (
              <Button varian="kedua" ikon={<RotateCcw className="size-4" />} onClick={tarik} memuat={aksi.isPending}>
                Tarik kembali
              </Button>
            )}
            {bisaCek && (
              <>
                <Button varian="kedua" ikon={<Undo2 className="size-4" />} onClick={() => setModal('kembalikan')}>
                  Kembalikan
                </Button>
                <Button ikon={<Send className="size-4" />} onClick={() => setModal('teruskan')} disabled={!k.semuaSesuai}>
                  Teruskan ke MDK
                </Button>
              </>
            )}
            {pum && p.status === 'diajukan_mdk' && (
              <>
                <Menu
                  pemicu={
                    <Button varian="kedua" ikon={<Ellipsis className="size-4" />}>
                      Aksi PUM
                    </Button>
                  }
                >
                  <MenuItem ikon={<FolderKanban />} onSelect={() => setModal('data-pum')}>
                    Ubah project hosting / task name
                  </MenuItem>
                  <MenuItem ikon={<Undo2 />} onSelect={() => setModal('kembalikan')}>
                    Kembalikan ke pengaju
                  </MenuItem>
                </Menu>
                <Button varian="sukses" ikon={<ReceiptText className="size-4" />} onClick={() => setModal('selesai')}>
                  Input No. Invoice MDK
                </Button>
              </>
            )}
            {pum && p.status === 'selesai' && (
              <Menu
                pemicu={
                  <Button varian="kedua" ikon={<Ellipsis className="size-4" />}>
                    Aksi PUM
                  </Button>
                }
              >
                <MenuItem ikon={<ReceiptText />} onSelect={() => setModal('ubah')}>
                  Ubah data invoice
                </MenuItem>
                <MenuItem ikon={<FolderKanban />} onSelect={() => setModal('data-pum')}>
                  Ubah project hosting / task name
                </MenuItem>
                <MenuItem ikon={<Ban />} bahaya onSelect={() => setModal('batal-selesai')}>
                  Batalkan status selesai
                </MenuItem>
              </Menu>
            )}
          </>
        }
      />

      {baru && p.status === 'draft' && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-start gap-3 rounded-2xl bg-kuning-400/20 px-4 py-3.5 ring-1 ring-kuning-500/40"
        >
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div className="text-sm">
            <p className="font-bold text-fg">Draft tersimpan! Langkah berikutnya:</p>
            <p className="text-fg-muted">
              Unggah berkas wajib pada panel <b>Kelengkapan berkas</b> di bawah, lalu klik <b>Ajukan ke PUM</b>.
            </p>
          </div>
        </motion.div>
      )}

      <GlassCard className="mb-5 px-4 py-5 sm:px-8" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <StatusStepper p={p} />
      </GlassCard>

      {p.status === 'dikembalikan' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-5 flex gap-3 rounded-2xl bg-amber-400/15 px-4 py-4 ring-1 ring-amber-500/30"
          data-testid="catatan-pengembalian"
        >
          <Undo2 className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-300" />
          <div className="min-w-0 text-sm">
            <p className="font-bold text-fg">
              Dikembalikan oleh {p.diproses_by_nama ?? 'PUM'} · {formatWaktu(p.diproses_at)}
            </p>
            {p.catatan_pum && <p className="mt-1 whitespace-pre-line text-fg">{p.catatan_pum}</p>}
            {revisi.length > 0 && (
              <ul className="mt-2 space-y-1 text-[13px]">
                {revisi.map((i) => (
                  <li key={i.jenis} className="flex items-start gap-1.5">
                    <CircleX className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
                    <span>
                      <b>{i.label}</b>: {i.cek?.catatan}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {kelola && (
              <p className="mt-2 text-xs text-fg-muted">
                Perbaiki data/berkas sesuai catatan, lalu klik “Ajukan ulang ke PUM”. Berkas yang sudah dicentang sesuai tidak perlu diubah.
              </p>
            )}
          </div>
        </motion.div>
      )}

      {p.status === 'diajukan_pum' && p.catatan_pum && (
        <div className="mb-5 flex gap-3 rounded-2xl bg-fg/[0.04] px-4 py-3 text-sm ring-1 ring-fg/[0.08]">
          <History className="mt-0.5 size-4.5 shrink-0 text-fg-muted" />
          <p className="min-w-0 text-fg-muted">
            <span className="font-semibold text-fg">Diajukan ulang.</span> Catatan pengembalian sebelumnya:{' '}
            <span className="whitespace-pre-line text-fg">{p.catatan_pum}</span>
          </p>
        </div>
      )}

      {p.status === 'diajukan_mdk' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-5 flex flex-col gap-3 rounded-2xl bg-violet-500/10 px-4 py-4 ring-1 ring-violet-500/25 sm:flex-row sm:items-center"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/30">
            <Hourglass className="size-5" />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-bold text-fg">Disetujui PUM & diteruskan ke MDK — menunggu invoice</p>
            <p className="text-xs text-fg-muted">
              Oleh {p.diteruskan_by_nama ?? 'PUM'} · {formatWaktu(p.diteruskan_at)}. MDK memproses di luar sistem; PUM akan
              menginput No. Invoice setelah invoice diterima.
            </p>
            {p.catatan_pum && <p className="mt-1 text-xs text-fg">Catatan PUM: {p.catatan_pum}</p>}
          </div>
        </motion.div>
      )}

      {p.status === 'selesai' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-5 flex flex-col gap-3 rounded-2xl bg-emerald-500/10 px-4 py-4 ring-1 ring-emerald-500/25 sm:flex-row sm:items-center"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <ReceiptText className="size-5" />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-xs font-bold tracking-wider text-emerald-800 uppercase dark:text-emerald-300">
              Selesai (paid) · No. Invoice MDK
            </p>
            <p className="font-mono text-lg font-bold break-all text-fg">{p.no_invoice_mdk}</p>
            <p className="text-xs text-fg-muted">
              Tanggal invoice {formatTanggal(p.tanggal_invoice_mdk)} · diinput {p.diproses_by_nama ?? 'PUM'} ·{' '}
              {formatWaktu(p.diproses_at)}
            </p>
            {p.catatan_pum && <p className="mt-1 text-xs text-fg">Catatan: {p.catatan_pum}</p>}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <GlassCard className="p-5 sm:p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <JudulKartu ikon={<ClipboardList className="size-4.5" />} judul="Informasi kegiatan" deskripsi={KATEGORI_INFO[p.kategori].deskripsi} />
            <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Info2 label={p.kategori === 'perjadin' ? 'Lama kegiatan' : 'Tanggal kegiatan'}>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-fg-muted" />
                  {p.kategori === 'perjadin'
                    ? `${formatRentangTanggal(p.tanggal_kegiatan, p.tanggal_selesai)} (${lamaHari(p.tanggal_kegiatan, p.tanggal_selesai)} hari)`
                    : formatTanggal(p.tanggal_kegiatan)}
                </span>
              </Info2>
              {transport && (
                <Info2 label="Lokasi tujuan">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4 text-fg-muted" /> {p.lokasi_tujuan}
                  </span>
                </Info2>
              )}
              <Info2 label="Jumlah orang">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4 text-fg-muted" /> {formatAngka(p.jumlah_orang)} orang
                </span>
              </Info2>
              <Info2 label="Mekanisme">
                <MekanismeBadge mekanisme={p.mekanisme} />
              </Info2>
              {p.kategori === 'perjadin' && (
                <>
                  <Info2 label="Jenis uang">{p.jenis_uang ? JENIS_UANG_LABEL[p.jenis_uang] : '-'}</Info2>
                  <Info2 label="Jenis transport">{p.jenis_transport ? JENIS_TRANSPORT_LABEL[p.jenis_transport] : '-'}</Info2>
                </>
              )}
              {p.kategori === 'konsumsi' && (
                <Info2 label="Jenis konsumsi">{p.jenis_konsumsi ? JENIS_KONSUMSI_LABEL[p.jenis_konsumsi] : '-'}</Info2>
              )}
              {p.kategori === 'konsumsi' && (
                <Info2 label="Uang siapa">
                  <span className="inline-flex items-center gap-2">
                    <Avatar nama={p.uang_siapa_nama ?? '?'} className="size-6 text-[9px] ring-0" />
                    {p.uang_siapa_nama ?? '-'}
                  </span>
                </Info2>
              )}
              <Info2 label="Dibuat oleh">
                {p.created_by_nama}
                <span className="block text-xs font-normal text-fg-muted">{formatWaktu(p.created_at)}</span>
              </Info2>
              <Info2 label="Terakhir diperbarui">
                {p.updated_by_nama ?? '-'}
                <span className="block text-xs font-normal text-fg-muted">{formatWaktu(p.updated_at)}</span>
              </Info2>
              {p.catatan && (
                <Info2 label="Catatan" className="sm:col-span-2 lg:col-span-3">
                  <span className="font-normal whitespace-pre-line">{p.catatan}</span>
                </Info2>
              )}
            </dl>
          </GlassCard>

          {transport ? (
            <GlassCard className="p-5 sm:p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <JudulKartu
                ikon={<Users className="size-4.5" />}
                judul="Penerima & nilai uang"
                deskripsi="Nilai per orang — dijumlahkan menjadi total pengajuan"
              />
              <ul className="mt-4 divide-y divide-line">
                {p.peserta.map((ps, i) => (
                  <motion.li
                    key={ps.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className="flex items-center gap-3 py-3"
                  >
                    <Avatar nama={ps.nama} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-fg">{ps.nama}</p>
                      <p className="truncate text-xs text-fg-muted">
                        {[ps.jabatan, ps.nip ? `NIP ${ps.nip}` : null].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="angka font-extrabold text-fg">{formatRupiah(ps.nilai)}</p>
                      {p.kategori === 'perjadin' && p.jenis_uang === 'uang_harian' && (
                        <p className="text-[11px] text-fg-muted">
                          ≈ {formatRupiah(Math.round(ps.nilai / Math.max(1, lamaHari(p.tanggal_kegiatan, p.tanggal_selesai))))}/hari
                        </p>
                      )}
                    </div>
                  </motion.li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between rounded-2xl bg-navy-900 px-4 py-3 text-white dark:bg-white/[0.07]">
                <span className="text-sm font-semibold">Total ({p.peserta.length} orang)</span>
                <span className="angka text-lg font-extrabold text-kuning-300">{formatRupiah(p.total)}</span>
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="p-5 sm:p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <JudulKartu ikon={<Wallet className="size-4.5" />} judul="Rincian konsumsi" />
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-fg/[0.04] p-4 ring-1 ring-fg/[0.06]">
                  <p className="text-[11px] font-bold tracking-wider text-fg-subtle uppercase">Jumlah uang</p>
                  <p className="angka mt-1 text-lg font-extrabold text-fg">{formatRupiah(p.total)}</p>
                </div>
                <div className="rounded-2xl bg-fg/[0.04] p-4 ring-1 ring-fg/[0.06]">
                  <p className="text-[11px] font-bold tracking-wider text-fg-subtle uppercase">Peserta</p>
                  <p className="mt-1 text-lg font-extrabold text-fg">{formatAngka(p.jumlah_orang)} orang</p>
                </div>
                <div className="rounded-2xl bg-fg/[0.04] p-4 ring-1 ring-fg/[0.06]">
                  <p className="text-[11px] font-bold tracking-wider text-fg-subtle uppercase">Rata-rata/orang</p>
                  <p className="angka mt-1 text-lg font-extrabold text-fg">
                    {formatRupiah(Math.round(p.total / Math.max(1, p.jumlah_orang)))}
                  </p>
                </div>
              </div>
            </GlassCard>
          )}

          <BerkasPanel
            p={p}
            bisaKelola={bisaEdit}
            bisaCek={bisaCek}
            sorot={baru && p.status === 'draft'}
            footer={
              bisaCek && (
                <div
                  className={cn(
                    'mt-5 flex flex-col gap-3 rounded-2xl p-4 ring-1',
                    k.semuaSesuai ? 'bg-emerald-500/10 ring-emerald-500/25' : 'bg-fg/[0.03] ring-fg/[0.08]',
                  )}
                  data-testid="aksi-pum"
                >
                  <p className="flex flex-1 items-start gap-2 text-sm text-fg">
                    {k.semuaSesuai ? (
                      <>
                        <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                        <span>
                          <b>Semua berkas wajib sesuai.</b> Setujui & teruskan ke MDK untuk diproses invoice-nya.
                        </span>
                      </>
                    ) : (
                      <>
                        <Info className="mt-0.5 size-4 shrink-0 text-fg-muted" />
                        <span className="text-fg-muted">
                          Centang <b className="text-fg">{k.total - k.sesuai} berkas lagi</b> sebagai “Sesuai” untuk dapat meneruskan
                          ke MDK{k.revisi > 0 ? ', atau kembalikan ke pengaju karena ada berkas yang perlu direvisi' : ''}.
                        </span>
                      </>
                    )}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button varian="kedua" ikon={<Undo2 className="size-4" />} onClick={() => setModal('kembalikan')}>
                      Kembalikan ke pengaju
                    </Button>
                    <Button ikon={<Send className="size-4" />} disabled={!k.semuaSesuai} onClick={() => setModal('teruskan')}>
                      Setujui & teruskan ke MDK
                    </Button>
                  </div>
                </div>
              )
            }
          />
        </div>

        <div className="space-y-5">
          <GlassCard
            interaktif
            className="overflow-hidden p-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-kuning-400/25 blur-3xl" aria-hidden />
            <p className="text-[11px] font-bold tracking-wider text-fg-subtle uppercase">Total pengajuan</p>
            <p className="mt-1 text-[34px] leading-tight font-extrabold tracking-[-0.03em] text-fg">
              Rp <AnimatedNumber value={p.total} format={formatAngka} />
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <MekanismeBadge mekanisme={p.mekanisme} />
              <span className="text-xs text-fg-muted">{p.penerima}</span>
            </div>
            <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
              <ProgressRing nilai={k.terpenuhi} total={k.total} ukuran={48} tebal={5} />
              <div className="text-sm">
                <p className="font-bold text-fg">{k.lengkap ? 'Berkas lengkap' : 'Berkas belum lengkap'}</p>
                <p className="text-xs text-fg-muted">
                  {k.terpenuhi} dari {k.total} berkas wajib terpenuhi
                </p>
              </div>
            </div>
            {menunggu && (
              <p
                className={
                  menunggu.hari >= 7
                    ? 'mt-4 rounded-xl bg-amber-400/15 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-500/25 dark:text-amber-200'
                    : 'mt-4 rounded-xl bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-800 ring-1 ring-blue-500/20 dark:text-blue-200'
                }
              >
                {menunggu.teks} {menunggu.hari === 0 ? 'sejak hari ini' : `${menunggu.hari} hari`}
              </p>
            )}
          </GlassCard>

          {p.status !== 'draft' && <KartuPum p={p} bisaDataPum={bisaDataPum} onUbahData={() => setModal('data-pum')} />}

          <GlassCard className="p-5 sm:p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <JudulKartu ikon={<History className="size-4.5" />} judul="Riwayat aktivitas" deskripsi={`${p.riwayat.length} catatan`} />
            <div className="mt-4 max-h-[620px] overflow-y-auto pr-1 pb-4 [mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]">
              <RiwayatTimeline items={p.riwayat} />
            </div>
          </GlassCard>
        </div>
      </div>

      <TeruskanModal p={p} open={modal === 'teruskan'} onOpenChange={(o) => !o && setModal(null)} />
      <DataPumModal p={p} open={modal === 'data-pum'} onOpenChange={(o) => !o && setModal(null)} />
      <InvoiceModal p={p} open={modal === 'selesai' || modal === 'ubah'} mode={modal === 'ubah' ? 'ubah' : 'selesai'} onOpenChange={(o) => !o && setModal(null)} />
      <CatatanModal
        p={p}
        open={modal === 'kembalikan' || modal === 'batal-selesai'}
        mode={modal === 'batal-selesai' ? 'batal-selesai' : 'kembalikan'}
        onOpenChange={(o) => !o && setModal(null)}
      />
    </div>
  );
}

/** Ringkasan verifikasi PUM: progres centang berkas, project hosting & task name (aksi utama ada di header/panel berkas). */
function KartuPum({ p, bisaDataPum, onUbahData }: { p: PengajuanDetail; bisaDataPum: boolean; onUbahData: () => void }) {
  const k = p.kelengkapan;
  return (
    <GlassCard
      className="p-5 sm:p-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      data-testid="kartu-pum"
    >
      <JudulKartu
        ikon={<ClipboardCheck className="size-4.5" />}
        judul="Verifikasi PUM"
        deskripsi="Pemeriksaan berkas & data untuk MDK"
      />
      <div className="mt-4 flex items-center gap-3">
        <ProgressRing nilai={k.sesuai} total={k.total} ukuran={48} tebal={5} judul="Dicentang sesuai PUM" />
        <div className="text-sm">
          <p className="font-bold text-fg">
            {k.semuaSesuai ? 'Semua berkas sesuai' : `${k.sesuai} dari ${k.total} berkas sesuai`}
          </p>
          <p className="text-xs text-fg-muted">
            {k.revisi > 0
              ? `${k.revisi} berkas ditandai perlu revisi`
              : p.status === 'diajukan_pum'
                ? 'Sedang diperiksa PUM'
                : p.status === 'dikembalikan'
                  ? 'Menunggu perbaikan pengaju'
                  : 'Dicentang oleh PUM'}
          </p>
        </div>
      </div>

      <dl className="mt-4 space-y-3 border-t border-line pt-4">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-xs text-fg-muted">Project hosting</dt>
          <dd className="min-w-0 text-right text-sm font-semibold break-words text-fg">
            {p.project_hosting ?? <span className="font-normal text-fg-subtle">Belum diisi</span>}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-xs text-fg-muted">Task name</dt>
          <dd className="min-w-0 text-right text-sm font-semibold break-words text-fg">
            {p.task_name ?? <span className="font-normal text-fg-subtle">Belum diisi</span>}
          </dd>
        </div>
        {(p.status === 'diajukan_mdk' || p.status === 'selesai') && (
          <div className="flex items-start justify-between gap-3">
            <dt className="text-xs text-fg-muted">Diteruskan ke MDK</dt>
            <dd className="text-right text-sm font-semibold text-fg">
              {p.diteruskan_by_nama ?? '-'}
              <span className="block text-xs font-normal text-fg-muted">{formatWaktu(p.diteruskan_at)}</span>
            </dd>
          </div>
        )}
      </dl>

      {bisaDataPum && (
        <Button varian="kedua" ukuran="sm" className="mt-4 w-full" ikon={<FolderKanban className="size-4" />} onClick={onUbahData}>
          {p.project_hosting || p.task_name ? 'Ubah project hosting / task name' : 'Isi project hosting / task name'}
        </Button>
      )}
    </GlassCard>
  );
}
