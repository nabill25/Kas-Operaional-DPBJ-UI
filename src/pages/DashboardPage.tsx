import {
  BadgeCheck,
  ClipboardCheck,
  FileExclamationPoint,
  FilePlus,
  Hourglass,
  PencilLine,
  RotateCcwClock,
  Send,
  Sparkles,
  Timer,
  Undo2,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatAngka, formatRupiah, formatRupiahRingkas } from '../../shared/format';
import { KpiTile } from '../components/dashboard/KpiTile';
import { Komposisi } from '../components/dashboard/Komposisi';
import { usePaletChart } from '../components/dashboard/palet';
import { PerluTindakan } from '../components/dashboard/PerluTindakan';
import { Sparkline } from '../components/dashboard/Sparkline';
import { TopPegawai } from '../components/dashboard/TopPegawai';
import { TrenBulanan } from '../components/dashboard/TrenBulanan';
import { RiwayatTimeline } from '../components/pengajuan/RiwayatTimeline';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { Button, TautanTombol } from '../components/ui/Button';
import { Select } from '../components/ui/Field';
import { GlassCard, JudulKartu } from '../components/ui/GlassCard';
import { Kosong } from '../components/ui/Kosong';
import { MuatHalaman } from '../components/ui/MuatHalaman';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../lib/queries';

