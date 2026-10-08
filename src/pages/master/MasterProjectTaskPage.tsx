import { FolderKanban, FolderTree, Info, ListTodo, PencilLine, Plus, Power, Search, Trash } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { nilaiProject, nilaiTask } from '../../../shared/project-task';
import type { MasterProject, MasterTask } from '../../../shared/types';
import { validateProject, validateTask } from '../../../shared/validation';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { GlassCard } from '../../components/ui/GlassCard';
import { Kosong, Skeleton } from '../../components/ui/Kosong';
import { MenuItem, MenuPemisah } from '../../components/ui/Menu';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Segmented } from '../../components/ui/Segmented';
import { useKonfirmasi } from '../../context/KonfirmasiContext';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useHapusProject, useHapusTask, useProjectTask, useSimpanProject, useSimpanTask } from '../../lib/queries';
import { BarisFilter, CentangAktif, ChipAktif, ChipInfo, MenuAksi, cocokCari, cocokFilter, type FilterAktif } from './bersama';

type Tab = 'project' | 'task';
const urutKode = (a: { kode: string }, b: { kode: string }) => a.kode.localeCompare(b.kode, 'en', { numeric: true });

export default function MasterProjectTaskPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'task' ? 'task' : 'project';
  const { data, isLoading } = useProjectTask();
  const project = useMemo(() => [...(data?.project ?? [])].sort(urutKode), [data]);
  const task = useMemo(() => [...(data?.task ?? [])].sort(urutKode), [data]);

  return (
    <div>
      <PageHeader
        judul="Master Project Costing & Task Name"
        deskripsi="Daftar dari Kasubdit yang muncul di kotak cari saat PUM memverifikasi. Nilai yang sudah tersimpan di pengajuan tidak ikut berubah bila master diubah atau dihapus."
      />
      <Segmented
        label="Jenis data"
        layoutId="seg-project-task"
        className="mb-5"
        value={tab}
        onChange={(v) => setParams(v === 'project' ? {} : { tab: v }, { replace: true })}
        opsi={[
          { value: 'project', label: 'Project Costing', ikon: <FolderKanban />, jumlah: project.length },
          { value: 'task', label: 'Task Name', ikon: <ListTodo />, jumlah: task.length },
        ]}
      />
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      ) : tab === 'project' ? (
        <DaftarProject project={project} task={task} />
      ) : (
        <DaftarTask project={project} task={task} />
      )}
    </div>
  );
}

// ───────────────────────────── Project ─────────────────────────────

