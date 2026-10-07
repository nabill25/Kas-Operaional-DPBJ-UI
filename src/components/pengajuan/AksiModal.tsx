import { Ban, CircleAlert, CircleCheck, CircleX, FolderKanban, Info, ReceiptText, Send, Undo2 } from 'lucide-react';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { KATEGORI_INFO, type Kategori } from '../../../shared/constants';
import { formatRupiah, tanggalLokalIso } from '../../../shared/format';
import {
  DAFTAR_PROJECT,
  DAFTAR_TASK,
  cariProject,
  taskOtomatis,
  taskSesuaiKategori,
  type ProjectMaster,
  type ProjectTask,
} from '../../../shared/project-task';
import type { PengajuanDetail, PengajuanRingkas } from '../../../shared/types';
import { validateCatatanWajib, validateDataPum, validateInvoice, validateTeruskan } from '../../../shared/validation';
import { ApiError } from '../../lib/api';
import { useAksiPengajuan, useSaranPum } from '../../lib/queries';
import { Chip } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { PilihCari, type OpsiCari } from '../ui/PilihCari';

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

/**
 * Project hosting & task name: kotak cari dari master Kasubdit (shared/project-task.ts) + nilai yang pernah dipakai.
 * Memilih project otomatis mengisi task bila project itu hanya punya satu task yang sesuai kategori.
 */
function IsianPum({
  kategori,
  project,
  task,
  setProject,
  setTask,
  errors,
}: {
  kategori: Kategori;
  project: string;
  task: string;
  setProject: (v: string) => void;
  setTask: (v: string) => void;
  errors: Record<string, string>;
}) {
  const id = useId().replace(/:/g, '');
  const { data: saran } = useSaranPum(true);
  const [otomatis, setOtomatis] = useState(false);
  const label = KATEGORI_INFO[kategori].labelPendek;
  const master = cariProject(project);

  const opsiProject = useMemo<OpsiCari[]>(() => {
    const relevan = (pr: ProjectMaster) => pr.tasks.some((t) => taskSesuaiKategori(kategori, t.taskNama));
    const keOpsi = (pr: ProjectMaster, grup: string): OpsiCari => ({ value: pr.project, kode: pr.kode, label: pr.nama, grup });
    const lama = (saran?.project_hosting ?? []).filter((v) => !cariProject(v));
    return [
      ...DAFTAR_PROJECT.filter(relevan).map((pr) => keOpsi(pr, `Punya task ${label}`)),
      ...DAFTAR_PROJECT.filter((pr) => !relevan(pr)).map((pr) => keOpsi(pr, 'Project lainnya')),
      ...lama.map((v): OpsiCari => ({ value: v, label: v, grup: 'Pernah dipakai' })),
    ];
  }, [kategori, label, saran]);

  const opsiTask = useMemo<OpsiCari[]>(() => {
    const sumber = master ? master.tasks : DAFTAR_TASK;
    const keOpsi = (t: ProjectTask, grup: string): OpsiCari => ({ value: t.task, kode: t.taskKode, label: t.taskNama, grup });
    const dikenal = new Set(DAFTAR_TASK.map((t) => t.task));
    const lama = master ? [] : (saran?.task_name ?? []).filter((v) => !dikenal.has(v));
    return [
      ...sumber.filter((t) => taskSesuaiKategori(kategori, t.taskNama)).map((t) => keOpsi(t, `Sesuai kategori ${label}`)),
      ...sumber
        .filter((t) => !taskSesuaiKategori(kategori, t.taskNama))
        .map((t) => keOpsi(t, master ? 'Task lain project ini' : 'Task lainnya')),
      ...lama.map((v): OpsiCari => ({ value: v, label: v, grup: 'Pernah dipakai' })),
    ];
  }, [kategori, label, master, saran]);

  const pilihProject = (v: string) => {
    setProject(v);
    const pr = cariProject(v);
    // Task lama tetap dipakai bila masih sah untuk project baru; selain itu isi otomatis (atau kosongkan).
    if (!pr || pr.tasks.some((t) => t.task === task)) {
      setOtomatis(false);
      return;
    }
    const t = taskOtomatis(kategori, v);
    setTask(t ?? '');
    setOtomatis(t !== null);
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <Field label="Project Hosting" htmlFor={`${id}-project`} error={errors.project_hosting} hint="Cari kode atau nama project">
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
        label="Task Name"
        htmlFor={`${id}-task`}
        error={errors.task_name}
        hint={
          otomatis
            ? `Terisi otomatis: task ${label} untuk project ini`
            : master
              ? 'Hanya task yang tersedia untuk project terpilih'
              : 'Cari kode atau nama task'
        }
      >
        <PilihCari
          id={`${id}-task`}
          value={task}
          onChange={(v) => {
            setTask(v);
            setOtomatis(false);
          }}
          opsi={opsiTask}
          invalid={!!errors.task_name}
          labelCari="Cari task"
          placeholder="Pilih task…"
          placeholderCari="mis. 723207 atau konsumsi"
        />
      </Field>
    </div>
  );
}

// ───────────────────────────── Teruskan ke MDK ─────────────────────────────

