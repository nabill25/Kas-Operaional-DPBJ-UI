import { ChartColumn, FileDown, FileSpreadsheet, Layers, ListOrdered, ScrollText, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { MEKANISME_LIST, ROLE_LIHAT_DRAFT, STATUS_INFO, STATUS_LIST, type Kategori } from '../../shared/constants';
import type { Kamus } from '../../shared/konfig';
import { formatAngka, formatRentangTanggal, formatRupiah, formatRupiahRingkas } from '../../shared/format';
import type { RekapFilter, RekapPegawaiData, RekapPegawaiRow } from '../../shared/types';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { Avatar } from '../components/ui/Avatar';
import { Chip, KategoriBadge, MekanismeBadge, StatusBadge } from '../components/ui/Badge';
import { useWarnaKategori } from '../components/dashboard/palet';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Field';
import { GlassCard } from '../components/ui/GlassCard';
import { Kosong, Skeleton } from '../components/ui/Kosong';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Segmented } from '../components/ui/Segmented';
import { useUser } from '../context/AuthContext';
import { useKamus } from '../context/KonfigContext';
import { cn } from '../lib/cn';
import { hitungPeriode, LABEL_PRESET, type PresetPeriode } from '../lib/periode';
import { useRekapPegawai, useRekapPegawaiDetail, useRekapPengajuan } from '../lib/queries';
import type { KeteranganFilter } from '../lib/pdf/laporan';

type Tab = 'pengajuan' | 'pegawai';
const PRESET: PresetPeriode[] = ['bulan_ini', 'bulan_lalu', 'tahun_ini', 'tahun_lalu', 'semua', 'kustom'];

/** Jenis yang tampil di rekap: jenis aktif + jenis lain yang punya data (urut master; kode tak dikenal di akhir). */
function jenisRekap(kamus: Kamus, ada: (k: Kategori) => boolean, semuaKode: Kategori[] = []): Kategori[] {
  return [...kamus.jenisTampil(ada).map((j) => j.kode), ...semuaKode.filter((k) => !kamus.dikenal(k) && ada(k))];
}

/** Kolom per jenis pada rekap per pegawai: semua jenis aktif (walau 0) + jenis lain yang punya nilai (urut master). */
function jenisPegawai(kamus: Kamus, data: RekapPegawaiData): Kategori[] {
  const total = (k: Kategori) => data.rows.reduce((s, r) => s + (r.perKategori[k] ?? 0), 0);
  const semua = [...new Set(data.rows.flatMap((r) => Object.keys(r.perKategori)))];
  return jenisRekap(kamus, (k) => total(k) > 0, semua);
}

