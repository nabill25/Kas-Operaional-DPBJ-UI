import { ChartColumn, Ellipsis, PencilLine, Power, Search, Trash, UserPlus, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { Pegawai } from '../../shared/types';
import { validatePegawai } from '../../shared/validation';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { GlassCard } from '../components/ui/GlassCard';
import { Kosong, Skeleton } from '../components/ui/Kosong';
import { Menu, MenuItem, MenuPemisah } from '../components/ui/Menu';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Segmented } from '../components/ui/Segmented';
import { useAuth } from '../context/AuthContext';
import { useKonfirmasi } from '../context/KonfirmasiContext';
import { ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { useAktifPegawai, useHapusPegawai, usePegawai, useSimpanPegawai } from '../lib/queries';

type FilterStatus = 'aktif' | 'nonaktif' | 'semua';

export default function PegawaiPage() {
  const { punyaPeran } = useAuth();
  const navigate = useNavigate();
  const konfirmasi = useKonfirmasi();
  const { data = [], isLoading } = usePegawai();
  const aktifMut = useAktifPegawai();
  const hapusMut = useHapusPegawai();
  const [cari, setCari] = useState('');
  const [status, setStatus] = useState<FilterStatus>('aktif');
  const [form, setForm] = useState<{ open: boolean; pegawai: Pegawai | null }>({ open: false, pegawai: null });

  const bisaKelola = punyaPeran('operator', 'admin');
  const admin = punyaPeran('admin');

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return data
      .filter((p) => (status === 'semua' ? true : status === 'aktif' ? p.aktif : !p.aktif))
      .filter((p) => !q || p.nama.toLowerCase().includes(q) || (p.nip ?? '').includes(q) || (p.jabatan ?? '').toLowerCase().includes(q));
  }, [data, cari, status]);

  const jumlahAktif = data.filter((p) => p.aktif).length;

  const ubahAktif = async (p: Pegawai) => {
    try {
      await aktifMut.mutateAsync({ id: p.id, aktif: !p.aktif });
      toast.success(`${p.nama} ${p.aktif ? 'dinonaktifkan' : 'diaktifkan kembali'}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal memperbarui status');
    }
  };

  const hapus = async (p: Pegawai) => {
    const ok = await konfirmasi({
      judul: `Hapus ${p.nama}?`,
      pesan: 'Data pegawai akan dihapus permanen. Hanya pegawai yang belum pernah dipakai di pengajuan yang dapat dihapus.',
      teksYa: 'Hapus pegawai',
      varian: 'bahaya',
    });
    if (!ok) return;
    try {
      await hapusMut.mutateAsync(p.id);
      toast.success(`${p.nama} dihapus`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal menghapus pegawai');
    }
  };

  return (
    <div>
      <PageHeader
        judul="Master Pegawai"
        deskripsi="Daftar orang (dengan ID tersendiri) untuk “uang siapa” dan peserta transport — dasar rekap per orang."
        aksi={
          bisaKelola && (
            <Button ikon={<UserPlus className="size-4" />} onClick={() => setForm({ open: true, pegawai: null })}>
              Tambah Pegawai
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented
          label="Status pegawai"
          layoutId="seg-pegawai-status"
          value={status}
          onChange={setStatus}
          opsi={[
            { value: 'aktif', label: 'Aktif', jumlah: jumlahAktif },
            { value: 'nonaktif', label: 'Nonaktif', jumlah: data.length - jumlahAktif },
            { value: 'semua', label: 'Semua', jumlah: data.length },
          ]}
        />
        <label className="relative flex-1">
          <span className="sr-only">Cari pegawai</span>
          <Search className="pointer-events-none absolute top-1/2 z-10 left-3.5 size-4 -translate-y-1/2 text-fg-muted" />
          <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama, NIP/NUP, atau jabatan…" className="pl-10" />
        </label>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      ) : tampil.length === 0 ? (
        <GlassCard>
          <Kosong
            ikon={<Users />}
            judul={cari ? 'Pegawai tidak ditemukan' : 'Belum ada pegawai'}
            deskripsi={cari ? 'Coba kata kunci lain.' : 'Tambahkan pegawai agar dapat dipilih pada pengajuan.'}
          />
        </GlassCard>
      ) : (
        <motion.ul layout aria-label="Daftar pegawai" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {tampil.map((p, i) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: Math.min(i, 12) * 0.025 }}
              >
                <GlassCard interaktif className={cn('flex h-full items-start gap-3.5 p-4', !p.aktif && 'opacity-70')}>
                  <Avatar nama={p.nama} className="size-11 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-fg">{p.nama}</p>
                    <p className="truncate text-xs text-fg-muted">{p.jabatan || 'Tanpa jabatan'}</p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-fg-subtle">{p.nip ? `NIP ${p.nip}` : 'NIP/NUP belum diisi'}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset',
                          p.aktif
                            ? 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300'
                            : 'bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300',
                        )}
                      >
                        {p.aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <span className="rounded-full bg-fg/[0.05] px-2 py-0.5 text-[11px] font-semibold text-fg-muted">
                        {p.dipakai} pengajuan
                      </span>
                    </div>
                  </div>
                  <Menu
                    lebar="w-56"
                    pemicu={
                      <button
                        type="button"
                        className="grid size-9 shrink-0 place-items-center rounded-xl text-fg-muted transition hover:bg-fg/[0.06] hover:text-fg"
                        aria-label={`Aksi untuk ${p.nama}`}
                      >
                        <Ellipsis className="size-4" />
                      </button>
                    }
                  >
                    <MenuItem ikon={<ChartColumn />} onSelect={() => navigate(`/pengajuan?pegawai_id=${p.id}`)}>
                      Lihat pengajuan terkait
                    </MenuItem>
                    {bisaKelola && (
                      <MenuItem ikon={<PencilLine />} onSelect={() => setForm({ open: true, pegawai: p })}>
                        Ubah data
                      </MenuItem>
                    )}
                    {admin && (
                      <>
                        <MenuPemisah />
                        <MenuItem ikon={<Power />} onSelect={() => void ubahAktif(p)}>
                          {p.aktif ? 'Nonaktifkan' : 'Aktifkan kembali'}
                        </MenuItem>
                        <MenuItem ikon={<Trash />} bahaya disabled={p.dipakai > 0} onSelect={() => void hapus(p)}>
                          {p.dipakai > 0 ? 'Hapus (sudah dipakai)' : 'Hapus permanen'}
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                </GlassCard>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <FormPegawaiModal
        open={form.open}
        pegawai={form.pegawai}
        onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))}
      />
    </div>
  );
}

function FormPegawaiModal({
  open,
  pegawai,
  onOpenChange,
}: {
  open: boolean;
  pegawai: Pegawai | null;
  onOpenChange: (o: boolean) => void;
}) {
  const simpan = useSimpanPegawai();
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      terkunci={simpan.isPending}
      judul={pegawai ? 'Ubah data pegawai' : 'Tambah pegawai'}
      deskripsi="NIP/NUP opsional, namun bila diisi harus unik."
      ikon={pegawai ? <PencilLine className="size-5" /> : <UserPlus className="size-5" />}
      lebar="sm"
    >
      <IsiFormPegawai key={pegawai?.id ?? 'baru'} pegawai={pegawai} simpan={simpan} onSelesai={() => onOpenChange(false)} />
    </Modal>
  );
}

function IsiFormPegawai({
  pegawai,
  simpan,
  onSelesai,
}: {
  pegawai: Pegawai | null;
  simpan: ReturnType<typeof useSimpanPegawai>;
  onSelesai: () => void;
}) {
  const [nama, setNama] = useState(pegawai?.nama ?? '');
  const [nip, setNip] = useState(pegawai?.nip ?? '');
  const [jabatan, setJabatan] = useState(pegawai?.jabatan ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validatePegawai({ nama, nip, jabatan });
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    try {
      const p = await simpan.mutateAsync({ id: pegawai?.id, data: { nama, nip, jabatan } });
      toast.success(pegawai ? 'Data pegawai diperbarui' : `${p.nama} ditambahkan`);
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
      <Field label="Nama lengkap" htmlFor="pg-nama" error={errors.nama} wajib>
        <Input id="pg-nama" autoFocus value={nama} maxLength={120} invalid={!!errors.nama} onChange={(e) => setNama(e.target.value)} />
      </Field>
      <Field label="NIP / NUP" htmlFor="pg-nip" error={errors.nip} hint="Hanya angka; spasi akan dihapus otomatis">
        <Input id="pg-nip" inputMode="numeric" value={nip} invalid={!!errors.nip} onChange={(e) => setNip(e.target.value)} />
      </Field>
      <Field label="Jabatan" htmlFor="pg-jabatan" error={errors.jabatan}>
        <Input id="pg-jabatan" value={jabatan} maxLength={120} onChange={(e) => setJabatan(e.target.value)} />
      </Field>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button varian="kedua" onClick={onSelesai} disabled={simpan.isPending}>
          Batal
        </Button>
        <Button type="submit" memuat={simpan.isPending}>
          {pegawai ? 'Simpan perubahan' : 'Tambah pegawai'}
        </Button>
      </div>
    </form>
  );
}
