import { Ban, BadgeCheck, CircleAlert, CircleCheck, CircleX, ClipboardCheck, FolderKanban, Hourglass, Info, ReceiptText, Undo2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { Kategori } from '../../../shared/constants';
import { formatRupiah, formatTanggal, formatWaktu, tanggalLokalIso } from '../../../shared/format';
import {
  cariProject,
  cocokKataKunci,
  kodeDanaPasangan,
  nilaiProject,
  projectDenganTask,
  projectOtomatis,
  susunProjectTask,
  tahunMaster,
  tahunUntuk,
  taskOtomatis,
  type OpsiProject,
  type OpsiTask,
} from '../../../shared/project-task';
import type { MasterDana, MasterProjectTask, PengajuanDetail, PengajuanRingkas } from '../../../shared/types';
import { validateCatatanWajib, validateDataPum, validateInvoice, validateVerifikasi } from '../../../shared/validation';
import { ApiError } from '../../lib/api';
import { useKamus } from '../../context/KonfigContext';
import { useAksiPengajuan, useProjectTask, useSaranPum } from '../../lib/queries';
import { Chip } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { PilihCari, type OpsiCari } from '../ui/PilihCari';
import { Segmented } from '../ui/Segmented';

type DataPengajuan = PengajuanDetail | PengajuanRingkas;

function Ringkasan({ p }: { p: DataPengajuan }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-fg/[0.04] px-4 py-3 ring-1 ring-fg/[0.06]">
      <div className="min-w-0">
        <Chip>{p.kode}</Chip>
        <p className="mt-1 truncate text-sm font-semibold text-fg">{p.nama_kegiatan}</p>
      </div>
      <p className="shrink-0 text-base font-extrabold text-fg">{formatRupiah(p.total)}</p>
    </div>
  );
}

interface PropsModal {
  p: DataPengajuan;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onBerhasil?: (d: PengajuanDetail) => void;
}

type MutasiAksi = ReturnType<typeof useAksiPengajuan>;

const MASTER_KOSONG: MasterProjectTask = { project: [], task: [], dana: [] };

/**
 * Tahun master awal: tahun tempat project yang sudah tersimpan berada (bila ada di beberapa tahun, mis. hasil salin, pilih
 * tahun kegiatan atau tahun terdekat sebelumnya); bila project belum ada di master, tahun yang cocok dengan tanggal kegiatan.
 */
function tahunAwal(m: MasterProjectTask, project: string, tanggal: string): number {
  const tahunKegiatan = Number(tanggal.slice(0, 4)) || new Date().getFullYear();
  const tahunProject = [...new Set(m.project.filter((p) => nilaiProject(p.kode, p.nama) === project).map((p) => p.tahun))].sort((a, b) => a - b);
  if (tahunProject.length === 0) return tahunUntuk(m, tahunKegiatan);
  if (tahunProject.includes(tahunKegiatan)) return tahunKegiatan;
  const sebelum = tahunProject.filter((t) => t < tahunKegiatan);
  return sebelum.length > 0 ? sebelum[sebelum.length - 1] : tahunProject[0];
}

const labelDana = (d: Pick<MasterDana, 'kode' | 'nama'>) => `${d.kode} · ${d.nama}`;

/** Isian PUM: task, project, & kode dana (nilai dikelola pemanggil). */
export interface NilaiPum {
  project: string;
  task: string;
  kodeDana: string;
}

/**
 * Task Name, Project Costing, & kode dana: kotak cari dari master Project & Task (Master Data, per tahun anggaran) + nilai
 * yang pernah dipakai. Task diisi lebih dulu (otomatis bila hanya satu task yang cocok dengan kata kunci jenis pengajuan),
 * lalu project yang memiliki task itu (otomatis bila hanya satu); kode dana terisi otomatis dari pasangan project–task.
 */