export function TeruskanModal(props: PropsModal) {
  const aksi = useAksiPengajuan(props.p.id);
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      terkunci={aksi.isPending}
      judul="Setujui & teruskan ke MDK"
      deskripsi="MDK berada di luar sistem. Setelah invoice dari MDK diterima, input No. Invoice pada pengajuan ini."
      ikon={<Send className="size-5" />}
    >
      <IsiTeruskan {...props} aksi={aksi} />
    </Modal>
  );
}

function IsiTeruskan({ p, onOpenChange, onBerhasil, aksi }: Omit<PropsModal, 'open'> & { aksi: MutasiAksi }) {
  const [project, setProject] = useState(p.project_hosting ?? '');
  const [task, setTask] = useState(p.task_name ?? '');
  const [catatan, setCatatan] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateTeruskan({ project_hosting: project, task_name: task, catatan });
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    try {
      const d = await aksi.mutateAsync({
        aksi: 'teruskan',
        project_hosting: project,
        task_name: task,
        catatan,
      });
      toast.success(`${p.kode} diteruskan ke MDK`, { description: 'Pengaju menerima notifikasi otomatis.' });
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
        <IsianPum kategori={p.kategori} project={project} task={task} setProject={setProject} setTask={setTask} errors={errors} />
        {!project.trim() && !task.trim() && (
          <p className="flex items-start gap-2 text-xs text-fg-muted">
            <Info className="mt-px size-3.5 shrink-0" /> Project hosting & task name boleh dilengkapi nanti dari halaman detail.
          </p>
        )}
        <Field label="Catatan untuk pengaju (opsional)" htmlFor="catatan_teruskan" error={errors.catatan}>
          <Textarea
            id="catatan_teruskan"
            rows={2}
            maxLength={1000}
            value={catatan}
            placeholder="mis. Berkas fisik sudah diserahkan ke MDK"
            onChange={(e) => setCatatan(e.target.value)}
          />
        </Field>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button varian="kedua" onClick={() => onOpenChange(false)} disabled={aksi.isPending}>
            Batal
          </Button>
          <Button type="submit" varian="navy" memuat={aksi.isPending} ikon={<Send className="size-4" />}>
            Teruskan ke MDK
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
      judul="Project hosting & task name"
      deskripsi="Data pencatatan PUM untuk proses di MDK."
      ikon={<FolderKanban className="size-5" />}
      lebar="sm"
    >
      <IsiDataPum {...props} aksi={aksi} />
    </Modal>
  );
}

function IsiDataPum({ p, onOpenChange, onBerhasil, aksi }: Omit<PropsModal, 'open'> & { aksi: MutasiAksi }) {
  const [project, setProject] = useState(p.project_hosting ?? '');
  const [task, setTask] = useState(p.task_name ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateDataPum({ project_hosting: project, task_name: task });
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    try {
      const d = await aksi.mutateAsync({ aksi: 'data-pum', project_hosting: project, task_name: task });
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
      <IsianPum kategori={p.kategori} project={project} task={task} setProject={setProject} setTask={setTask} errors={errors} />
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

/** Input / ubah No. Invoice MDK (oleh PUM) — menjadikan pengajuan selesai (paid). */
export function InvoiceModal({ mode, ...props }: PropsModal & { mode: 'selesai' | 'ubah' }) {
  const aksi = useAksiPengajuan(props.p.id);
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      terkunci={aksi.isPending}
      judul={mode === 'ubah' ? 'Ubah data invoice MDK' : 'Input No. Invoice dari MDK'}
      deskripsi={
        mode === 'ubah'
          ? 'Perbaiki nomor/tanggal invoice yang sudah tercatat.'
          : 'Invoice diterima dari MDK (di luar sistem). Status pengajuan menjadi Selesai (Paid).'
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
}: Omit<PropsModal, 'open'> & { mode: 'selesai' | 'ubah'; aksi: MutasiAksi }) {
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
        aksi: mode === 'ubah' ? 'invoice' : 'selesai',
        no_invoice_mdk: h.data.no_invoice_mdk,
        tanggal_invoice_mdk: h.data.tanggal_invoice_mdk,
        catatan: h.data.catatan ?? '',
      });
      toast.success(mode === 'ubah' ? 'Data invoice diperbarui' : `${p.kode} selesai (paid)`, {
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
      {(p.project_hosting || p.task_name) && (
        <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-fg/[0.04] px-3 py-2 text-xs text-fg-muted ring-1 ring-fg/[0.06]">
          <FolderKanban className="size-3.5" />
          <span>
            Project: <b className="text-fg">{p.project_hosting ?? '-'}</b>
          </span>
          <span>
            Task: <b className="text-fg">{p.task_name ?? '-'}</b>
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
          <Button type="submit" varian={mode === 'ubah' ? 'utama' : 'sukses'} memuat={aksi.isPending}>
            {mode === 'ubah' ? 'Simpan perubahan' : 'Simpan invoice — selesai (paid)'}
          </Button>
        </div>
      </form>
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
          : 'No. Invoice MDK akan dihapus dan status kembali menjadi Diajukan ke MDK.'
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
