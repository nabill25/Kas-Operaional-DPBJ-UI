import { ArrowLeft, Check, FileCheck, Paperclip, PencilLine, Shapes } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { BERKAS_WAJIB, JENIS_BERKAS_LABEL, KATEGORI_INFO, KATEGORI_LIST, type Kategori } from '../../shared/constants';
import { PengajuanForm } from '../components/pengajuan/PengajuanForm';
import { IKON_KATEGORI, WARNA_KATEGORI } from '../components/ui/Badge';
import { GlassCard } from '../components/ui/GlassCard';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/cn';
import { useSimpanPengajuan } from '../lib/queries';

const LANGKAH = [
  { judul: 'Pilih kategori', ikon: Shapes },
  { judul: 'Isi data kegiatan', ikon: PencilLine },
  { judul: 'Unggah berkas & ajukan', ikon: Paperclip },
];

function Langkah({ aktif }: { aktif: number }) {
  return (
    <ol className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
      {LANGKAH.map((l, i) => {
        const selesai = i < aktif;
        const sekarang = i === aktif;
        return (
          <li key={l.judul} className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                'flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-xs font-bold transition-colors',
                sekarang && 'glass text-fg',
                selesai && 'text-emerald-700 dark:text-emerald-300',
                !sekarang && !selesai && 'text-fg-subtle',
              )}
            >
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full text-[11px]',
                  sekarang && 'bg-linear-to-b from-kuning-300 to-kuning-500 text-navy-950',
                  selesai && 'bg-emerald-500 text-white',
                  !sekarang && !selesai && 'bg-fg/10',
                )}
              >
                {selesai ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              {l.judul}
            </span>
            {i < LANGKAH.length - 1 && <span className="h-px w-6 bg-line sm:w-10" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

export default function PengajuanBaruPage() {
  const navigate = useNavigate();
  const simpan = useSimpanPengajuan();
  const [kategori, setKategori] = useState<Kategori | null>(null);

  return (
    <div>
      <PageHeader
        judul={kategori ? `Pengajuan ${KATEGORI_INFO[kategori].label}` : 'Buat Pengajuan Baru'}
        deskripsi={
          kategori
            ? 'Simpan sebagai draft terlebih dahulu, lalu lengkapi berkas dan ajukan ke PUM.'
            : 'Pilih jenis pengajuan sesuai kegiatan yang akan dicatat.'
        }
        kembali={{ ke: '/pengajuan', label: 'Daftar pengajuan' }}
      />
      <Langkah aktif={kategori ? 1 : 0} />

      <AnimatePresence mode="wait" initial={false}>
        {!kategori ? (
          <motion.div
            key="pilih"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            {KATEGORI_LIST.map((k, i) => {
              const Ikon = IKON_KATEGORI[k];
              const info = KATEGORI_INFO[k];
              return (
                <GlassCard
                  key={k}
                  interaktif
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="cursor-pointer p-6"
                  role="button"
                  tabIndex={0}
                  onClick={() => setKategori(k)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setKategori(k);
                    }
                  }}
                  aria-label={`Pilih ${info.label}`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className="grid size-14 place-items-center rounded-2xl text-white shadow-lg"
                      style={{ background: WARNA_KATEGORI[k] }}
                    >
                      <Ikon className="size-7" />
                    </span>
                    <span className="rounded-full bg-fg/[0.06] px-2.5 py-1 text-[11px] font-bold tracking-wide text-fg-muted uppercase">
                      {info.jenis}
                    </span>
                  </div>
                  <h2 className="mt-5 text-lg font-extrabold tracking-[-0.02em] text-fg">{info.label}</h2>
                  <p className="mt-1 text-sm text-fg-muted">{info.deskripsi}</p>
                  <div className="mt-5 border-t border-line pt-4">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-fg-subtle uppercase">
                      <FileCheck className="size-3.5" /> Berkas wajib
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {BERKAS_WAJIB[k].map((j) => (
                        <li key={j} className="rounded-lg bg-fg/[0.05] px-2 py-1 text-xs font-medium text-fg">
                          {JENIS_BERKAS_LABEL[j]}
                        </li>
                      ))}
                    </ul>
                  </div>
                </GlassCard>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key={`form-${kategori}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.3 }}
          >
            <button
              type="button"
              onClick={() => setKategori(null)}
              className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-muted transition hover:text-fg"
            >
              <ArrowLeft className="size-4" /> Ganti kategori
            </button>
            <PengajuanForm
              kategori={kategori}
              teksSimpan="Simpan draft"
              onBatal={() => navigate('/pengajuan')}
              onSimpan={async (data) => {
                const d = await simpan.mutateAsync({ data });
                toast.success(`Draft ${d.kode} tersimpan`, {
                  description: 'Lanjutkan dengan mengunggah berkas, lalu ajukan ke PUM.',
                });
                navigate(`/pengajuan/${d.id}`, { state: { baru: true } });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