function IsianPum({
  kategori,
  tanggal,
  nilai,
  onUbah,
  errors,
}: {
  kategori: Kategori;
  /** Tanggal kegiatan (YYYY-MM-DD) — menentukan tahun anggaran awal. */
  tanggal: string;
  nilai: NilaiPum;
  onUbah: (v: NilaiPum) => void;
  errors: Record<string, string>;
}) {
  const id = useId().replace(/:/g, '');
  const { data: saran } = useSaranPum(true);
  const { data: masterPt } = useProjectTask();
  const kamus = useKamus();
  const m = masterPt ?? MASTER_KOSONG;
  const [tahunDipilih, setTahunDipilih] = useState<number | null>(null);
  const [otomatis, setOtomatis] = useState<{ task: boolean; project: boolean }>({ task: false, project: false });
  const jenis = kamus.jenis(kategori);
  const label = jenis.label_pendek;
  const kataKunci = jenis.kata_kunci_task;
  const { project, task, kodeDana } = nilai;
  const daftarTahun = tahunMaster(m);
  const tahun = tahunDipilih ?? tahunAwal(m, project, tanggal);
  const daftar = useMemo(() => susunProjectTask(m, tahun), [m, tahun]);
  const danaOtomatis = project && task ? kodeDanaPasangan(daftar, project, task) : null;
  const pasanganDikenal = !!cariProject(daftar, project)?.tasks.some((t) => t.task === task);

  // Isian kosong: task otomatis dari kata kunci jenis (mis. Konsumsi → Beban Konsumsi) begitu master termuat.
  const sudahOtomatis = useRef(false);
  useEffect(() => {
    if (sudahOtomatis.current || !masterPt) return;
    sudahOtomatis.current = true;
    if (project || task) return;
    const t = taskOtomatis(daftar, kataKunci);
    if (!t) return;
    const pr = projectOtomatis(daftar, t) ?? '';
    onUbah({ task: t, project: pr, kodeDana: (pr && kodeDanaPasangan(daftar, pr, t)) || '' });
    setOtomatis({ task: true, project: !!pr });
  }, [masterPt, daftar, kataKunci, project, task, onUbah]);

  const opsiTask = useMemo<OpsiCari[]>(() => {
    const keOpsi = (t: OpsiTask, grup: string): OpsiCari => ({ value: t.task, kode: t.kode, label: t.nama, grup });
    const dikenal = new Set(daftar.task.map((t) => t.task));
    const lama = (saran?.task_name ?? []).filter((v) => !dikenal.has(v));
    const cocok = (t: OpsiTask) => cocokKataKunci(kataKunci, t.nama);
    return [
      ...daftar.task.filter(cocok).map((t) => keOpsi(t, `Sesuai kategori ${label}`)),
      ...daftar.task.filter((t) => !cocok(t)).map((t) => keOpsi(t, kataKunci ? 'Task lainnya' : 'Task')),
      ...lama.map((v): OpsiCari => ({ value: v, label: v, grup: 'Pernah dipakai' })),
    ];
  }, [daftar, kataKunci, label, saran]);

  // Task dari master → hanya project yang memiliki task itu; task lain/teks bebas → semua project.
  const projectTask = useMemo(() => (task ? projectDenganTask(daftar, task) : []), [daftar, task]);
  const opsiProject = useMemo<OpsiCari[]>(() => {
    const keOpsi = (pr: OpsiProject, grup: string): OpsiCari => ({ value: pr.project, kode: pr.kode, label: pr.nama, grup });
    if (projectTask.length > 0) return projectTask.map((pr) => keOpsi(pr, 'Memiliki task terpilih'));
    const lama = (saran?.project_hosting ?? []).filter((v) => !cariProject(daftar, v));
    return [
      ...daftar.project.map((pr) => keOpsi(pr, 'Project')),
      ...lama.map((v): OpsiCari => ({ value: v, label: v, grup: 'Pernah dipakai' })),
    ];
  }, [daftar, projectTask, saran]);

  const opsiDana = m.dana.filter((d) => d.aktif || d.kode === kodeDana);

  const pilihTask = (t: string) => {
    // Project tetap bila masih memiliki task baru; selain itu isi otomatis (satu-satunya project) atau kosongkan.
    const tetap = !!project && projectDenganTask(daftar, t).some((p) => p.project === project);
    const pr = tetap ? project : (projectOtomatis(daftar, t) ?? (cariProject(daftar, project) ? '' : project));
    onUbah({ task: t, project: pr, kodeDana: (pr && t && kodeDanaPasangan(daftar, pr, t)) || '' });
    setOtomatis({ task: false, project: !tetap && !!pr && pr !== project });
  };

  const pilihProject = (pr: string) => {
    onUbah({ task, project: pr, kodeDana: (pr && task && kodeDanaPasangan(daftar, pr, task)) || '' });
    setOtomatis((o) => ({ ...o, project: false }));
  };

  const gantiTahun = (t: number) => {
    setTahunDipilih(t);
    const d = susunProjectTask(m, t);
    const tk = taskOtomatis(d, kataKunci) ?? '';
    const pr = tk ? (projectOtomatis(d, tk) ?? '') : '';
    onUbah({ task: tk, project: pr, kodeDana: (pr && tk && kodeDanaPasangan(d, pr, tk)) || '' });
    setOtomatis({ task: !!tk, project: !!pr });
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {daftarTahun.length > 1 && (
        <Field label="Tahun anggaran" htmlFor={`${id}-tahun`} hint="Master Project & Task yang dipakai">
          <Segmented
            id={`${id}-tahun`}
            label="Tahun anggaran"
            layoutId={`${id}-seg-tahun`}
            value={String(tahun)}
            onChange={(v) => gantiTahun(Number(v))}
            opsi={daftarTahun.map((t) => ({ value: String(t), label: String(t) }))}
          />
        </Field>
      )}
      <Field
        label="Task Name"
        htmlFor={`${id}-task`}
        error={errors.task_name}
        hint={otomatis.task ? `Terisi otomatis: task ${label}` : 'Cari kode atau nama task'}
      >
        <PilihCari
          id={`${id}-task`}
          value={task}
          onChange={pilihTask}
          opsi={opsiTask}
          invalid={!!errors.task_name}
          labelCari="Cari task"
          placeholder="Pilih task…"
          placeholderCari="mis. 723207 atau konsumsi"
        />
      </Field>
      <Field
        label="Project Costing"
        htmlFor={`${id}-project`}
        error={errors.project_hosting}
        hint={
          otomatis.project
            ? 'Terisi otomatis: satu-satunya project yang memiliki task ini'
            : projectTask.length > 0
              ? 'Hanya project yang memiliki task terpilih'
              : 'Cari kode atau nama project'
        }
      >
        <PilihCari
          id={`${id}-project`}
          value={project}
          onChange={pilihProject}
          opsi={opsiProject}
          invalid={!!errors.project_hosting}
          labelCari="Cari project"
          placeholder="Pilih project…"
          placeholderCari="mis. D0030.09 atau koordinasi"
        />
      </Field>
      <Field
        label="Kode dana"
        htmlFor={`${id}-dana`}
        error={errors.kode_dana}
        hint={
          !project || !task
            ? 'Terisi otomatis setelah task & project dipilih'
            : danaOtomatis
              ? kodeDana === danaOtomatis
                ? `Otomatis dari master Project & Task ${tahun}`
                : `Master: ${danaOtomatis} — diubah manual`
              : pasanganDikenal
                ? 'Pasangan ini belum diberi kode dana di master — pilih manual bila perlu'
                : 'Project/task di luar master — pilih kode dana manual bila perlu'
        }
      >
        <Select
          id={`${id}-dana`}
          aria-label="Kode dana"
          value={kodeDana}
          invalid={!!errors.kode_dana}
          onChange={(e) => onUbah({ ...nilai, kodeDana: e.target.value })}
        >
          <option value="">— Belum ada kode dana —</option>
          {opsiDana.map((d) => (
            <option key={d.kode} value={d.kode}>
              {labelDana(d)}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

// ───────────────────────────── Verifikasi PUM ─────────────────────────────

export function VerifikasiModal(props: PropsModal) {
  const aksi = useAksiPengajuan(props.p.id);
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      terkunci={aksi.isPending}
      judul="Verifikasi pengajuan"
      deskripsi="Setelah diverifikasi, input No. Invoice MDK untuk mengajukan pengajuan ini ke MDK."
      ikon={<ClipboardCheck className="size-5" />}
    >
      <IsiVerifikasi {...props} aksi={aksi} />
    </Modal>
  );
}

function IsiVerifikasi({ p, onOpenChange, onBerhasil, aksi }: Omit<PropsModal, 'open'> & { aksi: MutasiAksi }) {
  const [nilai, setNilai] = useState<NilaiPum>({ project: p.project_hosting ?? '', task: p.task_name ?? '', kodeDana: p.kode_dana ?? '' });
  const [catatan, setCatatan] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { project, task, kodeDana } = nilai;

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateVerifikasi({ project_hosting: project, task_name: task, kode_dana: kodeDana, catatan });
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    try {
      const d = await aksi.mutateAsync({
        aksi: 'verifikasi',
        project_hosting: project,
        task_name: task,
        kode_dana: kodeDana,
        catatan,
      });
      toast.success(`${p.kode} diverifikasi PUM`, { description: 'Pengaju menerima notifikasi otomatis.' });
      onOpenChange(false);
      onBerhasil?.(d);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors);
        toast.error(err.message);
      }
    }
  };

  return (
    <>
      <Ringkasan p={p} />
      <p className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-500/25 dark:text-emerald-200">
        <CircleCheck className="size-4 shrink-0" />
        Semua berkas wajib sudah dicentang sesuai ({p.berkas_sesuai}/{p.berkas_wajib}).
      </p>
      <form onSubmit={kirim} className="space-y-4" noValidate>
        <IsianPum kategori={p.kategori} tanggal={p.tanggal_kegiatan} nilai={nilai} onUbah={setNilai} errors={errors} />
        {!project.trim() && !task.trim() && (
          <p className="flex items-start gap-2 text-xs text-fg-muted">
            <Info className="mt-px size-3.5 shrink-0" /> Task name, project costing, & kode dana boleh dilengkapi nanti dari halaman detail.
          </p>
        )}
        <Field label="Catatan untuk pengaju (opsional)" htmlFor="catatan_verifikasi" error={errors.catatan}>
          <Textarea
            id="catatan_verifikasi"
            rows={2}
            maxLength={1000}
            value={catatan}
            placeholder="mis. Berkas fisik sudah diterima PUM"
            onChange={(e) => setCatatan(e.target.value)}
          />
        </Field>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button varian="kedua" onClick={() => onOpenChange(false)} disabled={aksi.isPending}>
            Batal
          </Button>
          <Button type="submit" varian="navy" memuat={aksi.isPending} ikon={<ClipboardCheck className="size-4" />}>
            Verifikasi
          </Button>
        </div>
      </form>
    </>
  );
}

// ───────────────────────────── Ubah data PUM ─────────────────────────────

export function DataPumModal(props: PropsModal) {
  const aksi = useAksiPengajuan(props.p.id);
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      terkunci={aksi.isPending}
      judul="Task name, project costing & kode dana"
      deskripsi="Data pencatatan PUM untuk proses di MDK."
      ikon={<FolderKanban className="size-5" />}
      lebar="sm"
    >
      <IsiDataPum {...props} aksi={aksi} />
    </Modal>
  );
}

