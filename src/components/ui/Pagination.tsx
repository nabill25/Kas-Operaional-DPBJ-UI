import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatAngka } from '../../../shared/format';
import { cn } from '../../lib/cn';

function nomorHalaman(sekarang: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, sekarang - 1, sekarang, sekarang + 1]);
  const urut = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const hasil: (number | '…')[] = [];
  urut.forEach((n, i) => {
    if (i > 0 && n - urut[i - 1] > 1) hasil.push('…');
    hasil.push(n);
  });
  return hasil;
}

export function Pagination({
  page,
  limit,
  total,
  onChange,
}: {
  page: number;
  limit: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const jumlahHalaman = Math.max(1, Math.ceil(total / limit));
  const awal = total === 0 ? 0 : (page - 1) * limit + 1;
  const akhir = Math.min(total, page * limit);
  const tombol =
    'grid h-9 min-w-9 place-items-center rounded-xl px-2.5 text-[13px] font-semibold transition disabled:pointer-events-none disabled:opacity-40';
  return (
    <nav className="flex flex-col items-center justify-between gap-3 sm:flex-row" aria-label="Navigasi halaman">
      <p className="text-[13px] text-fg-muted">
        Menampilkan <span className="font-semibold text-fg">{formatAngka(awal)}</span>–
        <span className="font-semibold text-fg">{formatAngka(akhir)}</span> dari{' '}
        <span className="font-semibold text-fg">{formatAngka(total)}</span>
      </p>
      {jumlahHalaman > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={cn(tombol, 'text-fg-muted hover:bg-fg/[0.06] hover:text-fg')}
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft className="size-4" />
          </button>
          {nomorHalaman(page, jumlahHalaman).map((n, i) =>
            n === '…' ? (
              <span key={`e${i}`} className="px-1 text-fg-subtle">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                aria-current={n === page ? 'page' : undefined}
                className={cn(
                  tombol,
                  n === page
                    ? 'bg-navy-900 text-white shadow-md dark:bg-kuning-400 dark:text-navy-950'
                    : 'text-fg-muted hover:bg-fg/[0.06] hover:text-fg',
                )}
              >
                {n}
              </button>
            ),
          )}
          <button
            type="button"
            className={cn(tombol, 'text-fg-muted hover:bg-fg/[0.06] hover:text-fg')}
            onClick={() => onChange(page + 1)}
            disabled={page >= jumlahHalaman}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </nav>
  );
}