const GRID_STAT: Record<number, string> = { 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5' };

export default function RekapPage() {
  const user = useUser();
  const kamus = useKamus();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'pegawai' ? 'pegawai' : 'pengajuan';
  const preset = (PRESET.includes(params.get('periode') as PresetPeriode) ? params.get('periode') : 'tahun_ini') as PresetPeriode;
  const rentang = hitungPeriode(preset, { dari: params.get('dari') ?? '', sampai: params.get('sampai') ?? '' });

  const filter: RekapFilter = useMemo(
    () => ({
      dari: rentang.dari,
      sampai: rentang.sampai,
      kategori: (params.get('kategori') ?? '') as RekapFilter['kategori'],
      mekanisme: (params.get('mekanisme') ?? '') as RekapFilter['mekanisme'],
      status: (params.get('status') ?? '') as RekapFilter['status'],
    }),
    [rentang.dari, rentang.sampai, params],
  );

  const set = (kunci: string, nilai: string) => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (nilai) p.set(kunci, nilai);
        else p.delete(kunci);
        return p;
      },
      { replace: true },
    );
  };

  const rincian = useMemo(() => {
    const r: string[] = [];
    if (filter.kategori) r.push(`Kategori: ${kamus.jenis(filter.kategori).label}`);
    if (filter.mekanisme) r.push(`Mekanisme: ${filter.mekanisme}`);
    r.push(`Status: ${filter.status && filter.status !== 'semua' ? STATUS_INFO[filter.status].label : 'semua (selain draft)'}`);
    return r;
  }, [filter, kamus]);
  const ket: KeteranganFilter = { periode: rentang.label, rincian };

  const qPengajuan = useRekapPengajuan(filter);
  const qPegawai = useRekapPegawai(filter);
  const [pegawaiDipilih, setPegawaiDipilih] = useState<RekapPegawaiRow | null>(null);
  const [modalPegawai, setModalPegawai] = useState(false);
  const [sibuk, setSibuk] = useState<'' | 'pdf' | 'xlsx'>('');

  const unduhPdf = async () => {
    setSibuk('pdf');
    try {
      const pdf = await import('../lib/pdf/laporan');
      if (tab === 'pengajuan') {
        if (!qPengajuan.data) return;
        pdf.pdfRekapPengajuan(qPengajuan.data, ket, user.nama, kamus);
      } else {
        if (!qPegawai.data) return;
        pdf.pdfRekapPegawai(qPegawai.data, ket, user.nama, kamus);
      }
      toast.success('Laporan PDF berhasil dibuat');
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuat PDF');
    } finally {
      setSibuk('');
    }
  };

  const unduhExcel = async () => {
    setSibuk('xlsx');
    try {
      const { unduhXlsx } = await import('../lib/xlsx');
      const judul = [
        tab === 'pengajuan' ? 'Rekap Pengajuan Kas Operasional DPBJ UI' : 'Rekap Kas Operasional per Pegawai - DPBJ UI',
        `Periode: ${rentang.label}`,
        rincian.join(' | '),
      ];
      if (tab === 'pengajuan' && qPengajuan.data) {
        const d = qPengajuan.data;
        unduhXlsx(
          {
            nama: 'Rekap Pengajuan',
            judul,
            kolom: [
              { header: 'No', lebar: 5, tipe: 'angka' },
              { header: 'Kode', lebar: 16, tipe: 'teks' },
              { header: 'Tanggal Mulai', lebar: 13, tipe: 'teks' },
              { header: 'Tanggal Selesai', lebar: 13, tipe: 'teks' },
              { header: 'Kategori', lebar: 22, tipe: 'teks' },
              { header: 'Nama Kegiatan', lebar: 42, tipe: 'teks' },
              { header: 'Lokasi Tujuan', lebar: 24, tipe: 'teks' },
              { header: 'Penerima / Uang Siapa', lebar: 30, tipe: 'teks' },
              { header: 'Jumlah Orang', lebar: 8, tipe: 'angka' },
              { header: 'Mekanisme', lebar: 10, tipe: 'teks' },
              { header: 'Status', lebar: 16, tipe: 'teks' },
              { header: 'Project Costing', lebar: 20, tipe: 'teks' },
              { header: 'Task Name', lebar: 24, tipe: 'teks' },
              { header: 'No. Invoice MDK', lebar: 22, tipe: 'teks' },
              { header: 'Tgl Invoice', lebar: 12, tipe: 'teks' },
              { header: 'Berkas Wajib', lebar: 10, tipe: 'teks' },
              { header: 'Dicek PUM (Sesuai)', lebar: 12, tipe: 'teks' },
              { header: 'Nilai (Rp)', lebar: 15, tipe: 'angka' },
            ],
            baris: d.rows.map((p, i) => [
              i + 1,
              p.kode,
              p.tanggal_kegiatan,
              p.tanggal_selesai,
              kamus.jenis(p.kategori).label,
              p.nama_kegiatan,
              p.lokasi_tujuan,
              p.penerima,
              p.jumlah_orang,
              p.mekanisme,
              STATUS_INFO[p.status].label,
              p.project_hosting,
              p.task_name,
              p.no_invoice_mdk,
              p.tanggal_invoice_mdk,
              `${p.berkas_terpenuhi}/${p.berkas_wajib}`,
              `${p.berkas_sesuai}/${p.berkas_wajib}`,
              p.total,
            ]),
            total: ['', 'TOTAL', '', '', '', `${d.rows.length} pengajuan`, '', '', null, '', '', '', '', '', '', '', '', d.ringkasan.nilai],
          },
          `Rekap_Pengajuan_${rentang.label.replace(/\s+/g, '_')}`,
        );
      } else if (tab === 'pegawai' && qPegawai.data) {
        const d = qPegawai.data;
        const kode = jenisPegawai(kamus, d);
        unduhXlsx(
          {
            nama: 'Rekap Pegawai',
            judul,
            kolom: [
              { header: 'No', lebar: 5, tipe: 'angka' },
              { header: 'Nama Pegawai', lebar: 28, tipe: 'teks' },
              { header: 'NIP/NUP', lebar: 22, tipe: 'teks' },
              { header: 'Jabatan', lebar: 26, tipe: 'teks' },
              { header: 'Jumlah Pengajuan', lebar: 10, tipe: 'angka' },
              ...kode.map((k) => ({ header: `${kamus.jenis(k).label_pendek} (Rp)`, lebar: 16, tipe: 'angka' as const })),
              { header: 'Total (Rp)', lebar: 16, tipe: 'angka' },
            ],
            baris: d.rows.map((r, i) => [i + 1, r.nama, r.nip, r.jabatan, r.jumlah, ...kode.map((k) => r.perKategori[k] ?? 0), r.total]),
            total: [
              null,
              'TOTAL',
              '',
              '',
              null,
              ...kode.map((k) => d.rows.reduce((s, r) => s + (r.perKategori[k] ?? 0), 0)),
              d.total,
            ],
          },
          `Rekap_Pegawai_${rentang.label.replace(/\s+/g, '_')}`,
        );
      }
      toast.success('File Excel berhasil dibuat');
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuat file Excel');
    } finally {
      setSibuk('');
    }
  };

  const aktif = tab === 'pengajuan' ? qPengajuan : qPegawai;
  const kosong = tab === 'pengajuan' ? (qPengajuan.data?.rows.length ?? 0) === 0 : (qPegawai.data?.rows.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        judul="Rekap & Laporan"
        deskripsi="Rekap per pengajuan atau per orang sesuai periode & filter, lalu unduh sebagai PDF atau Excel."
        aksi={
          <>
            <Button
              varian="kedua"
              ikon={<FileSpreadsheet className="size-4" />}
              memuat={sibuk === 'xlsx'}
              disabled={!aktif.data || kosong || !!sibuk}
              onClick={unduhExcel}
            >
              Excel
            </Button>
            <Button
              ikon={<FileDown className="size-4" />}
              memuat={sibuk === 'pdf'}
              disabled={!aktif.data || kosong || !!sibuk}
              onClick={unduhPdf}
            >
              Unduh PDF
            </Button>
          </>
        }
      />

      {/* Baris filter — mengatur semua angka di bawahnya */}
      <GlassCard className="mb-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-bold tracking-wider text-fg-subtle uppercase">Periode · {rentang.label}</p>
            <Segmented
              label="Periode"
              className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto"
              layoutId="seg-periode"
              ukuran="sm"
              value={preset}
              onChange={(v) => set('periode', v === 'tahun_ini' ? '' : v)}
              opsi={PRESET.map((p) => ({ value: p, label: LABEL_PRESET[p] }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {preset === 'kustom' && (
              <>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-fg-muted">Dari tanggal</span>
                  <Input type="date" className="h-10" value={params.get('dari') ?? ''} onChange={(e) => set('dari', e.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-fg-muted">Sampai tanggal</span>
                  <Input
                    type="date"
                    className="h-10"
                    value={params.get('sampai') ?? ''}
                    min={params.get('dari') || undefined}
                    onChange={(e) => set('sampai', e.target.value)}
                  />
                </label>
              </>
            )}
            <label className="space-y-1">
              <span className="text-xs font-semibold text-fg-muted">Kategori</span>
              <Select className="h-10" aria-label="Filter kategori" value={filter.kategori} onChange={(e) => set('kategori', e.target.value)}>
                <option value="">Semua kategori</option>
                {kamus.jenisTampil(() => true).map((j) => (
                  <option key={j.kode} value={j.kode}>
                    {j.label}
                    {j.aktif ? '' : ' (nonaktif)'}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-fg-muted">Mekanisme</span>
              <Select className="h-10" aria-label="Filter mekanisme" value={filter.mekanisme} onChange={(e) => set('mekanisme', e.target.value)}>
                <option value="">KO & LS</option>
                {MEKANISME_LIST.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-fg-muted">Status</span>
              <Select className="h-10" aria-label="Filter status" value={filter.status} onChange={(e) => set('status', e.target.value)}>
                <option value="">Semua (selain draft)</option>
                {STATUS_LIST.filter((s) => s !== 'draft' || ROLE_LIHAT_DRAFT.includes(user.role)).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_INFO[s].label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>
      </GlassCard>

      <Segmented
        label="Jenis rekap"
        layoutId="seg-rekap-tab"
        className="mb-5"
        value={tab}
        onChange={(v) => set('tab', v === 'pengajuan' ? '' : v)}
        opsi={[
          { value: 'pengajuan', label: 'Per pengajuan', ikon: <ScrollText /> },
          { value: 'pegawai', label: 'Per pegawai', ikon: <Users /> },
        ]}
      />

      {tab === 'pengajuan' ? (
        <RekapPengajuanView q={qPengajuan} tampilDraft={filter.status === 'draft'} />
      ) : (
        <RekapPegawaiView
          q={qPegawai}
          onPilih={(r) => {
            setPegawaiDipilih(r);
            setModalPegawai(true);
          }}
        />
      )}

      {pegawaiDipilih && (
        <DetailPegawaiModal
          baris={pegawaiDipilih}
          filter={filter}
          ket={ket}
          dicetakOleh={user.nama}
          open={modalPegawai}
          onOpenChange={setModalPegawai}
        />
      )}
    </div>
  );
}

function StatKecil({ label, nilai, sub, warna, indeks }: { label: string; nilai: number; sub: string; warna?: string; indeks: number }) {
  return (
    <GlassCard className="p-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: indeks * 0.05 }}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
        {warna && <span className="size-2.5 rounded-[3px]" style={{ background: warna }} aria-hidden />}
        {label}
      </p>
      <p className="mt-1 truncate text-xl font-extrabold tracking-[-0.02em] text-fg">
        {/* HP: nominal ringkas + lengkap di bawahnya agar tidak terpotong */}
        <span className="sm:hidden">Rp {formatRupiahRingkas(nilai)}</span>
        <span className="hidden sm:inline">
          Rp <AnimatedNumber value={nilai} format={formatAngka} />
        </span>
      </p>
      <p className="angka text-[11px] font-semibold text-fg-muted sm:hidden">{formatRupiah(nilai)}</p>
      <p className="text-xs text-fg-muted">{sub}</p>
    </GlassCard>
  );
}

function RekapPengajuanView({ q, tampilDraft }: { q: ReturnType<typeof useRekapPengajuan>; tampilDraft: boolean }) {
  const kamus = useKamus();
  const warna = useWarnaKategori();
  if (q.isLoading) return <Skeleton className="h-96 rounded-3xl" />;
  if (!q.data) return null;
  const { rows, ringkasan: r } = q.data;
  const kode = jenisRekap(kamus, (k) => (r.perKategori[k]?.jumlah ?? 0) > 0, Object.keys(r.perKategori));
  return (
    <div className={cn('space-y-5 transition-opacity', q.isFetching && 'opacity-60')}>
      <div className={cn('grid grid-cols-2 gap-3', GRID_STAT[kode.length + 1] ?? 'xl:grid-cols-4')}>
        <StatKecil indeks={0} label="Total nilai" nilai={r.nilai} sub={`${formatAngka(r.jumlah)} pengajuan`} />
        {kode.map((k, i) => (
          <StatKecil
            key={k}
            indeks={i + 1}
            label={kamus.jenis(k).label_pendek}
            nilai={r.perKategori[k]?.nilai ?? 0}
            sub={`${r.perKategori[k]?.jumlah ?? 0} pengajuan`}
            warna={warna(k)}
          />
        ))}
      </div>
      {/* 6 status (dengan draft) = 2 baris × 3; 5 status = satu baris di layar lebar. */}
      <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3', !tampilDraft && 'xl:grid-cols-5')}>
        {STATUS_LIST.filter((s) => tampilDraft || s !== 'draft').map((s) => (
          <div
            key={s}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-fg/[0.03] px-4 py-3 ring-1 ring-fg/[0.06]"
          >
            <StatusBadge status={s} />
            <div className="text-right">
              <p className="angka text-sm font-bold text-fg">{formatRupiah(r.perStatus[s].nilai)}</p>
              <p className="text-[11px] text-fg-muted">{r.perStatus[s].jumlah} pengajuan</p>
            </div>
          </div>
        ))}
      </div>

      <GlassCard className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-5 py-3.5">
          <ListOrdered className="size-4 text-fg-muted" />
          <p className="text-sm font-bold text-fg">Rincian ({formatAngka(rows.length)})</p>
          <p className="w-full text-xs text-fg-muted sm:ml-auto sm:w-auto">
            KO {formatRupiah(r.perMekanisme.KO.nilai)} · LS {formatRupiah(r.perMekanisme.LS.nilai)}
          </p>
        </div>
        {rows.length === 0 ? (
          <Kosong ikon={<ChartColumn />} judul="Tidak ada data" deskripsi="Ubah periode atau filter untuk melihat rekap." />
        ) : (
          <>
          <ul className="divide-y divide-line/70 xl:hidden" aria-label="Rincian pengajuan">
            {rows.map((p, i) => (
              <li key={p.id}>
                <Link to={`/pengajuan/${p.id}`} className="flex gap-3 px-4 py-3 transition-colors active:bg-kuning-400/[0.08]">
                  <span className="w-5 shrink-0 pt-1 text-right text-xs text-fg-subtle">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip>{p.kode}</Chip>
                      <KategoriBadge kategori={p.kategori} pendek className="py-0.5" />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-fg">{p.nama_kegiatan}</p>
                    <p className="mt-0.5 truncate text-xs text-fg-muted">
                      {formatRentangTanggal(p.tanggal_kegiatan, p.tanggal_selesai)} · {p.penerima}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={p.status} className="py-0.5" />
                      <span className="flex items-center gap-1.5">
                        <MekanismeBadge mekanisme={p.mekanisme} />
                        <span className="angka text-sm font-bold text-fg">{formatRupiah(p.total)}</span>
                      </span>
                    </div>
                    {p.no_invoice_mdk && <p className="mt-1 truncate font-mono text-[11px] text-fg-muted">Invoice MDK: {p.no_invoice_mdk}</p>}
                  </div>
                </Link>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 bg-kuning-100 px-4 py-3 text-sm font-extrabold text-navy-950 dark:bg-navy-800 dark:text-kuning-200">
              <span>TOTAL ({formatAngka(rows.length)} pengajuan)</span>
              <span className="angka">{formatRupiah(r.nilai)}</span>
            </li>
          </ul>
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[860px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-14" />
                <col />
                <col className="w-32" />
                <col className="w-40" />
                <col className="w-[180px]" />
                <col className="w-[170px]" />
              </colgroup>
              <thead>
                <tr className="text-[11px] font-bold tracking-wider text-fg-subtle uppercase">
                  <th className="py-3 pr-2 pl-5">No</th>
                  <th className="px-3 py-3">Kode / kegiatan</th>
                  <th className="px-3 py-3">Tanggal</th>
                  <th className="px-3 py-3">Penerima</th>
                  <th className="px-3 py-3">Status / No. Invoice MDK</th>
                  <th className="py-3 pr-5 pl-3 text-right">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => (
                  <tr key={p.id} className="border-t border-line/70 transition-colors hover:bg-kuning-400/[0.07]">
                    <td className="py-2.5 pr-2 pl-5 text-xs text-fg-subtle">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip>{p.kode}</Chip>
                        <KategoriBadge kategori={p.kategori} pendek className="py-0.5" />
                      </div>
                      <Link to={`/pengajuan/${p.id}`} className="mt-1 line-clamp-2 font-semibold text-fg hover:underline" title={p.nama_kegiatan}>
                        {p.nama_kegiatan}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">
                      {formatRentangTanggal(p.tanggal_kegiatan, p.tanggal_selesai)}
                    </td>
                    <td className="truncate px-3 py-2.5 text-fg" title={p.penerima}>
                      {p.penerima}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={p.status} />
                      {p.no_invoice_mdk && (
                        <p className="mt-1 max-w-[170px] truncate font-mono text-[11px] text-fg-muted" title={p.no_invoice_mdk}>
                          {p.no_invoice_mdk}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 pr-5 pl-3 text-right whitespace-nowrap">
                      <span className="angka font-bold text-fg">{formatRupiah(p.total)}</span>
                      <span className="ml-2">
                        <MekanismeBadge mekanisme={p.mekanisme} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-kuning-100 dark:bg-navy-800">
                <tr className="font-extrabold text-navy-950 dark:text-kuning-200">
                  <td className="py-3 pl-5" colSpan={5}>
                    TOTAL ({formatAngka(rows.length)} pengajuan)
                  </td>
                  <td className="angka py-3 pr-5 text-right">{formatRupiah(r.nilai)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          </>
        )}
      </GlassCard>
    </div>
  );
}

function RekapPegawaiView({ q, onPilih }: { q: ReturnType<typeof useRekapPegawai>; onPilih: (r: RekapPegawaiRow) => void }) {
  const kamus = useKamus();
  const warna = useWarnaKategori();
  if (q.isLoading) return <Skeleton className="h-96 rounded-3xl" />;
  if (!q.data) return null;
  const { rows, total } = q.data;
  const maks = Math.max(1, ...rows.map((r) => r.total));
  const kode = jenisPegawai(kamus, q.data);
  const totalJenis = (k: Kategori) => rows.reduce((s, r) => s + (r.perKategori[k] ?? 0), 0);
  // Tabel lebar: kolom per jenis 130px (+ No, Pegawai, Jml, Total).
  const lebarMin = 560 + kode.length * 130;
  return (
    <div className={cn('space-y-5 transition-opacity', q.isFetching && 'opacity-60')}>
      <div className={cn('grid grid-cols-2 gap-3', GRID_STAT[kode.length + 1] ?? 'xl:grid-cols-4')}>
        <StatKecil indeks={0} label="Total seluruh pegawai" nilai={total} sub={`${rows.length} pegawai`} />
        {kode.map((k, i) => (
          <StatKecil
            key={k}
            indeks={i + 1}
            label={kamus.jenis(k).label_pendek}
            nilai={totalJenis(k)}
            sub={kamus.jenis(k).model === 'konsumsi' ? 'dari "uang siapa"' : 'dari nilai per orang'}
            warna={warna(k)}
          />
        ))}
      </div>
      <GlassCard className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-5 py-3.5">
          <p className="flex items-center gap-2 text-sm font-bold text-fg">
            <Users className="size-4 text-fg-muted" /> Rekap per pegawai
          </p>
          <ul className="ml-auto flex flex-wrap gap-3" aria-label="Legenda kategori">
            {kode.map((k) => (
              <li key={k} className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
                <span className="size-2.5 rounded-[3px]" style={{ background: warna(k) }} aria-hidden />
                {kamus.jenis(k).label_pendek}
              </li>
            ))}
          </ul>
        </div>
        {rows.length === 0 ? (
          <Kosong ikon={<Users />} judul="Tidak ada data" deskripsi="Belum ada nilai yang tercatat untuk pegawai pada filter ini." />
        ) : (
          <>
          <ul className="divide-y divide-line/70 xl:hidden" aria-label="Rekap per pegawai">
            {rows.map((r, i) => (
              <li key={r.pegawai_id}>
                <button type="button" onClick={() => onPilih(r)} className="block w-full px-4 py-3 text-left transition-colors active:bg-kuning-400/[0.08]">
                  <span className="flex items-center gap-3">
                    <span className="w-5 shrink-0 text-right text-xs font-bold text-fg-subtle">{i + 1}</span>
                    <Avatar nama={r.nama} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-fg">{r.nama}</span>
                      <span className="block truncate text-xs text-fg-muted">
                        <span className="angka font-extrabold text-fg">{formatRupiah(r.total)}</span> · {r.jumlah} pengajuan
                      </span>
                    </span>
                  </span>
                  <span className="mt-2 ml-8 flex h-1.5 gap-[2px] overflow-hidden rounded-r-[3px]" aria-hidden>
                    {kode.filter((k) => (r.perKategori[k] ?? 0) > 0).map((k) => (
                      <span key={k} className="h-full" style={{ width: `${((r.perKategori[k] ?? 0) / maks) * 100}%`, background: warna(k) }} />
                    ))}
                  </span>
                  <span className="mt-1.5 ml-8 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-fg-muted">
                    {kode.filter((k) => (r.perKategori[k] ?? 0) > 0).map((k) => (
                      <span key={k} className="flex items-center gap-1">
                        <span className="size-2 rounded-[2px]" style={{ background: warna(k) }} aria-hidden />
                        {kamus.jenis(k).label_pendek} Rp {formatRupiahRingkas(r.perKategori[k] ?? 0)}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 bg-kuning-100 px-4 py-3 text-sm font-extrabold text-navy-950 dark:bg-navy-800 dark:text-kuning-200">
              <span>TOTAL ({rows.length} pegawai)</span>
              <span className="angka">{formatRupiah(total)}</span>
            </li>
          </ul>
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full table-fixed text-left text-sm" style={{ minWidth: lebarMin }}>
              <colgroup>
                <col className="w-14" />
                <col />
                <col className="w-16" />
                {kode.map((k) => (
                  <col key={k} className="w-[130px]" />
                ))}
                <col className="w-[150px]" />
              </colgroup>
              <thead>
                <tr className="text-[11px] font-bold tracking-wider text-fg-subtle uppercase">
                  <th className="py-3 pr-2 pl-5">#</th>
                  <th className="px-3 py-3">Pegawai</th>
                  <th className="px-3 py-3 text-center">Jml</th>
                  {kode.map((k) => (
                    <th key={k} className="truncate px-3 py-3 text-right" title={kamus.jenis(k).label}>
                      {kamus.jenis(k).label_pendek}
                    </th>
                  ))}
                  <th className="py-3 pr-5 pl-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <motion.tr
                    key={r.pegawai_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i, 15) * 0.03 }}
                    onClick={() => onPilih(r)}
                    className="cursor-pointer border-t border-line/70 transition-colors hover:bg-kuning-400/[0.08]"
                  >
                    <td className="py-3 pr-2 pl-5 text-xs font-bold text-fg-subtle">{i + 1}</td>
                    <td className="px-3 py-3">
                      <button type="button" className="flex w-full min-w-0 items-center gap-2.5 text-left" onClick={() => onPilih(r)}>
                        <Avatar nama={r.nama} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-fg hover:underline">{r.nama}</span>
                          <span className="block truncate text-xs text-fg-muted">
                            {[r.jabatan, r.nip].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </span>
                      </button>
                      <div className="mt-2 ml-[2.6rem] flex h-1.5 max-w-[260px] gap-[2px] overflow-hidden rounded-r-[3px]" aria-hidden>
                        {kode.filter((k) => (r.perKategori[k] ?? 0) > 0).map((k) => (
                          <span key={k} className="h-full" style={{ width: `${((r.perKategori[k] ?? 0) / maks) * 100}%`, background: warna(k) }} />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-fg">{r.jumlah}</td>
                    {kode.map((k) => (
                      <td key={k} className="angka px-3 py-3 text-right text-fg-muted">
                        {formatAngka(r.perKategori[k] ?? 0)}
                      </td>
                    ))}
                    <td className="angka py-3 pr-5 pl-3 text-right font-extrabold text-fg">{formatRupiah(r.total)}</td>
                  </motion.tr>
                ))}
              </tbody>
              <tfoot className="bg-kuning-100 dark:bg-navy-800">
                <tr className="font-extrabold text-navy-950 dark:text-kuning-200">
                  <td className="py-3 pl-5" colSpan={3}>
                    TOTAL
                  </td>
                  {kode.map((k) => (
                    <td key={k} className="angka px-3 py-3 text-right">
                      {formatAngka(totalJenis(k))}
                    </td>
                  ))}
                  <td className="angka py-3 pr-5 text-right">{formatRupiah(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          </>
        )}
      </GlassCard>
    </div>
  );
}

function DetailPegawaiModal({
  baris,
  filter,
  ket,
  dicetakOleh,
  open,
  onOpenChange,
}: {
  baris: RekapPegawaiRow;
  filter: RekapFilter;
  ket: KeteranganFilter;
  dicetakOleh: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data, isLoading } = useRekapPegawaiDetail(baris.pegawai_id, filter);
  const kamus = useKamus();
  const warna = useWarnaKategori();
  const [sibuk, setSibuk] = useState(false);
  // Sama dengan tabel rekap: semua jenis aktif (walau 0) + jenis lain yang punya data.
  const kodeDetail = data
    ? jenisRekap(kamus, (k) => data.items.some((i) => i.kategori === k), [...new Set(data.items.map((i) => i.kategori))])
    : [];
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      lebar="xl"
      judul={baris.nama}
      deskripsi={`${[baris.jabatan, baris.nip ? `NIP/NUP ${baris.nip}` : null].filter(Boolean).join(' · ') || 'Pegawai'} · ${ket.periode}`}
      ikon={<Layers className="size-5" />}
      footer={
        <Button
          ikon={<FileDown className="size-4" />}
          memuat={sibuk}
          disabled={!data || data.items.length === 0}
          onClick={async () => {
            if (!data) return;
            setSibuk(true);
            try {
              const { pdfRekapPegawaiDetail } = await import('../lib/pdf/laporan');
              pdfRekapPegawaiDetail(data, ket, dicetakOleh, kamus);
              toast.success('PDF rekap pegawai dibuat');
            } catch {
              toast.error('Gagal membuat PDF');
            } finally {
              setSibuk(false);
            }
          }}
        >
          Unduh PDF pegawai
        </Button>
      }
    >
      {isLoading || !data ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-navy-900 p-3.5 text-white dark:bg-white/[0.08]">
              <p className="text-[11px] font-semibold text-navy-200">Total diterima</p>
              <p className="angka mt-0.5 text-lg font-extrabold text-kuning-300">{formatRupiah(data.total)}</p>
            </div>
            {kodeDetail.map((k) => (
              <div key={k} className="rounded-2xl bg-fg/[0.04] p-3.5 ring-1 ring-fg/[0.06]">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-fg-muted">
                  <span className="size-2 rounded-sm" style={{ background: warna(k) }} aria-hidden />
                  {kamus.jenis(k).label_pendek}
                </p>
                <p className="angka mt-0.5 text-base font-bold text-fg">
                  {formatRupiah(data.items.filter((i) => i.kategori === k).reduce((s, i) => s + i.nilai, 0))}
                </p>
              </div>
            ))}
          </div>
          {data.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-fg-muted">Tidak ada pengajuan untuk filter ini.</p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
              {data.items.map((it) => (
                <li key={`${it.pengajuan_id}-${it.peran}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip>{it.kode}</Chip>
                      <KategoriBadge kategori={it.kategori} pendek className="py-0.5" />
                      <span className="text-[11px] font-semibold text-fg-subtle">
                        {it.peran === 'uang_siapa' ? 'sebagai “uang siapa”' : 'sebagai peserta'}
                      </span>
                    </div>
                    <Link to={`/pengajuan/${it.pengajuan_id}`} className="mt-1 block truncate text-sm font-semibold text-fg hover:underline">
                      {it.nama_kegiatan}
                    </Link>
                    <p className="text-xs text-fg-muted">{formatRentangTanggal(it.tanggal_kegiatan, it.tanggal_selesai)}</p>
                  </div>
                  <div className="text-right">
                    <p className="angka font-bold text-fg">{formatRupiah(it.nilai)}</p>
                    <StatusBadge status={it.status} className="mt-1 py-0.5" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