export default function DashboardPage() {
  const { user, punyaPeran } = useAuth();
  const w = usePaletChart();
  const tahunIni = new Date().getFullYear();
  const [tahun, setTahun] = useState(tahunIni);
  const { data: d, isLoading, isError, error, refetch, isFetching, isPlaceholderData } = useDashboard(tahun);
  const redup = isFetching && isPlaceholderData;

  if (isLoading) return <MuatHalaman />;
  if (isError || !d) {
    return (
      <GlassCard className="mx-auto mt-10 max-w-xl">
        <Kosong
          ikon={<Sparkles />}
          judul="Dashboard gagal dimuat"
          deskripsi={error instanceof Error ? error.message : 'Terjadi kesalahan'}
          aksi={<Button onClick={() => void refetch()}>Coba lagi</Button>}
        />
      </GlassCard>
    );
  }

  const k = d.kpi;
  const pum = punyaPeran('pum', 'admin');
  const rata = k.rataProsesHari === null ? '–' : k.rataProsesHari.toFixed(1).replace('.', ',');
  const perBulanTotal = d.perBulan.map((b) => b.nilai);
  const bulanIni = tahun === tahunIni ? new Date().getMonth() : null;
  const persenSelesai = k.total.nilai > 0 ? Math.round((k.selesai.nilai / k.total.nilai) * 100) : 0;

  return (
    <div>
      <PageHeader
        judul="Dashboard"
        deskripsi={
          user?.role === 'pimpinan'
            ? 'Pemantauan kas operasional DPBJ: nilai pengajuan, progres pemeriksaan PUM & invoice MDK, dan aktivitas terbaru.'
            : 'Ringkasan kas operasional DPBJ: nilai pengajuan, progres pemeriksaan PUM & invoice MDK, dan aktivitas terbaru.'
        }
        aksi={
          <>
            <label className="flex items-center gap-2">
              <span className="text-xs font-semibold text-fg-muted">Tahun</span>
              <Select value={tahun} onChange={(e) => setTahun(Number(e.target.value))} className="h-10 w-28" aria-label="Pilih tahun">
                {d.tahunTersedia.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </label>
            {punyaPeran('operator', 'admin') && (
              <TautanTombol to="/pengajuan/baru" ikon={<FilePlus className="size-4" />}>
                Buat Pengajuan
              </TautanTombol>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Angka utama */}
        <GlassCard
          interaktif
          className="overflow-hidden p-6 xl:col-span-4"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-kuning-400/30 blur-3xl dark:bg-kuning-400/15" aria-hidden />
          <p className="text-[13px] font-semibold text-fg-muted">Total nilai pengajuan {tahun}</p>
          <p className="mt-1 text-[52px] leading-none font-extrabold tracking-[-0.04em] text-fg">
            <AnimatedNumber value={k.total.nilai} format={(n) => `Rp ${formatRupiahRingkas(n, 1)}`} />
          </p>
          <p className="mt-2 text-sm text-fg-muted">
            <span className="font-semibold text-fg">{formatRupiah(k.total.nilai)}</span> · {formatAngka(k.total.jumlah)} pengajuan
          </p>
          <div className="mt-4">
            <Sparkline nilai={perBulanTotal} indeksAksen={bulanIni} warna={w.netral} aksen={w.aksen} />
            <p className="mt-1 text-[11px] text-fg-subtle">Tren Jan–Des {tahun} · titik kuning = bulan berjalan</p>
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-fg-muted">Sudah selesai (paid · proses MDK selesai)</span>
              <span className="angka font-bold text-fg">{persenSelesai}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: w.jalur }}>
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-1000 ease-out"
                style={{ width: `${persenSelesai}%` }}
              />
            </div>
            {k.draft && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-muted">
                <Timer className="size-3.5 shrink-0" aria-hidden />
                Rata-rata proses <b className="angka text-fg">{rata === '–' ? rata : `${rata} hari`}</b> (diajukan ke PUM → paid)
              </p>
            )}
          </div>
        </GlassCard>

        {/* Baris atas = urutan alur (PUM → verifikasi → MDK → paid); baris bawah = 3 kartu pemantauan. */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-12 xl:col-span-8">
          <KpiTile
            indeks={1}
            className="sm:col-span-6 md:col-span-3"
            label="Diajukan ke PUM"
            nilai={k.diajukan_pum.jumlah}
            sub={formatRupiah(k.diajukan_pum.nilai)}
            ikon={<Send />}
            nada="biru"
            ke={pum ? '/verifikasi' : '/pengajuan?status=diajukan_pum'}
          />
          <KpiTile
            indeks={2}
            className="sm:col-span-6 md:col-span-3"
            label="Diverifikasi PUM"
            nilai={k.diverifikasi_pum.jumlah}
            sub={formatRupiah(k.diverifikasi_pum.nilai)}
            ikon={<ClipboardCheck />}
            nada="cyan"
            ke={pum ? '/verifikasi?tab=invoice' : '/pengajuan?status=diverifikasi_pum'}
          />
          <KpiTile
            indeks={3}
            className="sm:col-span-6 md:col-span-3"
            label="Diajukan ke MDK"
            nilai={k.diajukan_mdk.jumlah}
            sub={formatRupiah(k.diajukan_mdk.nilai)}
            ikon={<Hourglass />}
            nada="ungu"
            ke={pum ? '/verifikasi?tab=mdk' : '/pengajuan?status=diajukan_mdk'}
          />
          <KpiTile
            indeks={4}
            className="sm:col-span-6 md:col-span-3"
            label="Selesai (Paid)"
            nilai={k.selesai.jumlah}
            sub={formatRupiah(k.selesai.nilai)}
            ikon={<BadgeCheck />}
            nada="hijau"
            ke="/pengajuan?status=selesai"
          />
          <KpiTile
            indeks={5}
            className="sm:col-span-4"
            label="Dikembalikan (revisi)"
            nilai={k.dikembalikan.jumlah}
            sub={formatRupiah(k.dikembalikan.nilai)}
            ikon={<Undo2 />}
            nada="kuning"
            ke="/pengajuan?status=dikembalikan"
          />
          <KpiTile
            indeks={6}
            className="sm:col-span-4"
            label="Berkas belum lengkap"
            nilai={k.belumLengkap}
            sub="Perlu dilengkapi pengaju"
            ikon={<FileExclamationPoint />}
            nada="merah"
            ke="/pengajuan?kelengkapan=belum_lengkap"
          />
          {k.draft ? (
            <KpiTile
              indeks={7}
              className="col-span-2 sm:col-span-4"
              label="Draft belum diajukan"
              nilai={k.draft.jumlah}
              sub={formatRupiah(k.draft.nilai)}
              ikon={<PencilLine />}
              nada="abu"
              ke="/pengajuan?status=draft"
            />
          ) : (
            <KpiTile
              indeks={7}
              className="col-span-2 sm:col-span-4"
              label="Rata-rata waktu proses"
              nilai={Math.round((k.rataProsesHari ?? 0) * 10)}
              format={(n) => (k.rataProsesHari === null ? '–' : (n / 10).toFixed(1).replace('.', ','))}
              akhiran={k.rataProsesHari === null ? undefined : 'hari'}
              sub="Diajukan ke PUM → paid"
              ikon={<Timer />}
              nada="navy"
            />
          )}
        </div>

        <div className="xl:col-span-8">
          <TrenBulanan data={d.perBulan} tahun={tahun} redup={redup} />
        </div>
        <div className="xl:col-span-4">
          <Komposisi perKategori={d.perKategori} perMekanisme={d.perMekanisme} redup={redup} />
        </div>

        <div className="xl:col-span-7">
          <PerluTindakan data={d.perluTindakan} />
        </div>
        <div className="xl:col-span-5">
          <TopPegawai data={d.topPegawai} tahun={tahun} redup={redup} />
        </div>

        <GlassCard
          className="p-5 sm:p-6 xl:col-span-12"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <JudulKartu
            ikon={<RotateCcwClock className="size-4.5" />}
            judul="Aktivitas terbaru"
            deskripsi="Jejak perubahan terakhir di seluruh pengajuan"
          />
          <div className="mt-4 grid grid-cols-1 gap-x-8 md:grid-cols-2">
            {[d.aktivitas.slice(0, 4), d.aktivitas.slice(4, 8)].map((kolom, i) => (
              <div key={i}>
                {kolom.length > 0 && <RiwayatTimeline items={kolom} tampilKode />}
              </div>
            ))}
          </div>
          {d.aktivitas.length === 0 && <p className="py-6 text-center text-sm text-fg-muted">Belum ada aktivitas.</p>}
          <p className="mt-3 text-center text-xs text-fg-subtle sm:text-right">
            Klik pengajuan di <Link to="/pengajuan" className="font-semibold underline">Daftar Pengajuan</Link> untuk riwayat lengkap.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
