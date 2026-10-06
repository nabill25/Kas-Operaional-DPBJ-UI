import { motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';

/** Sparkline 12 titik: garis warna de-emphasis, titik bulan berjalan memakai warna aksen. */
export function Sparkline({
  nilai,
  indeksAksen,
  warna,
  aksen,
  tinggi = 56,
}: {
  nilai: number[];
  indeksAksen: number | null;
  warna: string;
  aksen: string;
  tinggi?: number;
}) {
  const id = useId().replace(/:/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const [lebar, setLebar] = useState(0);

  // Ukur lebar nyata agar titik & garis tidak terdistorsi saat diskalakan.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ukur = () => setLebar(el.clientWidth);
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maks = Math.max(1, ...nilai);
  const pad = 6;
  const langkah = nilai.length > 1 && lebar > 0 ? (lebar - pad * 2) / (nilai.length - 1) : 0;
  const titik = nilai.map((v, i) => [pad + i * langkah, tinggi - pad - (v / maks) * (tinggi - pad * 2)] as const);
  const garis = titik.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = titik.length
    ? `${garis} L${titik[titik.length - 1][0].toFixed(1)},${tinggi} L${titik[0][0].toFixed(1)},${tinggi} Z`
    : '';
  const t = indeksAksen !== null ? titik[indeksAksen] : null;

  return (
    <div ref={ref} className="w-full" style={{ height: tinggi }} aria-hidden>
      {lebar > 0 && (
        <svg width={lebar} height={tinggi} className="overflow-visible">
          <defs>
            <linearGradient id={`${id}-isi`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={warna} stopOpacity="0.22" />
              <stop offset="100%" stopColor={warna} stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            d={area}
            fill={`url(#${id}-isi)`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          />
          <motion.path
            d={garis}
            fill="none"
            stroke={warna}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          />
          {t && (
            <motion.circle
              cx={t[0]}
              cy={t[1]}
              r={4.5}
              fill={aksen}
              stroke="white"
              strokeWidth={2}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.1, type: 'spring', stiffness: 400, damping: 18 }}
            />
          )}
        </svg>
      )}
    </div>
  );
}
