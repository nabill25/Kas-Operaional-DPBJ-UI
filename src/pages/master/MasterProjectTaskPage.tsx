import { CalendarRange, Copy, FolderKanban, FolderTree, Info, Landmark, ListTodo, PencilLine, Plus, Power, Search, Trash } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { nilaiProject, nilaiTask } from '../../../shared/project-task';
import type { MasterDana, MasterPasangan, MasterProject, MasterTask } from '../../../shared/types';
import { validateDana, validateProject, validateTask } from '../../../shared/validation';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { GlassCard } from '../../components/ui/GlassCard';
import { Kosong, Skeleton } from '../../components/ui/Kosong';
import { MenuItem, MenuPemisah } from '../../components/ui/Menu';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Segmented } from '../../components/ui/Segmented';
import { useKonfirmasi } from '../../context/KonfirmasiContext';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import {
  useHapusDana,
  useHapusProject,
  useHapusTask,
  useProjectTask,
  useSalinTahun,
  useSimpanDana,
  useSimpanProject,
  useSimpanTask,
} from '../../lib/queries';
import { BarisFilter, CentangAktif, ChipAktif, ChipInfo, MenuAksi, cocokCari, cocokFilter, type FilterAktif } from './bersama';

type Tab = 'project' | 'task' | 'dana';
const urutKode = (a: { kode: string }, b: { kode: string }) => a.kode.localeCompare(b.kode, 'en', { numeric: true });

/** Chip kode dana pada pasangan project–task. */
function ChipDana({ kode, dana }: { kode: string | null; dana: MasterDana[] }) {
  if (!kode) return <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-fg-subtle ring-1 ring-fg/10 ring-inset">tanpa dana</span>;
  const nama = dana.find((d) => d.kode === kode)?.nama;
  return (
    <span
      className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300"
      title={nama ? `Kode dana ${kode} · ${nama}` : `Kode dana ${kode}`}
    >
      Dana {kode}
    </span>
  );
}

export default function MasterProjectTaskPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'task' ? 'task' : params.get('tab') === 'dana' ? 'dana' : 'project';
  const { data, isLoading } = useProjectTask();
  const tahunIni = new Date().getFullYear();
  const semuaProject = data?.project ?? [];
  const semuaTask = data?.task ?? [];
  const dana = useMemo(() => [...(data?.dana ?? [])].sort(urutKode), [data]);
  // Kelompok tahun: tahun yang punya data + tahun ini & tahun depan (agar tahun anggaran baru bisa disiapkan).
  const daftarTahun = useMemo(
    () => [...new Set([...semuaProject.map((p) => p.tahun), ...semuaTask.map((t) => t.tahun), tahunIni, tahunIni + 1])].sort((a, b) => a - b),
    [semuaProject, semuaTask, tahunIni],
  );
  const tahunParam = Number(params.get('tahun'));
  const tahunBerdata = [...new Set([...semuaProject.map((p) => p.tahun), ...semuaTask.map((t) => t.tahun)])].sort((a, b) => a - b);
  const tahun = daftarTahun.includes(tahunParam)
    ? tahunParam
    : tahunBerdata.includes(tahunIni)
      ? tahunIni
      : (tahunBerdata[tahunBerdata.length - 1] ?? tahunIni);
  const project = useMemo(() => semuaProject.filter((p) => p.tahun === tahun).sort(urutKode), [semuaProject, tahun]);
  const task = useMemo(() => semuaTask.filter((t) => t.tahun === tahun).sort(urutKode), [semuaTask, tahun]);
  const kosong = project.length === 0 && task.length === 0;
  const sumberSalin = [...tahunBerdata].reverse().find((t) => t < tahun) ?? tahunBerdata.find((t) => t !== tahun) ?? null;

  const atur = (ubah: { tab?: Tab; tahun?: number }) => {
    const baru = new URLSearchParams(params);
    const t = ubah.tab ?? tab;
    if (t === 'project') baru.delete('tab');
    else baru.set('tab', t);
    if (ubah.tahun !== undefined) baru.set('tahun', String(ubah.tahun));
    setParams(baru, { replace: true });
  };

  return (
    <div>
      <PageHeader
        judul="Master Project Costing & Task Name"
        deskripsi="Daftar dari Kasubdit per tahun anggaran, beserta kode dana tiap pasangan project–task. Muncul di kotak cari saat PUM memverifikasi. Nilai yang sudah tersimpan di pengajuan tidak ikut berubah bila master diubah atau dihapus."
      />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          label="Jenis data"
          layoutId="seg-project-task"
          value={tab}
          onChange={(v) => atur({ tab: v })}
          opsi={[
            { value: 'project', label: 'Project Costing', ikon: <FolderKanban />, jumlah: project.length },
            { value: 'task', label: 'Task Name', ikon: <ListTodo />, jumlah: task.length },
            { value: 'dana', label: 'Kode Dana', ikon: <Landmark />, jumlah: dana.length },
          ]}
        />
        {tab !== 'dana' && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
              <CalendarRange className="size-4" aria-hidden /> Tahun anggaran
            </span>
            <Segmented
              label="Tahun anggaran"
              layoutId="seg-tahun-master"
              value={String(tahun)}
              onChange={(v) => atur({ tahun: Number(v) })}
              opsi={daftarTahun.map((t) => ({ value: String(t), label: String(t) }))}
            />
          </div>
        )}
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      ) : tab === 'dana' ? (
        <DaftarDana dana={dana} />
      ) : (
        <>
          {kosong && <TahunKosong tahun={tahun} sumber={sumberSalin} />}
          {tab === 'project' ? (
            <DaftarProject tahun={tahun} project={project} task={task} dana={dana} />
          ) : (
            <DaftarTask tahun={tahun} project={project} task={task} />
          )}
        </>
      )}
    </div>
  );
}

