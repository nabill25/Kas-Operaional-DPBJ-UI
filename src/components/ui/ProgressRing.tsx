import { motion } from 'motion/react';
import { cn } from '../../lib/cn';

/** Cincin kelengkapan berkas: hijau = lengkap, kuning = sebagian, abu = belum ada. */
export function ProgressRing({
  nilai,
  total,
  ukuran = 38,
  tebal = 4,
  label = true,
  judul = 'Berkas wajib',
  className,
}: {
  nilai: number;
  total: number;
  ukuran?: number;
  tebal?: number;
  label?: boolean;
  /** Awalan label aksesibilitas, mis. "Dicentang sesuai PUM". */
  judul?: string;
  className?: string;
}) {
  const rasio = total === 0 ? 1 : Math.min(1, nilai / total);
  const r = (ukuran - tebal) / 2;
  const keliling = 2 * Math.PI * r;
  const lengkap = total > 0 ? nilai >= total : true;
  const warna = lengkap ? 'stroke-emerald-500' : nilai === 0 ? 'stroke-slate-400' : 'stroke-amber-500';
  const jalur = lengkap ? 'stroke-emerald-500/20' : nilai === 0 ? 'stroke-slate-400/25' : 'stroke-amber-500/25';
  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: ukuran, height: ukuran }}
      role="img"
      aria-label={`${judul} ${nilai} dari ${total}${lengkap ? ', lengkap' : ''}`}
    >
      <svg width={ukuran} height={ukuran} className="-rotate-90" aria-hidden>
        <circle cx={ukuran / 2} cy={ukuran / 2} r={r} fill="none" strokeWidth={tebal} className={jalur} />
        <motion.circle
          cx={ukuran / 2}
          cy={ukuran / 2}
          r={r}
          fill="none"
          strokeWidth={tebal}
          strokeLinecap="round"
          className={warna}
          style={{ strokeDasharray: keliling }}
          initial={{ strokeDashoffset: keliling }}
          animate={{ strokeDashoffset: keliling * (1 - rasio) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      {label && (
        <span className="angka absolute inset-0 grid place-items-center text-[10px] font-bold text-fg" aria-hidden>
          {nilai}/{total}
        </span>
      )}
    </div>
  );
}
