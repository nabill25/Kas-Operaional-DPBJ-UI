import { Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { Tooltip } from 'radix-ui';
import { Link } from 'react-router';
import { formatRupiah, formatRupiahRingkas } from '../../../shared/format';
import type { DashboardData } from '../../../shared/types';
import { Avatar } from '../ui/Avatar';
import { useKamus } from '../../context/KonfigContext';
import { GlassCard, JudulKartu } from '../ui/GlassCard';
import { useWarnaKategori } from './palet';

/** Peringkat pegawai menurut total nilai yang diterima — batang bertumpuk per kategori. */
export function TopPegawai({ data, tahun, redup }: { data: DashboardData['topPegawai']; tahun: number; redup?: boolean }) {
  const warna = useWarnaKategori();
  const kamus = useKamus();
  const maks = Math.max(1, ...data.map((d) => d.total));
  // Urut master; jenis tak dikenal di akhir.
  const jenisDari = (p: (typeof data)[number]) => {
    const ada = Object.keys(p.perKategori).filter((k) => p.perKategori[k] > 0);
    return [...kamus.jenisTampil((k) => ada.includes(k)).filter((j) => ada.includes(j.kode)).map((j) => j.kode), ...ada.filter((k) => !kamus.dikenal(k))];
  };

  return (
    <GlassCard className="h-full p-5 sm:p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <JudulKartu
        ikon={<Trophy className="size-4.5" />}
        judul="Rekap per orang teratas"
        deskripsi={`Nilai terbesar per pegawai, ${tahun}`}
        aksi={
          <Link to="/rekap?tab=pegawai" className="text-xs font-semibold text-navy-700 hover:underline dark:text-kuning-300">
            Lihat semua
          </Link>
        }
      />
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-fg-muted">Belum ada data.</p>
      ) : (
        <ul className={`mt-5 space-y-4 transition-opacity ${redup ? 'opacity-60' : ''}`}>
          {data.map((p, i) => (
            <li key={p.pegawai_id}>
              <div className="mb-1.5 flex items-center gap-2.5">
                <span className="w-4 text-center text-xs font-extrabold text-fg-subtle">{i + 1}</span>
                <Avatar nama={p.nama} className="size-7 text-[10px] ring-0" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{p.nama}</span>
                <span className="angka text-sm font-bold text-fg">{formatRupiahRingkas(p.total, 2)}</span>
              </div>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div
                    tabIndex={0}
                    className="ml-[3.25rem] flex h-2.5 gap-[2px] overflow-hidden rounded-r-[4px] outline-offset-2"
                    aria-label={`${p.nama}: ${jenisDari(p).map((k) => `${kamus.jenis(k).label_pendek} ${formatRupiah(p.perKategori[k])}`).join(', ')}`}
                  >
                    {jenisDari(p).map((k, j) => (
                      <motion.span
                        key={k}
                        className="h-full"
                        style={{ background: warna(k) }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(p.perKategori[k] / maks) * 100}%` }}
                        transition={{ delay: 0.35 + i * 0.07 + j * 0.05, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      />
                    ))}
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content side="top" sideOffset={6} className="glass-strong anim-pop z-50 rounded-xl px-3 py-2 text-xs shadow-xl">
                    <p className="mb-1 font-bold text-fg">{p.nama}</p>
                    {jenisDari(p).map((k) => (
                      <p key={k} className="flex items-center gap-2">
                        <span className="h-0.5 w-3 rounded-full" style={{ background: warna(k) }} aria-hidden />
                        <span className="flex-1 text-fg-muted">{kamus.jenis(k).label_pendek}</span>
                        <span className="angka font-semibold text-fg">{formatRupiah(p.perKategori[k])}</span>
                      </p>
                    ))}
                    <p className="mt-1 border-t border-line pt-1 text-fg-muted">{p.jumlah} pengajuan</p>
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