// ───────────────────────────── Tahun kosong ─────────────────────────────

function TahunKosong({ tahun, sumber }: { tahun: number; sumber: number | null }) {
  const salin = useSalinTahun();
  const konfirmasi = useKonfirmasi();
  const jalankan = async () => {
    if (sumber === null) return;
    const ok = await konfirmasi({
      judul: `Salin master ${sumber} ke ${tahun}?`,
      pesan: `Seluruh project, task, dan pasangannya beserta kode dana tahun ${sumber} disalin ke tahun ${tahun}. Setelah itu kode/nama/kode dana bisa disesuaikan untuk tahun ${tahun}.`,
      teksYa: `Salin ke ${tahun}`,
    });
    if (!ok) return;
    try {
      const r = await salin.mutateAsync({ dari: sumber, ke: tahun });
      toast.success(`Master ${tahun} disiapkan`, { description: `${r.project} project, ${r.task} task, ${r.pasangan} pasangan disalin dari ${sumber}.` });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal menyalin master');
    }
  };
  return (
    <GlassCard className="mb-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-center" data-testid="tahun-kosong">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-kuning-400/20 text-kuning-800 ring-1 ring-kuning-500/30 dark:text-kuning-300">
        <CalendarRange className="size-5" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold text-fg">Master tahun anggaran {tahun} masih kosong</p>
        <p className="text-xs text-fg-muted">
          {sumber !== null
            ? `Salin dari tahun ${sumber} sebagai titik awal, atau tambahkan project & task ${tahun} satu per satu.`
            : `Tambahkan project & task ${tahun} satu per satu.`}
        </p>
      </div>
      {sumber !== null && (
        <Button ikon={<Copy className="size-4" />} memuat={salin.isPending} onClick={() => void jalankan()}>
          Salin dari {sumber}
        </Button>
      )}
    </GlassCard>
  );
}

// ───────────────────────────── Project ─────────────────────────────

