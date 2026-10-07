import { Check, ChevronsUpDown, CornerDownLeft, Search, X } from 'lucide-react';
import { Popover } from 'radix-ui';
import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '../../lib/cn';

export interface OpsiCari {
  /** Nilai yang disimpan. */
  value: string;
  /** Teks utama, mis. nama project. */
  label: string;
  /** Kode kecil di depan label, mis. "D0030.07.01.6.001". */
  kode?: string;
  /** Judul kelompok; urutan kelompok mengikuti urutan kemunculan. */
  grup?: string;
}

interface PilihCariProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  opsi: OpsiCari[];
  /** aria-label kotak pencarian, mis. "Cari project". */
  labelCari: string;
  placeholder?: string;
  placeholderCari?: string;
  invalid?: boolean;
  /** Boleh memakai teks ketikan sendiri bila tidak ada di daftar. */
  bolehBebas?: boolean;
}

type Item = { jenis: 'opsi'; opsi: OpsiCari } | { jenis: 'bebas'; teks: string } | { jenis: 'kosongkan' };

/** Pilihan dengan kotak cari (combobox): ketik sebagian kode/nama, pilih dengan klik atau keyboard. */
export function PilihCari({
  id,
  value,
  onChange,
  opsi,
  labelCari,
  placeholder = 'Pilih…',
  placeholderCari = 'Ketik kode atau nama…',
  invalid,
  bolehBebas = true,
}: PilihCariProps) {
  const [open, setOpen] = useState(false);
  const [cari, setCari] = useState('');
  const [aktif, setAktif] = useState(0);
  const daftarRef = useRef<HTMLDivElement>(null);
  const awalan = id ?? 'pc';

  const terpilih = opsi.find((o) => o.value === value);
  const q = cari.trim();

  const items = useMemo<Item[]>(() => {
    // Setiap kata ketikan harus ada (urutan bebas), cocok di kode maupun label.
    const kata = q.toLowerCase().split(/\s+/).filter(Boolean);
    const cocok = opsi.filter((o) => {
      const teks = `${o.kode ?? ''} ${o.label}`.toLowerCase();
      return kata.every((k) => teks.includes(k));
    });
    const hasil: Item[] = [];
    if (!q && value) hasil.push({ jenis: 'kosongkan' });
    hasil.push(...cocok.map((o): Item => ({ jenis: 'opsi', opsi: o })));
    const sudahAda = opsi.some((o) => o.value.toLowerCase() === q.toLowerCase());
    if (bolehBebas && q.length >= 2 && !sudahAda) hasil.push({ jenis: 'bebas', teks: q });
    return hasil;
  }, [opsi, q, value, bolehBebas]);

  useEffect(() => {
    setAktif(0);
  }, [cari, open]);

  useEffect(() => {
    if (!open) return;
    daftarRef.current?.querySelector<HTMLElement>(`[data-idx="${aktif}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [aktif, open]);

  const tutup = () => {
    setOpen(false);
    setCari('');
  };

  const jalankan = (it: Item) => {
    if (it.jenis === 'opsi') onChange(it.opsi.value);
    else if (it.jenis === 'bebas') onChange(it.teks.slice(0, 150));
    else onChange('');
    tutup();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAktif((a) => (items.length === 0 ? 0 : (a + 1) % items.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAktif((a) => (items.length === 0 ? 0 : (a - 1 + items.length) % items.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = items[aktif];
      if (it) jalankan(it);
    }
  };

  const jumlahOpsi = items.filter((it) => it.jenis === 'opsi').length;

  return (
    <Popover.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : tutup())}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid && id ? `${id}-error` : undefined}
          className="kontrol flex h-auto min-h-11 items-center gap-2.5 py-2 text-left"
        >
          {value ? (
            <span className="min-w-0 flex-1">
              {terpilih?.kode && <span className="block font-mono text-[11px] leading-tight text-fg-muted">{terpilih.kode}</span>}
              <span className="block truncate font-medium">{terpilih ? terpilih.label : value}</span>
            </span>
          ) : (
            <span className="flex-1 truncate text-fg-subtle">{placeholder}</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 text-fg-muted" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="glass-strong anim-pop z-50 flex max-h-[min(400px,var(--radix-popover-content-available-height))] w-[max(var(--radix-popover-trigger-width),18rem)] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl shadow-2xl"
        >
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search className="size-4 shrink-0 text-fg-muted" aria-hidden />
            <input
              autoFocus
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              onKeyDown={onKey}
              placeholder={placeholderCari}
              aria-label={labelCari}
              aria-controls={`${awalan}-daftar`}
              aria-activedescendant={items.length > 0 ? `${awalan}-opsi-${aktif}` : undefined}
              className="h-11 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
            />
          </div>
          <div
            ref={daftarRef}
            id={`${awalan}-daftar`}
            role="listbox"
            aria-label={`Daftar ${labelCari.replace(/^cari\s+/i, '')}`}
            className="min-h-0 flex-1 overflow-y-auto p-1.5"
          >
            {jumlahOpsi === 0 && (
              <p className="px-3 py-3 text-center text-sm text-fg-muted">
                {q ? 'Tidak ada yang cocok di daftar.' : 'Daftar kosong.'}
              </p>
            )}
            {items.map((it, i) => {
              const grupBaru =
                it.jenis === 'opsi' &&
                it.opsi.grup &&
                (i === 0 || items[i - 1].jenis !== 'opsi' || (items[i - 1] as { opsi: OpsiCari }).opsi.grup !== it.opsi.grup);
              const kelasBaris = cn(
                'flex cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2 text-sm',
                aktif === i && 'bg-kuning-400/20 dark:bg-kuning-400/12',
              );
              return (
                <Fragment key={it.jenis === 'opsi' ? `o-${it.opsi.value}` : it.jenis}>
                  {grupBaru && (
                    <p className="px-2.5 pt-2 pb-1 text-[10.5px] font-bold tracking-[0.08em] text-fg-subtle uppercase" aria-hidden>
                      {(it as { opsi: OpsiCari }).opsi.grup}
                    </p>
                  )}
                  <div
                    id={`${awalan}-opsi-${i}`}
                    data-idx={i}
                    role="option"
                    aria-selected={it.jenis === 'opsi' && it.opsi.value === value}
                    onMouseEnter={() => setAktif(i)}
                    onClick={() => jalankan(it)}
                    className={cn(
                      kelasBaris,
                      it.jenis === 'bebas' && 'mt-1 border border-dashed border-kuning-500/50 font-semibold',
                      it.jenis === 'kosongkan' && 'text-fg-muted',
                    )}
                  >
                    {it.jenis === 'opsi' ? (
                      <>
                        <span className="min-w-0 flex-1">
                          {it.opsi.kode && <span className="block font-mono text-[11px] leading-tight text-fg-muted">{it.opsi.kode}</span>}
                          <span className="block font-semibold text-fg">{it.opsi.label}</span>
                        </span>
                        {it.opsi.value === value && <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />}
                      </>
                    ) : it.jenis === 'bebas' ? (
                      <>
                        <CornerDownLeft className="mt-0.5 size-4 shrink-0 text-kuning-700 dark:text-kuning-300" aria-hidden />
                        <span className="min-w-0 flex-1 break-words">Pakai teks “{it.teks}”</span>
                      </>
                    ) : (
                      <>
                        <X className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span className="flex-1">Kosongkan pilihan</span>
                      </>
                    )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
