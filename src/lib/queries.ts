import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  DashboardData,
  NotifikasiData,
  Paged,
  Pegawai,
  PengajuanDetail,
  PengajuanInput,
  PengajuanRingkas,
  RekapFilter,
  RekapPegawaiData,
  RekapPegawaiDetail,
  RekapPengajuanData,
  SaranPum,
  User,
} from '../../shared/types';
import type { Role, StatusCek } from '../../shared/constants';
import { api, keQuery } from './api';

export interface FilterDaftar {
  kategori?: string;
  status?: string;
  mekanisme?: string;
  q?: string;
  dari?: string;
  sampai?: string;
  pegawai_id?: string;
  kelengkapan?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export const qk = {
  pengajuanSemua: ['pengajuan'] as const,
  saranPum: ['saran-pum'] as const,
  pengajuanDaftar: (f: FilterDaftar) => ['pengajuan', 'daftar', f] as const,
  pengajuan: (id: number) => ['pengajuan', 'detail', id] as const,
  pegawai: ['pegawai'] as const,
  dashboard: (tahun: number) => ['dashboard', tahun] as const,
  notifikasi: ['notifikasi'] as const,
  rekapPengajuan: (f: RekapFilter) => ['rekap', 'pengajuan', f] as const,
  rekapPegawai: (f: RekapFilter) => ['rekap', 'pegawai', f] as const,
  rekapPegawaiDetail: (id: number, f: RekapFilter) => ['rekap', 'pegawai', id, f] as const,
  users: ['users'] as const,
};

/** Setelah data pengajuan berubah, segarkan semua tampilan turunan. */
export function segarkanSemua(qc: QueryClient, detail?: PengajuanDetail): void {
  if (detail) qc.setQueryData(qk.pengajuan(detail.id), detail);
  void qc.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey[0];
      if (detail && q.queryKey[1] === 'detail' && q.queryKey[2] === detail.id) return false;
      return k === 'pengajuan' || k === 'dashboard' || k === 'notifikasi' || k === 'rekap' || k === 'pegawai';
    },
  });
}

// ───────────── Pengajuan ─────────────

export function usePengajuanDaftar(f: FilterDaftar, aktif = true) {
  return useQuery({
    queryKey: qk.pengajuanDaftar(f),
    queryFn: ({ signal }) => api<Paged<PengajuanRingkas>>(`/pengajuan${keQuery(f)}`, { signal }),
    placeholderData: keepPreviousData,
    enabled: aktif,
  });
}

export function usePengajuan(id: number) {
  return useQuery({
    queryKey: qk.pengajuan(id),
    queryFn: ({ signal }) => api<PengajuanDetail>(`/pengajuan/${id}`, { signal }),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useSimpanPengajuan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: PengajuanInput }) =>
      id
        ? api<PengajuanDetail>(`/pengajuan/${id}`, { method: 'PUT', body: data })
        : api<PengajuanDetail>('/pengajuan', { method: 'POST', body: data }),
    onSuccess: (detail) => segarkanSemua(qc, detail),
  });
}

export type AksiPengajuan =
  | { aksi: 'ajukan' }
  | { aksi: 'tarik' }
  | { aksi: 'kembalikan'; catatan: string }
  | { aksi: 'verifikasi'; project_hosting: string; task_name: string; catatan?: string }
  | { aksi: 'data-pum'; project_hosting: string; task_name: string }
  | { aksi: 'ajukan-mdk'; no_invoice_mdk: string; tanggal_invoice_mdk: string; catatan?: string }
  | { aksi: 'selesai' }
  | { aksi: 'invoice'; no_invoice_mdk: string; tanggal_invoice_mdk: string; catatan?: string }
  | { aksi: 'batal-selesai'; catatan: string }
  | { aksi: 'dibayarkan'; dibayarkan: boolean };

export function useAksiPengajuan(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: AksiPengajuan) => {
      const { aksi, ...body } = a;
      if (aksi === 'invoice' || aksi === 'data-pum' || aksi === 'dibayarkan') {
        return api<PengajuanDetail>(`/pengajuan/${id}/${aksi}`, { method: 'PUT', body });
      }
      return api<PengajuanDetail>(`/pengajuan/${id}/${aksi}`, { method: 'POST', body });
    },
    onSuccess: (detail, a) => {
      segarkanSemua(qc, detail);
      if (a.aksi === 'verifikasi' || a.aksi === 'data-pum') void qc.invalidateQueries({ queryKey: qk.saranPum });
    },
  });
}

/** PUM mencentang berkas: sesuai / revisi (dengan catatan) / null (batal). */
export function useCekBerkas(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { jenis: string; status: StatusCek | null; catatan?: string }) =>
      api<PengajuanDetail>(`/pengajuan/${id}/cek-berkas`, { method: 'PUT', body: v }),
    onSuccess: (detail) => segarkanSemua(qc, detail),
  });
}

