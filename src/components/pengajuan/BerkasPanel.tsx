import { useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  Check,
  CircleAlert,
  CircleCheck,
  CircleX,
  CloudUpload,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  Lock,
  Paperclip,
  PencilLine,
  RotateCcw,
  Trash,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { JENIS_BERKAS_LABEL, MAX_UPLOAD_MB, UPLOAD_ACCEPT, UPLOAD_DIIZINKAN, type StatusCek } from '../../../shared/constants';
import { formatUkuran, formatWaktu, waktuRelatif } from '../../../shared/format';
import type { Berkas, KelengkapanItem, PengajuanDetail } from '../../../shared/types';
import { useKonfirmasi } from '../../context/KonfirmasiContext';
import { ApiError, unggahBerkas, urlBerkas } from '../../lib/api';
import { cn } from '../../lib/cn';
import { segarkanSemua, useBerkasNa, useCekBerkas, useHapusBerkas } from '../../lib/queries';
import { Button, kelasTombol } from '../ui/Button';
import { Input, Textarea } from '../ui/Field';
import { GlassCard, JudulKartu } from '../ui/GlassCard';
import { Kosong } from '../ui/Kosong';
import { Menu, MenuItem } from '../ui/Menu';
import { Modal } from '../ui/Modal';
import { ProgressRing } from '../ui/ProgressRing';

interface Unggahan {
  kunci: number;
  nama: string;
  persen: number;
}

let urutUnggah = 0;

function IkonFile({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return <FileImage className="size-4.5 text-violet-600 dark:text-violet-300" />;
  if (mime.includes('sheet') || mime.includes('excel')) return <FileSpreadsheet className="size-4.5 text-emerald-600 dark:text-emerald-300" />;
  if (mime === 'application/pdf') return <FileText className="size-4.5 text-red-600 dark:text-red-400" />;
  return <FileText className="size-4.5 text-blue-600 dark:text-blue-300" />;
}

function periksaFile(file: File): string | null {
  const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  if (!UPLOAD_DIIZINKAN[ext]) return `${file.name}: tipe file tidak didukung (PDF, JPG, PNG, WEBP, DOC/DOCX, XLS/XLSX)`;
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `${file.name}: ukuran melebihi ${MAX_UPLOAD_MB} MB`;
  if (file.size === 0) return `${file.name}: file kosong`;
  return null;
}

/** Keterangan berkas terkunci sesuai status & peran. */
function teksTerkunci(p: PengajuanDetail, bisaCek: boolean): string | null {
  switch (p.status) {
    case 'diajukan_pum':
      return bisaCek
        ? null
        : 'Pengajuan sedang diperiksa PUM — berkas terkunci. Tarik kembali pengajuan bila perlu mengubah berkas.';
    case 'diajukan_mdk':
      return 'Berkas sudah diverifikasi PUM dan diteruskan ke MDK — berkas terkunci.';
    case 'selesai':
      return 'Pengajuan sudah selesai (paid) — berkas terkunci.';
    default:
      return null;
  }
}

export function BerkasPanel({
  p,
  bisaKelola,
  bisaCek = false,
  sorot = false,
  footer,
}: {
  p: PengajuanDetail;
  /** Pengaju boleh mengunggah/menghapus/menandai N/A (draft & dikembalikan). */
  bisaKelola: boolean;
  /** PUM boleh mencentang berkas (status Diajukan ke PUM). */
  bisaCek?: boolean;
  sorot?: boolean;
  /** Konten di bawah daftar berkas (mis. aksi lanjutan PUM setelah selesai mencentang). */
  footer?: ReactNode;
}) {
  const qc = useQueryClient();
  const konfirmasi = useKonfirmasi();
  const naMut = useBerkasNa(p.id);
  const hapusMut = useHapusBerkas();
  const cekMut = useCekBerkas(p.id);
  const [unggahan, setUnggahan] = useState<Record<string, Unggahan[]>>({});
  const [pratinjau, setPratinjau] = useState<Berkas | null>(null);
  const [namaLainnya, setNamaLainnya] = useState('');
  const [errLainnya, setErrLainnya] = useState('');

  const k = p.kelengkapan;
  const lainnya = p.berkas.filter((b) => b.jenis === 'lainnya');
  const tampilCek = bisaCek || k.sesuai > 0 || k.revisi > 0;
  const terkunci = bisaKelola ? null : teksTerkunci(p, bisaCek);

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
        toast.success(`${namaBerkas || JENIS_BERKAS_LABEL[jenis as keyof typeof JENIS_BERKAS_LABEL]} terunggah`, {
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

  const ubahNa = async (jenis: string, na: boolean) => {
    try {
      await naMut.mutateAsync({ jenis, na });
      toast.success(na ? 'Ditandai tidak diperlukan' : 'Tanda tidak diperlukan dibatalkan');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal memperbarui tanda berkas');
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
    void unggah('lainnya', files.slice(0, 1), nama).then(() => setNamaLainnya(''));
  };

  return (
    <GlassCard
      className={cn('p-5 sm:p-6', (sorot || bisaCek) && 'ring-2 ring-kuning-400/70')}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.45 }}
    >
      <JudulKartu
        ikon={<Paperclip className="size-4.5" />}
        judul={bisaCek ? 'Periksa kelengkapan berkas' : 'Kelengkapan berkas'}
        deskripsi={
          tampilCek
            ? `${k.terpenuhi}/${k.total} terpenuhi · ${k.sesuai}/${k.total} dicentang sesuai PUM${k.revisi ? ` · ${k.revisi} perlu revisi` : ''}`
            : k.lengkap
              ? 'Semua berkas wajib sudah terpenuhi'
              : `${k.total - k.terpenuhi} berkas wajib belum terpenuhi`
        }
        aksi={
          tampilCek ? (
            <div className="flex items-center gap-2">
              <ProgressRing nilai={k.terpenuhi} total={k.total} ukuran={40} tebal={4} />
              <span title="Dicentang sesuai oleh PUM">
                <ProgressRing nilai={k.sesuai} total={k.total} ukuran={40} tebal={4} judul="Dicentang sesuai PUM" />
              </span>
            </div>
          ) : (
            <ProgressRing nilai={k.terpenuhi} total={k.total} ukuran={44} tebal={4.5} />
          )
        }
      />

      {bisaCek && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-kuning-400/15 px-3 py-2.5 text-xs text-fg ring-1 ring-kuning-500/30">
          <CircleCheck className="mt-px size-4 shrink-0 text-kuning-700 dark:text-kuning-300" />
          <p>
            Buka setiap berkas, lalu centang <b>Sesuai</b> bila sudah benar atau tandai <b>Perlu revisi</b> beserta catatannya.
            Pengajuan dapat diteruskan ke MDK setelah semua berkas wajib dicentang sesuai.
          </p>
        </div>
      )}

      {terkunci && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-fg/[0.04] px-3 py-2 text-xs text-fg-muted ring-1 ring-fg/[0.06]">
          <Lock className="size-3.5 shrink-0" />
          {terkunci}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {k.items.map((item) => (
          <BarisBerkas
            key={item.jenis}
            item={item}
            files={p.berkas.filter((b) => b.jenis === item.jenis)}
            unggahan={unggahan[item.jenis] ?? []}
            bisaKelola={bisaKelola}
            onPilih={(files) => void unggah(item.jenis, files)}
            onPratinjau={setPratinjau}
            onHapus={hapus}
            cek={
              tampilCek ? (
                <KontrolCek item={item} bisaCek={bisaCek} sibuk={cekMut.isPending} onCek={(s, c) => cek(item, s, c)} />
              ) : null
            }
            menu={
              bisaKelola && item.jumlah === 0 ? (
                <Menu
                  lebar="w-64"
                  pemicu={
                    <button
                      type="button"
                      className="grid size-9 place-items-center rounded-xl text-fg-muted transition hover:bg-fg/[0.06] hover:text-fg"
                      aria-label={`Opsi ${item.label}`}
                    >
                      <Ellipsis className="size-4" />
                    </button>
                  }
                >
                  {item.na ? (
                    <MenuItem ikon={<RotateCcw />} onSelect={() => void ubahNa(item.jenis, false)}>
                      Batalkan tanda “tidak diperlukan”
                    </MenuItem>
                  ) : (
                    <MenuItem ikon={<Ban />} onSelect={() => void ubahNa(item.jenis, true)}>
                      Tandai tidak diperlukan
                    </MenuItem>
                  )}
                </Menu>
              ) : null
            }
          />
        ))}

        {/* Dokumen lainnya */}
        <div className="rounded-2xl border border-dashed border-fg/15 p-3.5 sm:p-4" data-berkas="lainnya">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-fg">Dokumen lainnya</p>
              <p className="text-xs text-fg-muted">Opsional — tidak dihitung sebagai berkas wajib</p>
            </div>
            <span className="text-xs font-semibold text-fg-muted">{lainnya.length} file</span>
          </div>
          {bisaKelola && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
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
                  className="h-10"
                />
                {errLainnya && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{errLainnya}</p>}
              </div>
              <PilihFile label="Unggah dokumen" onPilih={unggahLainnya} />
            </div>
          )}
          <DaftarFile
            files={lainnya}
            unggahan={unggahan.lainnya ?? []}
            bisaKelola={bisaKelola}
            onPratinjau={setPratinjau}
            onHapus={hapus}
          />
        </div>
      </div>

      {footer}

      <Modal
        open={!!pratinjau}
        onOpenChange={(o) => !o && setPratinjau(null)}
        judul={pratinjau?.nama_berkas ?? (pratinjau ? JENIS_BERKAS_LABEL[pratinjau.jenis] : '')}
        deskripsi={pratinjau ? `${pratinjau.nama_asli} · ${formatUkuran(pratinjau.ukuran)}` : undefined}
        lebar="xl"
        footer={
          pratinjau && (
            <>
              <a href={urlBerkas(pratinjau.id)} target="_blank" rel="noreferrer" className={kelasTombol('kedua')}>
                <ExternalLink className="size-4" /> Buka di tab baru
              </a>
              <a href={urlBerkas(pratinjau.id, true)} className={kelasTombol('utama')}>
                <Download className="size-4" /> Unduh
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
              deskripsi="Dokumen Word/Excel tidak dapat ditampilkan di browser. Silakan unduh untuk membukanya."
            />
          ))}
      </Modal>
    </GlassCard>
  );
}

// ───────────────────────────── Centang PUM ─────────────────────────────

function KontrolCek({
  item,
  bisaCek,
  sibuk,
  onCek,
}: {
  item: KelengkapanItem;
  bisaCek: boolean;
  sibuk: boolean;
  onCek: (status: StatusCek | null, catatan?: string) => Promise<boolean>;
}) {
  const id = useId();
  const [revisiTerbuka, setRevisiTerbuka] = useState(false);
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState('');
  const c = item.cek;
  const sesuai = c?.status === 'sesuai';
  const kosong = item.jumlah === 0 && !item.na;

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

  const oleh = c ? (
    <span className="text-fg-subtle">
      {' '}
      · {c.diperiksa_by_nama}, <span title={formatWaktu(c.diperiksa_at)}>{waktuRelatif(c.diperiksa_at)}</span>
    </span>
  ) : null;

  // Tampilan baca-saja (pengaju, pimpinan, atau setelah diteruskan ke MDK).
  if (!bisaCek) {
    if (!c) {
      return <p className="mt-3 text-xs text-fg-subtle">Belum diperiksa PUM</p>;
    }
    return c.status === 'sesuai' ? (
      <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        <CircleCheck className="size-3.5 shrink-0" /> Sesuai (dicentang PUM){oleh}
      </p>
    ) : (
      <div className="mt-3 rounded-xl bg-amber-400/15 px-3 py-2 text-xs ring-1 ring-amber-500/30">
        <p className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-200">
          <CircleX className="size-3.5 shrink-0" /> Perlu revisi{oleh}
        </p>
        <p className="mt-0.5 whitespace-pre-line text-fg">{c.catatan}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={`${id}-sesuai`}
          className={cn(
            'inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl px-3 text-[13px] font-semibold ring-1 transition select-none',
            sesuai
              ? 'bg-emerald-500 text-white ring-emerald-600 shadow-md shadow-emerald-500/25'
              : 'bg-surface/70 text-fg ring-fg/15 hover:ring-emerald-500/50 dark:bg-white/[0.04]',
            sibuk && 'pointer-events-none opacity-70',
          )}
        >
          <input
            id={`${id}-sesuai`}
            type="checkbox"
            className="peer sr-only"
            checked={sesuai}
            disabled={sibuk}
            aria-label={`${item.label} sesuai`}
            onChange={(e) => void onCek(e.target.checked ? 'sesuai' : null)}
          />
          <span
            className={cn(
              'grid size-4.5 place-items-center rounded-md ring-1 peer-focus-visible:ring-2 peer-focus-visible:ring-kuning-500',
              sesuai ? 'bg-white text-emerald-600 ring-white' : 'ring-fg/30',
            )}
            aria-hidden
          >
            {sesuai && <Check className="size-3.5" strokeWidth={3.5} />}
          </span>
          Sesuai
        </label>
        <Button
          varian="kedua"
          ukuran="sm"
          ikon={<CircleX className="size-4" />}
          onClick={bukaRevisi}
          disabled={sibuk}
          className={cn(c?.status === 'revisi' && 'ring-amber-500/50')}
          aria-label={c?.status === 'revisi' ? `Ubah catatan revisi ${item.label}` : `${item.label} perlu revisi`}
        >
          {c?.status === 'revisi' ? 'Ubah catatan revisi' : 'Perlu revisi'}
        </Button>
        {c?.status === 'revisi' && (
          <Button varian="hantu" ukuran="sm" ikon={<RotateCcw className="size-4" />} onClick={() => void onCek(null)} disabled={sibuk}>
            Batalkan tanda
          </Button>
        )}
        {c && (
          <span className="text-[11px] text-fg-subtle">
            Dicek {c.diperiksa_by_nama}, <span title={formatWaktu(c.diperiksa_at)}>{waktuRelatif(c.diperiksa_at)}</span>
          </span>
        )}
      </div>

      {kosong && !c && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          <CircleAlert className="mt-px size-3.5 shrink-0" /> Belum ada file — centang Sesuai hanya bila berkas fisik sudah diterima.
        </p>
      )}

      {c?.status === 'revisi' && !revisiTerbuka && (
        <div className="mt-2 rounded-xl bg-amber-400/15 px-3 py-2 text-xs ring-1 ring-amber-500/30">
          <p className="font-bold text-amber-800 dark:text-amber-200">Catatan revisi</p>
          <p className="mt-0.5 whitespace-pre-line text-fg">{c.catatan}</p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {revisiTerbuka && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2 rounded-xl bg-amber-400/10 p-3 ring-1 ring-amber-500/30">
              <label htmlFor={`${id}-catatan`} className="flex items-center gap-1.5 text-xs font-bold text-fg">
                <PencilLine className="size-3.5" /> Apa yang perlu direvisi pada {item.label}?
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
    </div>
  );
}

// ───────────────────────────── Baris & daftar file ─────────────────────────────

function PilihFile({
  label,
  onPilih,
  multiple = false,
  ukuran = 'sm',
}: {
  label: string;
  onPilih: (files: File[]) => void;
  multiple?: boolean;
  ukuran?: 'sm' | 'md';
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
      <Button varian="kedua" ukuran={ukuran} ikon={<CloudUpload className="size-4" />} onClick={() => ref.current?.click()}>
        {label}
      </Button>
    </>
  );
}

function BarisBerkas({
  item,
  files,
  unggahan,
  bisaKelola,
  onPilih,
  onPratinjau,
  onHapus,
  menu,
  cek,
}: {
  item: KelengkapanItem;
  files: Berkas[];
  unggahan: Unggahan[];
  bisaKelola: boolean;
  onPilih: (files: File[]) => void;
  onPratinjau: (b: Berkas) => void;
  onHapus: (b: Berkas) => void;
  menu: ReactNode;
  cek: ReactNode;
}) {
  const [seret, setSeret] = useState(false);
  const keadaan = item.jumlah > 0 ? 'ada' : item.na ? 'na' : 'kosong';
  const onDrag = (e: DragEvent) => {
    if (!bisaKelola) return;
    e.preventDefault();
    setSeret(e.type === 'dragover' || e.type === 'dragenter');
  };

  return (
    <motion.div
      layout="position"
      data-berkas={item.jenis}
      data-keadaan={keadaan}
      data-cek={item.cek?.status ?? 'belum'}
      onDragEnter={onDrag}
      onDragOver={onDrag}
      onDragLeave={onDrag}
      onDrop={(e) => {
        if (!bisaKelola) return;
        e.preventDefault();
        setSeret(false);
        const files = [...e.dataTransfer.files];
        if (files.length > 0) onPilih(files);
      }}
      className={cn(
        'rounded-2xl p-3.5 ring-1 transition-colors sm:p-4',
        keadaan === 'ada' && 'bg-emerald-500/[0.06] ring-emerald-500/20',
        keadaan === 'na' && 'bg-fg/[0.03] ring-fg/10',
        keadaan === 'kosong' && 'bg-amber-400/[0.07] ring-amber-500/25',
        item.cek?.status === 'sesuai' && 'ring-2 ring-emerald-500/45',
        item.cek?.status === 'revisi' && 'bg-amber-400/[0.08] ring-2 ring-amber-500/55',
        seret && 'bg-kuning-400/15 ring-2 ring-kuning-500',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-xl',
            keadaan === 'ada' && 'bg-emerald-500 text-white',
            keadaan === 'na' && 'bg-fg/10 text-fg-muted',
            keadaan === 'kosong' && 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
          )}
        >
          {keadaan === 'ada' ? (
            <CircleCheck className="size-4.5" />
          ) : keadaan === 'na' ? (
            <Ban className="size-4.5" />
          ) : (
            <CircleAlert className="size-4.5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-fg">
            {item.label} <span className="font-normal text-fg-subtle">· wajib</span>
          </p>
          <p className="text-xs text-fg-muted">
            {keadaan === 'ada'
              ? `${files.length} file terunggah`
              : keadaan === 'na'
                ? 'Ditandai tidak diperlukan oleh pengaju'
                : bisaKelola
                  ? 'Belum diunggah — klik Unggah atau seret file ke sini'
                  : 'Belum diunggah'}
          </p>
        </div>
        {bisaKelola && <PilihFile label="Unggah" onPilih={onPilih} multiple />}
        {menu}
      </div>
      <DaftarFile files={files} unggahan={unggahan} bisaKelola={bisaKelola} onPratinjau={onPratinjau} onHapus={onHapus} />
      {cek}
    </motion.div>
  );
}

function DaftarFile({
  files,
  unggahan,
  bisaKelola,
  onPratinjau,
  onHapus,
}: {
  files: Berkas[];
  unggahan: Unggahan[];
  bisaKelola: boolean;
  onPratinjau: (b: Berkas) => void;
  onHapus: (b: Berkas) => void;
}) {
  if (files.length === 0 && unggahan.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      <AnimatePresence initial={false}>
        {files.map((b) => (
          <motion.li
            key={b.id}
            layout
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className="flex items-center gap-2.5 rounded-xl bg-surface/70 px-2.5 py-2 ring-1 ring-fg/[0.06] dark:bg-white/[0.04]"
          >
            <IkonFile mime={b.mime} />
            <button
              type="button"
              onClick={() => onPratinjau(b)}
              className="min-w-0 flex-1 text-left"
              title={`Diunggah ${formatWaktu(b.created_at)} oleh ${b.uploaded_by_nama}`}
            >
              <p className="truncate text-[13px] font-semibold text-fg hover:underline">
                {b.jenis === 'lainnya' && b.nama_berkas ? `${b.nama_berkas} — ` : ''}
                {b.nama_asli}
              </p>
              <p className="truncate text-[11px] text-fg-muted">
                {formatUkuran(b.ukuran)} · {b.uploaded_by_nama} · {waktuRelatif(b.created_at)}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onPratinjau(b)}
              className="grid size-8 place-items-center rounded-lg text-fg-muted transition hover:bg-fg/[0.06] hover:text-fg"
              aria-label={`Lihat ${b.nama_asli}`}
              title="Lihat"
            >
              <Eye className="size-4" />
            </button>
            <a
              href={urlBerkas(b.id, true)}
              className="grid size-8 place-items-center rounded-lg text-fg-muted transition hover:bg-fg/[0.06] hover:text-fg"
              aria-label={`Unduh ${b.nama_asli}`}
              title="Unduh"
            >
              <Download className="size-4" />
            </a>
            {bisaKelola && (
              <button
                type="button"
                onClick={() => onHapus(b)}
                className="grid size-8 place-items-center rounded-lg text-fg-muted transition hover:bg-red-500/10 hover:text-red-600"
                aria-label={`Hapus ${b.nama_asli}`}
                title="Hapus"
              >
                <Trash className="size-4" />
              </button>
            )}
          </motion.li>
        ))}
        {unggahan.map((u) => (
          <motion.li
            key={`u${u.kunci}`}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl bg-kuning-400/10 px-3 py-2 ring-1 ring-kuning-500/30"
          >
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="truncate font-semibold text-fg">{u.nama}</span>
              <span className="angka shrink-0 font-bold text-fg-muted">{u.persen}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fg/10">
              <motion.div
                className="h-full rounded-full bg-linear-to-r from-kuning-400 to-kuning-600"
                animate={{ width: `${u.persen}%` }}
                transition={{ ease: 'easeOut', duration: 0.2 }}
              />
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
