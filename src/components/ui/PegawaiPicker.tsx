import { Check, ChevronsUpDown, LoaderCircle, Search, UserPlus } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import type { Pegawai } from '../../../shared/types';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { usePegawai, useSimpanPegawai } from '../../lib/queries';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Field, Input } from './Field';

interface PegawaiPickerProps {
  id?: string;
  value: number | null;
  onChange: (id: number, pegawai: Pegawai) => void;
  /** Id pegawai yang tidak boleh dipilih (mis. sudah dipilih di baris lain). */
  kecuali?: number[];
  invalid?: boolean;
  placeholder?: string;
  bolehTambah?: boolean;
}

/** Combobox pegawai: cari, pilih dengan keyboard, atau tambah pegawai baru langsung. */
export function PegawaiPicker({
  id,
  value,
  onChange,
  kecuali = [],
  invalid,
  placeholder = 'Pilih pegawai…',
  bolehTambah = true,
}: PegawaiPickerProps) {
  const { data: semua = [], isLoading } = usePegawai();
  const simpan = useSimpanPegawai();
  const [open, setOpen] = useState(false);
  const [cari, setCari] = useState('');
  const [aktif, setAktif] = useState(0);
  const [tambah, setTambah] = useState<{ nama: string; jabatan: string; nip: string } | null>(null);
  const [errTambah, setErrTambah] = useState<Record<string, string>>({});
  const daftarRef = useRef<HTMLDivElement>(null);

  const terpilih = semua.find((p) => p.id === value);
  const q = cari.trim().toLowerCase();
  const { opsi, tersembunyi } = useMemo(() => {
    const cocok = (p: Pegawai) =>
      !q || p.nama.toLowerCase().includes(q) || (p.nip ?? '').includes(q) || (p.jabatan ?? '').toLowerCase().includes(q);
    const bolehDipilih = (p: Pegawai) => (p.aktif && !kecuali.includes(p.id)) || p.id === value;
    return {
      opsi: semua.filter((p) => bolehDipilih(p) && cocok(p)),
      // Cocok dengan pencarian tetapi sudah dipilih di baris lain → diberi keterangan, bukan disembunyikan diam-diam.
      tersembunyi: q ? semua.filter((p) => p.aktif && kecuali.includes(p.id) && p.id !== value && cocok(p)) : [],
    };
  }, [semua, q, kecuali, value]);

  // Nama yang sudah terdaftar (persis sama) tidak ditawarkan sebagai pegawai baru agar tidak dobel.
  const namaTerdaftar = q.length > 0 && semua.some((p) => p.nama.trim().toLowerCase() === q);
  const adaOpsiTambah = bolehTambah && q.length >= 2 && !namaTerdaftar;
  const jumlahItem = opsi.length + (adaOpsiTambah ? 1 : 0);

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
    setTambah(null);
    setErrTambah({});
  };

  const pilih = (p: Pegawai) => {
    onChange(p.id, p);
    tutup();
  };

  const mulaiTambah = () => {
    setTambah({ nama: cari.trim(), jabatan: '', nip: '' });
    setErrTambah({});
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAktif((a) => (jumlahItem === 0 ? 0 : (a + 1) % jumlahItem));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAktif((a) => (jumlahItem === 0 ? 0 : (a - 1 + jumlahItem) % jumlahItem));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (aktif < opsi.length) pilih(opsi[aktif]);
      else if (adaOpsiTambah) mulaiTambah();
    }
  };

  const simpanBaru = async () => {
    if (!tambah) return;
    try {
      const p = await simpan.mutateAsync({ data: { nama: tambah.nama, jabatan: tambah.jabatan, nip: tambah.nip } });
      toast.success(`Pegawai "${p.nama}" ditambahkan`);
      pilih(p);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrTambah(err.errors);
        if (Object.keys(err.errors).length === 0) toast.error(err.message);
      } else {
        toast.error('Gagal menambah pegawai');
      }
    }
  };

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
          className="kontrol flex items-center gap-2.5 text-left"
        >
          {terpilih ? (
            <>
              <Avatar nama={terpilih.nama} className="size-6 text-[9px] ring-0" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {terpilih.nama}
                {terpilih.jabatan && <span className="ml-1.5 text-xs font-normal text-fg-muted">· {terpilih.jabatan}</span>}
                {!terpilih.aktif && <span className="ml-1.5 text-xs font-normal text-amber-600">(nonaktif)</span>}
              </span>
            </>
          ) : (
            <span className="flex-1 truncate text-fg-subtle">{isLoading ? 'Memuat daftar pegawai…' : placeholder}</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 text-fg-muted" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="glass-strong anim-pop z-50 flex max-h-[min(420px,var(--radix-popover-content-available-height))] w-[max(var(--radix-popover-trigger-width),18rem)] flex-col overflow-hidden rounded-2xl shadow-2xl"
        >
          {tambah ? (
            <div className="space-y-3 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-fg">
                <UserPlus className="size-4 text-kuning-600" aria-hidden /> Tambah pegawai baru
              </p>
              <Field label="Nama" htmlFor="pp-nama" error={errTambah.nama} wajib>
                <Input
                  id="pp-nama"
                  autoFocus
                  value={tambah.nama}
                  invalid={!!errTambah.nama}
                  onChange={(e) => setTambah({ ...tambah, nama: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Jabatan" htmlFor="pp-jabatan" error={errTambah.jabatan}>
                  <Input
                    id="pp-jabatan"
                    value={tambah.jabatan}
                    onChange={(e) => setTambah({ ...tambah, jabatan: e.target.value })}
                  />
                </Field>
                <Field label="NIP/NUP" htmlFor="pp-nip" error={errTambah.nip}>
                  <Input
                    id="pp-nip"
                    inputMode="numeric"
                    value={tambah.nip}
                    invalid={!!errTambah.nip}
                    onChange={(e) => setTambah({ ...tambah, nip: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button varian="hantu" ukuran="sm" onClick={() => setTambah(null)}>
                  Kembali
                </Button>
                <Button ukuran="sm" memuat={simpan.isPending} onClick={simpanBaru}>
                  Simpan & pilih
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-line px-3">
                <Search className="size-4 shrink-0 text-fg-muted" aria-hidden />
                <input
                  autoFocus
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Cari nama, NIP, atau jabatan…"
                  aria-label="Cari pegawai"
                  aria-activedescendant={jumlahItem > 0 ? `${id ?? 'pp'}-opsi-${aktif}` : undefined}
                  className="h-11 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
                />
              </div>
              <div ref={daftarRef} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1.5">
                {isLoading && (
                  <p className="flex items-center gap-2 px-3 py-4 text-sm text-fg-muted">
                    <LoaderCircle className="size-4 animate-spin" /> Memuat…
                  </p>
                )}
                {!isLoading && opsi.length === 0 && !adaOpsiTambah && tersembunyi.length === 0 && (
                  <p className="px-3 py-4 text-center text-sm text-fg-muted">Pegawai tidak ditemukan.</p>
                )}
                {opsi.map((p, i) => (
                  <div
                    key={p.id}
                    id={`${id ?? 'pp'}-opsi-${i}`}
                    data-idx={i}
                    role="option"
                    aria-selected={p.id === value}
                    onMouseEnter={() => setAktif(i)}
                    onClick={() => pilih(p)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm',
                      aktif === i && 'bg-kuning-400/20 dark:bg-kuning-400/12',
                    )}
                  >
                    <Avatar nama={p.nama} className="size-7 text-[10px] ring-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-fg">{p.nama}</p>
                      <p className="truncate text-xs text-fg-muted">
                        {[p.jabatan, p.nip].filter(Boolean).join(' · ') || 'Tanpa jabatan'}
                      </p>
                    </div>
                    {p.id === value && <Check className="size-4 text-emerald-600" aria-hidden />}
                  </div>
                ))}
                {adaOpsiTambah && (
                  <div
                    id={`${id ?? 'pp'}-opsi-${opsi.length}`}
                    data-idx={opsi.length}
                    role="option"
                    aria-selected={false}
                    onMouseEnter={() => setAktif(opsi.length)}
                    onClick={mulaiTambah}
                    className={cn(
                      'mt-1 flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-kuning-500/50 px-2.5 py-2.5 text-sm font-semibold text-fg',
                      aktif === opsi.length && 'bg-kuning-400/20 dark:bg-kuning-400/12',
                    )}
                  >
                    <UserPlus className="size-4 text-kuning-700 dark:text-kuning-300" aria-hidden />
                    Tambah “{cari.trim()}” sebagai pegawai baru
                  </div>
                )}
                {tersembunyi.length > 0 && (
                  <p className="px-3 pt-2 pb-1.5 text-xs text-fg-muted" role="note">
                    {tersembunyi.map((p) => p.nama).join(', ')} sudah dipilih di baris lain.
                  </p>
                )}
              </div>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
