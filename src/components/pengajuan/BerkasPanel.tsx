import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CircleAlert,
  CircleCheck,
  CloudUpload,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Lock,
  Paperclip,
  PencilLine,
  RotateCcw,
  Search,
  Trash,
  Undo2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { JENIS_BERKAS_LAINNYA, MAX_UPLOAD_MB, UPLOAD_ACCEPT, UPLOAD_DIIZINKAN, type StatusCek } from '../../../shared/constants';
import { formatUkuran, formatWaktu, waktuRelatif } from '../../../shared/format';
import type { Berkas, KelengkapanItem, PengajuanDetail } from '../../../shared/types';
import { useKamus } from '../../context/KonfigContext';
import { useKonfirmasi } from '../../context/KonfirmasiContext';
import { ApiError, unggahBerkas, urlBerkas } from '../../lib/api';
import { cn } from '../../lib/cn';
import { segarkanSemua, useCekBerkas, useHapusBerkas } from '../../lib/queries';
import { Button, kelasTombol } from '../ui/Button';
import { Input, Textarea } from '../ui/Field';
import { GlassCard } from '../ui/GlassCard';
import { Kosong } from '../ui/Kosong';
import { Modal } from '../ui/Modal';

interface Unggahan {
  kunci: number;
  nama: string;
  persen: number;
}

let urutUnggah = 0;

