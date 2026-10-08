import { ArrowDown, ArrowUp, FileStack, Info, Lock, PencilLine, Plus, Power, Shapes, Trash, Users, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  IKON_JENIS_LIST,
  LABEL_BERKAS_LAINNYA,
  MAKS_PESERTA_BARU,
  MODEL_FORM_INFO,
  MODEL_FORM_LIST,
  WARNA_JENIS_LABEL,
  WARNA_JENIS_PILIHAN,
  modelPeserta,
  type IkonJenis,
  type ModelForm,
  type WarnaJenis,
} from '../../../shared/constants';
import { maksPeserta } from '../../../shared/konfig';
import type { JenisPengajuan } from '../../../shared/types';
import { validateJenisPengajuan } from '../../../shared/validation';
import { warnaSeri } from '../../components/dashboard/palet';
import { IKON_JENIS } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { GlassCard } from '../../components/ui/GlassCard';
import { Kosong, Skeleton } from '../../components/ui/Kosong';
import { MenuItem, MenuPemisah } from '../../components/ui/Menu';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useKamus } from '../../context/KonfigContext';
import { useKonfirmasi } from '../../context/KonfirmasiContext';
import { useTema } from '../../context/ThemeContext';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useHapusJenisPengajuan, useMasterJenisPengajuan, useSimpanJenisPengajuan, type DataJenisPengajuan } from '../../lib/queries';
import { BarisFilter, CentangAktif, ChipAktif, ChipInfo, MenuAksi, cocokCari, cocokFilter, type FilterAktif } from './bersama';

