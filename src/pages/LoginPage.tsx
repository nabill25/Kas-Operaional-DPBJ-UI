import { ArrowRight, BadgeCheck, Car, Coffee, Eye, EyeOff, FilePlus, Hourglass, LockKeyhole, Plane, Send, User } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Latar } from '../components/layout/Latar';
import { TombolTema } from '../components/layout/Topbar';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Logo } from '../components/ui/Logo';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';

const LANGKAH = [
  { ikon: FilePlus, judul: 'Input pengajuan', teks: 'Operator membuat draft konsumsi/transport & mengunggah berkas' },
  { ikon: Send, judul: 'Diajukan ke PUM', teks: 'PUM mencentang berkas, mengembalikan bila perlu revisi' },
  { ikon: Hourglass, judul: 'Diajukan ke MDK', teks: 'Diteruskan PUM ke MDK (di luar sistem) untuk invoice' },
  { ikon: BadgeCheck, judul: 'Selesai (Paid)', teks: 'PUM menginput No. Invoice MDK — tercatat & terekap' },
];

export function LoginPage() {
  const { user, siap, masuk } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const tujuan = (location.state as { dari?: string } | null)?.dari ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [lihat, setLihat] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState('');
  const [memuat, setMemuat] = useState(false);

  if (siap && user) return <Navigate to={tujuan} replace />;

  const prosesMasuk = async (u: string, p: string) => {
    const err: Record<string, string> = {};
    if (!u.trim()) err.username = 'Email wajib diisi';
    if (!p) err.password = 'Password wajib diisi';
    setErrors(err);
    setPesan('');
    if (Object.keys(err).length > 0) return;
    setMemuat(true);
    try {
      const masukUser = await masuk(u, p);
      toast.success(`Selamat datang, ${masukUser.nama}!`);
      navigate(tujuan, { replace: true });
    } catch (e) {
      setPesan(e instanceof ApiError ? e.message : 'Gagal masuk. Coba lagi.');
      if (e instanceof ApiError) setErrors(e.errors);
    } finally {
      setMemuat(false);
    }
  };

  const kirim = (e: FormEvent) => {
    e.preventDefault();
    void prosesMasuk(username, password);
  };

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <Latar />
      <div className="absolute top-5 right-5 z-10">
        <TombolTema />
      </div>

      <div className="mx-auto grid grid-cols-1 min-h-dvh max-w-6xl items-center gap-10 px-5 pt-20 pb-10 sm:py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        {/* Panel hero */}
        <motion.section
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:block"
        >
          <div className="flex items-center gap-3">
            <Logo className="size-12 rounded-2xl shadow-xl shadow-navy-900/25" />
            <div>
              <p className="text-sm font-bold tracking-wide text-fg-muted">DPBJ · UNIVERSITAS INDONESIA</p>
            </div>
          </div>
          <h1 className="mt-6 text-5xl leading-[1.05] font-extrabold tracking-[-0.035em] text-fg">
            Kas Operasional
            <span className="relative ml-3 inline-block">
              <span className="relative z-10">DPBJ</span>
              <motion.span
                className="absolute inset-x-[-4px] bottom-0.5 -z-0 h-3 rounded-md bg-kuning-400/70"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                style={{ originX: 0 }}
                aria-hidden
              />
            </span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg-muted">
            Catat, ajukan, dan pantau biaya konsumsi rapat serta transport — dari pengajuan, verifikasi PUM, hingga
            invoice MDK (paid), lengkap dengan rekap dan laporan PDF.
          </p>

          <ol className="relative mt-10 space-y-4">
            <span className="absolute top-6 bottom-6 left-[27px] w-px bg-linear-to-b from-kuning-500 via-navy-400/40 to-emerald-500" aria-hidden />
            {LANGKAH.map((l, i) => (
              <motion.li
                key={l.judul}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="glass relative flex max-w-md items-center gap-4 rounded-2xl p-3 pr-5"
              >
                <span className="grid size-[34px] shrink-0 place-items-center rounded-xl bg-navy-900 text-kuning-300 shadow-lg dark:bg-kuning-400 dark:text-navy-950">
                  <l.ikon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-fg">
                    {i + 1}. {l.judul}
                  </p>
                  <p className="text-xs text-fg-muted">{l.teks}</p>
                </div>
              </motion.li>
            ))}
          </ol>

          <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-fg-muted">
            {[
              { ikon: Coffee, label: 'Konsumsi' },
              { ikon: Car, label: 'Rumah Tangga' },
              { ikon: Plane, label: 'Perjadin' },
            ].map((k) => (
              <span key={k.label} className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
                <k.ikon className="size-3.5" aria-hidden /> {k.label}
              </span>
            ))}
          </div>
        </motion.section>

        {/* Kartu login */}
        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="mx-auto w-full max-w-md"
        >
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <Logo className="size-11 rounded-2xl shadow-lg" />
            <div className="leading-tight">
              <p className="text-lg font-extrabold tracking-[-0.02em] text-fg">Kas Operasional DPBJ</p>
              <p className="text-xs font-semibold text-fg-muted">Universitas Indonesia</p>
            </div>
          </div>

          <div className="glass rounded-[32px] p-7 sm:p-9">
            <h2 className="text-2xl font-extrabold tracking-[-0.025em] text-fg">Masuk</h2>
            <p className="mt-1 text-sm text-fg-muted">Masuk dengan email dan password akun Anda.</p>

            <form onSubmit={kirim} className="mt-7 space-y-4" noValidate>
              <Field label="Email" htmlFor="username" error={errors.username}>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 z-10 left-3.5 size-4 -translate-y-1/2 text-fg-muted" />
                  <Input
                    id="username"
                    autoComplete="email"
                    inputMode="email"
                    autoFocus
                    value={username}
                    invalid={!!errors.username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-12 pl-10"
                    placeholder="nama@instansi.go.id"
                  />
                </div>
              </Field>
              <Field label="Password" htmlFor="password" error={errors.password}>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute top-1/2 z-10 left-3.5 size-4 -translate-y-1/2 text-fg-muted" />
                  <Input
                    id="password"
                    type={lihat ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    invalid={!!errors.password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pr-12 pl-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setLihat((v) => !v)}
                    className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-fg-muted transition hover:bg-fg/[0.06] hover:text-fg"
                    aria-label={lihat ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {lihat ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>

              {pesan && (
                <motion.p
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: [0, -6, 6, -3, 3, 0] }}
                  transition={{ duration: 0.4 }}
                  role="alert"
                  className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-700 ring-1 ring-red-500/20 dark:text-red-300"
                >
                  {pesan}
                </motion.p>
              )}

              <Button type="submit" ukuran="lg" memuat={memuat} className="w-full">
                Masuk
                {!memuat && <ArrowRight className="size-4" />}
              </Button>
            </form>
          </div>
          <p className="mt-6 text-center text-sm text-fg-muted">
            Belum punya akun?{' '}
            <Link to="/daftar" className="font-bold text-fg underline decoration-kuning-500 decoration-2 underline-offset-4">
              Daftar di sini
            </Link>
          </p>
          <p className="mt-4 text-center text-xs text-fg-subtle">
            © {new Date().getFullYear()} DPBJ Universitas Indonesia · Kas Operasional
          </p>
        </motion.section>
      </div>
    </div>
  );
}