function IkonFile({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return <FileImage className="size-4 shrink-0 text-violet-600 dark:text-violet-300" />;
  if (mime.includes('sheet') || mime.includes('excel')) return <FileSpreadsheet className="size-4 shrink-0 text-emerald-600 dark:text-emerald-300" />;
  if (mime === 'application/pdf') return <FileText className="size-4 shrink-0 text-red-600 dark:text-red-400" />;
  return <FileText className="size-4 shrink-0 text-blue-600 dark:text-blue-300" />;
}

function periksaFile(file: File): string | null {
  const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  if (!UPLOAD_DIIZINKAN[ext]) return `${file.name}: tipe file tidak didukung (PDF, JPG, PNG, WEBP, DOC/DOCX, XLS/XLSX)`;
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `${file.name}: ukuran melebihi ${MAX_UPLOAD_MB} MB`;
  if (file.size === 0) return `${file.name}: file kosong`;
  return null;
}

/** Nama file panjang dipotong di tengah agar awal nama & ekstensinya tetap terlihat: "Permohonan Pemb…012_044210.pdf". */
export function potongTengah(nama: string, maks = 34): string {
  if (nama.length <= maks) return nama;
  const belakang = Math.ceil((maks - 1) * 0.45);
  return `${nama.slice(0, maks - 1 - belakang)}…${nama.slice(nama.length - belakang)}`;
}

/** Keterangan berkas terkunci sesuai status & peran. */
function teksTerkunci(p: PengajuanDetail, bisaCek: boolean): string | null {
  switch (p.status) {
    case 'diajukan_pum':
      return bisaCek
        ? null
        : 'Pengajuan sedang diperiksa PUM — berkas terkunci. Tarik kembali pengajuan bila perlu mengubah berkas.';
    case 'diverifikasi_pum':
      return 'Berkas sudah diverifikasi PUM — berkas terkunci.';
    case 'diajukan_mdk':
      return 'Berkas sudah diverifikasi PUM dan diajukan ke MDK — berkas terkunci.';
    case 'selesai':
      return 'Pengajuan sudah selesai (paid) — berkas terkunci.';
    default:
      return null;
  }
}

type ModeAksi = 'pum' | 'pengaju' | 'baca';
type Sifat = 'wajib' | 'opsional' | 'lainnya' | 'di-luar';

/** Satu baris tabel dokumen: berkas wajib/opsional pengajuan, Dokumen Lainnya, atau file yang tidak tercantum lagi. */
interface Baris {
  kunci: string;
  label: string;
  keterangan: string | null;
  sifat: Sifat;
  /** Hanya berkas wajib/opsional pengajuan ini. */
  item: KelengkapanItem | null;
  files: Berkas[];
}

type Nada = 'hijau' | 'kuning' | 'merah' | 'oranye' | 'abu';
const NADA: Record<Nada, string> = {
  hijau: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300',
  kuning: 'bg-amber-400/15 text-amber-800 ring-amber-500/30 dark:text-amber-200',
  merah: 'bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-300',
  oranye: 'bg-orange-500/10 text-orange-700 ring-orange-500/25 dark:text-orange-300',
  abu: 'bg-fg/[0.05] text-fg-muted ring-fg/10',
};

/** Status dokumen seperti pada tabel: hasil verifikasi PUM, atau keadaan unggahannya. */
function statusBaris(b: Baris): { teks: string; nada: Nada } {
  if (b.item?.cek?.status === 'sesuai') return { teks: 'Sudah Verifikasi', nada: 'hijau' };
  if (b.item?.cek?.status === 'revisi') return { teks: 'Perlu Revisi', nada: 'merah' };
  if (b.sifat === 'lainnya') return { teks: b.files.length ? 'Tambahan' : 'Opsional', nada: 'abu' };
  if (b.sifat === 'di-luar') return { teks: 'Di luar daftar', nada: 'abu' };
  if (b.files.length > 0) return { teks: 'Belum Verifikasi', nada: 'kuning' };
  return { teks: 'Belum Diunggah', nada: b.sifat === 'wajib' ? 'oranye' : 'abu' };
}

/** Unduh beberapa file sekaligus sebagai ZIP (dibuat di browser; satu folder per jenis dokumen). */
async function unduhZip(files: { berkas: Berkas; folder: string }[], namaZip: string): Promise<void> {
  const { zipSync } = await import('fflate');
  const isi: Record<string, Uint8Array> = {};
  for (const { berkas: b, folder } of files) {
    const r = await fetch(urlBerkas(b.id), { credentials: 'same-origin' });
    if (!r.ok) throw new Error(`Gagal mengunduh ${b.nama_asli}`);
    const dasar = `${folder.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Dokumen'}/${b.nama_asli}`;
    let nama = dasar;
    for (let i = 2; nama in isi; i++) nama = dasar.replace(/(\.[^./]+)?$/, (ext) => ` (${i})${ext}`);
    isi[nama] = new Uint8Array(await r.arrayBuffer());
  }
  // PDF/gambar sudah terkompresi: simpan tanpa kompresi ulang (lebih cepat).
  const blob = new Blob([zipSync(isi, { level: 0 })], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaZip;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function BerkasPanel({
  p,
  bisaKelola,
  bisaCek = false,
  sorot = false,
  footer,
}: {
  p: PengajuanDetail;
  /** Pengaju boleh mengunggah/menghapus berkas (draft & dikembalikan). */
  bisaKelola: boolean;
  /** PUM boleh mencentang berkas (status Diajukan ke PUM). */
  bisaCek?: boolean;
  sorot?: boolean;
  /** Konten di bawah daftar berkas (mis. aksi lanjutan PUM setelah selesai mencentang). */
  footer?: ReactNode;
}) {
  const qc = useQueryClient();
  const kamus = useKamus();
  const konfirmasi = useKonfirmasi();
  const hapusMut = useHapusBerkas();
  const cekMut = useCekBerkas(p.id);
  const [unggahan, setUnggahan] = useState<Record<string, Unggahan[]>>({});
  const [pratinjau, setPratinjau] = useState<Berkas | null>(null);
  const [namaLainnya, setNamaLainnya] = useState('');
  const [errLainnya, setErrLainnya] = useState('');
  const [cari, setCari] = useState('');
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [sibukMassal, setSibukMassal] = useState<'zip' | 'sesuai' | null>(null);

  const k = p.kelengkapan;
  // PUM (centang/revisi) dan pengaju (unggah) tidak pernah aktif bersamaan: statusnya berbeda.
  const mode: ModeAksi = bisaCek ? 'pum' : bisaKelola ? 'pengaju' : 'baca';
  const terkunci = bisaKelola ? null : teksTerkunci(p, bisaCek);
  const tampilCek = bisaCek || k.sesuai > 0 || k.revisi > 0;

  const semuaBaris = useMemo<Baris[]>(() => {
    const tercantum = new Set(k.items.map((i) => i.jenis));
    const daftar: Baris[] = k.items.map((item) => ({
      kunci: item.jenis,
      label: item.label,
      keterangan: kamus.berkas(item.jenis)?.keterangan ?? null,
      sifat: item.wajib ? 'wajib' : 'opsional',
      item,
      files: p.berkas.filter((b) => b.jenis === item.jenis),
    }));
    // File berjenis yang tidak (lagi) tercantum di pengajuan ini, mis. setelah master Jenis Pengajuan diubah.
    const diLuar = [...new Set(p.berkas.filter((b) => b.jenis !== JENIS_BERKAS_LAINNYA && !tercantum.has(b.jenis)).map((b) => b.jenis))];
    for (const jenis of diLuar) {
      daftar.push({
        kunci: jenis,
        label: kamus.labelBerkas(jenis),
        keterangan: 'Tidak tercantum lagi di daftar berkas pengajuan ini (diubah di Master Data). File tetap tersimpan.',
        sifat: 'di-luar',
        item: null,
        files: p.berkas.filter((b) => b.jenis === jenis),
      });
    }
    daftar.push({
      kunci: JENIS_BERKAS_LAINNYA,
      label: kamus.labelBerkas(JENIS_BERKAS_LAINNYA),
      keterangan: 'Opsional — boleh banyak, beri nama tiap dokumen',
      sifat: 'lainnya',
      item: null,
      files: p.berkas.filter((b) => b.jenis === JENIS_BERKAS_LAINNYA),
    });
    return daftar;
  }, [k.items, p.berkas, kamus]);

  const kata = cari.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const tampil = semuaBaris.filter((b) => {
    if (kata.length === 0) return true;
    const teks = [b.label, b.keterangan, ...b.files.flatMap((f) => [f.nama_asli, f.nama_berkas])].filter(Boolean).join(' ').toLowerCase();
    return kata.every((x) => teks.includes(x));
  });
  const bisaDipilih = (b: Baris) => b.files.length > 0;
  const dipilih = semuaBaris.filter((b) => pilih.has(b.kunci) && bisaDipilih(b));
  const pilihanTampil = tampil.filter(bisaDipilih);
  const semuaTerpilih = pilihanTampil.length > 0 && pilihanTampil.every((b) => pilih.has(b.kunci));
  const untukSesuai = mode === 'pum' ? dipilih.filter((b) => b.item && b.item.cek?.status !== 'sesuai') : [];

  const ubahPilih = (kunci: string, v: boolean) =>
    setPilih((s) => {
      const baru = new Set(s);
      if (v) baru.add(kunci);
      else baru.delete(kunci);
      return baru;
    });

  const unggah = async (jenis: string, files: File[], namaBerkas?: string) => {
    for (const file of files) {
      const salah = periksaFile(file);
      if (salah) {
        toast.error(salah);
        continue;
      }
      const kunci = ++urutUnggah;
      setUnggahan((u) => ({ ...u, [jenis]: [...(u[jenis] ?? []), { kunci, nama: file.name, persen: 0 }] }));
      try {
        const { hasil } = unggahBerkas(p.id, { file, jenis, nama_berkas: namaBerkas }, (persen) =>
          setUnggahan((u) => ({ ...u, [jenis]: (u[jenis] ?? []).map((x) => (x.kunci === kunci ? { ...x, persen } : x)) })),
        );
        const detail = await hasil;
        segarkanSemua(qc, detail);
        toast.success(`${namaBerkas || kamus.labelBerkas(jenis)} terunggah`, {
          description: file.name,
        });
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Unggahan gagal', { description: file.name });
      } finally {
        setUnggahan((u) => ({ ...u, [jenis]: (u[jenis] ?? []).filter((x) => x.kunci !== kunci) }));
      }
    }
  };

  const hapus = async (b: Berkas) => {
    const ok = await konfirmasi({
      judul: 'Hapus berkas?',
      pesan: (
        <>
          File <b className="text-fg">{b.nama_asli}</b> akan dihapus permanen dari pengajuan ini.
        </>
      ),
      teksYa: 'Hapus berkas',
      varian: 'bahaya',
    });
    if (!ok) return;
    try {
      await hapusMut.mutateAsync(b.id);
      toast.success('Berkas dihapus');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal menghapus berkas');
    }
  };

  // Tanpa toast sukses: perubahan centang langsung terlihat pada baris berkas (hindari banjir toast).
  const cek = async (item: KelengkapanItem, status: StatusCek | null, catatan?: string): Promise<boolean> => {
    try {
      await cekMut.mutateAsync({ jenis: item.jenis, status, catatan });
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Gagal menyimpan pemeriksaan ${item.label}`);
      return false;
    }
  };

  const unggahLainnya = (files: File[]) => {
    const nama = namaLainnya.trim();
    if (nama.length < 2) {
      setErrLainnya('Isi nama dokumen terlebih dahulu (min. 2 karakter)');
      return;
    }
    setErrLainnya('');
    void unggah(JENIS_BERKAS_LAINNYA, files.slice(0, 1), nama).then(() => setNamaLainnya(''));
  };

  const unduhTerpilih = async () => {
    const files = dipilih.flatMap((b) => b.files.map((berkas) => ({ berkas, folder: b.label })));
    if (files.length === 0) return;
    if (files.length === 1) {
      window.location.assign(urlBerkas(files[0].berkas.id, true));
      return;
    }
    setSibukMassal('zip');
    try {
      await unduhZip(files, `${p.kode}_dokumen.zip`);
      toast.success(`${files.length} file diunduh (ZIP)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat ZIP');
    } finally {
      setSibukMassal(null);
    }
  };

  const sesuaiTerpilih = async () => {
    setSibukMassal('sesuai');
    let berhasil = 0;
    for (const b of untukSesuai) {
      if (b.item && (await cek(b.item, 'sesuai'))) berhasil++;
    }
    setSibukMassal(null);
    if (berhasil > 0) toast.success(`${berhasil} dokumen ditandai Sudah Verifikasi`);
    setPilih(new Set());
  };

  return (
    <GlassCard
      className={cn('p-5 sm:p-6', (sorot || bisaCek) && 'ring-2 ring-kuning-400/70')}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.45 }}
    >
      {/* Judul + kotak cari (seperti "List Dokumen Pendukung") */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-navy-900/[0.06] text-navy-800 ring-1 ring-navy-900/10 dark:bg-white/[0.07] dark:text-kuning-300 dark:ring-white/10">
            <Paperclip className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] leading-tight font-bold text-fg">List Dokumen Pendukung</h3>
            <p className="mt-0.5 text-xs text-fg-muted" data-testid="ringkasan-berkas">
              {tampilCek
                ? `${k.terpenuhi}/${k.total} berkas wajib terpenuhi · ${k.sesuai}/${k.total} sudah diverifikasi PUM${k.revisi ? ` · ${k.revisi} perlu revisi` : ''}`
                : k.total === 0
                  ? 'Tidak ada berkas wajib'
                  : k.lengkap
                    ? 'Semua berkas wajib sudah terpenuhi'
                    : `${k.total - k.terpenuhi} berkas wajib belum terpenuhi`}
            </p>
          </div>
        </div>
        <label className="relative w-full sm:w-60">
          <span className="sr-only">Cari dokumen</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-fg-muted" />
          <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari dokumen" className="h-9 pl-9 text-[13px]" />
        </label>
      </div>

      {bisaCek && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-kuning-400/15 px-3 py-2.5 text-xs text-fg ring-1 ring-kuning-500/30">
          <CircleCheck className="mt-px size-4 shrink-0 text-kuning-700 dark:text-kuning-300" />
          <p>
            Buka setiap dokumen (<b>Preview</b>), lalu centang <b>Sesuai</b> bila sudah benar atau klik <b>Revisi</b> (retur) beserta
            catatannya. Pengajuan dapat diverifikasi setelah semua berkas wajib sesuai. Centang beberapa baris untuk menandai sesuai
            sekaligus.
          </p>
        </div>
      )}

      {terkunci && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-fg/[0.04] px-3 py-2 text-xs text-fg-muted ring-1 ring-fg/[0.06]">
          <Lock className="size-3.5 shrink-0" />
          {terkunci}
        </p>
      )}

      {/* Aksi untuk baris yang dicentang */}
      <AnimatePresence initial={false}>
        {dipilih.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-fg/[0.04] px-3 py-2 ring-1 ring-fg/[0.08]" data-testid="aksi-terpilih">
              <span className="mr-auto text-xs font-semibold text-fg">{dipilih.length} dokumen dipilih</span>
              <Button
                varian="kedua"
                ukuran="sm"
                ikon={<FileArchive className="size-4" />}
                memuat={sibukMassal === 'zip'}
                disabled={sibukMassal !== null}
                onClick={() => void unduhTerpilih()}
              >
                Download {dipilih.reduce((n, b) => n + b.files.length, 0) > 1 ? '(ZIP)' : ''}
              </Button>
              {mode === 'pum' && (
                <Button
                  varian="sukses"
                  ukuran="sm"
                  ikon={<Check className="size-4" />}
                  memuat={sibukMassal === 'sesuai'}
                  disabled={sibukMassal !== null || untukSesuai.length === 0}
                  onClick={() => void sesuaiTerpilih()}
                >
                  Tandai Sesuai{untukSesuai.length ? ` (${untukSesuai.length})` : ''}
                </Button>
              )}
              <Button varian="hantu" ukuran="sm" ikon={<X className="size-4" />} onClick={() => setPilih(new Set())}>
                Batal pilih
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        Tabel dokumen (container query, mengikuti lebar panel):
        ≥ 52rem → 5 kolom: pilih | jenis dokumen | nama dokumen | status | aksi (baris file sejajar lewat subgrid).
        Lebih sempit → kartu: pilih + jenis di atas, status & file beserta aksinya di bawah.
      */}
      <div className="@container mt-4">
        <ul className="@[52rem]:grid @[52rem]:grid-cols-[1.75rem_minmax(0,1.1fr)_minmax(0,1.3fr)_9.5rem_15rem] @[52rem]:gap-x-3" aria-label="Kelengkapan berkas">
          <li className="hidden border-b border-line pb-2.5 text-xs font-semibold text-fg-muted @[52rem]:col-span-5 @[52rem]:grid @[52rem]:grid-cols-subgrid @[52rem]:gap-x-3">
            <span className="grid place-items-center">
              <input
                type="checkbox"
                className="size-4 cursor-pointer accent-[var(--color-kuning-500)] disabled:cursor-not-allowed disabled:opacity-40"
                checked={semuaTerpilih}
                disabled={pilihanTampil.length === 0}
                aria-label="Pilih semua dokumen"
                title={pilihanTampil.length === 0 ? 'Belum ada file' : 'Pilih semua dokumen yang memiliki file'}
                onChange={(e) => setPilih(e.target.checked ? new Set(pilihanTampil.map((b) => b.kunci)) : new Set())}
              />
            </span>
            <span aria-hidden>Jenis Dokumen Pendukung</span>
            <span aria-hidden>Nama dokumen</span>
            <span aria-hidden>Status dokumen</span>
            <span aria-hidden>Action</span>
          </li>
          {/* Header untuk tampilan sempit: centang semua */}
          {pilihanTampil.length > 0 && (
            <li className="flex items-center gap-2 border-b border-line pb-2 text-xs font-semibold text-fg-muted @[52rem]:hidden">
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-kuning-500)]"
                  checked={semuaTerpilih}
                  onChange={(e) => setPilih(e.target.checked ? new Set(pilihanTampil.map((b) => b.kunci)) : new Set())}
                />
                Pilih semua dokumen
              </label>
            </li>
          )}
          {tampil.map((b) => (
            <BarisDokumen
              key={b.kunci}
              b={b}
              mode={mode}
              unggahan={unggahan[b.kunci] ?? []}
              dipilih={pilih.has(b.kunci)}
              onPilih={(v) => ubahPilih(b.kunci, v)}
              sibuk={cekMut.isPending || sibukMassal !== null}
              onUnggah={(files) => void unggah(b.kunci, files)}
              onPratinjau={setPratinjau}
              onHapus={hapus}
              onCek={(s, c) => (b.item ? cek(b.item, s, c) : Promise.resolve(false))}
              tambahan={
                b.sifat === 'lainnya' && mode === 'pengaju' ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="flex-1">
                      <Input
                        value={namaLainnya}
                        onChange={(e) => {
                          setNamaLainnya(e.target.value);
                          setErrLainnya('');
                        }}
                        maxLength={120}
                        placeholder="Nama dokumen, mis. Foto Dokumentasi"
                        aria-label="Nama dokumen lainnya"
                        invalid={!!errLainnya}
                        className="h-9 text-[13px]"
                      />
                      {errLainnya && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{errLainnya}</p>}
                    </div>
                    <PilihFile label="Unggah dokumen" onPilih={unggahLainnya} />
                  </div>
                ) : null
              }
            />
          ))}
          {tampil.length === 0 && (
            <li className="py-8 text-center text-sm text-fg-muted @[52rem]:col-span-5">Tidak ada dokumen yang cocok dengan “{cari.trim()}”.</li>
          )}
        </ul>
      </div>

      {footer}

      <Modal
        open={!!pratinjau}
        onOpenChange={(o) => !o && setPratinjau(null)}
        judul={pratinjau?.nama_berkas ?? (pratinjau ? kamus.labelBerkas(pratinjau.jenis) : '')}
        deskripsi={pratinjau ? `${pratinjau.nama_asli} · ${formatUkuran(pratinjau.ukuran)}` : undefined}
        lebar="xl"
        footer={
          pratinjau && (
            <>
              <a href={urlBerkas(pratinjau.id)} target="_blank" rel="noreferrer" className={kelasTombol('kedua')}>
                <ExternalLink className="size-4" /> Buka di tab baru
              </a>
              <a href={urlBerkas(pratinjau.id, true)} className={kelasTombol('utama')}>
                <Download className="size-4" /> Download
              </a>
            </>
          )
        }
      >
        {pratinjau &&
          (pratinjau.mime === 'application/pdf' ? (
            <iframe
              src={urlBerkas(pratinjau.id)}
              title={`Pratinjau ${pratinjau.nama_asli}`}
              className="h-[68vh] w-full rounded-xl bg-white ring-1 ring-line"
            />
          ) : pratinjau.mime.startsWith('image/') ? (
            <img
              src={urlBerkas(pratinjau.id)}
              alt={pratinjau.nama_asli}
              className="mx-auto max-h-[68vh] rounded-xl object-contain ring-1 ring-line"
            />
          ) : (
            <Kosong
              ikon={<FileText />}
              judul="Pratinjau tidak tersedia"
              deskripsi="Dokumen Word/Excel tidak dapat ditampilkan di browser. Silakan download untuk membukanya."
            />
          ))}
      </Modal>
    </GlassCard>
  );
}

