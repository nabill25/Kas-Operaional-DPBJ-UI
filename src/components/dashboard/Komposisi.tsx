import { ChartPie, Landmark } from 'lucide-react';
import { motion } from 'motion/react';
import { KATEGORI_INFO } from '../../../shared/constants';
import { formatAngka, formatRupiah } from '../../../shared/format';
import type { DashboardData } from '../../../shared/types';
import { useTema } from '../../context/ThemeContext';
import { IKON_KATEGORI } from '../ui/Badge';
import { GlassCard, JudulKartu } from '../ui/GlassCard';
import { PALET } from './palet';

function persen(n: number, total: number): number {
  return total > 0 ? (n / total) * 100 : 0;
}

function teksPersen(n: number, total: number): string {
  const p = persen(n, total);
  return `${p.toFixed(p > 0 && p < 10 ? 1 : 0).replace('.', ',')}%`;
}

/** Komposisi nilai per kategori + pembagian mekanisme KO/LS. */
export function Komposisi({
  perKategori,
  perMekanisme,
  redup,
}: {
  perKategori: DashboardData['perKategori'];
  perMekanisme: DashboardData['perMekanisme'];
  redup?: boolean;
}) {
  const { tema } = useTema();
  const w = PALET[tema];
  const total = perKategori.reduce((s, k) => s + k.nilai, 0);
  const totalMek = perMekanisme.reduce((s, m) => s + m.nilai, 0);

  return (
    <GlassCard
      className="flex h-full flex-col p-5 sm:p-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <JudulKartu ikon={<ChartPie className="size-4.5" />} judul="Komposisi kategori" deskripsi="Porsi nilai pengajuan per kategori" />
      <ul className={`mt-5 space-y-4 transition-opacity ${redup ? 'opacity-60' : ''}`}>
        {perKategori.map((k, i) => {
          const Ikon = IKON_KATEGORI[k.kategori];
          return (
            <li key={k.kategori}>
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg text-white" style={{ background: w[k.kategori] }} aria-hidden>
                  <Ikon className="size-3.5" />
                </span>
                <span className="flex-1 text-sm font-semibold text-fg">{KATEGORI_INFO[k.kategori].labelPendek}</span>
                <span className="angka text-sm font-bold text-fg">{teksPersen(k.nilai, total)}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: w.jalur }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: w[k.kategori] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${persen(k.nilai, total)}%` }}
                  transition={{ delay: 0.25 + i * 0.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <p className="mt-1 text-xs text-fg-muted">
                {formatRupiah(k.nilai)} · {formatAngka(k.jumlah)} pengajuan
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 border-t border-line pt-5">
        <p className="flex items-center gap-2 text-[13px] font-bold text-fg">
          <Landmark className="size-4 text-fg-muted" aria-hidden /> Mekanisme pembayaran
        </p>
        <div className={`mt-3 space-y-3 transition-opacity ${redup ? 'opacity-60' : ''}`}>
          {perMekanisme.map((m, i) => (
            <div key={m.mekanisme} className="flex items-center gap-3">
              <span className="w-7 text-xs font-extrabold text-fg">{m.mekanisme}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: w.jalur }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: w.netral }}
                  initial={{ width: 0 }}
                  animate={{ width: `${persen(m.nilai, totalMek)}%` }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <span className="angka w-12 text-right text-xs font-bold text-fg">{teksPersen(m.nilai, totalMek)}</span>
            </div>
          ))}
          <p className="text-xs text-fg-muted">
            {perMekanisme.map((m) => `${m.mekanisme} ${formatRupiah(m.nilai)} (${m.jumlah})`).join(' · ')}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
