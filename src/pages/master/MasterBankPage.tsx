import { Info, Landmark, PencilLine, Plus, Power, Trash } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { isBankMandiri } from '../../../shared/constants';
import type { Bank } from '../../../shared/types';
import { validateBank } from '../../../shared/validation';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { GlassCard } from '../../components/ui/GlassCard';
import { Kosong, Skeleton } from '../../components/ui/Kosong';
import { MenuItem, MenuPemisah } from '../../components/ui/Menu';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useKonfirmasi } from '../../context/KonfirmasiContext';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useBank, useHapusBank, useSimpanBank } from '../../lib/queries';
import { BarisFilter, CentangAktif, ChipAktif, ChipInfo, MenuAksi, cocokCari, cocokFilter, type FilterAktif } from './bersama';

export default function MasterBankPage() {
  const { data = [], isLoading } = useBank();
  const simpan = useSimpanBank();
  const hapusMut = useHapusBank();
  const konfirmasi = useKonfirmasi();
  const [status, setStatus] = useState<FilterAktif>('aktif');
  const [cari, setCari] = useState('');
  const [form, setForm] = useState<{ open: boolean; bank: Bank | null }>({ open: false, bank: null });

  const tampil = useMemo(() => data.filter((b) => cocokFilter(b.aktif, status) && cocokCari(cari, b.nama)), [data, status, cari]);

  const ubahAktif = async (b: Bank) => {
    try {
      await simpan.mutateAsync({ id: b.id, data: { nama: b.nama, aktif: !b.aktif } });
      toast.success(`${b.nama} ${b.aktif ? 'dinonaktifkan' : 'diaktifkan kembali'}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal memperbarui status bank');
    }
  };

  const hapus = async (b: Bank) => {
    const ok = await konfirmasi({
      judul: `Hapus ${b.nama}?`,
      pesan:
        b.dipakai > 0
          ? `Nama bank ini tercatat pada ${b.dipakai} rekening. Rekening tersebut tidak berubah, hanya saran isian yang hilang.`
          : 'Bank akan dihapus dari daftar saran isian rekening.',
      teksYa: 'Hapus bank',
      varian: 'bahaya',
    });
    if (!ok) return;
    try {
      await hapusMut.mutateAsync(b.id);
      toast.success(`${b.nama} dihapus`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal menghapus bank');
    }
  };

  return (
    <div>
      <PageHeader
        judul="Master Bank"
        deskripsi="Daftar nama bank yang disarankan pada isian rekening (uang siapa & data pegawai). Rekening yang sudah tersimpan tidak ikut berubah."
        aksi={
          <Button ikon={<Plus className="size-4" />} onClick={() => setForm({ open: true, bank: null })}>
            Tambah Bank
          </Button>
        }
      />

      <BarisFilter
        status={status}
        onStatus={setStatus}
        jumlah={{ aktif: data.filter((b) => b.aktif).length, semua: data.length }}
        cari={cari}
        onCari={setCari}
        placeholder="Cari nama bank…"
        labelCari="Cari bank"
        layoutId="seg-bank-status"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-3xl" />
          ))}
        </div>
      ) : tampil.length === 0 ? (
        <GlassCard>
          <Kosong ikon={<Landmark />} judul={cari ? 'Bank tidak ditemukan' : 'Belum ada bank'} deskripsi="Tambahkan bank agar muncul sebagai saran isian rekening." />
        </GlassCard>
      ) : (
        <motion.ul layout aria-label="Daftar bank" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {tampil.map((b) => (
              <motion.li key={b.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                <GlassCard className={cn('flex h-full items-center gap-3.5 p-4', !b.aktif && 'opacity-70')} data-bank={b.nama}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy-900/[0.06] text-fg-muted ring-1 ring-fg/[0.06] dark:bg-white/[0.06]">
                    <Landmark className="size-4.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold break-words text-fg">{b.nama}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <ChipAktif aktif={b.aktif} />
                      <ChipInfo>{b.dipakai} rekening</ChipInfo>
                      {isBankMandiri(b.nama) && <ChipInfo>Bebas biaya transfer</ChipInfo>}
                    </div>
                  </div>
                  <MenuAksi label={`Aksi untuk ${b.nama}`}>
                    <MenuItem ikon={<PencilLine />} onSelect={() => setForm({ open: true, bank: b })}>
                      Ubah nama
                    </MenuItem>
                    <MenuItem ikon={<Power />} onSelect={() => void ubahAktif(b)}>
                      {b.aktif ? 'Nonaktifkan' : 'Aktifkan kembali'}
                    </MenuItem>
                    <MenuPemisah />
                    <MenuItem ikon={<Trash />} bahaya onSelect={() => void hapus(b)}>
                      Hapus
                    </MenuItem>
                  </MenuAksi>
                </GlassCard>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <p className="mt-5 flex items-start gap-2 text-xs text-fg-muted">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden /> Bank nonaktif tidak lagi muncul sebagai saran, tetapi isian rekening tetap boleh
        diketik bebas. Nama yang memuat “Mandiri” (bukan Syariah) dianggap bebas biaya transfer.
      </p>

      <Modal
        open={form.open}
        onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))}
        terkunci={simpan.isPending}
        judul={form.bank ? 'Ubah bank' : 'Tambah bank'}
        ikon={<Landmark className="size-5" />}
        lebar="sm"
      >
        <FormBank key={form.bank?.id ?? 'baru'} bank={form.bank} simpan={simpan} onSelesai={() => setForm((f) => ({ ...f, open: false }))} />
      </Modal>
    </div>
  );
}

function FormBank({ bank, simpan, onSelesai }: { bank: Bank | null; simpan: ReturnType<typeof useSimpanBank>; onSelesai: () => void }) {
  const [nama, setNama] = useState(bank?.nama ?? '');
  const [aktif, setAktif] = useState(bank?.aktif ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateBank({ nama, aktif });
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    try {
      const b = await simpan.mutateAsync({ id: bank?.id, data: h.data });
      toast.success(bank ? 'Bank diperbarui' : `${b.nama} ditambahkan`);
      onSelesai();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors);
        if (Object.keys(err.errors).length === 0) toast.error(err.message);
      }
    }
  };

  return (
    <form onSubmit={kirim} className="space-y-4" noValidate>
      <Field label="Nama bank" htmlFor="bank-nama" error={errors.nama} wajib hint="mis. Bank Mandiri, BNI, BSI (Bank Syariah Indonesia)">
        <Input id="bank-nama" autoFocus maxLength={60} value={nama} invalid={!!errors.nama} onChange={(e) => setNama(e.target.value)} />
      </Field>
      {bank && <CentangAktif id="bank-aktif" aktif={aktif} onChange={setAktif} keterangan="Muncul sebagai saran pada isian rekening" />}
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button varian="kedua" onClick={onSelesai} disabled={simpan.isPending}>
          Batal
        </Button>
        <Button type="submit" memuat={simpan.isPending}>
          {bank ? 'Simpan perubahan' : 'Tambah bank'}
        </Button>
      </div>
    </form>
  );
}