function DaftarProject({ tahun, project, task, dana }: { tahun: number; project: MasterProject[]; task: MasterTask[]; dana: MasterDana[] }) {
  const simpan = useSimpanProject();
  const hapusMut = useHapusProject();
  const konfirmasi = useKonfirmasi();
  const [status, setStatus] = useState<FilterAktif>('aktif');
  const [cari, setCari] = useState('');
  const [form, setForm] = useState<{ open: boolean; p: MasterProject | null }>({ open: false, p: null });
  const petaTask = useMemo(() => new Map(task.map((t) => [t.id, t])), [task]);
  const tampil = project.filter((p) => cocokFilter(p.aktif, status) && cocokCari(cari, p.kode, p.nama));

  const ubahAktif = async (p: MasterProject) => {
    try {
      await simpan.mutateAsync({ id: p.id, data: { tahun: p.tahun, kode: p.kode, nama: p.nama, aktif: !p.aktif, tasks: p.tasks } });
      toast.success(`${p.kode} ${p.aktif ? 'dinonaktifkan' : 'diaktifkan kembali'}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal memperbarui status project');
    }
  };

  const hapus = async (p: MasterProject) => {
    const ok = await konfirmasi({
      judul: `Hapus project ${p.kode} (${p.tahun})?`,
      pesan: 'Project hilang dari pilihan PUM. Pengajuan yang sudah memakai project ini tidak berubah.',
      teksYa: 'Hapus project',
      varian: 'bahaya',
    });
    if (!ok) return;
    try {
      await hapusMut.mutateAsync(p.id);
      toast.success(`Project ${p.kode} dihapus`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal menghapus project');
    }
  };

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button ikon={<Plus className="size-4" />} onClick={() => setForm({ open: true, p: null })}>
          Tambah Project {tahun}
        </Button>
      </div>
      <BarisFilter
        status={status}
        onStatus={setStatus}
        jumlah={{ aktif: project.filter((p) => p.aktif).length, semua: project.length }}
        cari={cari}
        onCari={setCari}
        placeholder="Cari kode atau nama project…"
        labelCari="Cari project"
        layoutId="seg-project-status"
      />
      {tampil.length === 0 ? (
        <GlassCard>
          <Kosong
            ikon={<FolderKanban />}
            judul={cari ? 'Project tidak ditemukan' : `Belum ada project ${tahun}`}
            deskripsi="Tambahkan project costing beserta task & kode dananya."
          />
        </GlassCard>
      ) : (
        <motion.ul layout aria-label="Daftar project" className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {tampil.map((p) => {
              const tasks = p.tasks
                .map((x) => ({ t: petaTask.get(x.id), kode_dana: x.kode_dana }))
                .filter((x): x is { t: MasterTask; kode_dana: string | null } => !!x.t)
                .sort((a, b) => urutKode(a.t, b.t));
              return (
                <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <GlassCard className={cn('flex h-full items-start gap-3 p-4', !p.aktif && 'opacity-70')} data-project={p.kode}>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11.5px] font-semibold text-fg-muted">{p.kode}</p>
                      <p className="font-bold text-fg">{p.nama}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <ChipAktif aktif={p.aktif} />
                        <ChipInfo>{p.tahun}</ChipInfo>
                        <ChipInfo>{tasks.length} task</ChipInfo>
                      </div>
                      {tasks.length > 0 && (
                        <ul className="mt-2.5 space-y-1" aria-label={`Task project ${p.kode}`}>
                          {tasks.map(({ t, kode_dana }) => (
                            <li key={t.id} className={cn('flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs', !t.aktif && 'text-fg-subtle line-through')}>
                              <span className="font-mono text-fg-muted">{t.kode}</span>
                              <span className="min-w-0 text-fg">{t.nama}</span>
                              <ChipDana kode={kode_dana} dana={dana} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <MenuAksi label={`Aksi untuk project ${p.kode}`}>
                      <MenuItem ikon={<PencilLine />} onSelect={() => setForm({ open: true, p })}>
                        Ubah project, task & kode dana
                      </MenuItem>
                      <MenuItem ikon={<Power />} onSelect={() => void ubahAktif(p)}>
                        {p.aktif ? 'Nonaktifkan' : 'Aktifkan kembali'}
                      </MenuItem>
                      <MenuPemisah />
                      <MenuItem ikon={<Trash />} bahaya onSelect={() => void hapus(p)}>
                        Hapus
                      </MenuItem>
                    </MenuAksi>
                  </GlassCard>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}
      <Modal
        open={form.open}
        onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))}
        terkunci={simpan.isPending}
        judul={form.p ? `Ubah project costing ${form.p.tahun}` : `Tambah project costing ${tahun}`}
        deskripsi="Disimpan di pengajuan sebagai “kode:nama”. Centang task yang sah untuk project ini dan isi kode dananya."
        ikon={<FolderKanban className="size-5" />}
        lebar="lg"
      >
        <FormProject
          key={form.p?.id ?? `baru-${tahun}`}
          tahun={form.p?.tahun ?? tahun}
          p={form.p}
          task={task}
          dana={dana}
          simpan={simpan}
          onSelesai={() => setForm((f) => ({ ...f, open: false }))}
        />
      </Modal>
    </>
  );
}

function FormProject({
  tahun,
  p,
  task,
  dana,
  simpan,
  onSelesai,
}: {
  tahun: number;
  p: MasterProject | null;
  task: MasterTask[];
  dana: MasterDana[];
  simpan: ReturnType<typeof useSimpanProject>;
  onSelesai: () => void;
}) {
  const [kode, setKode] = useState(p?.kode ?? '');
  const [nama, setNama] = useState(p?.nama ?? '');
  const [aktif, setAktif] = useState(p?.aktif ?? true);
  const [dipilih, setDipilih] = useState<MasterPasangan[]>(p?.tasks ?? []);
  const [cari, setCari] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const terpilih = (id: number) => dipilih.find((x) => x.id === id);
  // Task nonaktif tetap ditampilkan bila sudah terpilih (agar bisa dilepas).
  const pilihan = task.filter((t) => (t.aktif || !!terpilih(t.id)) && cocokCari(cari, t.kode, t.nama));
  const danaAktif = dana.filter((d) => d.aktif);

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateProject({ tahun, kode, nama, aktif, tasks: dipilih });
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    try {
      await simpan.mutateAsync({ id: p?.id, data: h.data });
      toast.success(p ? 'Project diperbarui' : `Project ${h.data.kode} (${tahun}) ditambahkan`);
      onSelesai();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors);
        if (Object.keys(err.errors).length === 0) toast.error(err.message);
      }
    }
  };

  return (
    <form onSubmit={kirim} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[13rem_1fr]">
        <Field label="Kode project" htmlFor="pr-kode" error={errors.kode} wajib hint={`Tahun anggaran ${tahun} · mis. D0030.09.01.6.002`}>
          <Input id="pr-kode" autoFocus className="font-mono" maxLength={40} value={kode} invalid={!!errors.kode} onChange={(e) => setKode(e.target.value)} />
        </Field>
        <Field label="Nama project" htmlFor="pr-nama" error={errors.nama} wajib>
          <Input id="pr-nama" maxLength={120} value={nama} invalid={!!errors.nama} onChange={(e) => setNama(e.target.value)} />
        </Field>
      </div>
      {kode.trim() && nama.trim() && (
        <p className="rounded-xl bg-fg/[0.04] px-3 py-2 text-xs text-fg-muted ring-1 ring-fg/[0.06]">
          Tersimpan di pengajuan sebagai <span className="font-mono font-semibold text-fg">{nilaiProject(kode.trim(), nama.trim().replace(/\s+/g, ' '))}</span>
        </p>
      )}
      <fieldset>
        <legend className="mb-1.5 flex w-full items-center justify-between gap-2 text-[13px] font-semibold text-fg">
          Task yang sah & kode dananya
          <span className="text-xs font-semibold text-fg-muted">{dipilih.length} dipilih</span>
        </legend>
        <label className="relative mb-2 block">
          <span className="sr-only">Cari task</span>
          <Search className="pointer-events-none absolute top-1/2 z-10 left-3 size-4 -translate-y-1/2 text-fg-muted" />
          <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari kode atau nama task…" className="h-10 pl-9" />
        </label>
        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-2xl bg-fg/[0.03] p-1.5 ring-1 ring-fg/[0.06]" aria-label="Pilihan task">
          {pilihan.length === 0 && <li className="px-3 py-3 text-center text-sm text-fg-muted">Tidak ada task {tahun} yang cocok.</li>}
          {pilihan.map((t) => {
            const pasangan = terpilih(t.id);
            return (
              <li key={t.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl px-2.5 py-2 text-sm hover:bg-fg/[0.04]', pasangan && 'bg-kuning-400/12')}>
                <label className="flex min-w-0 flex-1 basis-56 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={!!pasangan}
                    onChange={() => setDipilih((d) => (pasangan ? d.filter((x) => x.id !== t.id) : [...d, { id: t.id, kode_dana: null }]))}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--color-kuning-500)]"
                  />
                  <span className="min-w-0">
                    <span className="block font-mono text-[11px] text-fg-muted">{t.kode}</span>
                    <span className="block font-semibold text-fg">
                      {t.nama}
                      {!t.aktif && <span className="font-normal text-fg-subtle"> (nonaktif)</span>}
                    </span>
                  </span>
                </label>
                {pasangan && (
                  <Select
                    aria-label={`Kode dana ${t.kode}`}
                    className="h-9 w-44 text-[13px]"
                    value={pasangan.kode_dana ?? ''}
                    onChange={(e) =>
                      setDipilih((d) => d.map((x) => (x.id === t.id ? { ...x, kode_dana: e.target.value || null } : x)))
                    }
                  >
                    <option value="">— Kode dana —</option>
                    {[...danaAktif, ...dana.filter((x) => !x.aktif && x.kode === pasangan.kode_dana)].map((x) => (
                      <option key={x.kode} value={x.kode}>
                        {x.kode} · {x.nama}
                      </option>
                    ))}
                  </Select>
                )}
              </li>
            );
          })}
        </ul>
        {errors.tasks && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{errors.tasks}</p>}
        <p className="mt-1.5 text-xs text-fg-muted">Task baru ditambahkan di tab Task Name; kode dana baru di tab Kode Dana.</p>
      </fieldset>
      {p && <CentangAktif id="pr-aktif" aktif={aktif} onChange={setAktif} keterangan="Muncul sebagai pilihan Project Costing saat verifikasi PUM" />}
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button varian="kedua" onClick={onSelesai} disabled={simpan.isPending}>
          Batal
        </Button>
        <Button type="submit" memuat={simpan.isPending}>
          {p ? 'Simpan perubahan' : 'Tambah project'}
        </Button>
      </div>
    </form>
  );
}

// ───────────────────────────── Task ─────────────────────────────

function DaftarTask({ tahun, project, task }: { tahun: number; project: MasterProject[]; task: MasterTask[] }) {
  const simpan = useSimpanTask();
  const hapusMut = useHapusTask();
  const konfirmasi = useKonfirmasi();
  const [status, setStatus] = useState<FilterAktif>('aktif');
  const [cari, setCari] = useState('');
  const [form, setForm] = useState<{ open: boolean; t: MasterTask | null }>({ open: false, t: null });
  const jumlahProject = (id: number) => project.filter((p) => p.tasks.some((x) => x.id === id)).length;
  const tampil = task.filter((t) => cocokFilter(t.aktif, status) && cocokCari(cari, t.kode, t.nama));

  const ubahAktif = async (t: MasterTask) => {
    try {
      await simpan.mutateAsync({ id: t.id, data: { tahun: t.tahun, kode: t.kode, nama: t.nama, aktif: !t.aktif } });
      toast.success(`${t.kode} ${t.aktif ? 'dinonaktifkan' : 'diaktifkan kembali'}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal memperbarui status task');
    }
  };

  const hapus = async (t: MasterTask) => {
    const n = jumlahProject(t.id);
    const ok = await konfirmasi({
      judul: `Hapus task ${t.kode} (${t.tahun})?`,
      pesan: `${n > 0 ? `Task ini dilepas dari ${n} project. ` : ''}Pengajuan yang sudah memakai task ini tidak berubah.`,
      teksYa: 'Hapus task',
      varian: 'bahaya',
    });
    if (!ok) return;
    try {
      await hapusMut.mutateAsync(t.id);
      toast.success(`Task ${t.kode} dihapus`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal menghapus task');
    }
  };

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button ikon={<Plus className="size-4" />} onClick={() => setForm({ open: true, t: null })}>
          Tambah Task {tahun}
        </Button>
      </div>
      <BarisFilter
        status={status}
        onStatus={setStatus}
        jumlah={{ aktif: task.filter((t) => t.aktif).length, semua: task.length }}
        cari={cari}
        onCari={setCari}
        placeholder="Cari kode atau nama task…"
        labelCari="Cari task"
        layoutId="seg-task-status"
      />
      {tampil.length === 0 ? (
        <GlassCard>
          <Kosong
            ikon={<ListTodo />}
            judul={cari ? 'Task tidak ditemukan' : `Belum ada task ${tahun}`}
            deskripsi="Tambahkan task name (akun beban), lalu pasangkan ke project beserta kode dananya."
          />
        </GlassCard>
      ) : (
        <motion.ul layout aria-label="Daftar task" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {tampil.map((t) => (
              <motion.li key={t.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                <GlassCard className={cn('flex h-full items-start gap-3 p-4', !t.aktif && 'opacity-70')} data-task={t.kode}>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11.5px] font-semibold text-fg-muted">{t.kode}</p>
                    <p className="font-bold text-fg">{t.nama}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <ChipAktif aktif={t.aktif} />
                      <ChipInfo>{t.tahun}</ChipInfo>
                      <ChipInfo>{jumlahProject(t.id)} project</ChipInfo>
                    </div>
                  </div>
                  <MenuAksi label={`Aksi untuk task ${t.kode}`}>
                    <MenuItem ikon={<PencilLine />} onSelect={() => setForm({ open: true, t })}>
                      Ubah task
                    </MenuItem>
                    <MenuItem ikon={<Power />} onSelect={() => void ubahAktif(t)}>
                      {t.aktif ? 'Nonaktifkan' : 'Aktifkan kembali'}
                    </MenuItem>
                    <MenuPemisah />
                    <MenuItem ikon={<Trash />} bahaya onSelect={() => void hapus(t)}>
                      Hapus
                    </MenuItem>
                  </MenuAksi>
                </GlassCard>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
      <p className="mt-5 flex items-start gap-2 text-xs text-fg-muted">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden /> Saran Task Name otomatis memakai kata kunci di Master Jenis Pengajuan (mis. task yang
        namanya memuat “Konsumsi” untuk pengajuan Konsumsi).
      </p>
      <Modal
        open={form.open}
        onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))}
        terkunci={simpan.isPending}
        judul={form.t ? `Ubah task name ${form.t.tahun}` : `Tambah task name ${tahun}`}
        deskripsi="Disimpan di pengajuan sebagai “kode_nama”."
        ikon={<FolderTree className="size-5" />}
        lebar="sm"
      >
        <FormTask
          key={form.t?.id ?? `baru-${tahun}`}
          tahun={form.t?.tahun ?? tahun}
          t={form.t}
          simpan={simpan}
          onSelesai={() => setForm((f) => ({ ...f, open: false }))}
        />
      </Modal>
    </>
  );
}

function FormTask({
  tahun,
  t,
  simpan,
  onSelesai,
}: {
  tahun: number;
  t: MasterTask | null;
  simpan: ReturnType<typeof useSimpanTask>;
  onSelesai: () => void;
}) {
  const [kode, setKode] = useState(t?.kode ?? '');
  const [nama, setNama] = useState(t?.nama ?? '');
  const [aktif, setAktif] = useState(t?.aktif ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateTask({ tahun, kode, nama, aktif });
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    try {
      await simpan.mutateAsync({ id: t?.id, data: h.data });
      toast.success(t ? 'Task diperbarui' : `Task ${h.data.kode} (${tahun}) ditambahkan`);
      onSelesai();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors);
        if (Object.keys(err.errors).length === 0) toast.error(err.message);
      }
    }
  };

  return (
    <form onSubmit={kirim} className="space-y-4" noValidate>
      <Field label="Kode task" htmlFor="tk-kode" error={errors.kode} wajib hint={`Tahun anggaran ${tahun} · mis. 723207 (tanpa garis bawah)`}>
        <Input id="tk-kode" autoFocus className="font-mono" maxLength={30} value={kode} invalid={!!errors.kode} onChange={(e) => setKode(e.target.value)} />
      </Field>
      <Field label="Nama task" htmlFor="tk-nama" error={errors.nama} wajib hint="mis. Beban Konsumsi">
        <Input id="tk-nama" maxLength={120} value={nama} invalid={!!errors.nama} onChange={(e) => setNama(e.target.value)} />
      </Field>
      {kode.trim() && nama.trim() && (
        <p className="rounded-xl bg-fg/[0.04] px-3 py-2 text-xs text-fg-muted ring-1 ring-fg/[0.06]">
          Tersimpan di pengajuan sebagai <span className="font-mono font-semibold text-fg">{nilaiTask(kode.trim(), nama.trim().replace(/\s+/g, ' '))}</span>
        </p>
      )}
      {t && <CentangAktif id="tk-aktif" aktif={aktif} onChange={setAktif} keterangan="Muncul sebagai pilihan Task Name saat verifikasi PUM" />}
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button varian="kedua" onClick={onSelesai} disabled={simpan.isPending}>
          Batal
        </Button>
        <Button type="submit" memuat={simpan.isPending}>
          {t ? 'Simpan perubahan' : 'Tambah task'}
        </Button>
      </div>
    </form>
  );
}

// ───────────────────────────── Kode dana ─────────────────────────────

function DaftarDana({ dana }: { dana: MasterDana[] }) {
  const simpan = useSimpanDana();
  const hapusMut = useHapusDana();
  const konfirmasi = useKonfirmasi();
  const [form, setForm] = useState<{ open: boolean; d: MasterDana | null }>({ open: false, d: null });

  const ubahAktif = async (d: MasterDana) => {
    try {
      await simpan.mutateAsync({ kodeLama: d.kode, data: { kode: d.kode, nama: d.nama, aktif: !d.aktif } });
      toast.success(`Kode dana ${d.kode} ${d.aktif ? 'dinonaktifkan' : 'diaktifkan kembali'}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal memperbarui status kode dana');
    }
  };

  const hapus = async (d: MasterDana) => {
    const ok = await konfirmasi({
      judul: `Hapus kode dana ${d.kode}?`,
      pesan: 'Hanya kode dana yang belum dipakai pasangan project–task maupun pengajuan yang dapat dihapus.',
      teksYa: 'Hapus kode dana',
      varian: 'bahaya',
    });
    if (!ok) return;
    try {
      await hapusMut.mutateAsync(d.kode);
      toast.success(`Kode dana ${d.kode} dihapus`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal menghapus kode dana');
    }
  };

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button ikon={<Plus className="size-4" />} onClick={() => setForm({ open: true, d: null })}>
          Tambah Kode Dana
        </Button>
      </div>
      {dana.length === 0 ? (
        <GlassCard>
          <Kosong ikon={<Landmark />} judul="Belum ada kode dana" deskripsi="Tambahkan kode dana sesuai kolom DANA laporan sisa anggaran, mis. 51." />
        </GlassCard>
      ) : (
        <ul aria-label="Daftar kode dana" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {dana.map((d) => (
            <li key={d.kode}>
              <GlassCard className={cn('flex h-full items-start gap-3 p-4', !d.aktif && 'opacity-70')} data-dana={d.kode}>
                <span className="grid h-10 min-w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 px-2 font-mono text-sm font-bold text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
                  {d.kode}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-fg">{d.nama}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <ChipAktif aktif={d.aktif} />
                    <ChipInfo>{d.dipakai} pasangan</ChipInfo>
                  </div>
                </div>
                <MenuAksi label={`Aksi untuk kode dana ${d.kode}`}>
                  <MenuItem ikon={<PencilLine />} onSelect={() => setForm({ open: true, d })}>
                    Ubah nama
                  </MenuItem>
                  <MenuItem ikon={<Power />} onSelect={() => void ubahAktif(d)}>
                    {d.aktif ? 'Nonaktifkan' : 'Aktifkan kembali'}
                  </MenuItem>
                  <MenuPemisah />
                  <MenuItem ikon={<Trash />} bahaya disabled={d.dipakai > 0} onSelect={() => void hapus(d)}>
                    {d.dipakai > 0 ? 'Hapus (sudah dipakai)' : 'Hapus permanen'}
                  </MenuItem>
                </MenuAksi>
              </GlassCard>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-5 flex items-start gap-2 text-xs text-fg-muted">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden /> Kode dana dipasangkan ke tiap project–task di tab Project Costing. Saat PUM memilih
        task & project, kode dananya terisi otomatis dan tersimpan di pengajuan.
      </p>
      <Modal
        open={form.open}
        onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))}
        terkunci={simpan.isPending}
        judul={form.d ? `Ubah kode dana ${form.d.kode}` : 'Tambah kode dana'}
        deskripsi="Kode sumber dana anggaran (kolom DANA pada laporan sisa anggaran)."
        ikon={<Landmark className="size-5" />}
        lebar="sm"
      >
        <FormDana key={form.d?.kode ?? 'baru'} d={form.d} simpan={simpan} onSelesai={() => setForm((f) => ({ ...f, open: false }))} />
      </Modal>
    </>
  );
}

function FormDana({ d, simpan, onSelesai }: { d: MasterDana | null; simpan: ReturnType<typeof useSimpanDana>; onSelesai: () => void }) {
  const [kode, setKode] = useState(d?.kode ?? '');
  const [nama, setNama] = useState(d?.nama ?? '');
  const [aktif, setAktif] = useState(d?.aktif ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateDana({ kode, nama, aktif });
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    try {
      await simpan.mutateAsync({ kodeLama: d?.kode, data: h.data });
      toast.success(d ? 'Kode dana diperbarui' : `Kode dana ${h.data.kode} ditambahkan`);
      onSelesai();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors);
        if (Object.keys(err.errors).length === 0) toast.error(err.message);
      }
    }
  };

  return (
    <form onSubmit={kirim} className="space-y-4" noValidate>
      <Field label="Kode dana" htmlFor="dn-kode" error={errors.kode} wajib hint={d ? 'Kode tidak dapat diubah' : 'mis. 51'}>
        <Input id="dn-kode" autoFocus={!d} className="font-mono" maxLength={20} value={kode} disabled={!!d} invalid={!!errors.kode} onChange={(e) => setKode(e.target.value)} />
      </Field>
      <Field label="Nama sumber dana" htmlFor="dn-nama" error={errors.nama} wajib hint="mis. Dana Masyarakat (BP) - Tidak Terikat">
        <Input id="dn-nama" autoFocus={!!d} maxLength={100} value={nama} invalid={!!errors.nama} onChange={(e) => setNama(e.target.value)} />
      </Field>
      {d && <CentangAktif id="dn-aktif" aktif={aktif} onChange={setAktif} keterangan="Dapat dipilih pada pasangan project–task & saat verifikasi PUM" />}
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button varian="kedua" onClick={onSelesai} disabled={simpan.isPending}>
          Batal
        </Button>
        <Button type="submit" memuat={simpan.isPending}>
          {d ? 'Simpan perubahan' : 'Tambah kode dana'}
        </Button>
      </div>
    </form>
  );
}
