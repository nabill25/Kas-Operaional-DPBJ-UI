import { CalendarRange, Info, MapPin, NotebookPen, Plus, Save, Trash, Users, Wallet } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  JENIS_TRANSPORT_LABEL,
  JENIS_UANG_LABEL,
  KATEGORI_INFO,
  MAX_PESERTA_TRANSPORT,
  type JenisTransport,
  type JenisUang,
  type Kategori,
  type Mekanisme,
} from '../../../shared/constants';
import { formatAngka, formatRupiah, lamaHari } from '../../../shared/format';
import type { PengajuanDetail, PengajuanInput } from '../../../shared/types';
import { isTanggalValid, validatePengajuan } from '../../../shared/validation';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { Button } from '../ui/Button';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Field, Input, Textarea } from '../ui/Field';
import { GlassCard, JudulKartu } from '../ui/GlassCard';
import { PegawaiPicker } from '../ui/PegawaiPicker';
import { Segmented } from '../ui/Segmented';

interface BarisPeserta {
  kunci: string;
  pegawai_id: number | null;
  nilai: number | null;
}

interface StateForm {
  nama_kegiatan: string;
  tanggal_kegiatan: string;
  tanggal_selesai: string;
  lokasi_tujuan: string;
  mekanisme: Mekanisme | '';
  jenis_uang: JenisUang | '';
  jenis_transport: JenisTransport | '';
  jumlah_orang: string;
  total: number | null;
  uang_siapa_id: number | null;
  catatan: string;
  peserta: BarisPeserta[];
}

let nomorKunci = 0;
const kunciBaru = () => `p${++nomorKunci}`;

function stateAwal(kategori: Kategori, d?: PengajuanDetail): StateForm {
  if (d) {
    return {
      nama_kegiatan: d.nama_kegiatan,
      tanggal_kegiatan: d.tanggal_kegiatan,
      tanggal_selesai: d.tanggal_selesai ?? '',
      lokasi_tujuan: d.lokasi_tujuan ?? '',
      mekanisme: d.mekanisme,
      jenis_uang: d.jenis_uang ?? '',
      jenis_transport: d.jenis_transport ?? '',
      jumlah_orang: d.kategori === 'konsumsi' ? String(d.jumlah_orang) : '',
      total: d.kategori === 'konsumsi' ? d.total : null,
      uang_siapa_id: d.uang_siapa_id,
      catatan: d.catatan ?? '',
      peserta:
        d.peserta.length > 0
          ? d.peserta.map((p) => ({ kunci: kunciBaru(), pegawai_id: p.pegawai_id, nilai: p.nilai }))
          : [{ kunci: kunciBaru(), pegawai_id: null, nilai: null }],
    };
  }
  return {
    nama_kegiatan: '',
    tanggal_kegiatan: '',
    tanggal_selesai: '',
    lokasi_tujuan: '',
    mekanisme: '',
    jenis_uang: '',
    jenis_transport: '',
    jumlah_orang: '',
    total: null,
    uang_siapa_id: null,
    catatan: '',
    peserta: kategori === 'konsumsi' ? [] : [{ kunci: kunciBaru(), pegawai_id: null, nilai: null }],
  };
}

function keInput(kategori: Kategori, s: StateForm): PengajuanInput {
  const dasar = {
    kategori,
    nama_kegiatan: s.nama_kegiatan,
    tanggal_kegiatan: s.tanggal_kegiatan,
    mekanisme: s.mekanisme as Mekanisme,
    catatan: s.catatan,
  };
  if (kategori === 'konsumsi') {
    return {
      ...dasar,
      jumlah_orang: s.jumlah_orang === '' ? null : Number(s.jumlah_orang),
      total: s.total,
      uang_siapa_id: s.uang_siapa_id,
    };
  }
  // Nilai kosong dikirim sebagai null agar validasi memberi pesan "wajib diisi" (bukan "harus > 0").
  // Setelah lolos validasi, keduanya dijamin berupa bilangan.
  const peserta = s.peserta.map((p) => ({ pegawai_id: p.pegawai_id as number, nilai: p.nilai as number }));
  if (kategori === 'rumah_tangga') return { ...dasar, lokasi_tujuan: s.lokasi_tujuan, peserta };
  return {
    ...dasar,
    lokasi_tujuan: s.lokasi_tujuan,
    peserta,
    tanggal_selesai: s.tanggal_selesai,
    jenis_uang: (s.jenis_uang || null) as JenisUang | null,
    jenis_transport: (s.jenis_transport || null) as JenisTransport | null,
  };
}