function IsiDataPum({ p, onOpenChange, onBerhasil, aksi }: Omit<PropsModal, 'open'> & { aksi: MutasiAksi }) {
  const [nilai, setNilai] = useState<NilaiPum>({ project: p.project_hosting ?? '', task: p.task_name ?? '', kodeDana: p.kode_dana ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { project, task, kodeDana } = nilai;

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateDataPum({ project_hosting: project, task_name: task, kode_dana: kodeDana });
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    try {
      const d = await aksi.mutateAsync({ aksi: 'data-pum', project_hosting: project, task_name: task, kode_dana: kodeDana });
      toast.success('Data PUM diperbarui');
      onOpenChange(false);
      onBerhasil?.(d);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors);
        toast.error(err.message);
      }
    }
  };

  return (
    <form onSubmit={kirim} className="space-y-4" noValidate>
      <IsianPum kategori={p.kategori} tanggal={p.tanggal_kegiatan} nilai={nilai} onUbah={setNilai} errors={errors} />
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button varian="kedua" onClick={() => onOpenChange(false)} disabled={aksi.isPending}>
          Batal
        </Button>
        <Button type="submit" memuat={aksi.isPending}>
          Simpan
        </Button>
      </div>
    </form>
  );
}

// ───────────────────────────── Invoice MDK ─────────────────────────────

