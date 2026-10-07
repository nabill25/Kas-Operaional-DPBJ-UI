import { PencilLine, ShieldCheck, UserCog, UserPlus } from 'lucide-react';
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
import { ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { useSimpanUser, useUsers } from '../lib/queries';

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

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ROLE_LIST.map((r, i) => (
          <GlassCard key={r} className="p-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-bold', GAYA_PERAN[r])}>{ROLE_LABEL[r]}</span>
            <p className="mt-2 text-xs text-fg-muted">{ROLE_KETERANGAN[r]}</p>
            <p className="mt-1 text-sm font-bold text-fg">{data.filter((u) => u.role === r && u.aktif).length} akun aktif</p>
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
            {data.map((u, i) => (
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
                    {u.username} · dibuat {formatTanggal(u.created_at, 'pendek')}
                  </p>
                </div>
                <span className={cn('hidden rounded-full px-2.5 py-1 text-xs font-bold sm:inline-flex', GAYA_PERAN[u.role])}>
                  {ROLE_LABEL[u.role]}
                </span>
                <span
                  className={cn(
                    'hidden rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset md:inline-flex',
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
    </div>
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Peran">
          {ROLE_LIST.map((r) => (
            <label
              key={r}
              className={cn(
                'flex gap-2.5 rounded-2xl px-3 py-2.5 ring-1 transition',
                role === r ? 'bg-kuning-400/15 ring-2 ring-kuning-500' : 'bg-fg/[0.03] ring-fg/10 hover:ring-fg/20',
                diriSendiri ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
              )}
            >
              <input
                type="radio"
                name="u-role"
                value={r}
                checked={role === r}
                disabled={diriSendiri && role !== r}
                onChange={() => setRole(r)}
                className="mt-0.5 size-4 shrink-0 accent-kuning-500"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-fg">{ROLE_LABEL[r]}</span>
                <span className="block text-[11px] leading-snug text-fg-muted">{ROLE_KETERANGAN[r]}</span>
              </span>
            </label>
          ))}
        </div>
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
