import { lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import type { Role } from '../shared/constants';
import { AppLayout } from './components/layout/AppLayout';
import { Latar } from './components/layout/Latar';
import { Logo } from './components/ui/Logo';
import { useAuth } from './context/AuthContext';
import { KonfigProvider } from './context/KonfigContext';
import { DaftarPage } from './pages/DaftarPage';
import { LoginPage } from './pages/LoginPage';
import NotFoundPage, { TanpaAkses } from './pages/NotFoundPage';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PengajuanListPage = lazy(() => import('./pages/PengajuanListPage'));
const PengajuanBaruPage = lazy(() => import('./pages/PengajuanBaruPage'));
const PengajuanUbahPage = lazy(() => import('./pages/PengajuanUbahPage'));
const PengajuanDetailPage = lazy(() => import('./pages/PengajuanDetailPage'));
const VerifikasiPage = lazy(() => import('./pages/VerifikasiPage'));
const RekapPage = lazy(() => import('./pages/RekapPage'));
const PegawaiPage = lazy(() => import('./pages/PegawaiPage'));
const PenggunaPage = lazy(() => import('./pages/PenggunaPage'));
const PengaturanPage = lazy(() => import('./pages/PengaturanPage'));
const MasterJenisPengajuanPage = lazy(() => import('./pages/master/MasterJenisPengajuanPage'));
const MasterJenisBerkasPage = lazy(() => import('./pages/master/MasterJenisBerkasPage'));
const MasterProjectTaskPage = lazy(() => import('./pages/master/MasterProjectTaskPage'));
const MasterBankPage = lazy(() => import('./pages/master/MasterBankPage'));

function LayarMuat() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Latar />
      <div className="flex flex-col items-center gap-4">
        <Logo className="size-14 animate-pulse rounded-2xl shadow-xl" />
        <p className="text-sm font-semibold text-fg-muted">Memuat Kas Operasional DPBJ…</p>
      </div>
    </div>
  );
}

function Terlindungi() {
  const { user, siap } = useAuth();
  const location = useLocation();
  if (!siap) return <LayarMuat />;
  if (!user) return <Navigate to="/login" replace state={{ dari: location.pathname + location.search }} />;
  return (
    <KonfigProvider memuat={<LayarMuat />}>
      <AppLayout />
    </KonfigProvider>
  );
}

function Peran({ izin, children }: { izin: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !izin.includes(user.role)) return <TanpaAkses />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/daftar" element={<DaftarPage />} />
      <Route element={<Terlindungi />}>
        <Route index element={<DashboardPage />} />
        <Route path="pengajuan" element={<PengajuanListPage />} />
        <Route
          path="pengajuan/baru"
          element={
            <Peran izin={['operator', 'admin']}>
              <PengajuanBaruPage />
            </Peran>
          }
        />
        <Route path="pengajuan/:id" element={<PengajuanDetailPage />} />
        <Route
          path="pengajuan/:id/ubah"
          element={
            <Peran izin={['operator', 'admin']}>
              <PengajuanUbahPage />
            </Peran>
          }
        />
        <Route
          path="verifikasi"
          element={
            <Peran izin={['pum', 'admin']}>
              <VerifikasiPage />
            </Peran>
          }
        />
        <Route path="rekap" element={<RekapPage />} />
        <Route path="pegawai" element={<PegawaiPage />} />
        <Route
          path="pengguna"
          element={
            <Peran izin={['admin']}>
              <PenggunaPage />
            </Peran>
          }
        />
        {(
          [
            ['master/jenis-pengajuan', MasterJenisPengajuanPage],
            ['master/jenis-berkas', MasterJenisBerkasPage],
            ['master/project-task', MasterProjectTaskPage],
            ['master/bank', MasterBankPage],
          ] as const
        ).map(([path, Halaman]) => (
          <Route
            key={path}
            path={path}
            element={
              <Peran izin={['admin']}>
                <Halaman />
              </Peran>
            }
          />
        ))}
        <Route path="pengaturan" element={<PengaturanPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
