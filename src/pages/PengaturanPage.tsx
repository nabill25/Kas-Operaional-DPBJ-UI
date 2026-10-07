import { Check, KeyRound, Palette, UserRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ROLE_LABEL } from '../../shared/constants';
import { GantiPasswordModal } from '../components/layout/GantiPasswordModal';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { GlassCard, JudulKartu } from '../components/ui/GlassCard';
import { PageHeader } from '../components/ui/PageHeader';
import { useUser } from '../context/AuthContext';
import { useTema, type Warna } from '../context/ThemeContext';
import { cn } from '../lib/cn';

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
        <GlassCard className="p-5 sm:p-6">
          <JudulKartu
            ikon={<Palette className="size-4.5" />}
            judul="Tema warna"
            deskripsi="Berlaku di perangkat ini. Mode terang/gelap tetap diatur dari tombol matahari/bulan di bilah atas."
          />
          <div role="radiogroup" aria-label="Tema warna" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </GlassCard>

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