export function useSaranPum(aktif: boolean) {
  return useQuery({
    queryKey: qk.saranPum,
    queryFn: ({ signal }) => api<SaranPum>('/pengajuan/saran-pum', { signal }),
    enabled: aktif,
    staleTime: 60_000,
  });
}

export function useHapusPengajuan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ ok: true }>(`/pengajuan/${id}`, { method: 'DELETE' }),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: qk.pengajuan(id) });
      segarkanSemua(qc);
    },
  });
}

export function useBerkasNa(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { jenis: string; na: boolean }) =>
      api<PengajuanDetail>(`/pengajuan/${id}/berkas-na`, { method: 'PUT', body: v }),
    onSuccess: (detail) => segarkanSemua(qc, detail),
  });
}

export function useHapusBerkas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (berkasId: number) => api<PengajuanDetail>(`/berkas/${berkasId}`, { method: 'DELETE' }),
    onSuccess: (detail) => segarkanSemua(qc, detail),
  });
}

// ───────────── Pegawai ─────────────

export function usePegawai() {
  return useQuery({
    queryKey: qk.pegawai,
    queryFn: ({ signal }) => api<Pegawai[]>('/pegawai', { signal }),
    staleTime: 60_000,
  });
}

export function useSimpanPegawai() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: { nama: string; nip?: string; jabatan?: string } }) =>
      id ? api<Pegawai>(`/pegawai/${id}`, { method: 'PUT', body: data }) : api<Pegawai>('/pegawai', { method: 'POST', body: data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.pegawai });
      void qc.invalidateQueries({ queryKey: ['rekap'] });
    },
  });
}

export function useAktifPegawai() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, aktif }: { id: number; aktif: boolean }) =>
      api<Pegawai>(`/pegawai/${id}/aktif`, { method: 'PATCH', body: { aktif } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.pegawai }),
  });
}

export function useHapusPegawai() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ ok: true }>(`/pegawai/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.pegawai }),
  });
}

// ───────────── Dashboard, notifikasi, rekap ─────────────

export function useDashboard(tahun: number) {
  return useQuery({
    queryKey: qk.dashboard(tahun),
    queryFn: ({ signal }) => api<DashboardData>(`/dashboard?tahun=${tahun}`, { signal }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useNotifikasi() {
  return useQuery({
    queryKey: qk.notifikasi,
    queryFn: ({ signal }) => api<NotifikasiData>('/notifikasi', { signal }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

/** Tandai notifikasi dibaca: dengan id = satu, tanpa id = semua. */
export function useBacaNotifikasi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id?: number) => api<NotifikasiData>('/notifikasi/baca', { method: 'POST', body: id ? { id } : {} }),
    onSuccess: (data) => qc.setQueryData(qk.notifikasi, data),
  });
}

export function useRekapPengajuan(f: RekapFilter) {
  return useQuery({
    queryKey: qk.rekapPengajuan(f),
    queryFn: ({ signal }) => api<RekapPengajuanData>(`/rekap/pengajuan${keQuery(f)}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useRekapPegawai(f: RekapFilter) {
  return useQuery({
    queryKey: qk.rekapPegawai(f),
    queryFn: ({ signal }) => api<RekapPegawaiData>(`/rekap/pegawai${keQuery(f)}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useRekapPegawaiDetail(id: number | null, f: RekapFilter) {
  return useQuery({
    queryKey: qk.rekapPegawaiDetail(id ?? 0, f),
    queryFn: ({ signal }) => api<RekapPegawaiDetail>(`/rekap/pegawai/${id}${keQuery(f)}`, { signal }),
    enabled: id !== null,
  });
}

// ───────────── Pengguna ─────────────

export function useUsers() {
  return useQuery({
    queryKey: qk.users,
    queryFn: ({ signal }) => api<User[]>('/users', { signal }),
  });
}

export function useSimpanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: Record<string, unknown> }) =>
      id ? api<User>(`/users/${id}`, { method: 'PUT', body: data }) : api<User>('/users', { method: 'POST', body: data }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.users }),
  });
}

/** Pendaftaran mandiri: setujui dengan peran tertentu (akun langsung aktif). */
export function useSetujuiPendaftaran() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: Role }) => api<User>(`/users/${id}/setujui`, { body: { role } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.users });
      void qc.invalidateQueries({ queryKey: qk.notifikasi });
    },
  });
}

/** Pendaftaran mandiri: tolak (profil & akun login dihapus). */
export function useTolakPendaftaran() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ ok: true }>(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.users });
      void qc.invalidateQueries({ queryKey: qk.notifikasi });
    },
  });
}
