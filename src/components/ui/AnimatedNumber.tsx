import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect } from 'react';
import { formatAngka } from '../../../shared/format';

/**
 * Angka yang "menghitung" menuju nilainya (count-up).
 * Memakai tween berdurasi tetap sehingga selalu berhenti TEPAT di nilai akhir.
 */
export function AnimatedNumber({
  value,
  format = formatAngka,
  className,
  durasi = 0.9,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  durasi?: number;
}) {
  const kurangiGerak = useReducedMotion();
  const mv = useMotionValue(kurangiGerak ? value : 0);
  const teks = useTransform(mv, (v) => format(Math.round(v)));

  useEffect(() => {
    if (kurangiGerak) {
      mv.jump(value);
      return;
    }
    const kontrol = animate(mv, value, { duration: durasi, ease: [0.22, 1, 0.36, 1] });
    return () => kontrol.stop();
  }, [value, kurangiGerak, mv, durasi]);

  return (
    <motion.span className={className} aria-label={format(value)}>
      {teks}
    </motion.span>
  );
}
