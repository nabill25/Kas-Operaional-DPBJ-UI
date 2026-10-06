import { twMerge } from 'tailwind-merge';

type Kelas = string | false | null | undefined;

/** Gabungkan className; kelas Tailwind yang bertentangan diselesaikan (yang terakhir menang). */
export function cn(...kelas: Kelas[]): string {
  return twMerge(kelas.filter(Boolean).join(' '));
}
