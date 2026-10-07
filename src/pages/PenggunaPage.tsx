import { PencilLine, ShieldCheck, UserCheck, UserCog, UserPlus, UserX } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ROLE_KETERANGAN, ROLE_LABEL, ROLE_LIST, type Role } from '../../shared/constants';
import { formatTanggal } from '../../shared/format';
import type { User } from '../../shared/types';
import { validateUser } from '../../shared/validation';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Kosong';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useUser } from '../context/AuthContext';
import { useKonfirmasi } from '../context/KonfirmasiContext';
import { ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { useSetujuiPendaftaran, useSimpanUser, useTolakPendaftaran, useUsers } from '../lib/queries';

const GAYA_PERAN: Record<Role, string> = {
  operator: 'bg-blue-500/12 text-blue-700 ring-1 ring-blue-500/20 dark:text-blue-300',
  pum: 'bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300',
  pimpinan: 'bg-amber-400/20 text-amber-800 ring-1 ring-amber-500/25 dark:text-amber-200',
  admin: 'bg-navy-900 text-kuning-300 dark:bg-kuning-400 dark:text-navy-950',
};

export default function PenggunaPage() {
  const saya = useUser();
  const { data = [], isLoading } = useUsers();
  const [form, setForm] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [disetujui, setDisetujui] = useState<User | null>(null);
  const tolakMut = useTolakPendaftaran();
  const konfirmasi = useKonfirmasi();
  const menunggu = data.filter((u) => u.menunggu_persetujuan);
  const akun = data.filter((u) => !u.menunggu_persetujuan);

  const tolak = async (u: User) => {
    const ok = await konfirmasi({
      judul: 'Tolak pendaftaran?',
      pesan: (
        <>
          Pendaftaran <b className="text-fg">{u.nama}</b> ({u.username}) akan dihapus, termasuk akun loginnya.
        </>
      ),
      teksYa: 'Tolak & hapus',
      varian: 'bahaya',
    });
    if (!ok) return;
    try {
      await tolakMut.mutateAsync(u.id);
      toast.success(`Pendaftaran ${u.nama} ditolak`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal menolak pendaftaran');
    }
  };

  return (
    <div>
      <PageHeader
        judul="Kelola Pengguna"
        deskripsi="Akun yang dapat masuk ke sistem beserta perannya."
        aksi={
          <Button ikon={<UserPlus className="size-4" />} onClick={() => setForm({ open: true, user: null })}>
            Tambah Pengguna
          </Button>
        }
      />


      {menunggu.length > 0 && (
        <GlassCard className="mb-5 overflow-hidden" data-bagian="menunggu-persetujuan">
          <div className="flex items-start gap-3 border-b border-line px-5 py-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-500/12 text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-300">
              <UserPlus className="size-4.5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-fg">
                Menunggu persetujuan <span className="text-fg-muted">({menunggu.length})</span>
              </h2>
              <p className="mt-0.5 text-xs text-fg-muted">Pendaftaran mandiri. Pilih peran lalu setujui, atau tolak bila tidak dikenal.</p>
            </div>
          </div>
          <ul className="divide-y divide-line">
            {menunggu.map((u) => (
              <li key={u.id} data-pendaftar={u.username} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                  <Avatar nama={u.nama} className="size-10" />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-fg">{u.nama}</p>
                    <p className="truncate text-xs text-fg-muted">{u.username}</p>
                    <p className="text-[11px] text-fg-subtle">Mendaftar {formatTanggal(u.created_at, 'pendek')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                  <Button varian="kedua" ukuran="sm" ikon={<UserX className="size-4" />} onClick={() => void tolak(u)} disabled={tolakMut.isPending}>
                    Tolak
                  </Button>
                  <Button varian="sukses" ukuran="sm" ikon={<UserCheck className="size-4" />} onClick={() => setDisetujui(u)}>
                    Setujui
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
        {ROLE_LIST.map((r, i) => (
          <GlassCard
            key={r}
            className="flex items-center justify-between gap-3 px-4 py-3 sm:block sm:p-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap', GAYA_PERAN[r])}>{ROLE_LABEL[r]}</span>
            <p className="mt-2 hidden text-xs text-fg-muted sm:block">{ROLE_KETERANGAN[r]}</p>
            <p className="shrink-0 text-sm font-bold text-fg sm:mt-1">{data.filter((u) => u.role === r && u.aktif).length} akun aktif</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-2xl" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {akun.map((u, i) => (
              <motion.li
                key={u.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn('flex items-center gap-3.5 px-5 py-4', !u.aktif && 'opacity-60')}
              >
                <Avatar nama={u.nama} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-bold text-fg">
                    {u.nama}
                    {u.id === saya.id && <span className="rounded-md bg-kuning-400/25 px-1.5 py-0.5 text-[10px] font-bold text-kuning-900 dark:text-kuning-200">Anda</span>}
                  </p>
                  <p className="truncate text-xs text-fg-muted">
                    {u.username}
                    <span className="hidden sm:inline"> · dibuat {formatTanggal(u.created_at, 'pendek')}</span>
                  </p>
                  {/* HP: peran & status tampil di bawah email (kolomnya disembunyikan di layar sempit) */}
                  <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap', GAYA_PERAN[u.role])}>
                      {ROLE_LABEL[u.role]}
                    </span>
                    {!u.aktif && (
                      <span className="inline-flex rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-500/20 ring-inset dark:text-slate-300">
                        Nonaktif
                      </span>
                    )}
                  </div>
                </div>
                <span className={cn('hidden rounded-full px-2.5 py-1 text-xs font-bold sm:inline-flex', GAYA_PERAN[u.role])}>
                  {ROLE_LABEL[u.role]}
                </span>
                <span
                  className={cn(
                    'hidden rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset sm:inline-flex',
                    u.aktif
                      ? 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300'
                      : 'bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300',
                  )}
                >
                  {u.aktif ? 'Aktif' : 'Nonaktif'}
                </span>
                <Button varian="hantu" ukuran="ikon" onClick={() => setForm({ open: true, user: u })} aria-label={`Ubah ${u.nama}`}>
                  <PencilLine className="size-4" />
                </Button>
              </motion.li>
            ))}
          </ul>
        )}
      </GlassCard>

      <FormPenggunaModal
        open={form.open}
        user={form.user}
        diriSendiri={form.user?.id === saya.id}
        onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))}
      />
      <SetujuiModal user={disetujui} onTutup={() => setDisetujui(null)} />
    </div>
  );
}

/** Pilihan peran (radio) — dipakai form pengguna & dialog persetujuan pendaftaran. */
function PilihPeran({
  nama,
  nilai,
  onUbah,
  terkunci = false,
}: {
  nama: string;
  nilai: Role;
  onUbah: (r: Role) => void;
  terkunci?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Peran">
      {ROLE_LIST.map((r) => (
        <label
          key={r}
          className={cn(
            'flex gap-2.5 rounded-2xl px-3 py-2.5 ring-1 transition',
            nilai === r ? 'bg-kuning-400/15 ring-2 ring-kuning-500' : 'bg-fg/[0.03] ring-fg/10 hover:ring-fg/20',
            terkunci ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
          )}
        >
          <input
            type="radio"
            name={nama}
            value={r}
            checked={nilai === r}
            disabled={terkunci && nilai !== r}
            onChange={() => onUbah(r)}
            className="mt-0.5 size-4 shrink-0 accent-kuning-500"
          />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-fg">{ROLE_LABEL[r]}</span>
            <span className="block text-[11px] leading-snug text-fg-muted">{ROLE_KETERANGAN[r]}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function SetujuiModal({ user, onTutup }: { user: User | null; onTutup: () => void }) {
  const setujui = useSetujuiPendaftaran();
  return (
    <Modal
      open={!!user}
      onOpenChange={(o) => !o && onTutup()}
      terkunci={setujui.isPending}
      judul="Setujui pendaftaran"
      deskripsi={user ? `${user.nama} · ${user.username}` : undefined}
      ikon={<UserCheck className="size-5" />}
    >
      {user && <IsiSetujui key={user.id} user={user} setujui={setujui} onSelesai={onTutup} />}
    </Modal>
  );
}

function IsiSetujui({
  user,
  setujui,
  onSelesai,
}: {
  user: User;
  setujui: ReturnType<typeof useSetujuiPendaftaran>;
  onSelesai: () => void;
}) {
  const [role, setRole] = useState<Role>('operator');
  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await setujui.mutateAsync({ id: user.id, role });
      toast.success(`Akun ${user.nama} disetujui sebagai ${ROLE_LABEL[role]}`);
      onSelesai();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal menyetujui pendaftaran');
    }
  };
  return (
    <form onSubmit={kirim} className="space-y-4" noValidate>
      <p className="text-sm text-fg-muted">Pilih peran untuk akun ini. Setelah disetujui, akun langsung dapat masuk.</p>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-fg">
          Peran <span className="text-red-500">*</span>
        </legend>
        <PilihPeran nama="s-role" nilai={role} onUbah={setRole} />
      </fieldset>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button varian="kedua" onClick={onSelesai} disabled={setujui.isPending}>
          Batal
        </Button>
        <Button type="submit" varian="sukses" memuat={setujui.isPending} ikon={<UserCheck className="size-4" />}>
          Setujui & aktifkan
        </Button>
      </div>
    </form>
  );
}

function FormPenggunaModal({
  open,
  user,
  diriSendiri,
  onOpenChange,
}: {
  open: boolean;
  user: User | null;
  diriSendiri: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const simpan = useSimpanUser();
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      terkunci={simpan.isPending}
      judul={user ? 'Ubah pengguna' : 'Tambah pengguna'}
      deskripsi={user ? 'Kosongkan password bila tidak ingin mengganti.' : 'Password awal minimal 6 karakter.'}
      ikon={user ? <UserCog className="size-5" /> : <UserPlus className="size-5" />}
    >
      <IsiFormPengguna key={user?.id ?? 'baru'} user={user} diriSendiri={diriSendiri} simpan={simpan} onSelesai={() => onOpenChange(false)} />
    </Modal>
  );
}

function IsiFormPengguna({
  user,
  diriSendiri,
  simpan,
  onSelesai,
}: {
  user: User | null;
  diriSendiri: boolean;
  simpan: ReturnType<typeof useSimpanUser>;
  onSelesai: () => void;
}) {
  const [username, setUsername] = useState(user?.username ?? '');
  const [nama, setNama] = useState(user?.nama ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? 'operator');
  const [password, setPassword] = useState('');
  const [aktif, setAktif] = useState(user?.aktif ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const data = { username, nama, role, password, aktif };
    const h = validateUser(data, user ? 'ubah' : 'buat');
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    try {
      await simpan.mutateAsync({ id: user?.id, data });
      toast.success(user ? 'Pengguna diperbarui' : `Akun ${h.data.username} dibuat`);
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nama" htmlFor="u-nama" error={errors.nama} wajib>
          <Input id="u-nama" autoFocus value={nama} invalid={!!errors.nama} onChange={(e) => setNama(e.target.value)} />
        </Field>
        <Field label="Email (untuk login)" htmlFor="u-username" error={errors.username} wajib>
          <Input
            id="u-username"
            value={username}
            placeholder="nama@instansi.go.id"
            autoComplete="off"
            inputMode="email"
            invalid={!!errors.username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
          />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-fg">
          Peran <span className="text-red-500">*</span>
        </legend>
        <PilihPeran nama="u-role" nilai={role} onUbah={setRole} terkunci={diriSendiri} />
        {diriSendiri && <p className="mt-1.5 text-xs text-fg-muted">Anda tidak dapat mengubah peran akun sendiri.</p>}
        {errors.role && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            {errors.role}
          </p>
        )}
      </fieldset>
      <Field
        label={user ? 'Password baru (opsional)' : 'Password'}
        htmlFor="u-password"
        error={errors.password}
        wajib={!user}
        hint="Minimal 6 karakter"
      >
        <Input
          id="u-password"
          type="password"
          autoComplete="new-password"
          value={password}
          invalid={!!errors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {user && (
        <label
          className={cn(
            'flex items-center justify-between gap-3 rounded-2xl bg-fg/[0.04] px-4 py-3 ring-1 ring-fg/[0.06]',
            diriSendiri ? 'opacity-60' : 'cursor-pointer',
          )}
        >
          <span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-fg">
              <ShieldCheck className="size-4 text-fg-muted" /> Akun aktif
            </span>
            <span className="text-xs text-fg-muted">
              {diriSendiri ? 'Anda tidak dapat menonaktifkan akun sendiri' : 'Akun nonaktif tidak dapat masuk'}
            </span>
          </span>
          <input
            type="checkbox"
            className="size-5 accent-kuning-500"
            checked={aktif}
            disabled={diriSendiri}
            onChange={(e) => setAktif(e.target.checked)}
          />
        </label>
      )}
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button varian="kedua" onClick={onSelesai} disabled={simpan.isPending}>
          Batal
        </Button>
        <Button type="submit" memuat={simpan.isPending}>
          {user ? 'Simpan perubahan' : 'Buat akun'}
        </Button>
      </div>
    </form>
  );
}