/**
 * Input No. Invoice MDK (oleh PUM) = mengajukan ke MDK; status menjadi Diajukan ke MDK (menunggu verifikasi MDK).
 * Mode "ubah": perbaiki data invoice yang sudah tercatat (Diajukan ke MDK / Selesai).
 */
export function InvoiceModal({ mode, ...props }: PropsModal & { mode: 'ajukan' | 'ubah' }) {
  const aksi = useAksiPengajuan(props.p.id);
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      terkunci={aksi.isPending}
      judul={mode === 'ubah' ? 'Ubah data invoice MDK' : 'Input No. Invoice MDK'}
      deskripsi={
        mode === 'ubah'
          ? 'Perbaiki nomor/tanggal invoice yang sudah tercatat.'
          : 'Pengajuan menjadi Diajukan ke MDK dan menunggu verifikasi MDK (di luar sistem). Setelah proses di MDK selesai, tekan Selesai.'
      }
      ikon={<ReceiptText className="size-5" />}
    >
      <IsiInvoice {...props} mode={mode} aksi={aksi} />
    </Modal>
  );
}

function IsiInvoice({
  p,
  onOpenChange,
  onBerhasil,
  mode,
  aksi,
}: Omit<PropsModal, 'open'> & { mode: 'ajukan' | 'ubah'; aksi: MutasiAksi }) {
  // State dibuat sekali saat modal dibuka (komponen ini hanya hidup selama modal terbuka).
  const [no, setNo] = useState(mode === 'ubah' ? (p.no_invoice_mdk ?? '') : '');
  const [tanggal, setTanggal] = useState(mode === 'ubah' ? (p.tanggal_invoice_mdk ?? tanggalLokalIso()) : tanggalLokalIso());
  const [catatan, setCatatan] = useState(mode === 'ubah' && 'catatan_pum' in p ? (p.catatan_pum ?? '') : '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateInvoice({ no_invoice_mdk: no, tanggal_invoice_mdk: tanggal, catatan });
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    try {
      const d = await aksi.mutateAsync({
        aksi: mode === 'ubah' ? 'invoice' : 'ajukan-mdk',
        no_invoice_mdk: h.data.no_invoice_mdk,
        tanggal_invoice_mdk: h.data.tanggal_invoice_mdk,
        catatan: h.data.catatan ?? '',
      });
      toast.success(mode === 'ubah' ? 'Data invoice diperbarui' : `${p.kode} diajukan ke MDK`, {
        description: `No. Invoice MDK: ${h.data.no_invoice_mdk}`,
      });
      onOpenChange(false);
      onBerhasil?.(d);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors);
        toast.error(err.message);
      }
    }
  };

  return (
    <>
      <Ringkasan p={p} />
      {(p.project_hosting || p.task_name || p.kode_dana) && (
        <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-fg/[0.04] px-3 py-2 text-xs text-fg-muted ring-1 ring-fg/[0.06]">
          <FolderKanban className="size-3.5" />
          <span>
            Task: <b className="text-fg">{p.task_name ?? '-'}</b>
          </span>
          <span>
            Project: <b className="text-fg">{p.project_hosting ?? '-'}</b>
          </span>
          <span>
            Kode dana: <b className="text-fg">{p.kode_dana ?? '-'}</b>
          </span>
        </p>
      )}
      <form onSubmit={kirim} className="space-y-4" noValidate>
        <Field label="No. Invoice MDK" htmlFor="no_invoice_mdk" error={errors.no_invoice_mdk} wajib>
          <Input
            id="no_invoice_mdk"
            autoFocus
            value={no}
            maxLength={100}
            invalid={!!errors.no_invoice_mdk}
            placeholder="mis. MDK/INV/2026/0412"
            onChange={(e) => setNo(e.target.value)}
          />
        </Field>
        <Field label="Tanggal invoice" htmlFor="tanggal_invoice_mdk" error={errors.tanggal_invoice_mdk} wajib>
          <Input
            id="tanggal_invoice_mdk"
            type="date"
            value={tanggal}
            invalid={!!errors.tanggal_invoice_mdk}
            onChange={(e) => setTanggal(e.target.value)}
          />
        </Field>
        <Field label="Catatan (opsional)" htmlFor="catatan_invoice" error={errors.catatan}>
          <Textarea id="catatan_invoice" rows={2} maxLength={1000} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </Field>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button varian="kedua" onClick={() => onOpenChange(false)} disabled={aksi.isPending}>
            Batal
          </Button>
          <Button type="submit" memuat={aksi.isPending}>
            {mode === 'ubah' ? 'Simpan perubahan' : 'Simpan invoice & ajukan ke MDK'}
          </Button>
        </div>
      </form>
    </>
  );
}

