import {
  CakeSlice,
  CalendarRange,
  Info,
  Landmark,
  MapPin,
  NotebookPen,
  Plus,
  Save,
  Trash,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  CATATAN_BIAYA_TRANSFER,
  JENIS_KONSUMSI_LABEL,
  JENIS_KONSUMSI_LIST,
  JENIS_TRANSPORT_LABEL,
  isBankMandiri,
  modelPeserta,
  type JenisKonsumsi,
  type JenisTransport,
  type Mekanisme,
  type ModelForm,
} from '../../../shared/constants';
import { formatAngka, formatRupiah, lamaHari } from '../../../shared/format';
import { maksPeserta } from '../../../shared/konfig';
import type { JenisPengajuan, Pegawai, PengajuanDetail, PengajuanInput } from '../../../shared/types';
import { isTanggalValid, validatePengajuan } from '../../../shared/validation';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useBank, usePegawai } from '../../lib/queries';
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
  /** Rumah Tangga */
  nilai: number | null;
  /** Perjadin (minimal salah satu diisi) */
  uang_harian: number | null;
  uang_transport: number | null;
}

const barisKosong = (): BarisPeserta => ({ kunci: kunciBaru(), pegawai_id: null, nilai: null, uang_harian: null, uang_transport: null });

/** Ikon tiap jenis konsumsi (kudapan, makan siang, atau keduanya). */
const IKON_KONSUMSI: Record<JenisKonsumsi, LucideIcon[]> = {
  kudapan: [CakeSlice],
  makan_siang: [UtensilsCrossed],
  kudapan_makan_siang: [CakeSlice, UtensilsCrossed],
};

interface StateForm {
  nama_kegiatan: string;
  tanggal_kegiatan: string;
  tanggal_selesai: string;
  lokasi_tujuan: string;
  mekanisme: Mekanisme | '';
  jenis_transport: JenisTransport | '';
  jenis_konsumsi: JenisKonsumsi | '';
  jumlah_orang: string;
  total: number | null;
  uang_siapa_id: number | null;
  rekening_bank: string;
  rekening_nomor: string;
  catatan: string;
  peserta: BarisPeserta[];
}

let nomorKunci = 0;
function kunciBaru() {
  return `p${++nomorKunci}`;
}

function stateAwal(model: ModelForm, d?: PengajuanDetail): StateForm {
  if (d) {
    return {
      nama_kegiatan: d.nama_kegiatan,
      tanggal_kegiatan: d.tanggal_kegiatan,
      tanggal_selesai: d.tanggal_selesai ?? '',
      lokasi_tujuan: d.lokasi_tujuan ?? '',
      mekanisme: d.mekanisme,
      jenis_transport: d.jenis_transport ?? '',
      jenis_konsumsi: d.jenis_konsumsi ?? '',
      jumlah_orang: model === 'konsumsi' ? String(d.jumlah_orang) : '',
      total: model === 'konsumsi' ? d.total : null,
      uang_siapa_id: d.uang_siapa_id,
      rekening_bank: d.rekening_bank ?? '',
      rekening_nomor: d.rekening_nomor ?? '',
      catatan: d.catatan ?? '',
      peserta:
        d.peserta.length > 0
          ? d.peserta.map((p) => {
              // Perjadin lama tanpa rincian: nilai masuk ke kolom sesuai jenis uang yang dulu dipilih.
              const lama = model === 'perjadin' && p.uang_harian === null && p.uang_transport === null;
              return {
                kunci: kunciBaru(),
                pegawai_id: p.pegawai_id,
                nilai: p.nilai,
                uang_harian: lama ? (d.jenis_uang === 'uang_harian' ? p.nilai : null) : p.uang_harian || null,
                uang_transport: lama ? (d.jenis_uang === 'uang_harian' ? null : p.nilai) : p.uang_transport || null,
              };
            })
          : [barisKosong()],
    };
  }
  return {
    nama_kegiatan: '',
    tanggal_kegiatan: '',
    tanggal_selesai: '',
    lokasi_tujuan: '',
    mekanisme: '',
    jenis_transport: '',
    jenis_konsumsi: '',
    jumlah_orang: '',
    total: null,
    uang_siapa_id: null,
    rekening_bank: '',
    rekening_nomor: '',
    catatan: '',
    peserta: modelPeserta(model) ? [barisKosong()] : [],
  };
}

