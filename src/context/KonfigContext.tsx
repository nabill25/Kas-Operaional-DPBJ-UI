import { DatabaseZap } from 'lucide-react';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { buatKamus, type Kamus } from '../../shared/konfig';
import type { Konfig } from '../../shared/types';
import { Button } from '../components/ui/Button';
import { GlassCard } from '../components/ui/GlassCard';
import { Kosong } from '../components/ui/Kosong';
import { useKonfig } from '../lib/queries';

const KonfigContext = createContext<Kamus | null>(null);

/**
 * Memuat master data (jenis pengajuan & jenis berkas) sekali setelah login, lalu menyediakannya untuk semua halaman.
 * Halaman baru tampil setelah konfigurasi siap, sehingga komponen dapat memakainya tanpa status "memuat".
 */
export function KonfigProvider({ children, memuat }: { children: ReactNode; memuat: ReactNode }) {
  const { data, isError, error, refetch, isFetching } = useKonfig();
  const kamus = useMemo(() => (data ? buatKamus(data) : null), [data]);
  if (!kamus) {
    if (!isError) return <>{memuat}</>;
    return (
      <div className="grid min-h-dvh place-items-center p-4">
        <GlassCard className="w-full max-w-md">
          <Kosong
            ikon={<DatabaseZap />}
            judul="Data master gagal dimuat"
            deskripsi={error instanceof Error ? error.message : 'Terjadi kesalahan'}
            aksi={
              <Button memuat={isFetching} onClick={() => void refetch()}>
                Coba lagi
              </Button>
            }
          />
        </GlassCard>
      </div>
    );
  }
  return <KonfigContext.Provider value={kamus}>{children}</KonfigContext.Provider>;
}

/** Kamus master data (jenis pengajuan, jenis berkas). Hanya di dalam KonfigProvider. */
export function useKamus(): Kamus {
  const k = useContext(KonfigContext);
  if (!k) throw new Error('useKamus harus dipakai di dalam KonfigProvider');
  return k;
}

/** Penyedia konfigurasi tetap (test komponen). */
export function KonfigTetap({ konfig, children }: { konfig: Konfig; children: ReactNode }) {
  const kamus = useMemo(() => buatKamus(konfig), [konfig]);
  return <KonfigContext.Provider value={kamus}>{children}</KonfigContext.Provider>;
}