// ───────────────────────────── Selesai (paid) ─────────────────────────────

/** PUM menekan Selesai setelah proses di MDK (di luar sistem) selesai → status Selesai (Paid). */
export function SelesaiModal(props: PropsModal) {
  const aksi = useAksiPengajuan(props.p.id);
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      terkunci={aksi.isPending}
      judul="Tandai selesai (paid)?"
      deskripsi="Tekan setelah proses di MDK selesai. Pengaju menerima notifikasi otomatis."
      ikon={<BadgeCheck className="size-5" />}
      lebar="sm"
    >
      <IsiSelesai {...props} aksi={aksi} />
    </Modal>
  );
}

function IsiSelesai({ p, onOpenChange, onBerhasil, aksi }: Omit<PropsModal, 'open'> & { aksi: MutasiAksi }) {
  const kirim = async () => {
    try {
      const d = await aksi.mutateAsync({ aksi: 'selesai' });
      toast.success(`${p.kode} selesai (paid)`, { description: 'Notifikasi otomatis terkirim ke pengaju.' });
      onOpenChange(false);
      onBerhasil?.(d);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal menandai selesai');
    }
  };

  return (
    <>
      <Ringkasan p={p} />
      <dl className="mb-4 space-y-2 rounded-xl bg-fg/[0.04] px-3 py-2.5 text-xs ring-1 ring-fg/[0.06]">
        <div className="flex items-start justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-fg-muted">
            <ReceiptText className="size-3.5" aria-hidden /> No. Invoice MDK
          </dt>
          <dd className="min-w-0 text-right font-mono font-bold break-all text-fg">{p.no_invoice_mdk ?? '-'}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-fg-muted">
            <Hourglass className="size-3.5" aria-hidden /> Diajukan ke MDK
          </dt>
          <dd className="text-right font-semibold text-fg">
            {p.diajukan_mdk_at ? formatWaktu(p.diajukan_mdk_at) : formatTanggal(p.tanggal_invoice_mdk)}
          </dd>
        </div>
      </dl>
      <p className="mb-4 flex items-start gap-2 text-xs text-fg-muted">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden /> Pastikan MDK sudah selesai memverifikasi & membayar. Bila
        keliru, status selesai masih bisa dibatalkan dari menu Aksi PUM.
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button varian="kedua" onClick={() => onOpenChange(false)} disabled={aksi.isPending}>
          Batal
        </Button>
        <Button varian="sukses" ikon={<BadgeCheck className="size-4" />} memuat={aksi.isPending} onClick={() => void kirim()}>
          Ya, selesai (paid)
        </Button>
      </div>
    </>
  );
}