function DaftarProject({ project, task }: { project: MasterProject[]; task: MasterTask[] }) {
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
      await simpan.mutateAsync({ id: p.id, data: { kode: p.kode, nama: p.nama, aktif: !p.aktif, task_ids: p.task_ids } });
      toast.success(`${p.kode} ${p.aktif ? 'dinonaktifkan' : 'diaktifkan kembali'}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal memperbarui status project');
    }
  };

  const hapus = async (p: MasterProject) => {
    const ok = await konfirmasi({
      judul: `Hapus project ${p.kode}?`,
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
          Tambah Project
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
          <Kosong ikon={<FolderKanban />} judul={cari ? 'Project tidak ditemukan' : 'Belum ada project'} deskripsi="Tambahkan project costing beserta task-task-nya." />
        </GlassCard>
      ) : (
        <motion.ul layout aria-label="Daftar project" className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {tampil.map((p) => {
              const tasks = p.task_ids
                .map((id) => petaTask.get(id))
                .filter((t): t is MasterTask => !!t)
                .sort(urutKode);
              return (
                <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <GlassCard className={cn('flex h-full items-start gap-3 p-4', !p.aktif && 'opacity-70')} data-project={p.kode}>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11.5px] font-semibold text-fg-muted">{p.kode}</p>
                      <p className="font-bold text-fg">{p.nama}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <ChipAktif aktif={p.aktif} />
                        <ChipInfo>{tasks.length} task</ChipInfo>
                      </div>
                      {tasks.length > 0 && (
                        <ul className="mt-2.5 space-y-1" aria-label={`Task project ${p.kode}`}>
                          {tasks.map((t) => (
                            <li key={t.id} className={cn('flex gap-2 text-xs', !t.aktif && 'text-fg-subtle line-through')}>
                              <span className="font-mono text-fg-muted">{t.kode}</span>
                              <span className="min-w-0 text-fg">{t.nama}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <MenuAksi label={`Aksi untuk project ${p.kode}`}>
                      <MenuItem ikon={<PencilLine />} onSelect={() => setForm({ open: true, p })}>
                        Ubah project & task
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
        judul={form.p ? 'Ubah project costing' : 'Tambah project costing'}
        deskripsi="Disimpan di pengajuan sebagai “kode:nama”. Centang task yang sah untuk project ini."
        ikon={<FolderKanban className="size-5" />}
        lebar="lg"
      >
        <FormProject key={form.p?.id ?? 'baru'} p={form.p} task={task} simpan={simpan} onSelesai={() => setForm((f) => ({ ...f, open: false }))} />
      </Modal>
    </>
  );
}

function FormProject({
  p,
  task,
  simpan,
  onSelesai,
}: {
  p: MasterProject | null;
  task: MasterTask[];
  simpan: ReturnType<typeof useSimpanProject>;
  onSelesai: () => void;
}) {
  const [kode, setKode] = useState(p?.kode ?? '');
  const [nama, setNama] = useState(p?.nama ?? '');
  const [aktif, setAktif] = useState(p?.aktif ?? true);
  const [dipilih, setDipilih] = useState<number[]>(p?.task_ids ?? []);
  const [cari, setCari] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Task nonaktif tetap ditampilkan bila sudah terpilih (agar bisa dilepas).
  const pilihan = task.filter((t) => (t.aktif || dipilih.includes(t.id)) && cocokCari(cari, t.kode, t.nama));

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateProject({ kode, nama, aktif, task_ids: dipilih });
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    try {
      await simpan.mutateAsync({ id: p?.id, data: h.data });
      toast.success(p ? 'Project diperbarui' : `Project ${h.data.kode} ditambahkan`);
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
        <Field label="Kode project" htmlFor="pr-kode" error={errors.kode} wajib hint="mis. D0030.09.01.6.002">
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
          Task yang sah untuk project ini
          <span className="text-xs font-semibold text-fg-muted">{dipilih.length} dipilih</span>
        </legend>
        <label className="relative mb-2 block">
          <span className="sr-only">Cari task</span>
          <Search className="pointer-events-none absolute top-1/2 z-10 left-3 size-4 -translate-y-1/2 text-fg-muted" />
          <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari kode atau nama task…" className="h-10 pl-9" />
        </label>
        <ul className="max-h-64 space-y-1 overflow-y-auto rounded-2xl bg-fg/[0.03] p-1.5 ring-1 ring-fg/[0.06]" aria-label="Pilihan task">
          {pilihan.length === 0 && <li className="px-3 py-3 text-center text-sm text-fg-muted">Tidak ada task yang cocok.</li>}
          {pilihan.map((t) => {
            const aktifPilih = dipilih.includes(t.id);
            return (
              <li key={t.id}>
                <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl px-2.5 py-2 text-sm hover:bg-fg/[0.04]', aktifPilih && 'bg-kuning-400/12')}>
                  <input
                    type="checkbox"
                    checked={aktifPilih}
                    onChange={() => setDipilih((d) => (aktifPilih ? d.filter((x) => x !== t.id) : [...d, t.id]))}
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
              </li>
            );
          })}
        </ul>
        {errors.task_ids && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{errors.task_ids}</p>}
        <p className="mt-1.5 text-xs text-fg-muted">Task baru ditambahkan di tab Task Name.</p>
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

function DaftarTask({ project, task }: { project: MasterProject[]; task: MasterTask[] }) {
  const simpan = useSimpanTask();
  const hapusMut = useHapusTask();
  const konfirmasi = useKonfirmasi();
  const [status, setStatus] = useState<FilterAktif>('aktif');
  const [cari, setCari] = useState('');
  const [form, setForm] = useState<{ open: boolean; t: MasterTask | null }>({ open: false, t: null });
  const jumlahProject = (id: number) => project.filter((p) => p.task_ids.includes(id)).length;
  const tampil = task.filter((t) => cocokFilter(t.aktif, status) && cocokCari(cari, t.kode, t.nama));

  const ubahAktif = async (t: MasterTask) => {
    try {
      await simpan.mutateAsync({ id: t.id, data: { kode: t.kode, nama: t.nama, aktif: !t.aktif } });
      toast.success(`${t.kode} ${t.aktif ? 'dinonaktifkan' : 'diaktifkan kembali'}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal memperbarui status task');
    }
  };

  const hapus = async (t: MasterTask) => {
    const n = jumlahProject(t.id);
    const ok = await konfirmasi({
      judul: `Hapus task ${t.kode}?`,
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
          Tambah Task
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
          <Kosong ikon={<ListTodo />} judul={cari ? 'Task tidak ditemukan' : 'Belum ada task'} deskripsi="Tambahkan task name (akun beban), lalu pasangkan ke project." />
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
        judul={form.t ? 'Ubah task name' : 'Tambah task name'}
        deskripsi="Disimpan di pengajuan sebagai “kode_nama”."
        ikon={<FolderTree className="size-5" />}
        lebar="sm"
      >
        <FormTask key={form.t?.id ?? 'baru'} t={form.t} simpan={simpan} onSelesai={() => setForm((f) => ({ ...f, open: false }))} />
      </Modal>
    </>
  );
}

function FormTask({ t, simpan, onSelesai }: { t: MasterTask | null; simpan: ReturnType<typeof useSimpanTask>; onSelesai: () => void }) {
  const [kode, setKode] = useState(t?.kode ?? '');
  const [nama, setNama] = useState(t?.nama ?? '');
  const [aktif, setAktif] = useState(t?.aktif ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateTask({ kode, nama, aktif });
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    try {
      await simpan.mutateAsync({ id: t?.id, data: h.data });
      toast.success(t ? 'Task diperbarui' : `Task ${h.data.kode} ditambahkan`);
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
      <Field label="Kode task" htmlFor="tk-kode" error={errors.kode} wajib hint="mis. 723207 (tanpa garis bawah)">
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
