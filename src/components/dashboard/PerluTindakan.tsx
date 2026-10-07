import { ChevronRight, ListTodo, PartyPopper } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { Role } from '../../../shared/constants';
import { formatRupiah, selisihHari, waktuRelatif } from '../../../shared/format';
import type { PengajuanRingkas } from '../../../shared/types';
import { useAuth } from '../../context/AuthContext';
import { Chip, StatusBadge } from '../ui/Badge';
import { GlassCard, JudulKartu } from '../ui/GlassCard';
import { ProgressRing } from '../ui/ProgressRing';

const TEKS: Record<Role, { judul: string; deskripsi: string; ke: string }> = {
  operator: {
    judul: 'Perlu tindakan',
    deskripsi: 'Pengajuan dikembalikan PUM dan draft yang belum diajukan',
    ke: '/pengajuan?status=dikembalikan',
  },
  pum: {
    judul: 'Perlu tindakan',
    deskripsi: 'Berkas yang perlu diperiksa, lalu yang menunggu invoice MDK (terlama di atas)',
    ke: '/verifikasi',
  },
  pimpinan: {
    judul: 'Pengajuan berjalan',
    deskripsi: 'Sedang diproses PUM / MDK atau dikembalikan (terlama di atas)',
    ke: '/pengajuan',
  },
  admin: {
    judul: 'Perlu tindakan',
    deskripsi: 'Dikembalikan, menunggu pemeriksaan PUM, dan menunggu invoice MDK',
    ke: '/verifikasi',
  },
};

/** Keterangan lama menunggu sesuai tahap (null bila tidak sedang menunggu). */
function lamaTunggu(p: PengajuanRingkas): { teks: string; hari: number } | null {
  if (p.status === 'diajukan_pum' && p.diajukan_at) {
    const hari = selisihHari(p.diajukan_at);
    return { teks: `menunggu PUM ${hari === 0 ? 'sejak hari ini' : `${hari} hari`}`, hari };
  }
  if (p.status === 'diajukan_mdk' && p.diteruskan_at) {
    const hari = selisihHari(p.diteruskan_at);
    return { teks: `menunggu invoice MDK ${hari === 0 ? 'sejak hari ini' : `${hari} hari`}`, hari };
  }
  return null;
}

export function PerluTindakan({ data }: { data: PengajuanRingkas[] }) {
  const { user } = useAuth();
  const teks = TEKS[user?.role ?? 'operator'];

  return (
    <GlassCard className="h-full p-5 sm:p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      <JudulKartu
        ikon={<ListTodo className="size-4.5" />}
        judul={teks.judul}
        deskripsi={teks.deskripsi}
        aksi={
          <Link to={teks.ke} className="text-xs font-semibold text-navy-700 hover:underline dark:text-kuning-300">
            Lihat semua
          </Link>
        }
      />
      {data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <PartyPopper className="size-8 text-kuning-600 dark:text-kuning-300" aria-hidden />
          <p className="text-sm font-semibold text-fg">Tidak ada yang tertunda</p>
          <p className="text-xs text-fg-muted">Semua pengajuan sudah ditindaklanjuti.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {data.map((p, i) => {
            const tunggu = lamaTunggu(p);
            return (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
              >
                <Link
                  to={`/pengajuan/${p.id}`}
                  className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 ring-1 ring-transparent transition hover:bg-fg/[0.04] hover:ring-fg/[0.06]"
                >
                  <ProgressRing nilai={p.berkas_terpenuhi} total={p.berkas_wajib} ukuran={34} tebal={3.5} />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <Chip>{p.kode}</Chip>
                      <StatusBadge status={p.status} className="min-w-0 py-0.5" />
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-fg">{p.nama_kegiatan}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {formatRupiah(p.total)} ·{' '}
                      {tunggu ? (
                        <span className={tunggu.hari >= 7 ? 'font-semibold text-amber-700 dark:text-amber-300' : undefined}>
                          {tunggu.teks}
                        </span>
                      ) : (
                        `diperbarui ${waktuRelatif(p.updated_at)}`
                      )}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
                </Link>
              </motion.li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