// ───────────────────────────── Kembalikan / batal selesai ─────────────────────────────

const ALASAN_CEPAT = [
  'Berkas belum lengkap, mohon dilengkapi.',
  'Nominal pada invoice tidak sesuai pengajuan.',
  'Tanda tangan pada dokumen belum lengkap.',
  'Data kegiatan perlu diperbaiki.',
];

/** Catatan wajib: kembalikan (PUM) atau batalkan status selesai. */
export function CatatanModal({ mode, ...props }: PropsModal & { mode: 'kembalikan' | 'batal-selesai' }) {
  const aksi = useAksiPengajuan(props.p.id);
  const kembalikan = mode === 'kembalikan';
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      terkunci={aksi.isPending}
      judul={kembalikan ? 'Kembalikan berkas ke pengaju' : 'Batalkan status selesai'}
      deskripsi={
        kembalikan
          ? 'Pengaju menerima notifikasi otomatis berisi catatan ini, lalu dapat memperbaiki dan mengajukan ulang.'
          : 'Status kembali menjadi Diajukan ke MDK (menunggu verifikasi MDK). No. Invoice tetap tersimpan.'
      }
      ikon={kembalikan ? <Undo2 className="size-5" /> : <Ban className="size-5" />}
    >
      <IsiCatatan {...props} mode={mode} aksi={aksi} />
    </Modal>
  );
}