interface PengajuanFormProps {
  kategori: Kategori;
  awal?: PengajuanDetail;
  teksSimpan: string;
  onSimpan: (data: PengajuanInput) => Promise<void>;
  onBatal: () => void;
}

export function PengajuanForm({ kategori, awal, teksSimpan, onSimpan, onBatal }: PengajuanFormProps) {
  const [s, setS] = useState<StateForm>(() => stateAwal(kategori, awal));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [memuat, setMemuat] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const transport = kategori !== 'konsumsi';
  const info = KATEGORI_INFO[kategori];

  const ubah = <K extends keyof StateForm>(k: K, v: StateForm[K]) => {
    setS((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => {
      if (!(k in prev)) return prev;
      const sisa = { ...prev };
      delete sisa[k];
      return sisa;
    });
  };

  const ubahPeserta = (kunci: string, perubahan: Partial<BarisPeserta>) => {
    setS((prev) => ({ ...prev, peserta: prev.peserta.map((p) => (p.kunci === kunci ? { ...p, ...perubahan } : p)) }));
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith('peserta'))));
  };

  const total = transport ? s.peserta.reduce((a, p) => a + (p.nilai ?? 0), 0) : (s.total ?? 0);
  const jumlahOrangKonsumsi = Number(s.jumlah_orang) || 0;
  const lama =
    kategori === 'perjadin' && isTanggalValid(s.tanggal_kegiatan) && isTanggalValid(s.tanggal_selesai) && s.tanggal_selesai >= s.tanggal_kegiatan
      ? lamaHari(s.tanggal_kegiatan, s.tanggal_selesai)
      : null;
  const dipilih = useMemo(() => s.peserta.map((p) => p.pegawai_id).filter((v): v is number => v !== null), [s.peserta]);

  const fokusErrorPertama = (errs: Record<string, string>) => {
    const kunci = Object.keys(errs)[0];
    if (!kunci) return;
    const id = kunci.startsWith('peserta.') ? kunci.replace(/\./g, '-') : kunci;
    const el =
      formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`) ??
      formRef.current?.querySelector<HTMLElement>(`[data-field="${kunci}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el && 'focus' in el) setTimeout(() => el.focus({ preventScroll: true }), 300);
  };

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const data = keInput(kategori, s);
    const h = validatePengajuan(data);
    if (!h.ok) {
      setErrors(h.errors);
      fokusErrorPertama(h.errors);
      toast.error('Periksa kembali isian yang ditandai merah');
      return;
    }
    setMemuat(true);
    try {
      await onSimpan(data);
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.errors).length > 0) {
          setErrors(err.errors);
          fokusErrorPertama(err.errors);
        }
        toast.error(err.message);
      } else {
        toast.error('Gagal menyimpan pengajuan');
      }
    } finally {
      setMemuat(false);
    }
  };

  const kartu = (i: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.05 + i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <form ref={formRef} onSubmit={kirim} noValidate className="space-y-5 pb-28">
      <GlassCard className="p-5 sm:p-6" {...kartu(0)}>
        <JudulKartu
          ikon={<NotebookPen className="size-4.5" />}
          judul="Informasi kegiatan"
          deskripsi={`${info.label} — isi sesuai dokumen kegiatan`}
        />
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama kegiatan" htmlFor="nama_kegiatan" error={errors.nama_kegiatan} wajib className="sm:col-span-2">
            <Input
              id="nama_kegiatan"
              value={s.nama_kegiatan}
              invalid={!!errors.nama_kegiatan}
              maxLength={200}
              placeholder={kategori === 'konsumsi' ? 'mis. Rapat Koordinasi Rencana Pengadaan' : 'mis. Pengantaran Dokumen Kontrak'}
              onChange={(e) => ubah('nama_kegiatan', e.target.value)}
            />
          </Field>

          {kategori === 'perjadin' ? (
            <>
              <Field label="Lama kegiatan — dari" htmlFor="tanggal_kegiatan" error={errors.tanggal_kegiatan} wajib>
                <Input
                  id="tanggal_kegiatan"
                  type="date"
                  value={s.tanggal_kegiatan}
                  invalid={!!errors.tanggal_kegiatan}
                  onChange={(e) => ubah('tanggal_kegiatan', e.target.value)}
                />
              </Field>
              <Field
                label="Sampai"
                htmlFor="tanggal_selesai"
                error={errors.tanggal_selesai}
                wajib
                hint={
                  lama ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-fg">
                      <CalendarRange className="size-3.5" /> Lama kegiatan {lama} hari
                    </span>
                  ) : undefined
                }
              >
                <Input
                  id="tanggal_selesai"
                  type="date"
                  value={s.tanggal_selesai}
                  min={s.tanggal_kegiatan || undefined}
                  invalid={!!errors.tanggal_selesai}
                  onChange={(e) => ubah('tanggal_selesai', e.target.value)}
                />
              </Field>
            </>
          ) : (
            <Field label="Tanggal kegiatan" htmlFor="tanggal_kegiatan" error={errors.tanggal_kegiatan} wajib>
              <Input
                id="tanggal_kegiatan"
                type="date"
                value={s.tanggal_kegiatan}
                invalid={!!errors.tanggal_kegiatan}
                onChange={(e) => ubah('tanggal_kegiatan', e.target.value)}
              />
            </Field>
          )}

          {transport && (
            <Field
              label="Lokasi tujuan"
              htmlFor="lokasi_tujuan"
              error={errors.lokasi_tujuan}
              wajib
              className={kategori === 'perjadin' ? 'sm:col-span-2' : undefined}
            >
              <div className="relative">
                <MapPin className="pointer-events-none absolute top-1/2 z-10 left-3.5 size-4 -translate-y-1/2 text-fg-muted" />
                <Input
                  id="lokasi_tujuan"
                  className="pl-10"
                  value={s.lokasi_tujuan}
                  invalid={!!errors.lokasi_tujuan}
                  maxLength={200}
                  placeholder={kategori === 'perjadin' ? 'mis. Bandung' : 'mis. Gedung Rektorat UI, Depok'}
                  onChange={(e) => ubah('lokasi_tujuan', e.target.value)}
                />
              </div>
            </Field>
          )}

          <Field label="Mekanisme" htmlFor="mekanisme" error={errors.mekanisme} wajib>
            <Segmented
              id="mekanisme"
              label="Mekanisme"
              layoutId="seg-mekanisme"
              penuh
              invalid={!!errors.mekanisme}
              value={s.mekanisme}
              onChange={(v) => ubah('mekanisme', v)}
              opsi={[
                { value: 'KO', label: 'KO' },
                { value: 'LS', label: 'LS' },
              ]}
            />
          </Field>

          {kategori === 'perjadin' && (
            <>
              <Field label="Jenis uang" htmlFor="jenis_uang" error={errors.jenis_uang} wajib>
                <Segmented
                  id="jenis_uang"
                  label="Jenis uang"
                  layoutId="seg-jenis-uang"
                  penuh
                  invalid={!!errors.jenis_uang}
                  value={s.jenis_uang}
                  onChange={(v) => ubah('jenis_uang', v)}
                  opsi={(Object.keys(JENIS_UANG_LABEL) as JenisUang[]).map((k) => ({ value: k, label: JENIS_UANG_LABEL[k] }))}
                />
              </Field>
              <Field label="Jenis transport" htmlFor="jenis_transport" error={errors.jenis_transport} wajib>
                <Segmented
                  id="jenis_transport"
                  label="Jenis transport"
                  layoutId="seg-jenis-transport"
                  penuh
                  invalid={!!errors.jenis_transport}
                  value={s.jenis_transport}
                  onChange={(v) => ubah('jenis_transport', v)}
                  opsi={(Object.keys(JENIS_TRANSPORT_LABEL) as JenisTransport[]).map((k) => ({
                    value: k,
                    label: JENIS_TRANSPORT_LABEL[k],
                  }))}
                />
              </Field>
            </>
          )}
        </div>
      </GlassCard>

      {kategori === 'konsumsi' ? (
        <GlassCard className="p-5 sm:p-6" {...kartu(1)}>
          <JudulKartu ikon={<Wallet className="size-4.5" />} judul="Rincian konsumsi" deskripsi="Peserta rapat dan uang yang digunakan" />
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Jumlah orang" htmlFor="jumlah_orang" error={errors.jumlah_orang} wajib>
              <div className="relative">
                <Users className="pointer-events-none absolute top-1/2 z-10 left-3.5 size-4 -translate-y-1/2 text-fg-muted" />
                <Input
                  id="jumlah_orang"
                  inputMode="numeric"
                  className="angka pl-10"
                  value={s.jumlah_orang}
                  invalid={!!errors.jumlah_orang}
                  placeholder="0"
                  onChange={(e) => ubah('jumlah_orang', e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </div>
            </Field>
            <Field label="Jumlah uang yang digunakan" htmlFor="total" error={errors.total} wajib>
              <CurrencyInput id="total" value={s.total} invalid={!!errors.total} onChange={(v) => ubah('total', v)} />
            </Field>
            <Field
              label="Uang siapa"
              htmlFor="uang_siapa_id"
              error={errors.uang_siapa_id}
              wajib
              hint="Pegawai yang uangnya dipakai — tercatat di rekap per orang"
              className="sm:col-span-2"
            >
              <PegawaiPicker
                id="uang_siapa_id"
                value={s.uang_siapa_id}
                invalid={!!errors.uang_siapa_id}
                onChange={(id) => ubah('uang_siapa_id', id)}
              />
            </Field>
          </div>
          {jumlahOrangKonsumsi > 0 && (s.total ?? 0) > 0 && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-navy-900/[0.05] px-3 py-2 text-xs text-fg-muted ring-1 ring-fg/[0.06] dark:bg-white/[0.05]"
            >
              <Info className="size-3.5" aria-hidden />
              Rata-rata <span className="font-bold text-fg">{formatRupiah(Math.round((s.total ?? 0) / jumlahOrangKonsumsi))}</span>{' '}
              per orang
            </motion.p>
          )}
        </GlassCard>
      ) : (
        <GlassCard className="p-5 sm:p-6" {...kartu(1)}>
          <JudulKartu
            ikon={<Users className="size-4.5" />}
            judul="Penerima & nilai uang"
            deskripsi={`Setiap orang tercatat terpisah untuk rekap per orang · maks. ${MAX_PESERTA_TRANSPORT} orang`}
            aksi={
              <span className="rounded-full bg-fg/[0.06] px-2.5 py-1 text-xs font-bold text-fg-muted">
                {s.peserta.length}/{MAX_PESERTA_TRANSPORT} orang
              </span>
            }
          />
          <div className="mt-5 space-y-3" data-field="peserta">
            <AnimatePresence initial={false}>
              {s.peserta.map((p, i) => (
                <motion.div
                  key={p.kunci}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="grid grid-cols-1 items-start gap-3 rounded-2xl bg-fg/[0.03] p-3 ring-1 ring-fg/[0.06] sm:grid-cols-[2rem_1fr_13rem_2.5rem] sm:p-4">
                    <span className="hidden size-8 place-items-center rounded-full bg-navy-900 text-xs font-bold text-kuning-300 sm:mt-7 sm:grid dark:bg-kuning-400 dark:text-navy-950">
                      {i + 1}
                    </span>
                    <Field label={`Nama orang ${i + 1}`} htmlFor={`peserta-${i}-pegawai_id`} error={errors[`peserta.${i}.pegawai_id`]} wajib>
                      <PegawaiPicker
                        id={`peserta-${i}-pegawai_id`}
                        value={p.pegawai_id}
                        kecuali={dipilih.filter((x) => x !== p.pegawai_id)}
                        invalid={!!errors[`peserta.${i}.pegawai_id`]}
                        onChange={(id) => ubahPeserta(p.kunci, { pegawai_id: id })}
                      />
                    </Field>
                    <Field label="Nilai uang" htmlFor={`peserta-${i}-nilai`} error={errors[`peserta.${i}.nilai`]} wajib>
                      <CurrencyInput
                        id={`peserta-${i}-nilai`}
                        value={p.nilai}
                        invalid={!!errors[`peserta.${i}.nilai`]}
                        onChange={(v) => ubahPeserta(p.kunci, { nilai: v })}
                      />
                    </Field>
                    <Button
                      varian="hantu"
                      ukuran="ikon"
                      className="sm:mt-6.5"
                      disabled={s.peserta.length <= 1}
                      onClick={() => setS((prev) => ({ ...prev, peserta: prev.peserta.filter((x) => x.kunci !== p.kunci) }))}
                      aria-label={`Hapus orang ${i + 1}`}
                      title="Hapus orang"
                    >
                      <Trash className="size-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {errors.peserta && (
              <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                {errors.peserta}
              </p>
            )}
            <Button
              varian="kedua"
              ukuran="sm"
              ikon={<Plus className="size-4" />}
              disabled={s.peserta.length >= MAX_PESERTA_TRANSPORT}
              onClick={() => setS((prev) => ({ ...prev, peserta: [...prev.peserta, { kunci: kunciBaru(), pegawai_id: null, nilai: null }] }))}
            >
              {s.peserta.length >= MAX_PESERTA_TRANSPORT ? `Maksimal ${MAX_PESERTA_TRANSPORT} orang` : 'Tambah orang'}
            </Button>
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-5 sm:p-6" {...kartu(2)}>
        <Field label="Catatan (opsional)" htmlFor="catatan" error={errors.catatan} hint={`${s.catatan.length}/1000 karakter`}>
          <Textarea
            id="catatan"
            rows={3}
            maxLength={1000}
            value={s.catatan}
            invalid={!!errors.catatan}
            placeholder="Keterangan tambahan untuk PUM atau arsip…"
            onChange={(e) => ubah('catatan', e.target.value)}
          />
        </Field>
      </GlassCard>

      {/* Bilah aksi melayang */}
      <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 sm:px-6 lg:left-[288px] lg:px-8">
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 28 }}
          className="glass-strong mx-auto flex max-w-[1376px] items-center gap-3 rounded-[22px] px-4 py-3 shadow-2xl sm:px-5"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-wider text-fg-muted uppercase">
              Total pengajuan{transport ? ` · ${s.peserta.length} orang` : ''}
            </p>
            <p className={cn('truncate text-lg font-extrabold tracking-[-0.02em] text-fg sm:text-xl', total === 0 && 'text-fg-subtle')}>
              Rp <AnimatedNumber value={total} format={formatAngka} />
            </p>
          </div>
          <Button varian="kedua" onClick={onBatal} disabled={memuat} className="hidden sm:inline-flex">
            Batal
          </Button>
          <Button type="submit" memuat={memuat} ikon={<Save className="size-4" />}>
            {teksSimpan}
          </Button>
        </motion.div>
      </div>
    </form>
  );
}
