import { Compass, ShieldAlert } from 'lucide-react';
import { TautanTombol } from '../components/ui/Button';
import { GlassCard } from '../components/ui/GlassCard';
import { Kosong } from '../components/ui/Kosong';

export default function NotFoundPage() {
  return (
    <GlassCard className="mx-auto mt-10 max-w-xl">
      <Kosong
        ikon={<Compass />}
        judul="Halaman tidak ditemukan"
        deskripsi="Alamat yang Anda buka tidak tersedia atau sudah dipindahkan."
        aksi={<TautanTombol to="/">Kembali ke Dashboard</TautanTombol>}
      />
    </GlassCard>
  );
}

export function TanpaAkses() {
  return (
    <GlassCard className="mx-auto mt-10 max-w-xl">
      <Kosong
        ikon={<ShieldAlert />}
        judul="Tidak memiliki akses"
        deskripsi="Peran akun Anda tidak diizinkan membuka halaman ini. Hubungi administrator bila Anda memerlukan akses."
        aksi={<TautanTombol to="/">Kembali ke Dashboard</TautanTombol>}
      />
    </GlassCard>
  );
}