// ───────────────────────────── Baris tabel ─────────────────────────────

function PilihFile({
  label,
  onPilih,
  multiple = false,
}: {
  label: string;
  onPilih: (files: File[]) => void;
  multiple?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        className="hidden"
        accept={UPLOAD_ACCEPT}
        multiple={multiple}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length > 0) onPilih(files);
        }}
      />
      <Button varian="kedua" ukuran="sm" className="h-8" ikon={<CloudUpload className="size-4" />} onClick={() => ref.current?.click()}>
        {label}
      </Button>
    </>
  );
}

const TOMBOL_GARIS =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-field-line bg-surface px-3 text-xs font-semibold text-fg transition hover:border-fg/25 hover:bg-fg/[0.04] dark:bg-white/[0.04]';

function BarisDokumen({
  b,
  mode,
  unggahan,
  dipilih,
  onPilih,
  sibuk,
  onUnggah,
  onPratinjau,
  onHapus,
  onCek,
  tambahan,
}: {
  b: Baris;
  mode: ModeAksi;
  unggahan: Unggahan[];
  dipilih: boolean;
  onPilih: (v: boolean) => void;
  sibuk: boolean;
  onUnggah: (files: File[]) => void;
  onPratinjau: (b: Berkas) => void;
  onHapus: (b: Berkas) => void;
  onCek: (status: StatusCek | null, catatan?: string) => Promise<boolean>;
  /** Isian tambahan selebar baris (Dokumen Lainnya: nama + unggah). */
  tambahan: ReactNode;
}) {
  const id = useId();
  const [seret, setSeret] = useState(false);
  const [revisiTerbuka, setRevisiTerbuka] = useState(false);
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState('');
  const item = b.item;
  const c = item?.cek ?? null;
  const sesuai = c?.status === 'sesuai';
  const keadaan = b.files.length > 0 ? 'ada' : 'kosong';
  const status = statusBaris(b);
  const bisaUnggah = mode === 'pengaju' && (b.sifat === 'wajib' || b.sifat === 'opsional');
  // PUM memeriksa berkas wajib (juga berkas fisik tanpa file) dan berkas opsional yang sudah diunggah/diperiksa.
  const bisaCek = mode === 'pum' && !!item && (item.wajib || b.files.length > 0 || !!c);
  const adaAksiPeran = bisaUnggah || bisaCek;

  const onDrag = (e: DragEvent) => {
    if (!bisaUnggah) return;
    e.preventDefault();
    setSeret(e.type === 'dragover' || e.type === 'dragenter');
  };

  const bukaRevisi = () => {
    setCatatan(c?.status === 'revisi' ? (c.catatan ?? '') : '');
    setError('');
    setRevisiTerbuka(true);
  };

  const simpanRevisi = async () => {
    const t = catatan.trim();
    if (t.length < 3) {
      setError(t ? 'Catatan minimal 3 karakter' : 'Tuliskan apa yang perlu direvisi');
      return;
    }
    if (await onCek('revisi', t)) setRevisiTerbuka(false);
  };

  return (
    <motion.li
      layout="position"
      data-berkas={b.kunci}
      data-sifat={b.sifat}
      data-keadaan={keadaan}
      data-cek={c?.status ?? 'belum'}
      onDragEnter={onDrag}
      onDragOver={onDrag}
      onDragLeave={onDrag}
      onDrop={(e) => {
        if (!bisaUnggah) return;
        e.preventDefault();
        setSeret(false);
        const dijatuhkan = [...e.dataTransfer.files];
        if (dijatuhkan.length > 0) onUnggah(dijatuhkan);
      }}
      className={cn(
        'grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-line py-3.5 transition-colors last:border-0',
        '@[52rem]:col-span-5 @[52rem]:grid-cols-subgrid @[52rem]:items-center',
        dipilih && 'bg-kuning-400/[0.06]',
        seret && 'rounded-xl bg-kuning-400/15 ring-2 ring-kuning-500',
      )}
    >
      {/* Pilih */}
      <span className="grid place-items-start pt-0.5 @[52rem]:place-items-center @[52rem]:pt-0">
        <input
          type="checkbox"
          className="size-4 cursor-pointer accent-[var(--color-kuning-500)] disabled:cursor-not-allowed disabled:opacity-40"
          checked={dipilih}
          disabled={b.files.length === 0}
          onChange={(e) => onPilih(e.target.checked)}
          aria-label={`Pilih ${b.label}`}
          title={b.files.length === 0 ? 'Belum ada file' : 'Pilih untuk download/tandai sekaligus'}
        />
      </span>

      {/* Jenis dokumen */}
      <div className="min-w-0">
        {b.sifat === 'wajib' && (
          <span className="mb-1 inline-flex rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-red-500/20 dark:text-red-300">
            Wajib
          </span>
        )}
        <p className="text-[13px] leading-snug font-semibold text-fg">{b.label}</p>
        {b.keterangan && <p className="mt-0.5 text-[11px] leading-snug text-fg-subtle">{b.keterangan}</p>}
      </div>

      {/*
        Nama dokumen · status · aksi. ≥ 52rem: subgrid 3 kolom (status di baris pertama kolom tengah; tiap file = nama di kolom
        kiri + tombolnya di kolom kanan lewat display:contents). Lebih sempit: bertumpuk di bawah nama jenis, status paling atas.
      */}
      <div className="col-start-2 flex min-w-0 flex-col gap-1.5 @[52rem]:col-span-3 @[52rem]:col-start-3 @[52rem]:grid @[52rem]:grid-cols-subgrid @[52rem]:items-center @[52rem]:gap-x-3 @[52rem]:gap-y-1.5">
        <div className="order-first flex flex-col items-start gap-1 @[52rem]:order-none @[52rem]:col-start-2 @[52rem]:row-start-1">
          <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1', NADA[status.nada])}>
            {status.teks}
          </span>
          {c && (
            <span className="text-[11px] leading-snug text-fg-subtle">
              {c.diperiksa_by_nama}, <span title={formatWaktu(c.diperiksa_at)}>{waktuRelatif(c.diperiksa_at)}</span>
            </span>
          )}
          {c?.status === 'revisi' && c.catatan && (
            <p className="line-clamp-3 text-xs whitespace-pre-line text-fg" title={c.catatan}>
              {c.catatan}
            </p>
          )}
          {c?.status === 'revisi' && mode === 'pum' && (
            <button
              type="button"
              onClick={() => void onCek(null)}
              disabled={sibuk}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg-muted underline-offset-2 hover:text-fg hover:underline disabled:opacity-60"
            >
              <RotateCcw className="size-3" aria-hidden /> Batalkan tanda
            </button>
          )}
        </div>

        {b.files.map((f) => (
          <div key={f.id} className="flex min-w-0 items-center gap-2 @[52rem]:contents">
            <button
              type="button"
              onClick={() => onPratinjau(f)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left @[52rem]:col-start-1"
              title={`${f.nama_berkas ? `${f.nama_berkas} — ` : ''}${f.nama_asli} · ${formatUkuran(f.ukuran)} · diunggah ${f.uploaded_by_nama}, ${formatWaktu(f.created_at)}`}
            >
              <IkonFile mime={f.mime} />
              <span className="min-w-0 truncate text-[13px] text-fg hover:underline">
                {f.jenis === JENIS_BERKAS_LAINNYA && f.nama_berkas ? <b className="font-semibold">{f.nama_berkas}: </b> : null}
                {potongTengah(f.nama_asli)}
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-1.5 @[52rem]:col-start-3">
              <a href={urlBerkas(f.id, true)} className={TOMBOL_GARIS} aria-label={`Download ${f.nama_asli}`}>
                <Download className="size-3.5 sm:hidden" aria-hidden />
                <span className="hidden sm:inline">Download</span>
              </a>
              <button type="button" onClick={() => onPratinjau(f)} className={TOMBOL_GARIS} aria-label={`Preview ${f.nama_asli}`}>
                <Eye className="size-3.5 sm:hidden" aria-hidden />
                <span className="hidden sm:inline">Preview</span>
              </button>
              {mode === 'pengaju' && (
                <button
                  type="button"
                  onClick={() => onHapus(f)}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-fg-muted transition hover:bg-red-500/10 hover:text-red-600"
                  aria-label={`Hapus ${f.nama_asli}`}
                  title="Hapus file"
                >
                  <Trash className="size-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {unggahan.map((u) => (
          <div key={`u${u.kunci}`} className="min-w-0 rounded-lg bg-kuning-400/10 px-2.5 py-1.5 ring-1 ring-kuning-500/30 @[52rem]:col-start-1">
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="truncate font-semibold text-fg">{u.nama}</span>
              <span className="angka shrink-0 font-bold text-fg-muted">{u.persen}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-fg/10">
              <motion.div
                className="h-full rounded-full bg-linear-to-r from-kuning-400 to-kuning-600"
                animate={{ width: `${u.persen}%` }}
                transition={{ ease: 'easeOut', duration: 0.2 }}
              />
            </div>
          </div>
        ))}

        {b.files.length === 0 && unggahan.length === 0 && (
          <p className="text-xs text-fg-subtle @[52rem]:col-start-1">
            {bisaUnggah
              ? b.sifat === 'wajib'
                ? 'Wajib diunggah sebelum diajukan — klik Unggah atau seret file ke sini'
                : 'Belum diunggah — klik Unggah atau seret file ke sini'
              : b.sifat === 'lainnya'
                ? 'Belum ada dokumen lainnya'
                : 'Belum diunggah'}
          </p>
        )}

        {adaAksiPeran && (
          <div className="flex flex-wrap items-center gap-1.5 @[52rem]:col-start-3">
            {bisaUnggah && <PilihFile label={b.files.length > 0 ? 'Tambah file' : 'Unggah'} onPilih={onUnggah} multiple />}
            {bisaCek && (
              <>
                <label
                  htmlFor={`${id}-sesuai`}
                  className={cn(
                    'relative inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ring-1 transition select-none',
                    sesuai
                      ? 'bg-emerald-500 text-white shadow-md ring-emerald-600 shadow-emerald-500/25'
                      : 'bg-surface/70 text-fg ring-fg/15 hover:ring-emerald-500/50 dark:bg-white/[0.04]',
                    sibuk && 'pointer-events-none opacity-70',
                  )}
                  title="Centang bila dokumen sudah benar"
                >
                  <input
                    id={`${id}-sesuai`}
                    type="checkbox"
                    className="peer sr-only"
                    checked={sesuai}
                    disabled={sibuk}
                    aria-label={`${b.label} sesuai`}
                    onChange={(e) => void onCek(e.target.checked ? 'sesuai' : null)}
                  />
                  <span
                    className={cn(
                      'grid size-4 place-items-center rounded ring-1 peer-focus-visible:ring-2 peer-focus-visible:ring-kuning-500',
                      sesuai ? 'bg-white text-emerald-600 ring-white' : 'ring-fg/30',
                    )}
                    aria-hidden
                  >
                    {sesuai && <Check className="size-3" strokeWidth={3.5} />}
                  </span>
                  Sesuai
                </label>
                <Button
                  varian="kedua"
                  ukuran="sm"
                  className={cn('h-8 px-2.5 text-xs', c?.status === 'revisi' && 'ring-2 ring-red-500/40')}
                  ikon={<Undo2 className="size-3.5" />}
                  onClick={bukaRevisi}
                  disabled={sibuk}
                  aria-label={c?.status === 'revisi' ? `Ubah catatan revisi ${b.label}` : `${b.label} perlu revisi`}
                  title="Retur — tandai perlu revisi beserta catatannya"
                >
                  Revisi
                </Button>
              </>
            )}
          </div>
        )}
        {bisaCek && keadaan === 'kosong' && !c && (
          <p className="flex items-start gap-1.5 text-[11px] text-amber-700 @[52rem]:col-start-3 dark:text-amber-300">
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden /> Belum ada file — centang Sesuai hanya bila berkas fisik sudah
            diterima.
          </p>
        )}
      </div>

      {/* Isian tambahan & catatan revisi (selebar baris) */}
      {tambahan && <div className="col-start-2 @[52rem]:col-span-3 @[52rem]:col-start-3">{tambahan}</div>}
      <AnimatePresence initial={false}>
        {revisiTerbuka && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="col-span-2 overflow-hidden @[52rem]:col-span-4 @[52rem]:col-start-2"
          >
            <div className="space-y-2 rounded-xl bg-red-500/[0.06] p-3 ring-1 ring-red-500/25">
              <label htmlFor={`${id}-catatan`} className="flex items-center gap-1.5 text-xs font-bold text-fg">
                <PencilLine className="size-3.5" /> Apa yang perlu direvisi pada {b.label}?
              </label>
              <Textarea
                id={`${id}-catatan`}
                autoFocus
                rows={2}
                maxLength={500}
                value={catatan}
                invalid={!!error}
                placeholder="mis. Tanda tangan ketua belum ada"
                onChange={(e) => {
                  setCatatan(e.target.value);
                  setError('');
                }}
              />
              {error && (
                <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button varian="hantu" ukuran="sm" onClick={() => setRevisiTerbuka(false)} disabled={sibuk}>
                  Batal
                </Button>
                <Button ukuran="sm" memuat={sibuk} onClick={() => void simpanRevisi()}>
                  Simpan catatan revisi
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
