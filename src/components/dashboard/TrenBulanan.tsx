import { ChartColumn, Table2 } from 'lucide-react';
import { useState } from 'react';
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
import { KATEGORI_INFO, KATEGORI_LIST, type Kategori } from '../../../shared/constants';
import { NAMA_BULAN, NAMA_BULAN_PENDEK, formatAngka, formatRupiah, formatRupiahRingkas } from '../../../shared/format';
import type { DashboardData } from '../../../shared/types';
import { cn } from '../../lib/cn';
import { GlassCard, JudulKartu } from '../ui/GlassCard';
import { usePaletChart } from './palet';

type Baris = DashboardData['perBulan'][number] & { label: string };

/** Segmen bertumpuk dengan celah 2px (warna permukaan) di antara segmen yang bersentuhan. */
function bentukSegmen(kunci: Kategori) {
  const idx = KATEGORI_LIST.indexOf(kunci);
  return function Segmen(props: BarShapeProps) {
    const { x, y, width, height, fill, payload, isActive } = props;
    if (!height || height <= 0 || !width) return <g />;
    const adaDiBawah = KATEGORI_LIST.slice(0, idx).some((k) => ((payload as Baris | undefined)?.[k] ?? 0) > 0);
    const tinggi = adaDiBawah ? Math.max(0, height - 2) : height;
    return (
      <rect x={x} y={y} width={width} height={tinggi} fill={fill} style={isActive ? { filter: 'brightness(1.12)' } : undefined} />
    );
  };
}

/** Bentuk segmen dibuat sekali (stabil antar render). */
const SEGMEN: Record<Kategori, (props: BarShapeProps) => React.JSX.Element> = {
  konsumsi: bentukSegmen('konsumsi'),
  rumah_tangga: bentukSegmen('rumah_tangga'),
  perjadin: bentukSegmen('perjadin'),
};

function Tip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const baris = payload[0]?.payload as Baris | undefined;
  if (!baris) return null;
  const total = baris.konsumsi + baris.rumah_tangga + baris.perjadin;
  return (
    <div className="glass-strong min-w-52 rounded-2xl px-4 py-3 text-xs shadow-2xl">
      <p className="mb-2 text-[11px] font-bold tracking-wider text-fg-muted uppercase">{NAMA_BULAN[baris.bulan - 1] ?? label}</p>
      <ul className="space-y-1.5">
        {[...KATEGORI_LIST].reverse().map((k) => {
          const entri = payload.find((p) => p.dataKey === k);
          return (
            <li key={k} className="flex items-center gap-2">
              <span className="h-0.5 w-3 rounded-full" style={{ background: String(entri?.color ?? '') }} aria-hidden />
              <span className="flex-1 text-fg-muted">{KATEGORI_INFO[k].labelPendek}</span>
              <span className="angka font-bold text-fg">{formatRupiah(baris[k])}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <span className="font-semibold text-fg-muted">{baris.jumlah} pengajuan</span>
        <span className="angka font-extrabold text-fg">{formatRupiah(total)}</span>
      </div>
    </div>
  );
}

export function TrenBulanan({ data, tahun, redup }: { data: DashboardData['perBulan']; tahun: number; redup?: boolean }) {
  const w = usePaletChart();
  const [tabel, setTabel] = useState(false);
  const baris: Baris[] = data.map((b) => ({ ...b, label: NAMA_BULAN_PENDEK[b.bulan - 1] }));
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
        {KATEGORI_LIST.map((k) => (
          <li key={k} className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
            <span className="size-2.5 rounded-[3px]" style={{ background: w[k] }} aria-hidden />
            {KATEGORI_INFO[k].labelPendek}
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
                  {KATEGORI_LIST.map((k) => (
                    <th key={k} className="px-3 py-2 text-right font-bold">
                      {KATEGORI_INFO[k].labelPendek}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="angka">
                {baris.map((b) => (
                  <tr key={b.bulan} className="border-t border-line">
                    <td className="px-3 py-1.5 font-semibold text-fg">{NAMA_BULAN[b.bulan - 1]}</td>
                    {KATEGORI_LIST.map((k) => (
                      <td key={k} className="px-3 py-1.5 text-right text-fg-muted">
                        {formatAngka(b[k])}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right font-bold text-fg">
                      {formatAngka(b.konsumsi + b.rumah_tangga + b.perjadin)}
                    </td>
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
                  interval={0}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fill: w.sumbu, fontSize: 11 }}
                  tickFormatter={(v: number) => formatRupiahRingkas(v)}
                />
                <Tooltip content={(p) => <Tip {...p} />} cursor={{ fill: w.kursor }} wrapperStyle={{ outline: 'none' }} />
                <BarStack radius={[4, 4, 0, 0]}>
                  {KATEGORI_LIST.map((k) => (
                    <Bar
                      key={k}
                      dataKey={k}
                      name={KATEGORI_INFO[k].labelPendek}
                      fill={w[k]}
                      maxBarSize={24}
                      shape={SEGMEN[k]}
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