function IsiCatatan({
  p,
  onOpenChange,
  onBerhasil,
  mode,
  aksi,
}: Omit<PropsModal, 'open'> & { mode: 'kembalikan' | 'batal-selesai'; aksi: MutasiAksi }) {
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState('');
  const kembalikan = mode === 'kembalikan';
  const revisi = 'kelengkapan' in p ? p.kelengkapan.items.filter((i) => i.cek?.status === 'revisi') : [];

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateCatatanWajib({ catatan }, kembalikan ? 'Alasan pengembalian' : 'Alasan pembatalan');
    if (!h.ok) {
      setError(h.errors.catatan);
      return;
    }
    try {
      const d = await aksi.mutateAsync({ aksi: mode, catatan: h.data.catatan });
      toast.success(kembalikan ? `${p.kode} dikembalikan ke pengaju` : 'Status selesai dibatalkan', {
        description: kembalikan ? 'Notifikasi otomatis terkirim ke pengaju.' : undefined,
      });
      onOpenChange(false);
      onBerhasil?.(d);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errors.catatan ?? '');
        toast.error(err.message);
      }
    }
  };

  return (
    <>
      <Ringkasan p={p} />
      {kembalikan && revisi.length > 0 && (
        <div className="mb-4 rounded-xl bg-amber-400/12 px-3 py-2.5 ring-1 ring-amber-500/25">
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-200">
            <CircleX className="size-3.5" /> Berkas ditandai perlu revisi (ikut dikirim ke pengaju)
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-fg">
            {revisi.map((i) => (
              <li key={i.jenis}>
                • <b>{i.label}</b>: {i.cek?.catatan}
              </li>
            ))}
          </ul>
        </div>
      )}
      <form onSubmit={kirim} className="space-y-3" noValidate>
        <Field label={kembalikan ? 'Alasan pengembalian' : 'Alasan pembatalan'} htmlFor="catatan_aksi" error={error} wajib>
          <Textarea
            id="catatan_aksi"
            autoFocus
            rows={3}
            maxLength={1000}
            value={catatan}
            invalid={!!error}
            onChange={(e) => {
              setCatatan(e.target.value);
              setError('');
            }}
            placeholder={kembalikan ? 'Jelaskan apa yang perlu diperbaiki pengaju…' : 'Mengapa status selesai dibatalkan?'}
          />
        </Field>
        {kembalikan && (
          <div className="flex flex-wrap gap-1.5">
            {ALASAN_CEPAT.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setCatatan(a);
                  setError('');
                }}
                className="rounded-full bg-fg/[0.05] px-3 py-1.5 text-xs font-medium text-fg-muted ring-1 ring-fg/10 transition hover:bg-kuning-400/20 hover:text-fg"
              >
                {a}
              </button>
            ))}
          </div>
        )}
        {kembalikan && (
          <p className="flex items-start gap-2 pt-1 text-xs text-fg-muted">
            <CircleAlert className="mt-px size-3.5 shrink-0" /> Berkas yang sudah dicentang sesuai tetap tersimpan; hanya berkas
            yang diganti pengaju yang perlu diperiksa ulang.
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button varian="kedua" onClick={() => onOpenChange(false)} disabled={aksi.isPending}>
            Batal
          </Button>
          <Button type="submit" varian={kembalikan ? 'utama' : 'bahaya'} memuat={aksi.isPending}>
            {kembalikan ? 'Kembalikan ke pengaju' : 'Batalkan status selesai'}
          </Button>
        </div>
      </form>
    </>
  );
}
