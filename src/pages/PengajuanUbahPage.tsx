import { Lock } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { PengajuanForm } from '../components/pengajuan/PengajuanForm';
import { Chip, StatusBadge } from '../components/ui/Badge';
import { TautanTombol } from '../components/ui/Button';
import { GlassCard } from '../components/ui/GlassCard';
import { Kosong } from '../components/ui/Kosong';
import { MuatHalaman } from '../components/ui/MuatHalaman';
import { PageHeader } from '../components/ui/PageHeader';
import { useKamus } from '../context/KonfigContext';
import { usePengajuan, useSimpanPengajuan } from '../lib/queries';

export default function PengajuanUbahPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: p, isLoading, isError, error } = usePengajuan(id);
  const simpan = useSimpanPengajuan();
  const kamus = useKamus();

  if (isLoading) return <MuatHalaman />;
  if (isError || !p) {
    return (
      <GlassCard className="mx-auto mt-10 max-w-xl">
        <Kosong
          ikon={<Lock />}
          judul="Pengajuan tidak dapat dibuka"
          deskripsi={error instanceof Error ? error.message : 'Pengajuan tidak ditemukan'}
          aksi={<TautanTombol to="/pengajuan">Kembali ke daftar</TautanTombol>}
        />
      </GlassCard>
    );
  }

  const bisaEdit = p.status === 'draft' || p.status === 'dikembalikan';

  return (
    <div>
      <PageHeader
        judul={`Ubah ${kamus.jenis(p.kategori).label}`}
        atas={
          <>
            <Chip>{p.kode}</Chip>
            <StatusBadge status={p.status} />
          </>
        }
        deskripsi={p.nama_kegiatan}
        kembali={{ ke: `/pengajuan/${p.id}`, label: 'Detail pengajuan' }}
      />
      {!bisaEdit ? (
        <GlassCard className="mx-auto max-w-xl">
          <Kosong
            ikon={<Lock />}
            judul="Pengajuan terkunci"
            deskripsi={
              p.status === 'diajukan_pum'
                ? 'Pengajuan sedang diperiksa PUM. Tarik kembali pengajuan terlebih dahulu bila perlu mengubah data.'
                : p.status === 'diverifikasi_pum'
                  ? 'Pengajuan sudah diverifikasi PUM sehingga tidak dapat diubah.'
                  : p.status === 'diajukan_mdk'
                    ? 'Pengajuan sudah diverifikasi PUM dan diajukan ke MDK sehingga tidak dapat diubah.'
                    : 'Pengajuan yang sudah selesai (paid) tidak dapat diubah.'
            }
            aksi={<TautanTombol to={`/pengajuan/${p.id}`}>Kembali ke detail</TautanTombol>}
          />
        </GlassCard>
      ) : (
        <PengajuanForm
          jenis={kamus.jenis(p.kategori)}
          awal={p}
          teksSimpan="Simpan perubahan"
          onBatal={() => navigate(`/pengajuan/${p.id}`)}
          onSimpan={async (data) => {
            await simpan.mutateAsync({ id: p.id, data });
            toast.success('Perubahan tersimpan');
            navigate(`/pengajuan/${p.id}`);
          }}
        />
      )}
    </div>
  );
}
