import { FileStack, Info, ListChecks, Lock, PencilLine, Plus, Power, Trash } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { LABEL_BERKAS_LAINNYA } from '../../../shared/constants';
import type { JenisBerkasMaster } from '../../../shared/types';
import { validateJenisBerkas } from '../../../shared/validation';
import { Button } from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/Field';
import { GlassCard } from '../../components/ui/GlassCard';
import { Kosong, Skeleton } from '../../components/ui/Kosong';
import { MenuItem, MenuPemisah } from '../../components/ui/Menu';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useKamus } from '../../context/KonfigContext';
import { useKonfirmasi } from '../../context/KonfirmasiContext';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useHapusJenisBerkas, useMasterJenisBerkas, useSimpanJenisBerkas } from '../../lib/queries';
import { BarisFilter, CentangAktif, ChipAktif, ChipInfo, MenuAksi, PilihSifat, cocokCari, cocokFilter, type FilterAktif } from './bersama';

export default function MasterJenisBerkasPage() {
  const { data = [], isLoading } = useMasterJenisBerkas();
  const kamus = useKamus();
  const simpan = useSimpanJenisBerkas();
  const hapusMut = useHapusJenisBerkas();
  const konfirmasi = useKonfirmasi();
  const [status, setStatus] = useState<FilterAktif>('aktif');
  const [cari, setCari] = useState('');
  const [form, setForm] = useState<{ open: boolean; jb: JenisBerkasMaster | null }>({ open: false, jb: null });
  const [sifat, setSifat] = useState<{ open: boolean; jb: JenisBerkasMaster | null }>({ open: false, jb: null });

  const tampil = useMemo(
    () => data.filter((b) => cocokFilter(b.aktif, status) && cocokCari(cari, b.label, b.keterangan, b.kode)),
    [data, status, cari],
  );

  const ubahAktif = async (b: JenisBerkasMaster) => {
    try {
      await simpan.mutateAsync({ kode: b.kode, data: { label: b.label, keterangan: b.keterangan ?? '', aktif: !b.aktif } });
      toast.success(`${b.label} ${b.aktif ? 'dinonaktifkan' : 'diaktifkan kembali'}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal memperbarui status');
    }
  };

  const hapus = async (b: JenisBerkasMaster) => {
    const ok = await konfirmasi({
      judul: `Hapus ${b.label}?`,
      pesan: 'Jenis berkas akan dihapus permanen. Hanya jenis yang belum pernah dipakai yang dapat dihapus.',
      teksYa: 'Hapus jenis berkas',
      varian: 'bahaya',
    });
    if (!ok) return;
    try {
      await hapusMut.mutateAsync(b.kode);
      toast.success(`${b.label} dihapus`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal menghapus jenis berkas');
    }
  };

  return (
    <div>
      <PageHeader
        judul="Master Jenis Berkas"
        deskripsi="Jenis dokumen kelengkapan pengajuan beserta sifatnya pada tiap jenis pengajuan: wajib (harus diunggah sebelum diajukan) atau tidak wajib."
        aksi={
          <Button ikon={<Plus className="size-4" />} onClick={() => setForm({ open: true, jb: null })}>
            Tambah Jenis Berkas
          </Button>
        }
      />

      <BarisFilter
        status={status}
        onStatus={setStatus}
        jumlah={{ aktif: data.filter((b) => b.aktif).length, semua: data.length }}
        cari={cari}
        onCari={setCari}
        placeholder="Cari nama atau keterangan berkas…"
        labelCari="Cari jenis berkas"
        layoutId="seg-jenis-berkas-status"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      ) : tampil.length === 0 ? (
        <GlassCard>
          <Kosong ikon={<FileStack />} judul={cari ? 'Jenis berkas tidak ditemukan' : 'Belum ada jenis berkas'} deskripsi="Tambahkan jenis berkas, cantumkan pada jenis pengajuan di Master Jenis Pengajuan, lalu atur wajib / tidak wajibnya di sini." />
        </GlassCard>
      ) : (
        <motion.ul layout aria-label="Daftar jenis berkas" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {tampil.map((b) => {
              const dipakaiPada = b.dipakai?.jenis_pengajuan ?? [];
              const wajibDi = dipakaiPada.filter((k) => b.dipakai?.wajib.includes(k));
              const tidakWajibDi = dipakaiPada.filter((k) => !b.dipakai?.wajib.includes(k));
              const file = b.dipakai?.berkas ?? 0;
              const bisaHapus = !b.bawaan && dipakaiPada.length === 0 && file === 0;
              const namaJenis = (daftar: string[]) => daftar.map((k) => kamus.jenis(k).label).join(', ');
              return (
                <motion.li key={b.kode} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <GlassCard className={cn('flex h-full items-start gap-3.5 p-4', !b.aktif && 'opacity-70')} data-jenis-berkas={b.kode}>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy-900/[0.06] text-fg-muted ring-1 ring-fg/[0.06] dark:bg-white/[0.06]">
                      <FileStack className="size-4.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-fg">{b.label}</p>
                      {b.keterangan && <p className="mt-0.5 text-xs text-fg-muted">{b.keterangan}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <ChipAktif aktif={b.aktif} />
                        {b.bawaan && <ChipInfo>Bawaan</ChipInfo>}
                        <ChipInfo>{file} file</ChipInfo>
                      </div>
                      <div className="mt-2 space-y-0.5 text-xs text-fg-muted" data-testid="sifat-berkas">
                        {dipakaiPada.length === 0 ? (
                          <p>Belum dipakai jenis pengajuan mana pun</p>
                        ) : (
                          <>
                            {wajibDi.length > 0 && (
                              <p>
                                Wajib di: <span className="font-semibold text-fg">{namaJenis(wajibDi)}</span>
                              </p>
                            )}
                            {tidakWajibDi.length > 0 && (
                              <p>
                                Tidak wajib di: <span className="font-semibold text-fg">{namaJenis(tidakWajibDi)}</span>
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      {dipakaiPada.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSifat({ open: true, jb: b })}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-fg-muted underline-offset-2 transition hover:text-fg hover:underline"
                          aria-label={`Atur wajib / tidak wajib ${b.label}`}
                        >
                          <ListChecks className="size-3.5" aria-hidden /> Atur wajib / tidak wajib
                        </button>
                      )}
                    </div>
                    <MenuAksi label={`Aksi untuk ${b.label}`}>
                      <MenuItem ikon={<PencilLine />} onSelect={() => setForm({ open: true, jb: b })}>
                        Ubah nama & keterangan
                      </MenuItem>
                      <MenuItem ikon={<ListChecks />} disabled={dipakaiPada.length === 0} onSelect={() => setSifat({ open: true, jb: b })}>
                        {dipakaiPada.length > 0 ? 'Atur wajib / tidak wajib' : 'Atur wajib (belum dipakai)'}
                      </MenuItem>
                      <MenuItem ikon={<Power />} disabled={b.aktif && dipakaiPada.length > 0} onSelect={() => void ubahAktif(b)}>
                        {b.aktif ? (dipakaiPada.length > 0 ? 'Nonaktifkan (masih dipakai)' : 'Nonaktifkan') : 'Aktifkan kembali'}
                      </MenuItem>
                      <MenuPemisah />
                      <MenuItem ikon={<Trash />} bahaya disabled={!bisaHapus} onSelect={() => void hapus(b)}>
                        {b.bawaan ? 'Hapus (jenis bawaan)' : bisaHapus ? 'Hapus permanen' : 'Hapus (sudah dipakai)'}
                      </MenuItem>
                    </MenuAksi>
                  </GlassCard>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}

      <div className="mt-5 space-y-1.5 text-xs text-fg-muted">
        <p className="flex items-start gap-2">
          <ListChecks className="mt-px size-3.5 shrink-0" aria-hidden /> Berkas wajib harus diunggah pengaju sebelum pengajuan dapat
          diajukan ke PUM; berkas tidak wajib boleh diunggah dan tidak menghalangi pengajuan. Sifat yang sama juga tampil di Master
          Jenis Pengajuan.
        </p>
        <p className="flex items-start gap-2">
          <Lock className="mt-px size-3.5 shrink-0" aria-hidden /> “{LABEL_BERKAS_LAINNYA}” selalu tersedia di setiap pengajuan sebagai berkas
          tidak wajib (boleh banyak, diberi nama sendiri), sehingga tidak perlu ditambahkan di sini.
        </p>
        <p className="flex items-start gap-2">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            Jenis berkas yang masih tercantum (wajib/tidak wajib) pada suatu jenis pengajuan tidak dapat dinonaktifkan — keluarkan dulu dari daftar berkasnya di{' '}
            <Link to="/master/jenis-pengajuan" className="font-semibold text-fg underline-offset-2 hover:underline">
              Master Jenis Pengajuan
            </Link>
            .
          </span>
        </p>
      </div>

      <Modal
        open={form.open}
        onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))}
        terkunci={simpan.isPending}
        judul={form.jb ? 'Ubah jenis berkas' : 'Tambah jenis berkas'}
        deskripsi="Nama tampil di tabel kelengkapan berkas, centang PUM, dan laporan."
        ikon={<FileStack className="size-5" />}
        lebar="sm"
      >
        <FormJenisBerkas key={form.jb?.kode ?? 'baru'} jb={form.jb} simpan={simpan} onSelesai={() => setForm((f) => ({ ...f, open: false }))} />
      </Modal>

      <Modal
        open={sifat.open}
        onOpenChange={(o) => setSifat((s) => ({ ...s, open: o }))}
        terkunci={simpan.isPending}
        judul="Atur wajib / tidak wajib"
        deskripsi={sifat.jb ? `${sifat.jb.label} pada tiap jenis pengajuan yang memakainya.` : undefined}
        ikon={<ListChecks className="size-5" />}
        lebar="sm"
      >
        {sifat.jb && (
          <FormSifatBerkas key={sifat.jb.kode} jb={sifat.jb} simpan={simpan} onSelesai={() => setSifat((s) => ({ ...s, open: false }))} />
        )}
      </Modal>
    </div>
  );
}

/** Wajib / tidak wajib berkas ini pada tiap jenis pengajuan yang mencantumkannya (data sama dengan form Jenis Pengajuan). */
function FormSifatBerkas({
  jb,
  simpan,
  onSelesai,
}: {
  jb: JenisBerkasMaster;
  simpan: ReturnType<typeof useSimpanJenisBerkas>;
  onSelesai: () => void;
}) {
  const kamus = useKamus();
  const awal = useMemo(
    () => (jb.dipakai?.jenis_pengajuan ?? []).map((k) => ({ jenis_pengajuan: k, wajib: jb.dipakai?.wajib.includes(k) ?? true })),
    [jb],
  );
  const [daftar, setDaftar] = useState(awal);
  const berubah = daftar.some((s, i) => s.wajib !== awal[i]?.wajib);

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const hasil = await simpan.mutateAsync({
        kode: jb.kode,
        data: { label: jb.label, keterangan: jb.keterangan ?? '', aktif: jb.aktif, sifat: daftar },
      });
      const disinkron = 'disinkron' in hasil ? Number(hasil.disinkron) : 0;
      toast.success(`Pengaturan wajib ${jb.label} disimpan`, {
        description: disinkron > 0 ? `${disinkron} pengajuan Draft/Dikembalikan ikut memakai pengaturan yang baru.` : undefined,
      });
      onSelesai();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal menyimpan pengaturan wajib');
    }
  };

  return (
    <form onSubmit={kirim} className="space-y-4" noValidate>
      <p className="text-xs text-fg-muted">
        <b className="text-fg">Wajib</b> harus diunggah sebelum pengajuan dapat diajukan ke PUM, lalu dicentang sesuai oleh PUM.{' '}
        <b className="text-fg">Tidak wajib</b> boleh diunggah dan tidak menghalangi pengajuan.
      </p>
      <ul className="space-y-1.5" aria-label={`Sifat ${jb.label} per jenis pengajuan`}>
        {daftar.map((s) => {
          const jenis = kamus.jenis(s.jenis_pengajuan);
          return (
            <li
              key={s.jenis_pengajuan}
              data-sifat-jenis={s.jenis_pengajuan}
              data-sifat={s.wajib ? 'wajib' : 'opsional'}
              className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl bg-fg/[0.03] py-1.5 pr-1.5 pl-3 ring-1 ring-fg/[0.06]"
            >
              <span className="min-w-0 flex-1 basis-32 text-sm leading-snug font-semibold break-words text-fg">
                {jenis.label}
                {!jenis.aktif && <span className="font-normal text-fg-subtle"> · nonaktif</span>}
              </span>
              <PilihSifat
                label={`Sifat di ${jenis.label}`}
                wajib={s.wajib}
                onChange={(wajib) => setDaftar((d) => d.map((x) => (x.jenis_pengajuan === s.jenis_pengajuan ? { ...x, wajib } : x)))}
              />
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-fg-muted">
        Berlaku untuk pengajuan baru & yang masih Draft/Dikembalikan; yang sudah diajukan tidak berubah. Untuk mencantumkan berkas ini
        pada jenis pengajuan lain, buka{' '}
        <Link to="/master/jenis-pengajuan" className="font-semibold text-fg underline-offset-2 hover:underline">
          Master Jenis Pengajuan
        </Link>
        .
      </p>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button varian="kedua" onClick={onSelesai} disabled={simpan.isPending}>
          Batal
        </Button>
        <Button type="submit" memuat={simpan.isPending} disabled={!berubah}>
          Simpan
        </Button>
      </div>
    </form>
  );
}

function FormJenisBerkas({
  jb,
  simpan,
  onSelesai,
}: {
  jb: JenisBerkasMaster | null;
  simpan: ReturnType<typeof useSimpanJenisBerkas>;
  onSelesai: () => void;
}) {
  const [label, setLabel] = useState(jb?.label ?? '');
  const [keterangan, setKeterangan] = useState(jb?.keterangan ?? '');
  const [aktif, setAktif] = useState(jb?.aktif ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const masihDipakai = (jb?.dipakai?.jenis_pengajuan.length ?? 0) > 0;

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    const h = validateJenisBerkas({ label, keterangan, aktif });
    if (!h.ok) {
      setErrors(h.errors);
      return;
    }
    try {
      const b = await simpan.mutateAsync({ kode: jb?.kode, data: { label: h.data.label, keterangan: h.data.keterangan ?? '', aktif: h.data.aktif } });
      toast.success(jb ? 'Jenis berkas diperbarui' : `${b.label} ditambahkan`);
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
      <Field label="Nama jenis berkas" htmlFor="jb-label" error={errors.label} wajib hint="mis. Laporan Pekerjaan, Presensi, Kontrak">
        <Input id="jb-label" autoFocus maxLength={60} value={label} invalid={!!errors.label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <Field
        label="Keterangan (opsional)"
        htmlFor="jb-keterangan"
        error={errors.keterangan}
        hint={`Petunjuk singkat untuk pengaju, tampil di bawah nama berkas · ${keterangan.length}/200`}
      >
        <Textarea
          id="jb-keterangan"
          rows={2}
          maxLength={200}
          className="min-h-16"
          value={keterangan}
          placeholder="mis. Rekap presensi bulan berjalan, ditandatangani atasan"
          onChange={(e) => setKeterangan(e.target.value)}
        />
      </Field>
      {jb && (
        <CentangAktif
          id="jb-aktif"
          aktif={aktif}
          onChange={setAktif}
          keterangan={masihDipakai && jb.aktif ? 'Masih tercantum pada jenis pengajuan — tidak dapat dinonaktifkan' : 'Dapat dicantumkan pada jenis pengajuan (wajib atau tidak wajib)'}
        />
      )}
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button varian="kedua" onClick={onSelesai} disabled={simpan.isPending}>
          Batal
        </Button>
        <Button type="submit" memuat={simpan.isPending}>
          {jb ? 'Simpan perubahan' : 'Tambah jenis berkas'}
        </Button>
      </div>
    </form>
  );
}