export default function MasterJenisPengajuanPage() {
  const { data = [], isLoading } = useMasterJenisPengajuan();
  const kamus = useKamus();
  const { tema } = useTema();
  const simpan = useSimpanJenisPengajuan();
  const hapusMut = useHapusJenisPengajuan();
  const konfirmasi = useKonfirmasi();
  const [status, setStatus] = useState<FilterAktif>('aktif');
  const [cari, setCari] = useState('');
  const [form, setForm] = useState<{ open: boolean; j: JenisPengajuan | null }>({ open: false, j: null });

  const tampil = useMemo(
    () => data.filter((j) => cocokFilter(j.aktif, status) && cocokCari(cari, j.label, j.label_pendek, j.prefix, j.deskripsi)),
    [data, status, cari],
  );

  const ubahAktif = async (j: JenisPengajuan) => {
    try {
      await simpan.mutateAsync({ kode: j.kode, data: keData(j, { aktif: !j.aktif }) });
      toast.success(`${j.label} ${j.aktif ? 'dinonaktifkan' : 'diaktifkan kembali'}`, {
        description: j.aktif ? 'Tidak muncul lagi di Buat Pengajuan; pengajuan lama tetap bisa diproses.' : undefined,
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal memperbarui status');
    }
  };

  const hapus = async (j: JenisPengajuan) => {
    const ok = await konfirmasi({
      judul: `Hapus ${j.label}?`,
      pesan: 'Jenis pengajuan akan dihapus permanen. Hanya jenis tambahan yang belum pernah dipakai yang dapat dihapus.',
      teksYa: 'Hapus jenis pengajuan',
      varian: 'bahaya',
    });
    if (!ok) return;
    try {
      await hapusMut.mutateAsync(j.kode);
      toast.success(`${j.label} dihapus`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal menghapus jenis pengajuan');
    }
  };

  return (
    <div>
      <PageHeader
        judul="Master Jenis Pengajuan"
        deskripsi="Kategori pengajuan beserta model form, awalan kode, dan berkas wajibnya. Jenis aktif langsung muncul di Buat Pengajuan."
        aksi={
          <Button ikon={<Plus className="size-4" />} onClick={() => setForm({ open: true, j: null })}>
            Tambah Jenis Pengajuan
          </Button>
        }
      />

      <BarisFilter
        status={status}
        onStatus={setStatus}
        jumlah={{ aktif: data.filter((j) => j.aktif).length, semua: data.length }}
        cari={cari}
        onCari={setCari}
        placeholder="Cari nama, awalan kode, atau deskripsi…"
        labelCari="Cari jenis pengajuan"
        layoutId="seg-jenis-pengajuan-status"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : tampil.length === 0 ? (
        <GlassCard>
          <Kosong ikon={<Shapes />} judul={cari ? 'Jenis pengajuan tidak ditemukan' : 'Belum ada jenis pengajuan'} deskripsi="Tambahkan jenis pengajuan baru, mis. Kontrak Borongan." />
        </GlassCard>
      ) : (
        <motion.ul layout aria-label="Daftar jenis pengajuan" className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {tampil.map((j) => {
              const Ikon = IKON_JENIS[j.ikon];
              const dipakai = j.dipakai ?? 0;
              return (
                <motion.li key={j.kode} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <GlassCard className={cn('flex h-full items-start gap-3.5 p-4 sm:p-5', !j.aktif && 'opacity-70')} data-jenis-pengajuan={j.kode}>
                    <span
                      className="grid size-12 shrink-0 place-items-center rounded-2xl text-white shadow-md"
                      style={{ background: warnaSeri(tema, j.warna) }}
                      aria-hidden
                    >
                      <Ikon className="size-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-fg">{j.label}</p>
                      <p className="text-xs text-fg-muted">
                        {j.label_pendek} · kode <span className="font-mono font-semibold whitespace-nowrap text-fg">{j.prefix}-YYYY-NNNN</span>
                      </p>
                      {j.deskripsi && <p className="mt-1 text-xs text-fg-muted">{j.deskripsi}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <ChipAktif aktif={j.aktif} />
                        {j.bawaan && <ChipInfo>Bawaan</ChipInfo>}
                        <ChipInfo>{MODEL_FORM_INFO[j.model].label}</ChipInfo>
                        {modelPeserta(j.model) && <ChipInfo>Maks. {maksPeserta(j)} orang</ChipInfo>}
                        <ChipInfo>{dipakai} pengajuan</ChipInfo>
                      </div>
                      <div className="mt-3">
                        <p className="text-[10.5px] font-bold tracking-[0.08em] text-fg-subtle uppercase">Berkas wajib</p>
                        {j.berkas.length === 0 ? (
                          <p className="mt-1 text-xs text-fg-muted">Tidak ada (hanya {LABEL_BERKAS_LAINNYA} opsional)</p>
                        ) : (
                          <ol className="mt-1 flex flex-wrap gap-1.5" aria-label={`Berkas wajib ${j.label}`}>
                            {j.berkas.map((b, i) => (
                              <li key={b} className="rounded-lg bg-fg/[0.05] px-2 py-1 text-xs font-medium text-fg">
                                <span className="text-fg-subtle">{i + 1}.</span> {kamus.labelBerkas(b)}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                      {j.kata_kunci_task && (
                        <p className="mt-2 text-xs text-fg-muted">
                          Saran task: nama task memuat <span className="font-semibold text-fg">“{j.kata_kunci_task}”</span>
                        </p>
                      )}
                    </div>
                    <MenuAksi label={`Aksi untuk ${j.label}`}>
                      <MenuItem ikon={<PencilLine />} onSelect={() => setForm({ open: true, j })}>
                        Ubah & atur berkas wajib
                      </MenuItem>
                      <MenuItem ikon={<Power />} onSelect={() => void ubahAktif(j)}>
                        {j.aktif ? 'Nonaktifkan' : 'Aktifkan kembali'}
                      </MenuItem>
                      <MenuPemisah />
                      <MenuItem ikon={<Trash />} bahaya disabled={j.bawaan || dipakai > 0} onSelect={() => void hapus(j)}>
                        {j.bawaan ? 'Hapus (jenis bawaan)' : dipakai > 0 ? 'Hapus (sudah dipakai)' : 'Hapus permanen'}
                      </MenuItem>
                    </MenuAksi>
                  </GlassCard>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}

      <div className="mt-5 space-y-1.5 text-xs text-fg-muted">
        <p className="flex items-start gap-2">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden /> Mengubah berkas wajib berlaku untuk pengajuan baru dan pengajuan yang masih Draft
          atau Dikembalikan. Pengajuan yang sudah diajukan ke PUM, diverifikasi, atau selesai tetap memakai daftar lamanya.
        </p>
        <p className="flex items-start gap-2">
          <Lock className="mt-px size-3.5 shrink-0" aria-hidden /> Model form tidak dapat diganti setelah jenis dibuat. Jenis bawaan tidak dapat
          dihapus; nonaktifkan saja bila tidak dipakai.
        </p>
      </div>

      <Modal
        open={form.open}
        onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))}
        terkunci={simpan.isPending}
        judul={form.j ? `Ubah ${form.j.label}` : 'Tambah jenis pengajuan'}
        deskripsi="Atur nama, awalan kode, model form, berkas wajib, dan tampilan di grafik."
        ikon={<Shapes className="size-5" />}
        lebar="lg"
      >
        <FormJenis key={form.j?.kode ?? 'baru'} j={form.j} semua={data} simpan={simpan} onSelesai={() => setForm((f) => ({ ...f, open: false }))} />
      </Modal>
    </div>
  );
}

/** Data form dari jenis yang ada (untuk ubah / ganti status). */
function keData(j: JenisPengajuan, ubah: Partial<DataJenisPengajuan> = {}): DataJenisPengajuan {
  return {
    label: j.label,
    label_pendek: j.label_pendek,
    prefix: j.prefix,
    deskripsi: j.deskripsi,
    model: j.model,
    maks_peserta: j.maks_peserta,
    kata_kunci_task: j.kata_kunci_task,
    warna: j.warna,
    ikon: j.ikon,
    aktif: j.aktif,
    berkas: j.berkas,
    ...ubah,
  };
}

function FormJenis({
  j,
  semua,
  simpan,
  onSelesai,
}: {
  j: JenisPengajuan | null;
  semua: JenisPengajuan[];
  simpan: ReturnType<typeof useSimpanJenisPengajuan>;
  onSelesai: () => void;
}) {
  const kamus = useKamus();
  const { tema } = useTema();
  const warnaBebas = WARNA_JENIS_PILIHAN.find((w) => !semua.some((x) => x.warna === w)) ?? 'ungu';
  const [label, setLabel] = useState(j?.label ?? '');
  const [labelPendek, setLabelPendek] = useState(j?.label_pendek ?? '');
  const [prefix, setPrefix] = useState(j?.prefix ?? '');
  const [deskripsi, setDeskripsi] = useState(j?.deskripsi ?? '');
  const [model, setModel] = useState<ModelForm>(j?.model ?? 'umum');
  const [maks, setMaks] = useState(String(j?.maks_peserta ?? MAKS_PESERTA_BARU));
  const [kataKunci, setKataKunci] = useState(j?.kata_kunci_task ?? '');
  const [warna, setWarna] = useState<WarnaJenis>(j?.warna ?? warnaBebas);
  const [ikon, setIkon] = useState<IkonJenis>(j?.ikon ?? 'briefcase');
  const [aktif, setAktif] = useState(j?.aktif ?? true);
  const [berkas, setBerkas] = useState<string[]>(j?.berkas ?? []);
  const [tambah, setTambah] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const prefixTerkunci = !!j && (j.dipakai ?? 0) > 0;
  const Ikon = IKON_JENIS[ikon];
  const pilihanBerkas = kamus.konfig.jenisBerkas.filter((b) => b.aktif && !berkas.includes(b.kode));

  const geser = (i: number, arah: -1 | 1) =>
    setBerkas((d) => {
      const baru = [...d];
      [baru[i], baru[i + arah]] = [baru[i + arah], baru[i]];
      return baru;
    });

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const data = {
      label,
      label_pendek: labelPendek,
      prefix,
      deskripsi,
      model,
      maks_peserta: modelPeserta(model) ? maks : null,
      kata_kunci_task: kataKunci,
      warna,
      ikon,
      aktif,
      berkas,
    };
    const h = validateJenisPengajuan(data, j?.model);
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    try {
      const hasil = await simpan.mutateAsync({ kode: j?.kode, data: h.data });
      const disinkron = 'disinkron' in hasil ? Number(hasil.disinkron) : 0;
      toast.success(j ? `${hasil.label} diperbarui` : `${hasil.label} ditambahkan`, {
        description:
          disinkron > 0
            ? `${disinkron} pengajuan Draft/Dikembalikan ikut memakai daftar berkas wajib yang baru.`
            : j
              ? undefined
              : 'Jenis ini sudah bisa dipilih di Buat Pengajuan.',
      });
      onSelesai();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors);
        if (Object.keys(err.errors).length === 0) toast.error(err.message);
      }
    }
  };

  return (
    <form onSubmit={kirim} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nama jenis pengajuan" htmlFor="jp-label" error={errors.label} wajib className="sm:col-span-2">
          <Input
            id="jp-label"
            autoFocus
            maxLength={60}
            value={label}
            invalid={!!errors.label}
            placeholder="mis. Kontrak Borongan"
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <Field label="Nama singkat" htmlFor="jp-label-pendek" error={errors.label_pendek} hint="Untuk grafik, filter, & badge (maks. 24). Kosong = sama dengan nama.">
          <Input id="jp-label-pendek" maxLength={24} value={labelPendek} invalid={!!errors.label_pendek} onChange={(e) => setLabelPendek(e.target.value)} />
        </Field>
        <Field
          label="Awalan kode"
          htmlFor="jp-prefix"
          error={errors.prefix}
          wajib
          hint={
            prefixTerkunci
              ? `Tidak dapat diubah: sudah ada ${j?.dipakai} pengajuan`
              : `2–5 huruf, mis. KBR → ${(prefix || 'KBR').toUpperCase()}-${new Date().getFullYear()}-0001`
          }
        >
          <Input
            id="jp-prefix"
            maxLength={5}
            className="font-mono uppercase"
            value={prefix}
            disabled={prefixTerkunci}
            invalid={!!errors.prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
        </Field>
        <Field label="Deskripsi (opsional)" htmlFor="jp-deskripsi" error={errors.deskripsi} className="sm:col-span-2" hint="Tampil di kartu pilihan Buat Pengajuan">
          <Input
            id="jp-deskripsi"
            maxLength={160}
            value={deskripsi}
            placeholder="mis. Honor pegawai kontrak borongan per periode"
            onChange={(e) => setDeskripsi(e.target.value)}
          />
        </Field>
      </div>

      {/* Model form */}
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-fg">
          Model form <span className="text-red-500">*</span>
        </legend>
        {j ? (
          <p className="flex items-start gap-2 rounded-2xl bg-fg/[0.03] px-3.5 py-3 text-sm ring-1 ring-fg/[0.06]">
            <Lock className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden />
            <span>
              <span className="block font-semibold text-fg">{MODEL_FORM_INFO[j.model].label}</span>
              <span className="block text-xs text-fg-muted">{MODEL_FORM_INFO[j.model].deskripsi} · tidak dapat diganti setelah dibuat</span>
            </span>
          </p>
        ) : (
          <div role="radiogroup" aria-label="Model form" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MODEL_FORM_LIST.map((m) => {
              const dipilih = model === m;
              return (
                <label
                  key={m}
                  data-model={m}
                  className={cn(
                    'flex cursor-pointer flex-col gap-0.5 rounded-2xl px-3.5 py-3 ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-kuning-500',
                    dipilih ? 'bg-kuning-400/15 ring-2 ring-kuning-500' : 'bg-fg/[0.03] ring-fg/10 hover:ring-fg/25',
                  )}
                >
                  <input type="radio" name="model" value={m} checked={dipilih} onChange={() => setModel(m)} className="sr-only" />
                  <span className="text-sm font-semibold text-fg">{MODEL_FORM_INFO[m].label}</span>
                  <span className="text-xs text-fg-muted">{MODEL_FORM_INFO[m].deskripsi}</span>
                </label>
              );
            })}
          </div>
        )}
        {errors.model && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{errors.model}</p>}
      </fieldset>

      {modelPeserta(model) && (
        <Field label="Batas jumlah orang per pengajuan" htmlFor="jp-maks" error={errors.maks_peserta} wajib hint="1–50 orang (pegawai + nilai per orang)">
          <div className="relative max-w-40">
            <Users className="pointer-events-none absolute top-1/2 z-10 left-3.5 size-4 -translate-y-1/2 text-fg-muted" />
            <Input
              id="jp-maks"
              inputMode="numeric"
              className="angka pl-10"
              value={maks}
              invalid={!!errors.maks_peserta}
              onChange={(e) => setMaks(e.target.value.replace(/\D/g, '').slice(0, 2))}
            />
          </div>
        </Field>
      )}

      {/* Berkas wajib */}
      <fieldset data-field="berkas">
        <legend className="mb-1.5 flex w-full items-center justify-between gap-2 text-[13px] font-semibold text-fg">
          Berkas wajib (urut tampil)
          <Link to="/master/jenis-berkas" className="text-xs font-semibold text-fg-muted underline-offset-2 hover:text-fg hover:underline">
            Kelola jenis berkas
          </Link>
        </legend>
        {berkas.length === 0 ? (
          <p className="rounded-2xl bg-fg/[0.03] px-3.5 py-3 text-xs text-fg-muted ring-1 ring-fg/[0.06]">
            Belum ada berkas wajib. {LABEL_BERKAS_LAINNYA} selalu tersedia sebagai berkas opsional.
          </p>
        ) : (
          <ol className="space-y-1.5" aria-label="Berkas wajib terpilih">
            {berkas.map((b, i) => (
              <li key={b} className="flex items-center gap-2 rounded-xl bg-fg/[0.03] py-1.5 pr-1.5 pl-3 ring-1 ring-fg/[0.06]">
                <span className="w-5 text-xs font-bold text-fg-subtle">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{kamus.labelBerkas(b)}</span>
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => geser(i, -1)}
                  className="grid size-8 place-items-center rounded-lg text-fg-muted transition hover:bg-fg/[0.06] hover:text-fg disabled:opacity-30"
                  aria-label={`Naikkan ${kamus.labelBerkas(b)}`}
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={i === berkas.length - 1}
                  onClick={() => geser(i, 1)}
                  className="grid size-8 place-items-center rounded-lg text-fg-muted transition hover:bg-fg/[0.06] hover:text-fg disabled:opacity-30"
                  aria-label={`Turunkan ${kamus.labelBerkas(b)}`}
                >
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setBerkas((d) => d.filter((x) => x !== b))}
                  className="grid size-8 place-items-center rounded-lg text-fg-muted transition hover:bg-red-500/10 hover:text-red-600"
                  aria-label={`Keluarkan ${kamus.labelBerkas(b)}`}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <Select aria-label="Pilih jenis berkas" className="h-10" value={tambah} onChange={(e) => setTambah(e.target.value)}>
              <option value="">{pilihanBerkas.length ? 'Pilih jenis berkas…' : 'Semua jenis berkas aktif sudah dipilih'}</option>
              {pilihanBerkas.map((b) => (
                <option key={b.kode} value={b.kode}>
                  {b.label}
                </option>
              ))}
            </Select>
          </div>
          <Button
            varian="kedua"
            ukuran="sm"
            className="h-10"
            ikon={<FileStack className="size-4" />}
            disabled={!tambah}
            onClick={() => {
              setBerkas((d) => [...d, tambah]);
              setTambah('');
            }}
          >
            Tambah berkas wajib
          </Button>
        </div>
        {errors.berkas && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{errors.berkas}</p>}
        {j && (
          <p className="mt-1.5 text-xs text-fg-muted">
            Perubahan berlaku untuk pengajuan baru & yang masih Draft/Dikembalikan; yang sudah diajukan tidak berubah.
          </p>
        )}
      </fieldset>

      <Field
        label="Kata kunci Task Name (opsional)"
        htmlFor="jp-kata-kunci"
        error={errors.kata_kunci_task}
        hint="Saran task otomatis saat verifikasi PUM: task yang namanya memuat kata ini. Beberapa kata kunci dipisah koma."
      >
        <Input
          id="jp-kata-kunci"
          maxLength={100}
          value={kataKunci}
          placeholder="mis. honor tenaga lepas"
          onChange={(e) => setKataKunci(e.target.value)}
        />
      </Field>

      {/* Tampilan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-fg">Pratinjau</p>
          <span
            className="inline-flex items-center gap-2 rounded-full bg-fg/[0.05] py-1 pr-3 pl-1 text-xs font-semibold text-fg ring-1 ring-fg/10"
            data-testid="pratinjau-jenis"
          >
            <span className="grid size-6 place-items-center rounded-full text-white" style={{ background: warnaSeri(tema, warna) }} aria-hidden>
              <Ikon className="size-3.5" />
            </span>
            {labelPendek.trim() || label.trim() || 'Jenis baru'}
          </span>
        </div>
        <div className="space-y-3">
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-semibold text-fg">Warna di grafik</legend>
            <div role="radiogroup" aria-label="Warna" className="flex flex-wrap gap-2">
              {WARNA_JENIS_PILIHAN.map((w) => (
                <label
                  key={w}
                  title={WARNA_JENIS_LABEL[w]}
                  className={cn(
                    'grid size-9 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-surface transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-kuning-500',
                    warna === w && 'ring-2 ring-fg',
                  )}
                  style={{ background: warnaSeri(tema, w) }}
                >
                  <input type="radio" name="warna" value={w} checked={warna === w} onChange={() => setWarna(w)} className="sr-only" aria-label={WARNA_JENIS_LABEL[w]} />
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-semibold text-fg">Ikon</legend>
            <div role="radiogroup" aria-label="Ikon" className="flex flex-wrap gap-1.5">
              {IKON_JENIS_LIST.map((k) => {
                const I = IKON_JENIS[k];
                return (
                  <label
                    key={k}
                    className={cn(
                      'grid size-9 cursor-pointer place-items-center rounded-xl ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-kuning-500',
                      ikon === k ? 'bg-kuning-400/20 text-fg ring-2 ring-kuning-500' : 'bg-fg/[0.03] text-fg-muted ring-fg/10 hover:text-fg',
                    )}
                  >
                    <input type="radio" name="ikon" value={k} checked={ikon === k} onChange={() => setIkon(k)} className="sr-only" aria-label={`Ikon ${k}`} />
                    <I className="size-4.5" aria-hidden />
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      </div>

      {j && (
        <CentangAktif
          id="jp-aktif"
          aktif={aktif}
          onChange={setAktif}
          keterangan="Dapat dipilih di Buat Pengajuan. Nonaktif tidak menghapus pengajuan yang sudah ada."
        />
      )}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button varian="kedua" onClick={onSelesai} disabled={simpan.isPending}>
          Batal
        </Button>
        <Button type="submit" memuat={simpan.isPending}>
          {j ? 'Simpan perubahan' : 'Tambah jenis pengajuan'}
        </Button>
      </div>
    </form>
  );
}