/** Nilai satu orang: Perjadin = uang harian + uang transport; model lain = nilai uang. */
function nilaiBaris(model: ModelForm, p: BarisPeserta): number {
  return model === 'perjadin' ? (p.uang_harian ?? 0) + (p.uang_transport ?? 0) : (p.nilai ?? 0);
}

function keInput(jenis: JenisPengajuan, s: StateForm): PengajuanInput {
  const model = jenis.model;
  const dasar = {
    kategori: jenis.kode,
    nama_kegiatan: s.nama_kegiatan,
    tanggal_kegiatan: s.tanggal_kegiatan,
    mekanisme: s.mekanisme as Mekanisme,
    catatan: s.catatan,
  };
  if (model === 'konsumsi') {
    return {
      ...dasar,
      jenis_konsumsi: (s.jenis_konsumsi || null) as JenisKonsumsi | null,
      jumlah_orang: s.jumlah_orang === '' ? null : Number(s.jumlah_orang),
      total: s.total,
      uang_siapa_id: s.uang_siapa_id,
      rekening_bank: s.rekening_bank,
      rekening_nomor: s.rekening_nomor,
    };
  }
  if (model === 'rumah_tangga' || model === 'umum') {
    // Nilai kosong dikirim sebagai null agar validasi memberi pesan "wajib diisi" (bukan "harus > 0").
    // Setelah lolos validasi, keduanya dijamin berupa bilangan.
    const peserta = s.peserta.map((p) => ({ pegawai_id: p.pegawai_id as number, nilai: p.nilai as number }));
    return model === 'umum'
      ? { ...dasar, peserta, tanggal_selesai: s.tanggal_selesai || null }
      : { ...dasar, lokasi_tujuan: s.lokasi_tujuan, peserta };
  }
  // Perjadin: nilai per orang dihitung server dari uang harian + uang transport.
  const peserta = s.peserta.map((p) => ({
    pegawai_id: p.pegawai_id as number,
    nilai: nilaiBaris(model, p),
    uang_harian: p.uang_harian,
    uang_transport: p.uang_transport,
  }));
  return {
    ...dasar,
    lokasi_tujuan: s.lokasi_tujuan,
    peserta,
    tanggal_selesai: s.tanggal_selesai,
    jenis_transport: (s.jenis_transport || null) as JenisTransport | null,
  };
}

interface PengajuanFormProps {
  /** Jenis pengajuan (master) — model form-nya menentukan isian. */
  jenis: JenisPengajuan;
  awal?: PengajuanDetail;
  teksSimpan: string;
  onSimpan: (data: PengajuanInput) => Promise<void>;
  onBatal: () => void;
}

