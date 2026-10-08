// Komponen kecil yang dipakai bersama halaman Master Data (hanya admin).
import { Ellipsis, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { Input } from '../../components/ui/Field';
import { Menu } from '../../components/ui/Menu';
import { Segmented } from '../../components/ui/Segmented';
import { cn } from '../../lib/cn';

export type FilterAktif = 'aktif' | 'nonaktif' | 'semua';

export function cocokFilter(aktif: boolean, f: FilterAktif): boolean {
  return f === 'semua' || (f === 'aktif' ? aktif : !aktif);
}

/** Baris filter: status aktif + kotak cari. */
export function BarisFilter({
  status,
  onStatus,
  jumlah,
  cari,
  onCari,
  placeholder,
  layoutId,
  labelCari,
}: {
  status: FilterAktif;
  onStatus: (f: FilterAktif) => void;
  jumlah: { aktif: number; semua: number };
  cari: string;
  onCari: (v: string) => void;
  placeholder: string;
  layoutId: string;
  labelCari: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <Segmented
        label="Status"
        layoutId={layoutId}
        value={status}
        onChange={onStatus}
        opsi={[
          { value: 'aktif', label: 'Aktif', jumlah: jumlah.aktif },
          { value: 'nonaktif', label: 'Nonaktif', jumlah: jumlah.semua - jumlah.aktif },
          { value: 'semua', label: 'Semua', jumlah: jumlah.semua },
        ]}
      />
      <label className="relative flex-1">
        <span className="sr-only">{labelCari}</span>
        <Search className="pointer-events-none absolute top-1/2 z-10 left-3.5 size-4 -translate-y-1/2 text-fg-muted" />
        <Input value={cari} onChange={(e) => onCari(e.target.value)} placeholder={placeholder} className="pl-10" />
      </label>
    </div>
  );
}

export function ChipAktif({ aktif }: { aktif: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset',
        aktif
          ? 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300'
          : 'bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300',
      )}
    >
      {aktif ? 'Aktif' : 'Nonaktif'}
    </span>
  );
}

export function ChipInfo({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('rounded-full bg-fg/[0.05] px-2 py-0.5 text-[11px] font-semibold text-fg-muted', className)}>{children}</span>
  );
}

/** Tombol ⋯ untuk menu aksi satu baris master. */
export function MenuAksi({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Menu
      lebar="w-60"
      pemicu={
        <button
          type="button"
          className="grid size-9 shrink-0 place-items-center rounded-xl text-fg-muted transition hover:bg-fg/[0.06] hover:text-fg"
          aria-label={label}
        >
          <Ellipsis className="size-4" />
        </button>
      }
    >
      {children}
    </Menu>
  );
}

/** Kotak centang "Aktif" pada form master. */
export function CentangAktif({
  id,
  aktif,
  onChange,
  keterangan,
}: {
  id: string;
  aktif: boolean;
  onChange: (v: boolean) => void;
  keterangan: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-2xl bg-fg/[0.03] px-3.5 py-3 ring-1 ring-fg/[0.06]">
      <input
        id={id}
        type="checkbox"
        checked={aktif}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--color-kuning-500)]"
      />
      <span className="text-sm">
        <span className="block font-semibold text-fg">Aktif</span>
        <span className="block text-xs text-fg-muted">{keterangan}</span>
      </span>
    </label>
  );
}

/** Teks pencarian cocok (setiap kata harus ada, urutan bebas). */
export function cocokCari(q: string, ...teks: (string | null | undefined)[]): boolean {
  const kata = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const isi = teks.filter(Boolean).join(' ').toLowerCase();
  return kata.every((k) => isi.includes(k));
}
