import { FilePlus, FileSearch, FilterX, Layers, Search, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { KATEGORI_INFO, KATEGORI_LIST, ROLE_LIHAT_DRAFT, STATUS_INFO, STATUS_LIST, type Kategori } from '../../shared/constants';
import { formatAngka } from '../../shared/format';
import { TabelPengajuan } from '../components/pengajuan/TabelPengajuan';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { IKON_KATEGORI } from '../components/ui/Badge';
import { Button, TautanTombol } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Field';
import { GlassCard } from '../components/ui/GlassCard';
import { Kosong, Skeleton } from '../components/ui/Kosong';
import { PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { Segmented } from '../components/ui/Segmented';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { cn } from '../lib/cn';
import { usePengajuanDaftar, type FilterDaftar } from '../lib/queries';

const BATAS = 15;
const KUNCI_FILTER = ['status', 'mekanisme', 'kelengkapan', 'dari', 'sampai', 'sort', 'q', 'kategori'] as const;

export default function PengajuanListPage() {
  const { punyaPeran, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [cari, setCari] = useState(params.get('q') ?? '');
  const cariTunda = useDebounce(cari, 350);
  const [panel, setPanel] = useState(() => KUNCI_FILTER.some((k) => k !== 'q' && k !== 'kategori' && params.get(k)));

  const set = (kunci: string, nilai: string) => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (nilai) p.set(kunci, nilai);
        else p.delete(kunci);
        if (kunci !== 'page') p.delete('page');
        return p;
      },
      { replace: true },
    );
  };

  const qUrl = params.get('q') ?? '';
  // q terakhir yang ditulis halaman ini sendiri — membedakan perubahan URL internal vs dari luar.
  const qKita = useRef(qUrl);

  // Sinkronkan pencarian (debounce) ke URL.
  useEffect(() => {
    const v = cariTunda.trim();
    if (qUrl !== v) {
      qKita.current = v;
      set('q', v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cariTunda]);

  // Bila q di URL berubah dari luar (mis. pencarian di topbar / tombol reset), perbarui kotak cari.
  useEffect(() => {
    if (qUrl !== qKita.current) {
      qKita.current = qUrl;
      setCari(qUrl);
    }
  }, [qUrl]);

  const filter: FilterDaftar = useMemo(
    () => ({
      kategori: params.get('kategori') ?? '',
      status: params.get('status') ?? '',
      mekanisme: params.get('mekanisme') ?? '',
      kelengkapan: params.get('kelengkapan') ?? '',
      dari: params.get('dari') ?? '',
      sampai: params.get('sampai') ?? '',
      sort: params.get('sort') ?? '',
      q: qUrl,
      page: Number(params.get('page')) || 1,
      limit: BATAS,
    }),
    [params, qUrl],
  );

  const { data, isLoading, isFetching, isError, error, refetch } = usePengajuanDaftar(filter);
  const adaFilter = KUNCI_FILTER.some((k) => params.get(k));
  const kategori = (filter.kategori ?? '') as Kategori | '';

  return (
    <div>
      <PageHeader
        judul="Daftar Pengajuan"
        deskripsi="Semua pengajuan kas operasional — cari, saring, lalu buka untuk melihat detail dan berkas."
        aksi={
          punyaPeran('operator', 'admin') && (
            <TautanTombol to="/pengajuan/baru" ikon={<FilePlus className="size-4" />}>
              Buat Pengajuan
            </TautanTombol>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        <Segmented
          label="Kategori"
          layoutId="seg-daftar-kategori"
          value={kategori}
          onChange={(v) => set('kategori', v)}
          opsi={[
            { value: '' as const, label: 'Semua', ikon: <Layers /> },
            ...KATEGORI_LIST.map((k) => {
              const Ikon = IKON_KATEGORI[k];
              return { value: k, label: KATEGORI_INFO[k].labelPendek, ikon: <Ikon /> };
            }),
          ]}
        />
        <div className="flex flex-1 gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Cari pengajuan</span>
            <Search className="pointer-events-none absolute top-1/2 z-10 left-3.5 size-4 -translate-y-1/2 text-fg-muted" />
            <Input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari kode, kegiatan, lokasi, nama pegawai, no. invoice, project/task…"
              className="pl-10"
            />
          </label>
          <Button
            varian={panel ? 'navy' : 'kedua'}
            ikon={<SlidersHorizontal className="size-4" />}
            onClick={() => setPanel((v) => !v)}
            aria-expanded={panel}
          >
            <span className="hidden sm:inline">Filter</span>
          </Button>
          {adaFilter && (
            <Button
              varian="hantu"
              ikon={<FilterX className="size-4" />}
              onClick={() => {
                setCari('');
                setParams(new URLSearchParams(), { replace: true });
              }}
            >
              <span className="hidden sm:inline">Reset</span>
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {panel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <GlassCard className="mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-fg-muted">Status</span>
                <Select value={filter.status} onChange={(e) => set('status', e.target.value)} className="h-10">
                  <option value="">Semua status</option>
                  {STATUS_LIST.filter((s) => s !== 'draft' || (user && ROLE_LIHAT_DRAFT.includes(user.role))).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_INFO[s].label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-fg-muted">Mekanisme</span>
                <Select value={filter.mekanisme} onChange={(e) => set('mekanisme', e.target.value)} className="h-10">
                  <option value="">KO & LS</option>
                  <option value="KO">KO</option>
                  <option value="LS">LS</option>
                </Select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-fg-muted">Kelengkapan berkas</span>
                <Select value={filter.kelengkapan} onChange={(e) => set('kelengkapan', e.target.value)} className="h-10">
                  <option value="">Semua</option>
                  <option value="belum_lengkap">Belum lengkap</option>
                  <option value="lengkap">Lengkap</option>
                </Select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-fg-muted">Tanggal dari</span>
                <Input type="date" value={filter.dari} onChange={(e) => set('dari', e.target.value)} className="h-10" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-fg-muted">Sampai</span>
                <Input
                  type="date"
                  value={filter.sampai}
                  min={filter.dari || undefined}
                  onChange={(e) => set('sampai', e.target.value)}
                  className="h-10"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-fg-muted">Urutkan</span>
                <Select value={filter.sort} onChange={(e) => set('sort', e.target.value)} className="h-10">
                  <option value="">Tanggal terbaru</option>
                  <option value="terlama">Tanggal terlama</option>
                  <option value="nilai_tertinggi">Nilai tertinggi</option>
                  <option value="nilai_terendah">Nilai terendah</option>
                  <option value="diperbarui">Terakhir diperbarui</option>
                </Select>
              </label>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <GlassCard className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <p className="text-sm text-fg-muted">
            <span className="font-bold text-fg">
              <AnimatedNumber value={data?.total ?? 0} />
            </span>{' '}
            pengajuan
            {isFetching && !isLoading && <span className="ml-2 text-xs text-fg-subtle">memperbarui…</span>}
          </p>
          <p className="text-sm text-fg-muted">
            Total nilai{' '}
            <span className="font-extrabold text-fg">
              Rp <AnimatedNumber value={data?.nilai ?? 0} format={formatAngka} />
            </span>
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <Kosong
            ikon={<FileSearch />}
            judul="Gagal memuat data"
            deskripsi={error instanceof Error ? error.message : 'Terjadi kesalahan'}
            aksi={<Button onClick={() => void refetch()}>Coba lagi</Button>}
          />
        ) : (data?.data.length ?? 0) === 0 ? (
          <Kosong
            ikon={<FileSearch />}
            judul={adaFilter ? 'Tidak ada yang cocok' : 'Belum ada pengajuan'}
            deskripsi={
              adaFilter
                ? 'Coba ubah kata kunci atau filter yang digunakan.'
                : 'Pengajuan yang dibuat akan tampil di sini.'
            }
            aksi={
              !adaFilter &&
              punyaPeran('operator', 'admin') && (
                <TautanTombol to="/pengajuan/baru" ikon={<FilePlus className="size-4" />}>
                  Buat pengajuan pertama
                </TautanTombol>
              )
            }
          />
        ) : (
          <TabelPengajuan data={data!.data} redup={isFetching} />
        )}

        {data && data.total > 0 && (
          <div className={cn('border-t border-line px-5 py-3.5')}>
            <Pagination
              page={data.page}
              limit={data.limit}
              total={data.total}
              onChange={(pg) => {
                set('page', String(pg));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        )}
      </GlassCard>
    </div>
  );
}