export function PengajuanForm({ jenis, awal, teksSimpan, onSimpan, onBatal }: PengajuanFormProps) {
  const model = jenis.model;
  const [s, setS] = useState<StateForm>(() => stateAwal(model, awal));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [memuat, setMemuat] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const transport = modelPeserta(model);
  const maks = maksPeserta(jenis);
  const { data: daftarBank = [] } = useBank();
  const { data: daftarPegawai = [] } = usePegawai();
  // Rekening terakhir yang diisi otomatis dari data pegawai (boleh ditimpa saat "uang siapa" diganti).
  const [rekOtomatis, setRekOtomatis] = useState<{ bank: string; nomor: string } | null>(null);

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

  const total = transport ? s.peserta.reduce((a, p) => a + nilaiBaris(model, p), 0) : (s.total ?? 0);
  const bankBukanMandiri = s.rekening_bank.trim() !== '' && !isBankMandiri(s.rekening_bank);
  const jumlahOrangKonsumsi = Number(s.jumlah_orang) || 0;
  const pakaiRentang = model === 'perjadin' || model === 'umum';
  const lama =
    pakaiRentang && isTanggalValid(s.tanggal_kegiatan) && isTanggalValid(s.tanggal_selesai) && s.tanggal_selesai >= s.tanggal_kegiatan
      ? lamaHari(s.tanggal_kegiatan, s.tanggal_selesai)
      : null;
  const pemilikUang = daftarPegawai.find((p) => p.id === s.uang_siapa_id);
  const rekPegawai =
    pemilikUang?.rekening_bank && pemilikUang.rekening_nomor ? { bank: pemilikUang.rekening_bank, nomor: pemilikUang.rekening_nomor } : null;
  const rekSamaPegawai =
    !!rekPegawai && s.rekening_bank.trim() === rekPegawai.bank && s.rekening_nomor.replace(/[\s.-]/g, '') === rekPegawai.nomor;

  /** Ganti "uang siapa": rekening ikut diisi dari data pegawai bila masih kosong atau sebelumnya diisi otomatis. */
  const pilihUangSiapa = (id: number, pg: Pegawai) => {
    const rek = pg.rekening_bank && pg.rekening_nomor ? { bank: pg.rekening_bank, nomor: pg.rekening_nomor } : null;
    const kosong = !s.rekening_bank.trim() && !s.rekening_nomor.trim();
    const dariOtomatis = !!rekOtomatis && s.rekening_bank === rekOtomatis.bank && s.rekening_nomor === rekOtomatis.nomor;
    ubah('uang_siapa_id', id);
    if (kosong || dariOtomatis) {
      setS((prev) => ({ ...prev, rekening_bank: rek?.bank ?? '', rekening_nomor: rek?.nomor ?? '' }));
      setErrors((prev) => {
        const sisa = { ...prev };
        delete sisa.rekening_bank;
        delete sisa.rekening_nomor;
        return sisa;
      });
      setRekOtomatis(rek);
    }
  };

  const pakaiRekPegawai = () => {
    if (!rekPegawai) return;
    ubah('rekening_bank', rekPegawai.bank);
    ubah('rekening_nomor', rekPegawai.nomor);
    setRekOtomatis(rekPegawai);
  };
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
    const data = keInput(jenis, s);
    const h = validatePengajuan(data, jenis);
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
          deskripsi={`${jenis.label} — isi sesuai dokumen kegiatan`}
        />
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama kegiatan" htmlFor="nama_kegiatan" error={errors.nama_kegiatan} wajib className="sm:col-span-2">
            <Input
              id="nama_kegiatan"
              value={s.nama_kegiatan}
              invalid={!!errors.nama_kegiatan}
              maxLength={200}
              placeholder={
                model === 'konsumsi'
                  ? 'mis. Rapat Koordinasi Rencana Pengadaan'
                  : model === 'umum'
                    ? `mis. ${jenis.label} bulan September`
                    : 'mis. Pengantaran Dokumen Kontrak'
              }
              onChange={(e) => ubah('nama_kegiatan', e.target.value)}
            />
          </Field>

          {pakaiRentang ? (
            <>
              <Field
                label={model === 'perjadin' ? 'Lama kegiatan — dari' : 'Tanggal / mulai periode'}
                htmlFor="tanggal_kegiatan"
                error={errors.tanggal_kegiatan}
                wajib
              >
                <Input
                  id="tanggal_kegiatan"
                  type="date"
                  value={s.tanggal_kegiatan}
                  invalid={!!errors.tanggal_kegiatan}
                  onChange={(e) => ubah('tanggal_kegiatan', e.target.value)}
                />
              </Field>
              <Field
                label={model === 'perjadin' ? 'Sampai' : 'Sampai (opsional)'}
                htmlFor="tanggal_selesai"
                error={errors.tanggal_selesai}
                wajib={model === 'perjadin'}
                hint={
                  lama ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-fg">
                      <CalendarRange className="size-3.5" /> {model === 'perjadin' ? 'Lama kegiatan' : 'Periode'} {lama} hari
                    </span>
                  ) : model === 'umum' ? (
                    'Isi bila berupa periode, mis. satu bulan'
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

          {(model === 'rumah_tangga' || model === 'perjadin') && (
            <Field
              label="Lokasi tujuan"
              htmlFor="lokasi_tujuan"
              error={errors.lokasi_tujuan}
              wajib
              className={model === 'perjadin' ? 'sm:col-span-2' : undefined}
            >
              <div className="relative">
                <MapPin className="pointer-events-none absolute top-1/2 z-10 left-3.5 size-4 -translate-y-1/2 text-fg-muted" />
                <Input
                  id="lokasi_tujuan"
                  className="pl-10"
                  value={s.lokasi_tujuan}
                  invalid={!!errors.lokasi_tujuan}
                  maxLength={200}
                  placeholder={model === 'perjadin' ? 'mis. Bandung' : 'mis. Gedung Rektorat UI, Depok'}
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

          {/* Perjadin: jenis transport di samping mekanisme */}
          {model === 'perjadin' && (
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
          )}
        </div>
      </GlassCard>

      {model === 'konsumsi' ? (
        <GlassCard className="p-5 sm:p-6" {...kartu(1)}>
          <JudulKartu ikon={<Wallet className="size-4.5" />} judul="Rincian konsumsi" deskripsi="Peserta rapat dan uang yang digunakan" />
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-[13px] font-semibold text-fg">
                Jenis konsumsi <span className="text-red-500">*</span>
              </legend>
              <div
                id="jenis_konsumsi"
                tabIndex={-1}
                role="radiogroup"
                aria-label="Jenis konsumsi"
                aria-invalid={!!errors.jenis_konsumsi || undefined}
                className="grid grid-cols-3 gap-2 outline-none"
              >
                {JENIS_KONSUMSI_LIST.map((j) => {
                  const aktif = s.jenis_konsumsi === j;
                  return (
                    <label
                      key={j}
                      data-jenis-konsumsi={j}
                      className={cn(
                        'relative flex min-h-[76px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 text-center ring-1 transition',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-kuning-500',
                        aktif
                          ? 'bg-kuning-400/15 ring-2 ring-kuning-500'
                          : errors.jenis_konsumsi
                            ? 'bg-red-500/[0.04] ring-red-500/50 hover:ring-red-500/70'
                            : 'bg-fg/[0.03] ring-fg/10 hover:ring-fg/25',
                      )}
                    >
                      <input
                        type="radio"
                        name="jenis_konsumsi"
                        value={j}
                        checked={aktif}
                        onChange={() => ubah('jenis_konsumsi', j)}
                        className="sr-only"
                      />
                      <span className={cn('flex items-center gap-0.5', aktif ? 'text-kuning-800 dark:text-kuning-300' : 'text-fg-muted')} aria-hidden>
                        {IKON_KONSUMSI[j].map((Ikon, i) => (
                          <Ikon key={i} className="size-[18px]" />
                        ))}
                      </span>
                      <span className="text-[12.5px] leading-tight font-semibold text-fg sm:text-[13px]">{JENIS_KONSUMSI_LABEL[j]}</span>
                    </label>
                  );
                })}
              </div>
              {errors.jenis_konsumsi && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                  {errors.jenis_konsumsi}
                </p>
              )}
            </fieldset>
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
                onChange={pilihUangSiapa}
              />
            </Field>
            <div
              role="group"
              aria-labelledby="judul-rekening"
              data-field="rekening"
              className="rounded-2xl bg-fg/[0.03] p-3.5 ring-1 ring-fg/[0.06] sm:col-span-2 sm:p-4"
            >
              <p id="judul-rekening" className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                <Landmark className="size-4 text-fg-muted" aria-hidden />
                Rekening uang siapa
              </p>
              <p className="mt-0.5 pl-6 text-xs text-fg-subtle" data-testid="sumber-rekening">
                {rekSamaPegawai
                  ? 'Opsional — diisi otomatis dari data pegawai (boleh diubah)'
                  : pemilikUang && !rekPegawai
                    ? 'Opsional — rekening pegawai ini belum tercatat di master Pegawai'
                    : 'Opsional — tujuan pembayaran oleh PUM'}
              </p>
              {rekPegawai && !rekSamaPegawai && (
                <button
                  type="button"
                  onClick={pakaiRekPegawai}
                  className="mt-2 ml-6 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-navy-700 ring-1 ring-fg/10 transition hover:bg-fg/[0.05] dark:text-kuning-300"
                >
                  <Landmark className="size-3.5" aria-hidden /> Pakai rekening data pegawai: {rekPegawai.bank} {rekPegawai.nomor}
                </button>
              )}
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Bank" htmlFor="rekening_bank" error={errors.rekening_bank}>
                  <Input
                    id="rekening_bank"
                    list="saran-bank"
                    autoComplete="off"
                    maxLength={60}
                    value={s.rekening_bank}
                    invalid={!!errors.rekening_bank}
                    placeholder="mis. Bank Mandiri"
                    onChange={(e) => ubah('rekening_bank', e.target.value)}
                  />
                  <datalist id="saran-bank">
                    {daftarBank
                      .filter((b) => b.aktif)
                      .map((b) => (
                        <option key={b.id} value={b.nama} />
                      ))}
                  </datalist>
                </Field>
                <Field label="No. Rekening" htmlFor="rekening_nomor" error={errors.rekening_nomor}>
                  <Input
                    id="rekening_nomor"
                    inputMode="numeric"
                    autoComplete="off"
                    className="angka"
                    maxLength={34}
                    value={s.rekening_nomor}
                    invalid={!!errors.rekening_nomor}
                    placeholder="mis. 1570001234567"
                    onChange={(e) => ubah('rekening_nomor', e.target.value.replace(/[^\d\s.-]/g, ''))}
                  />
                </Field>
              </div>
              <p
                className={cn(
                  'mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs ring-1',
                  bankBukanMandiri
                    ? 'bg-amber-400/15 font-medium text-amber-900 ring-amber-500/30 dark:text-amber-100'
                    : 'bg-fg/[0.03] text-fg-muted ring-fg/[0.06]',
                )}
              >
                <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                {CATATAN_BIAYA_TRANSFER}
              </p>
            </div>
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
            deskripsi={
              model === 'perjadin'
                ? `Isi uang harian dan/atau uang transport tiap orang · maks. ${maks} orang`
                : `Setiap orang tercatat terpisah untuk rekap per orang · maks. ${maks} orang`
            }
            aksi={
              <span className="rounded-full bg-fg/[0.06] px-2.5 py-1 text-xs font-bold text-fg-muted">
                {s.peserta.length}/{maks} orang
              </span>
            }
          />
          <div className="@container mt-5 space-y-3" data-field="peserta">
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
                  {model === 'perjadin' ? (
                    <div className="flex items-start gap-3 rounded-2xl bg-fg/[0.03] p-3 ring-1 ring-fg/[0.06] sm:p-4">
                      <span className="mt-7 hidden size-8 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-bold text-kuning-300 sm:grid dark:bg-kuning-400 dark:text-navy-950">
                        {i + 1}
                      </span>
                      {/* ≥ 48rem: satu baris (nama | uang harian | uang transport); 28–48rem: nama di atas; HP: bertumpuk */}
                      <div className="grid min-w-0 flex-1 grid-cols-1 items-start gap-3 @md:grid-cols-2 @3xl:grid-cols-[minmax(0,1fr)_11rem_11rem]">
                        <Field
                          label={`Nama orang ${i + 1}`}
                          htmlFor={`peserta-${i}-pegawai_id`}
                          error={errors[`peserta.${i}.pegawai_id`]}
                          wajib
                          className="@md:col-span-2 @3xl:col-span-1"
                        >
                          <PegawaiPicker
                            id={`peserta-${i}-pegawai_id`}
                            value={p.pegawai_id}
                            kecuali={dipilih.filter((x) => x !== p.pegawai_id)}
                            invalid={!!errors[`peserta.${i}.pegawai_id`]}
                            onChange={(id) => ubahPeserta(p.kunci, { pegawai_id: id })}
                          />
                        </Field>
                        <Field label="Uang harian" htmlFor={`peserta-${i}-uang_harian`} error={errors[`peserta.${i}.uang_harian`]}>
                          <CurrencyInput
                            id={`peserta-${i}-uang_harian`}
                            value={p.uang_harian}
                            invalid={!!errors[`peserta.${i}.uang_harian`]}
                            onChange={(v) => ubahPeserta(p.kunci, { uang_harian: v })}
                          />
                        </Field>
                        <Field label="Uang transport" htmlFor={`peserta-${i}-uang_transport`} error={errors[`peserta.${i}.uang_transport`]}>
                          <CurrencyInput
                            id={`peserta-${i}-uang_transport`}
                            value={p.uang_transport}
                            invalid={!!errors[`peserta.${i}.uang_transport`] || (!!errors[`peserta.${i}.uang_harian`] && !p.uang_transport)}
                            onChange={(v) => ubahPeserta(p.kunci, { uang_transport: v })}
                          />
                        </Field>
                        {(p.uang_harian ?? 0) > 0 && (p.uang_transport ?? 0) > 0 && (
                          <p className="text-right text-xs text-fg-muted @md:col-span-2 @3xl:col-span-3">
                            Jumlah orang {i + 1}:{' '}
                            <span className="angka font-bold text-fg">{formatRupiah(nilaiBaris(model, p))}</span>
                          </p>
                        )}
                      </div>
                      <Button
                        varian="hantu"
                        ukuran="ikon"
                        className="mt-6.5"
                        disabled={s.peserta.length <= 1}
                        onClick={() => setS((prev) => ({ ...prev, peserta: prev.peserta.filter((x) => x.kunci !== p.kunci) }))}
                        aria-label={`Hapus orang ${i + 1}`}
                        title="Hapus orang"
                      >
                        <Trash className="size-4" />
                      </Button>
                    </div>
                  ) : (
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
                  )}
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
              disabled={s.peserta.length >= maks}
              onClick={() => setS((prev) => ({ ...prev, peserta: [...prev.peserta, barisKosong()] }))}
            >
              {s.peserta.length >= maks ? `Maksimal ${maks} orang` : 'Tambah orang'}
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
