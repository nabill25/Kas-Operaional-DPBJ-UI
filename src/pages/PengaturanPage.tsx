import { Check, KeyRound, Landmark, Palette, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { CATATAN_BIAYA_TRANSFER, ROLE_LABEL, isBankMandiri } from '../../shared/constants';
import type { ProfilAkun } from '../../shared/types';
import { validateProfilRekening } from '../../shared/validation';
import { GantiPasswordModal } from '../components/layout/GantiPasswordModal';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { GlassCard, JudulKartu } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Kosong';
import { PageHeader } from '../components/ui/PageHeader';
import { useUser } from '../context/AuthContext';
import { useTema, type Warna } from '../context/ThemeContext';
import { ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { useBank, useProfil, useSimpanProfil } from '../lib/queries';

interface OpsiWarna {
  id: Warna;
  nama: string;
  deskripsi: string;
  /** Contoh warna utama (dasar, aksen, latar) untuk ditampilkan sebagai titik. */
  contoh: [string, string, string];
}

const OPSI_WARNA: OpsiWarna[] = [
  {
    id: 'dpbj',
    nama: 'Biru Dongker DPBJ',
    deskripsi: 'Tampilan bawaan: biru dongker dengan aksen kuning.',
    contoh: ['#0a1a3f', '#ffd100', '#eef2fa'],
  },
  {
    id: 'ui',
    nama: 'Kuning UI',
    deskripsi: 'Kuning resmi Universitas Indonesia (#F6DB00 · Pantone 109 C) dipadukan hitam arang.',
    contoh: ['#1c1b19', '#f6db00', '#f4f3ed'],
  },
  {
    id: 'pink',
    nama: 'Pink',
    deskripsi: 'Aksen pink lembut dipadukan ungu plum tua.',
    contoh: ['#28101f', '#f564a8', '#faeff4'],
  },
];

export default function PengaturanPage() {
  const user = useUser();
  const { warna, setWarna } = useTema();
  const [modalPassword, setModalPassword] = useState(false);

  const pilih = (o: OpsiWarna) => {
    if (o.id === warna) return;
    setWarna(o.id);
    toast.success(`Tema ${o.nama} diterapkan`, { id: 'tema-warna' });
  };

  return (
    <div>
      <PageHeader judul="Pengaturan" deskripsi="Atur tampilan aplikasi dan akun Anda." />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <KartuProfil />
          <GlassCard className="p-5 sm:p-6">
            <JudulKartu
              ikon={<Palette className="size-4.5" />}
              judul="Tema warna"
              deskripsi="Berlaku di perangkat ini. Mode terang/gelap tetap diatur dari tombol matahari/bulan di bilah atas."
            />
            {/* Kolom mengikuti lebar kartu (container query): 1 → 2 → 3 pilihan sebaris */}
            <div className="@container mt-5">
              <div role="radiogroup" aria-label="Tema warna" className="grid grid-cols-1 gap-3 @md:grid-cols-2 @[38rem]:grid-cols-3">
                {OPSI_WARNA.map((o) => {
                  const aktif = o.id === warna;
                  return (
                    <label
                      key={o.id}
                      data-warna-opsi={o.id}
                      data-terpilih={aktif ? 'ya' : 'tidak'}
                      className={cn(
                        'group relative flex cursor-pointer flex-col gap-3 rounded-2xl p-3 ring-1 transition',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-kuning-500',
                        aktif ? 'bg-kuning-400/10 ring-2 ring-kuning-500' : 'bg-fg/[0.02] ring-fg/10 hover:ring-fg/25',
                      )}
                    >
                      <input
                        type="radio"
                        name="tema-warna"
                        value={o.id}
                        checked={aktif}
                        onChange={() => pilih(o)}
                        className="sr-only"
                      />
                      <PratinjauTema warna={o.id} />
                      <div className="flex items-start gap-3 px-1 pb-1">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-fg">{o.nama}</p>
                          <p className="mt-0.5 text-xs leading-snug text-fg-muted">{o.deskripsi}</p>
                          <div className="mt-2 flex items-center gap-1.5" aria-hidden>
                            {o.contoh.map((c) => (
                              <span key={c} className="size-4 rounded-full ring-1 ring-fg/15" style={{ background: c }} />
                            ))}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'grid size-6 shrink-0 place-items-center rounded-full ring-1 transition',
                            aktif ? 'bg-kuning-400 text-navy-950 ring-kuning-500' : 'text-transparent ring-fg/20',
                          )}
                          aria-hidden
                        >
                          <Check className="size-3.5" strokeWidth={3} />
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </GlassCard>
        </div>

        <GlassCard className="self-start p-5 sm:p-6">
          <JudulKartu ikon={<UserRound className="size-4.5" />} judul="Akun" deskripsi="Akun yang sedang masuk." />
          <div className="mt-5 flex items-center gap-3">
            <Avatar nama={user.nama} className="size-11" />
            <div className="min-w-0">
              <p className="truncate font-bold text-fg">{user.nama}</p>
              <p className="truncate text-xs text-fg-muted">{user.username}</p>
            </div>
          </div>
          <dl className="mt-4 rounded-2xl bg-fg/[0.03] px-4 py-3 text-sm ring-1 ring-fg/[0.06]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-fg-muted">Peran</dt>
              <dd className="font-semibold text-fg">{ROLE_LABEL[user.role]}</dd>
            </div>
          </dl>
          <Button varian="kedua" className="mt-4 w-full" ikon={<KeyRound className="size-4" />} onClick={() => setModalPassword(true)}>
            Ganti password
          </Button>
        </GlassCard>
      </div>

      <GantiPasswordModal open={modalPassword} onOpenChange={setModalPassword} />
    </div>
  );
}

/**
 * Profil: data pegawai milik akun ini (ditautkan admin di menu Pengguna) dan rekening tujuan pembayarannya.
 * Rekening ini mengisi otomatis Bank & No. Rekening saat nama pemilik akun dipilih di form pengajuan.
 */
function KartuProfil() {
  const { data, isLoading } = useProfil();
  const pegawai = data?.pegawai ?? null;
  return (
    <GlassCard className="p-5 sm:p-6" data-testid="kartu-profil">
      <JudulKartu ikon={<Landmark className="size-4.5" />} judul="Profil" deskripsi="Rekening tujuan pembayaran untuk Anda." />
      {isLoading ? (
        <Skeleton className="mt-5 h-24 rounded-2xl" />
      ) : pegawai ? (
        <FormRekeningProfil key={pegawai.id} pegawai={pegawai} />
      ) : (
        <p className="mt-4 rounded-2xl bg-fg/[0.03] px-4 py-3 text-sm text-fg-muted ring-1 ring-fg/[0.06]" data-testid="profil-belum-tertaut">
          Akun Anda belum ditautkan ke data pegawai. Minta admin menautkannya di menu Pengguna, lalu isi bank dan nomor
          rekening Anda di sini.
        </p>
      )}
    </GlassCard>
  );
}

function FormRekeningProfil({ pegawai }: { pegawai: NonNullable<ProfilAkun['pegawai']> }) {
  const simpan = useSimpanProfil();
  const { data: daftarBank = [] } = useBank();
  const [bank, setBank] = useState(pegawai.rekening_bank ?? '');
  const [nomor, setNomor] = useState(pegawai.rekening_nomor ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const berubah = bank.trim() !== (pegawai.rekening_bank ?? '') || nomor.replace(/[\s.-]/g, '') !== (pegawai.rekening_nomor ?? '');

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateProfilRekening({ rekening_bank: bank, rekening_nomor: nomor });
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    setErrors({});
    try {
      const p = await simpan.mutateAsync({ rekening_bank: bank, rekening_nomor: nomor });
      setBank(p.pegawai?.rekening_bank ?? '');
      setNomor(p.pegawai?.rekening_nomor ?? '');
      toast.success(h.data.rekening_bank ? 'Rekening disimpan' : 'Rekening dihapus');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors);
        if (Object.keys(err.errors).length === 0) toast.error(err.message);
      }
    }
  };

  return (
    <form onSubmit={kirim} className="mt-5 space-y-4" noValidate>
      <div className="flex items-center gap-3" data-testid="profil-pegawai">
        <Avatar nama={pegawai.nama} className="size-10" />
        <div className="min-w-0">
          <p className="truncate font-bold text-fg">{pegawai.nama}</p>
          <p className="truncate text-xs text-fg-muted">
            {[pegawai.jabatan, pegawai.nip ? `NIP ${pegawai.nip}` : null].filter(Boolean).join(' · ') || 'Data pegawai'}
          </p>
        </div>
      </div>
      {/* Kolom mengikuti lebar kartu: bertumpuk di kartu sempit, berdampingan bila cukup lebar */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
          <Field label="Bank" htmlFor="profil-bank" error={errors.rekening_bank}>
            <Input
              id="profil-bank"
              list="saran-bank-profil"
              autoComplete="off"
              maxLength={60}
              value={bank}
              invalid={!!errors.rekening_bank}
              placeholder="mis. Bank Mandiri"
              onChange={(e) => setBank(e.target.value)}
            />
          </Field>
          <Field label="No. Rekening" htmlFor="profil-nomor" error={errors.rekening_nomor}>
            <Input
              id="profil-nomor"
              inputMode="numeric"
              autoComplete="off"
              className="angka"
              maxLength={34}
              value={nomor}
              invalid={!!errors.rekening_nomor}
              onChange={(e) => setNomor(e.target.value.replace(/[^\d\s.-]/g, ''))}
            />
          </Field>
        </div>
      </div>
      <datalist id="saran-bank-profil">
        {daftarBank
          .filter((b) => b.aktif)
          .map((b) => (
            <option key={b.id} value={b.nama} />
          ))}
      </datalist>
      <p
        className={cn(
          'rounded-xl px-3 py-2 text-xs ring-1',
          bank.trim() && !isBankMandiri(bank)
            ? 'bg-amber-400/15 font-medium text-amber-900 ring-amber-500/30 dark:text-amber-100'
            : 'bg-fg/[0.03] text-fg-muted ring-fg/[0.06]',
        )}
      >
        Terisi otomatis saat nama Anda dipilih di form pengajuan. {CATATAN_BIAYA_TRANSFER}
      </p>
      <div className="flex justify-end">
        <Button type="submit" memuat={simpan.isPending} disabled={!berubah}>
          Simpan rekening
        </Button>
      </div>
    </form>
  );
}

/** Miniatur tampilan aplikasi dengan palet tema tertentu (data-warna menimpa variabel warna untuk elemen ini). */
function PratinjauTema({ warna }: { warna: Warna }) {
  return (
    <div data-warna={warna} className="overflow-hidden rounded-xl bg-bg p-2.5 ring-1 ring-line" aria-hidden>
      <div className="flex gap-2">
        <div className="flex w-12 shrink-0 flex-col gap-1.5 rounded-lg bg-navy-900 p-1.5">
          <span className="h-3 rounded-md bg-linear-to-b from-kuning-300 to-kuning-500" />
          <span className="h-1.5 rounded bg-white/25" />
          <span className="h-1.5 rounded bg-white/25" />
          <span className="h-1.5 w-2/3 rounded bg-white/25" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5 rounded-lg bg-surface p-2 ring-1 ring-line">
          <span className="block h-2 w-3/4 rounded bg-fg/75" />
          <span className="block h-1.5 w-1/2 rounded bg-fg/25" />
          <div className="flex items-center gap-1.5 pt-1">
            <span className="h-4 w-12 rounded-md bg-linear-to-b from-kuning-300 to-kuning-500" />
            <span className="h-4 w-8 rounded-md bg-navy-900/10 ring-1 ring-line" />
            <span className="ml-auto size-4 rounded-full bg-navy-900" />
          </div>
        </div>
      </div>
    </div>
  );
}
