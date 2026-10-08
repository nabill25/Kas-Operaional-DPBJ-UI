import { ChartColumn, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  BarStack,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type TooltipContentProps,
} from 'recharts';
import type { Kategori } from '../../../shared/constants';
import { NAMA_BULAN, NAMA_BULAN_PENDEK, formatAngka, formatRupiah, formatRupiahRingkas } from '../../../shared/format';
import type { DashboardData, JenisPengajuan } from '../../../shared/types';
import { useKamus } from '../../context/KonfigContext';
import { cn } from '../../lib/cn';
import { GlassCard, JudulKartu } from '../ui/GlassCard';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePaletChart, useWarnaKategori } from './palet';

/** Satu baris chart: nilai tiap jenis disimpan di kunci `k:<kode>` agar tidak bentrok dengan kolom lain. */
type Baris = DashboardData['perBulan'][number] & { label: string } & Record<`k:${string}`, number>;

const kunci = (k: Kategori) => `k:${k}` as const;

/** Segmen bertumpuk dengan celah 2px (warna permukaan) di antara segmen yang bersentuhan. */
function bentukSegmen(urutan: readonly Kategori[], idx: number) {
  return function Segmen(props: BarShapeProps) {
    const { x, y, width, height, fill, payload, isActive } = props;
    if (!height || height <= 0 || !width) return <g />;
    const adaDiBawah = urutan.slice(0, idx).some((k) => ((payload as Baris | undefined)?.[kunci(k)] ?? 0) > 0);
    const tinggi = adaDiBawah ? Math.max(0, height - 2) : height;
    return (
      <rect x={x} y={y} width={width} height={tinggi} fill={fill} style={isActive ? { filter: 'brightness(1.12)' } : undefined} />
    );
  };
}

