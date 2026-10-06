import { ChevronRight, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router';
import { formatRentangTanggal, formatRupiah } from '../../../shared/format';
import type { PengajuanRingkas } from '../../../shared/types';
import { cn } from '../../lib/cn';
import { Chip, KategoriBadge, MekanismeBadge, StatusBadge } from '../ui/Badge';
import { ProgressRing } from '../ui/ProgressRing';

export function TabelPengajuan({ data, redup = false }: { data: PengajuanRingkas[]; redup?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className={cn('transition-opacity duration-300', redup && 'opacity-55')}>
      {/* Desktop */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold tracking-wider text-fg-subtle uppercase">
              <th className="py-3 pr-3 pl-5 font-bold">Pengajuan</th>
              <th className="px-3 py-3 font-bold">Tanggal</th>
              <th className="px-3 py-3 font-bold">Penerima</th>
              <th className="px-3 py-3 text-right font-bold">Nilai</th>
              <th className="px-3 py-3 text-center font-bold">Berkas</th>
              <th className="py-3 pr-5 pl-3 font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p, i) => (
              <motion.tr
                key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 15) * 0.025, duration: 0.3 }}
                onClick={() => navigate(`/pengajuan/${p.id}`)}
                className="group cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-kuning-400/[0.08]"
              >
                <td className="py-3.5 pr-3 pl-5 align-top">
                  <div className="flex items-center gap-2">
                    <Chip>{p.kode}</Chip>
                    <KategoriBadge kategori={p.kategori} pendek className="py-0.5" />
                  </div>
                  <Link
                    to={`/pengajuan/${p.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1.5 block max-w-[340px] truncate font-semibold text-fg group-hover:underline"
                  >
                    {p.nama_kegiatan}
                  </Link>
                  {p.lokasi_tujuan && (
                    <p className="mt-0.5 flex max-w-[340px] items-center gap-1 truncate text-xs text-fg-muted">
                      <MapPin className="size-3 shrink-0" /> {p.lokasi_tujuan}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3.5 align-top whitespace-nowrap text-fg-muted">
                  {formatRentangTanggal(p.tanggal_kegiatan, p.tanggal_selesai)}
                </td>
                <td className="max-w-[220px] px-3 py-3.5 align-top">
                  <p className="truncate font-medium text-fg">{p.penerima}</p>
                  <p className="text-xs text-fg-muted">{p.jumlah_orang} orang</p>
                </td>
                <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                  <p className="angka font-bold text-fg">{formatRupiah(p.total)}</p>
                  <div className="mt-1">
                    <MekanismeBadge mekanisme={p.mekanisme} />
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  <ProgressRing nilai={p.berkas_terpenuhi} total={p.berkas_wajib} ukuran={34} tebal={3.5} className="mx-auto" />
                </td>
                <td className="py-3.5 pr-5 pl-3 align-top">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <StatusBadge status={p.status} />
                      {p.status === 'diajukan_pum' && (
                        <p className="mt-1 text-[11px] text-fg-muted">
                          Dicek PUM {p.berkas_sesuai}/{p.berkas_wajib} sesuai
                        </p>
                      )}
                      {p.status === 'diajukan_mdk' && p.task_name && (
                        <p className="mt-1 max-w-[160px] truncate text-[11px] text-fg-muted" title={`${p.project_hosting ?? '-'} · ${p.task_name}`}>
                          {p.task_name}
                        </p>
                      )}
                      {p.no_invoice_mdk && (
                        <p className="mt-1 max-w-[160px] truncate font-mono text-[11px] text-fg-muted" title={p.no_invoice_mdk}>
                          {p.no_invoice_mdk}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile & tablet */}
      <ul className="space-y-2.5 p-3 lg:hidden">
        {data.map((p, i) => (
          <motion.li
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 12) * 0.03 }}
          >
            <Link
              to={`/pengajuan/${p.id}`}
              className="block rounded-2xl bg-surface/60 p-4 ring-1 ring-fg/[0.07] transition active:scale-[0.99] dark:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip>{p.kode}</Chip>
                  <KategoriBadge kategori={p.kategori} pendek className="py-0.5" />
                </div>
                <ProgressRing nilai={p.berkas_terpenuhi} total={p.berkas_wajib} ukuran={32} tebal={3.5} />
              </div>
              <p className="mt-2 line-clamp-2 font-semibold text-fg">{p.nama_kegiatan}</p>
              <p className="mt-0.5 truncate text-xs text-fg-muted">
                {formatRentangTanggal(p.tanggal_kegiatan, p.tanggal_selesai)} · {p.penerima}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <StatusBadge status={p.status} />
                <div className="flex items-center gap-2">
                  <MekanismeBadge mekanisme={p.mekanisme} />
                  <p className="angka font-extrabold text-fg">{formatRupiah(p.total)}</p>
                </div>
              </div>
            </Link>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
