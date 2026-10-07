import { ArrowLeft, ArrowRight, AtSign, Eye, EyeOff, LockKeyhole, MailCheck, ShieldCheck, UserRound } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router';
import { validateDaftar } from '../../shared/validation';
import { Latar } from '../components/layout/Latar';
import { TombolTema } from '../components/layout/Topbar';
import { Button, kelasTombol } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Logo } from '../components/ui/Logo';
import { useAuth } from '../context/AuthContext';
import { ApiError, api } from '../lib/api';

/** Pendaftaran akun mandiri. Akun baru menunggu persetujuan admin (admin memilih peran) sebelum bisa masuk. */
export function DaftarPage() {
  const { user, siap } = useAuth();
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ulang, setUlang] = useState('');
  const [lihat, setLihat] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [terkirim, setTerkirim] = useState<string | null>(null);

  if (siap && user) return <Navigate to="/" replace />;

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateDaftar({ nama, username: email, password });
    const err: Record<string, string> = h.ok ? {} : { ...h.errors };
    if (!err.password) {
      if (!ulang) err.password_ulang = 'Ulangi password';
      else if (ulang !== password) err.password_ulang = 'Password tidak sama';
    }
    setErrors(err);
    setPesan('');
    if (!h.ok || Object.keys(err).length > 0) return;
    setMemuat(true);
    try {
      await api<{ ok: true }>('/auth/daftar', { body: h.data });
      setTerkirim(h.data.username);
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.errors);
        if (Object.keys(e.errors).length === 0) setPesan(e.message);
      } else {
        setPesan('Pendaftaran gagal. Coba lagi.');
      }
    } finally {
      setMemuat(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <Latar />
      <div className="absolute top-5 right-5 z-10">
        <TombolTema />
      </div>

      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link to="/login" className="mb-6 flex items-center gap-3 rounded-2xl outline-offset-4">
            <Logo className="size-11 rounded-2xl shadow-lg" />
            <div className="leading-tight">
              <p className="text-lg font-extrabold tracking-[-0.02em] text-fg">Kas Operasional DPBJ</p>
              <p className="text-xs font-semibold text-fg-muted">Universitas Indonesia</p>
            </div>
          </Link>

          <div className="glass rounded-[32px] p-7 sm:p-9">
            {terkirim ? (
              <div className="text-center" data-daftar="terkirim">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
                  <MailCheck className="size-7" />
                </span>
                <h1 className="mt-5 text-2xl font-extrabold tracking-[-0.025em] text-fg">Pendaftaran terkirim</h1>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                  Akun <b className="break-all text-fg">{terkirim}</b> menunggu persetujuan administrator. Anda dapat masuk
                  setelah akun disetujui dan diberi peran.
                </p>
                <Link to="/login" className={kelasTombol('utama', 'lg', 'mt-7 w-full')}>
                  <ArrowLeft className="size-4" /> Kembali ke halaman masuk
                </Link>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-extrabold tracking-[-0.025em] text-fg">Daftar akun</h1>
                <p className="mt-1 text-sm text-fg-muted">Buat akun untuk mengakses Kas Operasional DPBJ.</p>
                <p className="mt-4 flex gap-2.5 rounded-2xl bg-kuning-400/12 px-3.5 py-3 text-xs leading-relaxed text-fg ring-1 ring-kuning-500/25">
                  <ShieldCheck className="mt-px size-4 shrink-0 text-kuning-800 dark:text-kuning-300" aria-hidden />
                  Akun baru perlu disetujui administrator. Peran (operator, PUM, pimpinan) ditentukan administrator saat
                  menyetujui.
                </p>

                <form onSubmit={kirim} className="mt-6 space-y-4" noValidate>
                  <Field label="Nama lengkap" htmlFor="d-nama" error={errors.nama}>
                    <IkonInput ikon={<UserRound />}>
                      <Input
                        id="d-nama"
                        autoComplete="name"
                        autoFocus
                        value={nama}
                        invalid={!!errors.nama}
                        onChange={(e) => setNama(e.target.value)}
                        className="h-12 pl-10"
                        placeholder="Nama sesuai data kepegawaian"
                      />
                    </IkonInput>
                  </Field>
                  <Field label="Email" htmlFor="d-email" error={errors.username}>
                    <IkonInput ikon={<AtSign />}>
                      <Input
                        id="d-email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        value={email}
                        invalid={!!errors.username}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 pl-10"
                        placeholder="nama@instansi.go.id"
                      />
                    </IkonInput>
                  </Field>
                  <Field label="Password" htmlFor="d-password" error={errors.password} hint="Minimal 6 karakter">
                    <IkonInput ikon={<LockKeyhole />}>
                      <Input
                        id="d-password"
                        type={lihat ? 'text' : 'password'}
                        autoComplete="new-password"
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
                    </IkonInput>
                  </Field>
                  <Field label="Ulangi password" htmlFor="d-ulang" error={errors.password_ulang}>
                    <IkonInput ikon={<LockKeyhole />}>
                      <Input
                        id="d-ulang"
                        type={lihat ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={ulang}
                        invalid={!!errors.password_ulang}
                        onChange={(e) => setUlang(e.target.value)}
                        className="h-12 pl-10"
                        placeholder="••••••••"
                      />
                    </IkonInput>
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
                    Daftar
                    {!memuat && <ArrowRight className="size-4" />}
                  </Button>
                </form>
              </>
            )}
          </div>

          {!terkirim && (
            <p className="mt-6 text-center text-sm text-fg-muted">
              Sudah punya akun?{' '}
              <Link to="/login" className="font-bold text-fg underline decoration-kuning-500 decoration-2 underline-offset-4">
                Masuk
              </Link>
            </p>
          )}
          <p className="mt-4 text-center text-xs text-fg-subtle">
            © {new Date().getFullYear()} DPBJ Universitas Indonesia · Kas Operasional
          </p>
        </motion.section>
      </div>
    </div>
  );
}

function IkonInput({ ikon, children }: { ikon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 z-10 -translate-y-1/2 text-fg-muted [&>svg]:size-4" aria-hidden>
        {ikon}
      </span>
      {children}
    </div>
  );
}