function Tip({ active, payload, label, jenis }: TooltipContentProps & { jenis: JenisPengajuan[] }) {
  if (!active || !payload?.length) return null;
  const baris = payload[0]?.payload as Baris | undefined;
  if (!baris) return null;
  return (
    <div className="glass-strong min-w-52 rounded-2xl px-4 py-3 text-xs shadow-2xl">
      <p className="mb-2 text-[11px] font-bold tracking-wider text-fg-muted uppercase">{NAMA_BULAN[baris.bulan - 1] ?? label}</p>
      <ul className="space-y-1.5">
        {[...jenis].reverse().map((j) => {
          const entri = payload.find((p) => p.dataKey === kunci(j.kode));
          return (
            <li key={j.kode} className="flex items-center gap-2">
              <span className="h-0.5 w-3 rounded-full" style={{ background: String(entri?.color ?? '') }} aria-hidden />
              <span className="flex-1 text-fg-muted">{j.label_pendek}</span>
              <span className="angka font-bold text-fg">{formatRupiah(baris[kunci(j.kode)] ?? 0)}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <span className="font-semibold text-fg-muted">{baris.jumlah} pengajuan</span>
        <span className="angka font-extrabold text-fg">{formatRupiah(baris.nilai)}</span>
      </div>
    </div>
  );
}

export function TrenBulanan({ data, tahun, redup }: { data: DashboardData['perBulan']; tahun: number; redup?: boolean }) {
  const w = usePaletChart();
  const warna = useWarnaKategori();
  const kamus = useKamus();
  const lebar = useMediaQuery('(min-width: 520px)');
  const [tabel, setTabel] = useState(false);

  // Seri = jenis aktif + jenis nonaktif/tak dikenal yang punya nilai pada tahun ini (urut master).
  const jenis = useMemo(() => {
    const ada = new Set(data.flatMap((b) => Object.keys(b.perKategori)));
    const tampil = kamus.jenisTampil((k) => ada.has(k));
    const lain = [...ada].filter((k) => !kamus.dikenal(k)).map((k) => kamus.jenis(k));
    return [...tampil, ...lain];
  }, [data, kamus]);
  const kode = useMemo(() => jenis.map((j) => j.kode), [jenis]);
  // Bentuk segmen dibuat ulang hanya bila daftar seri berubah (stabil antar render).
  const segmen = useMemo(() => kode.map((_, i) => bentukSegmen(kode, i)), [kode]);

  const baris: Baris[] = data.map((b) => {
    const isi = { ...b, label: NAMA_BULAN_PENDEK[b.bulan - 1] } as Baris;
    for (const k of kode) isi[kunci(k)] = b.perKategori[k] ?? 0;
    return isi;
  });
  const kosong = baris.every((b) => b.jumlah === 0);

  return (
    <GlassCard className="flex h-full flex-col p-5 sm:p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <JudulKartu
        ikon={<ChartColumn className="size-4.5" />}
        judul={`Tren nilai bulanan ${tahun}`}
        deskripsi="Nilai pengajuan (selain draft) per bulan, ditumpuk per kategori"
        aksi={
          <button
            type="button"
            onClick={() => setTabel((v) => !v)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-fg-muted ring-1 ring-fg/10 transition hover:bg-fg/[0.05] hover:text-fg"
            aria-pressed={tabel}
          >
            {tabel ? <ChartColumn className="size-3.5" /> : <Table2 className="size-3.5" />}
            {tabel ? 'Grafik' : 'Tabel'}
          </button>
        }
      />

      {/* Legenda (selalu ada untuk ≥2 seri) */}
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Legenda kategori">
        {jenis.map((j) => (
          <li key={j.kode} className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
            <span className="size-2.5 rounded-[3px]" style={{ background: warna(j.kode) }} aria-hidden />
            {j.label_pendek}
          </li>
        ))}
      </ul>

      <div className={cn('mt-3 flex flex-1 flex-col transition-opacity duration-300', redup && 'opacity-60')}>
        {tabel ? (
          <div className="max-h-[300px] overflow-auto rounded-xl ring-1 ring-line">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-fg-muted">
                  <th className="px-3 py-2 font-bold">Bulan</th>
                  {jenis.map((j) => (
                    <th key={j.kode} className="px-3 py-2 text-right font-bold">
                      {j.label_pendek}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="angka">
                {baris.map((b) => (
                  <tr key={b.bulan} className="border-t border-line">
                    <td className="px-3 py-1.5 font-semibold text-fg">{NAMA_BULAN[b.bulan - 1]}</td>
                    {jenis.map((j) => (
                      <td key={j.kode} className="px-3 py-1.5 text-right text-fg-muted">
                        {formatAngka(b[kunci(j.kode)] ?? 0)}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right font-bold text-fg">{formatAngka(b.nilai)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="relative min-h-[300px] flex-1" role="img" aria-label={`Grafik batang bertumpuk nilai pengajuan per bulan tahun ${tahun}`}>
            {kosong && (
              <p className="absolute inset-0 z-10 grid place-items-center text-sm text-fg-muted">
                Belum ada pengajuan pada tahun {tahun}.
              </p>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={baris} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke={w.grid} strokeDasharray="" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: w.grid }}
                  tick={{ fill: w.sumbu, fontSize: 11, fontWeight: 600 }}
                  interval={lebar ? 0 : 1}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fill: w.sumbu, fontSize: 11 }}
                  tickFormatter={(v: number) => formatRupiahRingkas(v)}
                />
                <Tooltip content={(p) => <Tip {...p} jenis={jenis} />} cursor={{ fill: w.kursor }} wrapperStyle={{ outline: 'none' }} />
                <BarStack radius={[4, 4, 0, 0]}>
                  {jenis.map((j, i) => (
                    <Bar
                      key={j.kode}
                      dataKey={kunci(j.kode)}
                      name={j.label_pendek}
                      fill={warna(j.kode)}
                      maxBarSize={24}
                      shape={segmen[i]}
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                  ))}
                </BarStack>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
